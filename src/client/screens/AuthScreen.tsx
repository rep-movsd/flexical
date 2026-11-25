import { Component } from "preact";
import { route } from "preact-router";
import { AppContext, type AppContextValue } from "../context";
import { ApiRequestError } from "../api";

interface State {
  mode: "login" | "register";
  username: string;
  password: string;
  busy: boolean;
  error: string | null;
}

/** Combined sign-in / register screen with a mode toggle. */
export class AuthScreen extends Component<{}, State> {
  static contextType = AppContext;

  state: State = { mode: "login", username: "", password: "", busy: false, error: null };

  private submit = async (event: Event): Promise<void> => {
    event.preventDefault();
    if (this.state.busy) return;
    this.setState({ busy: true, error: null });

    const { api, store } = this.context as AppContextValue;
    const { mode, username, password } = this.state;
    try {
      const user =
        mode === "register"
          ? await api.register(username, password)
          : await api.login(username, password);
      store.setSession(user);
      route("/");
    } catch (error) {
      const message =
        error instanceof ApiRequestError ? error.message : "Something went wrong.";
      this.setState({ busy: false, error: message });
    }
  };

  render() {
    const { mode, username, password, busy, error } = this.state;
    const isRegister = mode === "register";

    return (
      <div class="page page--narrow">
        <section class="panel auth">
          <h1 class="title">{isRegister ? "Create an account" : "Welcome back"}</h1>
          <p class="muted">
            Accounts keep your stats and put you on the leaderboard. You can play without one.
          </p>

          <div class="tabs">
            <button
              type="button"
              class={!isRegister ? "tabs__tab tabs__tab--active" : "tabs__tab"}
              onClick={() => this.setState({ mode: "login", error: null })}
            >
              Sign in
            </button>
            <button
              type="button"
              class={isRegister ? "tabs__tab tabs__tab--active" : "tabs__tab"}
              onClick={() => this.setState({ mode: "register", error: null })}
            >
              Register
            </button>
          </div>

          <form class="form" onSubmit={this.submit}>
            <label class="field">
              <span class="field__label">Username</span>
              <input
                class="field__input"
                value={username}
                autoComplete="username"
                autoCapitalize="off"
                autoCorrect="off"
                spellcheck={false}
                onInput={(event) =>
                  this.setState({ username: (event.target as HTMLInputElement).value })
                }
              />
            </label>
            <label class="field">
              <span class="field__label">Password</span>
              <input
                class="field__input"
                type="password"
                value={password}
                autoComplete={isRegister ? "new-password" : "current-password"}
                onInput={(event) =>
                  this.setState({ password: (event.target as HTMLInputElement).value })
                }
              />
            </label>

            {error && <p class="error">{error}</p>}

            <button type="submit" class="btn btn--primary btn--block" disabled={busy}>
              {busy ? "Working…" : isRegister ? "Create account" : "Sign in"}
            </button>
          </form>
        </section>
      </div>
    );
  }
}
