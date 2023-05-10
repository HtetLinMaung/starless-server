import cluster from "node:cluster";

export interface DynamicObject {
  [key: string]: any;
}

export const state: DynamicObject = {};

const broadcastMessage = (message: DynamicObject) => {
  for (const id in cluster.workers) {
    cluster.workers[id].send(message);
  }
};

const sendMessage = (message: DynamicObject) => {
  if (cluster.isPrimary) {
    broadcastMessage(message);
  } else {
    process.send(message);
  }
};

export default {
  set: (key: string, value: any) => {
    sendMessage({ [key]: value });
  },
  setAll: (payload: DynamicObject) => {
    sendMessage(payload);
  },
  get: (key: string) => state[key],
  getAll: (): DynamicObject => ({ ...state }),
};
