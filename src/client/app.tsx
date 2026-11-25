import { Component } from "preact";
import { Route, Router } from "preact-router";
import { Api } from "./api";
import { Store } from "./store";
import { AppContext } from "./context";
import { Shell } from "./components/Shell";
import { GameScreen } from "./screens/GameScreen";
import { AuthScreen } from "./screens/AuthScreen";
import { LeaderboardScreen } from "./screens/LeaderboardScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { NotFound } from "./screens/NotFound";

/**
 * Root component. Owns the Api client and the Store, resolves the initial
 * session, and re-renders the tree whenever the store changes.
 */
export class App extends Component {
  private readonly api = new Api();
  private readonly store = new Store();

  private unsubscribe?: () => void;
  private mediaQuery?: MediaQueryList;
  private onMediaChange = (event: MediaQueryListEvent): void => {
    this.store.setMobile(event.matches);
  };

  componentDidMount(): void {
    this.unsubscribe = this.store.subscribe(() => this.setState({}));

    this.mediaQuery = window.matchMedia("(max-width: 640px)");
    this.mediaQuery.addEventListener("change", this.onMediaChange);

    this.api
      .getSession()
      .then((user) => this.store.setSession(user))
      .catch(() => this.store.setSession(null))
      .finally(() => this.store.setBooted(true));
  }

  componentWillUnmount(): void {
    this.unsubscribe?.();
    this.mediaQuery?.removeEventListener("change", this.onMediaChange);
  }

  render() {
    if (!this.store.booted) {
      return <div class="splash">Wordtwist</div>;
    }

    return (
      <AppContext.Provider value={{ api: this.api, store: this.store }}>
        <Shell>
          <Router onChange={(e: { url: string }) => this.store.setPath(e.url)}>
            <Route path="/" component={GameScreen} />
            <Route path="/leaderboard" component={LeaderboardScreen} />
            <Route path="/profile" component={ProfileScreen} />
            <Route path="/signin" component={AuthScreen} />
            <Route default component={NotFound} />
          </Router>
        </Shell>
      </AppContext.Provider>
    );
  }
}
