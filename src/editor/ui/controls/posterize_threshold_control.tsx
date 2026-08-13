import jsx from "../jsx";
import {
  DataStore,
  KTUComponent,
  type PosterizeShaderState,
} from "fra.ktu.red-component";
import { executeCommand } from "../../../ktu/helpers/commands_manager";
import { SetShaderFieldCommand } from "../../commands/shaders/set_shader_field_command";
import { getThingById } from "../../helpers/active_helper";

class PosterizeThresholdControl extends KTUComponent {
  private readonly thresholdSteps = [
    0.5, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2, 0.15, 0.1,
  ];

  constructor(props: { binding?: string }) {
    super(props);
  }

  render(): Element {
    const currentIndex = this.getThresholdIndex();
    return (
      <div class="stage-control-row">
        <span class="stage-control-label">Threshold Level</span>
        <button type="button" onclick={() => this.adjustThreshold(-1)}>
          -
        </button>
        <span class="stage-control-value">{currentIndex + 1}</span>
        <button type="button" onclick={() => this.adjustThreshold(1)}>
          +
        </button>
      </div>
    );
  }

  private adjustThreshold(delta: number) {
    const shader = this.getTargetShader();
    if (!shader) {
      return;
    }

    const currentIndex = this.getThresholdIndex();
    const nextIndex = Math.max(
      0,
      Math.min(this.thresholdSteps.length - 1, currentIndex + delta),
    );

    executeCommand(
      new SetShaderFieldCommand(
        shader.id,
        "threshold",
        this.thresholdSteps[nextIndex],
        "editorScene.shaders",
      ),
    );
  }

  private getThresholdIndex(): number {
    const shader = this.getTargetShader();
    if (!shader) {
      return this.thresholdSteps.indexOf(0.5);
    }

    const current = Number(shader.threshold);
    if (!Number.isFinite(current)) {
      return this.thresholdSteps.indexOf(0.5);
    }

    let closestIndex = 0;
    let closestDistance = Math.abs(this.thresholdSteps[0] - current);

    for (let i = 1; i < this.thresholdSteps.length; i++) {
      const distance = Math.abs(this.thresholdSteps[i] - current);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = i;
      }
    }

    return closestIndex;
  }

  private getTargetShader(): PosterizeShaderState | null {
    const shaderId = DataStore.getInstance().getStore(
      "fomeprint.posterizeShaderId",
    );
    const target = getThingById(shaderId);
    if (!target) {
      return null;
    }

    return target as PosterizeShaderState;
  }
}

export function PosterizeThresholdControlComponent(props: {
  binding?: string;
}): Element {
  return new PosterizeThresholdControl(props);
}

customElements.define("posterize-threshold-control", PosterizeThresholdControl);
