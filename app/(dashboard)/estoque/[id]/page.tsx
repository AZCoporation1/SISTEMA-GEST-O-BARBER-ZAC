import { createServerClient } from '@/lib/supabase/server'
import ProductForm from '@/components/modules/estoque/ProductForm'
import { notFound } from 'next/navigation'

export default async function EditarProdutoPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerClient()
  const resolvedParams = await params
  
  const { data: categories, error: errorC } = await supabase.from('categories').select('id, name').order('name')
  const { data: product, error } = await supabase.from('products').select('*').eq('id', resolvedParams.id as string).single()

  if (error || !product) {
    notFound()
  }

  return (
    <ProductForm 
      initialData={product as any} 
      categories={categories || []} 
    />
  )
}
