import { DataStore } from "fra.ktu.red-component";

export const touchThingsById = (id: number) => {
  DataStore.getInstance().touch("editorScene.layers.!" + id);
  const layers = DataStore.getInstance().getStore("editorScene.layers");
  if (layers) {
    for (const layer of layers) {
      DataStore.getInstance().touch("editorScene.layers.!" + layer.id);
    }
  }
  DataStore.getInstance().touch("editorScene.shaders.!" + id);
  DataStore.getInstance().touch("editorScene.modulators.!" + id);
};
