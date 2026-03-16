'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createProduct, updateProduct } from '@/app/actions/estoque'
import { Save, X, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

type Category = { id: string; name: string }

export default function ProductForm({ 
  initialData, 
  categories 
}: { 
  initialData?: any,
  categories: Category[]
}) {
  const router = useRouter()
  const isEditing = !!initialData
  
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  
  // Local state for auto-calculation
  const [purchasePrice, setPurchasePrice] = useState<string>(initialData?.purchase_price?.toString() || '')
  const [markupPercent, setMarkupPercent] = useState<string>(initialData?.markup_percent?.toString() || '45')
  
  const pPrice = parseFloat(purchasePrice) || 0
  const mPercent = parseFloat(markupPercent) || 0
  const markupValue = (pPrice * mPercent) / 100
  const salePrice = pPrice + markupValue

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsPending(true)
    setError(null)
    
    const formData = new FormData(e.currentTarget)
    
    // We already have native form submission but we intercept to handle errors nicely
    let result
    if (isEditing) {
      result = await updateProduct(initialData.id, formData)
    } else {
      result = await createProduct(formData)
    }
    
    if (result?.error) {
      setError(result.error)
      setIsPending(false)
    }
  }

  return (
    <div className="form-container" style={{ maxWidth: 800, margin: '0 auto', padding: '24px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <Link 
          href="/estoque" 
          style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="page-title">{isEditing ? 'Editar Produto' : 'Novo Produto'}</h1>
          <p className="page-subtitle">{isEditing ? 'Atualize as informações do produto' : 'Cadastre um novo item no estoque'}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 24 }}>
        {error && (
          <div style={{ background: 'var(--danger-light, rgba(239, 68, 68, 0.1))', color: 'var(--danger)', padding: 12, borderRadius: 6, marginBottom: 20, fontSize: 13 }}>
            {error}
          </div>
        )}

        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
          Informações Básicas
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16, marginBottom: 24 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Código (SKU) *
            </label>
            <input 
              name="code" 
              defaultValue={initialData?.code || ''} 
              required 
              style={{ width: '100%', padding: '10px 12px', borderRadius: 6, background: '#0a0a0f', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 14 }}
              placeholder="Ex: 1_1"
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Descrição do Produto *
            </label>
            <input 
              name="description" 
              defaultValue={initialData?.description || ''} 
              required 
              style={{ width: '100%', padding: '10px 12px', borderRadius: 6, background: '#0a0a0f', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 14 }}
              placeholder="Nome do produto"
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Categoria
            </label>
            <select 
              name="category_id" 
              defaultValue={initialData?.category_id || ''} 
              style={{ width: '100%', padding: '10px 12px', borderRadius: 6, background: '#0a0a0f', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 14 }}
            >
              <option value="">Selecione uma categoria...</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Marca
            </label>
            <input 
              name="brand" 
              defaultValue={initialData?.brand || ''} 
              style={{ width: '100%', padding: '10px 12px', borderRadius: 6, background: '#0a0a0f', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 14 }}
              placeholder="Ex: Barber Zac"
            />
          </div>
        </div>

        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
          Valores e Precificação
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Preço de Custo (R$)
            </label>
            <input 
              name="purchase_price" 
              type="number"
              step="0.01"
              value={purchasePrice}
              onChange={e => setPurchasePrice(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 6, background: '#0a0a0f', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 14 }}
              placeholder="0.00"
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Markup (%)
            </label>
            <input 
              name="markup_percent" 
              type="number"
              step="0.01"
              value={markupPercent}
              onChange={e => setMarkupPercent(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 6, background: '#0a0a0f', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 14 }}
              placeholder="45"
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Lucro
            </label>
            <div style={{ width: '100%', padding: '10px 12px', borderRadius: 6, background: '#111118', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 14 }}>
              R$ {markupValue.toFixed(2)}
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Preço de Venda Final
            </label>
            <div style={{ width: '100%', padding: '10px 12px', borderRadius: 6, background: 'var(--accent-gold)', opacity: 0.1, position: 'absolute' }}></div>
            <div style={{ width: '100%', padding: '10px 12px', borderRadius: 6, background: 'rgba(201, 168, 76, 0.05)', border: '1px solid rgba(201, 168, 76, 0.3)', color: 'var(--accent-gold-light)', fontSize: 14, fontWeight: 600 }}>
              R$ {salePrice.toFixed(2)}
            </div>
          </div>
        </div>

        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
          Controle de Estoque
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Qtd. Atual (Saldo)
            </label>
            <div style={{ width: '100%', padding: '10px 12px', borderRadius: 6, background: '#111118', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 14 }}>
              {isEditing ? initialData.qty_current : '0 (Automático)'}
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Estoque Mínimo
            </label>
            <input 
              name="qty_min" 
              type="number"
              defaultValue={initialData?.qty_min || '0'} 
              style={{ width: '100%', padding: '10px 12px', borderRadius: 6, background: '#0a0a0f', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 14 }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Estoque Máximo
            </label>
            <input 
              name="qty_max" 
              type="number"
              defaultValue={initialData?.qty_max || '0'} 
              style={{ width: '100%', padding: '10px 12px', borderRadius: 6, background: '#0a0a0f', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 14 }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 40 }}>
          <Link 
            href="/estoque"
            style={{ padding: '10px 16px', borderRadius: 6, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', textDecoration: 'none' }}
          >
            <X size={16} /> Cancelar
          </Link>
          <button 
            type="submit"
            disabled={isPending}
            style={{ padding: '10px 16px', borderRadius: 6, background: 'var(--accent-gold)', border: 'none', color: '#1a1a28', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, cursor: isPending ? 'not-allowed' : 'pointer', opacity: isPending ? 0.7 : 1 }}
          >
            <Save size={16} /> {isPending ? 'Salvando...' : 'Salvar Produto'}
          </button>
        </div>
      </form>
    </div>
  )
}
