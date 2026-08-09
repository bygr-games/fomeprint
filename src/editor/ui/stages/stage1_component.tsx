import jsx from "texsaur";
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

class Stage1 extends KTUComponent {
  private readonly adjustmentSteps = [0.2, 0.4, 0.6, 0.8, 1, 1.5, 3, 6, 12];

  constructor(props: { binding?: string }) {
    const baseBinding = props.binding ?? "fomeprint.stage";
    super({ binding: `${baseBinding},activeThingId,editorScene.layers` });
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

    return (
      <div class={`panel-container left-ui stage-panel ${visibilityClass}`}>
        <button type="button" onclick={() => this.snapshotCameraLayer()}>
          Snapshot Camera to Video Layer
        </button>
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
        </div>
      </div>
    );
  }

  private snapshotCameraLayer() {
    executeCommand(new SnapshotCameraToVideoLayerCommand("editorScene"));
  }

  private adjustBrightness(delta: number) {
    this.adjustAdjustmentField("brightness", delta);
  }

  private adjustContrast(delta: number) {
    this.adjustAdjustmentField("contrast", delta);
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
}

export function Stage1Component(props: { binding?: string }): Element {
  return new Stage1(props);
}

customElements.define("stage-1-component", Stage1);
