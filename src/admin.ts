/**
 * Admin endpoints — user credential management (create user, reset password).
 * REQUIRES SUPABASE_SERVICE_KEY (service_role) — admin API only works server-side.
 * Mount in index.ts: app.use('/admin', adminRouter)
 */
import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { env } from './config.js';

export const adminRouter = Router();

function adminClient() {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
    throw new Error('SUPABASE_SERVICE_KEY no configurada — ver server/.env.example');
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
}

// POST /admin/users { email, password?, nombre, rol } — crea usuario Auth + perfil
adminRouter.post('/users', async (req, res) => {
  try {
    const { email, password, nombre, rol } = req.body ?? {};
    if (!email) { res.status(400).json({ error: 'email requerido' }); return; }
    const sb = adminClient();
    const { data, error } = await sb.auth.admin.createUser({
      email,
      password: password ?? undefined,           // si no se envía, se usa invitación
      email_confirm: Boolean(password),
    });
    if (error) throw error;
    if (nombre) {
      await sb.from('perfiles').insert({ auth_user_id: data.user.id, nombre, email, rol: rol ?? 'usuario' });
    }
    res.json({ ok: true, userId: data.user.id });
  } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

// POST /admin/reset { email } — envía correo de recuperación
adminRouter.post('/reset', async (req, res) => {
  try {
    const { email } = req.body ?? {};
    if (!email) { res.status(400).json({ error: 'email requerido' }); return; }
    const sb = adminClient();
    const { error } = await sb.auth.resetPasswordForEmail(email);
    if (error) throw error;
    res.json({ ok: true, message: `Correo de recuperación enviado a ${email}` });
  } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

// GET /admin/users — lista usuarios Auth con su perfil/rol
adminRouter.get('/users', async (_req, res) => {
  try {
    const sb = adminClient();
    const { data, error } = await sb.auth.admin.listUsers({ perPage: 100 });
    if (error) throw error;
    res.json({ users: data.users.map((u) => ({ id: u.id, email: u.email, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at })) });
  } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});
