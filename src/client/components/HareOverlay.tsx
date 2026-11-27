import { Component } from "preact";

interface Props {
  mode: "start" | "paused" | "done";
  /** The hare score to show when the timer ends. */
  hareScore: number;
  onStart: () => void;
  onResume: () => void;
  onContinue: () => void;
}

/**
 * Full-screen modal for the timed (hare) attempt: waiting to start, paused, and
 * time's up. The board behind is blurred while it is shown.
 */
export class HareOverlay extends Component<Props> {
  render() {
    const { mode, hareScore } = this.props;

    if (mode === "done") {
      return (
        <div class="ready-overlay">
          <div class="ready-card">
            <h2 class="ready-title">Time's up!</h2>
            <div class="ready-count">{hareScore}</div>
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

    if (mode === "paused") {
      return (
        <div class="ready-overlay">
          <div class="ready-card">
            <h2 class="ready-title">Paused</h2>
            <p class="muted">The clock is stopped.</p>
            <button type="button" class="btn btn--primary btn--block" onClick={this.props.onResume}>
              Resume
            </button>
          </div>
        </div>
      );
    }

    return (
      <div class="ready-overlay">
        <div class="ready-card">
          <h2 class="ready-title">Hare mode</h2>
          <p class="muted">
            Find as many words as you can in <strong>3 minutes</strong>. The score when the
            clock runs out is your <strong>hare</strong> score.
          </p>
          <p class="muted">
            You can keep playing afterwards — those words count toward your
            <strong> tortoise</strong> total instead.
          </p>
          <button type="button" class="btn btn--primary btn--block" onClick={this.props.onStart}>
            Start
          </button>
        </div>
      </div>
    );
  }
}
