'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ProfessionalRequestWithDetails } from '../types'

export function useMyRequests(userId: string | null) {
  const [requests, setRequests] = useState<ProfessionalRequestWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRequests = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { data, error: err } = await supabase
      .from('professional_requests')
      .select('*')
      .eq('submitted_by', userId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (err) {
      setError(err.message)
    } else {
      setRequests((data || []) as any)
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  return { requests, loading, error, refetch: fetchRequests }
}
