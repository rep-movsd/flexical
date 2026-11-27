import { Component } from "preact";
import { Route, Router } from "preact-router";
import { Api } from "./api";
import { Store } from "./store";
import { AppContext } from "./context";
import { Shell } from "./components/Shell";
import { GameScreen } from "./screens/GameScreen";
import { ArchiveScreen } from "./screens/ArchiveScreen";
import { LeaderboardScreen } from "./screens/LeaderboardScreen";
import { AllTimeScreen } from "./screens/AllTimeScreen";
import { AuthScreen } from "./screens/AuthScreen";
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

  componentDidMount(): void {
    this.unsubscribe = this.store.subscribe(() => this.setState({}));

    this.api
      .getSession()
      .then((user) => this.store.setSession(user))
      .catch(() => this.store.setSession(null))
      .finally(() => this.store.setBooted(true));
  }

  componentWillUnmount(): void {
    this.unsubscribe?.();
  }

  render() {
    if (!this.store.booted) {
      return <div class="splash">Flexical</div>;
    }

    return (
      <AppContext.Provider value={{ api: this.api, store: this.store }}>
        <Shell>
          <Router onChange={(e: { url: string }) => this.store.setPath(e.url)}>
            <Route path="/" component={GameScreen} />
            <Route path="/play/:date" component={GameScreen} />
            <Route path="/archive" component={ArchiveScreen} />
            <Route path="/board/:date" component={LeaderboardScreen} />
            <Route path="/alltime" component={AllTimeScreen} />
            <Route path="/signin" component={AuthScreen} />
            <Route path="/profile" component={ProfileScreen} />
            <Route default component={NotFound} />
          </Router>
        </Shell>
      </AppContext.Provider>
    );
  }
}
