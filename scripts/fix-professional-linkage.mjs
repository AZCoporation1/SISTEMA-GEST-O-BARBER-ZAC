/**
 * Barber Zac — Professional Linkage Diagnostic & Fix
 * 
 * This script:
 * 1. Lists all user_profiles with their collaborator_id
 * 2. Lists all collaborators
 * 3. Checks if the 3 target professionals are correctly linked
 * 4. Fixes any missing links (idempotent — won't duplicate)
 * 
 * Run: node scripts/fix-professional-linkage.mjs
 */

const SUPABASE_URL = "https://gyausvxjrpkheennijiv.supabase.co"
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5YXVzdnhqcnBraGVlbm5paml2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzM2MjM0MiwiZXhwIjoyMDg4OTM4MzQyfQ.YXftgRA-zScwy391X-T87gNzbLS2ABZZVKSMyGdQLMY"

const headers = {
  "apikey": SUPABASE_SERVICE_KEY,
  "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
  "Content-Type": "application/json",
  "Prefer": "return=representation",
}

async function query(table, params = "") {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, { headers })
  if (!res.ok) throw new Error(`Query ${table} failed: ${res.status} ${await res.text()}`)
  return res.json()
}

async function patch(table, matchCol, matchVal, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${matchCol}=eq.${encodeURIComponent(matchVal)}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`Patch ${table} failed: ${res.status} ${await res.text()}`)
  return res.json()
}

// ── Target professionals ──
const TARGETS = [
  { email: "mateus.santos.ap123@gmail.com", displayName: "Matheus/Gulu", collabSearch: ["gulu", "matheus", "mateus"] },
  { email: "gustagaldino@gmail.com", displayName: "Gustavo/GuhSP", collabSearch: ["guh", "gustavo"] },
  { email: "lucaszaquiel123@gmail.com", displayName: "Lucas/Zac", collabSearch: ["zac", "lucas", "zaquiel"] },
]

async function main() {
  console.log("═══════════════════════════════════════════")
  console.log("  Barber Zac — Professional Linkage Check")
  console.log("═══════════════════════════════════════════\n")

  // 1. Fetch all collaborators
  const collaborators = await query("collaborators", "select=id,name,display_name,role,is_active&order=name.asc")
  console.log(`📋 Collaborators found: ${collaborators.length}`)
  collaborators.forEach(c => console.log(`   • ${c.name} (${c.display_name || '-'}) [${c.role}] id=${c.id}`))
  console.log()

  // 2. Fetch all user_profiles
  const profiles = await query("user_profiles", "select=id,email,full_name,system_role,collaborator_id,display_name&order=email.asc")
  console.log(`👤 User profiles found: ${profiles.length}`)
  profiles.forEach(p => console.log(`   • ${p.email} | ${p.full_name} | role=${p.system_role} | collab=${p.collaborator_id || 'NULL'}`))
  console.log()

  // 3. Check each target
  const fixes = []
  console.log("═══════════════════════════════════════════")
  console.log("  Linkage Check")
  console.log("═══════════════════════════════════════════\n")

  for (const target of TARGETS) {
    const profile = profiles.find(p => p.email === target.email)
    if (!profile) {
      console.log(`❌ ${target.displayName}: user_profile NOT FOUND (email: ${target.email})`)
      continue
    }

    console.log(`🔍 ${target.displayName} (${target.email}):`)
    console.log(`   Profile ID: ${profile.id}`)
    console.log(`   Role: ${profile.system_role}`)
    console.log(`   Current collaborator_id: ${profile.collaborator_id || 'NULL'}`)

    if (profile.collaborator_id) {
      const linkedCollab = collaborators.find(c => c.id === profile.collaborator_id)
      if (linkedCollab) {
        console.log(`   ✅ Linked to: ${linkedCollab.name} (${linkedCollab.display_name || '-'})`)
      } else {
        console.log(`   ⚠️  collaborator_id points to non-existent record!`)
      }
    } else {
      // Find matching collaborator
      const match = collaborators.find(c => {
        const name = (c.name || "").toLowerCase()
        const display = (c.display_name || "").toLowerCase()
        return target.collabSearch.some(s => name.includes(s) || display.includes(s))
      })

      if (match) {
        console.log(`   🔗 Match found: ${match.name} (${match.display_name || '-'}) id=${match.id}`)
        fixes.push({ profile, collab: match, target })
      } else {
        console.log(`   ❌ No matching collaborator found!`)
      }
    }
    console.log()
  }

  // 4. Apply fixes
  if (fixes.length === 0) {
    console.log("✅ All linkages are correct. No fixes needed.")
    return
  }

  console.log("═══════════════════════════════════════════")
  console.log(`  Applying ${fixes.length} fix(es)`)
  console.log("═══════════════════════════════════════════\n")

  for (const fix of fixes) {
    console.log(`🔧 Fixing: ${fix.target.displayName}`)
    console.log(`   BEFORE: collaborator_id = ${fix.profile.collaborator_id || 'NULL'}`)
    console.log(`   AFTER:  collaborator_id = ${fix.collab.id} (${fix.collab.name})`)

    try {
      await patch("user_profiles", "id", fix.profile.id, { collaborator_id: fix.collab.id })
      console.log(`   ✅ Updated successfully`)
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`)
    }
    console.log()
  }

  // 5. Verify
  console.log("═══════════════════════════════════════════")
  console.log("  Post-fix Verification")
  console.log("═══════════════════════════════════════════\n")

  const updatedProfiles = await query("user_profiles", `select=id,email,full_name,system_role,collaborator_id&email=in.(${TARGETS.map(t => `"${t.email}"`).join(",")})`)
  for (const p of updatedProfiles) {
    const collab = collaborators.find(c => c.id === p.collaborator_id)
    console.log(`${p.collaborator_id ? '✅' : '❌'} ${p.email} → ${collab ? collab.name : 'NULL'}`)
  }
}

main().catch(err => {
  console.error("Fatal error:", err)
  process.exit(1)
})
