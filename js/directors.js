// TULIPA · diretores/coordenadores setoriais — bios ricas em profiles
// Usado pelas LPs setoriais (anon) e pelo admin Membros.

import { supabase } from './supabase.js';

// Lista diretores visíveis dum setor (pra LP setor)
export async function listDirectorsBySector(sector) {
  const { data, error } = await supabase
    .from('directors_public')
    .select('*')
    .eq('sector', sector)
    .eq('is_director_visible', true)
    .order('role', { ascending: true })
    .order('display_name', { ascending: true });
  return { data: data || [], error };
}

// Update do próprio profile (campos de bio) — usa policy "profiles: update self"
export async function updateMyProfileBio(patch) {
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp?.user) return { error: new Error('Não autenticado') };
  const allowed = ['display_name', 'avatar_url', 'bio_md', 'instagram', 'social_links', 'is_director_visible'];
  const payload = {};
  for (const k of allowed) if (k in patch) payload[k] = patch[k];
  const { data, error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('user_id', userResp.user.id)
    .select()
    .single();
  return { data, error };
}

// Admin atualiza bio de qualquer usuário via RPC
export async function updateUserProfileBio(targetUserId, patch) {
  const { error } = await supabase.rpc('update_user_profile_bio', {
    p_target_user: targetUserId,
    p_display_name: patch.display_name ?? null,
    p_avatar_url: patch.avatar_url ?? null,
    p_bio_md: patch.bio_md ?? null,
    p_instagram: patch.instagram ?? null,
    p_social_links: patch.social_links ?? null,
    p_is_director_visible: patch.is_director_visible ?? null,
  });
  return { error };
}

// Upload de avatar pro bucket bio-assets
export async function uploadDirectorAvatar(userId, file) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `directors/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from('bio-assets')
    .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });
  if (error) return { url: null, error };
  const { data: pub } = supabase.storage.from('bio-assets').getPublicUrl(path);
  return { url: pub.publicUrl, error: null };
}
