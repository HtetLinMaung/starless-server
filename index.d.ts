#!/usr/bin/env node
declare const server: {
    start: () => Promise<void>;
    getIO: () => any;
};
export default server;
