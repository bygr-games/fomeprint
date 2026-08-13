import {
  DataStore,
  EventDispatcher,
  type ShaderLayerState,
} from "fra.ktu.red-component";
import type { ICommand } from "../icommand";

const SHADER_LOCAL_STORAGE_KEYS: Record<string, string> = {
  brightness: "fomeprint.adjustment.brightness",
  contrast: "fomeprint.adjustment.contrast",
  pixelSize: "fomeprint.bayer.pixelSize",
  threshold: "fomeprint.posterize.threshold",
};

export class SetShaderFieldCommand implements ICommand {
  historyLabel = "SetShaderFieldCommand";
  id: number;
  field: string;
  value: string | boolean | number;
  oldValue!: string | boolean | number;
  owner: string;

  constructor(
    id: number,
    field: string,
    value: string | boolean | number,
    owner: string,
  ) {
    this.id = id;
    this.field = field;
    this.value = value;
    this.owner = owner;
  }
  execute(): void {
    console.log("EXECUTE", this.id, this.field, this.value, this.owner);
    const shader = DataStore.getInstance().getStore(
      `${this.owner}.!${this.id}`,
    );
    console.log("SHADER", shader);
    if (shader) {
      if (this.oldValue === undefined) {
        this.oldValue = (shader as any)[this.field];
      }
      (shader as any)[this.field] = this.value;
      this.persistFieldValue(this.value);
      DataStore.getInstance().touch(`${this.owner}.!${this.id}`);
    }
  }
  revert(): void {
    const shaders: ShaderLayerState[] = DataStore.getInstance().getStore(
      this.owner,
    );
    const shader = shaders.find((shader) => shader.id === this.id);
    if (shader) {
      (shader as any)[this.field] = this.oldValue;
      this.persistFieldValue(this.oldValue);
      if (this.field === "visible") {
        DataStore.getInstance().touch(`${this.owner}.!${this.id}`);
      } else {
        EventDispatcher.getInstance().dispatchEvent(
          `${this.owner}.!` + this.id,
          "change",
          {
            field: this.field,
            value: this.oldValue,
          },
        );
      }
    }
  }

  private persistFieldValue(value: string | boolean | number): void {
    const storageKey = SHADER_LOCAL_STORAGE_KEYS[this.field];
    if (!storageKey || typeof value !== "number" || !Number.isFinite(value)) {
      return;
    }

    window.localStorage.setItem(storageKey, String(value));
  }
}
