import { Component, type ComponentChildren } from "preact";
import type { Badges } from "../../shared/types";
import { BadgeIcons } from "./BadgeIcons";

interface Props {
  score: number;
  foundCount: number;
  badges: Badges;
  /** Only show the badge row once the run has been recorded. */
  showBadges: boolean;
  /** Action buttons (submit / new attempt) rendered at the bottom. */
  children?: ComponentChildren;
}

/** Points box: running score, words found, badges, and the submit action. */
export class ScorePanel extends Component<Props> {
  render() {
    const { score, foundCount, badges, showBadges } = this.props;
    const any = badges.sun || badges.moon || badges.star;
    return (
      <section class="panel score">
        <div class="score__row">
          <span class="score__value">{score}</span>
          <span class="score__label">points</span>
        </div>
        <div class="score__row">
          <span class="badge">{foundCount}</span>
          <span class="muted">words found</span>
        </div>
        {showBadges && (
          <div class="score__badges">
            <span class="muted">badges</span>
            {any ? <BadgeIcons badges={badges} /> : <span class="muted">none yet</span>}
          </div>
        )}
        {this.props.children}
      </section>
    );
  }
}
