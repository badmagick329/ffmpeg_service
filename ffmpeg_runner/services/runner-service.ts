import type { IFFmpegCommandRunner } from "./iffmpeg-command-runner";

export class RunnerService {
  constructor(private readonly runner: IFFmpegCommandRunner) {}

  async run({ cmd, debug = false }: { cmd: string; debug: boolean }) {
    // TODO: Add error handling and logging
    return await this.runner.run({ cmd, debug });
  }
}
