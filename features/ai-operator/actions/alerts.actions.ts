// @ts-nocheck
"use server"

import { getStockInconsistencies } from "../services/alerts.service"

export async function fetchStockAlertsAction() {
  try {
    const data = await getStockInconsistencies()
    return { success: true, data }
  } catch (error: any) {
    console.error("Failed to fetch alerts:", error)
    return { success: false, error: error.message }
  }
}
