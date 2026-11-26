import { Component } from "preact";
import type { Ghost } from "../../shared/types";
import { progressAt } from "../../shared/engine/timeline";
import { BadgeIcons } from "./BadgeIcons";

interface Props {
  ghosts: Ghost[];
  /** Elapsed milliseconds since the attempt started. */
  elapsed: number;
  selfScore: number;
}

function width(value: number, max: number): string {
  return `${Math.min(100, Math.round((value / Math.max(max, 1)) * 100))}%`;
}

/**
 * Race mode: the top 5 runs for this game replay alongside you. Ghosts show
 * score and count over time — never the words, so there is no spoiler.
 */
export class RacePanel extends Component<Props> {
  render() {
    const { ghosts, elapsed, selfScore } = this.props;

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
            <div class="lane__bar">
              <div class="lane__fill lane__fill--self" style={{ width: width(selfScore, ceiling) }} />
            </div>
          </li>
          {ghosts.map((ghost) => {
            const progress = progressAt(ghost.timeline, elapsed);
            return (
              <li class="lane" key={ghost.username}>
                <div class="lane__head">
                  <span class="lane__name">
                    {ghost.username} <BadgeIcons badges={ghost.badges} />
                  </span>
                  <span class="lane__score">
                    {progress.score} <span class="muted">· {progress.count}</span>
                  </span>
                </div>
                <div class="lane__bar">
                  <div class="lane__fill" style={{ width: width(progress.score, ceiling) }} />
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    );
  }
}
