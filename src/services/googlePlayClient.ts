import { google } from "googleapis";
import { config } from "../config";
import { HttpError } from "../errors/HttpError";

let cachedClient: ReturnType<typeof google.androidpublisher> | null = null;

// Lazily built and cached — constructing the JWT client on every request would re-parse
// the service account key each call for no benefit.
export function getAndroidPublisherClient() {
  if (cachedClient) return cachedClient;

  // GOOGLE_PLAY_SERVICE_ACCOUNT_BASE64 is optional at boot (config.ts) since Play Billing
  // isn't wired into the Android app yet — fail only when this is actually reached, not on
  // every server startup, so the rest of the API stays usable before that's set up.
  if (!config.googlePlayServiceAccountBase64) {
    throw new HttpError(
      503,
      "purchase_verification_not_configured",
      "GOOGLE_PLAY_SERVICE_ACCOUNT_BASE64 is not set — purchase verification is unavailable."
    );
  }

  const serviceAccountJson = Buffer.from(config.googlePlayServiceAccountBase64, "base64").toString("utf8");
  const serviceAccount = JSON.parse(serviceAccountJson);

  const auth = new google.auth.JWT({
    email: serviceAccount.client_email,
    key: serviceAccount.private_key,
    scopes: ["https://www.googleapis.com/auth/androidpublisher"],
  });

  cachedClient = google.androidpublisher({ version: "v3", auth });
  return cachedClient;
}
