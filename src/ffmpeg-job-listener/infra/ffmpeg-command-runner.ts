import type { ICmdTranslator } from "@/command-translation/cmd-translator";
import { ParsedCmd } from "@/command-translation/parsed-cmd";

export interface IFFmpegCommandRunner {
  run({ cmd, debug }: { cmd: string; debug: boolean }): Promise<{
    stderr: string;
    stdout: string;
    exitCode: number;
  }>;
}

export class FFmpegCommandRunner implements IFFmpegCommandRunner {
  constructor(readonly cmdTranslator: ICmdTranslator) {}

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
      console.log(
        "[FFmpegCommandRunner] - Running command in debug:",
        arrayCmd
      );
      return {
        exitCode: 0,
        stderr: "Debug mode: Command not executed",
        stdout: `Command: ${cmd}`,
      };
    }

    try {
      console.log("[FFmpegCommandRunner] - Running command", arrayCmd);
      const proc = Bun.spawn(arrayCmd, {
        stderr: "pipe",
        stdout: "pipe",
      });
      return {
        stderr: await new Response(proc.stderr).text(),
        stdout: await new Response(proc.stdout).text(),
        exitCode: await proc.exited,
      };
    } catch (error) {
      console.log("[FFmpegCommandRunner] - Encountered Error", error);

      return {
        stderr: "",
        stdout: "",
        exitCode: -1,
      };
    }
  }
}
