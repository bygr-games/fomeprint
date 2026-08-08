import { DataStore, type ShaderLayerState } from "fra.ktu.red-component";
import type { ICommand } from "../icommand";

export class ToggleBayerDitheringCommand implements ICommand {
  historyLabel = "ToggleBayerDitheringCommand";

  private shaderId?: number;
  private oldVisible?: boolean;
  private nextVisible?: boolean;

  constructor(private readonly sceneStateId: string = "editorScene") {}

  execute(): void {
    const owner = `${this.sceneStateId}.shaders`;
    const shaders = DataStore.getInstance().getStore(owner) as
      | ShaderLayerState[]
      | undefined;
    const shader = shaders?.find((item) => item.type === "bayer_dithering");

    if (!shader) {
      console.warn("[shader] bayer_dithering shader not found");
      return;
    }

    const currentVisible = shader.visible !== false;
    if (this.shaderId === undefined || this.nextVisible === undefined) {
      this.shaderId = shader.id;
      this.oldVisible = currentVisible;
      this.nextVisible = !currentVisible;
    }

    shader.visible = this.nextVisible;
    DataStore.getInstance().touch(`${owner}.!${shader.id}`);
  }

  revert(): void {
    if (this.shaderId === undefined || this.oldVisible === undefined) {
      return;
    }

    const owner = `${this.sceneStateId}.shaders`;
    const shaders = DataStore.getInstance().getStore(owner) as
      | ShaderLayerState[]
      | undefined;
    const shader = shaders?.find((item) => item.id === this.shaderId);

    if (!shader) {
      return;
    }

    shader.visible = this.oldVisible;
    DataStore.getInstance().touch(`${owner}.!${shader.id}`);
  }
}
