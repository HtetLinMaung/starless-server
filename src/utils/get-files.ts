import fs from "node:fs";
import path from "node:path";

export default function getFiles(directory: string, files: string[] = []) {
  if (!fs.existsSync(directory)) {
    return [];
  }
  const filesInDirectory = fs.readdirSync(directory);
  for (const file of filesInDirectory) {
    const absolute = path.join(directory, file);
    if (fs.statSync(absolute).isDirectory()) {
      getFiles(absolute, files);
    } else {
      files.push(absolute);
    }
  }
  return files;
}
