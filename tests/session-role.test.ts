// Regression: /api/auth/session must accept every account the login-link
// sender accepts (admins, organizers, team members). A door member who could
// receive a link but got 403 on exchange was the bug.

import { test } from "node:test";
import assert from "node:assert/strict";
import { decideSessionRole } from "../lib/session-role.ts";

test("admin allowlist wins and lands on /admin", () => {
  assert.deepEqual(decideSessionRole({ isAdmin: true, isOrganizer: true, membershipRole: "door" }), { role: "admin", landing: "/admin" });
});

test("organizer owner lands on the dashboard", () => {
  assert.deepEqual(decideSessionRole({ isAdmin: false, isOrganizer: true, membershipRole: null }), { role: "organizer", landing: "/o" });
});

test("manager team member can sign in and lands on the dashboard", () => {
  assert.deepEqual(decideSessionRole({ isAdmin: false, isOrganizer: false, membershipRole: "manager" }), { role: "team", landing: "/o" });
});

test("door team member can sign in and lands on the scanner", () => {
  assert.deepEqual(decideSessionRole({ isAdmin: false, isOrganizer: false, membershipRole: "door" }), { role: "team", landing: "/scan" });
});

test("unknown email is refused", () => {
  assert.equal(decideSessionRole({ isAdmin: false, isOrganizer: false, membershipRole: null }), null);
});

test("the session endpoint and the login-link sender consult the same three sources", async () => {
  const { readFileSync } = await import("node:fs");
  for (const f of ["app/api/auth/session/route.ts", "app/login/actions.ts"]) {
    const src = readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
    for (const fn of ["isAdminEmail", "getOrganizerByEmail", "findTeamMembership"]) {
      assert.ok(src.includes(fn), `${f} must use ${fn}`);
    }
  }
});
