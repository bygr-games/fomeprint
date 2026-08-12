import jsx from "./jsx";
import { KTUComponent } from "fra.ktu.red-component";
import { Stage1Component } from "./stages/stage1_component";
import { Stage2Component } from "./stages/stage2_component";
import { Stage3Component } from "./stages/stage3_component";

class BottomUI extends KTUComponent {
  constructor(props: { binding?: string }) {
    super(props);
  }

  render(): Element {
    return (
      <div class="bottom-ui">
        <Stage1Component binding="fomeprint.stage" />
        <Stage2Component binding="fomeprint.stage,fomeprint.store.selectedCategory,fomeprint.store.uploadedAssets" />
        <Stage3Component binding="fomeprint.stage" />
      </div>
    );
  }
}

export function BottomUIComponent(props: { binding?: string }): Element {
  return new BottomUI(props);
}

customElements.define("bottom-ui", BottomUI);
