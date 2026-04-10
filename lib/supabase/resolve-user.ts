import { SupabaseClient } from "@supabase/supabase-js"

/**
 * Resolves the user_profiles.id for the given auth.users.id.
 * Returns null if not found (graceful degradation).
 * This is needed because several FK columns reference user_profiles(id),
 * not auth.users(id) directly.
 */
export async function resolveUserProfileId(
  supabase: SupabaseClient,
  authUserId: string | undefined | null
): Promise<string | null> {
  if (!authUserId) return null

  try {
    const { data } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("auth_user_id", authUserId)
      .single()

    return data?.id || null
  } catch {
    // Graceful: if profile doesn't exist, return null
    return null
  }
}
