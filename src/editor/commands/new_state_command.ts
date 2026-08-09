import {
  BackgroundLayer,
  CameraLayer,
  DataStore,
  getStartingName,
  BnwShader,
  BayerDitheringShader,
  AdjustmentShader,
} from "fra.ktu.red-component";
import { type ICommand } from "./icommand";
import { clearCommands, clearRedo } from "../../ktu/helpers/commands_manager";
import { type SceneState } from "fra.ktu.red-component";
import { touchThingsById } from "../helpers/active_helper";

export class NewStateCommand implements ICommand {
  historyLabel = "NewStateCommand";
  undoable?: boolean | undefined = false;
  payload?: SceneState;
  constructor(payload?: SceneState) {
    this.payload = payload;
  }
  execute(): void {
    try {
      const autosavedState = window.localStorage.getItem("autosavedState");
      if (autosavedState) {
        const parsedState = JSON.parse(autosavedState);
        if (parsedState?.data) {
          window.localStorage.setItem(
            "lastSessionState",
            JSON.stringify(autosavedState),
          );
        }
      }
    } catch (e) {
      console.error("Error loading autosaved state:", e);
    }
    const adjustmentShader = AdjustmentShader.getDefaultState("editorScene");
    adjustmentShader.contrast = 4;
    adjustmentShader.brightness = 4;

    const cameraLayer = CameraLayer.getDefaultState("editorScene");
    cameraLayer.hFlip = true;
    cameraLayer.fillCanvas = true;
    cameraLayer.shaders = [adjustmentShader];

    const ditheringShader = BayerDitheringShader.getDefaultState("editorScene");
    ditheringShader.pixelSize = 3;
    ditheringShader.levels = 2;
    ditheringShader.matrixSize = 32;

    const state: SceneState = {
      name: getStartingName(),
      width: 1000,
      height: 1000,
      duration: 1,
      layers: [
        BackgroundLayer.getDefaultState("editorScene", "black"),
        cameraLayer,
      ],
      shaders: [BnwShader.getDefaultState("editorScene"), ditheringShader],
      modulators: [],
      signals: [],
      assets: {},
      counter: 0,
    };
    clearCommands();
    clearRedo();
    const activeThingId = DataStore.getInstance().getStore("activeThingId");
    DataStore.getInstance().setStore("activeThingId", null);
    touchThingsById(activeThingId);
    DataStore.getInstance().setStore(
      "editorScene",
      this.payload ? this.payload : state,
    );
  }
  revert(): void {}
}
