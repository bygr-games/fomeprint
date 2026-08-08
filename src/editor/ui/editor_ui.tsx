import jsx from "texsaur";
import { EventDispatcher, KTUComponent } from "fra.ktu.red-component";

class EditorUI extends KTUComponent {
  constructor(props: { binding?: string }) {
    super(props);
  }

  render(): Element {
    return (
      <div class="editor-ui">
        <div class="panel-container left-ui">
          <button type="button" onclick={() => this.snapshotCameraLayer()}>
            Snapshot Camera to Video Layer
          </button>
        </div>
      </div>
    );
  }

  snapshotCameraLayer() {
    EventDispatcher.getInstance().dispatchEvent(
      "editorScene",
      "snapshotCameraToVideoLayer",
      {},
    );
  }

  toggleHide() {
    document.querySelector(".editor-ui")?.classList.toggle("hidden");
  }
}

export function EditorUIComponent(props: { binding?: string }): Element {
  return new EditorUI(props);
}

customElements.define("editor-ui", EditorUI);
