import { DataStore, type DisplayLayerState } from "fra.ktu.red-component";
import { executeCommand } from "../../ktu/helpers/commands_manager";
import { SetLayerFieldCommand } from "../commands/layers/set_layer_field_command";

type TouchPoint = { x: number; y: number };

type PixiTouchEventLike = {
  pointerId?: number;
  global?: { x?: number; y?: number };
  clientX?: number;
  clientY?: number;
};

type PixiStageLike = {
  eventMode?: string;
  on: (event: string, handler: (event: PixiTouchEventLike) => void) => void;
};

type PixiApplicationLike = {
  stage?: PixiStageLike;
};

export class TouchManager {
  private readonly touchPoints = new Map<number, TouchPoint>();
  private previousAngleRadians: number | null = null;
  private previousDistance: number | null = null;
  private activeLayerId: number | null = null;

  private static readonly MIN_LAYER_SCALE = 0.05;
  private static readonly MAX_LAYER_SCALE = 8;

  constructor(
    private readonly sceneStateId: string = "editorScene",
    private readonly onMultiTouchStart?: () => void,
  ) {
    this.bindWhenApplicationReady();
  }

  public static hasSeveralTouchPoints(): boolean {
    if (typeof navigator === "undefined") {
      return false;
    }

    return navigator.maxTouchPoints >= 2;
  }

  private bindWhenApplicationReady(retriesLeft = 120): void {
    const application = DataStore.getInstance().getStore("application") as
      | PixiApplicationLike
      | undefined;
    const stage = application?.stage;

    if (!stage) {
      if (retriesLeft <= 0) {
        return;
      }

      window.setTimeout(
        () => this.bindWhenApplicationReady(retriesLeft - 1),
        16,
      );
      return;
    }

    this.bindStageTouchHandlers(stage);
  }

  private bindStageTouchHandlers(stage: PixiStageLike): void {
    if (stage.eventMode === "none" || stage.eventMode === "passive") {
      stage.eventMode = "dynamic";
    }

    stage.on("touchstart", this.onTouchStart);
    stage.on("globaltouchmove", this.onTouchMove);
    stage.on("touchend", this.onTouchEnd);
    stage.on("touchendoutside", this.onTouchEnd);
    stage.on("touchcancel", this.onTouchEnd);
  }

  private onTouchStart = (event: PixiTouchEventLike): void => {
    const pointerId = this.getPointerId(event);
    const point = this.getPoint(event);
    if (pointerId === null || !point) {
      return;
    }

    this.touchPoints.set(pointerId, point);
    this.refreshGestureAnchor();
  };

  private onTouchMove = (event: PixiTouchEventLike): void => {
    const pointerId = this.getPointerId(event);
    const point = this.getPoint(event);
    if (pointerId === null || !point || !this.touchPoints.has(pointerId)) {
      return;
    }

    this.touchPoints.set(pointerId, point);
    this.refreshGestureAnchor();

    if (this.touchPoints.size < 2 || this.activeLayerId === null) {
      return;
    }

    const angle = this.getCurrentAngleRadians();
    const distance = this.getCurrentDistance();
    if (angle === null || distance === null || distance <= 0) {
      return;
    }

    if (this.previousAngleRadians === null) {
      this.previousAngleRadians = angle;
    }
    if (this.previousDistance === null) {
      this.previousDistance = distance;
    }

    const angleDelta = this.normalizeRadians(angle - this.previousAngleRadians);
    const scaleFactor = distance / this.previousDistance;

    this.previousAngleRadians = angle;
    this.previousDistance = distance;

    this.applyLayerRotationDelta(this.activeLayerId, angleDelta);
    this.applyLayerScaleDelta(this.activeLayerId, scaleFactor);
  };

  private onTouchEnd = (event: PixiTouchEventLike): void => {
    const pointerId = this.getPointerId(event);
    if (pointerId !== null) {
      this.touchPoints.delete(pointerId);
    }

    if (this.touchPoints.size < 2) {
      this.activeLayerId = null;
      this.previousAngleRadians = null;
      this.previousDistance = null;
    }
  };

  private refreshGestureAnchor(): void {
    if (this.touchPoints.size < 2) {
      return;
    }

    const layer = this.getActiveTransformableLayer();
    const angle = this.getCurrentAngleRadians();
    const distance = this.getCurrentDistance();
    if (!layer || angle === null || distance === null || distance <= 0) {
      return;
    }

    if (this.activeLayerId === null || this.activeLayerId !== layer.id) {
      this.activeLayerId = layer.id;
      this.previousAngleRadians = angle;
      this.previousDistance = distance;
      this.onMultiTouchStart?.();
    }
  }

  private getCurrentAngleRadians(): number | null {
    if (this.touchPoints.size < 2) {
      return null;
    }

    const points = Array.from(this.touchPoints.values());
    const first = points[0];
    const second = points[1];
    return Math.atan2(second.y - first.y, second.x - first.x);
  }

  private getCurrentDistance(): number | null {
    if (this.touchPoints.size < 2) {
      return null;
    }

    const points = Array.from(this.touchPoints.values());
    const first = points[0];
    const second = points[1];
    return Math.hypot(second.x - first.x, second.y - first.y);
  }

  private getPointerId(event: PixiTouchEventLike): number | null {
    const pointerId = Number(event.pointerId);
    return Number.isFinite(pointerId) ? pointerId : null;
  }

  private getPoint(event: PixiTouchEventLike): TouchPoint | null {
    const globalX = Number(event.global?.x);
    const globalY = Number(event.global?.y);

    if (Number.isFinite(globalX) && Number.isFinite(globalY)) {
      return { x: globalX, y: globalY };
    }

    const clientX = Number(event.clientX);
    const clientY = Number(event.clientY);

    if (Number.isFinite(clientX) && Number.isFinite(clientY)) {
      return { x: clientX, y: clientY };
    }

    return null;
  }

  private normalizeRadians(angle: number): number {
    let normalized = angle;
    while (normalized > Math.PI) {
      normalized -= Math.PI * 2;
    }
    while (normalized < -Math.PI) {
      normalized += Math.PI * 2;
    }
    return normalized;
  }

  private getActiveTransformableLayer():
    | (DisplayLayerState & { rotation?: number; scale?: number })
    | undefined {
    const activeThingId = Number(
      DataStore.getInstance().getStore("activeThingId"),
    );
    if (!Number.isFinite(activeThingId)) {
      return undefined;
    }

    const layers = DataStore.getInstance().getStore(
      this.sceneStateId + ".layers",
    ) as DisplayLayerState[];

    return layers.find((item) => item.id === activeThingId) as
      | (DisplayLayerState & { rotation?: number; scale?: number })
      | undefined;
  }

  private applyLayerScaleDelta(layerId: number, factor: number): void {
    if (!Number.isFinite(factor) || factor <= 0) {
      return;
    }

    const layers = DataStore.getInstance().getStore(
      this.sceneStateId + ".layers",
    ) as DisplayLayerState[];
    const layer = layers.find((item) => item.id === layerId) as
      | (DisplayLayerState & { scale?: number })
      | undefined;

    if (!layer || typeof layer.scale !== "number") {
      return;
    }

    const nextScale = Math.min(
      TouchManager.MAX_LAYER_SCALE,
      Math.max(TouchManager.MIN_LAYER_SCALE, layer.scale * factor),
    );

    if (Math.abs(nextScale - layer.scale) < 0.0001) {
      return;
    }

    executeCommand(new SetLayerFieldCommand(layer.id, "scale", nextScale));
    DataStore.getInstance().touch(this.sceneStateId + ".layers.!" + layer.id);
  }

  private applyLayerRotationDelta(layerId: number, deltaRadians: number): void {
    if (!Number.isFinite(deltaRadians) || Math.abs(deltaRadians) < 0.0001) {
      return;
    }

    const layers = DataStore.getInstance().getStore(
      this.sceneStateId + ".layers",
    ) as DisplayLayerState[];
    const layer = layers.find((item) => item.id === layerId) as
      | (DisplayLayerState & { rotation?: number })
      | undefined;

    if (!layer) {
      return;
    }

    const currentRotation =
      typeof layer.rotation === "number" ? layer.rotation : 0;
    const nextRotation = currentRotation + deltaRadians;

    executeCommand(
      new SetLayerFieldCommand(layer.id, "rotation", nextRotation),
    );
    DataStore.getInstance().touch(this.sceneStateId + ".layers.!" + layer.id);
  }
}
