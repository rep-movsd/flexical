import { Component } from "preact";
import { AppContext, type AppContextValue } from "../context";
import { loadDictionary } from "../dictionary";
import { localDateString } from "../time";
import { MIN_WORD_LENGTH, pointsForLength } from "../../shared/engine/scoring";
import { isBuildable, toLetterSet } from "../../shared/engine/letters";
import type { BadgeKind, BadgeWords, GameView } from "../../shared/types";
import { Letters } from "../components/Letters";
import { WordEntry } from "../components/WordEntry";
import { FoundWords, type FoundWord } from "../components/FoundWords";

interface Props {
  /** Route param for /play/:date; absent on "/" (today's game). */
  date?: string;
}

interface State {
  loading: boolean;
  error: string | null;
  game: GameView | null;
  dict: Set<string> | null;
  found: FoundWord[];
  draft: string;
  message: { text: string; kind: "ok" | "err" } | null;
  /** Revealing another player's words locks the game permanently. */
  locked: boolean;
  badgeWords: BadgeWords;
}

const EMPTY_BADGE_WORDS: BadgeWords = { sun: null, moon: null, star: null };

const EMPTY: State = {
  loading: true,
  error: null,
  game: null,
  dict: null,
  found: [],
  draft: "",
  message: null,
  locked: false,
  badgeWords: EMPTY_BADGE_WORDS,
};

/** Badge marks for one word, given what we know about the seeds. */
function marksFor(
  word: string,
  badgeWords: BadgeWords | undefined,
  shortestSeedLength: number,
): BadgeKind[] {
  const bw = badgeWords ?? EMPTY_BADGE_WORDS;
  const marks: BadgeKind[] = [];
  if (word === bw.sun) marks.push("sun");
  if (word === bw.moon) marks.push("moon");
  const isSeed = word === bw.sun || word === bw.moon;
  if (!isSeed && word.length >= shortestSeedLength) marks.push("star");
  return marks;
}

/**
 * Play screen. A game stays open forever — words accumulate and auto-save as you
 * find them; the only way it locks is by revealing another player's words.
 */
export class GameScreen extends Component<Props, State> {
  static contextType = AppContext;

  state: State = { ...EMPTY };

  private alive = true;
  private saveTimer?: ReturnType<typeof setTimeout>;

  componentDidMount(): void {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("visibilitychange", this.onHide);
    window.addEventListener("pagehide", this.onHide);
    this.load(this.props.date);
  }

  componentWillReceiveProps(next: Props): void {
    if (next.date !== this.props.date) this.load(next.date);
  }

  componentWillUnmount(): void {
    this.alive = false;
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("visibilitychange", this.onHide);
    window.removeEventListener("pagehide", this.onHide);
    if (this.saveTimer) clearTimeout(this.saveTimer);
  }

  /** Best-effort flush when the page is being hidden or closed. */
  private onHide = (): void => {
    void this.flush();
  };

  /** Type anywhere: letters build the word without focusing the input. */
  private onKeyDown = (event: KeyboardEvent): void => {
    if (this.state.locked) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    if (event.key === "Escape") {
      event.preventDefault();
      this.setState({ draft: "", message: null });
      return;
    }

    const el = document.activeElement as HTMLElement | null;
    const inField =
      !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
    if (inField) return; // the input handles its own typing

    if (/^[a-zA-Z]$/.test(event.key)) {
      event.preventDefault();
      this.setState((prev) => ({ draft: prev.draft + event.key.toUpperCase() }));
    } else if (event.key === "Backspace") {
      event.preventDefault();
      this.setState((prev) => ({ draft: prev.draft.slice(0, -1) }));
    } else if (event.key === "Enter") {
      event.preventDefault();
      this.tryWord();
    }
  };

  private async load(date?: string): Promise<void> {
    this.alive = true;
    this.setState({ ...EMPTY });

    const { api } = this.context as AppContextValue;
    try {
      const [response, dict] = await Promise.all([
        date ? api.getGame(date) : api.getTodayGame(),
        loadDictionary(),
      ]);
      if (!this.alive) return;

      const game = response.game;
      const me = response.me;
      const badgeWords = me?.badgeWords ?? EMPTY_BADGE_WORDS;
      const found: FoundWord[] = (me?.words ?? []).map((word) => ({
        word,
        points: pointsForLength(word.length, game.k),
        marks: marksFor(word, badgeWords, game.shortestSeedLength),
      }));

      this.setState({
        ...EMPTY,
        loading: false,
        game,
        dict,
        found,
        locked: me?.locked ?? false,
        badgeWords,
      });
    } catch (error) {
      if (!this.alive) return;
      this.setState({
        ...EMPTY,
        loading: false,
        error: error instanceof Error ? error.message : "Could not load the game.",
      });
    }
  }

  private pick = (letter: string): void => {
    if (this.state.locked) return;
    const el = document.activeElement as HTMLElement | null;
    if (el && el.tagName === "BUTTON") el.blur();
    this.setState((prev) => ({ draft: prev.draft + letter, message: null }));
  };

  private tryWord = (): void => {
    const { draft, game, dict, found, locked } = this.state;
    if (!game || !dict || locked) return;
    const word = draft.trim().toLowerCase();
    if (!word) return;

    const fail = (text: string): void => this.setState({ message: { text, kind: "err" } });

    if (word.length < MIN_WORD_LENGTH) return fail(`Too short — ${MIN_WORD_LENGTH}+ letters.`);
    if (found.some((entry) => entry.word === word)) return fail("Already found that one.");
    if (!isBuildable(word, toLetterSet(game.letters))) {
      return fail("Uses letters that aren't allowed.");
    }
    if (!dict.has(word)) return fail("Not in the dictionary.");

    const points = pointsForLength(word.length, game.k);
    this.setState((prev) => ({
      found: [...prev.found, { word, points, marks: [] }],
      draft: "",
      message: { text: `${word.toUpperCase()}  +${points}`, kind: "ok" },
    }));
    this.scheduleSave();
  };

  /** Debounce saves so a burst of words is one write, not many. */
  private scheduleSave = (): void => {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.flush(), 1000);
  };

  /** Persist the player's word set (anonymous: validate + badge marks only). */
  private async flush(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = undefined;
    }
    const { game, found } = this.state;
    if (!game) return;

    const { api } = this.context as AppContextValue;
    try {
      const result = await api.saveWords(
        game.id,
        found.map((entry) => entry.word),
      );
      if (!this.alive) return;
      const badgeWords = result.badgeWords ?? EMPTY_BADGE_WORDS;
      this.setState((prev) => ({
        badgeWords,
        locked: result.locked,
        found: prev.found.map((entry) => ({
          ...entry,
          marks: marksFor(entry.word, badgeWords, game.shortestSeedLength),
        })),
      }));
    } catch {
      // Not fatal — local play continues and the next flush retries.
    }
  }

  private score(): number {
    return this.state.found.reduce((sum, entry) => sum + entry.points, 0);
  }

  render() {
    const { loading, error, game, locked, draft, message, found } = this.state;

    if (loading) {
      return (
        <div class="page">
          <p class="muted">Loading…</p>
        </div>
      );
    }
    if (error || !game) {
      return (
        <div class="page">
          <p class="error">{error ?? "Game unavailable."}</p>
        </div>
      );
    }

    const isToday = game.id === localDateString();

    return (
      <div class="board-frame">
        <div class="pane pane--mid">
          <section class="panel game__main">
            <header class="game__head">
              <h1 class="title">{isToday ? "Today's game" : game.date}</h1>
            </header>

            {locked && (
              <p class="notice">
                You revealed this game, so it's locked.
                <a href={`/board/${game.id}`}> See the board</a>
              </p>
            )}

            <Letters letters={game.letters} onPick={this.pick} disabled={locked} />
            <WordEntry
              value={draft}
              onInput={(value) => this.setState({ draft: value, message: null })}
              onSubmit={this.tryWord}
              disabled={locked}
            />

            <div class="flash-slot">
              {message && (
                <p class={message.kind === "ok" ? "flash flash--ok" : "flash flash--err"}>
                  {message.text}
                </p>
              )}
            </div>
          </section>

          <FoundWords
            words={found}
            score={this.score()}
            maxLength={game.longestSeedLength}
            minLength={MIN_WORD_LENGTH}
            counts={game.counts}
          />
        </div>
      </div>
    );
  }
}
