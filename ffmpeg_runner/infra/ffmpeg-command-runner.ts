import type { ICmdConverter } from "../core/iCmdCoverter";
import type { IFFmpegCommandRunner } from "../services/iffmpeg-command-runner";

export class FFmpegCommandRunner implements IFFmpegCommandRunner {
  constructor(private readonly cmdConverter: ICmdConverter) {}

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
    const arrayCmd = this.cmdConverter.cmdToArray(cmd);
    if (debug) {
      console.log("Running command in debug:", arrayCmd);
      return {
        exitCode: 0,
        stderr: "Debug mode: Command not executed",
        stdout: `Command: ${cmd}`,
      };
    }

    console.log("Running command", arrayCmd);
    const proc = Bun.spawn(arrayCmd, {
      stderr: "pipe",
      stdout: "pipe",
    });
    return {
      stderr: await new Response(proc.stderr).text(),
      stdout: await new Response(proc.stdout).text(),
      exitCode: await proc.exited,
    };
  }
}
