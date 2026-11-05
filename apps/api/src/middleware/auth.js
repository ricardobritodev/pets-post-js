/**
 * auth.js — Usuário da sessão e middlewares de autorização.
 * Spec: specs/api/auth.md · specs/domain/permissions.md (PERM-003, PERM-004)
 */
import { isAdmin } from '@petspost/domain';
import { HttpError } from './errors.js';

/**
 * Carrega req.user a partir de req.session.userId (1 consulta por requisição logada).
 * Conta apagada ou desativada depois do login → sessão perde o usuário (PERM-004).
 */
export function loadUser({ users }) {
  return async (req, _res, next) => {
    req.user = null;
    const id = req.session?.userId;
    if (!Number.isInteger(id)) return next();
    const user = await users.findById(id);
    if (user?.isActive) {
      req.user = user;
    } else {
      delete req.session.userId;
    }
    next();
  };
}

/** 401 para visitante. */
export function requireAuth(req, _res, next) {
  if (!req.user) return next(new HttpError(401, 'UNAUTHENTICATED', 'Faça login para continuar.'));
  next();
}

/** PERM-003 — 401 para visitante, 403 para quem não é admin. */
export function requireAdmin(req, _res, next) {
  if (!req.user) return next(new HttpError(401, 'UNAUTHENTICATED', 'Faça login para continuar.'));
  if (!isAdmin(req.user)) return next(new HttpError(403, 'FORBIDDEN', 'Acesso restrito a administradores.'));
  next();
}
