import { Component } from "preact";

interface Props {
  score: number;
  maxScore: number;
  foundCount: number;
}

/** Running score plus progress toward the rack's maximum. */
export class ScorePanel extends Component<Props> {
  render() {
    const { score, maxScore, foundCount } = this.props;
    const percent = maxScore > 0 ? Math.min(100, Math.round((score / maxScore) * 100)) : 0;
    return (
      <section class="panel score">
        <div class="score__row">
          <span class="score__value">{score}</span>
          <span class="score__label">points</span>
        </div>
        <progress class="score__bar" max={100} value={percent} />
        <div class="score__row">
          <span class="badge">{foundCount}</span>
          <span class="muted">words found</span>
        </div>
      </section>
    );
  }
}
