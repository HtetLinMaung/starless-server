"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_cluster_1 = __importDefault(require("node:cluster"));
const state = {};
if (node_cluster_1.default.isPrimary) {
    for (const id in node_cluster_1.default.workers) {
        node_cluster_1.default.workers[id].on("message", (msg) => {
            for (const [k, v] of Object.entries(msg)) {
                state[k] = v;
            }
            for (const id2 in node_cluster_1.default.workers) {
                node_cluster_1.default.workers[id2].send(msg);
            }
        });
    }
}
else {
    process.on("message", (msg) => {
        for (const [k, v] of Object.entries(msg.payload)) {
            state[k] = v;
        }
    });
}
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
    get: (key) => {
        return Object.assign({}, state)[key];
    },
};
