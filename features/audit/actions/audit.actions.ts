"use server"

import { createServerClient } from "@/lib/supabase/server"
import { Json } from "@/types/supabase"
import { resolveUserProfileId } from "@/lib/supabase/resolve-user"

export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE' | 'IMPORT' | 'EXPORT' | 'REPORT' | 'AI_COMMAND'
export type AuditSource = 'web' | 'ai_operator' | 'import_job' | 'system'
export type AuditStatus = 'success' | 'error' | 'pending'

interface LogAuditParams {
  action: string
  entity: string
  entity_id: string 
  oldData?: any
  newData?: any
  source?: AuditSource
  status?: AuditStatus
  observation?: string | null
}

export async function logAudit({
  action,
  entity,
  entity_id,
  oldData = null,
  newData = null,
  source = 'web',
  status = 'success',
  observation = null
}: LogAuditParams) {
  const supabase = await createServerClient()

  // Capture user info safely
  const { data: { user } } = await supabase.auth.getUser()
  const actorId = await resolveUserProfileId(supabase, user?.id)

  const { error } = await supabase
    .from('audit_logs')
    .insert({
      actor_id: actorId,
      action: action,
      entity_type: entity,
      entity_id: entity_id,
      before_data: oldData as Json,
      after_data: newData as Json,
      context: { source, status, observation } as Json
    } as any)

  if (error) {
    console.error('[AUDIT_ERROR] Failed to insert audit log:', error)
  }
}
