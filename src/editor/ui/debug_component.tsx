import jsx from "texsaur";
import { KTUComponent } from "fra.ktu.red-component";
import { executeCommand } from "../../ktu/helpers/commands_manager";
import { ToggleBayerDitheringCommand } from "../commands/shaders/toggle_bayer_dithering_command";

class Debug extends KTUComponent {
  render(): Element {
    return (
      <div class="panel-container left-ui debug-panel">
        <button type="button" onclick={() => this.toggleBayerDithering()}>
          Toggle Bayer Dithering
        </button>
      </div>
    );
  }

  private toggleBayerDithering() {
    executeCommand(new ToggleBayerDitheringCommand("editorScene"));
  }
}

export function DebugComponent(props: { binding?: string }): Element {
  return new Debug(props);
}

customElements.define("debug-component", Debug);
