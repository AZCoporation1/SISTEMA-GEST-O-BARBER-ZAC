import { createServerClient } from '@/lib/supabase/server'
import ProductForm from '@/components/modules/estoque/ProductForm'

export default async function NovoProdutoPage() {
  const supabase = await createServerClient()
  
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .order('name')

  return (
    <ProductForm categories={categories || []} />
  )
}
