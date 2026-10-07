-- Weekly Challenges / Cosmetics feature.
--
-- The user has said these tables may already exist on Supabase - review
-- this against what's already there before running it. This file is
-- idempotent (CREATE TABLE IF NOT EXISTS / ON CONFLICT DO NOTHING) so it's
-- safe to run even if some of it already exists.

CREATE TABLE IF NOT EXISTS public.challenges (
  id SERIAL PRIMARY KEY,
  theme TEXT NOT NULL,
  description TEXT NOT NULL,
  reward_id TEXT,
  deadline TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS unique_active_challenge
  ON public.challenges (is_active)
  WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS public.challenge_submissions (
  id SERIAL PRIMARY KEY,
  challenge_id INTEGER REFERENCES public.challenges(id),
  spotify_user_id TEXT NOT NULL,
  track_id TEXT NOT NULL,
  track_title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album_art TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(challenge_id, spotify_user_id)
);

-- 1. List of available cosmetic rewards
CREATE TABLE IF NOT EXISTS public.rewards (
  reward_id TEXT PRIMARY KEY, -- e.g 'cyan-border', 'gold-border'
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  effect_type TEXT NOT NULL, -- e.g 'profile_aura', 'song_marker', or 'both'
  css_class TEXT NOT NULL   -- e.g 'cyan-glow', 'gold-shimmer'
);

-- 2. Track which users have unlocked and equipped which cosmetics
CREATE TABLE IF NOT EXISTS public.user_cosmetics (
  id SERIAL PRIMARY KEY,
  spotify_user_id TEXT NOT NULL,
  reward_id TEXT REFERENCES public.rewards(reward_id),
  is_equipped BOOLEAN DEFAULT FALSE,
  UNIQUE(spotify_user_id, reward_id)
);

-- No challenges are seeded here anymore: the backend now starts them on its
-- own (lib/challengeRotation.js) - when nothing is active, or when the active
-- one's deadline passes, it ends it and starts the next one from the pool in
-- lib/challengePool.js, with a fresh start time and deadline. To end the
-- current challenge early and start the next, run:
--   UPDATE public.challenges SET deadline = now() WHERE is_active = TRUE;
-- (it rolls over within ~15 seconds), or call POST /challenges/admin/rotate.

-- Seed cosmetic rewards
INSERT INTO public.rewards (reward_id, name, description, effect_type, css_class)
VALUES
  ('cyan-border', 'Abyssal Crest', 'Bioluminescent cyan glow applied to your avatar aura and your floating ocean song marker.', 'both', 'cyan-glow'),
  ('gold-border', 'Golden Tide', 'Radiant golden shimmer applied to your avatar aura and your floating ocean song marker.', 'both', 'gold-shimmer')
ON CONFLICT (reward_id) DO NOTHING;
