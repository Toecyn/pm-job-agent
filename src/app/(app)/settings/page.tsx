import { prisma } from "@/lib/db/client"
import { getSettings } from "@/lib/config/settings"
import { Card, CardTitle } from "@/components/ui/Card"
import {
  updateGeneralSettingsAction,
  updateApprovalSettingsAction,
  updateAiSettingsAction,
  updateNotificationSettingsAction,
  addWatchedBoardAction,
  savePredefinedAnswerAction,
} from "@/app/_actions/settingsActions"
import { sensitiveCategoryList } from "@/lib/questions/classify"
import { WatchedBoardsList } from "./WatchedBoardsList"
import { PredefinedAnswersList } from "./PredefinedAnswersList"
import { explainedNonAutomatableSources } from "@/lib/sources/registry"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const [settings, boards, answers] = await Promise.all([
    getSettings(),
    prisma.watchedBoard.findMany({ orderBy: { source: "asc" } }),
    prisma.predefinedAnswer.findMany({ orderBy: { category: "asc" } }),
  ])

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Settings</h1>

      <Card>
        <CardTitle>Search &amp; scoring</CardTitle>
        <form action={updateGeneralSettingsAction} className="mt-3 grid gap-3 md:grid-cols-2">
          <LabeledInput label="Job titles (comma separated)" name="jobTitles" defaultValue={settings.jobTitles.join(", ")} full />
          <LabeledInput label="Target seniorities" name="targetSeniorities" defaultValue={settings.targetSeniorities.join(", ")} />
          <LabeledInput label="Industries" name="industries" defaultValue={settings.industries.join(", ")} />
          <LabeledInput label="Locations" name="locations" defaultValue={settings.locations.join(", ")} />
          <LabeledInput label="Countries" name="countries" defaultValue={settings.countries.join(", ")} />
          <label className="block text-sm">
            <span className="text-slate-700">Remote preference</span>
            <select name="remotePreference" defaultValue={settings.remotePreference} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
              <option value="onsite">Onsite</option>
              <option value="any">Any</option>
            </select>
          </label>
          <LabeledInput label="Minimum fit score to apply" name="minFitScore" type="number" defaultValue={String(settings.minFitScore)} />
          <LabeledInput label="Minimum quality score" name="minQualityScore" type="number" defaultValue={String(settings.minQualityScore)} />
          <LabeledInput label="Initial search window (days)" name="initialWindowDays" type="number" defaultValue={String(settings.initialWindowDays)} />
          <LabeledInput label="Search overlap (minutes)" name="overlapMinutes" type="number" defaultValue={String(settings.overlapMinutes)} />
          <LabeledInput label="Follow-up delay (days)" name="followUpDelayDays" type="number" defaultValue={String(settings.followUpDelayDays)} />
          <label className="block text-sm">
            <span className="text-slate-700">Cover letter preference</span>
            <select name="coverLetterPreference" defaultValue={settings.coverLetterPreference} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="always">Always generate</option>
              <option value="if_required">Only if job requires one</option>
              <option value="never">Never</option>
            </select>
          </label>
          <div className="md:col-span-2">
            <SaveButton />
          </div>
        </form>
      </Card>

      <Card>
        <CardTitle>Human approval mode (brief §16)</CardTitle>
        <form action={updateApprovalSettingsAction} className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="block text-sm md:col-span-3">
            <span className="text-slate-700">Approval mode</span>
            <select name="approvalMode" defaultValue={settings.approvalMode} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="MANUAL">MANUAL — prepare everything, never submit</option>
              <option value="REVIEW">REVIEW — fill and wait for my approval (default)</option>
              <option value="AUTO">AUTO — submit automatically when rules are met</option>
            </select>
          </label>
          <LabeledInput label="AUTO: min fit score" name="autoApplyMinFit" type="number" defaultValue={String(settings.autoApplyMinFit)} />
          <LabeledInput label="AUTO: min quality score" name="autoApplyMinQuality" type="number" defaultValue={String(settings.autoApplyMinQuality)} />
          <div className="md:col-span-3">
            <SaveButton />
          </div>
        </form>
      </Card>

      <Card>
        <CardTitle>AI provider (brief §31)</CardTitle>
        <form action={updateAiSettingsAction} className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="block text-sm">
            <span className="text-slate-700">Provider</span>
            <select name="aiProvider" defaultValue={settings.aiProvider} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="null">None (deterministic templates — no API key needed)</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
            </select>
          </label>
          <LabeledInput label="Model (optional override)" name="aiModel" defaultValue={settings.aiModel} />
          <div className="md:col-span-2">
            <p className="text-xs text-slate-500">Set OPENAI_API_KEY / ANTHROPIC_API_KEY in your environment for the selected provider to activate.</p>
            <SaveButton />
          </div>
        </form>
      </Card>

      <Card>
        <CardTitle>Notification channels (brief §26)</CardTitle>
        <form action={updateNotificationSettingsAction} className="mt-3 space-y-2">
          {["dashboard", "console", "slack", "telegram", "email"].map((c) => (
            <label key={c} className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="channels" value={c} defaultChecked={settings.notificationPrefs.channels.includes(c)} disabled={c === "dashboard"} />
              {c} {c === "dashboard" && <span className="text-xs text-slate-400">(always on)</span>}
              {(c === "slack" || c === "telegram" || c === "email") && <span className="text-xs text-slate-400">(requires env credentials — see .env.example)</span>}
            </label>
          ))}
          <SaveButton />
        </form>
      </Card>

      <Card>
        <CardTitle>Job sources</CardTitle>
        <p className="mt-1 text-xs text-slate-500">Greenhouse, Lever, and Ashby are polled directly via their public job-board APIs — add the company board tokens you want watched.</p>
        <form action={addWatchedBoardAction} className="mt-3 flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="block text-slate-700">Source</span>
            <select name="source" className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="greenhouse">Greenhouse</option>
              <option value="lever">Lever</option>
              <option value="ashby">Ashby</option>
            </select>
          </label>
          <LabeledInput label="Board token / org slug" name="token" />
          <LabeledInput label="Label" name="label" />
          <SaveButton label="Add" />
        </form>
        <WatchedBoardsList boards={boards} />
        <div className="mt-4 rounded-md bg-slate-50 p-3 text-xs text-slate-500">
          <div className="font-medium text-slate-700">Not automated (by design):</div>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {explainedNonAutomatableSources.map((s) => (
              <li key={s.id}>
                <strong>{s.id}</strong> — {s.reason}
              </li>
            ))}
          </ul>
        </div>
      </Card>

      <Card>
        <CardTitle>Predefined answers for sensitive questions (brief §17)</CardTitle>
        <p className="mt-1 text-xs text-slate-500">The agent never invents answers to these categories — it uses one of these, or leaves the question for you to answer per-application.</p>
        <form action={savePredefinedAnswerAction} className="mt-3 grid gap-2 md:grid-cols-2">
          <label className="block text-sm">
            <span className="text-slate-700">Category</span>
            <select name="category" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              {sensitiveCategoryList.map((c) => (
                <option key={c} value={c}>
                  {c.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
          <LabeledInput label="Question text/pattern" name="question" />
          <textarea name="answer" placeholder="Your answer" rows={2} className="rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-2" />
          <div className="md:col-span-2">
            <SaveButton label="Save answer" />
          </div>
        </form>
        <PredefinedAnswersList answers={answers} />
      </Card>
    </div>
  )
}

function LabeledInput({ label, name, defaultValue, type = "text", full }: { label: string; name: string; defaultValue?: string; type?: string; full?: boolean }) {
  return (
    <label className={`block text-sm ${full ? "md:col-span-2" : ""}`}>
      <span className="text-slate-700">{label}</span>
      <input name={name} type={type} defaultValue={defaultValue} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
    </label>
  )
}

function SaveButton({ label = "Save" }: { label?: string }) {
  return (
    <button type="submit" className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700">
      {label}
    </button>
  )
}
