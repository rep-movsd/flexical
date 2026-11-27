import { Component } from "preact";
import { AppContext, type AppContextValue } from "../context";
import type { AllTimeRow, AllTimeSort } from "../../shared/types";

interface State {
  loading: boolean;
  error: string | null;
  rows: AllTimeRow[];
  sort: AllTimeSort;
}

/** All-time board: total points, games played and average, sortable by each. */
export class LeaderboardScreen extends Component<{}, State> {
  static contextType = AppContext;

  state: State = { loading: true, error: null, rows: [], sort: "points" };
  private alive = true;

  componentDidMount(): void {
    const { api } = this.context as AppContextValue;
    api
      .getAllTime()
      .then((rows) => this.alive && this.setState({ rows, loading: false }))
      .catch(() => this.alive && this.setState({ loading: false, error: "Could not load the board." }));
  }

  componentWillUnmount(): void {
    this.alive = false;
  }

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
    const { loading, error, rows } = this.state;
    const sorted = this.sorted();

    return (
      <div class="page page--narrow">
        <h1 class="title">Leaderboard</h1>
        <p class="muted">Total points across every game, with games played and average.</p>
        {loading && <p class="muted">Loading…</p>}
        {error && <p class="error">{error}</p>}
        {!loading && rows.length === 0 && <p class="muted">No scores yet.</p>}

        {sorted.length > 0 && (
          <table class="board">
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                {this.header("Points", "points")}
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
        )}
      </div>
    );
  }
}
