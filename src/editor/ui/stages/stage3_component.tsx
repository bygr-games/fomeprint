import jsx from "texsaur";
import { KTUComponent } from "fra.ktu.red-component";

class Stage3 extends KTUComponent {
  constructor(props: { binding?: string }) {
    super({ binding: props.binding ?? "fomeprint.stage" });
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
    const isVisible = this.currentStage() === 3;
    const visibilityClass = isVisible ? "stage-visible" : "stage-hidden";

    return (
      <div
        class={`panel-container left-ui stage-panel ${visibilityClass}`}
      ></div>
    );
  }
}

export function Stage3Component(props: { binding?: string }): Element {
  return new Stage3(props);
}

customElements.define("stage-3-component", Stage3);
