import { Component } from "preact";

interface Props {
  letters: string[];
  onPick: (letter: string, index: number) => void;
  disabled?: boolean;
}

/** The letter tiles. Tapping a tile appends it to the current word. */
export class Rack extends Component<Props> {
  render() {
    const { letters, onPick, disabled } = this.props;
    return (
      <div class="rack" role="group" aria-label="Letter rack">
        {letters.map((letter, index) => (
          <button
            type="button"
            key={index}
            class="tile"
            disabled={disabled}
            onClick={() => onPick(letter, index)}
          >
            {letter}
          </button>
        ))}
      </div>
    );
  }
}
