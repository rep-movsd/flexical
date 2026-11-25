import { Component, type ComponentChildren } from "preact";
import { AppContext, type AppContextValue } from "../context";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const ITEMS: NavItem[] = [
  { href: "/", label: "Play", icon: "▦" },
  { href: "/leaderboard", label: "Leaders", icon: "★" },
  { href: "/profile", label: "Profile", icon: "☺" },
];

/**
 * App frame. Renders a different navigation view for mobile (bottom tab bar)
 * and desktop (top bar), switching on store.isMobile.
 */
export class Shell extends Component<{ children?: ComponentChildren }> {
  static contextType = AppContext;

  render() {
    const ctx = this.context as AppContextValue | null;
    const isMobile = ctx?.store.isMobile ?? false;
    const path = ctx?.store.path ?? "/";
    const session = ctx?.store.session ?? null;

    return (
      <div class={isMobile ? "shell shell--mobile" : "shell shell--desktop"}>
        {isMobile ? (
          <MobileNav path={path} />
        ) : (
          <DesktopNav path={path} username={session?.username ?? null} />
        )}
        <main class="content">{this.props.children}</main>
      </div>
    );
  }
}

function isActive(path: string, href: string): boolean {
  return href === "/" ? path === "/" : path.startsWith(href);
}

class DesktopNav extends Component<{ path: string; username: string | null }> {
  render() {
    const { path, username } = this.props;
    return (
      <header class="topbar">
        <a href="/" class="brand">
          Wordtwist
        </a>
        <nav class="topbar__links">
          {ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              class={isActive(path, item.href) ? "navlink navlink--active" : "navlink"}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <a href={username ? "/profile" : "/signin"} class="topbar__account">
          {username ?? "Sign in"}
        </a>
      </header>
    );
  }
}

class MobileNav extends Component<{ path: string }> {
  render() {
    return (
      <nav class="tabbar">
        {ITEMS.map((item) => (
          <a
            key={item.href}
            href={item.href}
            class={isActive(this.props.path, item.href) ? "tab tab--active" : "tab"}
          >
            <span class="tab__icon" aria-hidden="true">
              {item.icon}
            </span>
            <span class="tab__label">{item.label}</span>
          </a>
        ))}
      </nav>
    );
  }
}
