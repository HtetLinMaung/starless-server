import cluster from "node:cluster";

export interface DynamicObject {
  [key: string]: any;
}

export const state: DynamicObject = {};

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
  setAll: (payload: DynamicObject) => {
    if (cluster.isPrimary) {
      for (const id in cluster.workers) {
        cluster.workers[id].send(payload);
      }
    } else {
      process.send(payload);
    }
  },
  get: (key: string) => state[key],
  getAll(): DynamicObject {
    return { ...state };
  },
};
