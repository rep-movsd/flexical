import { Component } from "preact";

interface Props {
  value: string;
  onInput: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

/** Word input. No buttons — Enter submits, Escape clears (handled globally). */
export class WordEntry extends Component<Props> {
  render() {
    const { value, onInput, onSubmit, disabled } = this.props;
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
      </form>
    );
  }
}
