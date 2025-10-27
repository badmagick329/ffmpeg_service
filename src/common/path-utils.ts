import { basename } from "node:path";

export function filenameWithoutExt(filePath: string) {
  const filenameMatch = basename(filePath).match(/(.+)\.[^.]+$/);
  if (!filenameMatch) {
    return undefined;
  }
  return filenameMatch[1];
}
