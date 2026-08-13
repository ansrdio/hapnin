import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "./firebase-admin";
import type { TeamRole } from "./enums";

// Team members help an organizer run events. Roles (lib/enums TEAM_ROLE):
//   manager — full dashboard + event management for that organizer
//   door    — door scanner only
// Membership is keyed by lowercased email (their login). One doc per
// (organizer, email); id = `${organizerId}:${email}`.

const COLL = "team_members";

export type TeamMember = {
  id: string;
  organizer_id: string;
  email: string;
  name: string | null;
  role: TeamRole;
};

function docId(organizerId: string, email: string): string {
  return `${organizerId}:${email.toLowerCase()}`;
}

function toMember(id: string, d: FirebaseFirestore.DocumentData): TeamMember {
  return {
    id,
    organizer_id: d.organizer_id,
    email: d.email,
    name: d.name ?? null,
    role: d.role,
  };
}

export async function addTeamMember(input: {
  organizerId: string;
  email: string;
  name?: string | null;
  role: TeamRole;
}): Promise<void> {
  const email = input.email.toLowerCase();
  await getDb().collection(COLL).doc(docId(input.organizerId, email)).set({
    organizer_id: input.organizerId,
    email,
    name: input.name ?? null,
    role: input.role,
    created_at: FieldValue.serverTimestamp(),
  });
}

export async function removeTeamMember(organizerId: string, email: string): Promise<void> {
  await getDb().collection(COLL).doc(docId(organizerId, email)).delete();
}

export async function listTeamMembers(organizerId: string): Promise<TeamMember[]> {
  const snap = await getDb().collection(COLL).where("organizer_id", "==", organizerId).get();
  return snap.docs.map((d) => toMember(d.id, d.data())).sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email));
}

/** Find the first organizer this email is a team member of (for access resolution). */
export async function findTeamMembership(email: string): Promise<{ organizerId: string; role: TeamRole } | null> {
  const snap = await getDb().collection(COLL).where("email", "==", email.toLowerCase()).limit(1).get();
  if (snap.empty) return null;
  const d = snap.docs[0].data();
  return { organizerId: d.organizer_id, role: d.role };
}
