import { sql } from "@astra/db";
import { connection } from "next/server";
import { config } from "../../../config.ts";
import { db } from "../../../db.ts";
import { log } from "../../../logger.ts";

/**
 * Liveness plus a database round trip. Docker, Caddy and the deploy pipeline
 * poll this; `version` shows which commit is serving.
 */
export async function GET(): Promise<Response> {
  // Never prerender: the answer must describe this moment.
  await connection();
  const version = config().APP_VERSION;

  try {
    await db().execute(sql`select 1`);
    return Response.json({ ok: true, version, checks: { database: "ok" } });
  } catch (err) {
    log().error({ err }, "health check failed: database unreachable");
    return Response.json(
      { ok: false, version, checks: { database: "unreachable" } },
      { status: 503 },
    );
  }
}
