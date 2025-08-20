type CmdParts = {
  start: string;
  input: string;
  params: string;
  output: string;
};

export class ParsedCmd {
  private static cmdRegex =
    /(?<start>.+?)"(?<input>.+)"(?<params>.+?)"(?<output>.+)"/;

  constructor(
    public readonly cmd: string,
    public readonly start: string,
    public readonly input: string,
    public readonly params: string,
    public readonly output: string
  ) {}

  static create(cmd: string): ParsedCmd {
    const parts = ParsedCmd.getParts(cmd);
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
