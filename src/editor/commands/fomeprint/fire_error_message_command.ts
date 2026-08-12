import type { ICommand } from "../icommand";
import { DataStore } from "fra.ktu.red-component";
export class FireErrorMessageCommand implements ICommand {
  historyLabel = "FireErrorMessageCommand";

  message: string;

  constructor(message: string) {
    this.message = message;
  }

  execute(): void {
    //console.error(this.message);
    const errorMessages: string[] =
      DataStore.getInstance().getStore("fomeprint.errorMessages") || [];
    errorMessages.push(this.message);
    DataStore.getInstance().setStore("fomeprint.errorMessages", errorMessages);
  }

  revert(): void {
    // No revert action for error messages
  }

  undoable?: boolean | undefined = false;
}
