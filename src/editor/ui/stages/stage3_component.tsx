import jsx from "../jsx";
import { DataStore, KTUComponent } from "fra.ktu.red-component";
import {
  getPhomemoBluetoothPrinter,
  type PhomemoPrinterStatus,
} from "../../printing/phomemo_bluetooth_printer";
import { executeCommand } from "../../../ktu/helpers/commands_manager";
import { NewStateCommand } from "../../commands/new_state_command";
import {
  IconBack,
  IconBluetooth,
  IconDownload,
  IconPrint,
  IconReset,
} from "../../helpers/icons";
import { SetFomeprintStageCommand } from "../../commands/fomeprint/set_fomeprint_stage_command";

class Stage3 extends KTUComponent {
  private readonly printer = getPhomemoBluetoothPrinter();
  private printerStatus: PhomemoPrinterStatus;

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

    const statusKind = this.getStatusKind();

    return (
      <div class="panel-container left-ui stage-panel">
        <div class="stage3-print-panel">
          <div class="stage3-actions">
            <div class="stage-actions stage3-action-buttons">
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
                onclick={() => this.goBack()}
              >
                {IconBack()}
              </button>
              <button
                type="button"
                class="ui-square-action-button"
                onclick={() => this.handleDownloadButton()}
              >
                {IconDownload()}
              </button>
              <span
                class={`stage3-status-dot stage3-status-${statusKind}`}
                aria-hidden="true"
              ></span>
              <span class="stage3-status-text">{this.statusText()}</span>
              {!isConnected && (
                <button
                  type="button"
                  class="ui-square-action-button"
                  onclick={() => void this.handleConnectButton()}
                  disabled={!supportsBluetooth || !secureContext || !canConnect}
                >
                  {IconBluetooth()}
                </button>
              )}
              {isConnected && (
                <button
                  type="button"
                  class="ui-square-action-button"
                  onclick={() => void this.handlePrintButton()}
                  disabled={isPrinting}
                >
                  {isPrinting
                    ? `Printing ${Math.max(0, this.printerStatus.progress)}%`
                    : IconPrint()}
                </button>
              )}
            </div>
            <div class="stage3-status-row"></div>
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
          </div>
        </div>
      </div>
    );
  }

  private goBack() {
    executeCommand(new SetFomeprintStageCommand(2));
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
