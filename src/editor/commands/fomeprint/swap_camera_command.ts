import { DataStore } from "fra.ktu.red-component";
import type { ICommand } from "../icommand";
import {
  refreshAvailableCameras,
  type CameraDeviceOption,
} from "../../managers/camera_manager";
import { executeCommand } from "../../../ktu/helpers/commands_manager";
import { SetLayerFieldCommand } from "../layers/set_layer_field_command";
import { FireErrorMessageCommand } from "./fire_error_message_command";

export class SwapCameraCommand implements ICommand {
  historyLabel = "Swap Camera";

  execute(): void {
    void this.swapCamera();
  }

  private async swapCamera(): Promise<void> {
    try {
      await refreshAvailableCameras();

      const availableCameras =
        (DataStore.getInstance().getStore("fomeprint.availableCameras") as
          | CameraDeviceOption[]
          | undefined) ?? [];

      if (availableCameras.length < 1) {
        executeCommand(new FireErrorMessageCommand("No camera available."));
        return;
      }

      const currentIndexRaw = Number(
        DataStore.getInstance().getStore("fomeprint.cameraIndex"),
      );
      const currentIndex = Number.isFinite(currentIndexRaw)
        ? Math.max(0, Math.floor(currentIndexRaw))
        : 0;

      const nextCameraIndex = (currentIndex + 1) % availableCameras.length;
      const nextCameraId = availableCameras[nextCameraIndex]?.id;
      if (!nextCameraId) {
        executeCommand(
          new FireErrorMessageCommand("Could not resolve next camera."),
        );
        return;
      }

      DataStore.getInstance().setStore(
        "fomeprint.cameraIndex",
        nextCameraIndex,
      );
      const layerId = Number(
        DataStore.getInstance().getStore("fomeprint.cameraLayerId"),
      );
      if (!Number.isFinite(layerId)) {
        executeCommand(
          new FireErrorMessageCommand("Camera layer is not available."),
        );
        return;
      }

      executeCommand(
        new SetLayerFieldCommand(layerId, "cameraId", nextCameraId),
      );
    } catch (error) {
      console.error("Error swapping camera:", error);
      executeCommand(new FireErrorMessageCommand("Could not swap camera."));
    }
  }

  revert(): void {}

  undoable?: boolean = false;
}
