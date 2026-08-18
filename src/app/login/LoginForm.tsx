"use client"

import { useActionState, useState } from "react"
import { bootstrapPasswordAction, loginAction, type LoginState } from "./actions"

const initialState: LoginState = {}

export function LoginForm({ needsBootstrap, defaultEmail }: { needsBootstrap: boolean; defaultEmail: string }) {
  const [state, action, pending] = useActionState(needsBootstrap ? bootstrapPasswordAction : loginAction, initialState)

  if (state.hashToCopy) {
    return <HashToCopyPanel hash={state.hashToCopy} />
  }

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

/**
 * Shown instead of the form when the server couldn't write the password
 * hash to disk — a read-only filesystem is normal on serverless hosts
 * (Vercel and similar). The password was never sent anywhere except this
 * computation; only the resulting hash needs to leave the browser.
 */
function HashToCopyPanel({ hash }: { hash: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <div className="mt-6 space-y-3 text-sm">
      <p className="text-slate-700">
        This deployment&apos;s filesystem is read-only, so the password can&apos;t be saved to a local <code>.env</code> file the
        way it would in local development. Instead:
      </p>
      <ol className="list-decimal space-y-1 pl-5 text-slate-700">
        <li>Copy the value below.</li>
        <li>
          In your hosting platform (e.g. Vercel → Project → Settings → Environment Variables), set{" "}
          <code className="font-mono text-xs">AUTH_PASSWORD_HASH</code> to it.
        </li>
        <li>Redeploy, then sign in with the password you just chose.</li>
      </ol>
      <div className="flex items-center gap-2">
        <code className="block flex-1 overflow-x-auto rounded-md bg-slate-100 px-3 py-2 text-xs break-all">{hash}</code>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(hash)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }}
          className="shrink-0 rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      <p className="text-xs text-slate-400">Reload this page after redeploying to sign in normally.</p>
    </div>
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
