import { RedViewerComponent } from "fra.ktu.red-component";
import { FomeprintEditor } from "./editor/fomeprint_editor";

window.addEventListener("DOMContentLoaded", () => {
  new FomeprintEditor(
    document.getElementById("canvasContainer")!,
    document.getElementById("uiContainer")!,
  );
});

export default { RedViewerComponent };
