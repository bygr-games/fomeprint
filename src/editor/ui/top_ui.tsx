import jsx from "./jsx";
import { KTUComponent } from "fra.ktu.red-component";
import { DebugComponent } from "./debug_component";

class TopUI extends KTUComponent {
  private isMenuOpen: boolean;

  constructor(props: { binding?: string }) {
    super(props);
    this.isMenuOpen = false;
  }

  render(): Element {
    return (
      <div class="top-ui">
        <span class="header-logo">
          <img src="logo.png" alt="Fomeprint Logo" />
        </span>

        <span>
          <button
            type="button"
            class={`hamburger ${this.isMenuOpen ? "is-open" : ""}`}
            onclick={() => this.toggleMenu()}
            aria-label="Toggle menu"
            aria-expanded={this.isMenuOpen ? "true" : "false"}
          >
            <span class="editor-hamburger-line"></span>
            <span class="editor-hamburger-line"></span>
            <span class="editor-hamburger-line"></span>
          </button>
        </span>

        {this.isMenuOpen && (
          <nav class="editor-header-menu" aria-label="Main menu">
            <DebugComponent />
          </nav>
        )}
      </div>
    );
  }

  private toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;
    this.reRender();
  }
}

export function TopUIComponent(props: { binding?: string }): Element {
  return new TopUI(props);
}

customElements.define("top-ui", TopUI);
