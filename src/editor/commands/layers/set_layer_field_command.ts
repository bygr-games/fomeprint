import {
  DataStore,
  EventDispatcher,
  type LayerState,
} from "fra.ktu.red-component";
import type { ICommand } from "../icommand";

export class SetLayerFieldCommand implements ICommand {
  historyLabel = "SetLayerFieldCommand";
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
    const layers: LayerState[] =
      DataStore.getInstance().getStore("editorScene.layers");
    const layer = layers.find((layer) => layer.id === this.id);
    console.log("SetLayerFieldCommand executing", layer);
    if (layer) {
      if (this.oldValue === undefined) {
        this.oldValue = (layer as any)[this.field];
      }
      (layer as any)[this.field] = this.value;
      if (this.field === "visible") {
        DataStore.getInstance().touch(`editorScene.layers.!${this.id}`);
      } else {
        EventDispatcher.getInstance().dispatchEvent(
          "editorScene.layers.!" + this.id,
          "change",
          {
            field: this.field,
            value: this.value,
          },
        );
      }
    }
  }
  revert(): void {
    const layers: LayerState[] =
      DataStore.getInstance().getStore("editorScene.layers");
    const layer = layers.find((layer) => layer.id === this.id);
    if (layer) {
      (layer as any)[this.field] = this.oldValue;
      if (this.field === "visible") {
        DataStore.getInstance().touch(`editorScene.layers.!${this.id}`);
      } else {
        EventDispatcher.getInstance().dispatchEvent(
          "editorScene.layers.!" + this.id,
          "change",
          {
            field: this.field,
            value: this.oldValue,
          },
        );
      }
    }
  }
}
