import { Component } from "preact";
import { route } from "preact-router";
import { AppContext, type AppContextValue } from "../context";
import { gameDateString } from "../time";
import type { Board, LeaderboardRow } from "../../shared/types";
import { BadgeIcon } from "../components/BadgeIcons";
import { Modal } from "../components/Modal";

/** Earliest game date the archive exposes (mirrors the server's MIN_GAME_DATE). */
const MIN_DATE = "2026-01-01";

interface Props {
  date?: string;
}

interface Peeked {
  username: string;
  score: number;
  words: string[];
  locked: boolean;
}

interface State {
  loading: boolean;
  error: string | null;
  board: Board;
  top: LeaderboardRow[];
  me: LeaderboardRow | null;
  /** username awaiting peek confirmation. */
  confirming: string | null;
  /** the revealed run, if any. */
  peeked: Peeked | null;
  peeking: boolean;
}

/** A game's board: pick a date, see the top 10 (+ yourself), and peek at words. */
export class ArchiveScreen extends Component<Props, State> {
  static contextType = AppContext;

  state: State = {
    loading: true,
    error: null,
    board: "tortoises",
    top: [],
    me: null,
    confirming: null,
    peeked: null,
    peeking: false,
  };
  private alive = true;

  componentDidMount(): void {
    this.load();
  }

  componentWillReceiveProps(next: Props): void {
    if (next.date !== this.props.date) this.load();
  }

  componentWillUnmount(): void {
    this.alive = false;
  }

  private date(): string {
    return this.props.date ?? gameDateString();
  }

  private setBoard = (board: Board): void => {
    if (board === this.state.board) return;
    this.setState({ board });
    this.load(board);
  };

  private load(board: Board = this.state.board): void {
    this.alive = true;
    this.setState({ loading: true, error: null, top: [], me: null, peeked: null });
    const { api } = this.context as AppContextValue;
    api
      .getGameLeaderboard(this.date(), board)
      .then((response) => {
        if (!this.alive) return;
        this.setState({ top: response.top, me: response.me, loading: false });
      })
      .catch(() => this.alive && this.setState({ loading: false, error: "Could not load the board." }));
  }

  private pickDate = (event: Event): void => {
    const value = (event.target as HTMLInputElement).value;
    if (value) route(`/archive/${value}`);
  };

  private peek = async (username: string): Promise<void> => {
    this.setState({ peeking: true, confirming: null });
    const { api } = this.context as AppContextValue;
    try {
      const result = await api.peek(this.date(), username);
      if (!this.alive) return;
      this.setState({
        peeking: false,
        peeked: {
          username: result.username,
          score: result.score,
          words: result.words,
          locked: result.locked,
        },
      });
    } catch {
      this.setState({ peeking: false, error: "Could not peek at those words." });
    }
  };

  private row(row: LeaderboardRow, mine: boolean) {
    return (
      <tr class={mine ? "board__me" : undefined} key={`${row.username}-${mine ? "me" : "top"}`}>
        <td>{row.rank}</td>
        <td>{row.username}</td>
        <td class="board__num">{row.score}</td>
        <td class="board__badge">
          <span class={row.badges.sun ? "badge-cell" : "badge-cell badge-cell--off"}>
            <BadgeIcon kind="sun" />
          </span>
        </td>
        <td class="board__num">
          <button
            type="button"
            class="btn btn--tiny"
            onClick={() => this.setState({ confirming: row.username })}
          >
            peek
          </button>
        </td>
      </tr>
    );
  }

  render() {
    const { loading, error, top, me, confirming, peeked, peeking, board } = this.state;
    const date = this.date();
    const today = gameDateString();
    const isToday = date === today;

    return (
      <div class="page page--narrow">
        <h1 class="title">Archive</h1>

        <div class="archive__bar">
          <span class="archive__date">{isToday ? "Today" : date}</span>
          <input
            type="date"
            class="datepicker"
            min={MIN_DATE}
            max={today}
            value={date}
            aria-label="Pick a date"
            onChange={this.pickDate}
          />
          <a class="btn btn--primary archive__play" href={`/play/${date}`}>
            Play
          </a>
        </div>

        <div class="tabs">
          <button
            type="button"
            class={board === "hares" ? "tabs__tab tabs__tab--active" : "tabs__tab"}
            onClick={() => this.setBoard("hares")}
          >
            Hares
          </button>
          <button
            type="button"
            class={board === "tortoises" ? "tabs__tab tabs__tab--active" : "tabs__tab"}
            onClick={() => this.setBoard("tortoises")}
          >
            Tortoises
          </button>
        </div>

        {loading && <p class="muted">Loading…</p>}
        {error && <p class="error">{error}</p>}
        {!loading && top.length === 0 && !me && (
          <p class="muted">
            {board === "hares" ? "No timed scores for this day yet." : "No scores for this day yet."}
          </p>
        )}

        {(top.length > 0 || me) && (
          <table class="board">
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th class="board__num">{board === "hares" ? "Hare" : "Total"}</th>
                <th class="board__badge">☀</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {top.map((row) => this.row(row, false))}
              {me && this.row(me, true)}
            </tbody>
          </table>
        )}

        {confirming && (
          <Modal title={`Peek at ${confirming}'s words?`} onClose={() => this.setState({ confirming: null })}>
            <p>
              You'll see every word {confirming} found. Once this is enabled you can
              <strong> never play this game again</strong>.
            </p>
            <div class="modal__actions">
              <button type="button" class="btn btn--ghost" onClick={() => this.setState({ confirming: null })}>
                Cancel
              </button>
              <button type="button" class="btn btn--danger" disabled={peeking} onClick={() => this.peek(confirming)}>
                {peeking ? "Peeking…" : "Peek"}
              </button>
            </div>
          </Modal>
        )}

        {peeked && (
          <Modal title={`${peeked.username} — ${peeked.score} points`} onClose={() => this.setState({ peeked: null })}>
            {peeked.words.length === 0 ? (
              <p class="muted">No words.</p>
            ) : (
              <div class="peek-words">
                {peeked.words.map((word) => (
                  <span class="chip" key={word}>
                    {word}
                  </span>
                ))}
              </div>
            )}
          </Modal>
        )}
      </div>
    );
  }
}
