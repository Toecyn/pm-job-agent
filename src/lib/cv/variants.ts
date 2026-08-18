import type { CvVariantKey } from "@/lib/types/enums"

/** Automatic base-CV selection (brief §11) — deterministic, based on the job's classified title family. */
export function selectBaseVariant(titleFamily: string, seniority: string): CvVariantKey {
  switch (titleFamily) {
    case "ai_product_manager":
      return "ai_pm"
    case "data_product_manager":
      return "data_pm"
    case "technical_product_manager":
      return "technical_pm"
    case "product_strategy":
      return "product_strategy"
    case "senior_product_manager":
    case "product_lead":
    case "senior_product_lead":
    case "principal_product_manager":
    case "group_product_manager":
      return "senior_pm"
    default:
      return seniority === "senior" || seniority === "lead" || seniority === "principal" || seniority === "group"
        ? "senior_pm"
        : "general_pm"
  }
}
