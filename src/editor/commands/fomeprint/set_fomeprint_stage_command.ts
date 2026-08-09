import { DataStore } from "fra.ktu.red-component";
import type { ICommand } from "../icommand";
import {
  syncLayerBoundingBoxesByActiveThingId,
  touchThingsById,
} from "../../helpers/active_helper";

export class SetFomeprintStageCommand implements ICommand {
  historyLabel = "SetFomeprintStageCommand";
  undoable?: boolean = false;

  constructor(private readonly stage: 1 | 2 | 3) {}

  execute(): void {
    const previousActiveThingId = Number(
      DataStore.getInstance().getStore("activeThingId"),
    );

    DataStore.getInstance().setStore("fomeprint.stage", this.stage);

    if (this.stage !== 3) {
      return;
    }

    DataStore.getInstance().setStore("activeThingId", null);
    syncLayerBoundingBoxesByActiveThingId(null);

    if (Number.isFinite(previousActiveThingId)) {
      touchThingsById(previousActiveThingId);
    }
  }

  revert(): void {}
}
