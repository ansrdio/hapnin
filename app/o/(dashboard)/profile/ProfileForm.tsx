"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateProfileAction } from "@/app/o/actions";
import { initialActionState } from "@/app/admin/action-state";
import { Card, Field, Input, Textarea, buttonClass } from "@/app/components/ui";
import { FlyerUpload } from "@/app/components/FlyerUpload";

type Profile = { name: string; bio: string; instagram: string; avatar_url: string; handle: string };

function Save() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass("primary")}>
      {pending ? "Saving…" : "Save profile"}
    </button>
  );
}

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, action] = useActionState(updateProfileAction, initialActionState);
  const err = state.fieldErrors ?? {};

  return (
    <form action={action} noValidate className="space-y-6">
      <Card className="space-y-5">
        <Field label="Photo / logo">
          <FlyerUpload name="avatar_url" initialUrl={profile.avatar_url} />
        </Field>
        <Field label="Name or crew" error={err.name}>
          <Input name="name" defaultValue={profile.name} />
        </Field>
        <Field label="Bio (optional)" hint="A line or two about who you are and what you throw.">
          <Textarea name="bio" rows={3} defaultValue={profile.bio} placeholder="Amapiano every Sunday. Phoenix’s home for the sound of SA." />
        </Field>
        <Field label="Instagram (optional)" error={err.instagram}>
          <Input name="instagram" defaultValue={profile.instagram} placeholder="auracollective" />
        </Field>
        <div className="text-sm text-mauve-dim">
          Public page: <span className="text-cream">hapnin.now/o/{profile.handle}</span>
        </div>
      </Card>

      {state.status === "success" && <p className="text-sm text-emerald">{state.message}</p>}
      {state.status === "error" && state.message && <p className="text-sm text-coral">{state.message}</p>}
      <div className="flex items-center gap-4">
        <Save />
        <a href={`/o/${profile.handle}`} target="_blank" rel="noreferrer" className="text-sm text-mauve-dim hover:text-cream">
          View public page ↗
        </a>
      </div>
    </form>
  );
}
