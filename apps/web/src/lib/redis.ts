import { createClient, type RedisClientType } from "redis";

export interface PingableRedisClient {
  isOpen: boolean;
  connect(): Promise<unknown>;
  ping(): Promise<string>;
}

let redisClient: RedisClientType | undefined;

export function getRedisClient(url: string, connectTimeout = 5_000): RedisClientType {
  redisClient ??= createClient({
    url,
    socket: {
      connectTimeout,
      reconnectStrategy: false,
    },
  });

  redisClient.on("error", () => {
    // Connection failures are reported by the health boundary without logging credentials.
  });

  return redisClient;
}

export async function checkRedisConnection(client: PingableRedisClient): Promise<void> {
  if (!client.isOpen) {
    await client.connect();
  }

  const response = await client.ping();
  if (response !== "PONG") {
    throw new Error("Redis returned an unexpected health response");
  }
}
