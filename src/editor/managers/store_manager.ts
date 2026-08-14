import { DataStore } from "fra.ktu.red-component";
import { FireErrorMessageCommand } from "../commands/fomeprint/fire_error_message_command";
import { executeCommand } from "../../ktu/helpers/commands_manager";

export const uploadedCategoryId = "uploaded";
export const uploadedCategoryLabel = "Uploaded";
export const uploadedStickersStorageKey = "fomeprint.uploadedStickers";

const STICKERS = {
  categories: [
    {
      id: "hair",
      label: "Hair",
      assets: [
        "/assets/hair/hair-1.svg",
        "/assets/hair/hair-2.svg",
        "/assets/hair/hair-3.svg",
        "/assets/hair/hair-4.svg",
        "/assets/hair/hair-5.svg",
      ],
    },
    {
      id: "eyes",
      label: "Eyes",
      assets: [
        "/assets/eyes/eye-1.svg",
        "/assets/eyes/eye-2.svg",
        "/assets/eyes/eye-3.svg",
        "/assets/eyes/eye-4.svg",
        "/assets/eyes/eye-5.svg",
        "/assets/eyes/eye-6.svg",
        "/assets/eyes/eye-7.svg",
        "/assets/eyes/eye-8.svg",
        "/assets/eyes/eye-9.svg",
        "/assets/eyes/eye-10.svg",
        "/assets/eyes/eye-11.svg",
        "/assets/eyes/eye-12.svg",
        "/assets/eyes/eye-13.svg",
        "/assets/eyes/eye-14.svg",
        "/assets/eyes/eye-15.svg",
      ],
    },
    {
      id: "ears",
      label: "Ears",
      assets: [
        "/assets/ears/ear-1.svg",
        "/assets/ears/ear-2.svg",
        "/assets/ears/ear-3.svg",
        "/assets/ears/ear-4.svg",
        "/assets/ears/ear-5.svg",
      ],
    },
    {
      id: "nose",
      label: "Nose",
      assets: [
        "/assets/nose/nose-1.svg",
        "/assets/nose/nose-2.svg",
        "/assets/nose/nose-3.svg",
        "/assets/nose/nose-4.svg",
        "/assets/nose/nose-5.svg",
      ],
    },
    {
      id: "mouth",
      label: "Mouth",
      assets: [
        "/assets/mouth/mouth-1.svg",
        "/assets/mouth/mouth-2.svg",
        "/assets/mouth/mouth-3.svg",
        "/assets/mouth/mouth-4.svg",
        "/assets/mouth/mouth-5.svg",
        "/assets/mouth/mouth-6.svg",
        "/assets/mouth/mouth-7.svg",
        "/assets/mouth/mouth-8.svg",
        "/assets/mouth/mouth-9.svg",
        "/assets/mouth/mouth-10.svg",
      ],
    },
    {
      id: "beard",
      label: "Beard",
      assets: [
        "/assets/beard/beard-1.svg",
        "/assets/beard/beard-2.svg",
        "/assets/beard/beard-3.svg",
        "/assets/beard/beard-4.svg",
        "/assets/beard/beard-5.svg",
      ],
    },
    {
      id: "accesories",
      label: "Accesories",
      assets: [
        "/assets/accesories/accessory-1.svg",
        "/assets/accesories/accessory-2.svg",
        "/assets/accesories/accessory-3.svg",
        "/assets/accesories/accessory-4.svg",
        "/assets/accesories/accessory-5.svg",
        "/assets/accesories/accessory-6.svg",
        "/assets/accesories/accessory-7.svg",
      ],
    },
    {
      id: "symbols",
      label: "Symbols",
      assets: [
        "/assets/symbols/symbol-1.svg",
        "/assets/symbols/symbol-2.svg",
        "/assets/symbols/symbol-3.svg",
      ],
    },
  ],
};

export type StickerCategory = {
  id: string;
  label: string;
  assets: string[];
};

export type StickersManifest = {
  categories: StickerCategory[];
};

export const setupStore = () => {
  DataStore.getInstance().setStore("fomeprint.store.selectedCategory", "hair");
  loadUploadedStickersFromStorage();
  loadManifest();
};

const loadManifest = () => {
  const data = STICKERS;
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
            .map((asset) => resolvePublicAssetPath(asset)),
        }))
    : [];

  DataStore.getInstance().setStore(
    "fomeprint.store.stickers.categories",
    categories,
  );
  const allCategories = getCategories();
  let selectedCategoryId = DataStore.getInstance().getStore(
    "fomeprint.store.selectedCategory",
  );
  if (allCategories.length > 0) {
    const hasSelected = allCategories.some(
      (category) => category.id === selectedCategoryId,
    );
    if (!hasSelected) {
      selectedCategoryId = allCategories[0].id;
    }
  }
};

const loadUploadedStickersFromStorage = () => {
  let uploadedAssets: string[] = [];
  try {
    const raw = window.localStorage.getItem(uploadedStickersStorageKey);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        uploadedAssets = parsed.filter(
          (asset): asset is string =>
            typeof asset === "string" && asset.startsWith("data:image/"),
        );
      }
    }
  } catch {
    uploadedAssets = [];
  }
  DataStore.getInstance().setStore(
    "fomeprint.store.uploadedAssets",
    uploadedAssets,
  );
};

export const getCategories = (): StickerCategory[] => {
  const categories = DataStore.getInstance().getStore(
    "fomeprint.store.stickers.categories",
  );
  const uploadedCategory: StickerCategory = {
    id: uploadedCategoryId,
    label: uploadedCategoryLabel,
    assets: DataStore.getInstance().getStore("fomeprint.store.uploadedAssets"),
  };

  return [...categories, uploadedCategory];
};

export const resolvePublicAssetPath = (path: string): string => {
  if (/^(?:[a-z]+:)?\/\//i.test(path)) {
    return path;
  }

  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;
};

export const getSelectedCategory = (): StickerCategory | null => {
  const categories = getCategories();
  if (categories.length === 0) {
    return null;
  }

  const selectedCategoryId = DataStore.getInstance().getStore(
    "fomeprint.store.selectedCategory",
  );

  return (
    categories.find((category) => category.id === selectedCategoryId) ??
    categories[0]
  );
};

export const saveUploadedStickersToStorage = (uploadedAssets: string[]) => {
  try {
    window.localStorage.setItem(
      uploadedStickersStorageKey,
      JSON.stringify(uploadedAssets),
    );
  } catch {
    executeCommand(
      new FireErrorMessageCommand(
        "Could not save uploaded stickers to local storage.",
      ),
    );
  }
};

export const addUploadedSticker = (assetPath: string) => {
  const deduped = [
    assetPath,
    ...DataStore.getInstance()
      .getStore("fomeprint.store.uploadedAssets")
      .filter((a: string) => a !== assetPath),
  ];
  DataStore.getInstance().setStore("fomeprint.store.uploadedAssets", deduped);
  saveUploadedStickersToStorage(deduped);
};

export const removeUploadedSticker = (assetPath: string) => {
  if (!assetPath) {
    return;
  }

  const uploadedAssets: string[] = DataStore.getInstance().getStore(
    "fomeprint.store.uploadedAssets",
  );
  const nextAssets = uploadedAssets.filter(
    (asset: string) => asset !== assetPath,
  );
  if (nextAssets.length === uploadedAssets.length) {
    return;
  }

  DataStore.getInstance().setStore(
    "fomeprint.store.uploadedAssets",
    nextAssets,
  );
  saveUploadedStickersToStorage(nextAssets);
};
