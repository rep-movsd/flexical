import { Component, type ComponentChildren } from "preact";

interface Props {
  title: string;
  onClose: () => void;
  children?: ComponentChildren;
}

/** Centered modal with a backdrop. Closes on backdrop click or Escape. */
export class Modal extends Component<Props> {
  private onKey = (event: KeyboardEvent): void => {
    if (event.key === "Escape") this.props.onClose();
  };

  componentDidMount(): void {
    window.addEventListener("keydown", this.onKey);
  }

  componentWillUnmount(): void {
    window.removeEventListener("keydown", this.onKey);
  }

  render() {
    const { title, onClose } = this.props;
    return (
      <div class="modal-overlay" onClick={onClose}>
        <div class="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
          <div class="modal__head">
            <h2 class="modal__title">{title}</h2>
            <button type="button" class="iconbtn" title="Close" aria-label="Close" onClick={onClose}>
              ✕
            </button>
          </div>
          <div class="modal__body">{this.props.children}</div>
        </div>
      </div>
    );
  }
}
