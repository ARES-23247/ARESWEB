-- Add Zulip integration fields to content tables
ALTER TABLE posts ADD COLUMN zulip_stream TEXT;
ALTER TABLE posts ADD COLUMN zulip_topic TEXT;

ALTER TABLE events ADD COLUMN zulip_stream TEXT;
ALTER TABLE events ADD COLUMN zulip_topic TEXT;

ALTER TABLE docs ADD COLUMN zulip_stream TEXT;
ALTER TABLE docs ADD COLUMN zulip_topic TEXT;
