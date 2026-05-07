import { inquiries } from "./src/db/schema";
import { drizzle } from "drizzle-orm/d1";

// @ts-ignore
const db = drizzle(null as any);

const query = db.insert(inquiries).values({
	id: "test",
	type: "test",
	name: "Test",
	email: "test@test.com",
}).toSQL();

console.log(query);
