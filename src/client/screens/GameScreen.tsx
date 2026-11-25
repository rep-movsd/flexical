import { Component } from "preact";
import { route } from "preact-router";
import { AppContext, type AppContextValue } from "../context";
import { ApiRequestError } from "../api";
import type { RackView } from "../../shared/types";
import { Rack } from "../components/Rack";
import { WordEntry } from "../components/WordEntry";
import { FoundWords } from "../components/FoundWords";
import { ScorePanel } from "../components/ScorePanel";
import { Timer } from "../components/Timer";

interface State {
  loading: boolean;
  error: string | null;
  puzzle: RackView | null;
  found: string[];
  score: number;
  draft: string;
  message: { text: string; kind: "ok" | "err" } | null;
  elapsed: number;
  running: boolean;
}

function rejectText(reason: string): string {
  switch (reason) {
    case "duplicate":
      return "Already found that one.";
    case "too_short":
      return "Too short — 4 letters or more.";
    case "not_in_rack":
      return "Not a word you can build from this rack.";
    default:
      return "Not accepted.";
  }
}

/** Main play view. Server-authoritative: words are checked by the Worker. */
export class GameScreen extends Component<{}, State> {
  static contextType = AppContext;

  state: State = {
    loading: true,
    error: null,
    puzzle: null,
    found: [],
    score: 0,
    draft: "",
    message: null,
    elapsed: 0,
    running: false,
  };

  private timer?: ReturnType<typeof setInterval>;
  private alive = true;

  componentDidMount(): void {
    const { api } = this.context as AppContextValue;
    api
      .getTodayPuzzle()
      .then((puzzle) => {
        if (!this.alive) return;
        this.setState({ puzzle, loading: false, running: true });
        this.startTimer();
      })
      .catch((error) => {
        if (!this.alive) return;
        this.setState({
          loading: false,
          error: error instanceof Error ? error.message : "Could not load the puzzle.",
        });
      });
  }

  componentWillUnmount(): void {
    this.alive = false;
    if (this.timer) clearInterval(this.timer);
  }

  private startTimer(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.setState((prev) => ({ elapsed: prev.elapsed + 1 }));
    }, 1000);
  }

  private pick = (letter: string): void => {
    this.setState((prev) => ({ draft: prev.draft + letter, message: null }));
  };

  private clear = (): void => {
    this.setState({ draft: "", message: null });
  };

  private submit = async (): Promise<void> => {
    const { puzzle, draft } = this.state;
    const { api } = this.context as AppContextValue;
    if (!puzzle || !draft) return;

    try {
      const result = await api.submitWords(puzzle.id, [draft]);
      if (!this.alive) return;

      const accepted = result.accepted[0];
      const rejected = result.rejected[0];
      let message: State["message"] = null;
      if (accepted) {
        message = { text: `${accepted.toUpperCase()}  +${result.scoreGain}`, kind: "ok" };
      } else if (rejected) {
        message = { text: rejectText(rejected.reason), kind: "err" };
      }

      this.setState({
        found: result.words,
        score: result.totalScore,
        draft: "",
        message,
      });
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) {
        route("/signin");
        return;
      }
      this.setState({ message: { text: "Network error. Try again.", kind: "err" } });
    }
  };

  render() {
    const { loading, error, puzzle, found, score, draft, message, elapsed, running } = this.state;

    if (loading) {
      return (
        <div class="page">
          <p class="muted">Loading today's rack…</p>
        </div>
      );
    }
    if (error || !puzzle) {
      return (
        <div class="page">
          <p class="error">{error ?? "No puzzle available."}</p>
        </div>
      );
    }

    return (
      <div class="game">
        <section class="panel game__main">
          <header class="game__head">
            <div>
              <h1 class="title">Today's Rack</h1>
              <p class="muted">Build every 4+ letter word you can from these letters.</p>
            </div>
            <Timer seconds={elapsed} running={running} />
          </header>

          <Rack letters={puzzle.letters} onPick={this.pick} />
          <WordEntry
            value={draft}
            onInput={(value) => this.setState({ draft: value })}
            onSubmit={this.submit}
            onClear={this.clear}
          />
          {message && <p class={message.kind === "ok" ? "flash flash--ok" : "flash flash--err"}>{message.text}</p>}
        </section>

        <aside class="game__side">
          <ScorePanel score={score} maxScore={puzzle.maxScore} foundCount={found.length} />
          <FoundWords words={found} />
        </aside>
      </div>
    );
  }
}
