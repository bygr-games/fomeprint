import { DataStore, type ShaderLayerState } from "fra.ktu.red-component";
import type { ICommand } from "../icommand";
import { executeCommand } from "../../../ktu/helpers/commands_manager";
import { FireErrorMessageCommand } from "../fomeprint/fire_error_message_command";

type DitherThresholdMode = "dither" | "threshold";

const DITHER_THRESHOLD_MODE_STORAGE_KEY = "fomeprint.ditherThreshold.mode";

type VisibilitySnapshot = {
  bayer: boolean;
  posterize: boolean;
};

export class SetDitherThresholdModeCommand implements ICommand {
  historyLabel = "SetDitherThresholdModeCommand";

  private previousVisibility?: VisibilitySnapshot;

  constructor(
    private readonly mode: DitherThresholdMode,
    private readonly sceneStateId: string = "editorScene",
  ) {}

  execute(): void {
    const owner = `${this.sceneStateId}.shaders`;
    const shaders = DataStore.getInstance().getStore(owner) as
      | ShaderLayerState[]
      | undefined;

    const bayerShader = shaders?.find(
      (item) => item.type === "bayer_dithering",
    );
    const posterizeShader = shaders?.find((item) => item.type === "posterize");

    if (!bayerShader || !posterizeShader) {
      console.warn("[shader] could not set Dither/Threshold mode");
      return;
    }

    if (!this.previousVisibility) {
      this.previousVisibility = {
        bayer: bayerShader.visible !== false,
        posterize: posterizeShader.visible !== false,
      };
    }

    const isDither = this.mode === "dither";
    bayerShader.visible = isDither;
    posterizeShader.visible = !isDither;
    try {
      window.localStorage.setItem(DITHER_THRESHOLD_MODE_STORAGE_KEY, this.mode);
    } catch (error) {
      console.error("[shader] failed to save dither mode", error);
      executeCommand(
        new FireErrorMessageCommand(
          "Could not save dither/threshold mode to local storage.",
        ),
      );
    }

    DataStore.getInstance().touch(`${owner}.!${bayerShader.id}`);
    DataStore.getInstance().touch(`${owner}.!${posterizeShader.id}`);
  }

  revert(): void {
    if (!this.previousVisibility) {
      return;
    }

    const owner = `${this.sceneStateId}.shaders`;
    const shaders = DataStore.getInstance().getStore(owner) as
      | ShaderLayerState[]
      | undefined;

    const bayerShader = shaders?.find(
      (item) => item.type === "bayer_dithering",
    );
    const posterizeShader = shaders?.find((item) => item.type === "posterize");

    if (!bayerShader || !posterizeShader) {
      return;
    }

    bayerShader.visible = this.previousVisibility.bayer;
    posterizeShader.visible = this.previousVisibility.posterize;

    const revertedMode: DitherThresholdMode = this.previousVisibility.bayer
      ? "dither"
      : "threshold";
    try {
      window.localStorage.setItem(
        DITHER_THRESHOLD_MODE_STORAGE_KEY,
        revertedMode,
      );
    } catch (error) {
      console.error("[shader] failed to save reverted dither mode", error);
      executeCommand(
        new FireErrorMessageCommand(
          "Could not save dither/threshold mode to local storage.",
        ),
      );
    }

    DataStore.getInstance().touch(`${owner}.!${bayerShader.id}`);
    DataStore.getInstance().touch(`${owner}.!${posterizeShader.id}`);
  }
}
