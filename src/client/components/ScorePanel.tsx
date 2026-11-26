import { Component } from "preact";

interface Props {
  score: number;
  foundCount: number;
}

/** Running score for the current attempt. */
export class ScorePanel extends Component<Props> {
  render() {
    return (
      <section class="panel score">
        <div class="score__row">
          <span class="score__value">{this.props.score}</span>
          <span class="score__label">points</span>
        </div>
        <div class="score__row">
          <span class="badge">{this.props.foundCount}</span>
          <span class="muted">words found</span>
        </div>
      </section>
    );
  }
}
