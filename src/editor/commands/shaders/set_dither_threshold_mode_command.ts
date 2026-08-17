import { DataStore, type ShaderLayerState } from "fra.ktu.red-component";
import type { ICommand } from "../icommand";

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
    window.localStorage.setItem(DITHER_THRESHOLD_MODE_STORAGE_KEY, this.mode);

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
    window.localStorage.setItem(
      DITHER_THRESHOLD_MODE_STORAGE_KEY,
      revertedMode,
    );

    DataStore.getInstance().touch(`${owner}.!${bayerShader.id}`);
    DataStore.getInstance().touch(`${owner}.!${posterizeShader.id}`);
  }
}
