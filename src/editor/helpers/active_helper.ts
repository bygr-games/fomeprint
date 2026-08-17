import { DataStore, type LayerState } from "fra.ktu.red-component";

type LayerWithBoundingBox = {
  id: number;
  boundingBox?: boolean;
};

export const syncLayerBoundingBoxesByActiveThingId = (
  activeThingId: unknown,
  sceneStateId: string = "editorScene",
) => {
  const layers = DataStore.getInstance().getStore(`${sceneStateId}.layers`) as
    | LayerWithBoundingBox[]
    | undefined;

  if (!layers) {
    return;
  }

  const activeLayerId = Number(activeThingId);
  const hasActiveLayer = Number.isFinite(activeLayerId);

  for (const layer of layers) {
    const nextBoundingBox = hasActiveLayer && layer.id === activeLayerId;
    if (layer.boundingBox !== nextBoundingBox) {
      layer.boundingBox = nextBoundingBox;
      DataStore.getInstance().touch(`${sceneStateId}.layers.!${layer.id}`);
    }
  }
};

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

export const getThingById = (id: number): LayerState | null => {
  const layer = DataStore.getInstance().getStore("editorScene.layers.!" + id);
  if (layer) {
    return layer;
  }
  const shader = DataStore.getInstance().getStore("editorScene.shaders.!" + id);
  if (shader) {
    return shader;
  }
  const modulator = DataStore.getInstance().getStore(
    "editorScene.modulators.!" + id,
  );
  if (modulator) {
    return modulator;
  }
  const layers = DataStore.getInstance().getStore("editorScene.layers");
  if (layers) {
    for (const layer of layers) {
      const shader = DataStore.getInstance().getStore(
        "editorScene.layers.!" + layer.id + ".shaders.!" + id,
      );
      if (shader) {
        return shader;
      }
    }
  }
  return null;
};
