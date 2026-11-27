import { Component, type ComponentChildren } from "preact";
import { AppContext, type AppContextValue } from "../context";
import { Icon, type IconName } from "./icons";

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
}

const ITEMS: NavItem[] = [
  { href: "/", label: "Play", icon: "play" },
  { href: "/archive", label: "Archive", icon: "archive" },
  { href: "/leaderboard", label: "Leaderboard", icon: "leaderboard" },
  { href: "/opponents", label: "Opponents", icon: "opponents" },
];

/**
 * App frame. A single sticky top bar for every viewport: the brand on the left,
 * the nav items and account control as icons on the right.
 */
export class Shell extends Component<{ children?: ComponentChildren }> {
  static contextType = AppContext;

  render() {
    const ctx = this.context as AppContextValue | null;
    const path = ctx?.store.path ?? "/";
    const session = ctx?.store.session ?? null;
    // The game board uses the full screen width; other pages stay narrow.
    const wide = path === "/" || path.startsWith("/play");
    const accountLabel = session?.username ?? "Sign in";

    return (
      <div class={wide ? "shell shell--game" : "shell"}>
        <header class="topbar">
          <a href="/" class="brand">
            Flexical
          </a>
          <nav class="topbar__links" aria-label="Main">
            {ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                class={isActive(path, item.href) ? "navicon navicon--active" : "navicon"}
                title={item.label}
                aria-label={item.label}
              >
                <Icon name={item.icon} />
              </a>
            ))}
            <a
              href={session ? "/profile" : "/signin"}
              class="navicon navicon--account"
              title={accountLabel}
              aria-label={accountLabel}
            >
              <Icon name="account" />
            </a>
          </nav>
        </header>
        <main class={wide ? "content content--wide" : "content"}>{this.props.children}</main>
      </div>
    );
  }
}

function isActive(path: string, href: string): boolean {
  return href === "/" ? path === "/" : path.startsWith(href);
}
