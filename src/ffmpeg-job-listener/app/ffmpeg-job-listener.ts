import type { ICmdTranslator } from "@/command-translation/cmd-translator";
import { JobProcessingService } from "@/jobs";
import { ParsedCmd } from "@/command-translation/parsed-cmd";
import type { IFFmpegCommandRunner } from "@/ffmpeg-job-listener/infra/ffmpeg-command-runner";
import type { LoggerPort } from "@/common/logger-port";

export class FFmpegJobListener {
  private readonly log: LoggerPort;
  constructor(
    private readonly runner: IFFmpegCommandRunner,
    private readonly cmdTranslator: ICmdTranslator,
    private readonly jobProcessingService: JobProcessingService,
    private readonly pollInterval: number,
    logger: LoggerPort
  ) {
    this.log = logger.withContext({ service: "FFmpegJobListener" });
  }

  async listen() {
    this.log.info("Starting FFmpeg job listener", {
      pollInterval: this.pollInterval,
    });
    while (true) {
      const job = this.jobProcessingService.claim();
      if (!job) {
        await new Promise((resolve) => setTimeout(resolve, this.pollInterval));
        continue;
      }
      try {
        const result = await this.run({ cmd: job.localizedCmd, debug: false });
        if (result.exitCode !== 0) {
          throw new Error(
            `FFmpeg command failed with exit code ${result.exitCode}. Stderr: ${result.stderr}`
          );
        }
        this.log.info(`Job ${job.id} completed successfully.`, { result });
        this.jobProcessingService.setSuccess(job.id);
      } catch (error) {
        this.log.error(`Job ${job.id} failed: ${error}`);
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
