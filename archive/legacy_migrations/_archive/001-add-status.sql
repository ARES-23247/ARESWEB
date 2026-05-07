-- Migration 001: Add review tier status column
-- Values: 'published' (default for existing + admin submissions), 'pending' (author submissions awaiting review)

ALTER TABLE posts ADD COLUMN status TEXT DEFAULT 'published';
ALTER TABLE docs ADD COLUMN status TEXT DEFAULT 'published';
ALTER TABLE events ADD COLUMN status TEXT DEFAULT 'published';
