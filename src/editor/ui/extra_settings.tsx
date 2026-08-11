import jsx from "./jsx";
import { DataStore, KTUComponent } from "fra.ktu.red-component";
import { DebugComponent } from "./debug_component";
import { AdjustmentBrightnessControlComponent } from "./controls/adjustment_brightness_control";
import { AdjustmentContrastControlComponent } from "./controls/adjustment_contrast_control";
import { BayerPixelSizeControlComponent } from "./controls/bayer_pixel_size_control";
import { getShaderParentLayerId } from "../helpers/active_helper";

class ExtraSettings extends KTUComponent {
  constructor(props: { binding?: string }) {
    super(props);
  }

  render(): Element {
    console.log("ExtraSettings render, binding:", this.bindingData);
    return (
      <div class="extra-settings">
        <nav class="extra-settings-menu" aria-label="Extra settings menu">
          <AdjustmentBrightnessControlComponent
            binding={
              "editorScene.layers.!" +
              getShaderParentLayerId(
                this.bindingData["fomeprint.adjustmentShaderId"],
              ) +
              ".shaders.!" +
              DataStore.getInstance().getStore("fomeprint.adjustmentShaderId")
            }
          />
          <AdjustmentContrastControlComponent
            binding={
              "editorScene.layers.!" +
              getShaderParentLayerId(
                this.bindingData["fomeprint.adjustmentShaderId"],
              ) +
              ".shaders.!" +
              DataStore.getInstance().getStore("fomeprint.adjustmentShaderId")
            }
          />
          <BayerPixelSizeControlComponent
            binding={
              "editorScene.shaders.!" +
              DataStore.getInstance().getStore(
                "fomeprint.bayerDitheringShaderId",
              )
            }
          />
          <DebugComponent />
        </nav>
        <div class="extra-settings-error-messages">
          {DataStore.getInstance()
            .getStore("fomeprint.errorMessages")
            ?.map((message: string) => (
              <div class="error-message">{message}</div>
            ))}
        </div>
      </div>
    );
  }
}

export function ExtraSettingsComponent(props: { binding?: string }): Element {
  return new ExtraSettings(props);
}

customElements.define("extra-settings", ExtraSettings);
