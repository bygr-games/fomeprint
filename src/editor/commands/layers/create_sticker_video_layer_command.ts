import {
  DataStore,
  VideoLayer,
  cacheAsset,
  type SceneState,
} from "fra.ktu.red-component";
import type { ICommand } from "../icommand";
import { touchThingsById } from "../../helpers/active_helper";

export class CreateStickerVideoLayerCommand implements ICommand {
  historyLabel = "CreateStickerVideoLayerCommand";

  private createdLayerId: number | null = null;
  private previousActiveThingId: number | null = null;

  constructor(
    private readonly assetPath: string,
    private readonly sceneStateId: string = "editorScene",
  ) {}

  execute(): void {
    const sceneState = DataStore.getInstance().getStore(this.sceneStateId) as
      | SceneState
      | undefined;
    if (!sceneState) {
      return;
    }

    const previousActiveThingIdRaw =
      DataStore.getInstance().getStore("activeThingId");
    const previousActiveThingId = Number(previousActiveThingIdRaw);
    this.previousActiveThingId = Number.isFinite(previousActiveThingId)
      ? previousActiveThingId
      : null;

    const imageHash = cacheAsset(this.sceneStateId, this.assetPath);
    const nextLayer = VideoLayer.getDefaultState(this.sceneStateId);
    nextLayer.imageHash = imageHash;
    nextLayer.scale = 0.35;

    this.createdLayerId = nextLayer.id;

    const activeIndex = sceneState.layers.findIndex(
      (layer) => layer.id === this.previousActiveThingId,
    );

    if (activeIndex >= 0) {
      sceneState.layers.splice(activeIndex + 1, 0, nextLayer);
    } else {
      sceneState.layers.push(nextLayer);
    }

    DataStore.getInstance().touch(`${this.sceneStateId}.layers`);
    DataStore.getInstance().touch(
      `${this.sceneStateId}.layers.!${nextLayer.id}`,
    );

    DataStore.getInstance().setStore("activeThingId", nextLayer.id);
    if (this.previousActiveThingId !== null) {
      touchThingsById(this.previousActiveThingId);
    }
    touchThingsById(nextLayer.id);
  }

  revert(): void {
    const sceneState = DataStore.getInstance().getStore(this.sceneStateId) as
      | SceneState
      | undefined;
    if (!sceneState || this.createdLayerId === null) {
      return;
    }

    const layerIndex = sceneState.layers.findIndex(
      (layer) => layer.id === this.createdLayerId,
    );

    if (layerIndex >= 0) {
      sceneState.layers.splice(layerIndex, 1);
      DataStore.getInstance().touch(`${this.sceneStateId}.layers`);
    }

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
    if (this.previousActiveThingId !== null) {
      touchThingsById(this.previousActiveThingId);
    }
  }
}
