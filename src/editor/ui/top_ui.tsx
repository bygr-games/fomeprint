import jsx from "./jsx";
import { DataStore, KTUComponent } from "fra.ktu.red-component";
import { executeCommand } from "../../ktu/helpers/commands_manager";
import { NewStateCommand } from "../commands/new_state_command";
import { SetFomeprintStageCommand } from "../commands/fomeprint/set_fomeprint_stage_command";
import { FireErrorMessageCommand } from "../commands/fomeprint/fire_error_message_command";
import type { SceneState } from "fra.ktu.red-component";
import { IconOpenFile, IconReset } from "../helpers/icons";
import { UpdateEditorSceneSizeForAspectRatioCommand } from "../commands/fomeprint/update_editor_scene_size_for_aspect_ratio_command";

class TopUI extends KTUComponent {
  constructor(props: { binding?: string }) {
    const baseBinding = props.binding ?? "fomeprint.stage";
    super({ binding: baseBinding });
  }

  render(): Element {
    return (
      <div class="top-ui">
        <div class="top-ui-content">
          <button
            type="button"
            class="ui-square-action-button top-ui-corner-button top-ui-corner-button-left"
            onclick={() => this.openLoadFilePicker()}
            aria-label="Open file"
          >
            {IconOpenFile()}
          </button>
          <span class="header-logo">
            <img src="logo.png" alt="Fomeprint Logo" />
          </span>
          <button
            type="button"
            class="ui-square-action-button top-ui-corner-button top-ui-corner-button-right"
            onclick={() => this.resetState()}
            aria-label="Reset scene"
          >
            {IconReset()}
          </button>
        </div>
        <input
          id="top-ui-load-input"
          class="top-ui-load-input hidden"
          type="file"
          accept=".fomeprint.red,application/json"
          onchange={(event) => this.onLoadFileChange(event)}
        />
      </div>
    );
  }

  private openLoadFilePicker() {
    const input = this.querySelector(
      "#top-ui-load-input",
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
      this.fitCanvasToCurrentPaperAspectRatio();
    };

    reader.onerror = () => {
      executeCommand(
        new FireErrorMessageCommand("Could not read selected file."),
      );
    };

    reader.readAsText(file);
  }

  private fitCanvasToCurrentPaperAspectRatio() {
    const aspectRatio = Number(
      DataStore.getInstance().getStore("fomeprint.paperAspectRatio"),
    );
    executeCommand(new UpdateEditorSceneSizeForAspectRatioCommand(aspectRatio));
  }

  private resetState() {
    executeCommand(new NewStateCommand());
    this.fitCanvasToCurrentPaperAspectRatio();
  }
}

export function TopUIComponent(props: { binding?: string }): Element {
  return new TopUI(props);
}

customElements.define("top-ui", TopUI);
