import { createClient } from "@supabase/supabase-js"
import * as XLSX from "xlsx"
import * as fs from "fs"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function runImport() {
  const filePath = process.argv[2]
  if (!filePath) {
    console.error("Forneça o caminho do arquivo excel. Exemplo: npx tsx --env-file=.env.local scripts/import_customers_cli.ts path/to/file.xlsx")
    process.exit(1)
  }

  console.log(`Lendo arquivo: ${filePath}`)
  const wb = XLSX.readFile(filePath)
  const wsname = wb.SheetNames[0]
  const ws = wb.Sheets[wsname]
  const records = XLSX.utils.sheet_to_json(ws, { defval: "" })

  console.log(`Encontrados ${records.length} registros na planilha. Importando...`)

  let imported = 0
  let updated = 0
  let skipped = 0

  for (const record of records as any[]) {
    const rawFullName = record['Nome'] || record['nome'] || record['Nome Completo'] || 'Sem Nome'
    const normalizedName = rawFullName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
    const mobile_phone = record['Celular']?.toString().replace(/\D/g, '') || null
    const cpf = record['CPF']?.toString().replace(/\D/g, '') || null
    const email = record['Email']?.toString().toLowerCase().trim() || record['e-mail']?.toString().toLowerCase().trim() || null

    const getSafeDate = (d: any) => {
      if (!d) return null
      const val = new Date(d)
      return isNaN(val.getTime()) ? null : val.toISOString()
    }

    const payload = {
      full_name: rawFullName,
      normalized_name: normalizedName,
      mobile_phone,
      email,
      cpf,
      birth_date: getSafeDate(record['Data Nascimento'] || record['Nascimento'] || record['Aniversario']),
      address_line: record['Endereço'] || record['endereco'] || null,
      address_number: record['Número'] || record['numero'] || null,
      complement: record['Complemento'] || record['complemento'] || null,
      neighborhood: record['Bairro'] || record['bairro'] || null,
      city: record['Cidade'] || record['cidade'] || null,
      state: record['Estado'] || record['UF'] || record['uf'] || null,
      postal_code: record['CEP']?.toString().replace(/\D/g, '') || null,
      referral_source: record['ComoSoube'] || record['origem'] || null,
      legacy_login: record['Login'] || record['login'] || null,
      notes: record['Observação'] || record['obs'] || null,
      is_active: true
    }

    // Deduplication
    let matchQuery: any = supabase.from("customers").select("id").limit(1)

    if (cpf) {
      matchQuery = matchQuery.eq("cpf", cpf)
    } else if (mobile_phone && mobile_phone.length >= 10) {
      matchQuery = matchQuery.eq("mobile_phone", mobile_phone)
    } else if (email) {
      matchQuery = matchQuery.eq("email", email)
    } else {
      matchQuery = matchQuery.eq("normalized_name", normalizedName)
      if (mobile_phone) {
         matchQuery = matchQuery.eq("mobile_phone", mobile_phone)
      }
    }

    const { data: existingMatch, error: matchError } = await matchQuery

    if (matchError) {
      console.error(`Erro ao checar cliente ${rawFullName}:`, matchError.message)
      skipped++
      continue
    }

    if (existingMatch && existingMatch.length > 0) {
      const targetId = existingMatch[0].id
      const { error: updateError } = await (supabase as any).from("customers").update(payload).eq("id", targetId)
      if (!updateError) {
        updated++
      } else {
        console.error(`Erro ao atualizar cliente ${rawFullName}:`, updateError.message)
        skipped++
      }
    } else {
      const { error: insertError } = await (supabase as any).from("customers").insert(payload)
      if (!insertError) {
        imported++
      } else {
        console.error(`Erro ao inserir cliente ${rawFullName}:`, insertError.message)
        skipped++
      }
    }
  }

  console.log('---')
  console.log(`FINALIZADO:`)
  console.log(`🟢 Inseridos: ${imported}`)
  console.log(`🟡 Atualizados: ${updated}`)
  console.log(`🔴 Ignorados/Com Erro: ${skipped}`)
}

runImport().catch(console.error)
