import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { AuditLogRow } from '@/types/supabase'

export function useAuditLogs() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select(`*, actor:actor_id(full_name)`)
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      return data as AuditLogRow[]
    }
  })
}
