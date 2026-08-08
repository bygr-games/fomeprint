import {
  DataStore,
  EventDispatcher,
  type ModulatorState,
} from "fra.ktu.red-component";
import type { ICommand } from "../icommand";

export class SetModulatorFieldCommand implements ICommand {
  historyLabel = "SetModulatorFieldCommand";
  id: number;
  field: string;
  value: string | boolean | number;
  oldValue!: string | boolean | number;

  constructor(id: number, field: string, value: string | boolean | number) {
    this.id = id;
    this.field = field;
    this.value = value;
  }
  execute(): void {
    const modulators: ModulatorState[] = DataStore.getInstance().getStore(
      "editorScene.modulators",
    );
    const modulator = modulators.find((modulator) => modulator.id === this.id);
    if (modulator) {
      if (this.oldValue === undefined) {
        this.oldValue = (modulator as any)[this.field];
      }
      (modulator as any)[this.field] = this.value;
      EventDispatcher.getInstance().dispatchEvent(
        "editorScene.modulators.!" + this.id,
        "change",
        {
          field: this.field,
          value: this.value,
        },
      );
    }
  }
  revert(): void {
    const modulators: ModulatorState[] = DataStore.getInstance().getStore(
      "editorScene.modulators",
    );
    const modulator = modulators.find((modulator) => modulator.id === this.id);
    if (modulator) {
      (modulator as any)[this.field] = this.oldValue;
      EventDispatcher.getInstance().dispatchEvent(
        "editorScene.modulators.!" + this.id,
        "change",
        {
          field: this.field,
          value: this.oldValue,
        },
      );
    }
  }
}
