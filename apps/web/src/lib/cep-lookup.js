/**
 * cep-lookup.js — Preenche o endereço pelo CEP (porta do cep.js antigo, T5.11 · BR-GEO-004).
 *   - máscara 00000-000;
 *   - espera 500 ms depois da última tecla;
 *   - cancela a consulta anterior se a pessoa continuar digitando.
 */
import { api, ApiError } from './api.js';
import { icon } from './icons.js';

export function maskCep(value) {
  const d = value.replace(/\D/g, '').slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

/** "rua, bairro, cidade/UF" — igual ao sistema antigo. */
export function formatAddress({ street, neighborhood, city, uf }) {
  const place = city && uf ? `${city}/${uf}` : city;
  return [street, neighborhood, place].filter(Boolean).join(', ').slice(0, 255);
}

/**
 * @param {HTMLInputElement} cepInput
 * @param {HTMLInputElement} target campo de endereço a preencher
 * @param {HTMLElement} status mensagem de andamento
 */
export function attachCepLookup(cepInput, target, status) {
  let controller = null;
  let timer = null;

  const setStatus = (text, kind = '') => {
    status.replaceChildren(...(kind === 'ok' ? [icon('check', { size: 16 }), ' '] : []), text);
    status.dataset.state = kind;
  };

  async function lookup(digits) {
    controller?.abort();
    controller = new AbortController();
    setStatus('Buscando endereço…', 'loading');
    try {
      const address = await api(`/cep/${digits}`, { signal: controller.signal });
      target.value = formatAddress(address);
      target.dispatchEvent(new Event('input', { bubbles: true }));
      setStatus('Endereço preenchido. Confira e complete se precisar.', 'ok');
      target.focus();
    } catch (err) {
      if (err?.name === 'AbortError') return;
      setStatus(err instanceof ApiError ? err.message : 'Erro ao consultar o CEP.', 'error');
    }
  }

  cepInput.addEventListener('input', () => {
    cepInput.value = maskCep(cepInput.value);
    const digits = cepInput.value.replace(/\D/g, '');
    clearTimeout(timer);
    if (digits.length !== 8) {
      controller?.abort();
      setStatus('');
      return;
    }
    timer = setTimeout(() => lookup(digits), 500);
  });
}
