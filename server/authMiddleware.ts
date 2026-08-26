import type { NextFunction, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

declare global {
  namespace Express {
    interface Request { authUserId?: string; }
  }
}

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Token de autenticação ausente.' });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ error: 'Sessão inválida ou expirada.' });

  req.authUserId = data.user.id;
  next();
}
