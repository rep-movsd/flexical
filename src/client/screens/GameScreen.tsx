import { Component } from "preact";
import { AppContext, type AppContextValue } from "../context";
import { loadDictionary } from "../dictionary";
import { gameDateString } from "../time";
import { click, beep } from "../sound";
import { MIN_WORD_LENGTH, pointsForLength } from "../../shared/engine/scoring";
import { isBuildable, toLetterSet } from "../../shared/engine/letters";
import type { BadgeKind, BadgeWords, GameView } from "../../shared/types";
import { Letters } from "../components/Letters";
import { WordEntry } from "../components/WordEntry";
import { FoundWords, type FoundWord, type FoundView } from "../components/FoundWords";
import { Icon } from "../components/icons";
import { Timer } from "../components/Timer";
import { HareOverlay } from "../components/HareOverlay";

/** The timed attempt lasts three minutes. */
const HARE_MS = 3 * 60 * 1000;

/** The locally-persisted timer state for one game. */
interface HareState {
  startedAt: number;
  /** Absolute deadline while running. */
  deadline: number | null;
  /** Milliseconds left while paused. */
  remaining: number | null;
  /** Words found during the timed window (the hare boundary). */
  hareCount: number;
  done: boolean;
}

function hareKey(gameId: string): string {
  return `flexical:hare:${gameId}`;
}

function readHare(gameId: string): HareState | null {
  try {
    const raw = localStorage.getItem(hareKey(gameId));
    return raw ? (JSON.parse(raw) as HareState) : null;
  } catch {
    return null;
  }
}

function writeHare(gameId: string, state: HareState): void {
  try {
    localStorage.setItem(hareKey(gameId), JSON.stringify(state));
  } catch {
    // ignore (private mode, quota, …)
  }
}

interface Props {
  /** Route param for /play/:date; absent on "/" (today's game). */
  date?: string;
}

interface State {
  loading: boolean;
  error: string | null;
  game: GameView | null;
  dict: Set<string> | null;
  /** Current display order of the letter keys (shufflable). */
  order: string[];
  found: FoundWord[];
  /** Which found-words body is shown. */
  view: FoundView;
  draft: string;
  message: { text: string; kind: "ok" | "err" } | null;
  /** Revealing another player's words locks the game permanently. */
  locked: boolean;
  badgeWords: BadgeWords;
  /** Timed-attempt state (null = not attempted / past game). */
  hare: HareState | null;
  /** Show the "time's up" modal. */
  hareDone: boolean;
  /** Clock for the countdown. */
  now: number;
}

const EMPTY_BADGE_WORDS: BadgeWords = { sun: null, star: null };

const EMPTY: State = {
  loading: true,
  error: null,
  game: null,
  dict: null,
  order: [],
  found: [],
  view: "words",
  draft: "",
  message: null,
  locked: false,
  badgeWords: EMPTY_BADGE_WORDS,
  hare: null,
  hareDone: false,
  now: 0,
};

/** Badge marks for one word, given what we know about the seed. */
function marksFor(
  word: string,
  badgeWords: BadgeWords | undefined,
  shortestSeedLength: number,
): BadgeKind[] {
  const bw = badgeWords ?? EMPTY_BADGE_WORDS;
  const marks: BadgeKind[] = [];
  if (word === bw.sun) marks.push("sun");
  if (word !== bw.sun && word.length >= shortestSeedLength) marks.push("star");
  return marks;
}

/**
 * Play screen. Today's game has a one-shot 3-minute timed attempt (the "hare"
 * score, tracked locally). The clock starts on the first letter; Insert pauses
 * and resumes. After it — or on any past game — you keep playing untimed (the
 * "tortoise" total).
 */
export class GameScreen extends Component<Props, State> {
  static contextType = AppContext;

  state: State = { ...EMPTY };

  private alive = true;
  private saveTimer?: ReturnType<typeof setTimeout>;
  private ticker?: ReturnType<typeof setInterval>;

  componentDidMount(): void {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("visibilitychange", this.onHide);
    window.addEventListener("pagehide", this.onHide);
    this.ticker = setInterval(this.onTick, 500);
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
    if (this.ticker) clearInterval(this.ticker);
  }

  /** Best-effort flush when the page is being hidden or closed. */
  private onHide = (): void => {
    void this.flush();
  };

  /** Advance the countdown / end the timed attempt when it elapses. */
  private onTick = (): void => {
    const { hare } = this.state;
    if (!hare || hare.done || hare.deadline == null) return;
    const now = Date.now();
    if (now >= hare.deadline) this.endHare();
    else this.setState({ now });
  };

  /** Type anywhere: letters build the word without focusing the input. */
  private onKeyDown = (event: KeyboardEvent): void => {
    if (this.state.locked || this.state.hareDone) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    // Spacebar shuffles the letter keys (works even while the input is focused).
    if (event.key === " ") {
      event.preventDefault();
      const focused = document.activeElement as HTMLElement | null;
      if (focused && focused.tagName === "BUTTON") focused.blur();
      this.shuffle();
      return;
    }

    // Insert pauses / resumes the timed attempt.
    if (event.key === "Insert") {
      event.preventDefault();
      this.togglePause();
      return;
    }

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
      const letter = event.key.toUpperCase();
      if (!this.allowed().has(letter)) {
        beep();
        return;
      }
      this.ensureTimerStarted();
      click(this.state.draft.length);
      this.setState((prev) => ({ draft: prev.draft + letter, message: null }));
    } else if (event.key === "Backspace") {
      event.preventDefault();
      const next = this.state.draft.slice(0, -1);
      if (this.state.draft) click(next.length - 1);
      this.setState({ draft: next, message: null });
    } else if (event.key === "Enter") {
      event.preventDefault();
      this.tryWord();
    }
  };

  /** The set of letters this game permits (uppercase). */
  private allowed(): Set<string> {
    return new Set(this.state.game?.letters ?? []);
  }

  /** Reorder the letter keys into a fresh random permutation. */
  private shuffle = (): void => {
    const base = this.state.order.length ? this.state.order : this.state.game?.letters ?? [];
    if (base.length < 2) return;
    let next = base;
    do {
      next = this.shuffled(base);
    } while (next.join("") === base.join(""));
    this.setState({ order: next });
  };

  private shuffled(source: string[]): string[] {
    const a = [...source];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

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

      // Today's game carries the local timed attempt.
      const isToday = game.id === gameDateString();
      let hare: HareState | null = null;
      let hareDone = false;
      if (isToday) {
        const stored = readHare(game.id);
        if (stored) {
          if (stored.done) {
            hare = stored;
          } else if (stored.remaining != null) {
            hare = stored;
          } else if (stored.deadline != null && stored.deadline <= Date.now()) {
            // The window elapsed while the tab was away.
            hare = {
              ...stored,
              done: true,
              deadline: null,
              remaining: null,
              hareCount: Math.max(stored.hareCount, found.length),
            };
            writeHare(game.id, hare);
            hareDone = true;
          } else {
            hare = stored;
          }
        } else if (me?.harePlayed) {
          // Attempted in another browser; nothing local to resume.
          hare = {
            startedAt: 0,
            deadline: null,
            remaining: null,
            hareCount: me.hareCount,
            done: true,
          };
        }
        // else: not attempted yet — the clock starts on the first letter.
      }

      this.setState({
        ...EMPTY,
        loading: false,
        game,
        dict,
        order: [...game.letters],
        found,
        // New / anonymous players land on the help tab.
        view: !me || me.gamesPlayed === 0 ? "help" : "words",
        locked: me?.locked ?? false,
        badgeWords,
        hare,
        hareDone,
        now: Date.now(),
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

  // --- Timed attempt ---------------------------------------------------------

  /** Start the clock on the first letter of today's game. */
  private ensureTimerStarted = (): void => {
    const { game, hare } = this.state;
    if (!game || game.id !== gameDateString()) return;
    if (hare && (hare.done || hare.deadline != null || hare.remaining != null)) return;
    const now = Date.now();
    const next: HareState = hare
      ? { ...hare, startedAt: now, deadline: now + HARE_MS }
      : { startedAt: now, deadline: now + HARE_MS, remaining: null, hareCount: 0, done: false };
    writeHare(game.id, next);
    this.setState({ hare: next, now });
  };

  /** Pause or resume the timed attempt (Insert). */
  private togglePause = (): void => {
    const { game, hare } = this.state;
    if (!game || !hare || hare.done) return;
    if (hare.remaining != null) {
      const now = Date.now();
      const next: HareState = { ...hare, deadline: now + hare.remaining, remaining: null };
      writeHare(game.id, next);
      this.setState({ hare: next, now });
    } else if (hare.deadline != null) {
      const next: HareState = {
        ...hare,
        remaining: Math.max(0, hare.deadline - Date.now()),
        deadline: null,
      };
      writeHare(game.id, next);
      this.setState({ hare: next });
    }
  };

  private endHare = (): void => {
    const { game, hare, found } = this.state;
    if (!game || !hare) return;
    const next: HareState = {
      ...hare,
      done: true,
      deadline: null,
      remaining: null,
      hareCount: Math.max(hare.hareCount, found.length),
    };
    writeHare(game.id, next);
    this.setState({ hare: next, hareDone: true });
    void this.flush();
  };

  private continueAfterHare = (): void => this.setState({ hareDone: false });

  // --- Play ------------------------------------------------------------------

  private pick = (letter: string): void => {
    if (this.state.locked || this.state.hareDone) return;
    if (!this.allowed().has(letter)) {
      beep();
      return;
    }
    const el = document.activeElement as HTMLElement | null;
    if (el && el.tagName === "BUTTON") el.blur();
    this.ensureTimerStarted();
    click(this.state.draft.length);
    this.setState((prev) => ({ draft: prev.draft + letter, message: null }));
  };

  private tryWord = (): void => {
    const { draft, game, dict, found, locked, hareDone } = this.state;
    if (!game || !dict || locked || hareDone) return;
    const word = draft.trim().toLowerCase();
    if (!word) return;

    const shown = word.toUpperCase();
    const fail = (text: string): void => {
      beep();
      this.setState({ message: { text, kind: "err" }, draft: "" });
    };

    if (word.length < MIN_WORD_LENGTH) return fail(`${shown} is too short`);
    if (found.some((entry) => entry.word === word)) return fail(`${shown} has already been found`);
    if (!isBuildable(word, toLetterSet(game.letters))) {
      return fail(`${shown} uses letters that aren't allowed`);
    }
    if (!dict.has(word)) return fail(`${shown} is not in the dictionary`);

    const points = pointsForLength(word.length, game.k);
    const nextFound = [...found, { word, points, marks: [] }];
    // While the timed window runs, every word extends the hare boundary.
    const prevHare = this.state.hare;
    const hare =
      prevHare && !prevHare.done && prevHare.deadline != null
        ? { ...prevHare, hareCount: nextFound.length }
        : prevHare;
    if (hare && hare !== prevHare) writeHare(game.id, hare);

    this.setState({
      found: nextFound,
      draft: "",
      message: { text: `${shown}  +${points}`, kind: "ok" },
      // Leave the help tab once the first word is found.
      view: this.state.view === "help" ? "words" : this.state.view,
      hare,
    });
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
    const { game, found, hare } = this.state;
    if (!game || found.length === 0) return; // never create an empty run

    const { api } = this.context as AppContextValue;
    try {
      const result = await api.saveWords(
        game.id,
        found.map((entry) => entry.word),
        hare ? hare.hareCount : undefined,
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

  private hareScore(): number {
    const { hare, found } = this.state;
    if (!hare) return 0;
    return found.slice(0, hare.hareCount).reduce((sum, entry) => sum + entry.points, 0);
  }

  private hareMsLeft(): number {
    const { hare, now } = this.state;
    if (!hare) return HARE_MS;
    if (hare.done) return 0;
    if (hare.remaining != null) return hare.remaining;
    if (hare.deadline != null) return Math.max(0, hare.deadline - now);
    return HARE_MS;
  }

  render() {
    const { loading, error, game, locked, draft, message, found, order, view, hare, hareDone } =
      this.state;

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

    const isToday = game.id === gameDateString();
    const paused = hare !== null && !hare.done && hare.remaining != null;
    const disabled = locked || hareDone;

    return (
      <>
        <div class="board-frame">
          <div class="pane pane--mid">
            <section class="panel letter-box">
              <header class="game__head">
                <h1 class="title">{isToday ? "Today's game" : game.date}</h1>
                <div class="game__controls">
                  {isToday && (
                    <Timer msLeft={this.hareMsLeft()} paused={paused} done={hare?.done} />
                  )}
                  {isToday && hare && !hare.done && (
                    <button
                      type="button"
                      class="iconbtn"
                      title={paused ? "Resume (Insert)" : "Pause (Insert)"}
                      aria-label={paused ? "Resume" : "Pause"}
                      onClick={this.togglePause}
                    >
                      <Icon name="pause" size={16} />
                    </button>
                  )}
                  <button
                    type="button"
                    class="iconbtn"
                    title="Shuffle letters (Space)"
                    aria-label="Shuffle letters"
                    onClick={this.shuffle}
                  >
                    <Icon name="shuffle" size={18} />
                  </button>
                </div>
              </header>

              {locked && (
                <p class="notice">
                  You revealed this game, so it's locked.
                  <a href={`/archive/${game.id}`}> See the board</a>
                </p>
              )}

              <Letters
                letters={order.length ? order : game.letters}
                onPick={this.pick}
                disabled={disabled}
              />
              <WordEntry
                value={draft}
                onInput={(value) => {
                  const allowed = this.allowed();
                  const filtered = value
                    .split("")
                    .filter((ch) => allowed.has(ch))
                    .join("");
                  if (filtered.length < value.length) beep();
                  else if (filtered.length) click(filtered.length - 1);
                  if (filtered.length) this.ensureTimerStarted();
                  this.setState({ draft: filtered, message: null });
                }}
                onSubmit={this.tryWord}
                disabled={disabled}
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
              view={view}
              onView={(next) => this.setState({ view: next })}
            />
          </div>
        </div>

        {hareDone && <HareOverlay hareScore={this.hareScore()} onContinue={this.continueAfterHare} />}
      </>
    );
  }
}
