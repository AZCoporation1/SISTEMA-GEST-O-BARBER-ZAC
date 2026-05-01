"use client"

import { useState, useEffect } from "react"
import { X, Plus, Trash2, ShoppingCart, CreditCard, Scissors, Package } from "lucide-react"
import { completeAppointmentViaSale, addCommandItem, removeCommandItem } from "../actions/agenda.actions"
import { fetchCommandItems, fetchProductsForComanda, fetchBookableServices, fetchPaymentMethods } from "../services/agenda.service"
import type { AppointmentWithRelations, AppointmentCommandItemRow } from "../types"

interface Props {
  appointment: AppointmentWithRelations | null
  open: boolean
  onClose: () => void
  onCompleted: () => void
}

export default function CommandSheet({ appointment, open, onClose, onCompleted }: Props) {
  const [items, setItems] = useState<AppointmentCommandItemRow[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [paymentMethods, setPaymentMethods] = useState<Array<{ id: string; name: string }>>([])
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("")
  const [discount, setDiscount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [addMode, setAddMode] = useState<"none" | "product" | "service">("none")

  useEffect(() => {
    if (!open || !appointment) return
    loadData()
  }, [open, appointment])

  const loadData = async () => {
    if (!appointment) return
    const [cmds, prods, svcs, pmethods] = await Promise.all([
      fetchCommandItems(appointment.id),
      fetchProductsForComanda(), // PERF excluded
      fetchBookableServices(),
      fetchPaymentMethods(),
    ])
    setItems(cmds)
    setProducts(prods)
    setServices(svcs)
    setPaymentMethods(pmethods)
    setError("")
  }

  const handleAddProduct = async (product: any) => {
    if (!appointment) return
    const result = await addCommandItem(appointment.id, {
      item_type: "product",
      product_id: product.id,
      description: product.name,
      quantity: 1,
      unit_price: product.sale_price_generated || 0,
      professional_id: appointment.professional_id,
    })
    if (result.success) {
      await loadData()
      setAddMode("none")
    }
  }

  const handleAddService = async (service: any) => {
    if (!appointment) return
    const result = await addCommandItem(appointment.id, {
      item_type: "service",
      service_id: service.id,
      description: service.name,
      quantity: 1,
      unit_price: service.price,
      professional_id: appointment.professional_id,
    })
    if (result.success) {
      await loadData()
      setAddMode("none")
    }
  }

  const handleRemoveItem = async (id: string) => {
    await removeCommandItem(id)
    await loadData()
  }

  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price_snapshot), 0)
  const total = subtotal - discount

  const handleFinalize = async () => {
    if (!appointment) return
    if (!selectedPaymentMethod) { setError("Selecione a forma de pagamento"); return }
    if (items.length === 0) { setError("Adicione ao menos um item na comanda"); return }

    setLoading(true)
    setError("")

    // Build items for processSale
    const saleItems = items.map(item => ({
      type: item.item_type === "product" ? "product" as const : "service" as const,
      productId: item.product_id || null,
      serviceId: item.service_id || null,
      name: item.description_snapshot,
      quantity: item.quantity,
      unitPrice: item.unit_price_snapshot,
      unitCost: 0, // cost snapshot — services have 0 cost
      discount: 0,
    }))

    const result = await completeAppointmentViaSale(appointment.id, {
      payment_method_id: selectedPaymentMethod,
      discount_amount: discount,
      items: saleItems,
    })

    setLoading(false)

    if (result.success) {
      onCompleted()
      onClose()
    } else {
      setError(result.error || "Erro ao finalizar comanda")
    }
  }

  if (!open || !appointment) return null

  return (
    <div style={{
      position: "fixed",
      top: 0,
      right: 0,
      bottom: 0,
      width: "100%",
      maxWidth: 480,
      zIndex: 100,
      background: "var(--bg-surface)",
      borderLeft: "1px solid var(--border)",
      boxShadow: "-8px 0 32px rgba(0,0,0,0.4)",
      display: "flex",
      flexDirection: "column",
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
          <ShoppingCart size={16} style={{ color: "var(--accent)" }} />
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
            Comanda
          </h3>
        </div>
        <button onClick={onClose} style={{
          background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer",
        }}>
          <X size={18} />
        </button>
      </div>

      {/* Customer info */}
      <div style={{
        padding: "12px 20px",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        justifyContent: "space-between",
        fontSize: 12,
      }}>
        <span style={{ color: "var(--text-secondary)" }}>
          {appointment.customer_name_snapshot || "Cliente avulso"}
        </span>
        <span style={{ color: "var(--text-muted)", fontSize: 10 }}>
          {(appointment.professional as any)?.display_name || (appointment.professional as any)?.name}
        </span>
      </div>

      {/* Items list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px" }}>
        {error && (
          <div className="alert-banner danger" style={{ margin: "0 0 12px" }}>{error}</div>
        )}

        {items.length === 0 ? (
          <div style={{
            padding: 32,
            textAlign: "center",
            color: "var(--text-muted)",
            fontSize: 12,
          }}>
            Nenhum item na comanda. Adicione serviços ou produtos.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {items.map(item => (
              <div key={item.id} style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                background: "rgba(255,255,255,0.02)",
                border: "1px solid var(--border)",
                borderRadius: 8,
              }}>
                {item.item_type === "service" ? (
                  <Scissors size={12} style={{ color: "var(--accent)", flexShrink: 0 }} />
                ) : (
                  <Package size={12} style={{ color: "var(--info)", flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}>
                    {item.description_snapshot}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                    {item.quantity}x R$ {item.unit_price_snapshot.toFixed(2)}
                  </div>
                </div>
                <span style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  fontVariantNumeric: "tabular-nums",
                  flexShrink: 0,
                }}>
                  R$ {(item.quantity * item.unit_price_snapshot).toFixed(2)}
                </span>
                <button
                  onClick={() => handleRemoveItem(item.id)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--danger)",
                    cursor: "pointer",
                    padding: 4,
                    flexShrink: 0,
                  }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add buttons */}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button
            onClick={() => setAddMode(addMode === "service" ? "none" : "service")}
            style={{
              flex: 1,
              padding: "8px 12px",
              background: addMode === "service" ? "var(--accent-subtle)" : "none",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--text-primary)",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              fontFamily: "inherit",
            }}
          >
            <Plus size={12} /> Serviço
          </button>
          <button
            onClick={() => setAddMode(addMode === "product" ? "none" : "product")}
            style={{
              flex: 1,
              padding: "8px 12px",
              background: addMode === "product" ? "var(--accent-subtle)" : "none",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--text-primary)",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              fontFamily: "inherit",
            }}
          >
            <Plus size={12} /> Produto
          </button>
        </div>

        {/* Service picker */}
        {addMode === "service" && (
          <div style={{
            marginTop: 8,
            maxHeight: 200,
            overflowY: "auto",
            border: "1px solid var(--border)",
            borderRadius: 8,
          }}>
            {services.map(svc => (
              <button
                key={svc.id}
                onClick={() => handleAddService(svc)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "none",
                  border: "none",
                  borderBottom: "1px solid var(--border)",
                  color: "var(--text-primary)",
                  fontSize: 11,
                  cursor: "pointer",
                  textAlign: "left",
                  display: "flex",
                  justifyContent: "space-between",
                  fontFamily: "inherit",
                }}
              >
                <span>{svc.name}</span>
                <span style={{ color: "var(--accent)", fontWeight: 600 }}>R$ {svc.price.toFixed(2)}</span>
              </button>
            ))}
          </div>
        )}

        {/* Product picker */}
        {addMode === "product" && (
          <div style={{
            marginTop: 8,
            maxHeight: 200,
            overflowY: "auto",
            border: "1px solid var(--border)",
            borderRadius: 8,
          }}>
            {products.length === 0 ? (
              <div style={{ padding: 12, fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
                Nenhum produto disponível (PERF excluídos)
              </div>
            ) : products.map(prod => (
              <button
                key={prod.id}
                onClick={() => handleAddProduct(prod)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "none",
                  border: "none",
                  borderBottom: "1px solid var(--border)",
                  color: "var(--text-primary)",
                  fontSize: 11,
                  cursor: "pointer",
                  textAlign: "left",
                  display: "flex",
                  justifyContent: "space-between",
                  fontFamily: "inherit",
                }}
              >
                <span>{prod.name} <span style={{ color: "var(--text-muted)", fontSize: 9 }}>({prod.external_code})</span></span>
                <span style={{ color: "var(--accent)", fontWeight: 600 }}>
                  R$ {(prod.sale_price_generated || 0).toFixed(2)}
                  <span style={{ color: "var(--text-muted)", fontSize: 9, marginLeft: 4 }}>
                    est: {prod.current_qty}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer — Totals + Payment + Finalize */}
      <div style={{
        borderTop: "1px solid var(--border)",
        padding: "16px 20px",
      }}>
        {/* Totals */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-secondary)" }}>
            <span>Subtotal</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>R$ {subtotal.toFixed(2)}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Desconto</span>
            <input
              type="number"
              value={discount}
              onChange={e => setDiscount(Math.max(0, Number(e.target.value)))}
              min={0}
              step={1}
              style={{
                marginLeft: "auto",
                width: 90,
                padding: "4px 8px",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                color: "var(--text-primary)",
                fontSize: 12,
                fontFamily: "inherit",
                textAlign: "right",
                outline: "none",
              }}
            />
          </div>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 16,
            fontWeight: 800,
            color: "var(--text-primary)",
            paddingTop: 8,
            borderTop: "1px solid var(--border)",
          }}>
            <span>Total</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>R$ {total.toFixed(2)}</span>
          </div>
        </div>

        {/* Payment Method */}
        <select
          value={selectedPaymentMethod}
          onChange={e => setSelectedPaymentMethod(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 12px",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            color: "var(--text-primary)",
            fontSize: 12,
            fontFamily: "inherit",
            outline: "none",
            marginBottom: 12,
          }}
        >
          <option value="">Forma de pagamento...</option>
          {paymentMethods.map(pm => (
            <option key={pm.id} value={pm.id}>{pm.name}</option>
          ))}
        </select>

        {/* Finalize */}
        <button
          onClick={handleFinalize}
          disabled={loading || items.length === 0}
          className="btn-primary"
          style={{
            width: "100%",
            padding: "12px 20px",
            borderRadius: 10,
            fontSize: 13,
            cursor: loading ? "wait" : "pointer",
            opacity: loading || items.length === 0 ? 0.5 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            fontFamily: "inherit",
          }}
        >
          <CreditCard size={14} />
          {loading ? "Finalizando..." : "Finalizar Comanda"}
        </button>
      </div>
    </div>
  )
}
