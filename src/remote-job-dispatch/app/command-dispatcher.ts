import type { ServerConfig } from "@/infra/config";
import type { IFileOperations } from "@/remote-job-dispatch/core/ifile-operations";
import { ClientStateManager } from "@/remote-job-dispatch/core/client-state-manager";
import { ServerSelector } from "@/remote-job-dispatch/core/server-selector";
import { ParsedCmd } from "@/command-translation/parsed-cmd";
import { createProgressBar } from "@/remote-job-dispatch/utils/progress-bar";
import { readdir, exists } from "node:fs/promises";
import { basename, resolve, join } from "path";

export interface DispatchSummary {
  commandFilesProcessed: number;
  commandFilesSkipped: number;
  serversDispatched: string[];
  totalInputFilesUploaded: number;
  totalOutputFilesExpected: number;
  errors: string[];
  text: string;
}

export interface SkipDetails {
  reason: string;
  server: string;
}

export class CommandDispatcher {
  private readonly log = console.log;
  private fileOperations: IFileOperations;
  private stateManager: ClientStateManager;
  private cmdsInputDir: string;
  private serverConfigs: ServerConfig[];

  constructor({
    fileOperations,
    stateManager,
    cmdsInputDir,
    serverConfigs,
  }: {
    fileOperations: IFileOperations;
    stateManager: ClientStateManager;
    cmdsInputDir: string;
    serverConfigs: ServerConfig[];
  }) {
    this.fileOperations = fileOperations;
    this.stateManager = stateManager;
    this.cmdsInputDir = cmdsInputDir;
    this.serverConfigs = serverConfigs;
  }

  async dispatchAllCommands(): Promise<DispatchSummary> {
    const summary: DispatchSummary = {
      commandFilesProcessed: 0,
      commandFilesSkipped: 0,
      serversDispatched: [],
      totalInputFilesUploaded: 0,
      totalOutputFilesExpected: 0,
      errors: [],
      text: "",
    };

    const commandFiles = await this.scanCommandFiles();

    if (commandFiles.length === 0) {
      this.log("No non-empty command files found");
      return summary;
    }

    this.log(`Found ${commandFiles.length} command file(s) to process...`);

    for (const filePath of commandFiles) {
      try {
        const result = await this.processCommandFile(filePath);

        if (result.kind === "skip") {
          summary.commandFilesSkipped++;
          summary.errors.push(result.reason || "Unknown reason");
        } else {
          summary.commandFilesProcessed++;
          summary.serversDispatched.push(result.server!);
          summary.totalInputFilesUploaded += result.inputFilesUploaded || 0;
          summary.totalOutputFilesExpected += result.outputFilesExpected || 0;
        }
      } catch (error) {
        summary.commandFilesSkipped++;
        summary.errors.push(`${basename(filePath)}: ${error}`);
        console.error(`Error processing ${basename(filePath)}:`, error);
      }
    }
    summary.text = this.createDispatchSummary(summary);

    return summary;
  }

  private createDispatchSummary(summary: DispatchSummary) {
    const summaryLines = [
      "\n--- Dispatch Summary ---",
      `Command files processed: ${summary.commandFilesProcessed}`,
      `Command files skipped: ${summary.commandFilesSkipped}`,
    ];

    if (summary.serversDispatched.length > 0) {
      summaryLines.push(
        `Servers dispatched to: ${summary.serversDispatched.join(", ")}`
      );
    }
    if (summary.totalInputFilesUploaded > 0) {
      summaryLines.push(
        `Total input files uploaded: ${summary.totalInputFilesUploaded}`
      );
    }
    if (summary.totalOutputFilesExpected > 0) {
      summaryLines.push(
        `Total output files expected: ${summary.totalOutputFilesExpected}`
      );
    }
    if (summary.errors.length > 0) {
      summaryLines.push(`\n⚠️ Errors encountered:`);
      summary.errors.forEach((err) => summaryLines.push(`  - ${err}`));
    }
    return summaryLines.join("\n");
  }

  private async scanCommandFiles(): Promise<string[]> {
    if (!(await exists(this.cmdsInputDir))) {
      this.log(`Command directory does not exist: ${this.cmdsInputDir}`);
      return [];
    }

    const files = await readdir(this.cmdsInputDir);
    const commandFiles: string[] = [];

    for (const file of files) {
      const filePath = join(this.cmdsInputDir, file);

      try {
        const commands = await this.readCommandsUnique(filePath);
        if (commands.length > 0) {
          commandFiles.push(filePath);
        }
      } catch (error) {
        this.log(`⚠️ Could not stat file: ${file}`);
      }
    }

    return commandFiles;
  }

  private async processCommandFile(filePath: string): Promise<
    | {
        kind: "skip";
        reason: string;
      }
    | {
        kind: "ok";
        server: string;
        inputFilesUploaded: number;
        outputFilesExpected: number;
      }
  > {
    this.log(`\nProcessing: ${basename(filePath)}`);

    const serverResult = await this.getServerOrSkip(filePath);
    if (serverResult.kind === "skip") {
      return { reason: serverResult.reason, kind: "skip" };
    }
    const server = serverResult.server;
    this.log(`  Target server: ${server.serverName}`);
    return await this.processCommands(server, filePath);
  }

  private async getServerOrSkip(filePath: string): Promise<
    | {
        server: ServerConfig;
        kind: "ok";
      }
    | {
        kind: "skip";
        reason: string;
      }
  > {
    const serverSelector = new ServerSelector(this.serverConfigs);
    const server = serverSelector.selectServer(filePath);

    if (!server) {
      const reason = `No matching server found for file: ${basename(filePath)}`;
      this.log(`  ✗ ${reason}`);
      this.log(
        `    Available servers: ${this.serverConfigs
          .map((s) => s.serverName)
          .join(", ")}`
      );
      return { reason, kind: "skip" };
    }

    // NOTE: Allowing queueing of additional work for now
    // if (!this.stateManager.isServerIdle(server.serverName)) {
    //   const reason = `Server ${server.serverName} already has pending work`;
    //   this.log(`  ✗ ${reason}`);
    //   this.log(
    //     `    Wait for current batch to complete before dispatching new work`
    //   );
    //   return { skipped: true, reason };
    // }
    return { server, kind: "ok" };
  }

  private async processCommands(
    server: ServerConfig,
    filePath: string
  ): Promise<
    | {
        kind: "skip";
        reason: string;
      }
    | {
        kind: "ok";
        server: string;
        inputFilesUploaded: number;
        outputFilesExpected: number;
      }
  > {
    const commands = await this.readCommandsUnique(filePath);
    if (commands.length === 0) {
      const reason = "No valid commands found in file";
      this.log(`  ✗ ${reason}`);
      return { kind: "skip", reason };
    }
    this.log(`  Found ${commands.length} command(s) with unique outputs.`);

    const { inputFiles, expectedResults } =
      await this.getNewInputFilesAndExpectedResults(server, commands);

    await this.uploadCommandFile(server, filePath);
    const uploadedCount = await this.uploadInputFiles(server, inputFiles);

    for (const result of expectedResults) {
      const remoteFile = `${server.copyFrom}/${basename(result.outputFile)}`;

      await this.stateManager.addPendingDownload(server.serverName, {
        outputFile: result.outputFile,
        relatedInputFile: result.relatedInputFile,
        remoteFile,
      });
    }

    this.log(`  ✓ Dispatched to ${server.serverName}`);

    return {
      kind: "ok",
      server: server.serverName,
      inputFilesUploaded: uploadedCount,
      outputFilesExpected: expectedResults.length,
    };
  }

  private async getNewInputFilesAndExpectedResults(
    server: ServerConfig,
    commands: string[]
  ) {
    const skipInputs = [] as string[];
    const inputFiles = [] as string[];
    const expectedResults = [] as {
      outputFile: string;
      relatedInputFile: string;
    }[];
    const uploadedInputs = this.stateManager
      .getAllUploadedInputFiles(server.serverName)
      .map((f) => f.localFile);
    const pendingOutputs = this.stateManager
      .getAllPendingDownloads(server.serverName)
      .map((f) => f.outputFile);

    for (const command of commands) {
      const cmd = ParsedCmd.create(command);
      if (pendingOutputs.includes(cmd.output)) {
        continue;
      }

      if (skipInputs.includes(cmd.input) || !(await exists(cmd.input))) {
        skipInputs.push(cmd.input);
        this.log(`  ⚠️ Input file not found: ${cmd.input}`);
        continue;
      }
      if (!uploadedInputs.includes(cmd.input)) {
        inputFiles.push(cmd.input);
      }
      expectedResults.push({
        outputFile: cmd.output,
        relatedInputFile: cmd.input,
      });
    }
    return { inputFiles, expectedResults };
  }

  private async readCommandsUnique(filePath: string): Promise<string[]> {
    return [...new Set(await this.readCommands(filePath))];
  }

  private async readCommands(filePath: string): Promise<string[]> {
    try {
      const content = await Bun.file(filePath).text();
      return content
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"));
    } catch (error) {
      console.error(`Error reading command file ${filePath}:`, error);
      return [];
    }
  }

  private async uploadCommandFile(
    server: ServerConfig,
    filePath: string
  ): Promise<void> {
    this.log(`  Uploading command file to ${server.serverName}...`);

    const remoteFile = `${server.remoteCmdsDir}/${basename(filePath)}`;
    await this.fileOperations.uploadFile(server, filePath, remoteFile);

    this.log(`  ✓ Command file uploaded`);
  }

  private async uploadInputFiles(
    server: ServerConfig,
    inputFiles: string[]
  ): Promise<number> {
    if (inputFiles.length === 0) {
      return 0;
    }

    this.log(`  Uploading ${inputFiles.length} input file(s)...`);

    let uploaded = 0;
    let skipped = 0;

    for (const file of inputFiles) {
      const remoteFile = `${server.copyTo}/${basename(file)}`;

      const shouldUpload = await this.fileOperations.shouldUploadFile(
        server,
        file,
        remoteFile
      );

      if (!shouldUpload) {
        this.log(
          `    Skipping ${basename(file)} - already exists with matching size`
        );
        skipped++;
      } else {
        this.log(`    ↑ Uploading: ${basename(file)}`);
        const progressBar = createProgressBar();

        await this.fileOperations.uploadFile(
          server,
          file,
          remoteFile,
          progressBar.show
        );

        progressBar.finish();
        uploaded++;
        this.log(`    ✓ Uploaded: ${basename(file)}`);
      }

      await this.stateManager.addUploadedInputFile(server.serverName, {
        localFile: file,
        remoteFile,
      });
    }

    this.log(
      `  ${uploaded} uploaded, ${skipped} skipped, ${inputFiles.length} total`
    );

    return uploaded;
  }
}
