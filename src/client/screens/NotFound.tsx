import { Component } from "preact";

export class NotFound extends Component {
  render() {
    return (
      <div class="page page--narrow">
        <h1 class="title">Not found</h1>
        <p class="muted">That page doesn't exist.</p>
        <a class="btn btn--primary" href="/">
          Back to the game
        </a>
      </div>
    );
  }
}
