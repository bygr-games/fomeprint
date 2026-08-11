import jsx from "../jsx";
import {
  clearCommands,
  clearRedo,
} from "../../../ktu/helpers/commands_manager";
import {
  DataStore,
  KTUComponent,
  type DisplayLayerState,
  type SceneState,
} from "fra.ktu.red-component";
import { executeCommand } from "../../../ktu/helpers/commands_manager";
import { SnapshotCameraToVideoLayerCommand } from "../../commands/layers/snapshot_camera_to_video_layer_command";
import { SetLayerFieldCommand } from "../../commands/layers/set_layer_field_command";
import {
  syncLayerBoundingBoxesByActiveThingId,
  touchThingsById,
} from "../../helpers/active_helper";
import { IconSnapshot, IconOpenFile, IconSwap } from "../../helpers/icons";

type CameraDeviceOption = {
  id: string;
  label: string;
};

class Stage1 extends KTUComponent {
  private loadStatusMessage = "";
  private availableCameras: CameraDeviceOption[] = [];
  private cameraLoadErrorMessage = "";
  private cameraIndex = 0;

  constructor(props: { binding?: string }) {
    const baseBinding = props.binding ?? "fomeprint.stage";
    super({ binding: `${baseBinding},activeThingId,editorScene.layers` });
    void this.refreshAvailableCameras();
  }

  defaultBinding(): Record<string, any> {
    return {
      "fomeprint.stage": 1,
    };
  }

  private currentStage(): number {
    const stage = Number(this.bindingData["fomeprint.stage"]);
    if (stage === 1 || stage === 2 || stage === 3) {
      return stage;
    }
    return 1;
  }

  render(): Element {
    if (this.currentStage() !== 1) {
      return <div></div>;
    }

    return (
      <div class="panel-container left-ui stage-panel">
        <button
          type="button"
          class="ui-square-action-button"
          onclick={() => this.openLoadFilePicker()}
        >
          {IconOpenFile()}
        </button>
        <button
          type="button"
          class="ui-square-action-button"
          onclick={() => this.snapshotCameraLayer()}
        >
          {IconSnapshot()}
        </button>
        <button
          type="button"
          class="ui-square-action-button"
          onclick={() => this.swapCamera()}
        >
          {IconSwap()}
        </button>
        <input
          id="stage1-load-input"
          class="stage1-load-input hidden"
          type="file"
          accept=".fomeprint.red,application/json"
          onchange={(event) => this.onLoadFileChange(event)}
        />
        {this.loadStatusMessage && (
          <div class="stage1-load-status">{this.loadStatusMessage}</div>
        )}
        <div class="stage-controls-group">
          {this.cameraLoadErrorMessage && (
            <div class="stage1-load-status">{this.cameraLoadErrorMessage}</div>
          )}
        </div>
      </div>
    );
  }

  private async swapCamera() {
    console.log("Swapping camera...");
    await this.refreshAvailableCameras();
    if (this.availableCameras.length === 0) {
      return;
    }

    this.cameraIndex = (this.cameraIndex + 1) % this.availableCameras.length;
    const nextCameraId = this.availableCameras[this.cameraIndex].id;
    this.onCameraSelectionChange(nextCameraId);
  }

  private async refreshAvailableCameras() {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.enumerateDevices !== "function"
    ) {
      this.availableCameras = [];
      this.cameraLoadErrorMessage = "Camera devices are not available here.";
      this.reRender();
      return;
    }

    this.cameraLoadErrorMessage = "";
    this.reRender();

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.availableCameras = devices
        .filter((device) => device.kind === "videoinput")
        .map((device, index) => ({
          id: device.deviceId,
          label: device.label || `Camera ${index + 1}`,
        }))
        .filter((camera) => camera.id.length > 0);
    } catch {
      this.availableCameras = [];
      this.cameraLoadErrorMessage = "Could not list camera devices.";
    } finally {
      this.reRender();
    }
  }

  private onCameraSelectionChange(nextCameraId: string) {
    const layer = this.getTargetCameraLayer();
    if (!layer || nextCameraId === layer.cameraId) {
      return;
    }

    executeCommand(
      new SetLayerFieldCommand(layer.id, "cameraId", nextCameraId),
    );
    this.reRender();
  }

  private snapshotCameraLayer() {
    executeCommand(new SnapshotCameraToVideoLayerCommand("editorScene"));
  }

  private openLoadFilePicker() {
    const input = this.querySelector(
      "#stage1-load-input",
    ) as HTMLInputElement | null;
    if (!input) {
      return;
    }

    this.loadStatusMessage = "";
    input.value = "";
    input.click();
    this.reRender();
  }

  private onLoadFileChange(event: Event) {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];

    if (input) {
      input.value = "";
    }

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result;
      if (typeof content !== "string") {
        this.loadStatusMessage = "Could not read selected file.";
        this.reRender();
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        this.loadStatusMessage = "Selected file is not valid JSON.";
        this.reRender();
        return;
      }

      const sceneState = this.coerceSceneState(parsed);
      if (!sceneState) {
        this.loadStatusMessage =
          "Selected file is not a valid .fomeprint.red scene.";
        this.reRender();
        return;
      }

      this.applyLoadedSceneState(sceneState);
    };

    reader.onerror = () => {
      this.loadStatusMessage = "Could not read selected file.";
      this.reRender();
    };

    reader.readAsText(file);
  }

  private coerceSceneState(value: unknown): SceneState | null {
    if (!value || typeof value !== "object") {
      return null;
    }

    const candidate = value as Partial<SceneState> & Record<string, unknown>;
    const width = Number(candidate.width);
    const height = Number(candidate.height);
    const duration = Number(candidate.duration);
    const counter = Number(candidate.counter);

    if (
      !Array.isArray(candidate.layers) ||
      !Array.isArray(candidate.shaders) ||
      !Array.isArray(candidate.modulators) ||
      !Array.isArray(candidate.signals) ||
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width <= 0 ||
      height <= 0 ||
      !Number.isFinite(duration)
    ) {
      return null;
    }

    return {
      name:
        typeof candidate.name === "string" ? candidate.name : "Loaded Scene",
      width,
      height,
      duration,
      layers: candidate.layers,
      shaders: candidate.shaders,
      modulators: candidate.modulators,
      signals: candidate.signals,
      assets:
        candidate.assets && typeof candidate.assets === "object"
          ? (candidate.assets as SceneState["assets"])
          : {},
      counter: Number.isFinite(counter) ? counter : 0,
    };
  }

  private applyLoadedSceneState(sceneState: SceneState) {
    const previousActiveThingId = Number(
      DataStore.getInstance().getStore("activeThingId"),
    );

    clearCommands();
    clearRedo();

    DataStore.getInstance().setStore("activeThingId", null);
    if (Number.isFinite(previousActiveThingId)) {
      touchThingsById(previousActiveThingId);
    }

    DataStore.getInstance().setStore("editorScene", sceneState);
    syncLayerBoundingBoxesByActiveThingId(null);

    window.localStorage.setItem(
      "autosavedState",
      JSON.stringify({
        data: sceneState,
        dataAt: Date.now(),
      }),
    );

    this.loadStatusMessage = "";
    DataStore.getInstance().setStore("fomeprint.stage", 2);
  }

  private getTargetCameraLayer():
    | (DisplayLayerState & { cameraId: string; hFlip: boolean })
    | null {
    const scene = DataStore.getInstance().getStore("editorScene") as
      | SceneState
      | undefined;
    if (!scene) {
      return null;
    }

    const activeThingId = Number(
      DataStore.getInstance().getStore("activeThingId"),
    );
    const activeLayer = scene.layers.find(
      (layer) => layer.id === activeThingId,
    ) as (DisplayLayerState & { cameraId?: string }) | undefined;

    if (activeLayer?.type === "camera") {
      return {
        ...(activeLayer as DisplayLayerState),
        cameraId:
          typeof activeLayer.cameraId === "string" ? activeLayer.cameraId : "",
        hFlip: Boolean((activeLayer as Record<string, unknown>).hFlip),
      };
    }

    const cameraLayer = [...scene.layers]
      .reverse()
      .find((layer) => layer.type === "camera") as
      | (DisplayLayerState & { cameraId?: string })
      | undefined;
    if (!cameraLayer) {
      return null;
    }

    return {
      ...(cameraLayer as DisplayLayerState),
      cameraId:
        typeof cameraLayer.cameraId === "string" ? cameraLayer.cameraId : "",
      hFlip: Boolean((cameraLayer as Record<string, unknown>).hFlip),
    };
  }
}

export function Stage1Component(props: { binding?: string }): Element {
  return new Stage1(props);
}

customElements.define("stage-1-component", Stage1);
