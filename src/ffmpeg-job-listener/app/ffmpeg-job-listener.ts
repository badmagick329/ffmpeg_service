import type { ICmdTranslator } from "@/command-translation/cmd-translator";
import { JobProcessingService } from "@/jobs";
import { ParsedCmd } from "@/command-translation/parsed-cmd";
import type { IFFmpegCommandRunner } from "@/ffmpeg-job-listener/infra/ffmpeg-command-runner";

export class FFmpegJobListener {
  constructor(
    private readonly runner: IFFmpegCommandRunner,
    private readonly cmdTranslator: ICmdTranslator,
    private readonly jobProcessingService: JobProcessingService
  ) {}

  async listen() {
    while (true) {
      const job = this.jobProcessingService.claim();
      if (!job) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        continue;
      }
      try {
        // TODO: Mark failed ffmpeg conversiosn as failed status
        const result = await this.run({ cmd: job.localizedCmd, debug: false });
        console.log(
          `[FFmpegJobListener] - Job ${job.id} completed successfully.`
        );
        if (result.exitCode !== 0) {
          throw new Error(
            `FFmpeg command failed with exit code ${result.exitCode}. Stderr: ${result.stderr}`
          );
        }
        this.jobProcessingService.setSuccess(job.id);
      } catch (error) {
        console.log(`[FFmpegJobListener] - Job ${job.id} failed: ${error}`);
        this.jobProcessingService.setFail(job.id);
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
