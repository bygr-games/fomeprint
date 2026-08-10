import jsx from "texsaur";
import { KTUComponent } from "fra.ktu.red-component";
import { executeCommand } from "../../ktu/helpers/commands_manager";
import { SetFomeprintStageCommand } from "../commands/fomeprint/set_fomeprint_stage_command";

class Header extends KTUComponent {
  private isMenuOpen = false;

  constructor(props: { binding?: string }) {
    const baseBinding = props.binding ?? "fomeprint.stage";
    super({ binding: baseBinding });
  }

  defaultBinding(): Record<string, any> {
    return {
      "fomeprint.stage": 1,
    };
  }

  render(): Element {
    const currentStage = this.getCurrentStage();

    return (
      <header class="editor-header">
        <div class="editor-header-bar">
          <button
            type="button"
            class="editor-logo-button"
            onclick={() => this.goToStage(1)}
            aria-label="Go to capture stage"
          >
            <span class="editor-logo-mark">f</span>
            <span class="editor-logo-word">fomeprint</span>
          </button>

          <button
            type="button"
            class={`editor-hamburger ${this.isMenuOpen ? "is-open" : ""}`}
            onclick={() => this.toggleMenu()}
            aria-label="Toggle menu"
            aria-expanded={this.isMenuOpen ? "true" : "false"}
          >
            <span class="editor-hamburger-line"></span>
            <span class="editor-hamburger-line"></span>
            <span class="editor-hamburger-line"></span>
          </button>
        </div>

        {this.isMenuOpen && (
          <nav class="editor-header-menu" aria-label="Main menu">
            <button
              type="button"
              class={`editor-header-menu-button ${currentStage === 1 ? "is-active" : ""}`}
              onclick={() => this.goToStage(1)}
            >
              Capture
            </button>
            <button
              type="button"
              class={`editor-header-menu-button ${currentStage === 2 ? "is-active" : ""}`}
              onclick={() => this.goToStage(2)}
            >
              Stickers
            </button>
            <button
              type="button"
              class={`editor-header-menu-button ${currentStage === 3 ? "is-active" : ""}`}
              onclick={() => this.goToStage(3)}
            >
              Print
            </button>
          </nav>
        )}
      </header>
    );
  }

  private getCurrentStage(): number {
    const stage = Number(this.bindingData["fomeprint.stage"]);
    if (stage === 1 || stage === 2 || stage === 3) {
      return stage;
    }
    return 1;
  }

  private toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;
    this.reRender();
  }

  private goToStage(stage: 1 | 2 | 3) {
    this.isMenuOpen = false;
    executeCommand(new SetFomeprintStageCommand(stage));
    this.reRender();
  }
}

export function HeaderComponent(props: { binding?: string }): Element {
  return new Header(props);
}

customElements.define("header-component", Header);
