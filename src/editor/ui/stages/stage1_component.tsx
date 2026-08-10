import jsx from "texsaur";
import {
  clearCommands,
  clearRedo,
} from "../../../ktu/helpers/commands_manager";
import {
  DataStore,
  KTUComponent,
  type DisplayLayerState,
  type SceneState,
  type ShaderLayerState,
} from "fra.ktu.red-component";
import { executeCommand } from "../../../ktu/helpers/commands_manager";
import { SnapshotCameraToVideoLayerCommand } from "../../commands/layers/snapshot_camera_to_video_layer_command";
import { SetLayerFieldCommand } from "../../commands/layers/set_layer_field_command";
import { SetShaderFieldCommand } from "../../commands/shaders/set_shader_field_command";
import {
  syncLayerBoundingBoxesByActiveThingId,
  touchThingsById,
} from "../../helpers/active_helper";

type CameraDeviceOption = {
  id: string;
  label: string;
};

class Stage1 extends KTUComponent {
  private readonly adjustmentSteps = [0.2, 0.4, 0.6, 0.8, 1, 1.5, 3, 6, 12];
  private loadStatusMessage = "";
  private availableCameras: CameraDeviceOption[] = [];
  private isLoadingCameras = false;
  private cameraLoadErrorMessage = "";

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
    const isVisible = this.currentStage() === 1;
    const visibilityClass = isVisible ? "stage-visible" : "stage-hidden";
    const brightnessIndex = this.getAdjustmentFieldIndex("brightness");
    const contrastIndex = this.getAdjustmentFieldIndex("contrast");
    const bayerPixelSize = this.getBayerPixelSize();
    const targetCameraLayer = this.getTargetCameraLayer();
    const selectedCameraId = targetCameraLayer?.cameraId ?? "";
    const hFlipEnabled = targetCameraLayer?.hFlip ?? false;
    const cameraOptions = this.getCameraOptionsForLayer(targetCameraLayer);
    const cameraSelectDisabled =
      !targetCameraLayer || this.isLoadingCameras || cameraOptions.length === 0;

    return (
      <div class={`panel-container left-ui stage-panel ${visibilityClass}`}>
        <button type="button" onclick={() => this.snapshotCameraLayer()}>
          Snapshot Camera to Video Layer
        </button>
        <div class="stage1-load-row">
          <button type="button" onclick={() => this.openLoadFilePicker()}>
            Load
          </button>
          <input
            id="stage1-load-input"
            class="stage1-load-input"
            type="file"
            accept=".fomeprint.red,application/json"
            onchange={(event) => this.onLoadFileChange(event)}
          />
        </div>
        {this.loadStatusMessage && (
          <div class="stage1-load-status">{this.loadStatusMessage}</div>
        )}
        <div class="stage-controls-group">
          <div class="stage-control-row">
            <span class="stage-control-label">Brightness</span>
            <button type="button" onclick={() => this.adjustBrightness(-1)}>
              -
            </button>
            <span class="stage-control-value">{brightnessIndex + 1}</span>
            <button type="button" onclick={() => this.adjustBrightness(1)}>
              +
            </button>
          </div>
          <div class="stage-control-row">
            <span class="stage-control-label">Contrast</span>
            <button type="button" onclick={() => this.adjustContrast(-1)}>
              -
            </button>
            <span class="stage-control-value">{contrastIndex + 1}</span>
            <button type="button" onclick={() => this.adjustContrast(1)}>
              +
            </button>
          </div>
          <div class="stage-control-row">
            <span class="stage-control-label">Bayer Pixel Size</span>
            <button type="button" onclick={() => this.adjustBayerPixelSize(-1)}>
              -
            </button>
            <span class="stage-control-value">{bayerPixelSize}</span>
            <button type="button" onclick={() => this.adjustBayerPixelSize(1)}>
              +
            </button>
          </div>
          <div class="stage-control-row">
            <span class="stage-control-label">Camera</span>
            <select
              class="stage1-camera-select"
              disabled={cameraSelectDisabled}
              onchange={(event: Event) => {
                const target = event.target as HTMLSelectElement | null;
                if (!target) {
                  return;
                }
                this.onCameraSelectionChange(target.value);
              }}
            >
              {cameraOptions.map((camera) => (
                <option
                  value={camera.id}
                  selected={camera.id === selectedCameraId}
                >
                  {camera.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onclick={() => void this.refreshAvailableCameras()}
              disabled={this.isLoadingCameras}
            >
              {this.isLoadingCameras ? "..." : "Refresh"}
            </button>
          </div>
          <div class="stage-control-row">
            <span class="stage-control-label">H Flip</span>
            <button
              type="button"
              onclick={() => this.toggleCameraHFlip()}
              disabled={!targetCameraLayer}
            >
              {hFlipEnabled ? "On" : "Off"}
            </button>
          </div>
          {this.cameraLoadErrorMessage && (
            <div class="stage1-load-status">{this.cameraLoadErrorMessage}</div>
          )}
        </div>
      </div>
    );
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

    this.isLoadingCameras = true;
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
      this.isLoadingCameras = false;
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

  private toggleCameraHFlip() {
    const layer = this.getTargetCameraLayer();
    if (!layer) {
      return;
    }

    executeCommand(new SetLayerFieldCommand(layer.id, "hFlip", !layer.hFlip));
    this.reRender();
  }

  private getCameraOptionsForLayer(
    layer: (DisplayLayerState & { cameraId?: string }) | null,
  ): CameraDeviceOption[] {
    const options = [...this.availableCameras];
    const selectedCameraId =
      typeof layer?.cameraId === "string" ? layer.cameraId : "";

    if (
      selectedCameraId &&
      !options.some((camera) => camera.id === selectedCameraId)
    ) {
      options.unshift({
        id: selectedCameraId,
        label: "Current Camera",
      });
    }

    if (options.length === 0) {
      options.push({
        id: "",
        label: this.isLoadingCameras
          ? "Loading cameras..."
          : "No cameras found",
      });
    }

    return options;
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

  private adjustBrightness(delta: number) {
    this.adjustAdjustmentField("brightness", delta);
  }

  private adjustContrast(delta: number) {
    this.adjustAdjustmentField("contrast", delta);
  }

  private adjustBayerPixelSize(delta: number) {
    const shader = this.getBayerDitheringShader();
    if (!shader) {
      return;
    }

    const current = this.getBayerPixelSize();
    const next = Math.max(1, Math.min(5, current + delta));

    executeCommand(
      new SetShaderFieldCommand(
        shader.id,
        "pixelSize",
        next,
        "editorScene.shaders",
      ),
    );

    this.reRender();
  }

  private adjustAdjustmentField(
    field: "brightness" | "contrast",
    delta: number,
  ) {
    const target = this.getTargetAdjustmentShader();
    if (!target) {
      return;
    }

    const currentIndex = this.getAdjustmentFieldIndex(field);
    const nextIndex = Math.max(
      0,
      Math.min(this.adjustmentSteps.length - 1, currentIndex + delta),
    );
    const nextValue = this.adjustmentSteps[nextIndex];

    executeCommand(
      new SetShaderFieldCommand(
        target.shader.id,
        field,
        nextValue,
        `editorScene.layers.!${target.layer.id}.shaders`,
      ),
    );

    this.reRender();
  }

  private getAdjustmentFieldIndex(field: "brightness" | "contrast"): number {
    const target = this.getTargetAdjustmentShader();
    if (!target) {
      return this.adjustmentSteps.indexOf(1);
    }

    const current = Number((target.shader as Record<string, unknown>)[field]);
    if (!Number.isFinite(current)) {
      return this.adjustmentSteps.indexOf(1);
    }

    let closestIndex = 0;
    let closestDistance = Math.abs(this.adjustmentSteps[0] - current);

    for (let i = 1; i < this.adjustmentSteps.length; i++) {
      const distance = Math.abs(this.adjustmentSteps[i] - current);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = i;
      }
    }

    return closestIndex;
  }

  private getTargetAdjustmentShader(): {
    layer: DisplayLayerState & { shaders: ShaderLayerState[] };
    shader: ShaderLayerState;
  } | null {
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
    ) as (DisplayLayerState & { shaders?: ShaderLayerState[] }) | undefined;

    const candidateLayers: Array<
      DisplayLayerState & { shaders?: ShaderLayerState[] }
    > = [];

    if (activeLayer?.type === "video" || activeLayer?.type === "camera") {
      candidateLayers.push(activeLayer);
    }

    for (const layer of [...scene.layers].reverse()) {
      if (layer.type === "video" || layer.type === "camera") {
        if (!candidateLayers.some((candidate) => candidate.id === layer.id)) {
          candidateLayers.push(
            layer as DisplayLayerState & { shaders?: ShaderLayerState[] },
          );
        }
      }
    }

    for (const layer of candidateLayers) {
      const shaders = Array.isArray(layer.shaders) ? layer.shaders : [];
      const adjustmentShader = shaders.find(
        (shader) => shader.type === "adjustment",
      ) as ShaderLayerState | undefined;

      if (adjustmentShader) {
        return {
          layer: layer as DisplayLayerState & { shaders: ShaderLayerState[] },
          shader: adjustmentShader,
        };
      }
    }

    return null;
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

  private getBayerPixelSize(): number {
    const shader = this.getBayerDitheringShader();
    if (!shader) {
      return 3;
    }

    const raw = Number((shader as Record<string, unknown>).pixelSize);
    const fallback = 3;
    if (!Number.isFinite(raw)) {
      return fallback;
    }

    const rounded = Math.round(raw);
    return Math.max(1, Math.min(5, rounded));
  }

  private getBayerDitheringShader(): ShaderLayerState | null {
    const shaders = DataStore.getInstance().getStore("editorScene.shaders") as
      | ShaderLayerState[]
      | undefined;
    if (!Array.isArray(shaders)) {
      return null;
    }

    return shaders.find((shader) => shader.type === "bayer_dithering") ?? null;
  }
}

export function Stage1Component(props: { binding?: string }): Element {
  return new Stage1(props);
}

customElements.define("stage-1-component", Stage1);
