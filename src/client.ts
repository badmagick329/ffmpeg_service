import { config } from "@/infra/config";
import { FsWatcher } from "@/fs-watcher";

// NOTE: WIP
async function main() {
  for (const [_, sc] of Object.entries(config.serverConfigs)) {
    console.log(sc);
  }
  const watcher = new FsWatcher(config.cmdsInputDir);
  watcher.onAdd = (f) => {
    console.log(`${f} added`);
  };
  watcher.onUnlink = (f) => {
    console.log(`${f} removed`);
  };
  watcher.onChange = (f) => {
    console.log(`${f} changed`);
  };
  watcher.watch({});
}

main();
