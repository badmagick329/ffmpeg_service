import type { ICmdTranslator } from "../core/icmd-translator";
import type { IFFmpegCommandRunner } from "./iffmpeg-command-runner";

export class RunnerService {
  constructor(
    private readonly runner: IFFmpegCommandRunner,
    private readonly cmdTranslator: ICmdTranslator
  ) {}

  async run({ cmd, debug = false }: { cmd: string; debug: boolean }) {
    // TODO: Add error handling and logging
    const localizeCmd = this.cmdTranslator.localizeCmd(cmd);
    return await this.runner.run({ cmd: localizeCmd, debug });
  }
}
