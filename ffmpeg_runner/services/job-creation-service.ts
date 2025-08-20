import type { ICmdTranslator } from "../core/icmd-translator";

export class JobCreationService {
  constructor(private readonly cmdTranslator: ICmdTranslator) {}

  prepare(ffmpegCmd: string) {
    const arrayCmd = this.cmdTranslator.cmdToArray(ffmpegCmd);
  }
}
