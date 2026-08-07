import { NextFunction, Request, Response } from "express";
import * as admin from "firebase-admin";
import { config } from "../config";
import { HttpError } from "../errors/HttpError";

if (!admin.apps.length) {
  const serviceAccountJson = Buffer.from(config.firebaseServiceAccountBase64, "base64").toString("utf8");
  const serviceAccount = JSON.parse(serviceAccountJson);
  // admin.credential.cert() reads project_id out of the service account JSON itself, so no
  // separate FIREBASE_PROJECT_ID env var is needed.
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
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
    const decoded = await admin.auth().verifyIdToken(idToken);
    (req as AuthedRequest).userId = decoded.uid;
    next();
  } catch (err) {
    if (err instanceof HttpError) {
      next(err);
      return;
    }
    next(HttpError.unauthorized("Invalid or expired token"));
  }
}
