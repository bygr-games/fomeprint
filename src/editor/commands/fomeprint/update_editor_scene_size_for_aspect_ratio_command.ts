import { DataStore } from "fra.ktu.red-component";
import { type ICommand } from "../icommand";

export class UpdateEditorSceneSizeForAspectRatioCommand implements ICommand {
  historyLabel = "UpdateEditorSceneSizeForAspectRatioCommand";
  undoable?: boolean | undefined = false;
  private readonly aspectRatio: number;

  constructor(aspectRatio: number) {
    this.aspectRatio = aspectRatio;
  }

  execute(): void {
    if (!Number.isFinite(this.aspectRatio) || this.aspectRatio <= 0) {
      return;
    }

    const viewportWidth = Math.max(1, window.innerWidth);
    const viewportHeight = Math.max(1, window.innerHeight);

    let width = viewportWidth;
    let height = Math.round(width / this.aspectRatio);

    if (height > viewportHeight) {
      height = viewportHeight;
      width = Math.round(height * this.aspectRatio);
    }

    width = Math.max(1, width);
    height = Math.max(1, height);

    DataStore.getInstance().setStore(
      "fomeprint.paperAspectRatio",
      this.aspectRatio,
    );

    DataStore.getInstance().setStore("editorScene.width", width);
    DataStore.getInstance().setStore("editorScene.height", height);
  }

  revert(): void {}
}
