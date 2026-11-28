import { Component } from "preact";

function format(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** mm:ss countdown for the hare (timed) attempt. */
export class Timer extends Component<{ msLeft: number; done?: boolean }> {
  render() {
    const { msLeft, done } = this.props;
    const cls = "timer" + (done ? " timer--done" : "");
    return <span class={cls}>{format(msLeft)}</span>;
  }
}
