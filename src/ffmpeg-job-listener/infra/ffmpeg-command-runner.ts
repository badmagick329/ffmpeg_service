import type { ICmdTranslator } from "@/command-translation/cmd-translator";
import { ParsedCmd } from "@/command-translation/parsed-cmd";
import type { LoggerPort } from "@/common/logger-port";
import { JOB_STATUS } from "@/jobs";
import type { AppState } from "@/tui/lib/app-state";

export interface IFFmpegCommandRunner {
  run({ cmd, debug }: { cmd: string; debug: boolean }): Promise<{
    stderr: string;
    stdout: string;
    exitCode: number;
  }>;
}

export class FFmpegCommandRunner implements IFFmpegCommandRunner {
  private readonly appState: AppState;
  private readonly log: LoggerPort;

  constructor(
    readonly cmdTranslator: ICmdTranslator,
    appState: AppState,
    logger: LoggerPort
  ) {
    this.appState = appState;
    this.log = logger.withContext({ service: "FFmpegCommandRunner" });
  }

  /**
   * @param cmd - The command to run, e.g. 'ffmpeg -y -i "./input.mkv" -c:v libx264 -crf 24 -preset slow -c:a copy -vf bwdif=mode=1:parity=auto:deint=1 -ss 00:00:05.380 -to 00:00:13.054 "./output.mkv"'
   * @param debug - If true, the command will not be executed, and instead, it will log the command to the console.
   *
   * @return An object containing the exit code, stderr, and stdout of the command execution.
   */
  async run({ cmd, debug = false }: { cmd: string; debug: boolean }): Promise<{
    stderr: string;
    stdout: string;
    exitCode: number;
  }> {
    const parsed = ParsedCmd.create(cmd);
    const arrayCmd = this.cmdTranslator.cmdToArray(parsed);
    if (debug) {
      this.log.info(`Running command in debug: ${arrayCmd.join(" ")}`, {
        cmd: arrayCmd,
      });
      return {
        exitCode: 0,
        stderr: "Debug mode: Command not executed",
        stdout: `Command: ${cmd}`,
      };
    }

    try {
      this.log.info(`Running command: ${arrayCmd.join(" ")}`, {
        cmd: arrayCmd,
      });
      const proc = Bun.spawn(arrayCmd, {
        stderr: "pipe",
        stdout: "pipe",
      });
      const errResponse = await new Response(proc.stderr).text();
      const outResponse = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;
      this.appState.updateJobStatus(
        cmd,
        exitCode === 0 ? JOB_STATUS.SUCCEEDED : JOB_STATUS.FAILED
      );
      return {
        stderr: errResponse,
        stdout: outResponse,
        exitCode: exitCode,
      };
    } catch (error) {
      this.log.error(`Encountered Error: ${error}`, { error });
      this.appState.updateJobStatus(cmd, JOB_STATUS.FAILED);

      return {
        stderr: "",
        stdout: "",
        exitCode: -1,
      };
    }
  }
}
