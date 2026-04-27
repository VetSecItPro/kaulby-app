-- Migration: ON UPDATE CASCADE on every FK to users.id + promote
-- workspaces.owner_id from logical reference to a real FK.
--
-- Establishes the architectural rule that Clerk owns user identity. When
-- a user's Clerk ID is regenerated (account recovery, OAuth re-creation),
-- a single UPDATE users SET id=... cascades to every child row. This
-- replaces the previous 5-step manual swap pattern in auth-utils.ts with
-- a single statement.
--
-- See: src/lib/auth-utils.ts (reconcileClerkUserId).

-- ============================================================
-- 19 declared FKs to users.id — add ON UPDATE CASCADE.
-- 18 of these were ON DELETE CASCADE; ai_logs is ON DELETE SET NULL.
-- All preserve their existing ON DELETE behavior.
-- ============================================================

ALTER TABLE activity_logs DROP CONSTRAINT activity_logs_user_id_users_id_fk,
  ADD CONSTRAINT activity_logs_user_id_users_id_fk FOREIGN KEY (user_id)
  REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
--> statement-breakpoint
ALTER TABLE ai_logs DROP CONSTRAINT ai_logs_user_id_users_id_fk,
  ADD CONSTRAINT ai_logs_user_id_users_id_fk FOREIGN KEY (user_id)
  REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;
--> statement-breakpoint
ALTER TABLE ai_visibility_checks DROP CONSTRAINT ai_visibility_checks_user_id_users_id_fk,
  ADD CONSTRAINT ai_visibility_checks_user_id_users_id_fk FOREIGN KEY (user_id)
  REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
--> statement-breakpoint
ALTER TABLE api_keys DROP CONSTRAINT api_keys_user_id_users_id_fk,
  ADD CONSTRAINT api_keys_user_id_users_id_fk FOREIGN KEY (user_id)
  REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
--> statement-breakpoint
ALTER TABLE audiences DROP CONSTRAINT audiences_user_id_users_id_fk,
  ADD CONSTRAINT audiences_user_id_users_id_fk FOREIGN KEY (user_id)
  REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
--> statement-breakpoint
ALTER TABLE bookmark_collections DROP CONSTRAINT bookmark_collections_user_id_users_id_fk,
  ADD CONSTRAINT bookmark_collections_user_id_users_id_fk FOREIGN KEY (user_id)
  REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
--> statement-breakpoint
ALTER TABLE bookmarks DROP CONSTRAINT bookmarks_user_id_users_id_fk,
  ADD CONSTRAINT bookmarks_user_id_users_id_fk FOREIGN KEY (user_id)
  REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
--> statement-breakpoint
ALTER TABLE chat_conversations DROP CONSTRAINT chat_conversations_user_id_users_id_fk,
  ADD CONSTRAINT chat_conversations_user_id_users_id_fk FOREIGN KEY (user_id)
  REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
--> statement-breakpoint
ALTER TABLE email_delivery_failures DROP CONSTRAINT email_delivery_failures_user_id_users_id_fk,
  ADD CONSTRAINT email_delivery_failures_user_id_users_id_fk FOREIGN KEY (user_id)
  REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
--> statement-breakpoint
ALTER TABLE email_events DROP CONSTRAINT email_events_user_id_users_id_fk,
  ADD CONSTRAINT email_events_user_id_users_id_fk FOREIGN KEY (user_id)
  REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
--> statement-breakpoint
ALTER TABLE feedback DROP CONSTRAINT feedback_user_id_users_id_fk,
  ADD CONSTRAINT feedback_user_id_users_id_fk FOREIGN KEY (user_id)
  REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
--> statement-breakpoint
ALTER TABLE monitors DROP CONSTRAINT monitors_user_id_users_id_fk,
  ADD CONSTRAINT monitors_user_id_users_id_fk FOREIGN KEY (user_id)
  REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
--> statement-breakpoint
ALTER TABLE notifications DROP CONSTRAINT notifications_user_id_users_id_fk,
  ADD CONSTRAINT notifications_user_id_users_id_fk FOREIGN KEY (user_id)
  REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
--> statement-breakpoint
ALTER TABLE saved_searches DROP CONSTRAINT saved_searches_user_id_users_id_fk,
  ADD CONSTRAINT saved_searches_user_id_users_id_fk FOREIGN KEY (user_id)
  REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
--> statement-breakpoint
ALTER TABLE saved_views DROP CONSTRAINT saved_views_user_id_users_id_fk,
  ADD CONSTRAINT saved_views_user_id_users_id_fk FOREIGN KEY (user_id)
  REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
--> statement-breakpoint
ALTER TABLE shared_reports DROP CONSTRAINT shared_reports_user_id_users_id_fk,
  ADD CONSTRAINT shared_reports_user_id_users_id_fk FOREIGN KEY (user_id)
  REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
--> statement-breakpoint
ALTER TABLE usage DROP CONSTRAINT usage_user_id_users_id_fk,
  ADD CONSTRAINT usage_user_id_users_id_fk FOREIGN KEY (user_id)
  REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
--> statement-breakpoint
ALTER TABLE user_detection_keywords DROP CONSTRAINT user_detection_keywords_user_id_users_id_fk,
  ADD CONSTRAINT user_detection_keywords_user_id_users_id_fk FOREIGN KEY (user_id)
  REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
--> statement-breakpoint
ALTER TABLE webhooks DROP CONSTRAINT webhooks_user_id_users_id_fk,
  ADD CONSTRAINT webhooks_user_id_users_id_fk FOREIGN KEY (user_id)
  REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
--> statement-breakpoint

-- ============================================================
-- workspaces.owner_id was a logical reference (text + index, no FK).
-- Promote to a real FK with cascade-on-delete and cascade-on-update.
-- The circular dep with users.workspace_id is handled by ALTER TABLE
-- post-creation, not inline at table-create time.
-- ============================================================

-- Clean up any orphan workspaces before adding the constraint.
DELETE FROM workspaces w
WHERE w.owner_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = w.owner_id);
--> statement-breakpoint

ALTER TABLE workspaces
  ADD CONSTRAINT workspaces_owner_id_users_id_fk FOREIGN KEY (owner_id)
  REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
