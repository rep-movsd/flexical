import { Component } from "preact";
import { AppContext, type AppContextValue } from "../context";
import type { AllTimeRow, AllTimeSort, Board } from "../../shared/types";

interface State {
  loading: boolean;
  error: string | null;
  rows: AllTimeRow[];
  sort: AllTimeSort;
  board: Board;
}

/** All-time board: totals, games played and average, sortable; Hares or Tortoises. */
export class LeaderboardScreen extends Component<{}, State> {
  static contextType = AppContext;

  state: State = { loading: true, error: null, rows: [], sort: "points", board: "tortoises" };
  private alive = true;

  componentDidMount(): void {
    this.load();
  }

  componentWillUnmount(): void {
    this.alive = false;
  }

  private load(board: Board = this.state.board): void {
    this.alive = true;
    this.setState({ loading: true, error: null, rows: [] });
    const { api } = this.context as AppContextValue;
    api
      .getAllTime("points", board)
      .then((rows) => this.alive && this.setState({ rows, loading: false }))
      .catch(() => this.alive && this.setState({ loading: false, error: "Could not load the board." }));
  }

  private setBoard = (board: Board): void => {
    if (board === this.state.board) return;
    this.setState({ board });
    this.load(board);
  };

  private setSort = (sort: AllTimeSort): void => this.setState({ sort });

  private sorted(): AllTimeRow[] {
    const { rows, sort } = this.state;
    const copy = [...rows];
    copy.sort((a, b) =>
      sort === "games" ? b.games - a.games : sort === "avg" ? b.avg - a.avg : b.total - a.total,
    );
    return copy.map((row, index) => ({ ...row, rank: index + 1 }));
  }

  private header(label: string, key: AllTimeSort) {
    const active = this.state.sort === key;
    return (
      <th class="board__num">
        <button
          type="button"
          class={active ? "sortbtn sortbtn--active" : "sortbtn"}
          onClick={() => this.setSort(key)}
        >
          {label}
          {active ? " ↓" : ""}
        </button>
      </th>
    );
  }

  render() {
    const { loading, error, rows, board } = this.state;
    const sorted = this.sorted();

    return (
      <div class="page page--narrow">
        <h1 class="title">Leaderboard</h1>
        <p class="muted">
          {board === "hares"
            ? "Sum of every player's timed (hare) score across the games they attempted."
            : "Total points across every game, with games played and average."}
        </p>

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
        {!loading && rows.length === 0 && <p class="muted">No scores yet.</p>}

        {sorted.length > 0 && (
          <div class="scroll">
            <table class="board">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Player</th>
                  {this.header(board === "hares" ? "Hare" : "Points", "points")}
                  {this.header("Games", "games")}
                  {this.header("Avg", "avg")}
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => (
                  <tr key={row.username}>
                    <td>{row.rank}</td>
                    <td>
                      <a href={`/opponents?u=${encodeURIComponent(row.username)}`}>{row.username}</a>
                    </td>
                    <td class="board__num">{row.total}</td>
                    <td class="board__num">{row.games}</td>
                    <td class="board__num">{row.avg}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }
}
