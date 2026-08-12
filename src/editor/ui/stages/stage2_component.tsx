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
import {
  IconClose,
  IconNext,
  IconPlus,
  IconReset,
  IconTrash,
} from "../../helpers/icons";
import {
  addUploadedSticker,
  getSelectedCategory,
  removeUploadedSticker,
  uploadedCategoryId,
  uploadedCategoryLabel,
  type StickerCategory,
} from "../../managers/store_manager";
import { FireErrorMessageCommand } from "../../commands/fomeprint/fire_error_message_command";

class Stage2 extends KTUComponent {
  private pendingRemoveAssetPath: string | null = null;
  private isStickersMenuOpen = false;

  constructor(props: { binding?: string }) {
    const baseBinding = props.binding ?? "fomeprint.stage";
    super({ binding: `${baseBinding},activeThingId,editorScene.layers` });
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
    if (this.currentStage() !== 2) {
      return <div></div>;
    }

    const categories = this.getCategories();
    const selectedCategory = getSelectedCategory();
    const isUploadedCategorySelected =
      selectedCategory?.id === uploadedCategoryId;
    const activeStickerLayer = this.getActiveStickerLayer();
    const canDeleteActiveSticker = activeStickerLayer !== null;

    return (
      <div class="panel-container left-ui stage-panel">
        <div class="stage-actions stage2-actions">
          <button
            type="button"
            class="ui-square-action-button"
            onclick={() => this.resetState()}
          >
            {IconReset()}
          </button>
          <button
            type="button"
            class="ui-square-action-button"
            onclick={() => this.toggleStickersMenu()}
          >
            {this.isStickersMenuOpen ? IconClose() : IconPlus()}
          </button>
          <button
            type="button"
            class="ui-square-action-button"
            onclick={() => this.deleteActiveStickerLayer()}
            disabled={!canDeleteActiveSticker}
          >
            {IconTrash()}
          </button>
          <button
            type="button"
            class="ui-square-action-button"
            onclick={() => this.goToThirdStage()}
          >
            {IconNext()}
          </button>
        </div>
        <div class={`stickers-menu ${this.isStickersMenuOpen ? "" : "hidden"}`}>
          <div class="stickers-menu-header">Stickers</div>
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
                  onclick={() => {
                    removeUploadedSticker(this.pendingRemoveAssetPath!);
                    this.pendingRemoveAssetPath = null;
                  }}
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

  private toggleStickersMenu() {
    this.isStickersMenuOpen = !this.isStickersMenuOpen;
    this.reRender();
  }

  private selectCategory(categoryId: string) {
    if (
      categoryId ===
      DataStore.getInstance().getStore("fomeprint.store.selectedCategory")
    ) {
      return;
    }

    DataStore.getInstance().setStore(
      "fomeprint.store.selectedCategory",
      categoryId,
    );
  }

  private getCategories(): StickerCategory[] {
    const categories = DataStore.getInstance().getStore(
      "fomeprint.store.stickers.categories",
    );
    const uploadedCategory: StickerCategory = {
      id: uploadedCategoryId,
      label: uploadedCategoryLabel,
      assets: DataStore.getInstance().getStore(
        "fomeprint.store.uploadedAssets",
      ),
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
      executeCommand(
        new FireErrorMessageCommand("Selected file is not an image."),
      );
      if (input) {
        input.value = "";
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string" || !result) {
        executeCommand(
          new FireErrorMessageCommand("Could not read the selected image."),
        );
        return;
      }

      addUploadedSticker(result);
      DataStore.getInstance().setStore(
        "fomeprint.store.selectedCategory",
        uploadedCategoryId,
      );
      this.createStickerLayer(result);
    };

    reader.onerror = () => {
      executeCommand(
        new FireErrorMessageCommand("Could not read the selected image."),
      );
    };

    reader.readAsDataURL(file);

    if (input) {
      input.value = "";
    }
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
