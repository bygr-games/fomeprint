import {
  cacheAsset,
  DataStore,
  type SceneState,
  type CameraLayerState,
  VideoLayer,
} from "fra.ktu.red-component";
import { Rectangle, type Application } from "pixi.js";
import type { ICommand } from "../icommand";
import { touchThingsById } from "../../helpers/active_helper";

type RuntimeLayer = {
  id: number;
  mainSprite?: {
    visible?: boolean;
  };
};

export class SnapshotCameraToVideoLayerCommand implements ICommand {
  historyLabel = "SnapshotCameraToVideoLayerCommand";
  undoable?: boolean = false;

  constructor(private readonly sceneStateId: string = "editorScene") {}

  execute(): void {
    void this.captureAndCreateVideoLayer();
  }

  revert(): void {}

  private async captureAndCreateVideoLayer(): Promise<void> {
    try {
      const sceneState = DataStore.getInstance().getStore(this.sceneStateId) as
        | SceneState
        | undefined;
      if (!sceneState) {
        console.warn("[snapshot] scene state not found", this.sceneStateId);
        return;
      }

      const cameraLayer = sceneState.layers.find(
        (layer) => layer.type === "camera",
      ) as CameraLayerState | undefined;
      if (!cameraLayer) {
        console.warn("[snapshot] no camera layer available");
        return;
      }

      const runtimeLayers = DataStore.getInstance().getStore(
        `instances.${this.sceneStateId}.layers`,
      ) as RuntimeLayer[] | undefined;

      const runtimeCameraLayer = runtimeLayers?.find(
        (layer) => layer.id === cameraLayer.id,
      );
      if (!runtimeCameraLayer?.mainSprite) {
        console.warn("[snapshot] runtime camera layer is not ready");
        return;
      }

      const application = DataStore.getInstance().getStore("application") as
        | Application
        | undefined;
      if (!application) {
        console.warn("[snapshot] application store not found");
        return;
      }

      const base64Frame = await this.captureViewportSizedCameraFrame(
        application,
        runtimeLayers,
        cameraLayer.id,
      );

      const imageHash = cacheAsset(this.sceneStateId, base64Frame);
      const videoLayer = VideoLayer.getDefaultState(this.sceneStateId);
      videoLayer.imageHash = imageHash;
      videoLayer.panX = cameraLayer.panX;
      videoLayer.panY = cameraLayer.panY;
      videoLayer.scale = cameraLayer.scale;
      videoLayer.hFlip = cameraLayer.hFlip;
      videoLayer.vFlip = cameraLayer.vFlip;

      const cameraLayerIndex = sceneState.layers.findIndex(
        (layer) => layer.id === cameraLayer.id,
      );
      if (cameraLayerIndex >= 0) {
        sceneState.layers.splice(cameraLayerIndex + 1, 0, videoLayer);
      } else {
        sceneState.layers.push(videoLayer);
      }

      DataStore.getInstance().touch(`${this.sceneStateId}.layers`);
      DataStore.getInstance().touch(
        `${this.sceneStateId}.layers.!${videoLayer.id}`,
      );

      const oldActiveThingId =
        DataStore.getInstance().getStore("activeThingId");
      DataStore.getInstance().setStore("activeThingId", videoLayer.id);
      touchThingsById(oldActiveThingId);
      touchThingsById(videoLayer.id);

      window.localStorage.setItem(
        "autosavedState",
        JSON.stringify({
          data: sceneState,
          dataAt: Date.now(),
        }),
      );
    } catch (error) {
      console.error("[snapshot] failed to capture camera frame", error);
    }
  }

  private async captureViewportSizedCameraFrame(
    application: Application,
    runtimeLayers: RuntimeLayer[] | undefined,
    cameraLayerId: number,
  ): Promise<string> {
    const layerVisibilities = new Map<number, boolean>();

    try {
      for (const runtimeLayer of runtimeLayers ?? []) {
        const sprite = runtimeLayer.mainSprite;
        if (!sprite || typeof sprite.visible !== "boolean") {
          continue;
        }
        layerVisibilities.set(runtimeLayer.id, sprite.visible);
        sprite.visible = runtimeLayer.id === cameraLayerId;
      }

      return await application.renderer.extract.base64({
        target: application.stage,
        frame: new Rectangle(
          0,
          0,
          application.screen.width,
          application.screen.height,
        ),
      });
    } finally {
      for (const runtimeLayer of runtimeLayers ?? []) {
        const sprite = runtimeLayer.mainSprite;
        if (!sprite || typeof sprite.visible !== "boolean") {
          continue;
        }
        const previousVisibility = layerVisibilities.get(runtimeLayer.id);
        if (previousVisibility !== undefined) {
          sprite.visible = previousVisibility;
        }
      }
    }
  }
}
