import type { IInputFilesRepository } from "@/core/repositories/iinput-files-repository";
import { inputFilesManager } from "@/infra/db";
import * as path from "node:path";

export class InputFilesRepository implements IInputFilesRepository {
  private _add: typeof inputFilesManager.add;
  private _remove: typeof inputFilesManager.remove;
  private _getByInputFile: typeof inputFilesManager.getByInputFile;

  constructor() {
    this._add = inputFilesManager.add;
    this._remove = inputFilesManager.remove;
    this._getByInputFile = inputFilesManager.getByInputFile;
  }

  add(inputFile: string) {
    const result = this._add.get({ $input_file: path.basename(inputFile) }) as
      | { id: number; input_file: string }
      | undefined;
    return result ? { id: result.id, inputFile: result.input_file } : null;
  }

  remove(inputFile: string) {
    const result = this._remove.get({
      $input_file: path.basename(inputFile),
    }) as { id: number; input_file: string } | undefined;
    return result ? { id: result.id, inputFile: result.input_file } : null;
  }

  exists(inputFile: string): boolean {
    const result = this._getByInputFile.get({
      $input_file: path.basename(inputFile),
    }) as { input_file: string } | undefined;
    return result?.input_file === inputFile;
  }
}
