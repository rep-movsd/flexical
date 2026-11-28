import { Component } from "preact";
import { Icon } from "./icons";

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
        <div class="entry__field">
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
          {value.length > 0 && !disabled && (
            <button
              type="button"
              class="entry__clear"
              title="Clear"
              aria-label="Clear"
              onClick={() => onInput("")}
            >
              <Icon name="close" size={16} />
            </button>
          )}
        </div>
      </form>
    );
  }
}
