import type { Response } from "express";
import type { Notification } from "@shared/schema";

type Client = {
  id: number;
  userId: string;
  res: Response;
};

const clients = new Set<Client>();
let nextId = 1;

export function addClient(userId: string, res: Response): () => void {
  const client: Client = { id: nextId++, userId, res };
  clients.add(client);
  return () => {
    clients.delete(client);
  };
}

export function emitNotificationCreated(userId: string, notification: Notification): void {
  const payload = JSON.stringify({ type: "notification.created", notification });
  for (const c of clients) {
    if (c.userId !== userId) continue;
    try {
      c.res.write(`event: notification\ndata: ${payload}\n\n`);
    } catch {
      clients.delete(c);
    }
  }
}

export function getClientCount(): number {
  return clients.size;
}
