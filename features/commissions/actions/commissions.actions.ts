// @ts-nocheck
"use server"

import { createServerClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { logAudit } from "@/features/audit/actions/audit.actions"

export async function closePeriodCommissions(month: string) {
  try {
    const supabase = await createServerClient()
    
    const start = new Date(`${month}-01`)
    const end = new Date(start)
    end.setMonth(end.getMonth() + 1)

    const { data, error } = await supabase
      .from("commission_entries")
      .update({ status: "paid" })
      .eq("status", "pending")
      .gte("competence_date", start.toISOString())
      .lt("competence_date", end.toISOString())
      .select()

    if (error) throw error

    await logAudit({
      action: 'UPDATE',
      entity: 'commission_entries',
      observation: `Fechamento de comissões. Mês referência: ${month}. Afetadas: ${data?.length || 0}`
    })

    revalidatePath("/comissoes")
    return { success: true, count: data?.length || 0 }
  } catch (error: any) {
    console.error("Close Period Error:", error)
    return { success: false, error: error.message || "Erro ao fechar período" }
  }
}
