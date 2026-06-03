"use client"

import { useState, useEffect } from "react"
import { X, Plus, Trash2, ShoppingCart, CreditCard, Scissors, Package, AlertTriangle, Search, Info } from "lucide-react"
import { completeAppointmentViaSale, addCommandItem, removeCommandItem, updateCommandItemQuantity } from "../actions/agenda.actions"
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
  
  // Custom states for price override
  const [servicePriceOverride, setServicePriceOverride] = useState<number>(0)
  const [adjustmentReason, setAdjustmentReason] = useState("")

  // Search & Category filters for products
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")

  useEffect(() => {
    if (!open || !appointment) return
    loadData()
    setServicePriceOverride(appointment.service_price_snapshot || 0)
    setAdjustmentReason("")
    setDiscount(0)
    setSelectedPaymentMethod("")
    setSearchQuery("")
    setSelectedCategory("all")
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
    setError("")
    
    // Front-end stock validation
    const existingInComanda = items.find(item => item.product_id === product.id)
    const currentQtyInComanda = existingInComanda ? existingInComanda.quantity : 0
    if (product.current_qty <= currentQtyInComanda) {
      setError(`Estoque insuficiente. Apenas ${product.current_qty} unidades disponíveis.`)
      return
    }

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
      setSearchQuery("")
    } else {
      setError(result.error || "Erro ao adicionar produto")
    }
  }

  const handleAddService = async (service: any) => {
    if (!appointment) return
    setError("")
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
    } else {
      setError(result.error || "Erro ao adicionar serviço")
    }
  }

  const handleUpdateQty = async (itemId: string, currentQty: number, change: number) => {
    setError("")
    const newQty = currentQty + change
    
    const item = items.find(i => i.id === itemId)
    if (item?.item_type === "product" && item.product_id && change > 0) {
      const dbProd = products.find(p => p.id === item.product_id)
      if (dbProd && dbProd.current_qty < newQty) {
        setError(`Estoque insuficiente. Apenas ${dbProd.current_qty} unidades disponíveis.`)
        return
      }
    }

    const result = await updateCommandItemQuantity(itemId, newQty)
    if (result.success) {
      await loadData()
    } else {
      setError(result.error || "Erro ao atualizar quantidade")
    }
  }

  const handleRemoveItem = async (id: string) => {
    setError("")
    const result = await removeCommandItem(id)
    if (result.success) {
      await loadData()
    } else {
      setError(result.error || "Erro ao remover item")
    }
  }

  // Calculations
  const originalPrice = appointment?.service_price_snapshot || 0
  const isPriceAdjusted = servicePriceOverride !== originalPrice

  let diffPercent = 0
  if (originalPrice > 0) {
    diffPercent = (Math.abs(servicePriceOverride - originalPrice) / originalPrice) * 100
  } else if (servicePriceOverride > 0) {
    diffPercent = 100
  }

  const isDiffOver20 = diffPercent > 20

  // Filter out main service item from general list since it has a dedicated editor
  const mainServiceItem = items.find(item => item.item_type === "service" && item.service_id === appointment?.service_id)
  const additionalItems = items.filter(item => item.id !== mainServiceItem?.id)

  const hasMainServiceInItems = !!mainServiceItem
  
  let subtotal = items.reduce((sum, item) => {
    const isMain = item.item_type === "service" && item.service_id === appointment?.service_id
    const price = isMain ? servicePriceOverride : item.unit_price_snapshot
    return sum + (item.quantity * price)
  }, 0)

  // Fallback if main service is not in DB items list for some reason
  if (!hasMainServiceInItems && appointment?.service_id) {
    subtotal += servicePriceOverride
  }

  const total = Math.max(0, subtotal - discount)

  // Unique categories list for filtering
  const categoriesMap = new Map()
  products.forEach(p => {
    if (p.category) {
      categoriesMap.set(p.category.id, p.category.name)
    }
  })
  const categoriesList = Array.from(categoriesMap.entries()).map(([id, name]) => ({ id, name }))

  // Filter products
  const filteredProducts = products.filter(prod => {
    const matchesSearch = prod.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (prod.external_code && prod.external_code.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesCategory = selectedCategory === "all" || prod.category_id === selectedCategory
    return matchesSearch && matchesCategory
  })

  // Submit Validations
  const isReasonRequired = isDiffOver20
  const isReasonValid = !isReasonRequired || (adjustmentReason.trim().length > 0)
  const isPriceValid = servicePriceOverride >= 0
  const isTotalValid = total > 0
  const isPaymentValid = selectedPaymentMethod !== ""
  const isValidToSubmit = isPriceValid && isReasonValid && isTotalValid && isPaymentValid

  const handleFinalize = async () => {
    if (!appointment) return
    if (!isPaymentValid) { setError("Selecione a forma de pagamento"); return }
    if (!isPriceValid) { setError("O valor do serviço não pode ser negativo"); return }
    if (isReasonRequired && !isReasonValid) { setError("O motivo do ajuste é obrigatório"); return }
    if (!isTotalValid) { setError("O valor total da venda deve ser maior que zero"); return }

    setLoading(true)
    setError("")

    // Map items for completeAppointmentViaSale
    const saleItems = items.map(item => {
      const isMain = item.item_type === "service" && item.service_id === appointment.service_id
      return {
        type: item.item_type === "product" ? "product" as const : "service" as const,
        productId: item.product_id || null,
        serviceId: item.service_id || null,
        name: item.description_snapshot,
        quantity: item.quantity,
        unitPrice: isMain ? servicePriceOverride : item.unit_price_snapshot,
        unitCost: 0, 
        discount: 0,
      }
    })

    // If main service wasn't in command items DB, force it
    const hasMainService = items.some(item => item.item_type === "service" && item.service_id === appointment.service_id)
    if (!hasMainService && appointment.service_id) {
      saleItems.unshift({
        type: "service" as const,
        productId: null,
        serviceId: appointment.service_id,
        name: appointment.service_name_snapshot || "Serviço Principal",
        quantity: 1,
        unitPrice: servicePriceOverride,
        unitCost: 0,
        discount: 0,
      })
    }

    const result = await completeAppointmentViaSale(appointment.id, {
      payment_method_id: selectedPaymentMethod,
      discount_amount: discount,
      items: saleItems,
      service_price_override: servicePriceOverride,
      service_price_adjustment_reason: adjustmentReason,
    })

    setLoading(false)

    if (result.success) {
      onCompleted()
      onClose()
    } else {
      setError(result.error || "Erro ao finalizar comanda")
    }
  }

  const formattedTime = appointment
    ? new Date(appointment.start_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : ""

  if (!open || !appointment) return null

  return (
    <div style={{
      position: "fixed",
      top: 0,
      right: 0,
      bottom: 0,
      width: "100%",
      maxWidth: "min(95vw, 850px)",
      zIndex: 100,
      background: "var(--bg-surface)",
      borderLeft: "1px solid var(--border)",
      boxShadow: "-8px 0 32px rgba(0,0,0,0.4)",
      display: "flex",
      flexDirection: "column",
    }}>
      <style dangerouslySetInnerHTML={{__html: `
        .command-layout {
          display: flex;
          flex-direction: column;
          flex: 1;
          overflow: hidden;
        }
        .command-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          padding: 20px;
          gap: 20px;
        }
        @media (min-width: 768px) {
          .command-body {
            display: grid;
            grid-template-columns: 1.1fr 1fr;
            gap: 24px;
            overflow-y: hidden;
          }
          .command-left-panel {
            overflow-y: auto;
            padding-right: 8px;
            display: flex;
            flex-direction: column;
            gap: 20px;
          }
          .command-right-panel {
            overflow-y: auto;
            padding-left: 8px;
            border-left: 1px solid var(--border);
            display: flex;
            flex-direction: column;
            gap: 20px;
            justify-content: space-between;
          }
        }
        .custom-badge {
          display: inline-flex;
          align-items: center;
          padding: 2px 8px;
          border-radius: 9999px;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
        }
        .custom-badge.warning {
          background-color: rgba(234, 179, 8, 0.15);
          color: rgb(234, 179, 8);
        }
        .custom-badge.success {
          background-color: rgba(34, 197, 94, 0.15);
          color: rgb(34, 197, 94);
        }
        .info-card {
          background: rgba(255,255,255,0.015);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 14px;
        }
        .item-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px;
          background: rgba(255,255,255,0.01);
          border: 1px solid var(--border);
          border-radius: 8px;
          margin-bottom: 6px;
        }
        .qty-button {
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          color: var(--text-primary);
          width: 24px;
          height: 24px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-weight: bold;
          font-size: 14px;
          transition: all 0.2s;
        }
        .qty-button:hover {
          background: var(--accent);
          color: white;
          border-color: var(--accent);
        }
      `}} />

      {/* Header */}
      <div style={{
        padding: "16px 20px",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ShoppingCart size={18} style={{ color: "var(--accent)" }} />
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
            Finalizar Atendimento
          </h3>
        </div>
        <button onClick={onClose} style={{
          background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer",
        }}>
          <X size={20} />
        </button>
      </div>

      {/* Main Layout */}
      <div className="command-layout">
        <div className="command-body">
          
          {/* LEFT PANEL */}
          <div className="command-left-panel">
            {/* Appointment Details */}
            <div className="info-card">
              <h4 style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 10, letterSpacing: 0.5 }}>
                Dados do Atendimento
              </h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px", fontSize: 13 }}>
                <div>
                  <span style={{ color: "var(--text-muted)", display: "block", fontSize: 11 }}>Cliente</span>
                  <strong style={{ color: "var(--text-primary)" }}>{appointment.customer_name_snapshot || "Cliente avulso"}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)", display: "block", fontSize: 11 }}>Profissional</span>
                  <strong style={{ color: "var(--text-primary)" }}>{(appointment.professional as any)?.display_name || (appointment.professional as any)?.name}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)", display: "block", fontSize: 11 }}>Horário</span>
                  <strong style={{ color: "var(--text-primary)" }}>{formattedTime}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)", display: "block", fontSize: 11 }}>Serviço Original</span>
                  <strong style={{ color: "var(--text-primary)" }}>{appointment.service_name_snapshot || "Sem serviço"}</strong>
                </div>
              </div>
            </div>

            {/* Service Price Override Editor */}
            <div className="info-card" style={{ borderLeft: isPriceAdjusted ? "3px solid var(--warning)" : "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h4 style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Serviço Principal
                </h4>
                {isPriceAdjusted ? (
                  <span className="custom-badge warning">Valor Ajustado</span>
                ) : (
                  <span className="custom-badge success">Preço Original</span>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 12, alignItems: "end" }}>
                <div>
                  <span style={{ color: "var(--text-muted)", display: "block", fontSize: 11, marginBottom: 4 }}>Preço de Tabela</span>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-muted)" }}>
                    R$ {originalPrice.toFixed(2)}
                  </div>
                </div>

                <div>
                  <span style={{ color: "var(--text-muted)", display: "block", fontSize: 11, marginBottom: 4 }}>Valor a Cobrar (R$)</span>
                  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <span style={{ position: "absolute", left: 10, fontSize: 12, color: "var(--text-muted)", fontWeight: "bold" }}>R$</span>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      disabled={loading}
                      value={servicePriceOverride === 0 ? "" : servicePriceOverride}
                      onChange={e => setServicePriceOverride(Math.max(0, Number(e.target.value)))}
                      style={{
                        width: "100%",
                        padding: "8px 10px 8px 28px",
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        color: "var(--text-primary)",
                        fontSize: 14,
                        fontWeight: 700,
                        fontFamily: "inherit",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Price adjustment reason if > 20% */}
              {isReasonRequired && (
                <div style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--warning)", fontSize: 11, fontWeight: 600, marginBottom: 6 }}>
                    <AlertTriangle size={12} />
                    Diferença de {diffPercent.toFixed(0)}%. Justificativa obrigatória:
                  </label>
                  <textarea
                    rows={2}
                    value={adjustmentReason}
                    disabled={loading}
                    onChange={e => setAdjustmentReason(e.target.value)}
                    placeholder="Informe o motivo do desconto/acréscimo maior que 20%..."
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--warning)",
                      borderRadius: 8,
                      color: "var(--text-primary)",
                      fontSize: 12,
                      fontFamily: "inherit",
                      outline: "none",
                      resize: "none",
                    }}
                  />
                </div>
              )}
            </div>

            {/* Inventory Products Adder */}
            <div className="info-card" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 250 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h4 style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Adicionar Itens do Estoque
                </h4>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={() => setAddMode(addMode === "service" ? "none" : "service")}
                    style={{
                      padding: "4px 8px",
                      background: addMode === "service" ? "var(--accent)" : "none",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      color: addMode === "service" ? "white" : "var(--text-secondary)",
                      fontSize: 10,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    + Outro Serviço
                  </button>
                </div>
              </div>

              {/* Service list to add */}
              {addMode === "service" && (
                <div style={{ marginBottom: 12, border: "1px solid var(--border)", borderRadius: 8, maxHeight: 150, overflowY: "auto" }}>
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
                      <strong style={{ color: "var(--accent)" }}>R$ {svc.price.toFixed(2)}</strong>
                    </button>
                  ))}
                </div>
              )}

              {/* Search & Category Filter */}
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <Search size={14} style={{ position: "absolute", left: 10, top: 10, color: "var(--text-muted)" }} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Buscar produto por nome/código..."
                    style={{
                      width: "100%",
                      padding: "8px 10px 8px 30px",
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      color: "var(--text-primary)",
                      fontSize: 12,
                      fontFamily: "inherit",
                      outline: "none",
                    }}
                  />
                </div>
                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  style={{
                    padding: "8px 10px",
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    color: "var(--text-primary)",
                    fontSize: 12,
                    fontFamily: "inherit",
                    outline: "none",
                    maxWidth: 120,
                  }}
                >
                  <option value="all">Todas categorias</option>
                  {categoriesList.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              {/* Products List Scroll Container */}
              <div style={{ flex: 1, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8, maxHeight: 220 }}>
                {filteredProducts.length === 0 ? (
                  <div style={{ padding: 24, textRendering: "optimizeSpeed", textAlign: "center", color: "var(--text-muted)", fontSize: 11 }}>
                    Nenhum produto correspondente disponível.
                  </div>
                ) : (
                  filteredProducts.map(prod => {
                    const itemInComanda = items.find(i => i.product_id === prod.id)
                    const qtyInComanda = itemInComanda ? itemInComanda.quantity : 0
                    const remainingQty = prod.current_qty - qtyInComanda

                    return (
                      <div key={prod.id} style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 12px",
                        borderBottom: "1px solid var(--border)",
                        fontSize: 12,
                      }}>
                        <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                          <div style={{ fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {prod.name}
                          </div>
                          <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                            Cód: {prod.external_code || "N/A"} • Categoria: {prod.category?.name || "N/A"}
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                          <div style={{ textAlign: "right" }}>
                            <strong style={{ color: "var(--text-primary)", display: "block" }}>
                              R$ {(prod.sale_price_generated || 0).toFixed(2)}
                            </strong>
                            <span style={{ fontSize: 10, color: remainingQty > 0 ? "var(--text-muted)" : "var(--danger)" }}>
                              Disponível: {remainingQty}
                            </span>
                          </div>

                          <button
                            onClick={() => handleAddProduct(prod)}
                            disabled={remainingQty <= 0 || loading}
                            style={{
                              background: "var(--accent)",
                              border: "none",
                              color: "white",
                              padding: "4px 8px",
                              borderRadius: 6,
                              cursor: "pointer",
                              opacity: remainingQty <= 0 ? 0.3 : 1,
                              fontWeight: "bold",
                            }}
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div className="command-right-panel">
            
            {/* Command Items List */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 200 }}>
              <h4 style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
                Itens na Comanda
              </h4>

              {error && (
                <div className="alert-banner danger" style={{ margin: "0 0 12px", fontSize: 12, padding: "8px 12px" }}>
                  <AlertTriangle size={12} style={{ display: "inline", marginRight: 6 }} />
                  {error}
                </div>
              )}

              <div style={{ flex: 1, overflowY: "auto", maxHeight: 280 }}>
                {/* Main Service Row (read-only list view representing top price box) */}
                {appointment.service_id && (
                  <div className="item-row" style={{ borderLeft: "3px solid var(--accent)", background: "rgba(var(--accent-rgb), 0.02)" }}>
                    <Scissors size={14} style={{ color: "var(--accent)" }} />
                    <div style={{ flex: 1 }}>
                      <strong style={{ fontSize: 12, color: "var(--text-primary)" }}>
                        {appointment.service_name_snapshot}
                      </strong>
                      <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                        Serviço Principal • Preço editável no painel esquerdo
                      </div>
                    </div>
                    <strong style={{ fontSize: 13, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
                      R$ {servicePriceOverride.toFixed(2)}
                    </strong>
                  </div>
                )}

                {/* Additional Items list */}
                {additionalItems.length === 0 ? (
                  additionalItems.length === 0 && !appointment.service_id ? (
                    <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
                      Nenhum item adicionado.
                    </div>
                  ) : null
                ) : (
                  additionalItems.map(item => (
                    <div key={item.id} className="item-row">
                      {item.item_type === "service" ? (
                        <Scissors size={14} style={{ color: "var(--accent)", flexShrink: 0 }} />
                      ) : (
                        <Package size={14} style={{ color: "var(--info)", flexShrink: 0 }} />
                      )}
                      
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {item.description_snapshot}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                          R$ {item.unit_price_snapshot.toFixed(2)} / unit
                        </div>
                      </div>

                      {/* Quantity Controls */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginRight: 8 }}>
                        <button
                          disabled={loading}
                          onClick={() => handleUpdateQty(item.id, item.quantity, -1)}
                          className="qty-button"
                        >
                          -
                        </button>
                        <span style={{ fontSize: 13, fontWeight: "bold", width: 16, textAlign: "center", color: "var(--text-primary)" }}>
                          {item.quantity}
                        </span>
                        <button
                          disabled={loading}
                          onClick={() => handleUpdateQty(item.id, item.quantity, 1)}
                          className="qty-button"
                        >
                          +
                        </button>
                      </div>

                      <strong style={{ fontSize: 13, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums", minWidth: 60, textAlign: "right" }}>
                        R$ {(item.quantity * item.unit_price_snapshot).toFixed(2)}
                      </strong>

                      <button
                        disabled={loading}
                        onClick={() => handleRemoveItem(item.id)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--danger)",
                          cursor: "pointer",
                          padding: 4,
                          marginLeft: 4,
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Totals & Payments */}
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: "auto" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                
                {/* Subtotal */}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text-secondary)" }}>
                  <span>Subtotal</span>
                  <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                    R$ {subtotal.toFixed(2)}
                  </span>
                </div>

                {/* Desconto */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Desconto (R$)</span>
                  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <span style={{ position: "absolute", left: 8, fontSize: 11, color: "var(--text-muted)", fontWeight: "bold" }}>R$</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      disabled={loading}
                      value={discount === 0 ? "" : discount}
                      onChange={e => setDiscount(Math.max(0, Number(e.target.value)))}
                      placeholder="0,00"
                      style={{
                        width: 90,
                        padding: "4px 8px 4px 22px",
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        color: "var(--text-primary)",
                        fontSize: 12,
                        fontFamily: "inherit",
                        textAlign: "right",
                        fontWeight: "bold",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>

                {/* Total Final */}
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 18,
                  fontWeight: 800,
                  color: "var(--text-primary)",
                  paddingTop: 10,
                  borderTop: "1px dashed var(--border)",
                  marginTop: 4,
                }}>
                  <span>Total Final</span>
                  <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--accent)" }}>
                    R$ {total.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Payment Methods selector */}
              <div style={{ marginBottom: 14 }}>
                <select
                  value={selectedPaymentMethod}
                  disabled={loading}
                  onChange={e => setSelectedPaymentMethod(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    color: "var(--text-primary)",
                    fontSize: 13,
                    fontWeight: 500,
                    fontFamily: "inherit",
                    outline: "none",
                  }}
                >
                  <option value="">Selecione a forma de pagamento...</option>
                  {paymentMethods.map(pm => (
                    <option key={pm.id} value={pm.id}>{pm.name}</option>
                  ))}
                </select>
              </div>

              {/* Submit Finalize Button */}
              <button
                onClick={handleFinalize}
                disabled={loading || !isValidToSubmit}
                className="btn-primary"
                style={{
                  width: "100%",
                  padding: "12px 20px",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: loading || !isValidToSubmit ? "not-allowed" : "pointer",
                  opacity: loading || !isValidToSubmit ? 0.4 : 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  fontFamily: "inherit",
                  transition: "all 0.2s",
                }}
              >
                <CreditCard size={16} />
                {loading ? "Finalizando..." : "Confirmar e Finalizar Venda"}
              </button>
            </div>
            
          </div>
          
        </div>
      </div>
    </div>
  )
}
