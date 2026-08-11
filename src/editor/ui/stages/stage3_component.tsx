import jsx from "../jsx";
import { DataStore, KTUComponent } from "fra.ktu.red-component";
import {
  getPhomemoBluetoothPrinter,
  type PhomemoPrinterStatus,
} from "../../printing/phomemo_bluetooth_printer";
import { executeCommand } from "../../../ktu/helpers/commands_manager";
import { NewStateCommand } from "../../commands/new_state_command";

type PaperSizeOption = {
  value: string;
  label: string;
  aspectRatio: number;
  isDefault?: boolean;
};

type PaperSizesManifest = {
  sizes: PaperSizeOption[];
};

class Stage3 extends KTUComponent {
  private readonly printer = getPhomemoBluetoothPrinter();
  private printerStatus: PhomemoPrinterStatus;
  private paperSizes: PaperSizeOption[] = [];
  private paperSizesLoadState: "loading" | "ready" | "error" = "loading";

  constructor(props: { binding?: string }) {
    const baseBinding = props.binding ?? "fomeprint.stage";
    super({
      binding: `${baseBinding},fomeprint.paperSize,fomeprint.paperAspectRatio`,
    });
    this.printerStatus = this.printer.getStatus();
    this.printer.subscribe((status) => {
      this.printerStatus = status;
      this.reRender();
    });
    void this.loadPaperSizes();
  }

  defaultBinding(): Record<string, any> {
    return {
      "fomeprint.stage": 1,
      "fomeprint.paperSize": "50x50",
      "fomeprint.paperAspectRatio": 1,
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
    if (this.currentStage() !== 3) {
      return <div></div>;
    }

    const supportsBluetooth = this.printer.isBluetoothAvailable();
    const secureContext = window.isSecureContext;
    const canConnect = this.printerStatus.connection !== "connecting";
    const isConnected = this.printerStatus.connection === "connected";
    const isPrinting = this.printerStatus.print === "printing";

    let connectionLabel = "Connect";
    if (this.printerStatus.connection === "connecting") {
      connectionLabel = "Connecting...";
    }

    const statusKind = this.getStatusKind();
    const selectedPaperSize = this.getSelectedPaperSize();
    const selectedPaperValue = selectedPaperSize?.value ?? "50x50";

    return (
      <div class="panel-container left-ui stage-panel">
        <div class="stage3-print-panel">
          <div class="stage3-print-header">Phomemo (Bluetooth)</div>

          <div class="stage3-paper-size-row">
            <label for="paper-size-select" class="stage3-paper-size-label">
              Paper Size
            </label>
            <select
              id="paper-size-select"
              class="stage3-paper-size-select"
              onchange={(event: Event) => {
                const target = event.target as HTMLSelectElement | null;
                if (!target) {
                  return;
                }
                this.handlePaperSizeChange(target.value);
              }}
            >
              {this.paperSizes.map((paperSize) => (
                <option
                  value={paperSize.value}
                  selected={paperSize.value === selectedPaperValue}
                >
                  {paperSize.label}
                </option>
              ))}
            </select>
          </div>

          {this.paperSizesLoadState === "loading" && (
            <div class="stage3-status-text">Loading paper sizes...</div>
          )}

          {this.paperSizesLoadState === "error" && (
            <div class="stage3-warning">Could not load paper sizes.</div>
          )}

          <div class="stage3-status-row">
            <span
              class={`stage3-status-dot stage3-status-${statusKind}`}
              aria-hidden="true"
            ></span>
            <span class="stage3-status-text">{this.statusText()}</span>
          </div>

          {!secureContext && (
            <div class="stage3-warning">
              Printing requires HTTPS or localhost.
            </div>
          )}

          {secureContext && !supportsBluetooth && (
            <div class="stage3-warning">
              Web Bluetooth is not supported in this browser.
            </div>
          )}

          <div class="stage3-actions">
            <button type="button" onclick={() => this.resetState()}>
              Reset
            </button>
            <button type="button" onclick={() => this.handleDownloadButton()}>
              Download
            </button>
            {!isConnected && (
              <button
                type="button"
                onclick={() => void this.handleConnectButton()}
                disabled={!supportsBluetooth || !secureContext || !canConnect}
              >
                {connectionLabel}
              </button>
            )}

            {isConnected && (
              <button
                type="button"
                onclick={() => void this.handlePrintButton()}
                disabled={isPrinting}
              >
                {isPrinting
                  ? `Printing ${Math.max(0, this.printerStatus.progress)}%`
                  : "Print"}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  private async loadPaperSizes() {
    try {
      const response = await fetch(
        this.resolvePublicAssetPath("assets/paper_sizes.json"),
        {
          cache: "no-store",
        },
      );
      if (!response.ok) {
        throw new Error("Failed to load paper sizes.");
      }

      const data = (await response.json()) as Partial<PaperSizesManifest>;
      const sizes = Array.isArray(data.sizes)
        ? data.sizes.filter((size): size is PaperSizeOption => {
            return (
              typeof size?.value === "string" &&
              typeof size?.label === "string" &&
              Number.isFinite(size?.aspectRatio) &&
              Number(size.aspectRatio) > 0
            );
          })
        : [];

      this.paperSizes = sizes;
      this.paperSizesLoadState = "ready";
      this.applyDefaultPaperSizeIfNeeded();
    } catch {
      this.paperSizes = [];
      this.paperSizesLoadState = "error";
    }

    this.reRender();
  }

  private resolvePublicAssetPath(path: string): string {
    if (/^(?:[a-z]+:)?\/\//i.test(path)) {
      return path;
    }

    return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;
  }

  private getSelectedPaperSize(): PaperSizeOption | null {
    if (this.paperSizes.length === 0) {
      return null;
    }

    const selectedValue = String(
      DataStore.getInstance().getStore("fomeprint.paperSize") ??
        this.bindingData["fomeprint.paperSize"] ??
        "",
    );
    return (
      this.paperSizes.find((paperSize) => paperSize.value === selectedValue) ??
      this.getDefaultPaperSize()
    );
  }

  private getDefaultPaperSize(): PaperSizeOption {
    return (
      this.paperSizes.find((paperSize) => paperSize.isDefault) ??
      this.paperSizes.find((paperSize) => paperSize.value === "50x50") ??
      this.paperSizes[0]
    );
  }

  private applyDefaultPaperSizeIfNeeded() {
    if (this.paperSizes.length === 0) {
      return;
    }

    const selected = this.getSelectedPaperSize();
    if (!selected) {
      return;
    }

    const selectedValue = String(this.bindingData["fomeprint.paperSize"] ?? "");
    const selectedRatio = Number(
      this.bindingData["fomeprint.paperAspectRatio"],
    );
    const hasKnownSelection = this.paperSizes.some(
      (paperSize) => paperSize.value === selectedValue,
    );

    if (
      !hasKnownSelection ||
      !Number.isFinite(selectedRatio) ||
      selectedRatio <= 0
    ) {
      DataStore.getInstance().setStore("fomeprint.paperSize", selected.value);
      DataStore.getInstance().setStore(
        "fomeprint.paperAspectRatio",
        selected.aspectRatio,
      );
      this.updateEditorSceneSizeForAspectRatio(selected.aspectRatio);
    }
  }

  private handlePaperSizeChange(value: string) {
    const selected = this.paperSizes.find(
      (paperSize) => paperSize.value === value,
    );
    if (!selected) {
      return;
    }

    DataStore.getInstance().setStore("fomeprint.paperSize", selected.value);
    DataStore.getInstance().setStore(
      "fomeprint.paperAspectRatio",
      selected.aspectRatio,
    );
    this.updateEditorSceneSizeForAspectRatio(selected.aspectRatio);
    this.reRender();
  }

  private updateEditorSceneSizeForAspectRatio(aspectRatio: number) {
    if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) {
      return;
    }

    const viewportWidth = Math.max(1, window.innerWidth);
    const viewportHeight = Math.max(1, window.innerHeight);

    let width = viewportWidth;
    let height = Math.round(width / aspectRatio);

    if (height > viewportHeight) {
      height = viewportHeight;
      width = Math.round(height * aspectRatio);
    }

    width = Math.max(1, width);
    height = Math.max(1, height);

    DataStore.getInstance().setStore("editorScene.width", width);
    DataStore.getInstance().setStore("editorScene.height", height);
  }

  private statusText(): string {
    const name = this.printerStatus.deviceName;
    if (this.printerStatus.connection === "connected" && name) {
      if (this.printerStatus.print === "printing") {
        return this.printerStatus.message;
      }
      return `Connected to ${name}`;
    }

    if (this.printerStatus.message) {
      return this.printerStatus.message;
    }

    return "Disconnected";
  }

  private getStatusKind(): "ok" | "warn" | "busy" {
    if (this.printerStatus.print === "printing") {
      return "busy";
    }
    if (this.printerStatus.connection === "connected") {
      return "ok";
    }
    if (this.printerStatus.connection === "connecting") {
      return "busy";
    }
    return "warn";
  }

  private async handleConnectButton(): Promise<void> {
    try {
      if (this.printerStatus.connection === "connected") {
        await this.printer.disconnect();
      } else {
        await this.printer.connect();
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to connect to printer.";
      console.error("Phomemo connect error:", error);
      this.printerStatus = {
        ...this.printerStatus,
        connection: "disconnected",
        message,
      };
      this.reRender();
    }
  }

  private async handlePrintButton(): Promise<void> {
    if (this.printerStatus.connection !== "connected") {
      return;
    }

    const canvas = document.querySelector(
      "#canvasContainer canvas",
    ) as HTMLCanvasElement | null;

    if (!canvas) {
      this.printerStatus = {
        ...this.printerStatus,
        message: "Could not find preview canvas to print.",
      };
      this.reRender();
      return;
    }

    try {
      await this.printer.printCanvas(canvas);
      void this.disconnectAfterPrintSettles();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Print failed unexpectedly.";
      console.error("Phomemo print error:", error);
      this.printerStatus = {
        ...this.printerStatus,
        message,
      };
      this.reRender();
    }
  }

  private async disconnectAfterPrintSettles(): Promise<void> {
    // Some printers keep physically feeding paper shortly after data transfer.
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 30000);
    });

    const status = this.printer.getStatus();
    const printCompleted =
      status.print === "idle" && status.message === "Print complete.";
    if (!printCompleted || status.connection !== "connected") {
      return;
    }

    try {
      await this.printer.disconnect();
    } catch (error) {
      console.error("Phomemo auto-disconnect error:", error);
    }
  }

  private handleDownloadButton(): void {
    const canvas = document.querySelector(
      "#canvasContainer canvas",
    ) as HTMLCanvasElement | null;

    if (!canvas) {
      this.printerStatus = {
        ...this.printerStatus,
        message: "Could not find preview canvas to download.",
      };
      this.reRender();
      return;
    }

    const fileNameBase = this.buildDownloadFileNameBase();
    this.downloadEditorSceneState(fileNameBase);

    canvas.toBlob((blob) => {
      if (blob) {
        this.downloadBlob(blob, `${fileNameBase}.png`);
        return;
      }

      this.downloadDataUrl(
        canvas.toDataURL("image/png"),
        `${fileNameBase}.png`,
      );
    }, "image/png");
  }

  private downloadEditorSceneState(fileNameBase: string): void {
    const editorSceneState = DataStore.getInstance().getStore("editorScene");
    if (!editorSceneState || typeof editorSceneState !== "object") {
      this.printerStatus = {
        ...this.printerStatus,
        message: "Could not find editor scene state to download.",
      };
      this.reRender();
      return;
    }

    const serializedState = JSON.stringify(editorSceneState, null, 2);
    const stateBlob = new Blob([serializedState], {
      type: "application/json;charset=utf-8",
    });
    this.downloadBlob(stateBlob, `${fileNameBase}.fomeprint.red`);
  }

  private downloadBlob(blob: Blob, fileName: string): void {
    const objectUrl = URL.createObjectURL(blob);
    this.downloadDataUrl(objectUrl, fileName);
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }

  private downloadDataUrl(dataUrl: string, fileName: string): void {
    const anchor = document.createElement("a");
    anchor.href = dataUrl;
    anchor.download = fileName;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  private buildDownloadFileNameBase(): string {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, "0");
    const timestamp = [
      `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`,
      `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`,
    ].join("-");

    return `fomeprint-${timestamp}`;
  }

  private resetState() {
    executeCommand(new NewStateCommand());
  }
}

export function Stage3Component(props: { binding?: string }): Element {
  return new Stage3(props);
}

customElements.define("stage-3-component", Stage3);
