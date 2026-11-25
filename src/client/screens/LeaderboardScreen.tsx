import { Component } from "preact";
import { AppContext, type AppContextValue } from "../context";
import type { LeaderboardRow } from "../../shared/types";

interface State {
  loading: boolean;
  error: string | null;
  rows: LeaderboardRow[];
}

/** Today's leaderboard. Refetches when the screen mounts. */
export class LeaderboardScreen extends Component<{}, State> {
  static contextType = AppContext;

  state: State = { loading: true, error: null, rows: [] };
  private alive = true;

  componentDidMount(): void {
    const { api } = this.context as AppContextValue;
    api
      .getTodayLeaderboard()
      .then((rows) => this.alive && this.setState({ rows, loading: false }))
      .catch(() => this.alive && this.setState({ loading: false, error: "Could not load the leaderboard." }));
  }

  componentWillUnmount(): void {
    this.alive = false;
  }

  render() {
    const { loading, error, rows } = this.state;
    return (
      <div class="page page--narrow">
        <h1 class="title">Today's leaderboard</h1>
        {loading && <p class="muted">Loading…</p>}
        {error && <p class="error">{error}</p>}
        {!loading && !error && rows.length === 0 && (
          <p class="muted">No scores yet today. Be the first.</p>
        )}
        {rows.length > 0 && (
          <table class="board">
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th class="board__num">Score</th>
                <th class="board__num">Words</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.rank}>
                  <td>{row.rank}</td>
                  <td>{row.username}</td>
                  <td class="board__num">{row.score}</td>
                  <td class="board__num">{row.wordsFound}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }
}
