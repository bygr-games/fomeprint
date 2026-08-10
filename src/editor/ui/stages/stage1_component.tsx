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
import { SetShaderFieldCommand } from "../../commands/shaders/set_shader_field_command";
import {
  syncLayerBoundingBoxesByActiveThingId,
  touchThingsById,
} from "../../helpers/active_helper";

class Stage1 extends KTUComponent {
  private readonly adjustmentSteps = [0.2, 0.4, 0.6, 0.8, 1, 1.5, 3, 6, 12];
  private loadStatusMessage = "";
  private cameraDeviceIds: string[] = [];
  private currentCameraDeviceId: string | null = null;
  private isChangingCamera = false;

  constructor(props: { binding?: string }) {
    const baseBinding = props.binding ?? "fomeprint.stage";
    super({ binding: `${baseBinding},activeThingId,editorScene.layers` });
    void this.refreshCameraDevices();

    if (navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener("devicechange", () => {
        void this.refreshCameraDevices();
      });
    }
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
    const canChangeCamera = this.cameraDeviceIds.length > 1;

    return (
      <div class={`panel-container left-ui stage-panel ${visibilityClass}`}>
        <button type="button" onclick={() => this.snapshotCameraLayer()}>
          Snapshot Camera to Video Layer
        </button>
        <button
          type="button"
          onclick={() => void this.changeCamera()}
          disabled={!canChangeCamera || this.isChangingCamera}
        >
          {this.isChangingCamera ? "Switching Camera..." : "Change Camera"}
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
        </div>
      </div>
    );
  }

  private snapshotCameraLayer() {
    executeCommand(new SnapshotCameraToVideoLayerCommand("editorScene"));
  }

  private async refreshCameraDevices(): Promise<void> {
    if (!navigator.mediaDevices?.enumerateDevices) {
      this.cameraDeviceIds = [];
      this.currentCameraDeviceId = null;
      this.reRender();
      return;
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.cameraDeviceIds = this.getNormalizedCameraDeviceIds(devices);

      const runtimeVideo = this.getRuntimeCameraVideoElement();
      const runtimeStream = this.getMediaStream(runtimeVideo?.srcObject);
      const runtimeDeviceId = runtimeStream
        ?.getVideoTracks()[0]
        ?.getSettings().deviceId;

      if (
        typeof runtimeDeviceId === "string" &&
        this.cameraDeviceIds.includes(runtimeDeviceId)
      ) {
        this.currentCameraDeviceId = runtimeDeviceId;
      } else if (
        this.currentCameraDeviceId &&
        this.cameraDeviceIds.includes(this.currentCameraDeviceId)
      ) {
        // Keep previously known camera id.
      } else {
        this.currentCameraDeviceId = this.cameraDeviceIds[0] ?? null;
      }
    } catch (error) {
      console.warn("Could not enumerate camera devices", error);
      this.cameraDeviceIds = [];
      this.currentCameraDeviceId = null;
    }

    this.reRender();
  }

  private async changeCamera(): Promise<void> {
    if (
      this.isChangingCamera ||
      !navigator.mediaDevices?.getUserMedia ||
      this.cameraDeviceIds.length <= 1
    ) {
      return;
    }

    const runtimeVideo = this.getRuntimeCameraVideoElement();
    if (!runtimeVideo) {
      console.warn("Camera layer runtime video is not ready");
      return;
    }

    this.isChangingCamera = true;
    this.reRender();

    try {
      const currentStream = this.getMediaStream(runtimeVideo.srcObject);
      const currentTrack = currentStream?.getVideoTracks()[0];
      const currentTrackDeviceId = currentTrack?.getSettings?.().deviceId;
      const currentDeviceId =
        typeof currentTrackDeviceId === "string" && currentTrackDeviceId
          ? currentTrackDeviceId
          : this.currentCameraDeviceId;

      const currentIndex = currentDeviceId
        ? this.cameraDeviceIds.findIndex((id) => id === currentDeviceId)
        : -1;
      const nextDeviceId = this.getNextCameraDeviceId(currentIndex);
      if (!nextDeviceId) {
        return;
      }

      const previousStream = this.getMediaStream(runtimeVideo.srcObject);
      const nextStream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: nextDeviceId },
        },
        audio: false,
      });

      runtimeVideo.srcObject = nextStream;
      await runtimeVideo.play().catch(() => undefined);

      previousStream
        ?.getTracks()
        .forEach((track: MediaStreamTrack) => track.stop());

      this.currentCameraDeviceId = nextDeviceId;
      await this.refreshCameraDevices();
    } catch (error) {
      console.error("Failed to switch camera", error);
    } finally {
      this.isChangingCamera = false;
      this.reRender();
    }
  }

  private getRuntimeCameraVideoElement(): HTMLVideoElement | null {
    const sceneState = DataStore.getInstance().getStore("editorScene") as
      | SceneState
      | undefined;
    if (!sceneState) {
      return null;
    }

    const cameraLayer = sceneState.layers.find(
      (layer) => layer.type === "camera",
    );
    if (!cameraLayer) {
      return null;
    }

    const runtimeLayers = DataStore.getInstance().getStore(
      "instances.editorScene.layers",
    ) as
      | Array<{
          id: number;
          mainSprite?: {
            texture?: {
              source?: {
                resource?: HTMLVideoElement;
              };
            };
          };
        }>
      | undefined;

    const runtimeCameraLayer = runtimeLayers?.find(
      (layer) => layer.id === cameraLayer.id,
    );

    return runtimeCameraLayer?.mainSprite?.texture?.source?.resource ?? null;
  }

  private getNormalizedCameraDeviceIds(devices: MediaDeviceInfo[]): string[] {
    const allVideoInputIds = devices
      .filter((device) => device.kind === "videoinput")
      .map((device) => device.deviceId)
      .filter((deviceId) => typeof deviceId === "string" && deviceId);

    const preferredVideoInputIds = allVideoInputIds.filter(
      (deviceId) => deviceId !== "default" && deviceId !== "communications",
    );

    const sourceIds =
      preferredVideoInputIds.length > 0
        ? preferredVideoInputIds
        : allVideoInputIds;

    return [...new Set(sourceIds)];
  }

  private getNextCameraDeviceId(currentIndex: number): string | null {
    const cameraCount = this.cameraDeviceIds.length;
    if (cameraCount === 0) {
      return null;
    }

    if (cameraCount === 1) {
      return this.cameraDeviceIds[0] ?? null;
    }

    const safeCurrentIndex =
      currentIndex >= 0 && currentIndex < cameraCount ? currentIndex : -1;
    const fallbackStart = safeCurrentIndex >= 0 ? safeCurrentIndex : 0;

    for (let step = 1; step <= cameraCount; step++) {
      const candidateIndex = (fallbackStart + step) % cameraCount;
      if (candidateIndex !== safeCurrentIndex) {
        return this.cameraDeviceIds[candidateIndex] ?? null;
      }
    }

    return null;
  }

  private getMediaStream(
    mediaProvider: MediaProvider | null | undefined,
  ): MediaStream | null {
    if (mediaProvider instanceof MediaStream) {
      return mediaProvider;
    }
    return null;
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
