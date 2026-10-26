import { Hono } from 'hono';
import { z } from 'zod';
import { and, eq, or } from 'drizzle-orm';
import { db } from '../db';
import { companies, users } from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { comparePassword, hashPassword, signToken } from '../lib/auth';

const authRoutes = new Hono();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const changePasswordSchema = z.object({
  password_saat_ini: z.string().min(6),
  password_baru: z.string().min(6),
  konfirmasi_password_baru: z.string().min(6),
});

const registerSchema = z.object({
  nama_lengkap: z.string().trim().min(2),
  nik: z.string().trim().min(4),
  email_kantor: z.string().trim().email(),
  kode_perusahaan: z.string().trim().min(3),
  departemen: z.string().trim().min(2),
  kata_sandi: z.string().min(8).regex(/^(?=.*[A-Za-z])(?=.*\d).*$/),
  konfirmasi_kata_sandi: z.string().min(8),
  persetujuan_syarat: z.boolean(),
}).passthrough();

authRoutes.post('/register', async (c) => {
  const body = await c.req.json().catch(() => null);

  if (!body || typeof body !== 'object') {
    return c.json({ success: false, message: 'Request body is required.', error_code: 'INVALID_REQUEST' }, 400);
  }

  const normalizedBody = {
    ...body,
    nama_lengkap: typeof body.nama_lengkap === 'string' ? body.nama_lengkap : body.name,
    nik: typeof body.nik === 'string' ? body.nik : body.nik_number,
    email_kantor: typeof body.email_kantor === 'string' ? body.email_kantor : body.email,
    kode_perusahaan: typeof body.kode_perusahaan === 'string' ? body.kode_perusahaan : body.company_code,
    departemen: typeof body.departemen === 'string' ? body.departemen : body.department,
    kata_sandi: typeof body.kata_sandi === 'string' ? body.kata_sandi : body.password,
    konfirmasi_kata_sandi: typeof body.konfirmasi_kata_sandi === 'string' ? body.konfirmasi_kata_sandi : body.confirm_password,
    persetujuan_syarat: body.persetujuan_syarat ?? body.terms_accepted ?? false,
  };

  const parsed = registerSchema.safeParse(normalizedBody);
  if (!parsed.success) {
    return c.json({
      success: false,
      message: 'Format data tidak valid. Mohon periksa kembali field yang Anda kirim.',
      error_code: 'VALIDATION_ERROR',
      details: parsed.error.flatten(),
    }, 400);
  }

  const {
    nama_lengkap,
    nik,
    email_kantor,
    kode_perusahaan,
    departemen,
    kata_sandi,
    konfirmasi_kata_sandi,
    persetujuan_syarat,
  } = parsed.data;

  if (kata_sandi !== konfirmasi_kata_sandi) {
    return c.json({
      success: false,
      message: 'Kata sandi dan konfirmasi kata sandi tidak sesuai.',
      error_code: 'PASSWORD_MISMATCH',
    }, 400);
  }

  if (persetujuan_syarat !== true) {
    return c.json({
      success: false,
      message: 'Anda harus menyetujui syarat dan ketentuan sebelum mendaftar.',
      error_code: 'TERMS_NOT_ACCEPTED',
    }, 400);
  }

  const companyList = await db.select().from(companies);
  const company = companyList.find((item) => item.company_code.toLowerCase() === kode_perusahaan.trim().toLowerCase() && item.is_active);

  if (!company) {
    return c.json({
      success: false,
      message: 'Kode perusahaan tidak valid. Silakan tanyakan kode perusahaan resmi kepada atasan atau admin HR Anda.',
      error_code: 'INVALID_COMPANY_CODE',
    }, 400);
  }

  const normalizedEmail = email_kantor.trim().toLowerCase();
  const normalizedNik = nik.trim();
  const [existingUser] = await db.select().from(users)
    .where(and(eq(users.company_id, company.id), or(eq(users.email, normalizedEmail), eq(users.nik, normalizedNik))))
    .limit(1);

  if (existingUser) {
    return c.json({
      success: false,
      message: 'Email kantor atau NIK sudah terdaftar.',
      error_code: 'DUPLICATE_USER',
    }, 409);
  }

  const passwordHash = await hashPassword(kata_sandi);
  const [created] = await db.insert(users).values([
    {
      company_id: company.id,
      name: nama_lengkap.trim(),
      email: normalizedEmail,
      nik: normalizedNik,
      password_hash: passwordHash,
      role: 'Karyawan',
      department: departemen.trim(),
      status: 'PENDING_VERIFICATION',
    },
  ]);

  const userId = Number(created.insertId);

  return c.json({
    success: true,
    message: 'Pendaftaran berhasil. Akun Anda sedang menunggu verifikasi oleh admin perusahaan.',
    data: {
      user_id: `usr_${userId}`,
      nama_lengkap: nama_lengkap.trim(),
      email_kantor: normalizedEmail,
      company_name: company.name,
      status: 'PENDING_VERIFICATION',
    },
  }, 201);
});

authRoutes.post('/login', async (c) => {
  const body = await c.req.json().catch(() => null);

  if (!body) {
    return c.json({ error: 'Bad Request', message: 'Request body is required.' }, 400);
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation Error', details: parsed.error.flatten() }, 400);
  }

  const { email, password } = parsed.data;
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (!user) {
    return c.json({ error: 'Unauthorized', message: 'Invalid email or password.' }, 401);
  }

  const isValid = await comparePassword(password, user.password_hash);
  if (!isValid) {
    return c.json({ error: 'Unauthorized', message: 'Invalid email or password.' }, 401);
  }
  if (user.status !== 'ACTIVE') {
    return c.json({ error: 'Forbidden', message: 'This account is not active.' }, 403);
  }

  const token = await signToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });

  return c.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
    },
  });
});

authRoutes.get('/me', authMiddleware, async (c) => {
  const user = c.get('user');

  const [record] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);

  if (!record) {
    return c.json({ error: 'Not Found', message: 'User was not found.' }, 404);
  }

  return c.json({
    id: record.id,
    name: record.name,
    email: record.email,
    role: record.role,
    department: record.department,
  });
});

authRoutes.post('/change-password', authMiddleware, async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) {
    return c.json({ error: 'Bad Request', message: 'Request body is required.' }, 400);
  }

  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation Error', details: parsed.error.flatten() }, 400);
  }

  if (parsed.data.password_baru !== parsed.data.konfirmasi_password_baru) {
    return c.json({ error: 'Bad Request', message: 'New password confirmation does not match.' }, 400);
  }

  if (parsed.data.password_saat_ini === parsed.data.password_baru) {
    return c.json({ error: 'Bad Request', message: 'New password must be different from the current password.' }, 400);
  }

  const user = c.get('user');
  const [record] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  if (!record) {
    return c.json({ error: 'Not Found', message: 'User was not found.' }, 404);
  }

  const isValid = await comparePassword(parsed.data.password_saat_ini, record.password_hash);
  if (!isValid) {
    return c.json({ error: 'Bad Request', message: 'Current password is incorrect.' }, 400);
  }

  const passwordHash = await hashPassword(parsed.data.password_baru);
  await db.update(users).set({ password_hash: passwordHash }).where(eq(users.id, user.id));

  return c.json({ message: 'Password changed successfully.' });
});

export default authRoutes;
