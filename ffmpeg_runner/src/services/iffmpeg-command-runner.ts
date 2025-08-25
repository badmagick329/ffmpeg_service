export interface IFFmpegCommandRunner {
  run({ cmd, debug }: { cmd: string; debug: boolean }): Promise<{
    stderr: string;
    stdout: string;
    exitCode: number;
  }>;
}
