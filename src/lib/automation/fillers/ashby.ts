import { fillGenericAtsForm } from "./generic"
import type { FillContext, FillOutcome } from "./types"

export async function fillAshbyApplication(ctx: FillContext): Promise<FillOutcome> {
  return fillGenericAtsForm(ctx)
}
