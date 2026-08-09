import {
  DataStore,
  EventDispatcher,
  RedViewerComponent,
  type DisplayLayerState,
  type SceneState,
} from "fra.ktu.red-component";
import { executeCommand } from "../ktu/helpers/commands_manager";
import { NewStateCommand } from "./commands/new_state_command";
import { EditorUIComponent } from "./ui/editor_ui";
import { ActivateThingCommand } from "./commands/activate_thing_command";
import { SetLayerFieldCommand } from "./commands/layers/set_layer_field_command";

export class FomeprintEditor {
  canvasContainer: HTMLElement;
  uiContainer: HTMLElement;
  private draggingLayerId: number | null = null;
  private lastDragX: number | null = null;
  private lastDragY: number | null = null;
  private activeTouchPointers = new Map<number, { x: number; y: number }>();
  private pinchLayerId: number | null = null;
  private pinchStartDistance: number | null = null;
  private pinchStartScale: number | null = null;
  private pinchStartAngle: number | null = null;
  private pinchStartRotation: number | null = null;
  private pinchLastAngle: number | null = null;
  private isControlKeyPressed = false;
  private isTouchGestureActive = false;

  private static readonly MIN_LAYER_SCALE = 0.05;
  private static readonly MAX_LAYER_SCALE = 8;
  private static readonly WHEEL_ROTATION_SENSITIVITY = 0.01;

  private getPaperAspectRatio(): number {
    const ratio = Number(
      DataStore.getInstance().getStore("fomeprint.paperAspectRatio"),
    );
    if (!Number.isFinite(ratio) || ratio <= 0) {
      return 1;
    }
    return ratio;
  }

  private fitCanvasToViewport = () => {
    const viewportWidth = Math.max(1, window.innerWidth);
    const viewportHeight = Math.max(1, window.innerHeight);
    const aspectRatio = this.getPaperAspectRatio();

    let width = viewportWidth;
    let height = Math.round(width / aspectRatio);

    if (height > viewportHeight) {
      height = viewportHeight;
      width = Math.round(height * aspectRatio);
    }

    width = Math.max(1, width);
    height = Math.max(1, height);

    this.canvasContainer.style.width = width + "px";
    this.canvasContainer.style.height = height + "px";

    const state = DataStore.getInstance().getStore("editorScene") as
      | SceneState
      | undefined;
    if (state && (state.width !== width || state.height !== height)) {
      DataStore.getInstance().setStore("editorScene", {
        ...state,
        width,
        height,
      });
    }

    const application = DataStore.getInstance().getStore("application") as
      | { resize?: () => void }
      | undefined;
    application?.resize?.();
  };

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
      "editorScene.layers",
    ) as DisplayLayerState[];
    const layer = layers.find((item) => item.id === activeThingId) as
      | (DisplayLayerState & { scale?: number })
      | undefined;

    if (!layer || typeof layer.scale !== "number") {
      return undefined;
    }

    return layer;
  }

  private resetPinchState(): void {
    this.pinchLayerId = null;
    this.pinchStartDistance = null;
    this.pinchStartScale = null;
    this.pinchStartAngle = null;
    this.pinchStartRotation = null;
    this.pinchLastAngle = null;
  }

  private getActivePinchPoints(): Array<{ x: number; y: number }> {
    const sorted = Array.from(this.activeTouchPointers.entries()).sort(
      (left, right) => left[0] - right[0],
    );
    return sorted.map((entry) => entry[1]);
  }

  private getPinchDistance(): number | null {
    const points = this.getActivePinchPoints();
    if (points.length < 2) {
      return null;
    }

    const first = points[0];
    const second = points[1];
    return Math.hypot(second.x - first.x, second.y - first.y);
  }

  private getPinchAngle(): number | null {
    const points = this.getActivePinchPoints();
    if (points.length < 2) {
      return null;
    }

    const first = points[0];
    const second = points[1];
    return Math.atan2(second.y - first.y, second.x - first.x);
  }

  private normalizeAngleDelta(delta: number): number {
    return Math.atan2(Math.sin(delta), Math.cos(delta));
  }

  private maybeBeginPinch(): void {
    if (this.activeTouchPointers.size < 2 || this.pinchLayerId !== null) {
      return;
    }

    const layer = this.getActiveScalableLayer();
    const distance = this.getPinchDistance();
    const angle = this.getPinchAngle();

    if (!layer || !distance || distance <= 0 || angle === null) {
      return;
    }

    this.pinchLayerId = layer.id;
    this.pinchStartScale = layer.scale as number;
    this.pinchStartDistance = distance;
    this.pinchStartAngle = angle;
    this.pinchStartRotation =
      typeof (layer as { rotation?: number }).rotation === "number"
        ? ((layer as { rotation?: number }).rotation as number)
        : 0;
    this.pinchLastAngle = angle;

    // Prevent pan gestures from fighting pinch scale updates.
    this.draggingLayerId = null;
    this.lastDragX = null;
    this.lastDragY = null;
  }

  private maybeUpdatePinchScale(): void {
    if (
      this.pinchLayerId === null ||
      this.pinchStartDistance === null ||
      this.pinchStartScale === null
    ) {
      return;
    }

    const distance = this.getPinchDistance();
    if (!distance || distance <= 0) {
      return;
    }

    const layers = DataStore.getInstance().getStore(
      "editorScene.layers",
    ) as DisplayLayerState[];
    const layer = layers.find((item) => item.id === this.pinchLayerId) as
      | (DisplayLayerState & { scale?: number })
      | undefined;
    if (!layer || typeof layer.scale !== "number") {
      this.resetPinchState();
      return;
    }

    const factor = distance / this.pinchStartDistance;
    const unclampedScale = this.pinchStartScale * factor;
    const nextScale = Math.min(
      FomeprintEditor.MAX_LAYER_SCALE,
      Math.max(FomeprintEditor.MIN_LAYER_SCALE, unclampedScale),
    );

    if (Math.abs(nextScale - layer.scale) < 0.0001) {
      return;
    }

    executeCommand(new SetLayerFieldCommand(layer.id, "scale", nextScale));
    DataStore.getInstance().touch("editorScene.layers.!" + layer.id);
  }

  private maybeUpdatePinchRotation(): void {
    if (
      this.pinchLayerId === null ||
      this.pinchStartAngle === null ||
      this.pinchStartRotation === null ||
      this.pinchLastAngle === null
    ) {
      return;
    }

    const angle = this.getPinchAngle();
    if (angle === null) {
      return;
    }

    const layers = DataStore.getInstance().getStore(
      "editorScene.layers",
    ) as DisplayLayerState[];
    const layer = layers.find((item) => item.id === this.pinchLayerId) as
      | (DisplayLayerState & { rotation?: number })
      | undefined;
    if (!layer) {
      return;
    }

    const delta = this.normalizeAngleDelta(angle - this.pinchLastAngle);
    this.pinchLastAngle = angle;
    if (Math.abs(delta) < 0.0001) {
      return;
    }

    this.applyLayerRotationDelta(layer.id, delta);
  }

  private applyLayerRotationDelta(layerId: number, deltaRadians: number): void {
    if (!Number.isFinite(deltaRadians) || Math.abs(deltaRadians) < 0.0001) {
      return;
    }

    const layers = DataStore.getInstance().getStore(
      "editorScene.layers",
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
    DataStore.getInstance().touch("editorScene.layers.!" + layer.id);
  }

  private applyLayerScaleDelta(layerId: number, factor: number): void {
    if (!Number.isFinite(factor) || factor <= 0) {
      return;
    }

    const layers = DataStore.getInstance().getStore(
      "editorScene.layers",
    ) as DisplayLayerState[];
    const layer = layers.find((item) => item.id === layerId) as
      | (DisplayLayerState & { scale?: number })
      | undefined;
    if (!layer || typeof layer.scale !== "number") {
      return;
    }

    const nextScale = Math.min(
      FomeprintEditor.MAX_LAYER_SCALE,
      Math.max(FomeprintEditor.MIN_LAYER_SCALE, layer.scale * factor),
    );

    if (Math.abs(nextScale - layer.scale) < 0.0001) {
      return;
    }

    executeCommand(new SetLayerFieldCommand(layer.id, "scale", nextScale));
    DataStore.getInstance().touch("editorScene.layers.!" + layer.id);
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
        // Desktop/laptop: while physical Ctrl is held, pinch drives rotation.
        const rotationDelta =
          -event.deltaY * FomeprintEditor.WHEEL_ROTATION_SENSITIVITY;
        this.applyLayerRotationDelta(layer.id, rotationDelta);
      } else {
        // Default desktop/laptop pinch behavior: zoom active layer.
        const zoomFactor = Math.exp(
          -event.deltaY * FomeprintEditor.WHEEL_ROTATION_SENSITIVITY,
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

  private bindPinchToZoomHandlers(): void {
    const onPointerDown = (event: PointerEvent) => {
      if (this.isTouchGestureActive) {
        return;
      }
      if (event.pointerType !== "touch") {
        return;
      }

      if (event.cancelable) {
        event.preventDefault();
      }

      this.activeTouchPointers.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
      this.maybeBeginPinch();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (this.isTouchGestureActive) {
        return;
      }
      if (event.pointerType !== "touch") {
        return;
      }

      if (!this.activeTouchPointers.has(event.pointerId)) {
        return;
      }

      this.activeTouchPointers.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });

      if (this.activeTouchPointers.size >= 2) {
        if (event.cancelable) {
          event.preventDefault();
        }
        this.maybeBeginPinch();
        this.maybeUpdatePinchScale();
        this.maybeUpdatePinchRotation();
      }
    };

    const onPointerEnd = (event: PointerEvent) => {
      if (this.isTouchGestureActive) {
        return;
      }
      this.activeTouchPointers.delete(event.pointerId);
      if (this.activeTouchPointers.size < 2) {
        this.resetPinchState();
      }
    };

    const syncPointersFromTouches = (touches: TouchList) => {
      this.activeTouchPointers.clear();
      for (let i = 0; i < touches.length; i++) {
        const touch = touches.item(i);
        if (!touch) {
          continue;
        }
        this.activeTouchPointers.set(touch.identifier, {
          x: touch.clientX,
          y: touch.clientY,
        });
      }
    };

    const onTouchStart = (event: TouchEvent) => {
      this.isTouchGestureActive = true;
      if (event.cancelable) {
        event.preventDefault();
      }
      syncPointersFromTouches(event.touches);
      this.maybeBeginPinch();
    };

    const onTouchMove = (event: TouchEvent) => {
      if (event.cancelable) {
        event.preventDefault();
      }
      syncPointersFromTouches(event.touches);
      if (this.activeTouchPointers.size >= 2) {
        this.maybeBeginPinch();
        this.maybeUpdatePinchScale();
        this.maybeUpdatePinchRotation();
      }
    };

    const onTouchEnd = (event: TouchEvent) => {
      syncPointersFromTouches(event.touches);
      if (this.activeTouchPointers.size < 2) {
        this.resetPinchState();
      }
      if (event.touches.length === 0) {
        this.isTouchGestureActive = false;
      }
    };

    const preventGestureEvent = (event: Event) => {
      if (event.cancelable) {
        event.preventDefault();
      }
    };

    this.canvasContainer.addEventListener("pointerdown", onPointerDown, {
      passive: false,
    });
    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerEnd, { passive: true });
    window.addEventListener("pointercancel", onPointerEnd, { passive: true });

    // TouchEvent fallback for browsers where multi-touch pointer events are unreliable.
    this.canvasContainer.addEventListener("touchstart", onTouchStart, {
      passive: false,
    });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });

    // Safari may still emit gesture events for page zoom unless canceled.
    this.canvasContainer.addEventListener("gesturestart", preventGestureEvent, {
      passive: false,
    } as AddEventListenerOptions);
    this.canvasContainer.addEventListener(
      "gesturechange",
      preventGestureEvent,
      { passive: false } as AddEventListenerOptions,
    );
  }

  public constructor(canvasContainer: HTMLElement, uiContainer: HTMLElement) {
    console.log(
      "Initializing FomeprintEditor with autosaved state:",
      window.localStorage.getItem("autosavedState"),
    );
    this.canvasContainer = canvasContainer;
    this.uiContainer = uiContainer;
    executeCommand(new NewStateCommand());

    DataStore.getInstance().setStore("fomeprint.stage", 1);
    this.fitCanvasToViewport();

    this.canvasContainer.appendChild(
      RedViewerComponent({
        sceneState: "editorScene",
        resizeTo: canvasContainer,
      }),
    );
    this.uiContainer.appendChild(EditorUIComponent({}));
    this.bindKeyboardModifierHandlers();
    this.bindPinchToZoomHandlers();
    this.bindTrackpadPinchHandlers();
    window.addEventListener("resize", this.fitCanvasToViewport);

    EventDispatcher.getInstance().addEventListener(
      "fomeprint.paperAspectRatio",
      "update",
      this.fitCanvasToViewport,
    );

    EventDispatcher.getInstance().addEventListener(
      "editorScene.width",
      "update",
      () => {
        const state = DataStore.getInstance().getStore(
          "editorScene",
        ) as SceneState;
        this.canvasContainer.style.width = state.width + "px";
        const application = DataStore.getInstance().getStore("application");
        application.resize();
        DataStore.getInstance().touchIds("editorScene");
      },
    );

    EventDispatcher.getInstance().addEventListener(
      "editorScene.height",
      "update",
      () => {
        const state = DataStore.getInstance().getStore(
          "editorScene",
        ) as SceneState;
        this.canvasContainer.style.height = state.height + "px";
        const application = DataStore.getInstance().getStore("application");
        application.resize();
        DataStore.getInstance().touchIds("editorScene");
      },
    );

    EventDispatcher.getInstance().addEventListener(
      "editorScene",
      "layerClick",
      (payload: { layerId?: number | string; x?: number; y?: number }) => {
        console.log("[drag] layerClick payload", payload);
        const layerId = Number(payload?.layerId);
        if (!Number.isFinite(layerId)) {
          console.log(
            "[drag] ignored click: invalid layerId",
            payload?.layerId,
          );
          return;
        }
        this.draggingLayerId = layerId;
        this.lastDragX = Number.isFinite(payload?.x as number)
          ? Number(payload?.x)
          : null;
        this.lastDragY = Number.isFinite(payload?.y as number)
          ? Number(payload?.y)
          : null;
        console.log("[drag] start", {
          layerId: this.draggingLayerId,
          lastDragX: this.lastDragX,
          lastDragY: this.lastDragY,
        });
        executeCommand(new ActivateThingCommand(layerId));
      },
    );

    EventDispatcher.getInstance().addEventListener(
      "editorScene",
      "layerClickRelease",
      () => {
        console.log("[drag] release", {
          layerId: this.draggingLayerId,
          lastDragX: this.lastDragX,
          lastDragY: this.lastDragY,
        });
        this.draggingLayerId = null;
        this.lastDragX = null;
        this.lastDragY = null;
      },
    );

    EventDispatcher.getInstance().addEventListener(
      "editorScene",
      "mouseMove",
      (payload: { layerId?: number | string; x?: number; y?: number }) => {
        if (this.draggingLayerId === null) {
          return;
        }

        console.log("[drag] mouseMove while dragging", {
          layerId: this.draggingLayerId,
          payload,
        });

        const sceneState = DataStore.getInstance().getStore(
          "editorScene",
        ) as SceneState;
        if (!sceneState?.width || !sceneState?.height) {
          console.log("[drag] aborted: invalid scene dimensions", {
            width: sceneState?.width,
            height: sceneState?.height,
          });
          return;
        }

        const layers = DataStore.getInstance().getStore(
          "editorScene.layers",
        ) as DisplayLayerState[];
        const layer = layers.find(
          (item) => item.id === this.draggingLayerId,
        ) as (DisplayLayerState & { panX?: number; panY?: number }) | undefined;
        if (
          !layer ||
          typeof layer.panX !== "number" ||
          typeof layer.panY !== "number"
        ) {
          console.log("[drag] aborted: layer missing or no pan fields", {
            draggingLayerId: this.draggingLayerId,
            foundLayer: !!layer,
            panX: layer ? (layer as any).panX : undefined,
            panY: layer ? (layer as any).panY : undefined,
          });
          return;
        }

        if (this.lastDragX === null || this.lastDragY === null) {
          const initialX = Number(payload?.x);
          const initialY = Number(payload?.y);
          if (!Number.isFinite(initialX) || !Number.isFinite(initialY)) {
            console.log(
              "[drag] aborted: invalid initial mouseMove payload",
              payload,
            );
            return;
          }

          console.log("[drag] priming initial mouse position", {
            x: initialX,
            y: initialY,
          });
          this.lastDragX = initialX;
          this.lastDragY = initialY;
          return;
        }

        const currentX = Number(payload?.x);
        const currentY = Number(payload?.y);
        if (!Number.isFinite(currentX) || !Number.isFinite(currentY)) {
          console.log("[drag] aborted: invalid mouseMove payload", payload);
          return;
        }

        const deltaX = currentX - this.lastDragX;
        const deltaY = currentY - this.lastDragY;
        if (deltaX === 0 && deltaY === 0) {
          console.log("[drag] no movement delta");
          return;
        }

        this.lastDragX = currentX;
        this.lastDragY = currentY;

        const nextPanX = layer.panX + deltaX / sceneState.width;
        const nextPanY = layer.panY + deltaY / sceneState.height;

        console.log("[drag] applying pan", {
          layerId: layer.id,
          deltaX,
          deltaY,
          previousPanX: layer.panX,
          previousPanY: layer.panY,
          nextPanX,
          nextPanY,
        });

        executeCommand(new SetLayerFieldCommand(layer.id, "panX", nextPanX));
        executeCommand(new SetLayerFieldCommand(layer.id, "panY", nextPanY));
        DataStore.getInstance().touch("editorScene.layers.!" + layer.id);
      },
    );
  }
}
