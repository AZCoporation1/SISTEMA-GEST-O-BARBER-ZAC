"use client"

import { useState } from "react"
import { usePOSDependencies, usePOSMutations } from "../hooks/useSales"
import { useInventory } from "@/features/inventory/hooks/useInventory"
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
import { ShoppingCart, Plus, Minus, Trash2, Tag, User, Search, MapPin, Package } from "lucide-react"
import { FilterBar } from "@/components/ui/filter-bar"

export function POSView() {
  const [cart, setCart] = useState<CartItem[]>([])
  const [discountAmount, setDiscountAmount] = useState(0)
  const [selectedCustomer, setSelectedCustomer] = useState<string>("")
  const [selectedCollaborator, setSelectedCollaborator] = useState<string>("")
  const [paymentMethodId, setPaymentMethodId] = useState<string>("")
  const [notes, setNotes] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  
  // Data hooks
  const { data: inventoryData, isLoading: isInventoryLoading } = useInventory({ page: 1, perPage: 1000, status: "active", search: searchQuery })
  const { customers, collaborators, paymentMethods, isLoading } = usePOSDependencies()
  const { processSale, isProcessing } = usePOSMutations()

  // Computed
  const subtotal = cart.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0)
  const total = Math.max(0, subtotal - discountAmount)
  const isValid = cart.length > 0 && paymentMethodId !== ""

  const safeInventory = inventoryData?.data || []

  const handleAddProduct = (productId: string) => {
    const product = safeInventory.find(p => p.product_id === productId)
    if (!product) return

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
        discount: 0
      }]
    })
  }

  // MVP Simple Service addition
  const handleAddServiceMock = () => {
    setCart(prev => [...prev, {
      id: `srv-${Date.now()}`,
      type: 'service',
      name: 'Serviço Avulso',
      quantity: 1,
      unitPrice: 50.00,
      unitCost: 0,
       discount: 0
    }])
  }

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQ = Math.max(1, item.quantity + delta)
        return { ...item, quantity: newQ }
      }
      return item
    }))
  }

  const removeItem = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id))
  }

  const onSubmit = async () => {
    if (!isValid) return

    const payload: SaleFormValues = {
      customer_id: selectedCustomer || null,
      collaborator_id: selectedCollaborator || null,
      payment_method_id: paymentMethodId,
      discount_amount: discountAmount,
      notes,
      items: cart.map(c => ({
        id: c.id,
        type: c.type,
        productId: c.productId,
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
    setSelectedCollaborator("")
    setPaymentMethodId("")
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Ponto de Venda</h1>
          <p className="page-subtitle">Processamento de vendas, produtos e serviços (PDV).</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start h-[calc(100vh-180px)]">
        
        {/* Left Panel - Selectors */}
        <div className="xl:col-span-8 space-y-4 flex flex-col h-full overflow-hidden">
          
          <div className="section-card flex-shrink-0">
            <div className="section-card-header">
              <h3 className="section-card-title">Inserir Rápido</h3>
            </div>
            <div className="section-card-body">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Button onClick={handleAddServiceMock} variant="outline" className="h-20 flex flex-col gap-2 hover:border-emerald-500 hover:text-emerald-500 transition-colors">
                  <Plus className="h-5 w-5" />
                  <span className="text-xs font-semibold">Serviço Avulso</span>
                </Button>
                {/* Future: map real services here */}
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
                    placeholder="Buscar produto por nome..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
            </div>
            <div className="section-card-body overflow-y-auto bg-muted/5">
              {isInventoryLoading ? (
                <div className="h-32 flex items-center justify-center text-muted-foreground">Carregando catálogo...</div>
              ) : safeInventory.length === 0 ? (
                 <div className="empty-state py-8">
                   <Package className="empty-state-icon w-12 h-12" />
                   <h3 className="empty-state-title text-sm">Nenhum produto em estoque</h3>
                 </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                  {safeInventory.map((p: any) => (
                    <div 
                      key={p.product_id} 
                      onClick={() => handleAddProduct(p.product_id!)}
                      className="border rounded-xl p-4 cursor-pointer hover:border-emerald-500 hover:shadow-md transition-all bg-card flex flex-col justify-between min-h-[120px]"
                    >
                      <div>
                        <p className="font-semibold text-sm line-clamp-2 leading-tight">{p.product_name}</p>
                        <p className="text-[11px] text-muted-foreground mt-1.5 uppercase font-medium tracking-wider">Estoque: {p.current_balance}</p>
                      </div>
                      <p className="font-bold text-lg text-emerald-600 dark:text-emerald-400 mt-2">R$ {p.sale_price?.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel - Cart & Checkout */}
        <div className="xl:col-span-4 section-card flex flex-col h-full overflow-hidden">
          <div className="section-card-header bg-emerald-950/20 border-b-emerald-900/30">
            <h3 className="section-card-title text-emerald-500 flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Carrinho Atual
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
                  {customers.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 bg-background p-2 rounded-lg border">
              <MapPin className="h-4 w-4 text-muted-foreground ml-2" />
              <Select value={selectedCollaborator} onValueChange={setSelectedCollaborator}>
                <SelectTrigger className="border-0 bg-transparent shrink focus:ring-0 text-sm h-8">
                  <SelectValue placeholder="Atendente / Barbeiro (Opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem vínculo</SelectItem>
                  {collaborators.map((c: any) => (
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
                    <p className="text-xs text-muted-foreground mt-0.5">R$ {item.unitPrice.toFixed(2)}</p>
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
                {paymentMethods.map((pm: any) => (
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
