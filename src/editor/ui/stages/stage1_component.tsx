import jsx from "../jsx";
import {
  DataStore,
  KTUComponent,
  type CameraLayerState,
  type SceneState,
} from "fra.ktu.red-component";
import { executeCommand } from "../../../ktu/helpers/commands_manager";
import { SnapshotCameraToVideoLayerCommand } from "../../commands/layers/snapshot_camera_to_video_layer_command";
import { SetLayerFieldCommand } from "../../commands/layers/set_layer_field_command";
import { getThingById } from "../../helpers/active_helper";
import {
  IconSnapshot,
  IconOpenFile,
  IconSwap,
  IconMirror,
} from "../../helpers/icons";
import { SwapCameraCommand } from "../../commands/fomeprint/swap_camera_command";
import { FireErrorMessageCommand } from "../../commands/fomeprint/fire_error_message_command";
import { NewStateCommand } from "../../commands/new_state_command";
import { SetFomeprintStageCommand } from "../../commands/fomeprint/set_fomeprint_stage_command";

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
            onclick={() => this.openLoadFilePicker()}
          >
            {IconOpenFile()}
          </button>
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
            {IconSnapshot()}
          </button>
        </div>
        <input
          id="stage1-load-input"
          class="stage1-load-input hidden"
          type="file"
          accept=".fomeprint.red,application/json"
          onchange={(event) => this.onLoadFileChange(event)}
        />
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

  private openLoadFilePicker() {
    const input = this.querySelector(
      "#stage1-load-input",
    ) as HTMLInputElement | null;
    if (!input) {
      return;
    }

    input.value = "";
    input.click();
  }

  private onLoadFileChange(event: Event) {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];

    if (input) {
      input.value = "";
    }

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result;
      if (typeof content !== "string") {
        executeCommand(
          new FireErrorMessageCommand("Could not read selected file."),
        );
        return;
      }

      let sceneState: SceneState | null = null;
      try {
        sceneState = JSON.parse(content);
      } catch {
        executeCommand(
          new FireErrorMessageCommand("Selected file is not valid JSON."),
        );
        return;
      }

      if (!sceneState) {
        executeCommand(
          new FireErrorMessageCommand(
            "Selected file is not a valid .fomeprint.red scene.",
          ),
        );
        return;
      }

      executeCommand(new NewStateCommand(sceneState));
      executeCommand(new SetFomeprintStageCommand(2));
    };

    reader.onerror = () => {
      executeCommand(
        new FireErrorMessageCommand("Could not read selected file."),
      );
    };

    reader.readAsText(file);
  }
}

export function Stage1Component(props: { binding?: string }): Element {
  return new Stage1(props);
}

customElements.define("stage-1-component", Stage1);
