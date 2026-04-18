"use server"

import { createServerClient } from "@/lib/supabase/server"
import { serviceSchema, ServiceFormValues } from "../validators"
import { ServicesFetchParams, ServicesListResponse } from "../types"
import { logAudit } from "@/features/audit/actions/audit.actions"
import { resolveUserProfileId } from "@/lib/supabase/resolve-user"
import { revalidatePath } from "next/cache"

export async function fetchServices(params: ServicesFetchParams): Promise<ServicesListResponse> {
  const supabase = await createServerClient()
  const page = params.page || 1
  const perPage = params.perPage || 10000 // default to all for client-side pagination
  
  let query = supabase.from("services").select("*, category:service_categories(id, name)", { count: "exact" })
  
  if (params.search) {
    const s = params.search.trim()
    query = query.ilike("normalized_name", `%${s.toLowerCase()}%`)
  }

  if (params.status && params.status !== "all") {
    query = query.eq("is_active", params.status === "active")
  }

  if (params.categoryId) {
    query = query.eq("category_id", params.categoryId)
  }

  // Alphabetical order by default
  query = query.order("name", { ascending: true })
  
  const from = (page - 1) * perPage
  const to = from + perPage - 1
  query = query.range(from, to)

  const { data, count, error } = await query
  
  if (error) {
    throw new Error(error.message)
  }

  return {
    data: (data as any) || [],
    count: count || 0,
    page,
    perPage,
    totalPages: Math.ceil((count || 0) / perPage) || 1
  }
}

export async function saveService(data: ServiceFormValues) {
  try {
    const validated = serviceSchema.parse(data)
    const supabase = await createServerClient()
    const { data: authData } = await supabase.auth.getUser()
    const userProfileId = await resolveUserProfileId(supabase, authData.user?.id)

    // Ensure normalized name
    const normalizedName = validated.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")

    const payload = {
      name: validated.name,
      normalized_name: normalizedName,
      description: validated.description || null,
      duration_minutes: validated.duration_minutes,
      price: validated.price,
      commission_percent: validated.commission_percent,
      category_id: validated.category_id || null,
      price_type: validated.price_type,
      return_days: validated.return_days || null,
      is_bookable: validated.is_bookable ?? true,
      show_price: validated.show_price ?? true,
      simultaneous_slots: validated.simultaneous_slots,
      notes: validated.notes || null,
      image_url: validated.image_url || null,
      is_active: validated.is_active ?? true,
    }

    let savedService: any
    let isUpdate = !!validated.id

    if (isUpdate && validated.id) {
      // Get old data for audit
      const { data: oldData } = await supabase.from("services").select("*").eq("id", validated.id).single()
      
      const { data: result, error } = await (supabase as any)
        .from("services")
        .update(payload)
        .eq("id", validated.id)
        .select()
        .single()
        
      if (error) throw error
      savedService = result

      await logAudit({
        action: 'UPDATE',
        entity: 'services',
        entity_id: result.id,
        newData: result,
        oldData: oldData,
        observation: `Serviço atualizado: ${result.name}`
      })
    } else {
      const { data: result, error } = await (supabase as any)
        .from("services")
        .insert({ ...payload, created_by: userProfileId })
        .select()
        .single()
        
      if (error) throw error
      savedService = result
      
      await logAudit({
        action: 'INSERT',
        entity: 'services',
        entity_id: result.id,
        newData: result,
        observation: `Serviço cadastrado: ${result.name}`
      })
    }

    revalidatePath("/servicos")
    return { success: true, data: savedService }
  } catch (err: any) {
    console.error("Error saving service:", err)
    return { success: false, error: err.message || "Erro ao salvar serviço." }
  }
}

export async function fetchServiceCategories() {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from("service_categories")
    .select("*")
    .eq("is_active", true)
    .order("name")
    
  if (error) throw new Error(error.message)
  return data
}
