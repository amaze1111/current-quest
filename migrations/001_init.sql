-- Idempotent schema: safe to run repeatedly against the same database.
-- This database instance is shared with other apps, so all objects live in their own
-- schema rather than public; src/db/pool.ts sets search_path=current_quest,public on every
-- connection so the unqualified names below resolve here.

CREATE SCHEMA IF NOT EXISTS current_quest;

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,               -- Firebase uid
    star_balance INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Append-only ledger: every star credit/debit is a row here. users.star_balance is a
-- materialized cache of the sum, updated only in the same transaction as the insert below.
-- Never UPDATE/DELETE a row here — reverse mistakes with a compensating entry.
CREATE TABLE IF NOT EXISTS star_ledger (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    delta INTEGER NOT NULL,
    reason TEXT NOT NULL,
    -- This UNIQUE constraint is what makes retried requests (level completion, hint use,
    -- purchase credit) safe to resend without double-crediting or double-charging.
    dedupe_key TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_star_ledger_user_id ON star_ledger(user_id);

CREATE TABLE IF NOT EXISTS level_progress (
    user_id TEXT NOT NULL REFERENCES users(id),
    level_id INTEGER NOT NULL,
    best_time_ms INTEGER NOT NULL,
    stars_earned INTEGER NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, level_id)
);

CREATE TABLE IF NOT EXISTS star_packs (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL UNIQUE,   -- Google Play Console in-app product id
    star_amount INTEGER NOT NULL,
    display_name TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS purchases (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    platform TEXT NOT NULL,
    product_id TEXT NOT NULL,
    -- UNIQUE here is the dedupe guard against a client retrying purchases/verify with the
    -- same Play purchase token after a dropped response.
    purchase_token TEXT NOT NULL UNIQUE,
    star_pack_id TEXT NOT NULL REFERENCES star_packs(id),
    status TEXT NOT NULL,
    verified_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON purchases(user_id);
