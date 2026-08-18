"use client"

import { useActionState } from "react"
import { bootstrapPasswordAction, loginAction, type LoginState } from "./actions"

const initialState: LoginState = {}

export function LoginForm({ needsBootstrap, defaultEmail }: { needsBootstrap: boolean; defaultEmail: string }) {
  const [state, action, pending] = useActionState(needsBootstrap ? bootstrapPasswordAction : loginAction, initialState)

  return (
    <form action={action} className="mt-6 space-y-4">
      {needsBootstrap ? (
        <>
          <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Account email: <span className="font-medium text-slate-900">{defaultEmail}</span> (set via AUTH_USER_EMAIL)
          </div>
          <Field label="New password" name="password" type="password" />
          <Field label="Confirm password" name="confirm" type="password" />
        </>
      ) : (
        <>
          <Field label="Email" name="email" type="email" defaultValue={defaultEmail} />
          <Field label="Password" name="password" type="password" />
        </>
      )}
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
      >
        {pending ? "Please wait…" : needsBootstrap ? "Create password & continue" : "Sign in"}
      </button>
    </form>
  )
}

function Field({ label, name, type, defaultValue }: { label: string; name: string; type: string; defaultValue?: string }) {
  return (
    <label className="block text-sm">
      <span className="text-slate-700">{label}</span>
      <input
        name={name}
        type={type}
        required
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
      />
    </label>
  )
}
