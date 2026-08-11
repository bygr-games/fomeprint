import jsx from "./jsx";
import {
  DataStore,
  KTUComponent,
  type AdjustmentShaderState,
  type BayerDitheringShaderState,
} from "fra.ktu.red-component";
import { DebugComponent } from "./debug_component";
import { executeCommand } from "../../ktu/helpers/commands_manager";
import { SetShaderFieldCommand } from "../commands/shaders/set_shader_field_command";
import { getShaderParentLayerId, getThingById } from "../helpers/active_helper";

class ExtraSettings extends KTUComponent {
  private readonly adjustmentSteps = [0.2, 0.4, 0.6, 0.8, 1, 1.5, 3, 6, 12];

  constructor(props: { binding?: string }) {
    super(props);
  }

  render(): Element {
    const brightnessIndex = this.getAdjustmentFieldIndex("brightness");
    const contrastIndex = this.getAdjustmentFieldIndex("contrast");
    const bayerPixelSize = this.getBayerPixelSize();

    return (
      <div class="extra-settings">
        <nav class="extra-settings-menu" aria-label="Extra settings menu">
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
          <DebugComponent />
        </nav>
      </div>
    );
  }

  private adjustBrightness(delta: number) {
    this.adjustAdjustmentField("brightness", delta);
  }

  private adjustContrast(delta: number) {
    this.adjustAdjustmentField("contrast", delta);
  }

  private adjustBayerPixelSize(delta: number) {
    const shader = getThingById(
      DataStore.getInstance().getStore("fomeprint.bayerDitheringShaderId"),
    )! as BayerDitheringShaderState;

    const current = shader.pixelSize;
    const next = Math.max(1, Math.min(5, current + delta));

    executeCommand(
      new SetShaderFieldCommand(
        shader.id,
        "pixelSize",
        next,
        "editorScene.shaders",
      ),
    );
  }

  private adjustAdjustmentField(
    field: "brightness" | "contrast",
    delta: number,
  ) {
    const target: AdjustmentShaderState = getThingById(
      DataStore.getInstance().getStore("fomeprint.adjustmentShaderI"),
    )! as AdjustmentShaderState;

    const currentIndex = this.getAdjustmentFieldIndex(field);
    const nextIndex = Math.max(
      0,
      Math.min(this.adjustmentSteps.length - 1, currentIndex + delta),
    );
    const nextValue = this.adjustmentSteps[nextIndex];

    executeCommand(
      new SetShaderFieldCommand(
        target.id,
        field,
        nextValue,
        `editorScene.layers.!${getShaderParentLayerId(target.id)}.shaders`,
      ),
    );
  }

  private getAdjustmentFieldIndex(field: "brightness" | "contrast"): number {
    const target: AdjustmentShaderState = getThingById(
      DataStore.getInstance().getStore("fomeprint.adjustmentShaderI"),
    )! as AdjustmentShaderState;
    if (!target) {
      return this.adjustmentSteps.indexOf(1);
    }

    let current = 0;
    if (field === "brightness") {
      current = target.brightness;
    } else if (field === "contrast") {
      current = target.contrast;
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

  private getBayerPixelSize(): number {
    const shader = getThingById(
      DataStore.getInstance().getStore("fomeprint.bayerDitheringShaderId"),
    )! as BayerDitheringShaderState;

    return shader.pixelSize;
  }
}

export function ExtraSettingsComponent(props: { binding?: string }): Element {
  return new ExtraSettings(props);
}

customElements.define("extra-settings", ExtraSettings);
