import jsx from "texsaur";
import {
  DataStore,
  KTUComponent,
  type LayerState,
  type SceneState,
} from "fra.ktu.red-component";
import { executeCommand } from "../../../ktu/helpers/commands_manager";
import { SetFomeprintStageCommand } from "../../commands/fomeprint/set_fomeprint_stage_command";
import { CreateStickerVideoLayerCommand } from "../../commands/layers/create_sticker_video_layer_command";
import { DeleteLayerCommand } from "../../commands/layers/delete_layer_command";

type StickerCategory = {
  id: string;
  label: string;
  assets: string[];
};

type StickersManifest = {
  categories: StickerCategory[];
};

class Stage2 extends KTUComponent {
  private manifest: StickersManifest | null = null;
  private selectedCategoryId = "";
  private loadingState: "loading" | "ready" | "error" = "loading";

  constructor(props: { binding?: string }) {
    const baseBinding = props.binding ?? "fomeprint.stage";
    super({ binding: `${baseBinding},activeThingId,editorScene.layers` });
    void this.loadManifest();
  }

  defaultBinding(): Record<string, any> {
    return {
      "fomeprint.stage": 1,
    };
  }

  private currentStage(): number {
    const stage = Number(this.bindingData["fomeprint.stage"]);
    if (stage === 1 || stage === 2 || stage === 3) {
      return stage;
    }
    return 1;
  }

  render(): Element {
    const isVisible = this.currentStage() === 2;
    const visibilityClass = isVisible ? "stage-visible" : "stage-hidden";
    const categories = this.manifest?.categories ?? [];
    const selectedCategory = this.getSelectedCategory();
    const activeStickerLayer = this.getActiveStickerLayer();
    const canDeleteActiveSticker = activeStickerLayer !== null;

    return (
      <div class={`panel-container left-ui stage-panel ${visibilityClass}`}>
        <div class="stickers-menu">
          <div class="stickers-menu-header">Stickers</div>
          {this.loadingState === "loading" && (
            <div class="stickers-menu-status">Loading stickers...</div>
          )}
          {this.loadingState === "error" && (
            <div class="stickers-menu-status">
              Could not load sticker categories.
            </div>
          )}
          {this.loadingState === "ready" && categories.length === 0 && (
            <div class="stickers-menu-status">No sticker categories found.</div>
          )}
          {this.loadingState === "ready" && categories.length > 0 && (
            <>
              <div class="stickers-categories">
                {categories.map((category) => {
                  const isSelected = category.id === selectedCategory?.id;
                  return (
                    <button
                      type="button"
                      class={`stickers-category-button ${isSelected ? "is-selected" : ""}`}
                      onclick={() => this.selectCategory(category.id)}
                    >
                      {category.label}
                    </button>
                  );
                })}
              </div>
              <div class="stickers-grid">
                {(selectedCategory?.assets ?? []).map((assetPath, index) => (
                  <button
                    type="button"
                    class="sticker-thumb"
                    title={assetPath}
                    aria-label={`${selectedCategory?.label ?? "Sticker"} ${index + 1}`}
                    onclick={() => this.createStickerLayer(assetPath)}
                  >
                    <img src={assetPath} alt="" />
                  </button>
                ))}
              </div>
              {selectedCategory && selectedCategory.assets.length === 0 && (
                <div class="stickers-menu-status">
                  No assets in {selectedCategory.label}.
                </div>
              )}
            </>
          )}
        </div>
        <div class="stage2-actions">
          <button
            type="button"
            class="stage2-delete-button"
            onclick={() => this.deleteActiveStickerLayer()}
            disabled={!canDeleteActiveSticker}
          >
            Delete Active Sticker
          </button>
          <button type="button" onclick={() => this.goToThirdStage()}>
            Next
          </button>
        </div>
      </div>
    );
  }

  private async loadManifest() {
    try {
      const response = await fetch(
        this.resolvePublicAssetPath("assets/stickers_manifest.json"),
        {
          cache: "no-store",
        },
      );
      if (!response.ok) {
        throw new Error("Failed to load stickers manifest");
      }

      const data = (await response.json()) as Partial<StickersManifest>;
      const categories = Array.isArray(data.categories)
        ? data.categories
            .filter((category): category is StickerCategory => {
              return (
                typeof category?.id === "string" &&
                typeof category?.label === "string" &&
                Array.isArray(category?.assets)
              );
            })
            .map((category) => ({
              id: category.id,
              label: category.label,
              assets: category.assets
                .filter((asset) => typeof asset === "string")
                .map((asset) => this.resolvePublicAssetPath(asset)),
            }))
        : [];

      this.manifest = { categories };
      if (categories.length > 0) {
        const hasSelected = categories.some(
          (category) => category.id === this.selectedCategoryId,
        );
        if (!hasSelected) {
          this.selectedCategoryId = categories[0].id;
        }
      }

      this.loadingState = "ready";
    } catch {
      this.loadingState = "error";
      this.manifest = null;
    }

    this.reRender();
  }

  private resolvePublicAssetPath(path: string): string {
    if (/^(?:[a-z]+:)?\/\//i.test(path)) {
      return path;
    }

    return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;
  }

  private getSelectedCategory(): StickerCategory | null {
    const categories = this.manifest?.categories ?? [];
    if (categories.length === 0) {
      return null;
    }

    return (
      categories.find((category) => category.id === this.selectedCategoryId) ??
      categories[0]
    );
  }

  private selectCategory(categoryId: string) {
    if (categoryId === this.selectedCategoryId) {
      return;
    }

    this.selectedCategoryId = categoryId;
    this.reRender();
  }

  private goToThirdStage() {
    executeCommand(new SetFomeprintStageCommand(3));
  }

  private createStickerLayer(assetPath: string) {
    if (!assetPath) {
      return;
    }

    executeCommand(new CreateStickerVideoLayerCommand(assetPath));
  }

  private getActiveStickerLayer(): LayerState | null {
    const scene = DataStore.getInstance().getStore("editorScene") as
      | SceneState
      | undefined;
    if (!scene) {
      return null;
    }

    const activeThingId = Number(
      DataStore.getInstance().getStore("activeThingId"),
    );
    if (!Number.isFinite(activeThingId)) {
      return null;
    }

    const activeLayer = scene.layers.find(
      (layer) => layer.id === activeThingId,
    );
    if (!activeLayer) {
      return null;
    }

    const sourceType = (activeLayer as Record<string, unknown>).sourceType;
    if (sourceType === "sticker") {
      return activeLayer;
    }

    const shaders = (activeLayer as Record<string, unknown>).shaders;
    if (Array.isArray(shaders)) {
      const hasStickerStroke = shaders.some((shader) => {
        const shaderRecord = shader as Record<string, unknown>;
        const type = String(shaderRecord.type ?? "").toLowerCase();
        const thickness = Number(shaderRecord.thickness);
        const color = String(shaderRecord.color ?? "").toLowerCase();
        return type.includes("outer") && thickness === 6 && color === "#ffffff";
      });

      if (hasStickerStroke) {
        return activeLayer;
      }
    }

    return null;
  }

  private deleteActiveStickerLayer() {
    const activeStickerLayer = this.getActiveStickerLayer();
    if (!activeStickerLayer) {
      return;
    }

    executeCommand(new DeleteLayerCommand(activeStickerLayer.id));
  }
}

export function Stage2Component(props: { binding?: string }): Element {
  return new Stage2(props);
}

customElements.define("stage-2-component", Stage2);
