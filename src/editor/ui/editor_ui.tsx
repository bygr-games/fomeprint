import jsx from "texsaur";
import { KTUComponent } from "fra.ktu.red-component";
import { DebugComponent } from "./debug_component";
import { HeaderComponent } from "./header_component";
import { Stage1Component } from "./stages/stage1_component";
import { Stage2Component } from "./stages/stage2_component";
import { Stage3Component } from "./stages/stage3_component";

class EditorUI extends KTUComponent {
  constructor(props: { binding?: string }) {
    super(props);
  }

  render(): Element {
    return (
      <div class="editor-ui">
        <HeaderComponent binding="fomeprint.stage" />
        <Stage1Component binding="fomeprint.stage" />
        <Stage2Component binding="fomeprint.stage" />
        <Stage3Component binding="fomeprint.stage" />
        <DebugComponent />
      </div>
    );
  }

  toggleHide() {
    document.querySelector(".editor-ui")?.classList.toggle("hidden");
  }
}

export function EditorUIComponent(props: { binding?: string }): Element {
  return new EditorUI(props);
}

customElements.define("editor-ui", EditorUI);
