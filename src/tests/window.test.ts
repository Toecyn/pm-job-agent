import { describe, it, expect } from "vitest"
import { prisma } from "@/lib/db/client"
import { computeSearchWindow, isWithinWindow } from "@/lib/scheduler/window"

describe("Search window logic (brief §2, §48)", () => {
  it("uses the initial window (default 7 days) when there is no previous successful search", async () => {
    const now = new Date("2026-08-18T08:00:00Z")
    const window = await computeSearchWindow({ initialWindowDays: 7, overlapMinutes: 45, now })

    expect(window.basis).toBe("initial_window")
    expect(window.windowEnd).toEqual(now)
    expect(window.windowStart).toEqual(new Date("2026-08-11T08:00:00Z"))
  })

  it("anchors the next window on the previous successful run's completedAt, with overlap", async () => {
    const previousCompletedAt = new Date("2026-08-18T08:00:00Z")
    await prisma.searchRun.create({
      data: {
        windowStart: new Date("2026-08-17T08:00:00Z"),
        windowEnd: previousCompletedAt,
        completedAt: previousCompletedAt,
        status: "success",
      },
    })

    const now = new Date("2026-08-19T08:00:00Z")
    const window = await computeSearchWindow({ initialWindowDays: 7, overlapMinutes: 45, now })

    expect(window.basis).toBe("previous_run")
    expect(window.windowStart).toEqual(new Date(previousCompletedAt.getTime() - 45 * 60_000))
    expect(window.windowEnd).toEqual(now)
  })

  it("a 'partial' run (some sources failed) still counts as an anchor for the next window", async () => {
    const completedAt = new Date("2026-08-18T08:00:00Z")
    await prisma.searchRun.create({
      data: { windowStart: new Date("2026-08-17T08:00:00Z"), windowEnd: completedAt, completedAt, status: "partial" },
    })

    const window = await computeSearchWindow({ initialWindowDays: 7, overlapMinutes: 45, now: new Date("2026-08-19T08:00:00Z") })
    expect(window.basis).toBe("previous_run")
  })

  it("a 'failed' run does NOT count as an anchor — falls back to the last successful/partial run", async () => {
    const goodCompletedAt = new Date("2026-08-16T08:00:00Z")
    await prisma.searchRun.create({
      data: { windowStart: new Date("2026-08-15T08:00:00Z"), windowEnd: goodCompletedAt, completedAt: goodCompletedAt, status: "success" },
    })
    await prisma.searchRun.create({
      data: { windowStart: new Date("2026-08-17T08:00:00Z"), windowEnd: new Date("2026-08-18T08:00:00Z"), completedAt: new Date("2026-08-18T08:00:00Z"), status: "failed" },
    })

    const window = await computeSearchWindow({ initialWindowDays: 7, overlapMinutes: 45, now: new Date("2026-08-19T08:00:00Z") })
    expect(window.windowStart).toEqual(new Date(goodCompletedAt.getTime() - 45 * 60_000))
  })

  it("treats a job with a known posted date as certain, and applies the window strictly", () => {
    const window = { windowStart: new Date("2026-08-17T00:00:00Z"), windowEnd: new Date("2026-08-18T00:00:00Z"), basis: "initial_window" as const }

    const inside = isWithinWindow(new Date("2026-08-17T12:00:00Z"), "known", window)
    expect(inside).toEqual({ withinWindow: true, certain: true })

    const outside = isWithinWindow(new Date("2026-08-01T12:00:00Z"), "known", window)
    expect(outside).toEqual({ withinWindow: false, certain: true })
  })

  it("never silently assumes a job with an unknown posted date is new — flags it as uncertain instead (brief §48)", () => {
    const window = { windowStart: new Date("2026-08-17T00:00:00Z"), windowEnd: new Date("2026-08-18T00:00:00Z"), basis: "initial_window" as const }
    const result = isWithinWindow(undefined, "unknown", window)
    expect(result.certain).toBe(false)
  })
})
