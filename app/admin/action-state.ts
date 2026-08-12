import type { FieldErrors } from "@/lib/validation";

// Kept out of the "use server" actions file: server components import those
// actions, and a "use server" module may only export async functions.
export type ActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: FieldErrors;
};

export const initialActionState: ActionState = { status: "idle" };
