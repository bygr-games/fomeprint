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
import {
  syncLayerBoundingBoxesByActiveThingId,
  touchThingsById,
} from "../helpers/active_helper";
import { refreshAvailableCameras } from "../managers/camera_manager";

export class NewStateCommand implements ICommand {
  historyLabel = "NewStateCommand";
  undoable?: boolean | undefined = false;
  payload?: SceneState;
  constructor(payload?: SceneState) {
    this.payload = payload;
  }
  execute(): void {
    refreshAvailableCameras();

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
    adjustmentShader.contrast = 3;
    adjustmentShader.brightness = 3;

    const cameraLayer = CameraLayer.getDefaultState("editorScene");
    cameraLayer.hFlip = true;
    cameraLayer.fillCanvas = true;
    cameraLayer.shaders = [adjustmentShader];

    console.log(
      "NewStateCommand: creating new state with camera layer",
      cameraLayer,
    );

    const bnwShader = BnwShader.getDefaultState("editorScene");

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
        BackgroundLayer.getDefaultState("editorScene", "green"),
        cameraLayer,
      ],
      shaders: [bnwShader, ditheringShader],
      modulators: [],
      signals: [],
      assets: {},
      counter: 0,
    };
    clearCommands();
    clearRedo();
    DataStore.getInstance().setStore("fomeprint.paperSize", "50x50");
    DataStore.getInstance().setStore("fomeprint.paperAspectRatio", 1);

    DataStore.getInstance().setStore(
      "fomeprint.adjustmentShaderId",
      adjustmentShader.id,
    );
    DataStore.getInstance().setStore(
      "fomeprint.bayerDitheringShaderId",
      ditheringShader.id,
    );
    DataStore.getInstance().setStore("fomeprint.bnwShaderId", bnwShader.id);
    DataStore.getInstance().setStore("fomeprint.cameraLayerId", cameraLayer.id);
    DataStore.getInstance().setStore("fomeprint.videoLayerId", null);

    DataStore.getInstance().setStore("fomeprint.cameraIndex", 0);

    DataStore.getInstance().setStore(
      "fomeprint.shaderIds",
      state.shaders
        .map((shader) => "editorScene.shaders.!" + shader.id)
        .concat(
          cameraLayer.shaders.map(
            (shader) =>
              "editorScene.layers.!" +
              cameraLayer.id +
              ".shaders.!" +
              shader.id,
          ),
        )
        .join(","),
    );
    const activeThingId = DataStore.getInstance().getStore("activeThingId");
    DataStore.getInstance().setStore("activeThingId", null);
    touchThingsById(activeThingId);
    DataStore.getInstance().setStore(
      "editorScene",
      this.payload ? this.payload : state,
    );
    syncLayerBoundingBoxesByActiveThingId(null);
    DataStore.getInstance().setStore("fomeprint.stage", 1);
  }
  revert(): void {}
}
