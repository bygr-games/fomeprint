type ConnectionState = "disconnected" | "connecting" | "connected";

type PrintState = "idle" | "printing";

export type PhomemoPrinterStatus = {
  connection: ConnectionState;
  print: PrintState;
  deviceName: string;
  message: string;
  progress: number;
};

type StatusListener = (status: PhomemoPrinterStatus) => void;

const BLE_SERVICE_UUIDS: Array<number | string> = [
  0xff00,
  0xffe0,
  0xae30,
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
  "0000ff00-0000-1000-8000-00805f9b34fb",
];

const WRITE_CHARACTERISTIC_UUID = 0xff02;
const NOTIFY_CHARACTERISTIC_UUID = 0xff03;

const CMD = {
  INIT: new Uint8Array([0x1b, 0x40]),
  FEED: (dots: number) => new Uint8Array([0x1b, 0x4a, dots & 0xff]),
  DENSITY: (level: number) => new Uint8Array([0x1d, 0x7c, level & 0xff]),
  HEAT_SETTINGS: (maxDots: number, heatTime: number, heatInterval: number) =>
    new Uint8Array([
      0x1b,
      0x37,
      maxDots & 0xff,
      heatTime & 0xff,
      heatInterval & 0xff,
    ]),
  RASTER_HEADER: (widthBytes: number, heightLines: number) =>
    new Uint8Array([
      0x1d,
      0x76,
      0x30,
      0x00,
      widthBytes & 0xff,
      (widthBytes >> 8) & 0xff,
      heightLines & 0xff,
      (heightLines >> 8) & 0xff,
    ]),
};

const CHUNK_SIZE = 128;
const CHUNK_DELAY_MS = 20;

const DEFAULT_PRINTER_WIDTH_BYTES = 48;
const WIDE_PRINTER_WIDTH_BYTES = 72;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function densityToHeatTime(density: number): number {
  const clamped = Math.max(1, Math.min(8, Math.round(density)));
  return 50 + Math.round(((clamped - 1) / 7) * 90);
}

function looksWidePrinter(deviceName: string): boolean {
  const upper = deviceName.toUpperCase();
  return upper.includes("M2") || upper.includes("M26") || upper.includes("M22");
}

function getPrinterWidthBytes(deviceName: string): number {
  if (looksWidePrinter(deviceName)) {
    return WIDE_PRINTER_WIDTH_BYTES;
  }
  return DEFAULT_PRINTER_WIDTH_BYTES;
}

function convertCanvasToRaster(
  sourceCanvas: HTMLCanvasElement,
  widthBytes: number,
): { data: Uint8Array; widthBytes: number; heightLines: number } {
  const targetWidthPx = widthBytes * 8;
  const scale = targetWidthPx / sourceCanvas.width;
  const targetHeightPx = Math.max(1, Math.round(sourceCanvas.height * scale));

  const rasterCanvas = document.createElement("canvas");
  rasterCanvas.width = targetWidthPx;
  rasterCanvas.height = targetHeightPx;

  const ctx = rasterCanvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not prepare print canvas.");
  }

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, rasterCanvas.width, rasterCanvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(sourceCanvas, 0, 0, targetWidthPx, targetHeightPx);

  const imageData = ctx.getImageData(0, 0, targetWidthPx, targetHeightPx);
  const src = imageData.data;
  const data = new Uint8Array(widthBytes * targetHeightPx);
  const threshold = 150;

  for (let y = 0; y < targetHeightPx; y++) {
    for (let x = 0; x < targetWidthPx; x++) {
      const px = (y * targetWidthPx + x) * 4;
      const alpha = src[px + 3] / 255;
      const r = src[px];
      const g = src[px + 1];
      const b = src[px + 2];

      // Blend toward white for transparent pixels before thresholding.
      const blended =
        (r * 0.299 + g * 0.587 + b * 0.114) * alpha + 255 * (1 - alpha);
      const isBlack = blended < threshold;

      if (isBlack) {
        const byteIndex = y * widthBytes + (x >> 3);
        const bitIndex = 7 - (x & 7);
        data[byteIndex] |= 1 << bitIndex;
      }
    }
  }

  return {
    data,
    widthBytes,
    heightLines: targetHeightPx,
  };
}

class PhomemoBluetoothPrinter {
  private device: any = null;
  private server: any = null;
  private service: any = null;
  private writeCharacteristic: any = null;
  private notifyCharacteristic: any = null;
  private useWriteWithResponse = false;

  private readonly listeners = new Set<StatusListener>();

  private status: PhomemoPrinterStatus = {
    connection: "disconnected",
    print: "idle",
    deviceName: "",
    message: "Disconnected",
    progress: 0,
  };

  private readonly onDisconnected = () => {
    this.server = null;
    this.service = null;
    this.writeCharacteristic = null;
    this.notifyCharacteristic = null;
    this.setStatus({
      connection: "disconnected",
      print: "idle",
      message: "Disconnected",
      progress: 0,
    });
  };

  subscribe(listener: StatusListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }

  getStatus(): PhomemoPrinterStatus {
    return { ...this.status };
  }

  isBluetoothAvailable(): boolean {
    const maybeNavigator = navigator as Navigator & {
      bluetooth?: { requestDevice: (options: unknown) => Promise<any> };
    };
    return typeof maybeNavigator.bluetooth?.requestDevice === "function";
  }

  canPrintInThisContext(): boolean {
    return window.isSecureContext && this.isBluetoothAvailable();
  }

  isConnected(): boolean {
    return (
      this.status.connection === "connected" &&
      !!this.device?.gatt?.connected &&
      this.writeCharacteristic !== null
    );
  }

  async connect(): Promise<void> {
    if (!this.isBluetoothAvailable()) {
      throw new Error("Web Bluetooth is not available in this browser.");
    }

    if (!window.isSecureContext) {
      throw new Error("Bluetooth printing requires HTTPS or localhost.");
    }

    this.setStatus({
      connection: "connecting",
      message: "Connecting...",
      progress: 0,
    });

    const maybeNavigator = navigator as Navigator & {
      bluetooth?: { requestDevice: (options: unknown) => Promise<any> };
    };

    let device: any;
    try {
      device = await maybeNavigator.bluetooth?.requestDevice({
        filters: [
          { namePrefix: "M" },
          { namePrefix: "D" },
          { namePrefix: "P" },
          { namePrefix: "Q" },
          { namePrefix: "T" },
          { namePrefix: "A" },
          { namePrefix: "Phomemo" },
        ],
        optionalServices: BLE_SERVICE_UUIDS,
      });
    } catch (filterError) {
      device = await maybeNavigator.bluetooth?.requestDevice({
        acceptAllDevices: true,
        optionalServices: BLE_SERVICE_UUIDS,
      });
      if (!device) {
        throw filterError;
      }
    }

    if (!device) {
      throw new Error("No Bluetooth device selected.");
    }

    this.device = device;

    if (!(this.device as any)._fomeprintDisconnectBound) {
      this.device.addEventListener(
        "gattserverdisconnected",
        this.onDisconnected,
      );
      (this.device as any)._fomeprintDisconnectBound = true;
    }

    this.server = await this.device.gatt.connect();
    await delay(100);

    let resolvedService: any = null;
    let lastServiceError: unknown = null;
    for (const serviceUuid of BLE_SERVICE_UUIDS) {
      try {
        resolvedService = await this.server.getPrimaryService(serviceUuid);
        break;
      } catch (error) {
        lastServiceError = error;
      }
    }

    if (!resolvedService) {
      throw new Error(
        `No compatible Bluetooth service found${lastServiceError instanceof Error ? `: ${lastServiceError.message}` : "."}`,
      );
    }

    this.service = resolvedService;
    this.writeCharacteristic = await this.service.getCharacteristic(
      WRITE_CHARACTERISTIC_UUID,
    );

    const properties = this.writeCharacteristic.properties;
    this.useWriteWithResponse =
      !properties?.writeWithoutResponse && !!properties?.write;

    try {
      this.notifyCharacteristic = await this.service.getCharacteristic(
        NOTIFY_CHARACTERISTIC_UUID,
      );
      await this.notifyCharacteristic.startNotifications();
    } catch {
      this.notifyCharacteristic = null;
    }

    this.setStatus({
      connection: "connected",
      deviceName: this.device?.name ?? "Unknown",
      message: `Connected: ${this.device?.name ?? "Unknown"}`,
      progress: 0,
    });
  }

  async disconnect(): Promise<void> {
    if (this.notifyCharacteristic) {
      try {
        await this.notifyCharacteristic.stopNotifications();
      } catch {
        // Ignore cleanup errors during disconnect.
      }
    }

    if (this.device?.gatt?.connected) {
      this.device.gatt.disconnect();
    }

    this.device = null;
    this.server = null;
    this.service = null;
    this.writeCharacteristic = null;
    this.notifyCharacteristic = null;

    this.setStatus({
      connection: "disconnected",
      print: "idle",
      deviceName: "",
      message: "Disconnected",
      progress: 0,
    });
  }

  async printCanvas(canvas: HTMLCanvasElement): Promise<void> {
    if (!this.isConnected()) {
      throw new Error("Please connect to a Phomemo printer first.");
    }

    const deviceName = this.device?.name ?? "";
    const widthBytes = getPrinterWidthBytes(deviceName);
    const raster = convertCanvasToRaster(canvas, widthBytes);

    this.setStatus({
      print: "printing",
      message: "Preparing print job...",
      progress: 0,
    });

    const density = 6;
    const feed = 32;

    try {
      await this.send(CMD.INIT);
      await delay(100);

      const heatTime = densityToHeatTime(density);
      await this.send(CMD.HEAT_SETTINGS(7, heatTime, 2));
      await delay(30);
      await this.send(CMD.DENSITY(density));
      await delay(50);

      await this.send(CMD.RASTER_HEADER(raster.widthBytes, raster.heightLines));
      await delay(30);

      for (let offset = 0; offset < raster.data.length; offset += CHUNK_SIZE) {
        const chunk = raster.data.slice(
          offset,
          Math.min(offset + CHUNK_SIZE, raster.data.length),
        );
        await this.send(chunk);
        await delay(CHUNK_DELAY_MS);

        const progress = Math.round(
          ((offset + chunk.length) / raster.data.length) * 100,
        );
        this.setStatus({
          print: "printing",
          message: `Printing... ${progress}%`,
          progress,
        });
      }

      await delay(300);
      await this.send(CMD.FEED(feed));
      await delay(500);

      this.setStatus({
        print: "idle",
        message: "Print complete.",
        progress: 100,
      });
    } catch (error) {
      this.setStatus({
        print: "idle",
        message:
          error instanceof Error ? error.message : "Print failed unexpectedly.",
      });
      throw error;
    }
  }

  private async send(data: Uint8Array): Promise<void> {
    if (!this.isConnected()) {
      throw new Error("Printer is not connected.");
    }

    const buffer = new Uint8Array(data).buffer;

    if (this.useWriteWithResponse) {
      await this.writeCharacteristic.writeValue(buffer);
      return;
    }

    try {
      await this.writeCharacteristic.writeValueWithoutResponse(buffer);
    } catch {
      this.useWriteWithResponse = true;
      await this.writeCharacteristic.writeValue(buffer);
    }
  }

  private setStatus(partial: Partial<PhomemoPrinterStatus>): void {
    this.status = {
      ...this.status,
      ...partial,
    };

    for (const listener of this.listeners) {
      listener(this.getStatus());
    }
  }
}

const sharedPrinter = new PhomemoBluetoothPrinter();

export function getPhomemoBluetoothPrinter(): PhomemoBluetoothPrinter {
  return sharedPrinter;
}
