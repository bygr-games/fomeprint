import {
  DataStore,
  EventDispatcher,
  type DisplayLayerState,
  type SceneState,
} from "fra.ktu.red-component";
import { executeCommand } from "../../ktu/helpers/commands_manager";
import { ActivateThingCommand } from "../commands/activate_thing_command";
import { SetLayerFieldCommand } from "../commands/layers/set_layer_field_command";

export class MouseManager {
  private draggingLayerId: number | null = null;
  private lastDragX: number | null = null;
  private lastDragY: number | null = null;

  constructor(private readonly sceneStateId: string = "editorScene") {
    this.bind();
  }

  public resetDragState(): void {
    this.draggingLayerId = null;
    this.lastDragX = null;
    this.lastDragY = null;
  }

  private bind(): void {
    EventDispatcher.getInstance().addEventListener(
      this.sceneStateId,
      "layerClick",
      (payload: { layerId?: number | string; x?: number; y?: number }) => {
        const layerId = Number(payload?.layerId);
        if (!Number.isFinite(layerId)) {
          return;
        }

        this.draggingLayerId = layerId;
        this.lastDragX = Number.isFinite(payload?.x as number)
          ? Number(payload?.x)
          : null;
        this.lastDragY = Number.isFinite(payload?.y as number)
          ? Number(payload?.y)
          : null;

        executeCommand(new ActivateThingCommand(layerId));
      },
    );

    EventDispatcher.getInstance().addEventListener(
      this.sceneStateId,
      "layerClickRelease",
      () => {
        this.resetDragState();
      },
    );

    EventDispatcher.getInstance().addEventListener(
      this.sceneStateId,
      "mouseMove",
      (payload: { layerId?: number | string; x?: number; y?: number }) => {
        if (this.draggingLayerId === null) {
          return;
        }

        const sceneState = DataStore.getInstance().getStore(
          this.sceneStateId,
        ) as SceneState;
        if (!sceneState?.width || !sceneState?.height) {
          return;
        }

        const layers = DataStore.getInstance().getStore(
          this.sceneStateId + ".layers",
        ) as DisplayLayerState[];
        const layer = layers.find(
          (item) => item.id === this.draggingLayerId,
        ) as (DisplayLayerState & { panX?: number; panY?: number }) | undefined;
        if (
          !layer ||
          typeof layer.panX !== "number" ||
          typeof layer.panY !== "number"
        ) {
          return;
        }

        if (this.lastDragX === null || this.lastDragY === null) {
          const initialX = Number(payload?.x);
          const initialY = Number(payload?.y);
          if (!Number.isFinite(initialX) || !Number.isFinite(initialY)) {
            return;
          }

          this.lastDragX = initialX;
          this.lastDragY = initialY;
          return;
        }

        const currentX = Number(payload?.x);
        const currentY = Number(payload?.y);
        if (!Number.isFinite(currentX) || !Number.isFinite(currentY)) {
          return;
        }

        const deltaX = currentX - this.lastDragX;
        const deltaY = currentY - this.lastDragY;
        if (deltaX === 0 && deltaY === 0) {
          return;
        }

        this.lastDragX = currentX;
        this.lastDragY = currentY;

        const nextPanX = layer.panX + deltaX / sceneState.width;
        const nextPanY = layer.panY + deltaY / sceneState.height;

        executeCommand(new SetLayerFieldCommand(layer.id, "panX", nextPanX));
        executeCommand(new SetLayerFieldCommand(layer.id, "panY", nextPanY));
        DataStore.getInstance().touch(
          this.sceneStateId + ".layers.!" + layer.id,
        );
      },
    );
  }
}
