import { Component } from "preact";
import { route } from "preact-router";
import { AppContext, type AppContextValue } from "../context";
import { ApiRequestError } from "../api";
import { loadDictionary } from "../dictionary";
import { localDateString } from "../time";
import { MIN_WORD_LENGTH, pointsForLength } from "../../shared/engine/scoring";
import { isBuildable, toLetterSet } from "../../shared/engine/letters";
import type { BadgeKind, BadgeWords, GameView, Ghost, SubmitResult } from "../../shared/types";
import { Letters } from "../components/Letters";
import { WordEntry } from "../components/WordEntry";
import { FoundWords, type FoundWord } from "../components/FoundWords";
import { ScorePanel } from "../components/ScorePanel";
import { RacePanel } from "../components/RacePanel";
import { BadgeIcons } from "../components/BadgeIcons";
import { Timer } from "../components/Timer";

interface Props {
  /** Route param for /play/:date; absent on "/" (today's game). */
  date?: string;
}

type PauseReason = "too_short" | "duplicate" | "not_in_rack" | "unknown";

interface State {
  loading: boolean;
  error: string | null;
  game: GameView | null;
  dict: Set<string> | null;
  ghosts: Ghost[];
  found: FoundWord[];
  draft: string;
  message: { text: string; kind: "ok" | "err" } | null;
  /** True while an error is showing: the clock and ghosts are frozen. */
  paused: boolean;
  /** Why we paused, so resuming can clear the input for un-fixable words. */
  pauseReason: PauseReason | null;
  elapsed: number;
  running: boolean;
  locked: boolean;
  revealed: boolean;
  played: boolean;
  bestScore: number;
  badgeWords: BadgeWords;
  submitting: boolean;
  result: SubmitResult | null;
}

const EMPTY_BADGE_WORDS: BadgeWords = { sun: null, moon: null, star: null };

const EMPTY: State = {
  loading: true,
  error: null,
  game: null,
  dict: null,
  ghosts: [],
  found: [],
  draft: "",
  message: null,
  paused: false,
  pauseReason: null,
  elapsed: 0,
  running: false,
  locked: false,
  revealed: false,
  played: false,
  bestScore: 0,
  badgeWords: EMPTY_BADGE_WORDS,
  submitting: false,
  result: null,
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
 * Play screen. Words are validated locally for instant feedback; the server
 * re-validates and owns the score. Today's game allows one submission; past
 * games can be replayed (best score kept).
 */
export class GameScreen extends Component<Props, State> {
  static contextType = AppContext;

  state: State = { ...EMPTY };

  private timer?: ReturnType<typeof setInterval>;
  private alive = true;
  /** Attempt start, used for per-word timestamps (t = 0). */
  private t0 = Date.now();
  /** word → timestamp, used when building the submit payload. */
  private timestamps = new Map<string, number>();

  componentDidMount(): void {
    window.addEventListener("keydown", this.onKeyDown);
    this.timer = setInterval(() => {
      const { running, paused } = this.state;
      if (!running || paused) return;
      this.setState((prev) => ({ elapsed: prev.elapsed + 200 }));
    }, 200);
    this.load(this.props.date);
  }

  componentWillReceiveProps(next: Props): void {
    if (next.date !== this.props.date) this.load(next.date);
  }

  componentWillUnmount(): void {
    this.alive = false;
    window.removeEventListener("keydown", this.onKeyDown);
    if (this.timer) clearInterval(this.timer);
  }

  /** Type anywhere: letters build the word without focusing the input. */
  private onKeyDown = (event: KeyboardEvent): void => {
    const { locked, submitting, paused } = this.state;
    if (locked || submitting) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    if (paused) {
      if (["Shift", "Control", "Alt", "Meta", "CapsLock", "Tab"].includes(event.key)) return;
      // Resuming from a "not in dictionary" pause also clears the draft + message.
      const clear = this.state.pauseReason === "unknown";
      const resume = (patch: Partial<State>): void =>
        this.setState((prev) => ({
          paused: false,
          pauseReason: null,
          draft: clear ? "" : prev.draft,
          message: null,
          ...patch,
        }));

      if (event.key === "Enter") {
        resume({});
        event.preventDefault();
      } else if (/^[a-zA-Z]$/.test(event.key)) {
        resume({ draft: (clear ? "" : this.state.draft) + event.key.toUpperCase() });
        event.preventDefault();
      } else if (event.key === "Backspace") {
        resume({ draft: clear ? "" : this.state.draft.slice(0, -1) });
        event.preventDefault();
      } else if (event.key === "Escape") {
        this.setState({ draft: "", message: null, paused: false, pauseReason: null });
      } else {
        // Any other key (arrows, digits, …) just resumes.
        resume({});
      }
      return;
    }

    const el = document.activeElement as HTMLElement | null;
    const inField =
      !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
    if (inField) return; // the input handles its own typing

    if (/^[a-zA-Z]$/.test(event.key)) {
      const letter = event.key.toUpperCase();
      this.setState((prev) => ({ draft: prev.draft + letter, paused: false, pauseReason: null }));
      event.preventDefault();
    } else if (event.key === "Backspace") {
      this.setState((prev) => ({ draft: prev.draft.slice(0, -1), paused: false, pauseReason: null }));
      event.preventDefault();
    } else if (event.key === "Enter") {
      this.tryWord();
      event.preventDefault();
    } else if (event.key === "Escape") {
      this.setState({ draft: "", message: null, paused: false, pauseReason: null });
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
      const race = await api.getRace(game.id).catch(() => ({ ghosts: [] as Ghost[] }));
      if (!this.alive) return;

      const badgeWords = me?.badgeWords ?? EMPTY_BADGE_WORDS;
      const found: FoundWord[] = me?.played
        ? me.timeline.map((entry) => ({
            word: entry.word,
            points: pointsForLength(entry.word.length, game.k),
            marks: marksFor(entry.word, badgeWords, game.shortestSeedLength),
          }))
        : [];

      this.t0 = Date.now();
      this.timestamps = new Map();
      const locked = me?.locked ?? false;
      this.setState({
        ...EMPTY,
        loading: false,
        game,
        dict,
        ghosts: race.ghosts,
        found,
        locked,
        revealed: me?.revealed ?? false,
        played: me?.played ?? false,
        bestScore: me?.bestScore ?? 0,
        badgeWords,
        running: !locked,
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
    const el = document.activeElement as HTMLElement | null;
    if (el && el.tagName === "BUTTON") el.blur();
    this.setState((prev) => {
      const clear = prev.paused && prev.pauseReason === "unknown";
      return {
        draft: (clear ? "" : prev.draft) + letter,
        message: prev.paused ? null : prev.message,
        paused: false,
        pauseReason: null,
      };
    });
  };

  /** Ask the server for this word's badge marks (sun/moon need the seeds). */
  private async classify(word: string): Promise<void> {
    const { game } = this.state;
    if (!game) return;
    const { api } = this.context as AppContextValue;
    try {
      const { results } = await api.checkWords(game.id, [word]);
      const marks: BadgeKind[] = results[0]?.marks ?? [];
      if (!this.alive) return;
      this.setState((prev) => ({
        found: prev.found.map((entry) => (entry.word === word ? { ...entry, marks } : entry)),
      }));
    } catch {
      // Leave marks empty on failure; the submit result is authoritative anyway.
    }
  }

  private tryWord = (): void => {
    const { draft, game, dict, found, locked } = this.state;
    if (!game || !dict || locked) return;
    const word = draft.trim().toLowerCase();
    if (!word) return;

    // Failures pause the clock and the ghost race until the next key press.
    const fail = (reason: PauseReason, text: string): void =>
      this.setState({ message: { text, kind: "err" }, paused: true, pauseReason: reason });

    if (word.length < MIN_WORD_LENGTH) {
      fail("too_short", `Too short — ${MIN_WORD_LENGTH}+ letters.`);
      return;
    }
    if (found.some((entry) => entry.word === word)) {
      fail("duplicate", "Already found that one.");
      return;
    }
    const allowed = toLetterSet(game.letters);
    if (!isBuildable(word, allowed)) {
      fail("not_in_rack", "Uses letters that aren't allowed.");
      return;
    }
    if (!dict.has(word)) {
      fail("unknown", "Not in the dictionary.");
      return;
    }

    const points = pointsForLength(word.length, game.k);
    this.timestamps.set(word, Date.now() - this.t0);
    this.setState((prev) => ({
      found: [...prev.found, { word, points, marks: [] }],
      draft: "",
      message: { text: `${word.toUpperCase()}  +${points}`, kind: "ok" },
      paused: false,
      pauseReason: null,
    }));
    void this.classify(word);
  };

  private submit = async (): Promise<void> => {
    const { game, found, submitting, locked } = this.state;
    const { api, store } = this.context as AppContextValue;
    if (!game || submitting || locked) return;

    if (!store.session) {
      route("/signin");
      return;
    }

    this.setState({ submitting: true, message: null });
    const words = found.map((entry) => ({ word: entry.word, t: this.timestamps.get(entry.word) ?? 0 }));

    try {
      const result = await api.submit(game.id, words);
      if (!this.alive) return;
      const badgeWords = result.badgeWords ?? EMPTY_BADGE_WORDS;
      this.setState({
        submitting: false,
        result,
        played: true,
        locked: result.locked,
        running: false,
        paused: false,
        pauseReason: null,
        bestScore: Math.max(result.bestScore, this.state.bestScore),
        badgeWords,
        found: result.accepted.map((word) => ({
          word,
          points: pointsForLength(word.length, game.k),
          marks: marksFor(word, badgeWords, game.shortestSeedLength),
        })),
      });
    } catch (error) {
      if (!this.alive) return;
      if (error instanceof ApiRequestError && error.status === 401) {
        route("/signin");
        return;
      }
      this.setState({
        submitting: false,
        message: { text: "Could not submit. Try again.", kind: "err" },
      });
    }
  };

  private newAttempt = (): void => {
    this.timestamps = new Map();
    this.t0 = Date.now();
    this.setState({
      found: [],
      draft: "",
      message: null,
      elapsed: 0,
      result: null,
      played: false,
      paused: false,
      pauseReason: null,
      badgeWords: EMPTY_BADGE_WORDS,
      running: true,
    });
  };

  private score(): number {
    return this.state.found.reduce((sum, entry) => sum + entry.points, 0);
  }

  render() {
    const {
      loading,
      error,
      game,
      locked,
      revealed,
      played,
      running,
      paused,
      elapsed,
      draft,
      message,
      ghosts,
      found,
      badgeWords,
      submitting,
      result,
      bestScore,
    } = this.state;

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
    const score = this.score();
    const bw = badgeWords ?? EMPTY_BADGE_WORDS;
    const badges = { sun: !!bw.sun, moon: !!bw.moon, star: !!bw.star };
    const selfBadges = {
      sun: found.some((entry) => entry.marks.includes("sun")),
      moon: found.some((entry) => entry.marks.includes("moon")),
      star: found.some((entry) => entry.marks.includes("star")),
    };

    return (
      <div class="board-frame">
        <div class="pane pane--left" aria-hidden="true" />

        <div class="pane pane--mid">
          <section class="panel game__main">
            <header class="game__head">
              <div>
                <h1 class="title">{isToday ? "Today's game" : game.date}</h1>
                <p class="muted">
                  {game.letters.length} letters · seeds are {game.shortestSeedLength}–
                  {game.longestSeedLength} letters
                </p>
              </div>
              <Timer seconds={Math.floor(elapsed / 1000)} running={running && !paused} />
            </header>

            {locked && (
              <p class="notice">
                {revealed
                  ? "You revealed this game, so it's locked."
                  : "You've played today's game. Come back tomorrow, or revisit past games."}
                <a href={`/board/${game.id}`}> See the board</a>
              </p>
            )}

            <Letters letters={game.letters} onPick={this.pick} disabled={locked} />
            <WordEntry
              value={draft}
              onInput={(value) =>
                this.setState((prev) => ({
                  draft: value,
                  message: prev.paused ? null : prev.message,
                  paused: false,
                  pauseReason: null,
                }))
              }
              onSubmit={this.tryWord}
              disabled={locked}
            />

            <div class="flash-slot">
              {message && (
                <p class={message.kind === "ok" ? "flash flash--ok" : "flash flash--err"}>
                  {message.text}
                  {message.kind === "err" && !locked && (
                    <span class="flash__hint"> — press any key to resume</span>
                  )}
                </p>
              )}
            </div>

            {result && (
              <div class="result">
                <p class="result__score">
                  Scored <strong>{result.score}</strong>
                  {!result.locked && <span class="muted"> · best {bestScore}</span>}
                </p>
                <BadgeIcons badges={result.badges} showEmpty />
              </div>
            )}
          </section>

          <FoundWords words={found} maxLength={game.longestSeedLength} minLength={MIN_WORD_LENGTH} />
        </div>

        <div class="pane pane--right">
          <ScorePanel score={score} foundCount={found.length} badges={badges} showBadges={played}>
            {!locked && (
              <div class="score__actions">
                <button
                  type="button"
                  class="btn btn--primary btn--block"
                  disabled={submitting || found.length === 0}
                  onClick={this.submit}
                >
                  {submitting ? "Submitting…" : isToday ? "Submit run" : "Submit best"}
                </button>
                {!isToday && played && (
                  <button type="button" class="btn btn--ghost btn--block" onClick={this.newAttempt}>
                    New attempt
                  </button>
                )}
              </div>
            )}
          </ScorePanel>
          <RacePanel ghosts={ghosts} elapsed={elapsed} selfScore={score} selfBadges={selfBadges} />
        </div>
      </div>
    );
  }
}
