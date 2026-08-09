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
