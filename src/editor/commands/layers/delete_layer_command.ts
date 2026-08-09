import { DataStore, type SceneState } from "fra.ktu.red-component";
import type { ICommand } from "../icommand";
import {
  syncLayerBoundingBoxesByActiveThingId,
  touchThingsById,
} from "../../helpers/active_helper";

export class DeleteLayerCommand implements ICommand {
  historyLabel = "DeleteLayerCommand";

  private removedLayer: SceneState["layers"][number] | null = null;
  private removedLayerIndex = -1;
  private previousActiveThingId: number | null = null;
  private nextActiveThingId: number | null = null;

  constructor(
    private readonly layerId: number,
    private readonly sceneStateId: string = "editorScene",
  ) {}

  execute(): void {
    const sceneState = DataStore.getInstance().getStore(this.sceneStateId) as
      | SceneState
      | undefined;
    if (!sceneState) {
      return;
    }

    const layerIndex = sceneState.layers.findIndex(
      (layer) => layer.id === this.layerId,
    );
    if (layerIndex < 0) {
      return;
    }

    const previousActiveThingIdRaw =
      DataStore.getInstance().getStore("activeThingId");
    const previousActiveThingId = Number(previousActiveThingIdRaw);
    this.previousActiveThingId = Number.isFinite(previousActiveThingId)
      ? previousActiveThingId
      : null;

    this.removedLayer = sceneState.layers[layerIndex];
    this.removedLayerIndex = layerIndex;
    sceneState.layers.splice(layerIndex, 1);

    if (sceneState.layers.length > 0) {
      const fallbackIndex = Math.min(layerIndex, sceneState.layers.length - 1);
      this.nextActiveThingId = sceneState.layers[fallbackIndex].id;
    } else {
      this.nextActiveThingId = null;
    }

    DataStore.getInstance().touch(`${this.sceneStateId}.layers`);

    const currentActiveThingIdRaw =
      DataStore.getInstance().getStore("activeThingId");
    const currentActiveThingId = Number(currentActiveThingIdRaw);
    if (Number.isFinite(currentActiveThingId)) {
      touchThingsById(currentActiveThingId);
    }

    DataStore.getInstance().setStore("activeThingId", this.nextActiveThingId);
    syncLayerBoundingBoxesByActiveThingId(
      this.nextActiveThingId,
      this.sceneStateId,
    );
    if (this.nextActiveThingId !== null) {
      touchThingsById(this.nextActiveThingId);
    }
  }

  revert(): void {
    const sceneState = DataStore.getInstance().getStore(this.sceneStateId) as
      | SceneState
      | undefined;
    if (!sceneState || !this.removedLayer || this.removedLayerIndex < 0) {
      return;
    }

    const insertIndex = Math.max(
      0,
      Math.min(this.removedLayerIndex, sceneState.layers.length),
    );
    sceneState.layers.splice(insertIndex, 0, this.removedLayer);
    DataStore.getInstance().touch(`${this.sceneStateId}.layers`);

    const currentActiveThingIdRaw =
      DataStore.getInstance().getStore("activeThingId");
    const currentActiveThingId = Number(currentActiveThingIdRaw);
    if (Number.isFinite(currentActiveThingId)) {
      touchThingsById(currentActiveThingId);
    }

    DataStore.getInstance().setStore(
      "activeThingId",
      this.previousActiveThingId,
    );
    syncLayerBoundingBoxesByActiveThingId(
      this.previousActiveThingId,
      this.sceneStateId,
    );
    if (this.previousActiveThingId !== null) {
      touchThingsById(this.previousActiveThingId);
    }
  }
}
