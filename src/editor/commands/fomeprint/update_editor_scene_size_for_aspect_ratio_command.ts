import { DataStore } from "fra.ktu.red-component";
import { type ICommand } from "../icommand";
import { getViewportFittedSize } from "../../helpers/viewport_fit";

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

    const { width, height } = getViewportFittedSize(this.aspectRatio);

    DataStore.getInstance().setStore(
      "fomeprint.paperAspectRatio",
      this.aspectRatio,
    );

    DataStore.getInstance().setStore("editorScene.width", width);
    DataStore.getInstance().setStore("editorScene.height", height);
  }

  revert(): void {}
}
