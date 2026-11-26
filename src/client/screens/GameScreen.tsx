import { Component } from "preact";
import { route } from "preact-router";
import { AppContext, type AppContextValue } from "../context";
import { ApiRequestError } from "../api";
import { loadDictionary } from "../dictionary";
import { localDateString } from "../time";
import { MIN_WORD_LENGTH, pointsForLength } from "../../shared/engine/scoring";
import { isBuildable, toLetterSet } from "../../shared/engine/letters";
import type { GameView, Ghost, SubmitResult } from "../../shared/types";
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

interface State {
  loading: boolean;
  error: string | null;
  game: GameView | null;
  dict: Set<string> | null;
  ghosts: Ghost[];
  found: FoundWord[];
  draft: string;
  message: { text: string; kind: "ok" | "err" } | null;
  elapsed: number;
  running: boolean;
  locked: boolean;
  revealed: boolean;
  played: boolean;
  bestScore: number;
  submitting: boolean;
  result: SubmitResult | null;
}

const EMPTY: State = {
  loading: true,
  error: null,
  game: null,
  dict: null,
  ghosts: [],
  found: [],
  draft: "",
  message: null,
  elapsed: 0,
  running: false,
  locked: false,
  revealed: false,
  played: false,
  bestScore: 0,
  submitting: false,
  result: null,
};

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

  componentDidMount(): void {
    this.load(this.props.date);
  }

  componentWillReceiveProps(next: Props): void {
    if (next.date !== this.props.date) this.load(next.date);
  }

  componentWillUnmount(): void {
    this.alive = false;
    if (this.timer) clearInterval(this.timer);
  }

  private startTimer(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.setState((prev) => ({ elapsed: prev.elapsed + 200 }));
    }, 200);
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private async load(date?: string): Promise<void> {
    this.alive = true;
    this.stopTimer();
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

      const found: FoundWord[] = me?.played
        ? me.timeline.map((entry) => ({
            word: entry.word,
            points: pointsForLength(entry.word.length, game.k),
          }))
        : [];

      this.t0 = Date.now();
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
        running: !locked,
      });
      if (!locked) this.startTimer();
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
    this.setState((prev) => ({ draft: prev.draft + letter, message: null }));
  };

  private clear = (): void => {
    this.setState({ draft: "", message: null });
  };

  private tryWord = (): void => {
    const { draft, game, dict, found, locked } = this.state;
    if (!game || !dict || locked) return;
    const word = draft.trim().toLowerCase();
    if (!word) return;

    if (word.length < MIN_WORD_LENGTH) {
      this.setState({ message: { text: `Too short — ${MIN_WORD_LENGTH}+ letters.`, kind: "err" } });
      return;
    }
    if (found.some((entry) => entry.word === word)) {
      this.setState({ message: { text: "Already found that one.", kind: "err" } });
      return;
    }
    const allowed = toLetterSet(game.letters);
    if (!isBuildable(word, allowed)) {
      this.setState({ message: { text: "Uses letters that aren't allowed.", kind: "err" } });
      return;
    }
    if (!dict.has(word)) {
      this.setState({ message: { text: "Not in the dictionary.", kind: "err" } });
      return;
    }

    const points = pointsForLength(word.length, game.k);
    const t = Date.now() - this.t0;
    this.setState((prev) => ({
      found: [...prev.found, { word, points }],
      draft: "",
      message: { text: `${word.toUpperCase()}  +${points}`, kind: "ok" },
      // keep it simple: store t on the entry via parallel array
    }));
    // Attach the timestamp separately (FoundWord is display-only).
    this.timestamps.set(word, t);
  };

  /** word → timestamp, used when building the submit payload. */
  private timestamps = new Map<string, number>();

  private submit = async (): Promise<void> => {
    const { game, found, submitting, locked } = this.state;
    const { api, store } = this.context as AppContextValue;
    if (!game || submitting || locked) return;

    if (!store.session) {
      route("/signin");
      return;
    }

    this.setState({ submitting: true, message: null });
    this.stopTimer();
    const words = found.map((entry) => ({ word: entry.word, t: this.timestamps.get(entry.word) ?? 0 }));

    try {
      const result = await api.submit(game.id, words);
      if (!this.alive) return;
      this.setState({
        submitting: false,
        result,
        played: true,
        locked: result.locked,
        running: false,
        bestScore: Math.max(result.bestScore, this.state.bestScore),
        found: result.accepted.map((word) => ({
          word,
          points: pointsForLength(word.length, game.k),
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
        running: true,
        message: { text: "Could not submit. Try again.", kind: "err" },
      });
      this.startTimer();
    }
  };

  private newAttempt = (): void => {
    this.timestamps = new Map();
    this.timestamps.clear();
    this.t0 = Date.now();
    this.setState({
      found: [],
      draft: "",
      message: null,
      elapsed: 0,
      result: null,
      played: false,
      running: true,
    });
    this.startTimer();
  };

  private score(): number {
    return this.state.found.reduce((sum, entry) => sum + entry.points, 0);
  }

  render() {
    const { loading, error, game, locked, revealed, played, running, elapsed, draft, message, ghosts, found, submitting, result, bestScore } =
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

    const isToday = game.id === localDateString();
    const score = this.score();

    return (
      <div class="game">
        <section class="panel game__main">
          <header class="game__head">
            <div>
              <h1 class="title">{isToday ? "Today's game" : game.date}</h1>
              <p class="muted">
                {game.letters.length} letters · seeds are {game.shortestSeedLength}–
                {game.longestSeedLength} letters
              </p>
            </div>
            <Timer seconds={Math.floor(elapsed / 1000)} running={running} />
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
            onInput={(value) => this.setState({ draft: value })}
            onSubmit={this.tryWord}
            onClear={this.clear}
            disabled={locked}
          />

          {message && (
            <p class={message.kind === "ok" ? "flash flash--ok" : "flash flash--err"}>{message.text}</p>
          )}

          {!locked && (
            <div class="actions">
              <button
                type="button"
                class="btn btn--primary"
                disabled={submitting || found.length === 0}
                onClick={this.submit}
              >
                {submitting ? "Submitting…" : isToday ? "Submit run" : "Submit best"}
              </button>
              {!isToday && played && (
                <button type="button" class="btn btn--ghost" onClick={this.newAttempt}>
                  New attempt
                </button>
              )}
            </div>
          )}

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

        <aside class="game__side">
          <ScorePanel score={score} foundCount={found.length} />
          <RacePanel ghosts={ghosts} elapsed={elapsed} selfScore={score} />
          <FoundWords words={found} />
        </aside>
      </div>
    );
  }
}
