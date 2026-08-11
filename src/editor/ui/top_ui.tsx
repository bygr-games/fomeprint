import jsx from "./jsx";
import { KTUComponent } from "fra.ktu.red-component";

class TopUI extends KTUComponent {
  constructor(props: { binding?: string }) {
    super(props);
  }

  render(): Element {
    return (
      <div class="top-ui">
        <span class="header-logo">
          <img src="logo.png" alt="Fomeprint Logo" />
        </span>
      </div>
    );
  }
}

export function TopUIComponent(props: { binding?: string }): Element {
  return new TopUI(props);
}

customElements.define("top-ui", TopUI);
