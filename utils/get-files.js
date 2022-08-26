"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
function getFiles(directory, files = []) {
    if (!fs_1.default.existsSync(directory)) {
        return [];
    }
    const filesInDirectory = fs_1.default.readdirSync(directory);
    for (const file of filesInDirectory) {
        const absolute = path_1.default.join(directory, file);
        if (fs_1.default.statSync(absolute).isDirectory()) {
            getFiles(absolute, files);
        }
        else {
            files.push(absolute);
        }
    }
    return files;
}
exports.default = getFiles;
