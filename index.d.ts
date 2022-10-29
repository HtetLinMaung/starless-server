#!/usr/bin/env node
declare const server: {
    start: () => Promise<void>;
    getIO: () => any;
    sharedMemory: {
        set: (key: string, value: any) => void;
        setAll: (payload: import("./shared-memory").DynamicObject) => void;
        get: (key: string) => any;
        getAll(): import("./shared-memory").DynamicObject;
    };
};
export default server;
