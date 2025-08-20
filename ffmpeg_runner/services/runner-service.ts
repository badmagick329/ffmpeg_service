import type { ICmdTranslator } from "../core/icmd-translator";
import { ParsedCmd } from "../core/parsed-cmd";
import type { IFFmpegCommandRunner } from "./iffmpeg-command-runner";

export class RunnerService {
  constructor(
    private readonly runner: IFFmpegCommandRunner,
    private readonly cmdTranslator: ICmdTranslator
  ) {}

  async run({ cmd, debug = false }: { cmd: string; debug: boolean }) {
    // TODO: Add error handling and logging
    const parsed = ParsedCmd.create(cmd);
    const localizedParse = this.cmdTranslator.localizeCmd(parsed);
    return await this.runner.run({ cmd: localizedParse.cmd, debug });
  }
}
