import { Component } from "preact";
import { AppContext, type AppContextValue } from "../context";
import type { OpponentResponse } from "../../shared/types";
import { BadgeIcons } from "../components/BadgeIcons";

interface State {
  usernames: string[];
  query: string;
  loading: boolean;
  error: string | null;
  data: OpponentResponse | null;
}

/** Look up a player and list every daily score they've recorded. */
export class OpponentsScreen extends Component<{}, State> {
  static contextType = AppContext;

  state: State = { usernames: [], query: "", loading: false, error: null, data: null };
  private alive = true;

  componentDidMount(): void {
    const { api } = this.context as AppContextValue;
    api
      .listUsernames()
      .then((usernames) => this.alive && this.setState({ usernames }))
      .catch(() => undefined);

    const initial = new URLSearchParams(window.location.search).get("u");
    if (initial) {
      this.setState({ query: initial });
      this.load(initial);
    }
  }

  componentWillUnmount(): void {
    this.alive = false;
  }

  private load(username: string): void {
    const name = username.trim();
    if (!name) return;
    this.setState({ loading: true, error: null, data: null });
    const { api } = this.context as AppContextValue;
    api
      .getOpponentScores(name)
      .then((data) => this.alive && this.setState({ data, loading: false }))
      .catch(() => this.alive && this.setState({ loading: false, error: "No scores found for that player." }));
  }

  private submit = (event: Event): void => {
    event.preventDefault();
    this.load(this.state.query);
  };

  render() {
    const { usernames, query, loading, error, data } = this.state;

    return (
      <div class="page page--narrow">
        <h1 class="title">Opponents</h1>
        <p class="muted">Look up a player and see every daily score they've recorded.</p>

        <form class="opponent__form" onSubmit={this.submit}>
          <input
            class="field__input"
            list="opponent-names"
            placeholder="Username"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellcheck={false}
            value={query}
            onInput={(event) => this.setState({ query: (event.target as HTMLInputElement).value })}
          />
          <datalist id="opponent-names">
            {usernames.map((name) => (
              <option value={name} key={name} />
            ))}
          </datalist>
          <button type="submit" class="btn btn--primary">
            Show scores
          </button>
        </form>

        {loading && <p class="muted">Loading…</p>}
        {error && <p class="error">{error}</p>}

        {data && (
          <>
            <p class="opponent__summary">
              <strong>{data.username}</strong>
              <span class="muted">
                {" "}
                · {data.total} points · {data.games} {data.games === 1 ? "game" : "games"}
              </span>
            </p>
            {data.rows.length === 0 ? (
              <p class="muted">No games played yet.</p>
            ) : (
              <div class="opponent__list">
                <table class="board">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th class="board__num">Points</th>
                      <th class="board__num">Words</th>
                      <th>Badges</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((row) => (
                      <tr key={row.date}>
                        <td>
                          <a href={`/archive/${row.date}`}>{row.date}</a>
                        </td>
                        <td class="board__num">{row.score}</td>
                        <td class="board__num">{row.wordsFound}</td>
                        <td>
                          <BadgeIcons badges={row.badges} showEmpty />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    );
  }
}
