/**
 * auth.js — DTOs de autenticação.
 * Spec: specs/domain/rules.md (BR-AUTH-*)
 */
import { z } from 'zod';
import { PASSWORD_MIN_LENGTH } from '@petspost/domain';
import { emailSchema, phoneSchema } from './common.js';

/** BR-AUTH-001..003 */
export const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'O nome deve ter entre 2 e 100 caracteres.').max(100, 'O nome deve ter entre 2 e 100 caracteres.'),
    email: emailSchema,
    phone: z
      .union([z.literal(''), phoneSchema])
      .optional()
      .nullable()
      .transform((v) => (v ? v : null)),
    password: z.string().min(PASSWORD_MIN_LENGTH, `A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não coincidem.',
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'A senha é obrigatória.'),
  remember: z.boolean().optional().default(false),
});

/** O que a API devolve sobre o usuário — nunca inclui passwordHash. */
export const publicUserSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  email: z.string(),
  role: z.enum(['admin', 'user']),
  phone: z.string().nullable(),
});
