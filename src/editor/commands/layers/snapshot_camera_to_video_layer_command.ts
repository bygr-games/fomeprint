import {
  AdjustmentShader,
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
    texture?: {
      source?: {
        resource?: HTMLVideoElement;
      };
    };
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

      const base64Frame = await this.captureFullCameraFrame(
        cameraLayer,
        runtimeCameraLayer,
        application,
        runtimeLayers,
      );

      const imageHash = cacheAsset(this.sceneStateId, base64Frame);
      const videoLayer = VideoLayer.getDefaultState(this.sceneStateId);
      videoLayer.imageHash = imageHash;
      videoLayer.panX = cameraLayer.panX;
      videoLayer.panY = cameraLayer.panY;
      videoLayer.scale = cameraLayer.scale;
      videoLayer.fillCanvas = cameraLayer.fillCanvas;
      // Flip is baked into the captured pixels, so keep the output layer unflipped.
      videoLayer.hFlip = false;
      videoLayer.vFlip = false;

      const cameraAdjustmentShader = cameraLayer.shaders.find(
        (shader) => shader.type === "adjustment",
      );
      const adjustmentShader = AdjustmentShader.getDefaultState(
        this.sceneStateId,
      );
      if (cameraAdjustmentShader) {
        const {
          id: _oldId,
          name: _oldName,
          type: _oldType,
          ...fields
        } = cameraAdjustmentShader as Record<string, unknown>;
        Object.assign(adjustmentShader as Record<string, unknown>, fields);
      }
      videoLayer.shaders = [adjustmentShader];

      const cameraLayerIndex = sceneState.layers.findIndex(
        (layer) => layer.id === cameraLayer.id,
      );
      if (cameraLayerIndex >= 0) {
        sceneState.layers.splice(cameraLayerIndex, 1, videoLayer);
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

      DataStore.getInstance().setStore("fomeprint.stage", 2);
    } catch (error) {
      console.error("[snapshot] failed to capture camera frame", error);
    }
  }

  private async captureCameraFrameScaledToViewport(
    application: Application,
    runtimeLayers: RuntimeLayer[] | undefined,
    cameraLayerId: number,
  ): Promise<string> {
    const layerVisibilities = new Map<number, boolean>();
    const stage = application.stage as any;
    const previousStageFilters = stage.filters;

    try {
      for (const runtimeLayer of runtimeLayers ?? []) {
        const sprite = runtimeLayer.mainSprite;
        if (!sprite || typeof sprite.visible !== "boolean") {
          continue;
        }

        layerVisibilities.set(runtimeLayer.id, sprite.visible);
        sprite.visible = runtimeLayer.id === cameraLayerId;
      }

      // Exclude scene/global shader pass while preserving camera layer output.
      stage.filters = [];

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
      stage.filters = previousStageFilters;

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

  private async captureFullCameraFrame(
    cameraLayer: CameraLayerState,
    runtimeCameraLayer: RuntimeLayer,
    application: Application,
    runtimeLayers: RuntimeLayer[] | undefined,
  ): Promise<string> {
    const videoElement =
      runtimeCameraLayer.mainSprite?.texture?.source?.resource;

    const width = Math.max(
      1,
      Math.round(
        Number(
          videoElement?.videoWidth ??
            (videoElement as { naturalWidth?: number } | undefined)
              ?.naturalWidth ??
            videoElement?.width ??
            0,
        ),
      ),
    );
    const height = Math.max(
      1,
      Math.round(
        Number(
          videoElement?.videoHeight ??
            (videoElement as { naturalHeight?: number } | undefined)
              ?.naturalHeight ??
            videoElement?.height ??
            0,
        ),
      ),
    );

    if (!videoElement || width <= 1 || height <= 1) {
      return this.captureCameraFrameScaledToViewport(
        application,
        runtimeLayers,
        cameraLayer.id,
      );
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      return this.captureCameraFrameScaledToViewport(
        application,
        runtimeLayers,
        cameraLayer.id,
      );
    }

    context.save();

    if (cameraLayer.hFlip) {
      context.translate(width, 0);
      context.scale(-1, 1);
    }

    if (cameraLayer.vFlip) {
      context.translate(0, height);
      context.scale(1, -1);
    }

    context.drawImage(videoElement, 0, 0, width, height);
    context.restore();

    return canvas.toDataURL("image/png");
  }
}
