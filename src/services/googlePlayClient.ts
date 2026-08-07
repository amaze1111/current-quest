import { google } from "googleapis";
import { config } from "../config";

let cachedClient: ReturnType<typeof google.androidpublisher> | null = null;

// Lazily built and cached — constructing the JWT client on every request would re-parse
// the service account key each call for no benefit.
export function getAndroidPublisherClient() {
  if (cachedClient) return cachedClient;

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
