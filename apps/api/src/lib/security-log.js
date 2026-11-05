/**
 * security-log.js — Log de eventos de segurança (BR-AUTH-011) com pino.
 *
 * Eventos: login_success, login_failed, login_blocked_inactive, register_success, logout.
 * Sempre com IP; nunca com senha. Email só aparece em login_failed (para detectar ataque
 * a uma conta), igual ao sistema antigo.
 */
import pino from 'pino';

export const SECURITY_EVENTS = Object.freeze([
  'login_success',
  'login_failed',
  'login_blocked_inactive',
  'register_success',
  'logout',
]);

/** Logger da aplicação. Em teste fica mudo. */
export function createLogger(config) {
  return pino({
    level: config.NODE_ENV === 'test' ? 'silent' : 'info',
    redact: { paths: ['password', 'confirmPassword', '*.password', 'req.headers.cookie'], remove: true },
  });
}

/**
 * @param {import('pino').Logger} logger
 * @returns {(event: string, fields: Record<string, unknown>) => void}
 */
export function createSecurityLog(logger) {
  const log = logger.child({ channel: 'security' });
  return (event, fields = {}) => {
    if (!SECURITY_EVENTS.includes(event)) throw new Error(`Evento de segurança desconhecido: ${event}`);
    const level = event === 'login_failed' || event === 'login_blocked_inactive' ? 'warn' : 'info';
    log[level]({ event, ...fields }, event);
  };
}
