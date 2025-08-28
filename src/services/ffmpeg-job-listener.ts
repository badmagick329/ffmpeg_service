import type { ICmdTranslator } from "@/core/translators/cmd-translator";
import type { IJobsRepository } from "@/core/repositories/ijobs-repository";
import { ParsedCmd } from "@/core/models/parsed-cmd";
import type { IFFmpegCommandRunner } from "@/services/iffmpeg-command-runner";

export class FFmpegJobListener {
  constructor(
    private readonly runner: IFFmpegCommandRunner,
    private readonly cmdTranslator: ICmdTranslator,
    private readonly jobRepo: IJobsRepository
  ) {}

  async listen() {
    while (true) {
      // NOTE: Hardcoded worker ID for now
      const job = this.jobRepo.claim(1);
      if (!job) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        continue;
      }
      try {
        // TODO: Mark failed ffmpeg conversiosn as failed status
        await this.run({ cmd: job.localizedCmd, debug: false });
        console.log(
          `[FFmpegJobListener] - Job ${job.id} completed successfully.`
        );
        this.jobRepo.updateStatus(job.localizedCmd, "succeeded");
      } catch (error) {
        console.log(`[FFmpegJobListener] - Job ${job.id} failed: ${error}`);
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

  // Public helper for tests and manual invocation
  async execute({ cmd, debug = false }: { cmd: string; debug: boolean }) {
    return this.run({ cmd, debug });
  }
}
