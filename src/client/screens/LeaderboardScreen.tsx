import { Component, Fragment } from "preact";
import { AppContext, type AppContextValue } from "../context";
import { ApiRequestError } from "../api";
import type { GameView, LeaderboardRow } from "../../shared/types";
import { BadgeIcons } from "../components/BadgeIcons";

interface Props {
  date?: string;
}

interface State {
  loading: boolean;
  error: string | null;
  game: GameView | null;
  rows: LeaderboardRow[];
  /** username currently being revealed (confirm prompt). */
  confirming: string | null;
  /** revealed words, keyed by username. */
  revealed: Record<string, string[]>;
  /** Set once we've locked the game by revealing. */
  locked: boolean;
  notice: string | null;
}

/** Per-game leaderboard. Revealing a player's words locks the game for you. */
export class LeaderboardScreen extends Component<Props, State> {
  static contextType = AppContext;

  state: State = {
    loading: true,
    error: null,
    game: null,
    rows: [],
    confirming: null,
    revealed: {},
    locked: false,
    notice: null,
  };
  private alive = true;

  componentDidMount(): void {
    if (!this.props.date) {
      this.setState({ loading: false, error: "No game specified." });
      return;
    }
    const { api } = this.context as AppContextValue;
    api
      .getGameLeaderboard(this.props.date)
      .then((response) => {
        if (!this.alive) return;
        this.setState({ game: response.game, rows: response.rows, loading: false });
      })
      .catch(() => this.alive && this.setState({ loading: false, error: "Could not load the board." }));
  }

  componentWillUnmount(): void {
    this.alive = false;
  }

  private async reveal(username: string): Promise<void> {
    const { api, store } = this.context as AppContextValue;
    if (!this.props.date || !store.session) return;
    this.setState({ confirming: null, notice: null });
    try {
      const result = await api.reveal(this.props.date, username);
      if (!this.alive) return;
      this.setState((prev) => ({
        revealed: { ...prev.revealed, [username]: result.words },
        locked: prev.locked || result.locked,
        notice: result.locked ? "Revealed — this game is now locked for you." : null,
      }));
    } catch (error) {
      const message = error instanceof ApiRequestError ? error.message : "Could not reveal.";
      this.setState({ notice: message });
    }
  }

  render() {
    const { loading, error, game, rows, confirming, revealed, locked, notice } = this.state;
    const signedIn = (this.context as AppContextValue).store.session !== null;

    return (
      <div class="page page--narrow">
        <h1 class="title">{game ? `${game.date} board` : "Board"}</h1>
        {notice && <p class={locked ? "notice" : "flash flash--err"}>{notice}</p>}
        {loading && <p class="muted">Loading…</p>}
        {error && <p class="error">{error}</p>}
        {!loading && rows.length === 0 && <p class="muted">No scores yet.</p>}

        {rows.length > 0 && (
          <table class="board">
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th class="board__num">Score</th>
                <th class="board__num">Words</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const words = revealed[row.username];
                return (
                  <Fragment key={row.username}>
                    <tr>
                      <td>{row.rank}</td>
                      <td>
                        {row.username} <BadgeIcons badges={row.badges} />
                      </td>
                      <td class="board__num">{row.score}</td>
                      <td class="board__num">{row.wordsFound}</td>
                      <td class="board__num">
                        {!words && signedIn && (
                          <button
                            type="button"
                            class="btn btn--tiny"
                            onClick={() => this.setState({ confirming: row.username })}
                          >
                            words
                          </button>
                        )}
                      </td>
                    </tr>
                    {confirming === row.username && (
                      <tr>
                        <td colSpan={5} class="confirm">
                          Reveal {row.username}'s words? This <strong>locks</strong> this game for you.
                          <button type="button" class="btn btn--tiny btn--danger" onClick={() => this.reveal(row.username)}>
                            Reveal
                          </button>
                          <button type="button" class="btn btn--tiny" onClick={() => this.setState({ confirming: null })}>
                            Cancel
                          </button>
                        </td>
                      </tr>
                    )}
                    {words && (
                      <tr>
                        <td colSpan={5} class="revealed">
                          {words.length === 0 ? <span class="muted">No words.</span> : words.join(" · ")}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    );
  }
}
