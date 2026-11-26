import { Component } from "preact";
import type { Badges, Ghost } from "../../shared/types";
import { progressAt } from "../../shared/engine/timeline";
import { BadgeIcons } from "./BadgeIcons";

interface Props {
  ghosts: Ghost[];
  /** Elapsed milliseconds since the attempt started. */
  elapsed: number;
  selfScore: number;
  /** The player's own badges, updated live as they find words. */
  selfBadges: Badges;
}

function width(value: number, max: number): string {
  return `${Math.min(100, Math.round((value / Math.max(max, 1)) * 100))}%`;
}

/** Badges a ghost has earned by time `t` (marks accumulate with the timeline). */
function earnedBy(ghost: Ghost, t: number): Badges {
  const earned: Badges = { sun: false, moon: false, star: false };
  for (const entry of ghost.timeline) {
    if (entry.t > t) break;
    for (const mark of entry.marks ?? []) earned[mark] = true;
  }
  return earned;
}

/**
 * Race mode: the top 5 runs for this game replay alongside you. Ghosts show
 * score and count over time — never the words — but their badges light up on
 * the bar as they earn them.
 */
export class RacePanel extends Component<Props> {
  render() {
    const { ghosts, elapsed, selfScore, selfBadges } = this.props;

    if (ghosts.length === 0) {
      return (
        <section class="panel race">
          <h2 class="panel__title">Race</h2>
          <p class="muted">No ghosts yet — set the pace.</p>
        </section>
      );
    }

    const ceiling = Math.max(selfScore, ...ghosts.map((g) => g.score), 1);

    return (
      <section class="panel race">
        <h2 class="panel__title">
          Race <span class="muted">top {ghosts.length}</span>
        </h2>
        <ol class="lanes">
          <li class="lane lane--self">
            <div class="lane__head">
              <span class="lane__name">You</span>
              <span class="lane__score">{selfScore}</span>
            </div>
            <div class="lane__track">
              <div class="lane__bar">
                <div class="lane__fill lane__fill--self" style={{ width: width(selfScore, ceiling) }} />
              </div>
              <BadgeIcons badges={selfBadges} showEmpty />
            </div>
          </li>
          {ghosts.map((ghost) => {
            const progress = progressAt(ghost.timeline, elapsed);
            return (
              <li class="lane" key={ghost.username}>
                <div class="lane__head">
                  <span class="lane__name">{ghost.username}</span>
                  <span class="lane__score">
                    {progress.score} <span class="muted">· {progress.count}</span>
                  </span>
                </div>
                <div class="lane__track">
                  <div class="lane__bar">
                    <div class="lane__fill" style={{ width: width(progress.score, ceiling) }} />
                  </div>
                  <BadgeIcons badges={earnedBy(ghost, elapsed)} showEmpty />
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    );
  }
}
