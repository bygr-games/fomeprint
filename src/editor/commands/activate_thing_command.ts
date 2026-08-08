import { DataStore } from "fra.ktu.red-component";
import type { ICommand } from "./icommand";
import { touchThingsById } from "../helpers/active_helper";

export class ActivateThingCommand implements ICommand {
  historyLabel = "ActivateThingCommand";
  id: number;
  oldId!: number;
  undoable?: boolean | undefined = false;
  constructor(id: number) {
    this.id = id;
  }
  execute(): void {
    this.oldId = DataStore.getInstance().getStore("activeThingId");
    if (this.oldId === this.id) {
      return;
    }
    DataStore.getInstance().setStore("activeThingId", this.id);
    touchThingsById(this.oldId);
    touchThingsById(this.id);
  }
  revert(): void {
    if (this.oldId === this.id) {
      return;
    }
    DataStore.getInstance().setStore("activeThingId", this.oldId);
    touchThingsById(this.oldId);
    touchThingsById(this.id);
  }
}
