import jsx from "../jsx";
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
import { NewStateCommand } from "../../commands/new_state_command";

type StickerCategory = {
  id: string;
  label: string;
  assets: string[];
};

type StickersManifest = {
  categories: StickerCategory[];
};

class Stage2 extends KTUComponent {
  private static readonly uploadedCategoryId = "uploaded";
  private static readonly uploadedCategoryLabel = "Uploaded";
  private static readonly uploadedStickersStorageKey =
    "fomeprint.uploadedStickers";

  private manifest: StickersManifest | null = null;
  private uploadedAssets: string[] = [];
  private selectedCategoryId = "";
  private loadingState: "loading" | "ready" | "error" = "loading";
  private uploadStatusMessage = "";
  private pendingRemoveAssetPath: string | null = null;

  constructor(props: { binding?: string }) {
    const baseBinding = props.binding ?? "fomeprint.stage";
    super({ binding: `${baseBinding},activeThingId,editorScene.layers` });
    this.loadUploadedStickersFromStorage();
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
    const visibilityClass = isVisible ? "" : "hidden";
    const categories = this.getCategories();
    const selectedCategory = this.getSelectedCategory();
    const isUploadedCategorySelected =
      selectedCategory?.id === Stage2.uploadedCategoryId;
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
                {(selectedCategory?.assets ?? []).map((assetPath, index) => {
                  const ariaLabel = `${selectedCategory?.label ?? "Sticker"} ${index + 1}`;
                  return (
                    <div class="sticker-thumb-wrap">
                      <button
                        type="button"
                        class="sticker-thumb"
                        title={assetPath}
                        aria-label={ariaLabel}
                        onclick={() => this.createStickerLayer(assetPath)}
                      >
                        <img src={assetPath} alt="" />
                      </button>
                      {isUploadedCategorySelected && (
                        <button
                          type="button"
                          class="sticker-thumb-remove"
                          aria-label={`Remove ${ariaLabel}`}
                          title="Remove uploaded sticker"
                          onclick={(event) =>
                            this.promptRemoveUploadedSticker(assetPath, event)
                          }
                        >
                          x
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {selectedCategory && selectedCategory.assets.length === 0 && (
                <div class="stickers-menu-status">
                  No assets in {selectedCategory.label}.
                </div>
              )}
              <div class="stickers-upload-row">
                <label class="stickers-upload-label" for="sticker-upload-input">
                  Upload sticker image
                </label>
                <input
                  id="sticker-upload-input"
                  type="file"
                  accept="image/*"
                  onchange={(event) => this.onStickerUploadChange(event)}
                />
              </div>
              {this.uploadStatusMessage && (
                <div class="stickers-menu-status">
                  {this.uploadStatusMessage}
                </div>
              )}
            </>
          )}
        </div>
        <div class="stage2-actions">
          <button type="button" onclick={() => this.resetState()}>
            Reset
          </button>
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
        {this.pendingRemoveAssetPath && (
          <div class="stage2-confirm-overlay" role="dialog" aria-modal="true">
            <div class="stage2-confirm-modal">
              <div class="stage2-confirm-title">Remove uploaded sticker?</div>
              <div class="stage2-confirm-actions">
                <button
                  type="button"
                  class="stage2-confirm-button stage2-confirm-cancel"
                  onclick={() => this.cancelRemoveUploadedSticker()}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  class="stage2-confirm-button stage2-confirm-remove"
                  onclick={() => this.confirmRemoveUploadedSticker()}
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        )}
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
      const allCategories = this.getCategories();
      if (allCategories.length > 0) {
        const hasSelected = allCategories.some(
          (category) => category.id === this.selectedCategoryId,
        );
        if (!hasSelected) {
          this.selectedCategoryId = allCategories[0].id;
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
    const categories = this.getCategories();
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

  private getCategories(): StickerCategory[] {
    const categories = this.manifest?.categories ?? [];
    const uploadedCategory: StickerCategory = {
      id: Stage2.uploadedCategoryId,
      label: Stage2.uploadedCategoryLabel,
      assets: this.uploadedAssets,
    };

    return [...categories, uploadedCategory];
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

  private onStickerUploadChange(event: Event) {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      this.uploadStatusMessage = "Please choose an image file.";
      this.reRender();
      if (input) {
        input.value = "";
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string" || !result) {
        this.uploadStatusMessage = "Could not read the selected image.";
        this.reRender();
        return;
      }

      this.addUploadedSticker(result);
      this.selectedCategoryId = Stage2.uploadedCategoryId;
      this.uploadStatusMessage = `Uploaded ${file.name}`;
      this.createStickerLayer(result);
      this.reRender();
    };

    reader.onerror = () => {
      this.uploadStatusMessage = "Could not read the selected image.";
      this.reRender();
    };

    reader.readAsDataURL(file);

    if (input) {
      input.value = "";
    }
  }

  private loadUploadedStickersFromStorage() {
    try {
      const raw = window.localStorage.getItem(
        Stage2.uploadedStickersStorageKey,
      );
      if (!raw) {
        this.uploadedAssets = [];
        return;
      }

      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        this.uploadedAssets = [];
        return;
      }

      this.uploadedAssets = parsed.filter(
        (asset): asset is string =>
          typeof asset === "string" && asset.startsWith("data:image/"),
      );

      if (!this.selectedCategoryId && this.uploadedAssets.length > 0) {
        this.selectedCategoryId = Stage2.uploadedCategoryId;
      }
    } catch {
      this.uploadedAssets = [];
    }
  }

  private saveUploadedStickersToStorage() {
    try {
      window.localStorage.setItem(
        Stage2.uploadedStickersStorageKey,
        JSON.stringify(this.uploadedAssets),
      );
    } catch {
      // Ignore storage quota and serialization failures.
    }
  }

  private addUploadedSticker(assetPath: string) {
    const deduped = [
      assetPath,
      ...this.uploadedAssets.filter((a) => a !== assetPath),
    ];
    this.uploadedAssets = deduped;
    this.saveUploadedStickersToStorage();
  }

  private promptRemoveUploadedSticker(assetPath: string, event: Event) {
    event.preventDefault();
    event.stopPropagation();

    this.pendingRemoveAssetPath = assetPath;
    this.reRender();
  }

  private cancelRemoveUploadedSticker() {
    if (!this.pendingRemoveAssetPath) {
      return;
    }

    this.pendingRemoveAssetPath = null;
    this.reRender();
  }

  private confirmRemoveUploadedSticker() {
    const assetPath = this.pendingRemoveAssetPath;
    if (!assetPath) {
      return;
    }

    this.pendingRemoveAssetPath = null;

    const nextAssets = this.uploadedAssets.filter(
      (asset) => asset !== assetPath,
    );
    if (nextAssets.length === this.uploadedAssets.length) {
      this.reRender();
      return;
    }

    this.uploadedAssets = nextAssets;
    this.saveUploadedStickersToStorage();
    this.uploadStatusMessage = "Removed uploaded sticker.";
    this.reRender();
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

  private resetState() {
    executeCommand(new NewStateCommand());
  }
}

export function Stage2Component(props: { binding?: string }): Element {
  return new Stage2(props);
}

customElements.define("stage-2-component", Stage2);
