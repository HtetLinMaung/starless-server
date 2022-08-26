import fs from "fs";
import path from "path";

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
