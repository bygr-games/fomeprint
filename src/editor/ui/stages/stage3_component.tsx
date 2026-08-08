import jsx from "texsaur";
import { KTUComponent } from "fra.ktu.red-component";
import {
  getPhomemoBluetoothPrinter,
  type PhomemoPrinterStatus,
} from "../../printing/phomemo_bluetooth_printer";

class Stage3 extends KTUComponent {
  private readonly printer = getPhomemoBluetoothPrinter();
  private printerStatus: PhomemoPrinterStatus;

  constructor(props: { binding?: string }) {
    super({ binding: props.binding ?? "fomeprint.stage" });
    this.printerStatus = this.printer.getStatus();
    this.printer.subscribe((status) => {
      this.printerStatus = status;
      this.reRender();
    });
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
    const isVisible = this.currentStage() === 3;
    const visibilityClass = isVisible ? "stage-visible" : "stage-hidden";
    const supportsBluetooth = this.printer.isBluetoothAvailable();
    const secureContext = window.isSecureContext;
    const canConnect = this.printerStatus.connection !== "connecting";
    const isConnected = this.printerStatus.connection === "connected";
    const isPrinting = this.printerStatus.print === "printing";

    let connectionLabel = "Connect";
    if (this.printerStatus.connection === "connecting") {
      connectionLabel = "Connecting...";
    } else if (isConnected) {
      connectionLabel = "Disconnect";
    }

    const statusKind = this.getStatusKind();

    return (
      <div class={`panel-container left-ui stage-panel ${visibilityClass}`}>
        <div class="stage3-print-panel">
          <div class="stage3-print-header">Phomemo (Bluetooth)</div>
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
            <button
              type="button"
              onclick={() => void this.handleConnectButton()}
              disabled={!supportsBluetooth || !secureContext || !canConnect}
            >
              {connectionLabel}
            </button>

            <button
              type="button"
              onclick={() => void this.handlePrintButton()}
              disabled={!isConnected || isPrinting}
            >
              {isPrinting
                ? `Printing ${Math.max(0, this.printerStatus.progress)}%`
                : "Print"}
            </button>
          </div>
        </div>
      </div>
    );
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
        error instanceof Error ? error.message : "Failed to connect to printer.";
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
}

export function Stage3Component(props: { binding?: string }): Element {
  return new Stage3(props);
}

customElements.define("stage-3-component", Stage3);
