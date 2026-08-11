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
    try {
      refreshAvailableCameras();

      const availableCameras: CameraDeviceOption[] =
        DataStore.getInstance().getStore("fomeprint.availableCameras");
      const cameraIndex: number = DataStore.getInstance().getStore(
        "fomeprint.cameraIndex",
      );

      executeCommand(
        new FireErrorMessageCommand(
          `Available cameras: ${availableCameras.map((camera) => camera.id + " - " + camera.label).join(", ")}`,
        ),
      );

      const nextCameraIndex = (cameraIndex + 1) % availableCameras.length;
      const nextCameraId = availableCameras[nextCameraIndex].id;

      DataStore.getInstance().setStore(
        "fomeprint.cameraIndex",
        nextCameraIndex,
      );
      const layerId = DataStore.getInstance().getStore(
        "fomeprint.cameraLayerId",
      );

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
