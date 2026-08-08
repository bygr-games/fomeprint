import jsx from "texsaur";
import { KTUComponent } from "fra.ktu.red-component";
import { executeCommand } from "../../../ktu/helpers/commands_manager";
import { SetFomeprintStageCommand } from "../../commands/fomeprint/set_fomeprint_stage_command";

class Stage2 extends KTUComponent {
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
    const isVisible = this.currentStage() === 2;
    const visibilityClass = isVisible ? "stage-visible" : "stage-hidden";

    return (
      <div class={`panel-container left-ui stage-panel ${visibilityClass}`}>
        <button type="button" onclick={() => this.goToThirdStage()}>
          Next
        </button>
      </div>
    );
  }

  private goToThirdStage() {
    executeCommand(new SetFomeprintStageCommand(3));
  }
}

export function Stage2Component(props: { binding?: string }): Element {
  return new Stage2(props);
}

customElements.define("stage-2-component", Stage2);
