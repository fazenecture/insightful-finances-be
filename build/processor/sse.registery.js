"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class SSEManager {
    constructor() {
        this.clients = new Map();
        this.register = (sessionId, res) => {
            if (!this.clients.has(sessionId)) {
                this.clients.set(sessionId, new Set());
            }
            const client = {
                res,
                connectedAt: Date.now(),
            };
            this.clients.get(sessionId).add(client);
        };
        this.unregister = (sessionId, res) => {
            const set = this.clients.get(sessionId);
            if (!set)
                return;
            for (const client of set) {
                if (client.res === res) {
                    set.delete(client);
                }
            }
            if (set.size === 0) {
                this.clients.delete(sessionId);
            }
        };
        this.emit = (sessionId, event, payload) => {
            const set = this.clients.get(sessionId);
            if (!set)
                return;
            const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
            for (const client of set) {
                client.res.write(data);
            }
        };
    }
}
exports.default = SSEManager;
//# sourceMappingURL=sse.registery.js.map