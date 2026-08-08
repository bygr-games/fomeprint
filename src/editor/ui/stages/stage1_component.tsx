import jsx from "texsaur";
import { KTUComponent } from "fra.ktu.red-component";
import { executeCommand } from "../../../ktu/helpers/commands_manager";
import { SnapshotCameraToVideoLayerCommand } from "../../commands/layers/snapshot_camera_to_video_layer_command";
import { ToggleBayerDitheringCommand } from "../../commands/shaders/toggle_bayer_dithering_command";

class Stage1 extends KTUComponent {
  constructor(props: { binding?: string }) {
    super({ binding: props.binding ?? "fomeprint.stage" });
  }

  defaultBinding(): Record<string, any> {
    return {
      "fomeprint.stage": 1,
    };
  }

  private currentStage(): number {
    const stage = Number(this.bindingData["fomeprint.stage"]);
    if (stage === 1 || stage === 2 || stage === 3) {
      return stage;
    }
    return 1;
  }

  render(): Element {
    const isVisible = this.currentStage() === 1;
    const visibilityClass = isVisible ? "stage-visible" : "stage-hidden";

    return (
      <div class={`panel-container left-ui stage-panel ${visibilityClass}`}>
        <button type="button" onclick={() => this.snapshotCameraLayer()}>
          Snapshot Camera to Video Layer
        </button>
        <button type="button" onclick={() => this.toggleBayerDithering()}>
          Toggle Bayer Dithering
        </button>
      </div>
    );
  }

  private snapshotCameraLayer() {
    executeCommand(new SnapshotCameraToVideoLayerCommand("editorScene"));
  }

  private toggleBayerDithering() {
    executeCommand(new ToggleBayerDitheringCommand("editorScene"));
  }
}

export function Stage1Component(props: { binding?: string }): Element {
  return new Stage1(props);
}

customElements.define("stage-1-component", Stage1);
