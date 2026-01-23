// sse.ts
import { Response } from "express";

type SSEClient = {
  res: Response;
  connectedAt: number;
};

export default class SSEManager {
  private readonly clients = new Map<string, Set<SSEClient>>();

  public register = (sessionId: string, res: Response) => {
    if (!this.clients.has(sessionId)) {
      this.clients.set(sessionId, new Set());
    }

    const client: SSEClient = {
      res,
      connectedAt: Date.now(),
    };

    this.clients.get(sessionId)!.add(client);
  }

  public unregister = (sessionId: string, res: Response) => {
    const set = this.clients.get(sessionId);
    if (!set) return;

    for (const client of set) {
      if (client.res === res) {
        set.delete(client);
      }
    }

    if (set.size === 0) {
      this.clients.delete(sessionId);
    }
  }

  public emit = (sessionId: string, event: string, payload: any) => {
    const set = this.clients.get(sessionId);
    if (!set) return;

    const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;

    for (const client of set) {
      client.res.write(data);
    }
  }
}
