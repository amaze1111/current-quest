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

  // Firebase project id (app/google-services.json's project_info.project_id) — not a secret,
  // just identifies which project's ID tokens to accept. Fixed for this app, like
  // androidPackageName below, so it's a constant rather than an env var. Verifying a Firebase
  // ID token only needs this plus Google's public signing keys (see src/middleware/auth.ts) —
  // no service-account credential required, unlike the Play verification below.
  firebaseProjectId: "current-quest-eade4",

  // Google Play Developer API — used to verify star-pack purchase tokens server-side. Unlike
  // Firebase ID token verification, this calls a private, authenticated Google API, so it
  // genuinely needs a service-account credential. Left optional (undefined until set) since
  // the Android app doesn't have Play Billing wired up yet — src/services/googlePlayClient.ts
  // throws a clear runtime error only if /purchases/verify is actually hit before this is set.
  androidPackageName: "com.current.quest.logic.puzzle.game",
  googlePlayServiceAccountBase64: process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_BASE64,

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
