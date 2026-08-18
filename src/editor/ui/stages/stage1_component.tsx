import jsx from "../jsx";
import {
  DataStore,
  KTUComponent,
  type CameraLayerState,
} from "fra.ktu.red-component";
import { executeCommand } from "../../../ktu/helpers/commands_manager";
import { SnapshotCameraToVideoLayerCommand } from "../../commands/layers/snapshot_camera_to_video_layer_command";
import { SetLayerFieldCommand } from "../../commands/layers/set_layer_field_command";
import { getThingById } from "../../helpers/active_helper";
import {
  IconSnapshot,
  IconSwap,
  IconMirror,
  IconCamera,
} from "../../helpers/icons";
import { SwapCameraCommand } from "../../commands/fomeprint/swap_camera_command";

class Stage1 extends KTUComponent {
  constructor(props: { binding?: string }) {
    const baseBinding = props.binding ?? "fomeprint.stage";
    super({ binding: `${baseBinding},activeThingId,editorScene.layers` });
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
    if (this.currentStage() !== 1) {
      return <div></div>;
    }

    return (
      <div class="panel-container left-ui stage-panel">
        <div class="stage-actions stage1-actions">
          <button
            type="button"
            class="ui-square-action-button"
            onclick={() => this.swapCamera()}
          >
            {IconSwap()}
          </button>
          <button
            type="button"
            class="ui-square-action-button"
            onclick={() => this.toggleFlip()}
          >
            {IconMirror()}
          </button>
          <button
            type="button"
            class="ui-square-action-button"
            onclick={() => this.snapshotCameraLayer()}
          >
            {IconCamera()}
          </button>
        </div>
      </div>
    );
  }

  private swapCamera() {
    executeCommand(new SwapCameraCommand());
  }

  private toggleFlip() {
    const layer = getThingById(
      DataStore.getInstance().getStore("fomeprint.cameraLayerId"),
    )! as CameraLayerState;
    executeCommand(new SetLayerFieldCommand(layer.id, "hFlip", !layer.hFlip));
  }

  private snapshotCameraLayer() {
    executeCommand(new SnapshotCameraToVideoLayerCommand("editorScene"));
  }
}

export function Stage1Component(props: { binding?: string }): Element {
  return new Stage1(props);
}

customElements.define("stage-1-component", Stage1);
