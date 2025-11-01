import { describe, it, expect, beforeEach } from "bun:test";
import { CommandDispatcher } from "@/remote-job-dispatch/app/command-dispatcher";
import type { IFileOperations } from "@/remote-job-dispatch/core/ifile-operations";
import type { ServerConfig } from "@/infra/config";
import {
  ClientStateManager,
  type ClientState,
} from "@/remote-job-dispatch/core/client-state-manager";
import type { ClientStateStorage } from "@/remote-job-dispatch/core/client-state-storage";

class InMemoryStateStorage implements ClientStateStorage {
  private state: ClientState = {
    version: "1.0",
    servers: {},
  };

  async saveState(state: ClientState): Promise<void> {
    this.state = JSON.parse(JSON.stringify(state));
  }

  async loadState(): Promise<ClientState> {
    return JSON.parse(JSON.stringify(this.state));
  }
}

class MockFileOperations implements IFileOperations {
  async uploadFile(): Promise<void> {}
  async downloadFileAndCleanup(): Promise<void> {}
  async checkFileExists(): Promise<boolean> {
    return true;
  }
  async shouldUploadFile(): Promise<boolean> {
    return true;
  }
  async isFileReadyForDownload(): Promise<boolean> {
    return true;
  }
  async removeFile(): Promise<
    { remoteFile: string; error: string } | undefined
  > {
    return undefined;
  }
  async removeRemoteFiles(): Promise<{
    removals: number;
    failures: { remoteFile: string; error: string }[];
  }> {
    return { removals: 0, failures: [] };
  }
}

describe("CommandDispatcher.getNewInputFilesAndExpectedResults", () => {
  let dispatcher: CommandDispatcher;
  let stateManager: ClientStateManager;
  let storage: InMemoryStateStorage;
  let server: ServerConfig;

  beforeEach(async () => {
    storage = new InMemoryStateStorage();
    const serverConfigs = [
      {
        serverName: "test-server",
        sshHostIP: "192.168.1.10",
        sshUser: "user",
        sshKeyPath: "/path/to/key",
        remoteWorkDir: "/work",
        remoteCmdsDir: "/cmds",
        remoteSuccessDir: "/success",
        pauseWatchFlagFile: "incoming",
        copyTo: "/to",
        copyFrom: "/from",
      },
    ];

    stateManager = await ClientStateManager.create(serverConfigs, storage);
    server = serverConfigs[0]!;

    dispatcher = new CommandDispatcher({
      fileOperations: new MockFileOperations(),
      stateManager,
      cmdsInputDir: "/tmp/cmds",
      serverConfigs,
    });
  });

  it("should return unique input files when same input used multiple times", async () => {
    const commands = [
      'ffmpeg -i "input.mkv" -c:v libx264 "output1.mkv"',
      'ffmpeg -i "input.mkv" -c:v libx265 "output2.mkv"',
      'ffmpeg -i "input.mkv" -crf 20 "output3.mkv"',
    ];

    const result = await dispatcher.getNewInputFilesAndExpectedResults(
      server,
      commands,
      false
    );

    expect(result.inputFiles).toHaveLength(1);
    expect(result.inputFiles[0]).toBe("input.mkv");
    expect(result.expectedResults).toHaveLength(3);
  });

  it("should exclude already uploaded input files", async () => {
    await stateManager.addUploadedInputFile(server.serverName, {
      localFile: "input1.mkv",
      remoteFile: "/to/input1.mkv",
    });

    const commands = [
      'ffmpeg -i "input1.mkv" -c:v libx264 "output1.mkv"',
      'ffmpeg -i "input2.mkv" -c:v libx264 "output2.mkv"',
    ];

    const result = await dispatcher.getNewInputFilesAndExpectedResults(
      server,
      commands,
      false
    );

    expect(result.inputFiles).toHaveLength(1);
    expect(result.inputFiles[0]).toBe("input2.mkv");
    expect(result.expectedResults).toHaveLength(2);
  });

  it("should skip commands with pending outputs", async () => {
    await stateManager.addPendingDownload(server.serverName, {
      outputFile: "output1.mkv",
      remoteFile: "/from/output1.mkv",
      relatedInputFile: "input1.mkv",
    });

    const commands = [
      'ffmpeg -i "input1.mkv" -c:v libx264 "output1.mkv"',
      'ffmpeg -i "input2.mkv" -c:v libx264 "output2.mkv"',
    ];

    const result = await dispatcher.getNewInputFilesAndExpectedResults(
      server,
      commands,
      false
    );

    expect(result.inputFiles).toHaveLength(1);
    expect(result.inputFiles[0]).toBe("input2.mkv");
    expect(result.expectedResults).toHaveLength(1);
    expect(result.expectedResults[0]!.outputFile).toBe("output2.mkv");
  });

  it("should handle same input already uploaded but used in new command", async () => {
    await stateManager.addUploadedInputFile(server.serverName, {
      localFile: "input.mkv",
      remoteFile: "/to/input.mkv",
    });

    await stateManager.addPendingDownload(server.serverName, {
      outputFile: "output1.mkv",
      remoteFile: "/from/output1.mkv",
      relatedInputFile: "input.mkv",
    });

    const commands = [
      'ffmpeg -i "input.mkv" -c:v libx264 "output1.mkv"',
      'ffmpeg -i "input.mkv" -c:v libx265 "output2.mkv"',
    ];

    const result = await dispatcher.getNewInputFilesAndExpectedResults(
      server,
      commands,
      false
    );

    expect(result.inputFiles).toHaveLength(0);
    expect(result.expectedResults).toHaveLength(1);
    expect(result.expectedResults[0]!.outputFile).toBe("output2.mkv");
  });

  it("should return multiple input files when different inputs used", async () => {
    const commands = [
      'ffmpeg -i "input1.mkv" -c:v libx264 "output1.mkv"',
      'ffmpeg -i "input2.mkv" -c:v libx264 "output2.mkv"',
      'ffmpeg -i "input3.mkv" -c:v libx264 "output3.mkv"',
    ];

    const result = await dispatcher.getNewInputFilesAndExpectedResults(
      server,
      commands,
      false
    );

    expect(result.inputFiles).toHaveLength(3);
    expect(result.inputFiles).toContain("input1.mkv");
    expect(result.inputFiles).toContain("input2.mkv");
    expect(result.inputFiles).toContain("input3.mkv");
    expect(result.expectedResults).toHaveLength(3);
  });

  it("should handle mix of duplicate and unique inputs", async () => {
    const commands = [
      'ffmpeg -i "input1.mkv" -c:v libx264 "output1.mkv"',
      'ffmpeg -i "input1.mkv" -c:v libx265 "output2.mkv"',
      'ffmpeg -i "input2.mkv" -c:v libx264 "output3.mkv"',
      'ffmpeg -i "input2.mkv" -crf 20 "output4.mkv"',
      'ffmpeg -i "input3.mkv" -c:v libx264 "output5.mkv"',
    ];

    const result = await dispatcher.getNewInputFilesAndExpectedResults(
      server,
      commands,
      false
    );

    expect(result.inputFiles).toHaveLength(3);
    expect(result.inputFiles).toContain("input1.mkv");
    expect(result.inputFiles).toContain("input2.mkv");
    expect(result.inputFiles).toContain("input3.mkv");
    expect(result.expectedResults).toHaveLength(5);
  });

  it("should relate each output to correct input", async () => {
    const commands = [
      'ffmpeg -i "input1.mkv" -c:v libx264 "output1.mkv"',
      'ffmpeg -i "input2.mkv" -c:v libx264 "output2.mkv"',
    ];

    const result = await dispatcher.getNewInputFilesAndExpectedResults(
      server,
      commands,
      false
    );

    expect(result.expectedResults).toHaveLength(2);
    expect(result.expectedResults[0]!.outputFile).toBe("output1.mkv");
    expect(result.expectedResults[0]!.relatedInputFile).toBe("input1.mkv");
    expect(result.expectedResults[1]!.outputFile).toBe("output2.mkv");
    expect(result.expectedResults[1]!.relatedInputFile).toBe("input2.mkv");
  });

  it("should handle commands with same output but different inputs", async () => {
    const commands = [
      'ffmpeg -i "input1.mkv" -c:v libx264 "output.mkv"',
      'ffmpeg -i "input2.mkv" -c:v libx264 "output.mkv"',
    ];

    const result = await dispatcher.getNewInputFilesAndExpectedResults(
      server,
      commands,
      false
    );

    expect(result.inputFiles).toHaveLength(1);
    expect(result.inputFiles[0]).toBe("input1.mkv");
    expect(result.expectedResults).toHaveLength(1);
    expect(result.expectedResults[0]!.relatedInputFile).toBe("input1.mkv");
  });
});
