import type { RemoteConfig } from "@/infra/config";
import type { IFileOperations } from "@/remote-job-dispatch/core/ifile-operations";
import { ClientStateManager } from "@/remote-job-dispatch/core/client-state-manager";
import { ServerSelector } from "@/remote-job-dispatch/core/server-selector";
import { ParsedCmd } from "@/command-translation/parsed-cmd";
import { createProgressBar } from "@/remote-job-dispatch/utils/progress-bar";
import { readdir, exists } from "node:fs/promises";
import { basename, join } from "path";
import { ParsedCommandFile } from "@/remote-job-dispatch/core/parsed-command-file";
import { Result } from "@/common/result";
import { ServerSelectionError } from "@/remote-job-dispatch/core/errors";
import { FileIOError } from "../core/errors";

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
  private serverConfigs: RemoteConfig[];

  constructor({
    fileOperations,
    stateManager,
    cmdsInputDir,
    serverConfigs,
  }: {
    fileOperations: IFileOperations;
    stateManager: ClientStateManager;
    cmdsInputDir: string;
    serverConfigs: RemoteConfig[];
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
      this.log(`\nProcessing: ${basename(filePath)}`);

      const serverResult = await this.getServerOrSkip(filePath);
      if (serverResult.isFailure) {
        summary.commandFilesSkipped++;
        summary.errors.push(serverResult.unwrapError().message);
        continue;
      }
      const server = serverResult.unwrap();

      const outputFilesInBatch = this.stateManager
        .getAllPendingDownloads(server.serverName)
        .map((d) => d.outputFile);

      this.log(`  Target server: ${server.serverName}`);

      const preprocessResult = await this.preprocessCommandFile(
        filePath,
        outputFilesInBatch
      );
      if (preprocessResult.isFailure) {
        summary.commandFilesSkipped++;
        summary.errors.push(
          `${basename(filePath)}: Failed to preprocess - ${
            preprocessResult.unwrapError().message
          }`
        );
        continue;
      }
      const parsedCommandFile = preprocessResult.unwrap();

      const processCommandsResult = await this.processCommands(
        server,
        filePath
      );

      if (processCommandsResult.isFailure) {
        summary.commandFilesSkipped++;
        summary.errors.push(
          `${basename(filePath)}: ${processCommandsResult.unwrapError()}`
        );
        continue;
      }

      const result = processCommandsResult.unwrap();
      summary.commandFilesProcessed++;
      summary.serversDispatched.push(result.server);
      summary.totalInputFilesUploaded += result.inputFilesUploaded;
      summary.totalOutputFilesExpected += result.outputFilesExpected;

      parsedCommandFile.applyCommentAll();
      const commentAllResult = await parsedCommandFile.write();
      if (commentAllResult.isFailure) {
        summary.errors.push(
          `${basename(
            filePath
          )}: Failed to write commented commands - ${commentAllResult.unwrapError()}`
        );
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

      // NOTE: Shouldn't need unique check anymore?
      const commandsResult = await this.readCommandsUnique(filePath);
      if (commandsResult.isSuccess && commandsResult.unwrap().length > 0) {
        commandFiles.push(filePath);
      }
      if (commandsResult.isFailure) {
        this.log(`⚠️ ${commandsResult.unwrapError()}`);
      }
    }

    return commandFiles;
  }

  private async preprocessCommandFile(
    filePath: string,
    outputFilesInBatch: string[]
  ): Promise<Result<ParsedCommandFile, FileIOError>> {
    const parsedCommandFileResult = await ParsedCommandFile.create(
      filePath,
      outputFilesInBatch
    );
    if (parsedCommandFileResult.isFailure) {
      return parsedCommandFileResult;
    }

    const parsedCommandFile = parsedCommandFileResult.unwrap();
    parsedCommandFile.applyUniqueContent();

    const preprocessResult = await parsedCommandFile.write();
    if (preprocessResult.isFailure) {
      return Result.failure(preprocessResult.unwrapError());
    }

    return Result.success(parsedCommandFile);
  }

  private async getServerOrSkip(
    filePath: string
  ): Promise<Result<RemoteConfig, ServerSelectionError>> {
    const serverSelector = new ServerSelector(this.serverConfigs);
    const result = serverSelector.selectServer(filePath);

    return result.match(
      (server) => Result.success(server),
      () => {
        const error = new ServerSelectionError(
          basename(filePath),
          this.serverConfigs.map((s) => s.serverName)
        );
        this.log(`  ✗ ${error.message}`);
        this.log(`    Available servers: ${error.availableServers.join(", ")}`);
        return Result.failure(error);
      }
    );
  }

  private async processCommands(
    server: RemoteConfig,
    filePath: string
  ): Promise<
    Result<
      {
        server: string;
        inputFilesUploaded: number;
        outputFilesExpected: number;
      },
      string
    >
  > {
    const commandsResult = await this.readCommandsUnique(filePath);
    if (commandsResult.isFailure) {
      const reason = `Failed to read commands: ${
        commandsResult.unwrapError().message
      }`;
      this.log(`  ✗ ${reason}`);
      return Result.failure(reason);
    }

    const commands = commandsResult.unwrap();
    if (commands.length === 0) {
      const reason = "No valid commands found in file";
      this.log(`  ✗ ${reason}`);
      return Result.failure(reason);
    }
    this.log(`  Found ${commands.length} command(s) with unique outputs.`);

    const { inputFiles, expectedResults } =
      await this.getNewInputFilesAndExpectedResults(server, commands);

    await this.uploadCommandFile(server, filePath);
    const uploadCountResult = await this.uploadInputFiles(server, inputFiles);
    if (uploadCountResult.isFailure) {
      return Result.failure(
        `Failed to upload input files: ${
          uploadCountResult.unwrapError().message
        }`
      );
    }
    const uploadedCount = uploadCountResult.unwrap();

    for (const result of expectedResults) {
      const remoteFile = `${server.copyFrom}/${basename(result.outputFile)}`;

      await this.stateManager.addPendingDownload(server.serverName, {
        outputFile: result.outputFile,
        relatedInputFile: result.relatedInputFile,
        remoteFile,
      });
    }

    this.log(`  ✓ Dispatched to ${server.serverName}`);

    return Result.success({
      server: server.serverName,
      inputFilesUploaded: uploadedCount,
      outputFilesExpected: expectedResults.length,
    });
  }

  async getNewInputFilesAndExpectedResults(
    server: RemoteConfig,
    commands: string[],
    verifyExist = true
  ): Promise<{
    inputFiles: string[];
    expectedResults: {
      outputFile: string;
      relatedInputFile: string;
    }[];
  }> {
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
    const processedOutputs = [] as string[];

    const isOutputAdded = (c: ParsedCmd) =>
      pendingOutputs.includes(c.output) || processedOutputs.includes(c.output);
    const isInputAdded = (c: ParsedCmd) => skipInputs.includes(c.input);
    const isInputMissing = async (c: ParsedCmd) =>
      verifyExist && !(await exists(c.input));
    const shouldAddInput = (c: ParsedCmd) =>
      !uploadedInputs.includes(c.input) && !inputFiles.includes(c.input);

    for (const command of commands) {
      const cmd = ParsedCmd.create(command);

      if (isOutputAdded(cmd) || isInputAdded(cmd)) {
        continue;
      }

      if (await isInputMissing(cmd)) {
        skipInputs.push(cmd.input);
        this.log(`  ⚠️ Input file not found: ${cmd.input}`);
        continue;
      }

      if (shouldAddInput(cmd)) {
        inputFiles.push(cmd.input);
      }
      expectedResults.push({
        outputFile: cmd.output,
        relatedInputFile: cmd.input,
      });

      processedOutputs.push(cmd.output);
    }

    return { inputFiles, expectedResults };
  }

  private async readCommandsUnique(
    filePath: string
  ): Promise<Result<string[], FileIOError>> {
    const commandsResult = await this.readCommands(filePath);
    return commandsResult.map((commands) => [...new Set(commands)]);
  }

  private async readCommands(
    filePath: string
  ): Promise<Result<string[], FileIOError>> {
    const result = await Result.fromThrowableAsync(async () => {
      const content = await Bun.file(filePath).text();
      return content
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"));
    });

    return result.mapError((error) => new FileIOError(filePath, "read", error));
  }

  private async uploadCommandFile(
    server: RemoteConfig,
    filePath: string
  ): Promise<void> {
    this.log(`  Uploading command file to ${server.serverName}...`);

    const remoteFile = `${server.remoteCmdsDir}/${basename(filePath)}`;
    await this.fileOperations.uploadFile(server, filePath, remoteFile);

    this.log(`  ✓ Command file uploaded`);
  }

  private async uploadInputFiles(
    server: RemoteConfig,
    inputFiles: string[]
  ): Promise<Result<number, Error>> {
    if (inputFiles.length === 0) {
      return Result.success(0);
    }

    this.log(`  Uploading ${inputFiles.length} input file(s)...`);
    const createFlagFile = await Result.fromThrowableAsync(async () => {
      this.log(
        `  Creating pause watch flag file: ${server.pauseWatchFlagFile}`
      );
      await this.fileOperations.writeFile(
        server,
        server.pauseWatchFlagFile,
        `Uploading ${inputFiles.length} input files`
      );
      return server.pauseWatchFlagFile;
    });

    const uploadFiles = async (flagFile: string) => {
      const uploadResult = await Result.fromThrowableAsync(async () => {
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
              `    Skipping ${basename(
                file
              )} - already exists with matching size`
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
      });
      const cleanupResult = await Result.fromThrowableAsync(async () => {
        this.log(
          `  Removing pause watch flag file: ${server.pauseWatchFlagFile}`
        );
        await this.fileOperations.removeFile(server, flagFile);
      });
      if (cleanupResult.isFailure) {
        this.log(
          `  ⚠️ Failed to remove pause watch flag file: ${
            cleanupResult.unwrapError().message
          }`
        );
      }

      return uploadResult;
    };

    return await createFlagFile.flatMapAsync(uploadFiles);
  }
}
