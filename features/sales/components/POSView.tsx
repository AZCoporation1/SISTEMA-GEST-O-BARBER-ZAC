"use client"

import { useState, useMemo } from "react"
import { usePOSDependencies, usePOSMutations } from "../hooks/useSales"
import { useInventory } from "@/features/inventory/hooks/useInventory"
import { useServices } from "@/features/services/hooks/useServices"
import { CartItem } from "../types"
import { SaleFormValues } from "../validators"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { ShoppingCart, Plus, Minus, Trash2, Tag, User, Search, MapPin, Package, AlertCircle } from "lucide-react"

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

    const payload: SaleFormValues = {
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
      }))
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
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Ponto de Venda</h1>
          <p className="page-subtitle">Processamento de vendas, produtos e serviços (PDV).</p>
        </div>
      </div>

      {/* Stock Warning */}
      {stockWarning && (
        <div className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-600 dark:text-amber-400 animate-in slide-in-from-top-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <p className="text-sm font-medium">{stockWarning}</p>
        </div>
      )}

      <div className="pos-grid-container flex flex-col xl:flex-row gap-6 items-start xl:h-[calc(100vh-180px)]">
        
        {/* Left Panel - Selectors */}
        <div className="pos-panel w-full xl:w-2/3 space-y-4 flex flex-col xl:h-full overflow-hidden">
          
          <div className="section-card flex-shrink-0">
            <div className="section-card-header">
              <h3 className="section-card-title">Inserir Rápido</h3>
            </div>
            <div className="section-card-body">
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="flex-1 w-full text-left">
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">Serviço</label>
                  <Select value={selectedServiceId} onValueChange={handleServiceSelection}>
                    <SelectTrigger className="h-9 w-full bg-background">
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
                      className="h-9 w-full"
                    />
                  </div>
                )}
                <div className="w-full sm:w-32 text-left">
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">Valor (R$)</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={servicePriceInput || ""}
                    onChange={e => setServicePriceInput(parseFloat(e.target.value) || 0)}
                    className="h-9 w-full"
                  />
                </div>
                <Button onClick={handleAddService} variant="outline" className="w-full sm:w-auto h-9 hover:border-emerald-500 hover:text-emerald-500 transition-colors">
                  <Plus className="h-4 w-4 mr-1" /> Adicionar
                </Button>
              </div>
            </div>
          </div>

          <div className="section-card flex-1 flex flex-col overflow-hidden">
            <div className="section-card-header flex items-center justify-between">
              <h3 className="section-card-title flex items-center gap-2">
                <Package className="h-4 w-4 text-emerald-500" />
                Catálogo de Produtos
              </h3>
            </div>
            <div className="p-4 border-b">
               <div className="relative w-full max-w-sm">
                 <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                 <Input
                   placeholder="Buscar por nome ou código..."
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                   className="pl-8"
                 />
               </div>
            </div>
            <div className="section-card-body overflow-y-auto bg-muted/5 p-4">
              {isInventoryLoading ? (
                <div className="h-32 flex items-center justify-center text-muted-foreground">Carregando catálogo...</div>
              ) : filteredProducts.length === 0 ? (
                 <div className="empty-state py-8">
                   <Package className="empty-state-icon w-12 h-12" />
                   <h3 className="empty-state-title text-sm">
                     {searchQuery ? "Nenhum produto encontrado" : "Nenhum produto em estoque"}
                   </h3>
                   {searchQuery && <p className="empty-state-description text-xs">Tente buscar por outro nome ou código.</p>}
                 </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filteredProducts.map((p: any) => {
                    const balance = p.current_balance || 0
                    const isOutOfStock = balance <= 0
                    return (
                      <div 
                        key={p.product_id} 
                        onClick={() => !isOutOfStock && handleAddProduct(p.product_id!)}
                        className={`border rounded-xl p-3 flex flex-col justify-between min-h-[110px] transition-all ${
                          isOutOfStock 
                            ? 'opacity-50 cursor-not-allowed border-dashed' 
                            : 'cursor-pointer hover:border-emerald-500 hover:shadow-md bg-card active:scale-95'
                        }`}
                      >
                        <div>
                          {p.external_code && (
                            <span className="text-[9px] font-semibold tracking-wider text-[var(--accent)] font-mono bg-[var(--accent-subtle)] px-1 py-0.5 rounded mb-1 inline-block" style={{ letterSpacing: '0.06em' }}>
                              {p.external_code}
                            </span>
                          )}
                          <p className="font-semibold text-xs sm:text-sm line-clamp-2 leading-tight">{p.product_name}</p>
                          <p className={`text-[10px] mt-1 uppercase font-medium tracking-wider ${isOutOfStock ? 'text-red-500' : 'text-muted-foreground'}`}>
                            Est: {balance}
                          </p>
                        </div>
                        <p className="font-bold text-base sm:text-lg text-emerald-600 dark:text-emerald-400 mt-1">R$ {p.sale_price?.toFixed(2)}</p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel - Cart & Checkout */}
        <div className="pos-panel w-full xl:w-1/3 section-card flex flex-col xl:h-full overflow-hidden min-h-[500px]">
          <div className="section-card-header bg-emerald-950/20 border-b-emerald-900/30">
            <h3 className="section-card-title text-emerald-500 flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Carrinho Atual
              {cart.length > 0 && (
                <span className="ml-auto text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                  {cart.reduce((a, c) => a + c.quantity, 0)} itens
                </span>
              )}
            </h3>
          </div>

          <div className="p-4 space-y-3 border-b flex-shrink-0 bg-muted/10">
            <div className="flex items-center gap-2 bg-background p-2 rounded-lg border">
              <User className="h-4 w-4 text-muted-foreground ml-2" />
              <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                <SelectTrigger className="border-0 bg-transparent shrink focus:ring-0 text-sm h-8">
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
              <div className="flex items-center gap-2 bg-background p-2 rounded-lg border animate-in slide-in-from-top-1 fade-in duration-200">
                <User className="h-4 w-4 text-muted-foreground ml-2 opacity-50" />
                <Input
                  placeholder="Nome do cliente avulso (Opcional)"
                  value={customerNameOverride}
                  onChange={e => setCustomerNameOverride(e.target.value)}
                  className="border-0 bg-transparent shrink focus-visible:ring-0 text-sm h-8 px-3 shadow-none"
                />
              </div>
            )}

            <div className="flex items-center gap-2 bg-background p-2 rounded-lg border">
              <MapPin className="h-4 w-4 text-muted-foreground ml-2" />
              <Select value={selectedCollaborator} onValueChange={setSelectedCollaborator}>
                <SelectTrigger className="border-0 bg-transparent shrink focus:ring-0 text-sm h-8">
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

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.length === 0 ? (
              <div className="empty-state h-full justify-center opacity-70">
                <ShoppingCart className="empty-state-icon" />
                <p className="empty-state-title">O carrinho está vazio</p>
                <p className="empty-state-description">Selecione produtos ou serviços no painel ao lado.</p>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.id} className="flex justify-between items-center p-3 border rounded-lg bg-card shadow-sm">
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="font-semibold text-sm truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      R$ {item.unitPrice.toFixed(2)}
                      {item.type === 'product' && (
                        <span className="ml-2 text-[10px] opacity-60">
                          (est: {safeInventory.find((p: any) => p.product_id === item.productId)?.current_balance || 0})
                        </span>
                      )}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <div className="flex items-center bg-muted rounded-md border h-8">
                      <Button variant="ghost" size="icon" className="h-full w-7 rounded-none hover:bg-background" onClick={() => updateQuantity(item.id, -1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-6 text-center text-xs font-bold">{item.quantity}</span>
                      <Button variant="ghost" size="icon" className="h-full w-7 rounded-none hover:bg-background" onClick={() => updateQuantity(item.id, 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => removeItem(item.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Totals & Actions */}
          <div className="p-4 bg-muted/10 border-t space-y-4 flex-shrink-0">
            <div className="space-y-2">
              <div className="flex justify-between text-sm font-medium text-muted-foreground">
                <span>Subtotal</span>
                <span>R$ {subtotal.toFixed(2)}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Tag className="h-3.5 w-3.5" /> Desconto (R$)
                </span>
                <Input 
                  type="number" 
                  min="0" 
                  className="w-24 h-8 text-right font-medium" 
                  value={discountAmount || ''}
                  onChange={e => setDiscountAmount(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="flex justify-between items-end border-t pt-4">
              <span className="font-semibold text-muted-foreground uppercase tracking-wider text-xs">Total a Pagar</span>
              <span className="text-3xl font-bold tracking-tight text-emerald-500">
                R$ {total.toFixed(2)}
              </span>
            </div>

            <Select value={paymentMethodId} onValueChange={setPaymentMethodId}>
              <SelectTrigger className="h-12 border-2 focus:ring-emerald-500/20 data-[state=open]:border-emerald-500">
                <SelectValue placeholder="Selecione a Forma de Pagamento*" />
              </SelectTrigger>
              <SelectContent>
                {(paymentMethods || []).filter((pm: any) => pm.id).map((pm: any) => (
                  <SelectItem key={pm.id} value={pm.id}>{pm.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button 
              className="w-full h-14 text-base font-bold uppercase tracking-wide btn-gold shadow-lg shadow-emerald-900/20" 
              disabled={!isValid || isProcessing}
              onClick={onSubmit}
            >
               {isProcessing ? "Processando..." : "Finalizar Venda"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
