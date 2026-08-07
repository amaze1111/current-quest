import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() !== "" ? value : fallback;
}

const nodeEnv = optional("NODE_ENV", "development");
const isProduction = nodeEnv === "production";

const allowDevAuth = optional("ALLOW_DEV_AUTH", "false") === "true";
if (allowDevAuth && isProduction) {
  throw new Error(
    "ALLOW_DEV_AUTH=true is not permitted when NODE_ENV=production. " +
      "This flag lets requests bypass Firebase token verification and must never run in prod."
  );
}

export const config = {
  nodeEnv,
  isProduction,
  port: Number(optional("PORT", "3000")),

  databaseUrl: required("DATABASE_URL"),
  databaseSsl: optional("DATABASE_SSL", isProduction ? "true" : "false") === "true",

  corsOrigins: optional("CORS_ORIGINS", "*")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  firebaseProjectId: required("FIREBASE_PROJECT_ID"),
  // Full service account JSON, base64-encoded, so it survives being pasted into a single env var field.
  firebaseServiceAccountBase64: required("FIREBASE_SERVICE_ACCOUNT_BASE64"),

  // Google Play Developer API — used to verify star-pack purchase tokens server-side.
  androidPackageName: required("ANDROID_PACKAGE_NAME"),
  googlePlayServiceAccountBase64: required("GOOGLE_PLAY_SERVICE_ACCOUNT_BASE64"),

  allowDevAuth,

  // Star economy thresholds — mirrors CurrentQuestView's companion-object constants so
  // the server computes the same reward the client would show, never trusting a client-sent star count.
  timerLimitMs: 60_000,
  star3ThresholdMs: 30_000,
  star2ThresholdMs: 45_000,
  star1ThresholdMs: 60_000,
  hintNextStepCost: 1,
  hintSolveCost: 3,
  maxLevel: 110,
} as const;
