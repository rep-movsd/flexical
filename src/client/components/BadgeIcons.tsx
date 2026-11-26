import { Component } from "preact";
import type { Badges } from "../../shared/types";

/** Sun / moon / star badge icons. Signals achievement without revealing words. */
export class BadgeIcons extends Component<{ badges: Badges; showEmpty?: boolean }> {
  render() {
    const { badges, showEmpty } = this.props;
    const any = badges.sun || badges.moon || badges.star;
    if (!any && !showEmpty) return null;
    return (
      <span class="badges" aria-label="badges">
        {badges.sun && (
          <span class="badge-icon badge-icon--sun" title="Found the sun seed">
            ☀
          </span>
        )}
        {badges.moon && (
          <span class="badge-icon badge-icon--moon" title="Found the moon seed">
            🌙
          </span>
        )}
        {badges.star && (
          <span class="badge-icon badge-icon--star" title="Found a long non-seed word">
            ★
          </span>
        )}
      </span>
    );
  }
}
