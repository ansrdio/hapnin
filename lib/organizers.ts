import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getDb, ALREADY_EXISTS } from "./firebase-admin";

export type Organizer = {
  id: string;
  firebase_uid: string | null;
  name: string;
  handle: string;
  instagram_handle: string | null;
  email: string;
  phone: string;
  stripe_account_id: string | null;
  stripe_onboarded: boolean;
  marketing_approved: boolean;
};

const COLL = "organizers";

function toOrganizer(id: string, d: FirebaseFirestore.DocumentData): Organizer {
  return {
    id,
    firebase_uid: d.firebase_uid ?? null,
    name: d.name,
    handle: d.handle,
    instagram_handle: d.instagram_handle ?? null,
    email: d.email,
    phone: d.phone,
    stripe_account_id: d.stripe_account_id ?? null,
    stripe_onboarded: !!d.stripe_onboarded,
    marketing_approved: !!d.marketing_approved,
  };
}

/** Create an organizer, reserving the handle atomically. Throws "HANDLE_TAKEN". */
export async function createOrganizer(input: {
  name: string;
  handle: string;
  email: string;
  phone: string;
  instagram_handle?: string | null;
}): Promise<Organizer> {
  const db = getDb();
  const handle = input.handle.toLowerCase();
  const ref = db.collection(COLL).doc();
  try {
    // Reserve the handle first; create() fails if the handle doc already exists.
    await db.collection("handles").doc(handle).create({ organizer_id: ref.id });
  } catch (err) {
    if ((err as { code?: number }).code === ALREADY_EXISTS) throw new Error("HANDLE_TAKEN");
    throw err;
  }
  const data = {
    firebase_uid: null,
    name: input.name,
    handle,
    instagram_handle: input.instagram_handle ?? null,
    email: input.email.toLowerCase(),
    phone: input.phone,
    stripe_account_id: null,
    stripe_onboarded: false,
    marketing_approved: false,
    created_at: FieldValue.serverTimestamp(),
  };
  await ref.set(data);
  return toOrganizer(ref.id, data);
}

export async function getOrganizerById(id: string): Promise<Organizer | null> {
  const snap = await getDb().collection(COLL).doc(id).get();
  return snap.exists ? toOrganizer(snap.id, snap.data()!) : null;
}

async function firstWhere(field: string, value: string): Promise<Organizer | null> {
  const snap = await getDb().collection(COLL).where(field, "==", value).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return toOrganizer(doc.id, doc.data());
}

export const getOrganizerByUid = (uid: string) => firstWhere("firebase_uid", uid);
export const getOrganizerByEmail = (email: string) => firstWhere("email", email.toLowerCase());
export const getOrganizerByHandle = (handle: string) => firstWhere("handle", handle.toLowerCase());

/** Bind a Firebase Auth uid to an organizer on their first login. */
export async function linkOrganizerUid(id: string, uid: string): Promise<void> {
  await getDb().collection(COLL).doc(id).update({ firebase_uid: uid });
}

export async function setStripeAccountId(id: string, stripeAccountId: string): Promise<void> {
  await getDb().collection(COLL).doc(id).update({ stripe_account_id: stripeAccountId });
}

export async function setStripeOnboarded(stripeAccountId: string, onboarded: boolean): Promise<void> {
  const db = getDb();
  const snap = await db.collection(COLL).where("stripe_account_id", "==", stripeAccountId).limit(1).get();
  if (snap.empty) return;
  await snap.docs[0].ref.update({ stripe_onboarded: onboarded });
}

export async function listOrganizers(): Promise<Organizer[]> {
  const snap = await getDb().collection(COLL).orderBy("created_at", "desc").limit(200).get();
  return snap.docs.map((d) => toOrganizer(d.id, d.data()));
}
