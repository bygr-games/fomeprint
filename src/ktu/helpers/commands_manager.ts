import { DataStore } from "fra.ktu.red-component";
import type { ICommand } from "../../editor/commands/icommand";
import { SetLayerFieldCommand } from "../../editor/commands/layers/set_layer_field_command";
import { SetModulatorFieldCommand } from "../../editor/commands/modulators/set_modulator_field_command";
import { SetShaderFieldCommand } from "../../editor/commands/shaders/set_shader_field_command";

const getCommandsQueue = () => {
  let queue = DataStore.getInstance().getStore("commandsQueue") as
    | ICommand[]
    | undefined;
  if (!queue) {
    queue = [];
    DataStore.getInstance().setStore("commandsQueue", queue);
  }
  return queue;
};

const getRedoQueue = () => {
  let queue = DataStore.getInstance().getStore("redoQueue") as
    | ICommand[]
    | undefined;
  if (!queue) {
    queue = [];
    DataStore.getInstance().setStore("redoQueue", queue);
  }
  return queue;
};

const shouldConsolidateCommands = (
  newCommand: ICommand,
  previousCommand: ICommand,
): boolean => {
  // Check SetLayerFieldCommand consolidation
  if (
    newCommand instanceof SetLayerFieldCommand &&
    previousCommand instanceof SetLayerFieldCommand
  ) {
    return (
      newCommand.id === previousCommand.id &&
      newCommand.field === previousCommand.field
    );
  }

  // Check SetModulatorFieldCommand consolidation
  if (
    newCommand instanceof SetModulatorFieldCommand &&
    previousCommand instanceof SetModulatorFieldCommand
  ) {
    return (
      newCommand.id === previousCommand.id &&
      newCommand.field === previousCommand.field
    );
  }

  // Check SetShaderFieldCommand consolidation
  if (
    newCommand instanceof SetShaderFieldCommand &&
    previousCommand instanceof SetShaderFieldCommand
  ) {
    return (
      newCommand.id === previousCommand.id &&
      newCommand.field === previousCommand.field &&
      newCommand.owner === previousCommand.owner
    );
  }

  return false;
};

export function executeCommand(command: ICommand) {
  console.log("Executing command:", command);
  command.execute();
  if (command.undoable !== false) {
    const commandsQueue = getCommandsQueue();
    const previousCommand = commandsQueue[commandsQueue.length - 1];

    // Check if we should consolidate with the previous command
    if (
      previousCommand &&
      shouldConsolidateCommands(command, previousCommand)
    ) {
      console.log("Consolidating command with previous command");
      // Update the previous command's value with the new value
      (previousCommand as any).value = (command as any).value;
      // Re-execute the consolidated command
      previousCommand.execute();

      // If the value has returned to the original, remove the command from history
      if (
        (previousCommand as any).oldValue === (previousCommand as any).value
      ) {
        console.log("Value returned to original, removing from history");
        commandsQueue.pop();
      }
    } else {
      commandsQueue.push(command);
    }

    DataStore.getInstance().touch("commandsQueue");
    clearRedo();
    window.localStorage.setItem(
      "autosavedState",
      JSON.stringify({
        data: DataStore.getInstance().getStore("editorScene"),
        dataAt: Date.now(),
      }),
    );
  }
}

export function undoCommand(untilCommand?: ICommand) {
  let command = getCommandsQueue().pop();
  if (command) {
    command.revert();
    getRedoQueue().push(command!);
  }
  console.log("Undoing command:", command, "until:", untilCommand);
  while (
    untilCommand &&
    command !== untilCommand &&
    getCommandsQueue().length > 0
  ) {
    command = getCommandsQueue().pop();
    if (command) {
      command.revert();
      getRedoQueue().push(command!);
    }
  }
  DataStore.getInstance().touch("commandsQueue");
  DataStore.getInstance().touch("redoQueue");
}

export function redoCommand(untilCommand?: ICommand) {
  let command = getRedoQueue().pop();
  if (command) {
    console.log("Redoing command:", command, "until:", untilCommand);
    command.execute();
    getCommandsQueue().push(command!);
  }
  while (
    untilCommand &&
    command !== untilCommand &&
    getRedoQueue().length > 0
  ) {
    command = getRedoQueue().pop();
    if (command) {
      console.log("Redoing command:", command, "until:", untilCommand);
      command.execute();
      getCommandsQueue().push(command!);
    }
  }
  DataStore.getInstance().touch("redoQueue");
  DataStore.getInstance().touch("commandsQueue");
}

export function canUndo(): boolean {
  return getCommandsQueue().length > 0;
}

export function canRedo(): boolean {
  return getRedoQueue().length > 0;
}

export function clearCommands() {
  getCommandsQueue().length = 0;
  DataStore.getInstance().touch("commandsQueue");
}

export function clearRedo() {
  getRedoQueue().length = 0;
  DataStore.getInstance().touch("redoQueue");
}
