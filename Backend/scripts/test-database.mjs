import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";

const root = new URL("../../", import.meta.url);
const db = new PGlite({ extensions: { btree_gist } });
const sql = async (path) => readFile(new URL(path, root), "utf8");

try {
  // PGlite runs the real PostgreSQL engine. Only Supabase-managed auth objects
  // are fixtures; this does NOT test GoTrue sign-in, JWT signatures or the API.
  await db.exec(await sql("Backend/scripts/fixtures/supabase-auth.sql"));
  const migrations = (
    await readdir(new URL("Backend/supabase/migrations/", root))
  )
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of migrations) {
    await db.exec(await sql(`Backend/supabase/migrations/${file}`));
    console.log(`APPLIED ${file}`);
  }
  await db.exec(await sql("Backend/supabase/seed.sql"));
  console.log("SEEDED four demo Auth accounts and four pets");
  const suites = [
    "security_basics.sql",
    "owner_read_smoke.sql",
    "owner_isolation.sql",
    "appointment_constraints.sql",
    "vaccination_rules.sql",
  ];
  for (const file of suites) {
    await db.exec(await sql(`Backend/supabase/tests/${file}`));
    console.log(`PASS ${file}`);
  }
  console.log(
    `PASS ${suites.length} PostgreSQL suites; all mutations rolled back`,
  );
} catch (error) {
  console.error(
    "Database verification failed:",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
} finally {
  await db.close();
}
