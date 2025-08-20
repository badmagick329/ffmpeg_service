import type { IInputFilesRepository } from "../../core/iinput-files-repository";
import { jobsManager, inputFilesManager } from "../db";

export class InputFilesRepository implements IInputFilesRepository {
  private _add: typeof inputFilesManager.add;
  private _remove: typeof inputFilesManager.remove;
  private _updateStatus: typeof jobsManager.updateStatus;
  private _getByFilepath: typeof inputFilesManager.getByFilepath;

  constructor() {
    this._add = inputFilesManager.add;
    this._remove = inputFilesManager.remove;
    this._updateStatus = jobsManager.updateStatus;
    this._getByFilepath = inputFilesManager.getByFilepath;
  }

  add(filepath: string) {
    const result = this._add.get({ $filepath: filepath }) as
      | { id: number; filepath: string }
      | undefined;
    // TODO: Mark jobs with this input + status missing_input as pending
    return result ? { id: result.id, filepath: result.filepath } : null;
  }

  remove(filepath: string) {
    this._remove.run({ $filepath: filepath });
  }

  exists(filepath: string): boolean {
    const result = this._getByFilepath.get({ $filepath: filepath }) as
      | { filepath: string }
      | undefined;
    return result?.filepath === filepath;
  }

  updateStatus(filepath: string, status: string) {
    this._updateStatus.run({ $input_file: filepath, $status: status });
  }
}
