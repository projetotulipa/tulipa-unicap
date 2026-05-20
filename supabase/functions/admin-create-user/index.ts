// Edge Function: admin-create-user
// Permite que o admin (autenticado) crie outros usuários com email/senha,
// role e sector via UI do painel. Só admin pode chamar.
//
// Deploy: Supabase Dashboard → Edge Functions → New function → nome "admin-create-user"
// → cole este arquivo → Deploy. As env vars SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY e SUPABASE_ANON_KEY já vêm preenchidas
// automaticamente — não precisa configurar nada.

// deno-lint-ignore-file no-explicit-any

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, content-type, apikey',
};

const VALID_ROLES = ['pending', 'admin', 'coordinator', 'member'];
const VALID_SECTORS = [
  'presidencia', 'professor-orientador', 'professor-colaborador',
  'midia', 'pesquisa', 'tesouraria', 'secretaria', 'atividades',
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'use POST' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey     = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !serviceKey || !anonKey) {
      return json({ error: 'env não configurada na function' }, 500);
    }

    // 1. Verifica JWT do chamador
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'sem autorização' }, 401);
    const jwt = authHeader.replace(/^Bearer\s+/i, '');

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: callerData, error: callerErr } = await userClient.auth.getUser();
    if (callerErr || !callerData?.user) {
      return json({ error: 'token inválido' }, 401);
    }
    const callerId = callerData.user.id;

    // 2. Verifica que o chamador é admin
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: callerProfile, error: profErr } = await adminClient
      .from('profiles').select('role').eq('user_id', callerId).maybeSingle();
    if (profErr) return json({ error: profErr.message }, 500);
    if (!callerProfile || callerProfile.role !== 'admin') {
      return json({ error: 'apenas admin pode criar usuários' }, 403);
    }

    // 3. Parse body
    const body: any = await req.json().catch(() => ({}));
    const { email, password, display_name, role, sector, team } = body;

    if (!email || typeof email !== 'string') return json({ error: 'email obrigatório' }, 400);
    if (!password || typeof password !== 'string') return json({ error: 'senha obrigatória' }, 400);
    if (password.length < 8) return json({ error: 'senha precisa ter ao menos 8 caracteres' }, 400);
    if (role && !VALID_ROLES.includes(role)) return json({ error: `role inválida: ${role}` }, 400);
    if (sector && !VALID_SECTORS.includes(sector)) return json({ error: `setor inválido: ${sector}` }, 400);

    // 4. Cria a conta com email já confirmado
    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: display_name ? { display_name } : {},
    });
    if (createErr) {
      return json({ error: createErr.message || 'falha ao criar conta' }, 400);
    }
    const newUserId = created.user!.id;

    // 5. Espera o trigger handle_new_user criar o profile, então faz upsert
    await new Promise((r) => setTimeout(r, 150));

    const finalFields: any = {
      user_id: newUserId,
      display_name: display_name || null,
    };
    if (role) {
      finalFields.role = role;
      if (role === 'admin' || role === 'pending') {
        finalFields.sector = null;
        finalFields.team = null;
      } else if (role === 'coordinator') {
        finalFields.sector = sector || null;
        finalFields.team = null;
      } else if (role === 'member') {
        finalFields.sector = sector || null;
        finalFields.team = team || null;
      }
    }

    const { error: upErr } = await adminClient
      .from('profiles')
      .upsert(finalFields, { onConflict: 'user_id' });

    if (upErr) {
      // conta foi criada mas perfil falhou — devolve sucesso parcial
      return json({
        ok: true,
        partial: true,
        user_id: newUserId,
        warning: `conta criada mas perfil deu erro: ${upErr.message}. Acerte manualmente em Membros.`,
      }, 207);
    }

    return json({ ok: true, user_id: newUserId, email });
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
