import { LoginForm } from "./LoginForm"

export default function LoginPage() {
  const needsBootstrap = !process.env.AUTH_PASSWORD_HASH

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">PM Job Search Agent</h1>
        <p className="mt-1 text-sm text-slate-500">
          {needsBootstrap ? "First run — set a password to protect your dashboard." : "Sign in to continue."}
        </p>
        <LoginForm needsBootstrap={needsBootstrap} defaultEmail={process.env.AUTH_USER_EMAIL ?? "you@example.com"} />
      </div>
    </div>
  )
}
