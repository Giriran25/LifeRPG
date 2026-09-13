/**
 * Pull a human-readable message out of whatever a failed call threw.
 *
 * Server-function rejections do not arrive as Error instances — depending on
 * where they failed they can be a plain object, a parsed JSON body, or a nested
 * `{ error: { message } }` envelope. Calling String() on those yields
 * "[object Object]", which is what a player would otherwise be shown. This
 * walks the common shapes and returns the first real message it finds.
 */
export function errorMessage(err: unknown, fallback = "Something went wrong"): string {
  const seen = new Set<unknown>();

  function walk(value: unknown, depth: number): string | null {
    if (value == null || depth > 4) return null;
    if (typeof value === "string") return value.trim() || null;
    if (value instanceof Error) return value.message.trim() || null;
    if (typeof value !== "object") return null;
    if (seen.has(value)) return null;
    seen.add(value);

    const record = value as Record<string, unknown>;
    // Direct message fields first, then common envelopes.
    for (const key of ["message", "error_description", "msg", "detail", "hint"]) {
      const found = walk(record[key], depth + 1);
      if (found) return found;
    }
    for (const key of ["error", "cause", "body", "data", "response"]) {
      const found = walk(record[key], depth + 1);
      if (found) return found;
    }
    return null;
  }

  return walk(err, 0) ?? fallback;
}

/**
 * Turns a raw failure into something the player can act on.
 *
 * The categories matter because each one implies a different next step: sign in
 * again, fix the input, check the connection, or report it.
 */
export function friendlyError(err: unknown, context: string): string {
  const raw = errorMessage(err, "");

  if (/jwt|token|session|unauthor|not authenticated/i.test(raw))
    return "Your session expired. Sign in again, then try once more.";
  if (/row-level security|permission|policy|forbidden/i.test(raw))
    return `${context} was refused by the server's permissions.`;
  if (/network|failed to fetch|load failed|offline/i.test(raw))
    return "Couldn't reach the server. Check your connection and try again.";
  if (/duplicate|unique constraint|already exists/i.test(raw)) return "That already exists.";

  return raw ? `${context} failed — ${raw}` : `${context} failed.`;
}
