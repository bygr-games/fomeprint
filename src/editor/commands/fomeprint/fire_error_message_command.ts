import type { ICommand } from "../icommand";

export class FireErrorMessageCommand implements ICommand {
  historyLabel = "FireErrorMessageCommand";

  message: string;

  constructor(message: string) {
    this.message = message;
  }

  execute(): void {
    console.error(this.message);
  }

  revert(): void {
    // No revert action for error messages
  }

  undoable?: boolean | undefined = false;
}
