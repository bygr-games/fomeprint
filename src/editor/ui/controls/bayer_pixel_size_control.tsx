import jsx from "../jsx";
import {
  DataStore,
  KTUComponent,
  type BayerDitheringShaderState,
} from "fra.ktu.red-component";
import { executeCommand } from "../../../ktu/helpers/commands_manager";
import { SetShaderFieldCommand } from "../../commands/shaders/set_shader_field_command";
import { getThingById } from "../../helpers/active_helper";

class BayerPixelSizeControl extends KTUComponent {
  constructor(props: { binding?: string }) {
    super(props);
  }

  render(): Element {
    const pixelSize = this.getBayerPixelSize();
    return (
      <div class="stage-control-row">
        <span class="stage-control-label">Bayer Pixel Size</span>
        <button type="button" onclick={() => this.adjustBayerPixelSize(-1)}>
          -
        </button>
        <span class="stage-control-value">{pixelSize}</span>
        <button type="button" onclick={() => this.adjustBayerPixelSize(1)}>
          +
        </button>
      </div>
    );
  }

  private adjustBayerPixelSize(delta: number) {
    const shader = this.getTargetShader();
    if (!shader) {
      return;
    }

    const current = Number(shader.pixelSize);
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

  private getBayerPixelSize(): number {
    const shader = this.getTargetShader();
    if (!shader) {
      return 1;
    }

    const pixelSize = Number(shader.pixelSize);
    if (!Number.isFinite(pixelSize)) {
      return 1;
    }

    return pixelSize;
  }

  private getTargetShader(): BayerDitheringShaderState | null {
    const shaderId = DataStore.getInstance().getStore(
      "fomeprint.bayerDitheringShaderId",
    );
    const target = getThingById(shaderId);
    if (!target) {
      return null;
    }

    return target as BayerDitheringShaderState;
  }
}

export function BayerPixelSizeControlComponent(props: {
  binding?: string;
}): Element {
  return new BayerPixelSizeControl(props);
}

customElements.define("bayer-pixel-size-control", BayerPixelSizeControl);
