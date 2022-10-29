"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.state = void 0;
const node_cluster_1 = __importDefault(require("node:cluster"));
exports.state = {};
exports.default = {
    set: (key, value) => {
        if (node_cluster_1.default.isPrimary) {
            for (const id in node_cluster_1.default.workers) {
                node_cluster_1.default.workers[id].send({ [key]: value });
            }
        }
        else {
            process.send({ [key]: value });
        }
    },
    setAll: (payload) => {
        if (node_cluster_1.default.isPrimary) {
            for (const id in node_cluster_1.default.workers) {
                node_cluster_1.default.workers[id].send(payload);
            }
        }
        else {
            process.send(payload);
        }
    },
    get: (key) => exports.state[key],
    getAll() {
        return Object.assign({}, exports.state);
    },
};
