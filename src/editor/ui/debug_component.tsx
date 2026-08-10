import jsx from "./jsx";
import { KTUComponent } from "fra.ktu.red-component";
import { executeCommand } from "../../ktu/helpers/commands_manager";
import { ToggleBayerDitheringCommand } from "../commands/shaders/toggle_bayer_dithering_command";
import { ToggleBnwCommand } from "../commands/shaders/toggle_bnw_command";

class Debug extends KTUComponent {
  render(): Element {
    return (
      <div class="panel-container left-ui debug-panel">
        <button type="button" onclick={() => this.toggleBnw()}>
          Toggle BnW Filter
        </button>
        <button type="button" onclick={() => this.toggleBayerDithering()}>
          Toggle Bayer Dithering
        </button>
      </div>
    );
  }

  private toggleBnw() {
    executeCommand(new ToggleBnwCommand("editorScene"));
  }

  private toggleBayerDithering() {
    executeCommand(new ToggleBayerDitheringCommand("editorScene"));
  }
}

export function DebugComponent(props: { binding?: string }): Element {
  return new Debug(props);
}

customElements.define("debug-component", Debug);
