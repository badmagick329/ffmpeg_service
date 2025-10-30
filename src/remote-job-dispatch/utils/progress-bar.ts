import type { TransferProgress } from "@/remote-job-dispatch/core/itransfer-client";

export function createProgressBar() {
  let lastOutput = "";

  return {
    show: (progress: TransferProgress) => {
      const barLength = 30;
      const filled = Math.floor((progress.percentage / 100) * barLength);
      const empty = barLength - filled;
      const bar = "█".repeat(filled) + "░".repeat(empty);

      const mbTransferred = (progress.bytesTransferred / (1024 * 1024)).toFixed(
        1
      );
      const mbTotal = (progress.totalBytes / (1024 * 1024)).toFixed(1);

      const output = `\r    [${bar}] ${progress.percentage}% (${mbTransferred}/${mbTotal} MB)`;

      if (output !== lastOutput) {
        process.stdout.write(output);
        lastOutput = output;
      }
    },

    finish: () => {
      process.stdout.write("\n");
      lastOutput = "";
    },

    clear: () => {
      if (lastOutput) {
        process.stdout.write("\r" + " ".repeat(lastOutput.length) + "\r");
        lastOutput = "";
      }
    },
  };
}
