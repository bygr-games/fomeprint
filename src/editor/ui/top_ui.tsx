import jsx from "./jsx";
import {
  DataStore,
  KTUComponent,
  type DisplayLayerState,
  type SceneState,
  type ShaderLayerState,
} from "fra.ktu.red-component";
import { DebugComponent } from "./debug_component";
import { executeCommand } from "../../ktu/helpers/commands_manager";
import { SetShaderFieldCommand } from "../commands/shaders/set_shader_field_command";
import { SetLayerFieldCommand } from "../commands/layers/set_layer_field_command";
import { IconSettings } from "../helpers/icons";

class TopUI extends KTUComponent {
  private readonly adjustmentSteps = [0.2, 0.4, 0.6, 0.8, 1, 1.5, 3, 6, 12];
  private isMenuOpen: boolean;

  constructor(props: { binding?: string }) {
    super(props);
    this.isMenuOpen = false;
  }

  render(): Element {
    const brightnessIndex = this.getAdjustmentFieldIndex("brightness");
    const contrastIndex = this.getAdjustmentFieldIndex("contrast");
    const bayerPixelSize = this.getBayerPixelSize();
    const targetCameraLayer = this.getTargetCameraLayer();
    const hFlipEnabled = targetCameraLayer?.hFlip ?? false;

    return (
      <div class="top-ui">
        <span class="header-logo">
          <img src="logo.png" alt="Fomeprint Logo" />
        </span>

        <span>
          <button
            type="button"
            class="ui-square-action-button"
            onclick={() => this.toggleMenu()}
            aria-label="Toggle menu"
            aria-expanded={this.isMenuOpen ? "true" : "false"}
          >
            {IconSettings()}
          </button>
        </span>

        {this.isMenuOpen && (
          <nav class="editor-header-menu" aria-label="Main menu">
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
              <button
                type="button"
                onclick={() => this.adjustBayerPixelSize(-1)}
              >
                -
              </button>
              <span class="stage-control-value">{bayerPixelSize}</span>
              <button
                type="button"
                onclick={() => this.adjustBayerPixelSize(1)}
              >
                +
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
            <DebugComponent />
          </nav>
        )}
      </div>
    );
  }

  private toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;
    this.reRender();
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

  private toggleCameraHFlip() {
    const layer = this.getTargetCameraLayer();
    if (!layer) {
      return;
    }

    executeCommand(new SetLayerFieldCommand(layer.id, "hFlip", !layer.hFlip));
    this.reRender();
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

export function TopUIComponent(props: { binding?: string }): Element {
  return new TopUI(props);
}

customElements.define("top-ui", TopUI);
