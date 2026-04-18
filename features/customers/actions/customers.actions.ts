"use server"

import { createServerClient } from "@/lib/supabase/server"
import { customerSchema, CustomerFormValues } from "../validators"
import { CustomersFetchParams, CustomersListResponse, CustomerNode } from "../types"
import { logAudit } from "@/features/audit/actions/audit.actions"
import { resolveUserProfileId } from "@/lib/supabase/resolve-user"
import { revalidatePath } from "next/cache"

export async function fetchCustomers(params: CustomersFetchParams): Promise<CustomersListResponse> {
  const supabase = await createServerClient()
  const page = params.page || 1
  const perPage = params.perPage || 50
  
  let query = supabase.from("customers").select("*", { count: "exact" })
  
  if (params.search) {
    const s = params.search.trim()
    // A more advanced search can use `or` with multiple fields
    // Assuming search could be by name, email, phone or cpf
    query = query.or(`normalized_name.ilike.%${s.toLowerCase()}%,email.ilike.%${s}%,mobile_phone.ilike.%${s}%,cpf.ilike.%${s}%`)
  }

  if (params.status && params.status !== "all") {
    query = query.eq("is_active", params.status === "active")
  }

  // Alphabetical order by default
  query = query.order("full_name", { ascending: true })
  
  // Pagination
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

export async function saveCustomer(data: CustomerFormValues) {
  try {
    const validated = customerSchema.parse(data)
    const supabase = await createServerClient()
    const { data: authData } = await supabase.auth.getUser()
    const userProfileId = await resolveUserProfileId(supabase, authData.user?.id)

    // Ensure normalized name
    const normalizedName = validated.full_name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")

    const payload = {
      full_name: validated.full_name,
      normalized_name: normalizedName,
      email: validated.email || null,
      phone: validated.phone || null,
      mobile_phone: validated.mobile_phone || null,
      ddi: validated.ddi || null,
      cpf: validated.cpf || null,
      rg: validated.rg || null,
      birth_date: validated.birth_date || null,
      gender: validated.gender || null,
      address_line: validated.address_line || null,
      neighborhood: validated.neighborhood || null,
      city: validated.city || null,
      state: validated.state || null,
      postal_code: validated.postal_code || null,
      address_number: validated.address_number || null,
      complement: validated.complement || null,
      notes: validated.notes || null,
      referral_source: validated.referral_source || null,
      is_active: validated.is_active ?? true,
    }

    let savedCustomer: any
    let isUpdate = !!validated.id

    if (isUpdate && validated.id) {
      // Get old data for audit
      const { data: oldData } = await supabase.from("customers").select("*").eq("id", validated.id).single()
      
      const { data: result, error } = await (supabase as any)
        .from("customers")
        .update(payload)
        .eq("id", validated.id)
        .select()
        .single()
        
      if (error) throw error
      savedCustomer = result

      await logAudit({
        action: 'UPDATE',
        entity: 'customers',
        entity_id: result.id,
        newData: result,
        oldData: oldData,
        observation: `Cliente atualizado: ${result.full_name}`
      })
    } else {
      const { data: result, error } = await (supabase as any)
        .from("customers")
        .insert(payload)
        .select()
        .single()
        
      if (error) throw error
      savedCustomer = result
      
      await logAudit({
        action: 'INSERT',
        entity: 'customers',
        entity_id: result.id,
        newData: result,
        observation: `Cliente cadastrado: ${result.full_name}`
      })
    }

    revalidatePath("/clientes")
    return { success: true, data: savedCustomer }
  } catch (err: any) {
    console.error("Error saving customer:", err)
    return { success: false, error: err.message || "Erro ao salvar cliente." }
  }
}
