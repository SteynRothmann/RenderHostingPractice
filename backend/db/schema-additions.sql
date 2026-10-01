-- Run once in Supabase's SQL editor before setting DATABASE_URL - adds the
-- constraints our upsert-style queries rely on; the tables already exist.
ALTER TABLE public.private_conversations
  ADD CONSTRAINT private_conversations_pair_unique
  UNIQUE (user_a_spotify_user_id, user_b_spotify_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS chat_requests_one_pending_pair
  ON public.chat_requests (from_spotify_user_id, to_spotify_user_id)
  WHERE status = 'pending';
