import jsx from "../jsx";
import {
  DataStore,
  KTUComponent,
  type AdjustmentShaderState,
} from "fra.ktu.red-component";
import { executeCommand } from "../../../ktu/helpers/commands_manager";
import { SetShaderFieldCommand } from "../../commands/shaders/set_shader_field_command";
import { getThingById } from "../../helpers/active_helper";

class AdjustmentContrastControl extends KTUComponent {
  private readonly adjustmentSteps = [0.2, 0.4, 0.6, 0.8, 1, 1.5, 3, 6, 12];

  constructor(props: { binding?: string }) {
    super(props);
  }

  render(): Element {
    const currentIndex = this.getContrastIndex();
    return (
      <div class="stage-control-row">
        <span class="stage-control-label">Contrast</span>
        <button type="button" onclick={() => this.adjustContrast(-1)}>
          -
        </button>
        <span class="stage-control-value">{currentIndex + 1}</span>
        <button type="button" onclick={() => this.adjustContrast(1)}>
          +
        </button>
      </div>
    );
  }

  private adjustContrast(delta: number) {
    const target = this.getTargetShader();
    if (!target) {
      return;
    }

    const currentIndex = this.getContrastIndex();
    const nextIndex = Math.max(
      0,
      Math.min(this.adjustmentSteps.length - 1, currentIndex + delta),
    );
    const nextValue = this.adjustmentSteps[nextIndex];

    executeCommand(
      new SetShaderFieldCommand(
        target.id,
        "contrast",
        nextValue,
        `editorScene.shaders`,
      ),
    );
  }

  private getContrastIndex(): number {
    const target = this.getTargetShader();
    if (!target) {
      return this.adjustmentSteps.indexOf(1);
    }

    const current = Number(target.contrast);
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

  private getTargetShader(): AdjustmentShaderState | null {
    const shaderId = DataStore.getInstance().getStore(
      "fomeprint.adjustmentShaderId",
    );
    const target = getThingById(shaderId);
    if (!target) {
      return null;
    }

    return target as AdjustmentShaderState;
  }
}

export function AdjustmentContrastControlComponent(props: {
  binding?: string;
}): Element {
  return new AdjustmentContrastControl(props);
}

customElements.define("adjustment-contrast-control", AdjustmentContrastControl);
