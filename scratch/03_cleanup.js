const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE credentials")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function run() {
  const idsToDelete = [
    '7049463f-a24a-45a1-ab25-9f4233161f37', // Fulano Silva (iazada123@gmail.com)
    '739ea591-7d13-4b33-8a5d-716e27034c08', // Código Manus (codigomanus0@gmail.com)
    '493da55c-8453-46b7-9cbc-a2fa54e87bbc', // Cheap Pods (cheappods0@gmail.com)
    '0c5c4115-d3a0-489e-850b-fb4a7ba73d58', // Teste Teste1 (testestes464011@gmail.com)
    '9f768b84-ec98-47dd-b393-60c5b4a071f8', // Manus Manus IA (manusm979@gmail.com)
    'e6a0e715-8c14-43b2-ba74-e6566503a208', // antonyy silva (antonyysilva1212@gmail.com)
    'c99f2714-4430-48b1-8def-cc09f8f34b78', // Antony Granconato Leonel (inovacoesaz@gmail.com)
    '780dad8c-427a-414f-b054-6abd6e9cef63', // Antony Granconato Leonel (marianaitoka@gmail.com)
    '84a151ab-bdeb-4e28-86d7-2d15cf7ee40e'  // Fulano (luzesdaaurora@gmail.com)
  ]

  console.log(`Deletando ${idsToDelete.length} perfis corrompidos...`)
  
  const { error } = await supabase
    .from('user_profiles')
    .delete()
    .in('id', idsToDelete)
    
  if (error) {
    console.error("Erro ao deletar:", error)
  } else {
    console.log("Deleção concluída com sucesso! Esses usuários agora são apenas clientes.")
  }
}

run()
