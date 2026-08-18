"use client"

import { useActionState, useState, useTransition, type ReactNode } from "react"
import { createProfileAction, parseCvAction, type CreateProfileState, type ParsedCv } from "@/app/_actions/onboardingActions"

const initialState: CreateProfileState = {}

export function OnboardingForm({ defaultEmail }: { defaultEmail: string }) {
  const [state, action, pending] = useActionState(createProfileAction, initialState)
  const [cvText, setCvText] = useState("")
  const [parsed, setParsed] = useState<ParsedCv | null>(null)
  const [parsing, startParsing] = useTransition()

  return (
    <form action={action} className="mt-6 space-y-6">
      <Section title="1. Master CV">
        <textarea
          name="masterCvRaw"
          value={cvText}
          onChange={(e) => setCvText(e.target.value)}
          rows={8}
          placeholder="Paste your CV text here…"
          className="w-full rounded-md border border-slate-300 p-3 text-sm"
        />
        <button
          type="button"
          disabled={parsing || !cvText.trim()}
          onClick={() => startParsing(async () => setParsed(await parseCvAction(cvText)))}
          className="mt-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 disabled:opacity-40"
        >
          {parsing ? "Parsing…" : "Parse CV to prefill fields below"}
        </button>
        {parsed && (
          <div className="mt-3 rounded-md bg-slate-50 p-3 text-xs text-slate-600">
            <div className="font-medium text-slate-800">Extracted (review below — nothing is saved automatically):</div>
            <div>Name: {parsed.fullName}</div>
            <div>Current role: {parsed.currentRole}</div>
            <div>Years experience: {parsed.yearsExperience ?? "UNKNOWN"}</div>
            <div>PM skills: {parsed.pmSkills.join(", ") || "UNKNOWN"}</div>
          </div>
        )}
      </Section>

      <Section title="2. Basic profile">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Full name" name="fullName" defaultValue={parsed?.fullName !== "UNKNOWN" ? parsed?.fullName : undefined} required />
          <Field label="Email" name="email" type="email" defaultValue={defaultEmail} required />
          <Field label="Current location (City, Country)" name="location" />
          <Field label="LinkedIn URL" name="linkedinUrl" />
          <Field label="Portfolio URL" name="portfolioUrl" />
          <Field label="GitHub URL" name="githubUrl" />
          <Field label="Current role" name="currentRole" defaultValue={parsed?.currentRole !== "UNKNOWN" ? parsed?.currentRole : undefined} />
          <Field label="Current company" name="currentCompany" />
          <Field label="Years of experience" name="yearsExperience" type="number" defaultValue={parsed?.yearsExperience ? String(parsed.yearsExperience) : undefined} />
        </div>
      </Section>

      <Section title="3. Work authorization &amp; location strategy (brief §38)">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Citizenship / authorization country" name="authCountry" />
          <Field label="Authorization status (e.g. citizen, PR, visa required)" name="authStatus" />
          <Field label="Preferred countries (comma separated)" name="preferredCountries" />
          <Field label="Preferred cities (comma separated)" name="preferredCities" />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="sponsorshipNeeded" /> I would need visa sponsorship for onsite roles outside my country
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="willingToRelocate" /> I&apos;m open to relocating
          </label>
          <label className="text-sm">
            <span className="text-slate-700">Work mode preference</span>
            <select name="workModePreference" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue="remote">
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
              <option value="onsite">Onsite</option>
              <option value="any">Any</option>
            </select>
          </label>
        </div>
      </Section>

      <Section title="4. Target roles &amp; skills">
        <div className="grid gap-3 md:grid-cols-2">
          <Field
            label="Job titles to search for (comma separated)"
            name="jobTitles"
            full
            defaultValue="Product Manager, Senior Product Manager, Product Lead, AI Product Manager, Technical Product Manager"
          />
          <Field label="Target seniorities (junior, mid, senior, lead, principal, group)" name="targetSeniority" defaultValue="mid, senior" />
          <Field label="Target industries" name="industries" />
          <Field label="PM skills" name="pmSkills" defaultValue={parsed?.pmSkills.join(", ")} />
          <Field label="Technical skills" name="technicalSkills" defaultValue={parsed?.technicalSkills.join(", ")} />
        </div>
      </Section>

      <Section title="5. Compensation">
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Minimum ($/yr)" name="compMin" type="number" />
          <Field label="Target maximum ($/yr)" name="compMax" type="number" />
          <Field label="Currency" name="compCurrency" defaultValue="USD" />
        </div>
      </Section>

      <Section title="6. Application mode (brief §16)">
        <select name="approvalMode" defaultValue="REVIEW" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm md:w-96">
          <option value="MANUAL">MANUAL — prepare everything, never submit</option>
          <option value="REVIEW">REVIEW — fill and wait for my approval (recommended default)</option>
          <option value="AUTO">AUTO — submit automatically when my rules are met</option>
        </select>
      </Section>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
        {pending ? "Creating profile…" : "Create profile & run first search"}
      </button>
    </form>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-t border-slate-200 pt-4 first:border-t-0 first:pt-0">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      <div className="mt-3">{children}</div>
    </div>
  )
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required,
  full,
}: {
  label: string
  name: string
  type?: string
  defaultValue?: string
  required?: boolean
  full?: boolean
}) {
  return (
    <label className={`block text-sm ${full ? "md:col-span-2" : ""}`}>
      <span className="text-slate-700">{label}</span>
      <input name={name} type={type} defaultValue={defaultValue} required={required} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
    </label>
  )
}
