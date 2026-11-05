/**
 * validate.js — Valida body/query com um schema zod (packages/contracts).
 * Erro → 400 VALIDATION_ERROR com `details` (specs/api/conventions.md).
 * O valor validado (já normalizado: trim, minúsculas...) substitui req.body / fica em req.validQuery.
 */
import { HttpError } from './errors.js';

export const zodDetails = (error) =>
  error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));

/**
 * @param {import('zod').ZodType} schema
 * @param {'body'|'query'} [source]
 */
export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source] ?? {});
    if (!result.success) {
      return next(new HttpError(400, 'VALIDATION_ERROR', 'Dados inválidos.', zodDetails(result.error)));
    }
    if (source === 'body') req.body = result.data;
    else req.validQuery = result.data; // req.query é só leitura no Express 5
    next();
  };
}
