import type { NextFunction, Request, RequestHandler, Response } from "express";

import type { SessionTokenService } from "../services/session-token.js";

/** Augmented by requireAuth: the phone bound to a validated session token. */
export interface AuthedRequest extends Request {
  authPhone?: string;
}

/**
 * Requires `Authorization: Bearer <token>`, issued by POST /api/verify/check
 * on approval. Rejects with 401 when the header is missing, malformed,
 * unsigned, or expired. On success sets `req.authPhone` to the token's
 * phone — routes must derive identity from this, never from the request
 * body, so possessing someone else's phone number is no longer sufficient
 * to write or read their onboarding data (closes H-2).
 */
export function requireAuth(sessionTokens: SessionTokenService): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      res.status(401).json({ error: "unauthorized", detail: "missing bearer token" });
      return;
    }
    const token = header.slice("Bearer ".length).trim();
    const phone = sessionTokens.verify(token);
    if (!phone) {
      res.status(401).json({ error: "unauthorized", detail: "invalid or expired token" });
      return;
    }
    (req as AuthedRequest).authPhone = phone;
    next();
  };
}
