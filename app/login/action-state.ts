// Kept out of the "use server" actions file (those may only export async functions).
export type LoginState = {
  status: "idle" | "sent" | "fallback" | "error";
  message?: string;
  email?: string;
};

export const initialLoginState: LoginState = { status: "idle" };
