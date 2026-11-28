import { Component } from "preact";

interface Props {
  letters: string[];
  onPick: (letter: string) => void;
  disabled?: boolean;
  /** Show `*` instead of the real letters (before the timed attempt starts). */
  masked?: boolean;
}

/** The allowed letters, shown as the keys you may press. */
export class Letters extends Component<Props> {
  render() {
    const { letters, onPick, disabled, masked } = this.props;
    return (
      <div class="keys" role="group" aria-label="Allowed letters">
        {letters.map((letter) => (
          <button
            type="button"
            key={letter}
            class="key"
            disabled={disabled}
            onClick={() => onPick(letter)}
          >
            {masked ? "*" : letter}
          </button>
        ))}
      </div>
    );
  }
}
