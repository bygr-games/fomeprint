import { DataStore, type DisplayLayerState } from "fra.ktu.red-component";
import { executeCommand } from "../../ktu/helpers/commands_manager";
import { SetLayerFieldCommand } from "../commands/layers/set_layer_field_command";

export class GestureManager {
  private isControlKeyPressed = false;

  private static readonly MIN_LAYER_SCALE = 0.05;
  private static readonly MAX_LAYER_SCALE = 8;
  private static readonly WHEEL_ROTATION_SENSITIVITY = 0.01;

  constructor(
    private readonly canvasContainer: HTMLElement,
    private readonly sceneStateId: string = "editorScene",
  ) {
    this.bindKeyboardModifierHandlers();
    this.bindTrackpadPinchHandlers();
  }

  public static hasSeveralTouchPoints(): boolean {
    if (typeof navigator === "undefined") {
      return false;
    }

    return navigator.maxTouchPoints >= 2;
  }

  private getActiveScalableLayer():
    | (DisplayLayerState & { scale?: number })
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
    const layer = layers.find((item) => item.id === activeThingId) as
      | (DisplayLayerState & { scale?: number })
      | undefined;

    if (!layer || typeof layer.scale !== "number") {
      return undefined;
    }

    return layer;
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
      GestureManager.MAX_LAYER_SCALE,
      Math.max(GestureManager.MIN_LAYER_SCALE, layer.scale * factor),
    );

    if (Math.abs(nextScale - layer.scale) < 0.0001) {
      return;
    }

    executeCommand(new SetLayerFieldCommand(layer.id, "scale", nextScale));
    DataStore.getInstance().touch(this.sceneStateId + ".layers.!" + layer.id);
  }

  private bindKeyboardModifierHandlers(): void {
    window.addEventListener("keydown", (event: KeyboardEvent) => {
      if (event.key === "Control") {
        this.isControlKeyPressed = true;
      }
    });

    window.addEventListener("keyup", (event: KeyboardEvent) => {
      if (event.key === "Control") {
        this.isControlKeyPressed = false;
      }
    });

    window.addEventListener("blur", () => {
      this.isControlKeyPressed = false;
    });
  }

  private bindTrackpadPinchHandlers(): void {
    const onWheel = (event: WheelEvent) => {
      const path =
        typeof event.composedPath === "function" ? event.composedPath() : [];
      const isOverCanvas =
        path.includes(this.canvasContainer) ||
        this.canvasContainer.contains(event.target as Node);

      if (!isOverCanvas) {
        return;
      }

      // On desktop touchpads, pinch commonly arrives as ctrl+wheel.
      if (!event.ctrlKey) {
        return;
      }

      if (event.cancelable) {
        event.preventDefault();
      }

      const layer = this.getActiveScalableLayer();
      if (!layer) {
        return;
      }

      if (this.isControlKeyPressed) {
        const rotationDelta =
          -event.deltaY * GestureManager.WHEEL_ROTATION_SENSITIVITY;
        this.applyLayerRotationDelta(layer.id, rotationDelta);
      } else {
        const zoomFactor = Math.exp(
          -event.deltaY * GestureManager.WHEEL_ROTATION_SENSITIVITY,
        );
        this.applyLayerScaleDelta(layer.id, zoomFactor);
      }
    };

    // Capture phase gives us first chance to stop browser page zoom.
    window.addEventListener("wheel", onWheel, {
      passive: false,
      capture: true,
    });
  }
}
