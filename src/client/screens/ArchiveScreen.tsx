import { Component } from "preact";
import { AppContext, type AppContextValue } from "../context";
import type { ArchiveGame } from "../../shared/types";

interface State {
  loading: boolean;
  error: string | null;
  games: ArchiveGame[];
}

/** Past games. Tap one to play it; the best score is kept. */
export class ArchiveScreen extends Component<{}, State> {
  static contextType = AppContext;

  state: State = { loading: true, error: null, games: [] };
  private alive = true;

  componentDidMount(): void {
    const { api } = this.context as AppContextValue;
    api
      .listGames()
      .then((games) => this.alive && this.setState({ games, loading: false }))
      .catch(() => this.alive && this.setState({ loading: false, error: "Could not load the archive." }));
  }

  componentWillUnmount(): void {
    this.alive = false;
  }

  render() {
    const { loading, error, games } = this.state;
    return (
      <div class="page page--narrow">
        <h1 class="title">Archive</h1>
        <p class="muted">Every past game is still playable. Grind them to climb the marathon board.</p>
        {loading && <p class="muted">Loading…</p>}
        {error && <p class="error">{error}</p>}
        {!loading && games.length === 0 && <p class="muted">No games yet.</p>}
        <ul class="archive">
          {games.map((game) => (
            <li class="archive__row" key={game.id}>
              <a class="archive__main" href={`/play/${game.id}`}>
                <span class="archive__date">
                  {game.date}
                  {game.isToday && <span class="tag tag--today">today</span>}
                  {game.revealed && <span class="tag tag--locked">locked</span>}
                </span>
                <span class="archive__score">
                  {game.locked && !game.revealed ? "played" : game.bestScore > 0 ? `${game.bestScore}` : "—"}
                </span>
              </a>
              <a class="archive__board" href={`/board/${game.id}`} aria-label={`Leaderboard for ${game.date}`}>
                board
              </a>
            </li>
          ))}
        </ul>
      </div>
    );
  }
}
