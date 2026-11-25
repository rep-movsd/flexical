import { Component } from "preact";
import { route } from "preact-router";
import { AppContext, type AppContextValue } from "../context";

/** Account summary and sign-out. */
export class ProfileScreen extends Component {
  static contextType = AppContext;

  private logout = async (): Promise<void> => {
    const { api, store } = this.context as AppContextValue;
    await api.logout().catch(() => undefined);
    store.setSession(null);
    route("/");
  };

  render() {
    const { store } = this.context as AppContextValue;
    const user = store.session;

    return (
      <div class="page page--narrow">
        <h1 class="title">Profile</h1>
        {!user ? (
          <section class="panel">
            <p class="muted">You're playing as a guest. Sign in to save stats and join the board.</p>
            <a class="btn btn--primary btn--block" href="/signin">
              Sign in
            </a>
          </section>
        ) : (
          <section class="panel profile">
            <div class="profile__row">
              <span class="profile__avatar" aria-hidden="true">
                {user.username.slice(0, 1).toUpperCase()}
              </span>
              <div>
                <div class="profile__name">{user.username}</div>
                <div class="muted">Joined {new Date(user.createdAt).toLocaleDateString()}</div>
              </div>
            </div>
            <button type="button" class="btn btn--ghost btn--block" onClick={this.logout}>
              Sign out
            </button>
            <p class="muted">Stats and leagues will appear here once the game logic is wired up.</p>
          </section>
        )}
      </div>
    );
  }
}
