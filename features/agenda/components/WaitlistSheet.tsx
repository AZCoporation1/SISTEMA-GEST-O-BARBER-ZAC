// @ts-nocheck
"use client"

import { useState, useEffect, useCallback } from "react"
import { X, Plus, Clock, User, Phone, FileText, Calendar, Filter, Check, XCircle, CalendarPlus } from "lucide-react"
import { addWaitlistItem, cancelWaitlistItem, updateWaitlistStatus } from "../actions/agenda.actions"
import { fetchWaitlist, searchCustomers } from "../services/agenda.service"
import type { AppointmentWaitlistRow, ProfessionalForAgenda, WaitlistPeriod } from "../types"
import { WAITLIST_STATUS_LABELS } from "../types"

interface Props {
  open: boolean
  onClose: () => void
  onConvertToAppointment: (item: AppointmentWaitlistRow) => void
  professionals: ProfessionalForAgenda[]
  services: Array<{ id: string; name: string; price: number }>
}

const PERIOD_LABELS: Record<WaitlistPeriod, string> = {
  morning: "Manhã",
  afternoon: "Tarde",
  evening: "Noite",
  any: "Qualquer",
}

const PERIOD_OPTIONS: WaitlistPeriod[] = ["morning", "afternoon", "evening", "any"]

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  waiting: { bg: "rgba(245,158,11,0.12)", text: "#fbbf24" },
  contacted: { bg: "rgba(59,130,246,0.12)", text: "#60a5fa" },
  scheduled: { bg: "rgba(16,185,129,0.12)", text: "#34d399" },
  cancelled: { bg: "rgba(107,114,128,0.08)", text: "#6b7280" },
}

export default function WaitlistSheet({
  open, onClose, onConvertToAppointment, professionals, services,
}: Props) {
  const [items, setItems] = useState<AppointmentWaitlistRow[]>([])
  const [loading, setLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [error, setError] = useState("")

  // Add form
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [desiredProfessionalId, setDesiredProfessionalId] = useState("")
  const [desiredServiceId, setDesiredServiceId] = useState("")
  const [desiredDate, setDesiredDate] = useState("")
  const [preferredPeriod, setPreferredPeriod] = useState<WaitlistPeriod>("any")
  const [notes, setNotes] = useState("")

  // Customer search
  const [customerSearch, setCustomerSearch] = useState("")
  const [customerResults, setCustomerResults] = useState<any[]>([])
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const data = await fetchWaitlist(filterStatus === "all" ? undefined : filterStatus)
    setItems(data)
    setLoading(false)
  }, [filterStatus])

  useEffect(() => {
    if (open) loadData()
  }, [open, loadData])

  // Customer search
  useEffect(() => {
    if (customerSearch.length < 2) { setCustomerResults([]); return }
    const t = setTimeout(async () => {
      const results = await searchCustomers(customerSearch)
      setCustomerResults(results)
      setShowCustomerDropdown(true)
    }, 300)
    return () => clearTimeout(t)
  }, [customerSearch])

  const selectCustomer = (c: any) => {
    setCustomerId(c.id)
    setCustomerName(c.full_name)
    setCustomerPhone(c.phone || c.mobile_phone || "")
    setShowCustomerDropdown(false)
    setCustomerSearch("")
  }

  const handleAdd = async () => {
    if (!customerName.trim()) { setError("Nome é obrigatório"); return }

    setLoading(true)
    setError("")

    const result = await addWaitlistItem({
      customer_id: customerId,
      customer_name: customerName,
      customer_phone: customerPhone || null,
      desired_professional_id: desiredProfessionalId || null,
      desired_service_id: desiredServiceId || null,
      desired_date: desiredDate || null,
      preferred_period: preferredPeriod,
      notes: notes || null,
    })

    if (result.success) {
      resetForm()
      setShowAddForm(false)
      await loadData()
    } else {
      setError(result.error || "Erro ao adicionar")
    }
    setLoading(false)
  }

  const handleCancel = async (id: string) => {
    await cancelWaitlistItem(id)
    await loadData()
  }

  const handleMarkContacted = async (id: string) => {
    await updateWaitlistStatus(id, "contacted")
    await loadData()
  }

  const handleConvert = (item: AppointmentWaitlistRow) => {
    onConvertToAppointment(item)
    onClose()
  }

  const resetForm = () => {
    setCustomerName("")
    setCustomerPhone("")
    setCustomerId(null)
    setDesiredProfessionalId("")
    setDesiredServiceId("")
    setDesiredDate("")
    setPreferredPeriod("any")
    setNotes("")
    setCustomerSearch("")
    setError("")
  }

  const filteredItems = filterStatus === "all"
    ? items
    : items.filter(i => i.status === filterStatus)

  if (!open) return null

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "9px 12px",
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--text-primary)",
    fontSize: 12,
    fontFamily: "inherit",
    outline: "none",
  }

  return (
    <div style={{
      position: "fixed",
      top: 0,
      right: 0,
      bottom: 0,
      width: "100%",
      maxWidth: 440,
      zIndex: 100,
      background: "var(--bg-surface)",
      borderLeft: "1px solid var(--border)",
      boxShadow: "-8px 0 32px rgba(0,0,0,0.4)",
      display: "flex",
      flexDirection: "column",
      animation: "slideInRight 200ms ease",
    }}>
      {/* Header */}
      <div style={{
        padding: "16px 20px",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Clock size={16} style={{ color: "var(--warning)" }} />
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
            Lista de Espera
          </h3>
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: 100,
            background: "var(--warning-bg)",
            color: "var(--warning)",
            border: "1px solid rgba(245,158,11,0.2)",
          }}>
            {items.filter(i => i.status === "waiting").length}
          </span>
        </div>
        <button onClick={onClose} style={{
          background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer",
        }}>
          <X size={18} />
        </button>
      </div>

      {/* Toolbar */}
      <div style={{
        padding: "10px 20px",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}>
        <button
          onClick={() => { setShowAddForm(!showAddForm); resetForm() }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "6px 12px",
            background: showAddForm ? "var(--accent-subtle)" : "none",
            border: "1px solid var(--border)",
            borderRadius: 6,
            color: "var(--text-primary)",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          <Plus size={12} /> Adicionar
        </button>

        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          style={{
            marginLeft: "auto",
            padding: "6px 10px",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            color: "var(--text-primary)",
            fontSize: 11,
            fontFamily: "inherit",
            outline: "none",
          }}
        >
          <option value="all">Todos</option>
          <option value="waiting">Aguardando</option>
          <option value="contacted">Contatado</option>
          <option value="scheduled">Agendado</option>
          <option value="cancelled">Cancelado</option>
        </select>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px" }}>
        {error && <div className="alert-banner danger" style={{ margin: "0 0 12px", fontSize: 12 }}>{error}</div>}

        {/* Add Form */}
        {showAddForm && (
          <div style={{
            padding: 14,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            marginBottom: 12,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Novo Item na Lista
            </div>

            {/* Customer */}
            <div style={{ position: "relative" }}>
              <input
                value={customerId ? customerName : customerSearch || customerName}
                onChange={e => {
                  if (customerId) { setCustomerId(null) }
                  setCustomerSearch(e.target.value)
                  setCustomerName(e.target.value)
                }}
                placeholder="Nome do cliente..."
                style={inputStyle}
              />
              {showCustomerDropdown && customerResults.length > 0 && (
                <div style={{
                  position: "absolute", top: "100%", left: 0, right: 0,
                  background: "var(--bg-surface)", border: "1px solid var(--border)",
                  borderRadius: 6, marginTop: 2, zIndex: 20, maxHeight: 140, overflowY: "auto",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
                }}>
                  {customerResults.map(c => (
                    <button key={c.id} onClick={() => selectCustomer(c)} style={{
                      width: "100%", padding: "6px 10px", background: "none", border: "none",
                      borderBottom: "1px solid var(--border)", color: "var(--text-primary)",
                      fontSize: 11, cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                    }}>
                      <span style={{ fontWeight: 600 }}>{c.full_name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="Telefone..." style={inputStyle} />

            <select value={desiredServiceId} onChange={e => setDesiredServiceId(e.target.value)} style={inputStyle}>
              <option value="">Serviço desejado...</option>
              {services.map(s => <option key={s.id} value={s.id}>{s.name} — R$ {s.price.toFixed(2)}</option>)}
            </select>

            <select value={desiredProfessionalId} onChange={e => setDesiredProfessionalId(e.target.value)} style={inputStyle}>
              <option value="">Profissional (opcional)...</option>
              {professionals.map(p => <option key={p.id} value={p.id}>{p.display_name || p.name}</option>)}
            </select>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input type="date" value={desiredDate} onChange={e => setDesiredDate(e.target.value)} style={inputStyle} />
              <select value={preferredPeriod} onChange={e => setPreferredPeriod(e.target.value as WaitlistPeriod)} style={inputStyle}>
                {PERIOD_OPTIONS.map(p => <option key={p} value={p}>{PERIOD_LABELS[p]}</option>)}
              </select>
            </div>

            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observações..." style={inputStyle} />

            <button onClick={handleAdd} disabled={loading} className="btn-primary" style={{
              padding: "9px 16px", borderRadius: 8, fontSize: 12, cursor: loading ? "wait" : "pointer",
              opacity: loading ? 0.6 : 1, fontFamily: "inherit",
            }}>
              {loading ? "Adicionando..." : "Adicionar à Lista"}
            </button>
          </div>
        )}

        {/* Items List */}
        {filteredItems.length === 0 ? (
          <div style={{
            padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 12,
          }}>
            <Clock size={28} style={{ opacity: 0.3, marginBottom: 8, margin: "0 auto 8px" }} />
            <div>Nenhum item na lista de espera</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filteredItems.map(item => {
              const colors = STATUS_COLORS[item.status] || STATUS_COLORS.waiting
              return (
                <div key={item.id} style={{
                  padding: "12px 14px",
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  transition: "border-color 150ms ease",
                }}>
                  {/* Top row */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                      {item.customer_name_snapshot || "—"}
                    </div>
                    <span style={{
                      padding: "2px 8px", borderRadius: 4, fontSize: 9, fontWeight: 700,
                      background: colors.bg, color: colors.text, textTransform: "uppercase", letterSpacing: "0.06em",
                    }}>
                      {WAITLIST_STATUS_LABELS[item.status]}
                    </span>
                  </div>

                  {/* Info */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", fontSize: 10, color: "var(--text-muted)", marginBottom: 8 }}>
                    {item.customer_phone_snapshot && (
                      <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                        <Phone size={9} /> {item.customer_phone_snapshot}
                      </span>
                    )}
                    {item.desired_date && (
                      <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                        <Calendar size={9} /> {item.desired_date}
                      </span>
                    )}
                    {item.preferred_period && (
                      <span>{PERIOD_LABELS[item.preferred_period as WaitlistPeriod]}</span>
                    )}
                    {item.notes && (
                      <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                        <FileText size={9} /> {item.notes}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  {item.status === "waiting" && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => handleConvert(item)} style={{
                        flex: 1, padding: "6px 10px", background: "var(--success-bg)",
                        border: "1px solid rgba(16,185,129,0.2)", borderRadius: 6,
                        color: "var(--success)", fontSize: 10, fontWeight: 600, cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                        fontFamily: "inherit",
                      }}>
                        <CalendarPlus size={11} /> Agendar
                      </button>
                      <button onClick={() => handleMarkContacted(item.id)} style={{
                        flex: 1, padding: "6px 10px", background: "var(--info-bg)",
                        border: "1px solid rgba(59,130,246,0.2)", borderRadius: 6,
                        color: "var(--info)", fontSize: 10, fontWeight: 600, cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                        fontFamily: "inherit",
                      }}>
                        <Check size={11} /> Contatado
                      </button>
                      <button onClick={() => handleCancel(item.id)} style={{
                        padding: "6px 10px", background: "none",
                        border: "1px solid var(--border)", borderRadius: 6,
                        color: "var(--text-muted)", fontSize: 10, fontWeight: 600, cursor: "pointer",
                        fontFamily: "inherit",
                      }}>
                        <XCircle size={11} />
                      </button>
                    </div>
                  )}

                  {item.status === "contacted" && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => handleConvert(item)} style={{
                        flex: 1, padding: "6px 10px", background: "var(--success-bg)",
                        border: "1px solid rgba(16,185,129,0.2)", borderRadius: 6,
                        color: "var(--success)", fontSize: 10, fontWeight: 600, cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                        fontFamily: "inherit",
                      }}>
                        <CalendarPlus size={11} /> Agendar
                      </button>
                      <button onClick={() => handleCancel(item.id)} style={{
                        padding: "6px 10px", background: "none",
                        border: "1px solid var(--border)", borderRadius: 6,
                        color: "var(--text-muted)", fontSize: 10, fontWeight: 600, cursor: "pointer",
                        fontFamily: "inherit",
                      }}>
                        <XCircle size={11} />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
