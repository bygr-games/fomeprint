import jsx from "./jsx";
import { DataStore, KTUComponent } from "fra.ktu.red-component";
import { AdjustmentBrightnessControlComponent } from "./controls/adjustment_brightness_control";
import { AdjustmentContrastControlComponent } from "./controls/adjustment_contrast_control";
import { BayerPixelSizeControlComponent } from "./controls/bayer_pixel_size_control";
import { PosterizeThresholdControlComponent } from "./controls/posterize_threshold_control";
import { getShaderParentLayerId } from "../helpers/active_helper";
import { PAPER_SIZES } from "../helpers/paper_helper";
import { executeCommand } from "../../ktu/helpers/commands_manager";
import { UpdateEditorSceneSizeForAspectRatioCommand } from "../commands/fomeprint/update_editor_scene_size_for_aspect_ratio_command";
import { SetDitherThresholdModeCommand } from "../commands/shaders/set_dither_threshold_mode_command";

class ExtraSettings extends KTUComponent {
  constructor(props: { binding?: string }) {
    super(props);
  }

  render(): Element {
    console.log("ExtraSettings render, binding:", this.bindingData);
    return (
      <div class="extra-settings">
        <div class="extra-settings-content">
          <h3 class="extra-settings-title">Extra Settings</h3>
          <nav class="extra-settings-menu" aria-label="Extra settings menu">
            <div class="stage-control-row">
              <label
                for="paper-size-select"
                class="stage-control-label stage3-paper-size-label"
              >
                Paper Size
              </label>
              <select
                id="paper-size-select"
                class="stage3-paper-size-select"
                onchange={(event: Event) => {
                  const target = event.target as HTMLSelectElement | null;
                  if (!target) {
                    return;
                  }
                  this.handlePaperSizeChange(target.value);
                }}
              >
                {PAPER_SIZES.map((paperSize) => (
                  <option
                    value={paperSize.value}
                    selected={
                      paperSize.value ===
                      DataStore.getInstance().getStore(
                        "fomeprint.selectedPaper",
                      )
                    }
                  >
                    {paperSize.label}
                  </option>
                ))}
              </select>
            </div>
            <div class="stage-control-row">
              <label for="dither-threshold-toggle" class="stage-control-label">
                Dither/Threshold
              </label>
              <input
                id="dither-threshold-toggle"
                class="extra-settings-toggle"
                type="checkbox"
                checked={this.isThresholdMode()}
                onchange={() => this.toggleDitherThresholdMode()}
              />
            </div>
            {!this.isThresholdMode() && (
              <AdjustmentBrightnessControlComponent
                binding={
                  "editorScene.layers.!" +
                  getShaderParentLayerId(
                    this.bindingData["fomeprint.adjustmentShaderId"],
                  ) +
                  ".shaders.!" +
                  DataStore.getInstance().getStore(
                    "fomeprint.adjustmentShaderId",
                  )
                }
              />
            )}
            {!this.isThresholdMode() && (
              <AdjustmentContrastControlComponent
                binding={
                  "editorScene.layers.!" +
                  getShaderParentLayerId(
                    this.bindingData["fomeprint.adjustmentShaderId"],
                  ) +
                  ".shaders.!" +
                  DataStore.getInstance().getStore(
                    "fomeprint.adjustmentShaderId",
                  )
                }
              />
            )}
            {!this.isThresholdMode() && (
              <BayerPixelSizeControlComponent
                binding={
                  "editorScene.shaders.!" +
                  DataStore.getInstance().getStore(
                    "fomeprint.bayerDitheringShaderId",
                  )
                }
              />
            )}
            {this.isThresholdMode() && (
              <PosterizeThresholdControlComponent
                binding={
                  "editorScene.shaders.!" +
                  DataStore.getInstance().getStore(
                    "fomeprint.posterizeShaderId",
                  )
                }
              />
            )}
          </nav>
          <h3 class="extra-settings-title extra-settings-output-log-title">
            Output Log
          </h3>
          <div class="extra-settings-error-messages">
            {DataStore.getInstance()
              .getStore("fomeprint.errorMessages")
              ?.map((message: string) => (
                <div class="error-message">{message}</div>
              ))}
          </div>
        </div>
      </div>
    );
  }
  private handlePaperSizeChange(value: string) {
    const selected = PAPER_SIZES.find((paperSize) => paperSize.value === value);
    if (!selected) {
      return;
    }

    DataStore.getInstance().setStore("fomeprint.paperSize", selected.value);

    executeCommand(
      new UpdateEditorSceneSizeForAspectRatioCommand(selected.aspectRatio),
    );
  }
  private toggleDitherThresholdMode() {
    executeCommand(
      new SetDitherThresholdModeCommand(
        this.isThresholdMode() ? "dither" : "threshold",
        "editorScene",
      ),
    );
    this.reRender();
  }

  private isThresholdMode(): boolean {
    const shaders = DataStore.getInstance().getStore("editorScene.shaders") as
      | Array<{ type?: string; visible?: boolean }>
      | undefined;
    const posterizeShader = shaders?.find((item) => item.type === "posterize");
    return posterizeShader?.visible === true;
  }
}

export function ExtraSettingsComponent(props: { binding?: string }): Element {
  return new ExtraSettings(props);
}

customElements.define("extra-settings", ExtraSettings);
