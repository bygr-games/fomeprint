import { executeCommand } from "../../ktu/helpers/commands_manager";
import { FireErrorMessageCommand } from "../commands/fomeprint/fire_error_message_command";
import { DataStore } from "fra.ktu.red-component";

export type CameraDeviceOption = {
  id: string;
  label: string;
};

export const refreshAvailableCameras = async () => {
  let availableCameras: CameraDeviceOption[] = [];
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices ||
    typeof navigator.mediaDevices.enumerateDevices !== "function"
  ) {
    executeCommand(
      new FireErrorMessageCommand(
        "Camera access is not supported in this browser.",
      ),
    );
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    availableCameras = devices
      .filter((device) => device.kind === "videoinput")
      .map((device, index) => ({
        id: device.deviceId,
        label: device.label || `Camera ${index + 1}`,
      }))
      .filter((camera) => camera.id.length > 0);
  } catch {
    availableCameras = [];
    executeCommand(
      new FireErrorMessageCommand("Could not list camera devices."),
    );
  }
  DataStore.getInstance().setStore(
    "fomeprint.availableCameras",
    availableCameras,
  );
};
