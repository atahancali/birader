#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OLD_DOMAIN = (process.env.OLD_DOMAIN || "birader.local").toLowerCase();
const NEW_DOMAIN = (process.env.NEW_DOMAIN || "birader.app").toLowerCase();
const DRY_RUN = (process.env.DRY_RUN || "true").toLowerCase() !== "false";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
  process.exit(1);
}

if (OLD_DOMAIN === NEW_DOMAIN) {
  console.error("OLD_DOMAIN and NEW_DOMAIN cannot be the same.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function toNewEmail(email) {
  const at = email.indexOf("@");
  if (at < 0) return null;
  const local = email.slice(0, at);
  return `${local}@${NEW_DOMAIN}`;
}

async function listAllUsers() {
  const all = [];
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const users = data?.users || [];
    all.push(...users);
    if (users.length < perPage) break;
    page += 1;
  }

  return all;
}

async function main() {
  const users = await listAllUsers();
  const existing = new Set(
    users
      .map((u) => (u.email || "").toLowerCase())
      .filter(Boolean)
  );

  const candidates = users
    .filter((u) => (u.email || "").toLowerCase().endsWith(`@${OLD_DOMAIN}`))
    .map((u) => ({
      id: u.id,
      oldEmail: String(u.email).toLowerCase(),
      newEmail: toNewEmail(String(u.email).toLowerCase()),
    }))
    .filter((x) => !!x.newEmail);

  if (!candidates.length) {
    console.log(`No users found with @${OLD_DOMAIN}`);
    return;
  }

  let migrated = 0;
  let skipped = 0;

  console.log(
    `${DRY_RUN ? "[DRY_RUN]" : "[LIVE]"} Found ${candidates.length} users to migrate from @${OLD_DOMAIN} to @${NEW_DOMAIN}`
  );

  for (const row of candidates) {
    if (existing.has(row.newEmail) && row.newEmail !== row.oldEmail) {
      skipped += 1;
      console.log(`SKIP ${row.id} ${row.oldEmail} -> ${row.newEmail} (target email already exists)`);
      continue;
    }

    if (DRY_RUN) {
      migrated += 1;
      console.log(`PLAN ${row.id} ${row.oldEmail} -> ${row.newEmail}`);
      continue;
    }

    const { error } = await supabase.auth.admin.updateUserById(row.id, {
      email: row.newEmail,
      email_confirm: true,
    });

    if (error) {
      skipped += 1;
      console.log(`SKIP ${row.id} ${row.oldEmail} -> ${row.newEmail} (${error.message})`);
      continue;
    }

    migrated += 1;
    console.log(`OK   ${row.id} ${row.oldEmail} -> ${row.newEmail}`);
  }

  console.log(`Done. migrated=${migrated} skipped=${skipped} total=${candidates.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
