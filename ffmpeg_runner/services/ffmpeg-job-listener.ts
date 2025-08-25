import type { ICmdTranslator } from "../core/icmd-translator";
import type { IJobsRepository } from "../core/ijobs-repository";
import { ParsedCmd } from "../core/parsed-cmd";
import type { IFFmpegCommandRunner } from "./iffmpeg-command-runner";

export class FFmpegJobListener {
  constructor(
    private readonly runner: IFFmpegCommandRunner,
    private readonly cmdTranslator: ICmdTranslator,
    private readonly jobRepo: IJobsRepository
  ) {}

  async watch() {
    while (true) {
      // NOTE: Hardcoded worker ID for now
      const job = this.jobRepo.claim(1);
      if (!job) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        continue;
      }
      try {
        await this.run({ cmd: job.localizedCmd, debug: false });
        console.log(`Job ${job.id} completed successfully.`);
        this.jobRepo.updateStatus(job.localizedCmd, "succeeded");
      } catch (error) {
        console.log(`Job ${job.id} failed: ${error}`);
        this.jobRepo.updateStatus(job.localizedCmd, "failed");
      }
    }
  }

  private async run({ cmd, debug = false }: { cmd: string; debug: boolean }) {
    // TODO: Add error handling and logging
    const parsed = ParsedCmd.create(cmd);
    const localizedParse = this.cmdTranslator.localizeCmd(parsed);
    return await this.runner.run({ cmd: localizedParse.cmd, debug });
  }
}
