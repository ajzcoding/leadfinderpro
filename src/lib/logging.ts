import { db } from "@/lib/db";

export type LogLevel = "info" | "warn" | "error";

/**
 * Append a structured log entry to the local SQLite log table.
 * Never throws — logging must not break the calling flow.
 */
export async function log(
  level: LogLevel,
  category: string,
  message: string,
  meta?: unknown,
): Promise<void> {
  try {
    await db.log.create({
      data: {
        level,
        category,
        message: message.slice(0, 2000),
        meta: meta ? JSON.stringify(meta).slice(0, 4000) : null,
      },
    });
  } catch {
    // swallow — logging is best-effort
  }
}

export async function getLogs(limit = 200, level?: LogLevel) {
  return db.log.findMany({
    where: level ? { level } : undefined,
    orderBy: { timestamp: "desc" },
    take: limit,
  });
}
