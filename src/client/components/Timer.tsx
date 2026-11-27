// Presentational mm:ss clock for the current attempt. Mutually-muted styling
// when the timer is paused (e.g. after a rejected word).
import { Component } from "preact";

function format(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

export class Timer extends Component<{ seconds: number; running: boolean }> {
  render() {
    return (
      <span class={this.props.running ? "timer" : "timer timer--paused"}>
        {format(this.props.seconds)}
      </span>
    );
  }
}
