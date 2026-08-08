export interface ICommand {
  execute(): void;
  revert(): void;
  undoable?: boolean;
  historyLabel?: string;
}
