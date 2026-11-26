import { Component } from "preact";
import type { BadgeKind, Badges } from "../../shared/types";

const META: Record<BadgeKind, { icon: string; title: string }> = {
  // Use the emoji-presentation forms so all three render at a consistent size
  // in the same emoji font (see .badge-icon in styles.css).
  sun: { icon: "☀️", title: "Found the sun seed" },
  moon: { icon: "🌙", title: "Found the moon seed" },
  star: { icon: "⭐", title: "A long non-seed word" },
};

/** A single badge icon. */
export class BadgeIcon extends Component<{ kind: BadgeKind }> {
  render() {
    const { kind } = this.props;
    return (
      <span class={`badge-icon badge-icon--${kind}`} title={META[kind].title}>
        {META[kind].icon}
      </span>
    );
  }
}

/** A row of badge icons for a run. */
export class BadgeIcons extends Component<{ badges: Badges; showEmpty?: boolean }> {
  render() {
    const { badges, showEmpty } = this.props;
    const kinds = (["sun", "moon", "star"] as BadgeKind[]).filter((kind) => badges[kind]);
    if (kinds.length === 0 && !showEmpty) return null;
    return (
      <span class="badges" aria-label="badges">
        {kinds.map((kind) => (
          <BadgeIcon key={kind} kind={kind} />
        ))}
      </span>
    );
  }
}
