import type { PublicUser } from "../shared/types";

type Listener = () => void;

/**
 * Tiny observable store. The class model means we prefer explicit subscriptions
 * over hooks: `App` subscribes once and re-renders the tree on change.
 */
export class Store {
  session: PublicUser | null = null;

  /** False until the initial /me lookup has resolved. */
  booted = false;

  /** Current route path, kept in sync by <Router onChange>. */
  path = typeof window !== "undefined" ? window.location.pathname : "/";

  /** True on narrow viewports; drives which navigation view renders. */
  isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches;

  private listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  setSession(user: PublicUser | null): void {
    this.session = user;
    this.emit();
  }

  setBooted(value: boolean): void {
    this.booted = value;
    this.emit();
  }

  setMobile(value: boolean): void {
    if (value !== this.isMobile) {
      this.isMobile = value;
      this.emit();
    }
  }

  setPath(path: string): void {
    if (path !== this.path) {
      this.path = path;
      this.emit();
    }
  }
}
