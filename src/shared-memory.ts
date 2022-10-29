import cluster from "node:cluster";

const state = {};

if (cluster.isPrimary) {
  for (const id in cluster.workers) {
    cluster.workers[id].on("message", (msg) => {
      for (const [k, v] of Object.entries(msg)) {
        state[k] = v;
      }
      for (const id2 in cluster.workers) {
        cluster.workers[id2].send(msg);
      }
    });
  }
} else {
  process.on("message", (msg: any) => {
    for (const [k, v] of Object.entries(msg.payload)) {
      state[k] = v;
    }
  });
}

export default {
  set: (key: string, value: any) => {
    if (cluster.isPrimary) {
      for (const id in cluster.workers) {
        cluster.workers[id].send({ [key]: value });
      }
    } else {
      process.send({ [key]: value });
    }
  },
  get: (key: string) => {
    return { ...state }[key];
  },
};
