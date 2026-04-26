import { config } from "dotenv";
config();
import { createKysely } from "@vercel/postgres-kysely";
import { Kysely, SqliteDialect } from "kysely";
import Database from "better-sqlite3";
import { DB } from "./shared/schemas/database";
import * as crypto from "crypto";

const sqlite = new Database(".wrangler/state/v3/d1/miniflare-D1DatabaseObject/b50f39d2832143fa7eaf6a5820bc2ecd2a7a0bfa314804344cf78d3ff9b5f198.sqlite");

const db = new Kysely<DB>({
  dialect: new SqliteDialect({
    database: sqlite,
  }),
});

async function main() {
  try {
    const genId = crypto.randomUUID();
    await db.insertInto("events")
      .values({
        id: genId, 
        title: "Test Script Event", 
        category: "internal", 
        date_start: "2026-04-26T12:00:00Z", 
        date_end: null,
        location: "", 
        description: "", 
        cover_image: "",
        gcal_event_id: null, 
        cf_email: "test@example.com", 
        status: "published",
        is_potluck: 0, 
        is_volunteer: 0,
        published_at: null, 
        season_id: null, 
        meeting_notes: null
      })
      .execute();
    console.log("Success!");
  } catch (err) {
    console.error("Failed!", err);
  }
}

main();
