'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ProfessionalRequestWithDetails } from '../types'
import type { ProfessionalRequestStatusEnum } from '@/types/supabase'

interface UseApprovalQueueOptions {
  status?: ProfessionalRequestStatusEnum
  professionalId?: string
}

export function useApprovalQueue(options: UseApprovalQueueOptions = {}) {
  const [requests, setRequests] = useState<ProfessionalRequestWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingCount, setPendingCount] = useState(0)

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    setError(null)

    const supabase = createClient()
    let query = supabase
      .from('professional_requests')
      .select('*')
      .order('created_at', { ascending: false })

    if (options.status) {
      query = query.eq('status', options.status)
    }

    if (options.professionalId) {
      query = query.eq('professional_id', options.professionalId)
    }

    const { data, error: err } = await query.limit(200)

    if (err) {
      setError(err.message)
    } else {
      setRequests((data || []) as any)
    }

    // Count pending (always fetch for badge)
    const { count } = await supabase
      .from('professional_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')

    setPendingCount(count || 0)
    setLoading(false)
  }, [options.status, options.professionalId])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  // Group by professional
  const groupedByProfessional = requests.reduce<Record<string, ProfessionalRequestWithDetails[]>>((acc, req) => {
    const key = req.professional_id
    if (!acc[key]) acc[key] = []
    acc[key].push(req)
    return acc
  }, {})

  return { requests, loading, error, refetch: fetchRequests, pendingCount, groupedByProfessional }
}
