'use client'

import { useAuth } from '@/components/auth-provider'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  submitInventorySaleRequest,
  submitServiceSaleRequest,
  submitPerfumeSaleRequest,
  submitStockWithdrawalRequest,
  submitManualDeductionRequest,
} from '@/features/professional-requests/actions/submit-request.actions'
import { ShoppingCart, Scissors, Droplets, Package, MinusCircle, ArrowLeft, Send } from 'lucide-react'
import Link from 'next/link'

type RequestType = 'inventory_sale' | 'service_sale' | 'perfume_sale' | 'stock_withdrawal' | 'manual_deduction'

const REQUEST_OPTIONS = [
  { type: 'inventory_sale' as RequestType, label: 'Venda de Produto', icon: ShoppingCart, description: 'Bebida, finalizador ou revenda' },
  { type: 'service_sale' as RequestType, label: 'Serviço Realizado', icon: Scissors, description: 'Corte, barba, sobrancelha...' },
  { type: 'perfume_sale' as RequestType, label: 'Venda de Perfume', icon: Droplets, description: 'Venda de perfume com comissão' },
  { type: 'stock_withdrawal' as RequestType, label: 'Retirada de Estoque', icon: Package, description: 'Produto de uso pessoal' },
  { type: 'manual_deduction' as RequestType, label: 'Dedução Manual', icon: MinusCircle, description: 'Vale, ajuste ou desconto' },
]

export default function RegistrarPage() {
  const { user } = useAuth()
  const [selectedType, setSelectedType] = useState<RequestType | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Lists for dropdowns
  const [products, setProducts] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [paymentMethods, setPaymentMethods] = useState<any[]>([])

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('inventory_products').select('id, name, sale_price_generated, cost_price, external_code').eq('is_active', true).order('name'),
      supabase.from('services').select('id, name, price, commission_percent').eq('is_active', true).order('name'),
      supabase.from('payment_methods').select('id, name').eq('is_active', true).order('name'),
    ]).then(([prodRes, svcRes, pmRes]) => {
      setProducts(prodRes.data || [])
      setServices(svcRes.data || [])
      setPaymentMethods(pmRes.data || [])
    })
  }, [])

  if (!selectedType) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Registrar</h1>
            <p className="page-subtitle">Escolha o tipo de registro para enviar à aprovação</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {REQUEST_OPTIONS.map(opt => (
            <button
              key={opt.type}
              onClick={() => setSelectedType(opt.type)}
              className="request-card"
              style={{ cursor: 'pointer', textAlign: 'left', background: 'var(--bg-surface)', fontFamily: 'inherit' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="kpi-icon" style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}>
                  <opt.icon size={18} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{opt.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{opt.description}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => setSelectedType(null)}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="page-title">
              {REQUEST_OPTIONS.find(o => o.type === selectedType)?.label}
            </h1>
            <p className="page-subtitle">Preencha os dados para enviar à aprovação</p>
          </div>
        </div>
      </div>

      <RequestForm
        type={selectedType}
        professionalId={user?.collaboratorId || ''}
        products={products}
        services={services}
        paymentMethods={paymentMethods}
        submitting={submitting}
        onSubmit={async (data) => {
          setSubmitting(true)
          try {
            let result: any

            switch (selectedType) {
              case 'inventory_sale':
                result = await submitInventorySaleRequest(data)
                break
              case 'service_sale':
                result = await submitServiceSaleRequest(data)
                break
              case 'perfume_sale':
                result = await submitPerfumeSaleRequest(data)
                break
              case 'stock_withdrawal':
                result = await submitStockWithdrawalRequest(data)
                break
              case 'manual_deduction':
                result = await submitManualDeductionRequest(data)
                break
            }

            if (result.success) {
              toast.success('Solicitação enviada com sucesso! Aguarde aprovação.')
              setSelectedType(null)
            } else {
              toast.error(result.error || 'Erro ao enviar solicitação')
            }
          } catch (err: any) {
            toast.error(err.message || 'Erro inesperado')
          }
          setSubmitting(false)
        }}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// DYNAMIC FORM COMPONENT
// ═══════════════════════════════════════════════════════════

function RequestForm({
  type, professionalId, products, services, paymentMethods, submitting, onSubmit
}: {
  type: RequestType
  professionalId: string
  products: any[]
  services: any[]
  paymentMethods: any[]
  submitting: boolean
  onSubmit: (data: any) => void
}) {
  // ── Common state ──
  const [productId, setProductId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [serviceName, setServiceName] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [unitPrice, setUnitPrice] = useState(0)
  const [discount, setDiscount] = useState(0)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [paymentMethodId, setPaymentMethodId] = useState('')
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [commissionPercent, setCommissionPercent] = useState(10)
  const [paymentMode, setPaymentMode] = useState<'cash' | 'installments'>('cash')
  const [installmentCount, setInstallmentCount] = useState(3)
  const [dueDay, setDueDay] = useState(15)
  const [unitAmount, setUnitAmount] = useState(0)
  const [carryOver, setCarryOver] = useState(false)

  // Auto-fill price when product/service changes
  useEffect(() => {
    if (productId) {
      const p = products.find(p => p.id === productId)
      if (p) setUnitPrice(p.sale_price_generated || 0)
    }
  }, [productId, products])

  useEffect(() => {
    if (serviceId) {
      const s = services.find(s => s.id === serviceId)
      if (s) {
        setUnitPrice(s.price || 0)
        setServiceName(s.name)
        setCommissionPercent(s.commission_percent || 0)
      }
    }
  }, [serviceId, services])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    switch (type) {
      case 'inventory_sale': {
        const product = products.find(p => p.id === productId)
        onSubmit({
          professional_id: professionalId,
          items: [{
            product_id: productId,
            product_name: product?.name || '',
            quantity,
            unit_price: unitPrice,
            unit_cost: product?.cost_price || 0,
            discount,
          }],
          customer_name: customerName || undefined,
          customer_phone: customerPhone || undefined,
          payment_method_id: paymentMethodId,
          discount_amount: discount,
          notes,
        })
        break
      }
      case 'service_sale':
        onSubmit({
          professional_id: professionalId,
          items: [{
            service_id: serviceId || undefined,
            service_name: serviceName || 'Serviço',
            quantity,
            unit_price: unitPrice,
            discount,
          }],
          customer_name: customerName || undefined,
          customer_phone: customerPhone || undefined,
          payment_method_id: paymentMethodId,
          discount_amount: discount,
          notes,
        })
        break
      case 'perfume_sale': {
        const product = products.find(p => p.id === productId)
        onSubmit({
          professional_id: professionalId,
          inventory_product_id: productId,
          product_name: product?.name || '',
          quantity,
          unit_price: unitPrice,
          commission_percent: commissionPercent,
          payment_mode: paymentMode,
          payment_method: paymentMode === 'cash' ? paymentMethodId : undefined,
          installment_count: paymentMode === 'installments' ? installmentCount : undefined,
          due_day: paymentMode === 'installments' ? dueDay : undefined,
          customer_name: customerName,
          customer_phone: customerPhone || undefined,
          notes,
        })
        break
      }
      case 'stock_withdrawal': {
        const product = products.find(p => p.id === productId)
        onSubmit({
          professional_id: professionalId,
          product_id: productId,
          product_name: product?.name || '',
          quantity,
          unit_amount: unitAmount || product?.cost_price || 0,
          description: description || `Retirada: ${product?.name || ''}`,
          notes,
        })
        break
      }
      case 'manual_deduction':
        onSubmit({
          professional_id: professionalId,
          description,
          quantity,
          unit_amount: unitAmount,
          carry_over_to_next_period: carryOver,
          notes,
        })
        break
    }
  }

  const formStyle = { display: 'flex', flexDirection: 'column' as const, gap: 16, maxWidth: 500 }
  const fieldStyle = { display: 'flex', flexDirection: 'column' as const, gap: 6 }
  const labelStyle = { fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: 'var(--text-secondary)' }
  const inputStyle = { width: '100%', height: 44, padding: '0 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)', color: 'var(--text-primary)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }
  const selectStyle = { ...inputStyle, appearance: 'none' as const }

  return (
    <div className="section-card" style={{ maxWidth: 540 }}>
      <div className="section-card-body">
        <form onSubmit={handleSubmit} style={formStyle}>
          {/* Product/Service selector */}
          {(type === 'inventory_sale' || type === 'perfume_sale' || type === 'stock_withdrawal') && (
            <div style={fieldStyle}>
              <label style={labelStyle}>Produto</label>
              <select value={productId} onChange={e => setProductId(e.target.value)} required style={selectStyle}>
                <option value="">Selecione...</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} — R$ {p.sale_price_generated?.toFixed(2)}</option>
                ))}
              </select>
            </div>
          )}

          {type === 'service_sale' && (
            <>
              <div style={fieldStyle}>
                <label style={labelStyle}>Serviço</label>
                <select value={serviceId} onChange={e => setServiceId(e.target.value)} style={selectStyle}>
                  <option value="">Serviço avulso (digitar nome)</option>
                  {services.map(s => (
                    <option key={s.id} value={s.id}>{s.name} — R$ {s.price?.toFixed(2)}</option>
                  ))}
                </select>
              </div>
              {!serviceId && (
                <div style={fieldStyle}>
                  <label style={labelStyle}>Nome do Serviço</label>
                  <input value={serviceName} onChange={e => setServiceName(e.target.value)} placeholder="Ex: Corte + Barba" required style={inputStyle} />
                </div>
              )}
            </>
          )}

          {/* Quantity */}
          <div style={fieldStyle}>
            <label style={labelStyle}>Quantidade</label>
            <input type="number" min={1} value={quantity} onChange={e => setQuantity(Number(e.target.value))} required style={inputStyle} />
          </div>

          {/* Price */}
          {(type === 'inventory_sale' || type === 'service_sale' || type === 'perfume_sale') && (
            <div style={fieldStyle}>
              <label style={labelStyle}>Valor Unitário (R$)</label>
              <input type="number" step="0.01" min={0} value={unitPrice} onChange={e => setUnitPrice(Number(e.target.value))} required style={inputStyle} />
            </div>
          )}

          {(type === 'stock_withdrawal' || type === 'manual_deduction') && (
            <div style={fieldStyle}>
              <label style={labelStyle}>Valor Unitário (R$)</label>
              <input type="number" step="0.01" min={0} value={unitAmount} onChange={e => setUnitAmount(Number(e.target.value))} required style={inputStyle} />
            </div>
          )}

          {/* Customer */}
          {(type === 'inventory_sale' || type === 'service_sale' || type === 'perfume_sale') && (
            <div style={fieldStyle}>
              <label style={labelStyle}>Cliente (opcional)</label>
              <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Nome do cliente" style={inputStyle} />
            </div>
          )}

          {/* Payment */}
          {(type === 'inventory_sale' || type === 'service_sale') && (
            <div style={fieldStyle}>
              <label style={labelStyle}>Método de Pagamento</label>
              <select value={paymentMethodId} onChange={e => setPaymentMethodId(e.target.value)} required style={selectStyle}>
                <option value="">Selecione...</option>
                {paymentMethods.map(pm => (
                  <option key={pm.id} value={pm.id}>{pm.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Perfume-specific */}
          {type === 'perfume_sale' && (
            <>
              <div style={fieldStyle}>
                <label style={labelStyle}>Comissão (%)</label>
                <input type="number" step="0.1" min={0} max={100} value={commissionPercent} onChange={e => setCommissionPercent(Number(e.target.value))} style={inputStyle} />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Modo de Pagamento</label>
                <select value={paymentMode} onChange={e => setPaymentMode(e.target.value as any)} style={selectStyle}>
                  <option value="cash">À Vista</option>
                  <option value="installments">A Prazo (Parcelas)</option>
                </select>
              </div>
              {paymentMode === 'installments' && (
                <>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Parcelas</label>
                    <input type="number" min={2} max={12} value={installmentCount} onChange={e => setInstallmentCount(Number(e.target.value))} style={inputStyle} />
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Dia Vencimento</label>
                    <input type="number" min={1} max={28} value={dueDay} onChange={e => setDueDay(Number(e.target.value))} style={inputStyle} />
                  </div>
                </>
              )}
            </>
          )}

          {/* Description (for withdrawals/deductions) */}
          {(type === 'stock_withdrawal' || type === 'manual_deduction') && (
            <div style={fieldStyle}>
              <label style={labelStyle}>Descrição</label>
              <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Motivo da retirada/dedução" required style={inputStyle} />
            </div>
          )}

          {type === 'manual_deduction' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={carryOver} onChange={e => setCarryOver(e.target.checked)} id="carryOver" />
              <label htmlFor="carryOver" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Diferir para próximo período</label>
            </div>
          )}

          {/* Notes */}
          <div style={fieldStyle}>
            <label style={labelStyle}>Observações (opcional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Observações adicionais..." style={{ ...inputStyle, height: 'auto', padding: '10px 14px', resize: 'vertical' as const }} />
          </div>

          {/* Total preview */}
          <div style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
              R$ {((type === 'stock_withdrawal' || type === 'manual_deduction' ? unitAmount : unitPrice) * quantity - discount).toFixed(2)}
            </span>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="login-button"
            style={{ marginTop: 8 }}
          >
            {submitting ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                Enviando...
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Send size={16} />
                Enviar para Aprovação
              </div>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
