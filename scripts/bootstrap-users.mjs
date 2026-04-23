/**
 * Barber Zac ERP — Bootstrap Users Script
 * 
 * SERVER-SIDE ONLY — never import this in frontend code.
 * Uses SUPABASE_SERVICE_ROLE_KEY to create users via auth.admin API.
 * 
 * Usage:
 *   node scripts/bootstrap-users.mjs
 * 
 * Requirements:
 *   - NEXT_PUBLIC_SUPABASE_URL set in environment or .env.local
 *   - SUPABASE_SERVICE_ROLE_KEY set in environment or .env.local
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load .env.local if exists
try {
  const envPath = resolve(process.cwd(), '.env.local')
  const envContent = readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=')
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').trim().replace(/^['"]|['"]$/g, '')
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = value
      }
    }
  })
} catch {}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// ═══════════════════════════════════════════════════════════════
// USER DEFINITIONS (passwords are ONLY used here, server-side)
// ═══════════════════════════════════════════════════════════════

const USERS = [
  {
    email: 'Fabiodasilva2026@outlook.com',
    password: 'BZ@Fabio2026!',
    fullName: 'Fabio Santana',
    displayName: 'Fabio',
    systemRole: 'admin_total',
    collaboratorName: null, // Not a professional
    permissions: {
      can_approve_professional_requests: true,
      can_view_all_professionals: true,
      can_manage_system: true,
      can_submit_professional_requests: false,
    }
  },
  {
    email: 'granconatoleonela@gmail.com',
    password: 'BZ@Antony2026!',
    fullName: 'Antony',
    displayName: 'Antony',
    systemRole: 'admin_total',
    collaboratorName: null,
    permissions: {
      can_approve_professional_requests: true,
      can_view_all_professionals: true,
      can_manage_system: true,
      can_submit_professional_requests: false,
    }
  },
  {
    email: 'lucaszaquiel123@gmail.com',
    password: 'BZ@Lucas2026!',
    fullName: 'Lucas Zaquiel',
    displayName: 'Lucas',
    systemRole: 'owner_admin_professional',
    collaboratorName: 'Lucas',
    permissions: {
      can_approve_professional_requests: true,
      can_view_all_professionals: true,
      can_manage_system: true,
      can_submit_professional_requests: true,
    }
  },
  {
    email: 'mateus.santos.ap123@gmail.com',
    password: 'BZ@Matheus2026!',
    fullName: 'Matheus Gulu',
    displayName: 'Matheus',
    systemRole: 'professional',
    collaboratorName: 'Matheus',
    permissions: {
      can_approve_professional_requests: false,
      can_view_all_professionals: false,
      can_manage_system: false,
      can_submit_professional_requests: true,
    }
  },
  {
    email: 'gustagaldino@gmail.com',
    password: 'BZ@Gustavo2026!',
    fullName: 'Gustavo (Guh)',
    displayName: 'Gustavo',
    systemRole: 'professional',
    collaboratorName: 'Gustavo',
    permissions: {
      can_approve_professional_requests: false,
      can_view_all_professionals: false,
      can_manage_system: false,
      can_submit_professional_requests: true,
    }
  },
]

// ═══════════════════════════════════════════════════════════════
// MAIN EXECUTION
// ═══════════════════════════════════════════════════════════════

async function findCollaborator(name) {
  if (!name) return null
  
  const { data } = await supabase
    .from('collaborators')
    .select('id, name, display_name')
    .or(`name.ilike.%${name}%,display_name.ilike.%${name}%`)
    .limit(1)
    .single()
  
  return data?.id || null
}

async function bootstrapUser(userDef) {
  console.log(`\n━━━ Processing: ${userDef.fullName} (${userDef.email}) ━━━`)
  
  // 1. Check if auth user already exists
  const { data: existingUsers } = await supabase.auth.admin.listUsers()
  const existingAuth = existingUsers?.users?.find(u => u.email?.toLowerCase() === userDef.email.toLowerCase())
  
  let authUserId
  
  if (existingAuth) {
    console.log(`  ✅ Auth user already exists: ${existingAuth.id}`)
    authUserId = existingAuth.id
  } else {
    // Create auth user
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: userDef.email,
      password: userDef.password,
      email_confirm: true,
      user_metadata: {
        full_name: userDef.fullName,
        system_role: userDef.systemRole,
      }
    })
    
    if (createError) {
      console.error(`  ❌ Failed to create auth user:`, createError.message)
      return false
    }
    
    console.log(`  ✅ Auth user created: ${newUser.user.id}`)
    authUserId = newUser.user.id
  }
  
  // 2. Find collaborator if applicable
  let collaboratorId = null
  if (userDef.collaboratorName) {
    collaboratorId = await findCollaborator(userDef.collaboratorName)
    if (collaboratorId) {
      console.log(`  ✅ Linked to collaborator: ${userDef.collaboratorName} (${collaboratorId})`)
    } else {
      console.log(`  ⚠️ Collaborator "${userDef.collaboratorName}" not found — will need manual linking`)
    }
  }
  
  // 3. Update or create user_profiles
  // First check if profile exists
  const { data: existingProfile } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('auth_user_id', authUserId)
    .single()
  
  const profileData = {
    system_role: userDef.systemRole,
    display_name: userDef.displayName,
    collaborator_id: collaboratorId,
    ...userDef.permissions,
  }
  
  if (existingProfile) {
    const { error: updateErr } = await supabase
      .from('user_profiles')
      .update(profileData)
      .eq('id', existingProfile.id)
    
    if (updateErr) {
      console.error(`  ❌ Failed to update profile:`, updateErr.message)
      return false
    }
    console.log(`  ✅ Profile updated`)
  } else {
    // The trigger should have created the profile, but let's wait and retry
    console.log(`  ⏳ Waiting for trigger to create profile...`)
    await new Promise(r => setTimeout(r, 2000))
    
    const { data: retryProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('auth_user_id', authUserId)
      .single()
    
    if (retryProfile) {
      const { error: updateErr } = await supabase
        .from('user_profiles')
        .update(profileData)
        .eq('id', retryProfile.id)
      
      if (updateErr) {
        console.error(`  ❌ Failed to update profile:`, updateErr.message)
        return false
      }
      console.log(`  ✅ Profile updated (after trigger)`)
    } else {
      console.error(`  ❌ Profile not found — trigger may not have fired`)
      return false
    }
  }
  
  console.log(`  ✅ Role: ${userDef.systemRole}`)
  return true
}

async function main() {
  console.log('╔══════════════════════════════════════════╗')
  console.log('║   Barber Zac — Bootstrap Users Script    ║')
  console.log('╚══════════════════════════════════════════╝')
  console.log(`\nSupabase: ${supabaseUrl}`)
  console.log(`Users to bootstrap: ${USERS.length}`)
  
  let success = 0
  let failed = 0
  
  for (const userDef of USERS) {
    const ok = await bootstrapUser(userDef)
    if (ok) success++
    else failed++
  }
  
  console.log('\n╔══════════════════════════════════════════╗')
  console.log(`║  Results: ${success} OK, ${failed} Failed               ║`)
  console.log('╚══════════════════════════════════════════╝')
  
  if (failed > 0) {
    process.exit(1)
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
