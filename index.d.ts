#!/usr/bin/env node
declare const server: {
    start: () => Promise<void>;
    getIO: () => any;
    sharedMemory: {
        set: (key: string, value: any) => void;
        get: (key: string) => undefined;
    };
};
export default server;
