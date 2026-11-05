/**
 * Erros padronizados em JSON — formato definido em specs/api/conventions.md
 *   { "error": { "code": "NOT_FOUND", "message": "..." } }
 */

export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function notFound(_req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Recurso não encontrado.' } });
}

export function errorHandler({ config }) {
  // eslint-disable-next-line no-unused-vars
  return (err, _req, res, _next) => {
    // JSON malformado no corpo da requisição
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'JSON inválido.' } });
    }
    if (err instanceof HttpError) {
      return res.status(err.status).json({
        error: { code: err.code, message: err.message, ...(err.details && { details: err.details }) },
      });
    }
    console.error(err);
    const message = config.NODE_ENV === 'production' ? 'Erro interno.' : String(err?.message ?? err);
    return res.status(500).json({ error: { code: 'INTERNAL', message } });
  };
}
