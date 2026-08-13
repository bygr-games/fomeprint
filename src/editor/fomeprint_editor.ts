import {
  DataStore,
  EventDispatcher,
  RedViewerComponent,
  type SceneState,
} from "fra.ktu.red-component";
import { executeCommand } from "../ktu/helpers/commands_manager";
import { NewStateCommand } from "./commands/new_state_command";
import { TopUIComponent } from "./ui/top_ui";
import { BottomUIComponent } from "./ui/bottom_ui";
import { GestureManager } from "./managers/gesture_manager";
import { MouseManager } from "./managers/mouse_manager";
import { TouchManager } from "./managers/touch_manager";
import { ExtraSettingsComponent } from "./ui/extra_settings";
import { FireErrorMessageCommand } from "./commands/fomeprint/fire_error_message_command";
import { setupStore } from "./managers/store_manager";
import { getViewportFittedSize } from "./helpers/viewport_fit";

export class FomeprintEditor {
  canvasContainer: HTMLElement;
  topUIContainer: HTMLElement;
  bottomUIContainer: HTMLElement;
  extraSettingsContainer: HTMLElement;
  private readonly mouseManager: MouseManager;

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
    const aspectRatio = this.getPaperAspectRatio();
    const { width, height } = getViewportFittedSize(aspectRatio);

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

  public constructor(
    canvasContainer: HTMLElement,
    topUIContainer: HTMLElement,
    bottomUIContainer: HTMLElement,
    extraSettingsContainer: HTMLElement,
  ) {
    console.log(
      "Initializing FomeprintEditor with autosaved state:",
      window.localStorage.getItem("autosavedState"),
    );
    this.canvasContainer = canvasContainer;
    this.topUIContainer = topUIContainer;
    this.bottomUIContainer = bottomUIContainer;
    this.extraSettingsContainer = extraSettingsContainer;
    this.mouseManager = new MouseManager("editorScene");
    DataStore.getInstance().setStore("fomeprint.selectedPaper", "50x50");
    DataStore.getInstance().setStore("fomeprint.paperAspectRatio", 1);
    executeCommand(new NewStateCommand());

    executeCommand(new FireErrorMessageCommand("Welcome to Fomeprint!"));

    this.fitCanvasToViewport();

    this.canvasContainer.appendChild(
      RedViewerComponent({
        sceneState: "editorScene",
        resizeTo: canvasContainer,
      }),
    );

    this.topUIContainer.appendChild(
      TopUIComponent({
        binding: "fomeprint.stage",
      }),
    );
    this.bottomUIContainer.appendChild(BottomUIComponent({}));
    this.extraSettingsContainer.appendChild(
      ExtraSettingsComponent({
        binding: "fomeprint.errorMessages,fomeprint.adjustmentShaderId",
      }),
    );
    if (TouchManager.hasSeveralTouchPoints()) {
      new TouchManager("editorScene", () => this.mouseManager.resetDragState());
    } else {
      new GestureManager(this.canvasContainer, "editorScene");
    }
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
    setupStore();
  }
}
