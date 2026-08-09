import { DataStore } from "fra.ktu.red-component";

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
