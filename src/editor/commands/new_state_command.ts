import {
  BackgroundLayer,
  CameraLayer,
  DataStore,
  getStartingName,
  BnwShader,
  BayerDitheringShader,
  AdjustmentShader,
  PosterizeShader,
} from "fra.ktu.red-component";
import { type ICommand } from "./icommand";
import { clearCommands, clearRedo } from "../../ktu/helpers/commands_manager";
import { type SceneState } from "fra.ktu.red-component";
import {
  syncLayerBoundingBoxesByActiveThingId,
  touchThingsById,
} from "../helpers/active_helper";
import { refreshAvailableCameras } from "../managers/camera_manager";
import { getViewportFittedSize } from "../helpers/viewport_fit";

const ADJUSTMENT_BRIGHTNESS_STORAGE_KEY = "fomeprint.adjustment.brightness";
const ADJUSTMENT_CONTRAST_STORAGE_KEY = "fomeprint.adjustment.contrast";
const BAYER_PIXEL_SIZE_STORAGE_KEY = "fomeprint.bayer.pixelSize";
const POSTERIZE_THRESHOLD_STORAGE_KEY = "fomeprint.posterize.threshold";
const DITHER_THRESHOLD_MODE_STORAGE_KEY = "fomeprint.ditherThreshold.mode";

function readStoredNumber(key: string): number | null {
  const value = window.localStorage.getItem(key);
  if (value === null) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readStoredDitherThresholdMode(): "dither" | "threshold" {
  const value = window.localStorage.getItem(DITHER_THRESHOLD_MODE_STORAGE_KEY);
  return value === "threshold" ? "threshold" : "dither";
}

export class NewStateCommand implements ICommand {
  historyLabel = "NewStateCommand";
  undoable?: boolean | undefined = false;
  payload?: SceneState;

  constructor(payload?: SceneState) {
    this.payload = payload;
  }
  execute(): void {
    refreshAvailableCameras();

    DataStore.getInstance().setStore("fomeprint.errorMessages", []);

    const adjustmentShader = AdjustmentShader.getDefaultState("editorScene");
    adjustmentShader.contrast =
      readStoredNumber(ADJUSTMENT_CONTRAST_STORAGE_KEY) ?? 3;
    adjustmentShader.brightness =
      readStoredNumber(ADJUSTMENT_BRIGHTNESS_STORAGE_KEY) ?? 3;

    const cameraLayer = CameraLayer.getDefaultState("editorScene");
    cameraLayer.hFlip = true;
    cameraLayer.fillCanvas = true;

    console.log(
      "NewStateCommand: creating new state with camera layer",
      cameraLayer,
    );

    const bnwShader = BnwShader.getDefaultState("editorScene");

    const ditheringShader = BayerDitheringShader.getDefaultState("editorScene");
    ditheringShader.pixelSize =
      readStoredNumber(BAYER_PIXEL_SIZE_STORAGE_KEY) ?? 3;
    ditheringShader.levels = 2;
    ditheringShader.matrixSize = 32;

    const posterizeShader = PosterizeShader.getDefaultState("editorScene");
    posterizeShader.levels = 2;
    posterizeShader.threshold =
      readStoredNumber(POSTERIZE_THRESHOLD_STORAGE_KEY) ?? 0.5;

    const ditherThresholdMode = readStoredDitherThresholdMode();
    const isDitherMode = ditherThresholdMode === "dither";
    ditheringShader.visible = isDitherMode;
    posterizeShader.visible = !isDitherMode;

    const defaultPaperAspectRatio = 1;
    const fittedSize = getViewportFittedSize(defaultPaperAspectRatio);

    const state: SceneState = {
      name: getStartingName(),
      width: fittedSize.width,
      height: fittedSize.height,
      duration: 1,
      layers: [
        BackgroundLayer.getDefaultState("editorScene", "white"),
        cameraLayer,
      ],
      shaders: [adjustmentShader, bnwShader, ditheringShader, posterizeShader],
      modulators: [],
      signals: [],
      assets: {},
      counter: 0,
    };
    clearCommands();
    clearRedo();
    DataStore.getInstance().setStore("fomeprint.paperSize", "50x50");
    DataStore.getInstance().setStore(
      "fomeprint.paperAspectRatio",
      defaultPaperAspectRatio,
    );

    DataStore.getInstance().setStore(
      "fomeprint.adjustmentShaderId",
      adjustmentShader.id,
    );
    DataStore.getInstance().setStore(
      "fomeprint.bayerDitheringShaderId",
      ditheringShader.id,
    );
    DataStore.getInstance().setStore(
      "fomeprint.posterizeShaderId",
      posterizeShader.id,
    );
    DataStore.getInstance().setStore("fomeprint.bnwShaderId", bnwShader.id);
    console.log("Camera layer ID:", cameraLayer.id);
    DataStore.getInstance().setStore("fomeprint.cameraLayerId", cameraLayer.id);
    DataStore.getInstance().setStore("fomeprint.videoLayerId", null);

    DataStore.getInstance().setStore("fomeprint.cameraIndex", 0);

    DataStore.getInstance().setStore(
      "fomeprint.shaderIds",
      state.shaders
        .map((shader) => "editorScene.shaders.!" + shader.id)
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
    DataStore.getInstance().touch("fomeprint.paperAspectRatio");
  }
  revert(): void {}
}
