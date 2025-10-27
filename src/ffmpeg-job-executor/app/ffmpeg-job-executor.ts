import type { ICmdTranslator } from "@/command-translation/cmd-translator";
import { JobLifecycleService } from "@/jobs";
import { ParsedCmd } from "@/command-translation/parsed-cmd";
import type { IFFmpegCommandRunner } from "@/ffmpeg-job-executor/infra/ffmpeg-command-runner";
import type { LoggerPort } from "@/common/logger-port";
import { basename, join } from "node:path";

export class FFmpegJobExecutor {
  private readonly log: LoggerPort;
  constructor(
    private readonly runner: IFFmpegCommandRunner,
    private readonly cmdTranslator: ICmdTranslator,
    private readonly jobLifecycleService: JobLifecycleService,
    private readonly pollInterval: number,
    private readonly successDir: string,
    logger: LoggerPort
  ) {
    this.log = logger.withContext({ service: "FFmpegJobListener" });
  }

  async start() {
    this.log.info(
      `Starting FFmpeg job listener with polling interval: ${this.pollInterval}ms`,
      {
        pollInterval: this.pollInterval,
      }
    );
    while (true) {
      const job = this.jobLifecycleService.claim();
      if (!job) {
        await Bun.sleep(this.pollInterval);
        continue;
      }
      try {
        const result = await this.run({ cmd: job.localizedCmd, debug: false });
        if (result.exitCode !== 0) {
          throw new Error(
            `FFmpeg command failed with exit code ${result.exitCode}. Stderr: ${result.stderr}`
          );
        }
        const cmd = ParsedCmd.create(job.localizedCmd);
        const successName = `${basename(cmd.output)}.done`;
        const successFile = Bun.file(join(this.successDir, successName));
        await successFile.write(`Job ${job.id} completed successfully.`);

        this.log.info(`Job ${job.id} completed successfully.`, { result });
        this.jobLifecycleService.setSuccess(job.id);
      } catch (error) {
        this.log.error(`Job ${job.id} failed: ${error}`);
        this.jobLifecycleService.setFail(job.id);
      }
    }
  }

  private async run({ cmd, debug = false }: { cmd: string; debug: boolean }) {
    const parsed = ParsedCmd.create(cmd);
    const localizedParse = this.cmdTranslator.localizeCmd(parsed);
    return await this.runner.run({ cmd: localizedParse.cmd, debug });
  }

  // Public helper for tests and manual invocation
  async execute({ cmd, debug = false }: { cmd: string; debug: boolean }) {
    return this.run({ cmd, debug });
  }
}
