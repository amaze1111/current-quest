import { NextFunction, Request, Response } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { config } from "../config";
import { HttpError } from "../errors/HttpError";

// Firebase ID tokens are RS256-signed with Google's rotating public keys, so verifying one
// only needs the (non-secret) project id + these public keys — no service-account credential,
// unlike Google Play purchase verification in googlePlayClient.ts. This mirrors Firebase's
// documented "verify ID tokens using a third-party JWT library" approach instead of pulling in
// the full firebase-admin SDK for this one check.
const FIREBASE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);

async function verifyFirebaseIdToken(idToken: string): Promise<string> {
  const { payload } = await jwtVerify(idToken, FIREBASE_JWKS, {
    issuer: `https://securetoken.google.com/${config.firebaseProjectId}`,
    audience: config.firebaseProjectId,
  });

  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    throw new Error("Token missing sub claim");
  }
  return payload.sub;
}

export interface AuthedRequest extends Request {
  userId: string;
}

// Verifies the Firebase ID token the Android client already holds from Firebase Auth
// (anonymous or Google sign-in). The uid on req comes ONLY from this verified token —
// never from a request body field — so a client can never act as another user.
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.header("authorization") ?? "";

    if (config.allowDevAuth && header.startsWith("Dev ")) {
      // Dev-only shortcut for curl/local testing. config.ts throws at boot if this flag
      // is ever true alongside NODE_ENV=production, so this branch is unreachable in prod.
      (req as AuthedRequest).userId = header.slice("Dev ".length).trim();
      next();
      return;
    }

    if (!header.startsWith("Bearer ")) {
      throw HttpError.unauthorized("Missing Bearer token");
    }

    const idToken = header.slice("Bearer ".length).trim();
    (req as AuthedRequest).userId = await verifyFirebaseIdToken(idToken);
    next();
  } catch (err) {
    if (err instanceof HttpError) {
      next(err);
      return;
    }
    next(HttpError.unauthorized("Invalid or expired token"));
  }
}
