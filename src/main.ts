import { RedViewerComponent } from "fra.ktu.red-component";
import { FomeprintEditor } from "./editor/fomeprint_editor";

window.addEventListener("DOMContentLoaded", () => {
  new FomeprintEditor(
    document.getElementById("canvasContainer")!,
    document.getElementById("topUIContainer")!,
    document.getElementById("bottomUIContainer")!,
    document.getElementById("extraSettingsContainer")!,
  );
});

export default { RedViewerComponent };
