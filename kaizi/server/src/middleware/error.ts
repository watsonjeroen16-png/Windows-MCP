import type { NextFunction, Request, Response } from "express";

/** JSON 404 for unknown routes. */
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: "not_found" });
}

/**
 * Terminal JSON error handler. Logs server-side; never leaks stack traces
 * or internal error messages to clients.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // express.json() body-parse failures carry a status < 500.
  const status =
    typeof err === "object" && err !== null && "status" in err && typeof err.status === "number"
      ? err.status
      : 500;

  if (status >= 500) {
    console.error("[error]", err instanceof Error ? err.stack : err);
    res.status(500).json({ error: "internal_error" });
    return;
  }

  res.status(status).json({ error: "bad_request" });
}
