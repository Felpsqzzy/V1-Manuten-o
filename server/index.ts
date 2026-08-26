import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const app = express();
const port = Number(process.env.PORT || 3000);
const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.warn('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configurados. O servidor sobe, mas operações de persistência ficam indisponíveis.');
}
const supabase = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(uploadDir));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = new Set([
      'image/jpeg','image/png','image/webp',
      'video/mp4','video/quicktime','video/webm',
      'application/pdf','text/plain','text/csv',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]);
    cb(null, allowed.has(file.mimetype));
  }
});

function fileType(mime: string): string {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime === 'application/pdf') return 'pdf';
  return 'document';
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'biotrop-api', time: new Date().toISOString() });
});

app.post('/api/materials', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado ou formato não suportado.' });
    const userId = String(req.body.user_id || '');
    if (!userId) return res.status(400).json({ error: 'user_id é obrigatório.' });

    const payload = {
      id: crypto.randomUUID(),
      user_id: userId,
      title: String(req.body.title || req.file.originalname),
      description: String(req.body.description || ''),
      category: String(req.body.category || 'Geral'),
      file_url: `/uploads/${req.file.filename}`,
      file_type: fileType(req.file.mimetype),
      file_mime: req.file.mimetype,
      file_size_bytes: req.file.size,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (supabase) {
      const { data, error } = await supabase.from('materials').insert(payload).select('*').single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json({ message: 'Material registrado com sucesso.', data });
    }

    return res.status(201).json({ message: 'Material recebido; banco ainda não configurado.', data: payload });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro inesperado.';
    return res.status(500).json({ error: message });
  }
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = err instanceof Error ? err.message : 'Erro interno.';
  res.status(500).json({ error: message });
});

app.listen(port, () => console.log(`BIOTROP API ouvindo em http://localhost:${port}`));
