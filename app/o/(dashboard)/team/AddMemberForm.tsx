"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { addTeamMemberAction } from "@/app/o/actions";
import { initialActionState } from "@/app/admin/action-state";
import { Field, Input, Select, buttonClass } from "@/app/components/ui";
import { TEAM_ROLE } from "@/lib/enums";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className={buttonClass("primary")}>
      {pending ? "Adding…" : "Add member"}
    </button>
  );
}

export function AddMemberForm() {
  const [state, action] = useActionState(addTeamMemberAction, initialActionState);
  const err = state.fieldErrors ?? {};

  return (
    <form action={action} noValidate className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr_140px]">
        <Field label="Email" error={err.email}>
          <Input name="email" type="email" placeholder="door@crew.com" />
        </Field>
        <Field label="Name (optional)">
          <Input name="name" placeholder="Tunde" />
        </Field>
        <Field label="Role" error={err.role}>
          <Select name="role" options={TEAM_ROLE} />
        </Field>
      </div>
      {state.status === "success" && <p className="text-sm text-emerald">{state.message}</p>}
      {state.status === "error" && state.message && <p className="text-sm text-coral">{state.message}</p>}
      <Submit />
    </form>
  );
}
