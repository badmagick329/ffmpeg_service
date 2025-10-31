type CmdParts = {
  start: string;
  input: string;
  params: string;
  output: string;
};

export class ParsedCmd {
  private static cmdRegex =
    /^(?<start>[^#]+ .*-i\s+)"(?<input>(.+?))"(?<params>.+?)"(?<output>[^"]+)"$/;

  constructor(
    public readonly cmd: string,
    public readonly start: string,
    public readonly input: string,
    public readonly params: string,
    public readonly output: string
  ) {}

  /**
   * Creates a ParsedCmd instance from a raw ffmpeg command string.
   *
   * @param cmd - The raw ffmpeg command string.
   * @returns A ParsedCmd instance.
   * @throws {Error} If the command format is invalid.
   */
  static create(cmd: string): ParsedCmd {
    const parts = ParsedCmd.getParts(cmd);

    const startArgs = parts.start.split(" ").filter((w) => Boolean(w));
    const newStartArgs = [] as string[];
    startArgs.includes("-y") || newStartArgs.push("-y");
    startArgs.includes("-hide_banner") || newStartArgs.push("-hide_banner");
    startArgs.includes("-nostdin") || newStartArgs.push("-nostdin");
    startArgs.splice(startArgs.length - 1, 0, ...newStartArgs);
    parts.start = startArgs.join(" ") + " ";

    return { cmd, ...parts };
  }

  private static getParts(cmd: string): CmdParts {
    const match = cmd.match(ParsedCmd.cmdRegex);
    if (!match) {
      throw new Error(
        `Invalid command format: ${cmd}. Expected format: <start> <input> <params> <output>`
      );
    }
    const { start, input, params, output } = match.groups!;
    if (!start || !input || !params || !output) {
      throw new Error(
        `Invalid command format: ${cmd}. Expected format: <start> <input> <params> <output>`
      );
    }

    return {
      start,
      input,
      params,
      output,
    };
  }
}
