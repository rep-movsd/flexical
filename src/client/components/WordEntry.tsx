import { Component } from "preact";

interface Props {
  value: string;
  onInput: (value: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  disabled?: boolean;
}

/** Word input. Works with a physical keyboard and with taps on the rack. */
export class WordEntry extends Component<Props> {
  render() {
    const { value, onInput, onSubmit, onClear, disabled } = this.props;
    return (
      <form
        class="entry"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <input
          class="entry__input"
          value={value}
          placeholder="Type or tap letters…"
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellcheck={false}
          disabled={disabled}
          onInput={(event) => {
            const raw = (event.target as HTMLInputElement).value;
            onInput(raw.replace(/[^a-zA-Z]/g, "").toUpperCase());
          }}
        />
        <button type="button" class="btn btn--ghost" onClick={onClear} disabled={disabled || !value}>
          Clear
        </button>
        <button type="submit" class="btn btn--primary" disabled={disabled || !value}>
          Enter
        </button>
      </form>
    );
  }
}
