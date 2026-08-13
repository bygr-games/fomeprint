import { DataStore, type SceneState } from "fra.ktu.red-component";
import type { ICommand } from "../icommand";
import { DeleteLayerCommand } from "./delete_layer_command";

export class RemoveCameraLayerCommand implements ICommand {
  historyLabel = "RemoveCameraLayerCommand";

  private deleteLayerCommand: DeleteLayerCommand | null = null;
  private removedCameraLayerId: number | null = null;

  constructor(private readonly sceneStateId: string = "editorScene") {}

  execute(): void {
    const sceneState = DataStore.getInstance().getStore(this.sceneStateId) as
      | SceneState
      | undefined;
    if (!sceneState) {
      return;
    }

    const cameraLayerIdRaw = DataStore.getInstance().getStore(
      "fomeprint.cameraLayerId",
    );
    const cameraLayerId = Number(cameraLayerIdRaw);

    const cameraLayer = Number.isFinite(cameraLayerId)
      ? sceneState.layers.find((layer) => layer.id === cameraLayerId)
      : sceneState.layers.find((layer) => layer.type === "camera");

    if (!cameraLayer || cameraLayer.type !== "camera") {
      DataStore.getInstance().setStore("fomeprint.cameraLayerId", null);
      return;
    }

    this.removedCameraLayerId = cameraLayer.id;
    this.deleteLayerCommand = new DeleteLayerCommand(
      cameraLayer.id,
      this.sceneStateId,
    );
    this.deleteLayerCommand.execute();
    DataStore.getInstance().setStore("fomeprint.cameraLayerId", null);
  }

  revert(): void {
    if (!this.deleteLayerCommand) {
      return;
    }

    this.deleteLayerCommand.revert();
    if (this.removedCameraLayerId !== null) {
      DataStore.getInstance().setStore(
        "fomeprint.cameraLayerId",
        this.removedCameraLayerId,
      );
    }
  }
}
