import { Component } from "preact";
import { AppContext, type AppContextValue } from "../context";
import type { AllTimeRow } from "../../shared/types";

interface State {
  loading: boolean;
  error: string | null;
  rows: AllTimeRow[];
}

/** All-time marathon board: sum of each player's best score per game. */
export class AllTimeScreen extends Component<{}, State> {
  static contextType = AppContext;

  state: State = { loading: true, error: null, rows: [] };
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

  render() {
    const { loading, error, rows } = this.state;
    return (
      <div class="page page--narrow">
        <h1 class="title">Marathon</h1>
        <p class="muted">Sum of every player's best score on each game they've played.</p>
        {loading && <p class="muted">Loading…</p>}
        {error && <p class="error">{error}</p>}
        {!loading && rows.length === 0 && <p class="muted">No scores yet.</p>}
        {rows.length > 0 && (
          <table class="board">
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th class="board__num">Total</th>
                <th class="board__num">Games</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.username}>
                  <td>{row.rank}</td>
                  <td>{row.username}</td>
                  <td class="board__num">{row.total}</td>
                  <td class="board__num">{row.games}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }
}
