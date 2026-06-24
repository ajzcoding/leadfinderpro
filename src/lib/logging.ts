import { db } from "@/lib/db";
import { redactSensitive } from "@/lib/security";

export type LogLevel = "info" | "warn" | "error";

/**
 * Append a structured log entry to the local SQLite log table.
 * Never throws — logging must not break the calling flow.
 *
 * Sensitive data (API keys, tokens, passwords) is automatically redacted
 * from the `meta` field before persistence, so credentials can never leak
 * via the /api/logs endpoint.
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
        category: category.slice(0, 60),
        message: message.slice(0, 2000),
        meta: meta ? JSON.stringify(redactSensitive(meta)).slice(0, 4000) : null,
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
