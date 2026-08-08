import { DataStore } from "fra.ktu.red-component";
import type { ICommand } from "../icommand";

export class SetFomeprintStageCommand implements ICommand {
  historyLabel = "SetFomeprintStageCommand";
  undoable?: boolean = false;

  constructor(private readonly stage: 1 | 2 | 3) {}

  execute(): void {
    DataStore.getInstance().setStore("fomeprint.stage", this.stage);
  }

  revert(): void {}
}
