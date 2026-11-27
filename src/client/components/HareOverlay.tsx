import { Component } from "preact";

interface Props {
  /** The hare score to show when the timed attempt ends. */
  hareScore: number;
  onContinue: () => void;
}

/** Shown when the timed attempt ends: the hare score and what happens next. */
export class HareOverlay extends Component<Props> {
  render() {
    return (
      <div class="ready-overlay">
        <div class="ready-card">
          <h2 class="ready-title">Time's up!</h2>
          <div class="ready-count">{this.props.hareScore}</div>
          <p class="muted">Your hare score.</p>
          <p class="muted">
            You can keep playing — every extra word still counts toward your total
            (<strong>tortoise</strong>) score.
          </p>
          <button type="button" class="btn btn--primary btn--block" onClick={this.props.onContinue}>
            Keep playing
          </button>
        </div>
      </div>
    );
  }
}
