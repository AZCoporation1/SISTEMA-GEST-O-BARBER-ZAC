"use client"

import { useState, useMemo } from "react"
import { usePOSDependencies, usePOSMutations } from "../hooks/useSales"
import { useInventory } from "@/features/inventory/hooks/useInventory"
import { useServices } from "@/features/services/hooks/useServices"
import { CartItem } from "../types"
import { SaleFormValues } from "../validators"
import { SaleWithReceivablesPayload } from "../actions/processSaleWithReceivables"
import { generateInstallmentSchedule } from "@/features/receivables/helpers"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { ShoppingCart, Plus, Minus, Trash2, Tag, User, Search, MapPin, Package, AlertCircle, CalendarDays, FileText } from "lucide-react"

export function POSView() {
  const [cart, setCart] = useState<CartItem[]>([])
  const [discountAmount, setDiscountAmount] = useState(0)
  const [selectedCustomer, setSelectedCustomer] = useState<string>("")
  const [selectedCollaborator, setSelectedCollaborator] = useState<string>("")
  const [paymentMethodId, setPaymentMethodId] = useState<string>("")
  const [notes, setNotes] = useState("")
  const [customerNameOverride, setCustomerNameOverride] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [stockWarning, setStockWarning] = useState<string | null>(null)

  // Installment state
  const [paymentMode, setPaymentMode] = useState<'upfront' | 'installment' | 'mixed'>('upfront')
  const [paymentOrigin, setPaymentOrigin] = useState<'credit_card_installment' | 'store_credit'>('credit_card_installment')
  const [installmentCount, setInstallmentCount] = useState(2)
  const [firstDueDate, setFirstDueDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 30)
    return d.toISOString().split('T')[0]
  })
  const [upfrontPayAmount, setUpfrontPayAmount] = useState(0)
  const [installmentNotes, setInstallmentNotes] = useState('')
  
  // Data hooks
  const { data: inventoryData, isLoading: isInventoryLoading } = useInventory({ page: 1, perPage: 1000, status: "active", search: "" })
  const { data: servicesData } = useServices({ page: 1, perPage: 1000, status: "active" })
  const { customers, collaborators, paymentMethods, isLoading } = usePOSDependencies()
  const { processSale, isProcessing } = usePOSMutations()

  // Computed
  const subtotal = cart.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0)
  const total = Math.max(0, subtotal - discountAmount)
  const isValid = cart.length > 0 && paymentMethodId !== ""

  const safeInventory = inventoryData?.data || []

  // Filter products by name OR external_code, AND ensure they are for resale
  const filteredProducts = useMemo(() => {
    let base = safeInventory.filter((p: any) => p.is_for_resale !== false)
    if (!searchQuery.trim()) return base
    const q = searchQuery.toLowerCase().trim()
    return base.filter((p: any) => {
      const nameMatch = p.product_name?.toLowerCase().includes(q)
      const codeMatch = p.external_code?.toLowerCase().includes(q)
      return nameMatch || codeMatch
    })
  }, [safeInventory, searchQuery])

  // Get current stock for a product, accounting for what's already in the cart
  const getAvailableStock = (productId: string, currentBalance: number) => {
    const cartItem = cart.find(item => item.productId === productId)
    const inCart = cartItem ? cartItem.quantity : 0
    return currentBalance - inCart
  }

  const handleAddProduct = (productId: string) => {
    const product = safeInventory.find((p: any) => p.product_id === productId)
    if (!product) return

    const balance = product.current_balance || 0

    // Block if no stock at all
    if (balance <= 0) {
      setStockWarning(`"${product.product_name}" está sem estoque (saldo: 0). Não é possível adicionar.`)
      setTimeout(() => setStockWarning(null), 4000)
      return
    }

    const available = getAvailableStock(productId, balance)

    // Block if all stock is already in cart
    if (available <= 0) {
      setStockWarning(`Estoque insuficiente para "${product.product_name}". Já há ${balance} un. no carrinho.`)
      setTimeout(() => setStockWarning(null), 4000)
      return
    }

    setStockWarning(null)

    setCart(prev => {
      const existing = prev.find(item => item.productId === productId)
      if (existing) {
        return prev.map(item => item.productId === productId 
          ? { ...item, quantity: item.quantity + 1 }
          : item
        )
      }
      return [...prev, {
        id: `prod-${Date.now()}`,
        type: 'product',
        productId: product.product_id!,
        name: product.product_name!,
        quantity: 1,
        unitPrice: product.sale_price || 0,
        unitCost: product.cost_price || 0,
        discount: 0,
        maxStock: balance // Track max for this item
      } as CartItem]
    })
  }

  // Service addition with editable name and price
  // Service addition with editable name and price
  const [selectedServiceId, setSelectedServiceId] = useState<string>("custom")
  const [serviceNameInput, setServiceNameInput] = useState("Serviço Avulso")
  const [servicePriceInput, setServicePriceInput] = useState(50)
  
  const catalogServices = servicesData?.data || []

  const handleServiceSelection = (val: string) => {
    setSelectedServiceId(val)
    if (val !== "custom") {
       const s = catalogServices.find((x: any) => x.id === val)
       if (s) {
         setServiceNameInput(s.name)
         setServicePriceInput(s.price)
       }
    } else {
       setServiceNameInput("Serviço Avulso")
       setServicePriceInput(50)
    }
  }
  
  const handleAddService = () => {
    if (!serviceNameInput || servicePriceInput <= 0) return
    setCart(prev => [...prev, {
      id: `srv-${Date.now()}`,
      type: 'service',
      serviceId: selectedServiceId === "custom" ? null : selectedServiceId,
      name: serviceNameInput,
      quantity: 1,
      unitPrice: servicePriceInput,
      unitCost: 0,
      discount: 0
    }])
    setSelectedServiceId("custom")
    setServiceNameInput("Serviço Avulso")
    setServicePriceInput(50)
  }

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQ = Math.max(1, item.quantity + delta)
        
        // For products, cap at available stock
        if (item.type === 'product' && item.productId) {
          const product = safeInventory.find((p: any) => p.product_id === item.productId)
          const maxBalance = product?.current_balance || 0
          if (newQ > maxBalance) {
            setStockWarning(`Quantidade máxima para "${item.name}": ${maxBalance} un. (estoque disponível).`)
            setTimeout(() => setStockWarning(null), 3000)
            return { ...item, quantity: maxBalance }
          }
        }
        
        return { ...item, quantity: newQ }
      }
      return item
    }))
  }

  const removeItem = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id))
    setStockWarning(null)
  }

  const onSubmit = async () => {
    if (!isValid) return

    // Final validation: ensure no product exceeds stock
    for (const item of cart) {
      if (item.type === 'product' && item.productId) {
        const product = safeInventory.find((p: any) => p.product_id === item.productId)
        const balance = product?.current_balance || 0
        if (item.quantity > balance) {
          setStockWarning(`"${item.name}" tem apenas ${balance} un. em estoque, mas há ${item.quantity} no carrinho. Ajuste antes de finalizar.`)
          return
        }
      }
    }

    const payload: SaleWithReceivablesPayload = {
      customer_id: selectedCustomer && selectedCustomer !== "none" ? selectedCustomer : null,
      customer_name_override: (!selectedCustomer || selectedCustomer === "none") && customerNameOverride.trim() !== "" ? customerNameOverride.trim() : null,
      collaborator_id: selectedCollaborator && selectedCollaborator !== "none" ? selectedCollaborator : null,
      payment_method_id: paymentMethodId,
      discount_amount: discountAmount,
      notes,
      items: cart.map(c => ({
        id: c.id,
        type: c.type,
        productId: c.productId,
        serviceId: c.serviceId,
        name: c.name,
        quantity: c.quantity,
        unitPrice: c.unitPrice,
        unitCost: c.unitCost,
        discount: c.discount
      })),
      payment_mode: paymentMode,
      payment_origin: paymentMode !== 'upfront' ? paymentOrigin : undefined,
      installment_count: paymentMode !== 'upfront' ? installmentCount : undefined,
      first_due_date: paymentMode !== 'upfront' ? firstDueDate : undefined,
      upfront_amount: paymentMode === 'mixed' ? upfrontPayAmount : undefined,
      installment_notes: paymentMode !== 'upfront' ? installmentNotes : undefined,
    }

    // Validate boca a boca
    if (paymentMode !== 'upfront' && paymentOrigin === 'store_credit') {
      if (!selectedCustomer || selectedCustomer === 'none') {
        setStockWarning('Cliente cadastrado obrigatório para venda a prazo / boca a boca.')
        return
      }
      if (!installmentNotes.trim()) {
        setStockWarning('Observação/motivo obrigatório para venda a prazo.')
        return
      }
    }

    await processSale(payload)
    
    // reset
    setCart([])
    setDiscountAmount(0)
    setNotes("")
    setSelectedCustomer("")
    setCustomerNameOverride("")
    setSelectedCollaborator("")
    setPaymentMethodId("")
    setStockWarning(null)
    setPaymentMode('upfront')
    setPaymentOrigin('credit_card_installment')
    setInstallmentCount(2)
    setInstallmentNotes('')
    setUpfrontPayAmount(0)
  }

  return (
    <div className="pos-layout">
      {/* Page Header — compact */}
      <div className="pos-header">
        <div>
          <h1 className="page-title" style={{ fontSize: 20 }}>Ponto de Venda</h1>
          <p className="page-subtitle" style={{ fontSize: 12 }}>Vendas de produtos e serviços (PDV)</p>
        </div>
      </div>

      {/* Stock Warning */}
      {stockWarning && (
        <div className="flex items-center gap-3 p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-600 dark:text-amber-400 animate-in slide-in-from-top-2 flex-shrink-0">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <p className="text-sm font-medium">{stockWarning}</p>
        </div>
      )}

      {/* Two-column POS Grid */}
      <div className="pos-grid">
        
        {/* Left Panel - Catalog */}
        <div className="pos-left-panel">
          
          {/* Service Quick Add — compact */}
          <div className="section-card flex-shrink-0">
            <div className="section-card-header" style={{ padding: '10px 16px' }}>
              <h3 className="section-card-title" style={{ fontSize: 12 }}>Inserir Rápido</h3>
            </div>
            <div className="section-card-body" style={{ padding: '10px 16px' }}>
              <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex-1 w-full text-left">
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">Serviço</label>
                  <Select value={selectedServiceId} onValueChange={handleServiceSelection}>
                    <SelectTrigger className="h-8 w-full bg-background text-xs">
                      <SelectValue placeholder="Selecione um serviço" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom">Serviço Avulso (Customizado)</SelectItem>
                      {catalogServices.map((srv: any) => (
                         <SelectItem key={srv.id} value={srv.id}>{srv.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedServiceId === 'custom' && (
                  <div className="flex-1 w-full text-left">
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">Nome</label>
                    <Input
                      value={serviceNameInput}
                      onChange={e => setServiceNameInput(e.target.value)}
                      placeholder="Ex: Corte Degradê"
                      className="h-8 w-full text-xs"
                    />
                  </div>
                )}
                <div className="w-full sm:w-28 text-left">
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">Valor (R$)</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={servicePriceInput || ""}
                    onChange={e => setServicePriceInput(parseFloat(e.target.value) || 0)}
                    className="h-8 w-full text-xs"
                  />
                </div>
                <Button onClick={handleAddService} variant="outline" className="w-full sm:w-auto h-8 text-xs hover:border-emerald-500 hover:text-emerald-500 transition-colors">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
                </Button>
              </div>
            </div>
          </div>

          {/* Product Catalog — scrollable */}
          <div className="section-card pos-catalog-card">
            <div className="section-card-header flex items-center justify-between" style={{ padding: '10px 16px' }}>
              <h3 className="section-card-title flex items-center gap-2" style={{ fontSize: 12 }}>
                <Package className="h-4 w-4 text-emerald-500" />
                Catálogo de Produtos
              </h3>
            </div>
            <div className="p-3 border-b">
               <div className="relative w-full max-w-sm">
                 <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                 <Input
                   placeholder="Buscar por nome ou código..."
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                   className="pl-8 h-8 text-xs"
                 />
               </div>
            </div>
            <div className="pos-catalog-scroll">
              {isInventoryLoading ? (
                <div className="h-32 flex items-center justify-center text-muted-foreground">Carregando catálogo...</div>
              ) : filteredProducts.length === 0 ? (
                 <div className="empty-state py-6" style={{ margin: 8, padding: '32px 16px' }}>
                   <Package className="empty-state-icon w-10 h-10" />
                   <h3 className="empty-state-title text-sm">
                     {searchQuery ? "Nenhum produto encontrado" : "Nenhum produto em estoque"}
                   </h3>
                   {searchQuery && <p className="empty-state-description text-xs">Tente buscar por outro nome ou código.</p>}
                 </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 p-3">
                  {filteredProducts.map((p: any) => {
                    const balance = p.current_balance || 0
                    const isOutOfStock = balance <= 0
                    return (
                      <div 
                        key={p.product_id} 
                        onClick={() => !isOutOfStock && handleAddProduct(p.product_id!)}
                        className={`border rounded-xl p-2.5 flex flex-col justify-between min-h-[90px] transition-all ${
                          isOutOfStock 
                            ? 'opacity-50 cursor-not-allowed border-dashed' 
                            : 'cursor-pointer hover:border-emerald-500 hover:shadow-md bg-card active:scale-95'
                        }`}
                      >
                        <div>
                          {p.external_code && (
                            <span className="text-[9px] font-semibold tracking-wider text-[var(--accent)] font-mono bg-[var(--accent-subtle)] px-1 py-0.5 rounded mb-0.5 inline-block" style={{ letterSpacing: '0.06em' }}>
                              {p.external_code}
                            </span>
                          )}
                          <p className="font-semibold text-xs line-clamp-2 leading-tight">{p.product_name}</p>
                          <p className={`text-[10px] mt-0.5 uppercase font-medium tracking-wider ${isOutOfStock ? 'text-red-500' : 'text-muted-foreground'}`}>
                            Est: {balance}
                          </p>
                        </div>
                        <p className="font-bold text-sm text-emerald-600 dark:text-emerald-400 mt-1">R$ {p.sale_price?.toFixed(2)}</p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel - Cart & Checkout */}
        <div className="pos-right-panel section-card">
          {/* Cart Header */}
          <div className="section-card-header bg-emerald-950/20 border-b-emerald-900/30" style={{ padding: '10px 16px' }}>
            <h3 className="section-card-title text-emerald-500 flex items-center gap-2" style={{ fontSize: 12 }}>
              <ShoppingCart className="h-4 w-4" />
              Carrinho Atual
              {cart.length > 0 && (
                <span className="ml-auto text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                  {cart.reduce((a, c) => a + c.quantity, 0)} itens
                </span>
              )}
            </h3>
          </div>

          {/* Customer/Collaborator Selectors — compact */}
          <div className="p-3 space-y-2 border-b flex-shrink-0 bg-muted/10">
            <div className="flex items-center gap-2 bg-background p-1.5 rounded-lg border">
              <User className="h-3.5 w-3.5 text-muted-foreground ml-1.5" />
              <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                <SelectTrigger className="border-0 bg-transparent shrink focus:ring-0 text-xs h-7">
                  <SelectValue placeholder="Vincular Cliente (Opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Avulso / Sem cadastro</SelectItem>
                  {(customers || []).filter((c: any) => c.id).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(!selectedCustomer || selectedCustomer === "none") && (
              <div className="flex items-center gap-2 bg-background p-1.5 rounded-lg border animate-in slide-in-from-top-1 fade-in duration-200">
                <User className="h-3.5 w-3.5 text-muted-foreground ml-1.5 opacity-50" />
                <Input
                  placeholder="Nome do cliente avulso (Opcional)"
                  value={customerNameOverride}
                  onChange={e => setCustomerNameOverride(e.target.value)}
                  className="border-0 bg-transparent shrink focus-visible:ring-0 text-xs h-7 px-2 shadow-none"
                />
              </div>
            )}

            <div className="flex items-center gap-2 bg-background p-1.5 rounded-lg border">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground ml-1.5" />
              <Select value={selectedCollaborator} onValueChange={setSelectedCollaborator}>
                <SelectTrigger className="border-0 bg-transparent shrink focus:ring-0 text-xs h-7">
                  <SelectValue placeholder="Atendente / Barbeiro (Opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem vínculo</SelectItem>
                  {(collaborators || []).filter((c: any) => c.id).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Cart Items — scrollable */}
          <div className="pos-cart-items">
            {cart.length === 0 ? (
              <div className="empty-state h-full justify-center opacity-70" style={{ padding: '24px 16px', margin: 0, border: 'none', background: 'none' }}>
                <ShoppingCart className="empty-state-icon" style={{ width: 36, height: 36 }} />
                <p className="empty-state-title" style={{ fontSize: 13 }}>O carrinho está vazio</p>
                <p className="empty-state-description" style={{ fontSize: 11 }}>Selecione produtos ou serviços no painel ao lado.</p>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.id} className="flex justify-between items-center p-2.5 border rounded-lg bg-card shadow-sm">
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="font-semibold text-xs truncate">{item.name}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      R$ {item.unitPrice.toFixed(2)}
                      {item.type === 'product' && (
                        <span className="ml-2 text-[10px] opacity-60">
                          (est: {safeInventory.find((p: any) => p.product_id === item.productId)?.current_balance || 0})
                        </span>
                      )}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <div className="flex items-center bg-muted rounded-md border h-7">
                      <Button variant="ghost" size="icon" className="h-full w-6 rounded-none hover:bg-background" onClick={() => updateQuantity(item.id, -1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-5 text-center text-xs font-bold">{item.quantity}</span>
                      <Button variant="ghost" size="icon" className="h-full w-6 rounded-none hover:bg-background" onClick={() => updateQuantity(item.id, 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => removeItem(item.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Checkout Footer — ALWAYS VISIBLE (sticky) */}
          <div className="pos-checkout-footer">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-medium text-muted-foreground">
                <span>Subtotal</span>
                <span>R$ {subtotal.toFixed(2)}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Tag className="h-3 w-3" /> Desconto
                </span>
                <Input 
                  type="number" 
                  min="0" 
                  className="w-20 h-7 text-right font-medium text-xs" 
                  value={discountAmount || ''}
                  onChange={e => setDiscountAmount(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="flex justify-between items-end border-t pt-2">
              <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Total</span>
              <span className="text-2xl font-bold tracking-tight text-emerald-500">
                R$ {total.toFixed(2)}
              </span>
            </div>

            <Select value={paymentMethodId} onValueChange={setPaymentMethodId}>
              <SelectTrigger className="h-10 border-2 focus:ring-emerald-500/20 data-[state=open]:border-emerald-500 text-xs">
                <SelectValue placeholder="Forma de Pagamento *" />
              </SelectTrigger>
              <SelectContent>
                {(paymentMethods || []).filter((pm: any) => pm.id).map((pm: any) => (
                  <SelectItem key={pm.id} value={pm.id}>{pm.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* ── PAYMENT MODE SELECTOR ── */}
            <div className="border-t pt-2 mt-1">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">Modo de Pagamento</label>
              <div className="flex gap-1">
                {[
                  { value: 'upfront', label: 'À Vista' },
                  { value: 'installment', label: 'Parcelado' },
                  { value: 'mixed', label: 'Misto' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    className={`flex-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-all border ${
                      paymentMode === opt.value
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                        : 'bg-muted/30 border-transparent text-muted-foreground hover:bg-muted/50'
                    }`}
                    onClick={() => setPaymentMode(opt.value as any)}
                    type="button"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── INSTALLMENT OPTIONS ── */}
            {paymentMode !== 'upfront' && (
              <div className="border rounded-xl p-3 space-y-2.5 bg-muted/10 animate-in slide-in-from-top-1 fade-in duration-200">
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Tipo</label>
                  <Select value={paymentOrigin} onValueChange={(v) => setPaymentOrigin(v as any)}>
                    <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="credit_card_installment">Crédito Parcelado</SelectItem>
                      <SelectItem value="store_credit">A Prazo / Boca a Boca</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Parcelas</label>
                    <Select value={String(installmentCount)} onValueChange={(v) => setInstallmentCount(Number(v))}>
                      <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[2,3,4,5,6,7,8,9,10,11,12].map(n => (
                          <SelectItem key={n} value={String(n)}>{n}x</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">1º Vencimento</label>
                    <Input type="date" className="h-8 text-xs mt-1" value={firstDueDate} onChange={(e) => setFirstDueDate(e.target.value)} />
                  </div>
                </div>

                {paymentMode === 'mixed' && (
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Valor de Entrada (R$)</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      className="h-8 text-xs mt-1"
                      value={upfrontPayAmount || ''}
                      onChange={(e) => setUpfrontPayAmount(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                )}

                {paymentOrigin === 'store_credit' && (
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <FileText className="h-3 w-3" /> Observação / Motivo *
                    </label>
                    <Input
                      placeholder="Ex: Pagamento quinzenal combinado"
                      className="h-8 text-xs mt-1"
                      value={installmentNotes}
                      onChange={(e) => setInstallmentNotes(e.target.value)}
                    />
                  </div>
                )}

                {/* Preview parcelas */}
                {total > 0 && firstDueDate && (
                  <div className="bg-background border rounded-lg p-2.5">
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" /> Preview das Parcelas
                    </div>
                    {(() => {
                      const receivableAmount = paymentMode === 'mixed' ? Math.max(0, total - upfrontPayAmount) : total
                      if (receivableAmount <= 0) return <div className="text-xs text-muted-foreground">Valor de entrada cobre o total.</div>
                      const schedule = generateInstallmentSchedule(receivableAmount, installmentCount, firstDueDate)
                      return (
                        <div className="space-y-0.5">
                          {paymentMode === 'mixed' && upfrontPayAmount > 0 && (
                            <div className="flex justify-between text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                              <span>Entrada (à vista)</span>
                              <span>R$ {upfrontPayAmount.toFixed(2)}</span>
                            </div>
                          )}
                          {schedule.map((s) => (
                            <div key={s.installment_number} className="flex justify-between text-[11px] text-muted-foreground">
                              <span>{s.installment_number}/{s.total_installments} — {new Date(s.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                              <span className="font-medium">R$ {s.amount.toFixed(2)}</span>
                            </div>
                          ))}
                          <div className="flex justify-between text-[11px] font-bold border-t pt-1 mt-1">
                            <span>Total A Receber</span>
                            <span className="text-amber-500">R$ {receivableAmount.toFixed(2)}</span>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>
            )}

            <Button 
              className="pos-cta-button" 
              disabled={!isValid || isProcessing}
              onClick={onSubmit}
            >
               {isProcessing ? "Processando..." : paymentMode === 'upfront' ? "Finalizar Venda" : "Finalizar Venda Parcelada"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
