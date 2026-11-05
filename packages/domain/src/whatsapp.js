/**
 * whatsapp.js — Gera links wa.me a partir de telefones brasileiros.
 * Spec: BR-CONTACT-001 (porta fiel de app/utils/phone.py do projeto Flask)
 *
 *   (11) 99999-9999   → https://wa.me/5511999999999
 *   +55 11 98888-7777 → https://wa.me/5511988887777
 *   0800 / sem DDD    → null
 *
 * @param {string|null|undefined} phone
 * @param {string} [message] texto pré-preenchido (opcional)
 * @returns {string|null}
 */
export function toWhatsappUrl(phone, message = '') {
  if (!phone) return null;

  let digits = String(phone).replace(/\D/g, '');

  // 0800 / 0300 / 0500 não funcionam no WhatsApp
  if (digits.startsWith('0')) return null;

  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    // já tem código do país
  } else if (digits.length === 10 || digits.length === 11) {
    digits = `55${digits}`;
  } else {
    // sem DDD (8–9 dígitos) ou tamanho inválido
    return null;
  }

  if (!message) return `https://wa.me/${digits}`;
  return `https://wa.me/${digits}?text=${pythonQuote(message)}`;
}

/**
 * Equivalente a `urllib.parse.quote(s)` do Python (safe='/'), para que os
 * links gerados sejam idênticos aos da versão Flask. Difere do
 * encodeURIComponent em: codifica ! ' ( ) * e mantém / literal.
 */
function pythonQuote(text) {
  return encodeURIComponent(text)
    .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%2F/g, '/');
}
