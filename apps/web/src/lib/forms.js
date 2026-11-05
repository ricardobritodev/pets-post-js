/**
 * forms.js — Ajudas de formulário (porta do main.js do sistema antigo, T3.12).
 *   - máscara de telefone (XX) XXXXX-XXXX
 *   - validação de email ao sair do campo
 *   - exibir erros de campo vindos da API ({ details: [{ path, message }] })
 */
import { PHONE_REGEX } from '@petspost/domain/constants';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Formata dígitos digitados como telefone brasileiro. */
export function maskPhone(value) {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export const isValidPhone = (v) => PHONE_REGEX.test(v);
export const isValidEmail = (v) => EMAIL_REGEX.test(v.trim());

function errorSlot(input) {
  const id = `${input.id}-error`;
  let slot = document.getElementById(id);
  if (!slot) {
    slot = document.createElement('p');
    slot.id = id;
    slot.className = 'field-error';
    input.insertAdjacentElement('afterend', slot);
  }
  return slot;
}

export function setFieldError(input, message) {
  const slot = errorSlot(input);
  slot.textContent = message ?? '';
  if (message) {
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', slot.id);
  } else {
    input.removeAttribute('aria-invalid');
  }
}

export function clearErrors(form) {
  form.querySelectorAll('input').forEach((i) => setFieldError(i, null));
}

/**
 * Mostra os erros de validação da API nos campos. Devolve as mensagens sem campo.
 * @param {HTMLFormElement} form
 * @param {Array<{ path: string, message: string }>} details
 */
export function showFieldErrors(form, details) {
  const loose = [];
  let first = null;
  for (const { path, message } of details) {
    const input = form.elements.namedItem(path);
    if (input instanceof HTMLInputElement) {
      setFieldError(input, message);
      first ??= input;
    } else {
      loose.push(message);
    }
  }
  first?.focus();
  return loose;
}

/** Liga máscara de telefone e checagem de email nos campos do formulário. */
export function enhanceForm(form) {
  for (const input of form.querySelectorAll('input[type="tel"]')) {
    input.addEventListener('input', () => {
      input.value = maskPhone(input.value);
    });
    input.addEventListener('blur', () => {
      setFieldError(input, input.value && !isValidPhone(input.value)
        ? 'Telefone inválido. Use (XX) XXXX-XXXX ou (XX) XXXXX-XXXX.' : null);
    });
  }
  for (const input of form.querySelectorAll('input[type="email"]')) {
    input.addEventListener('blur', () => {
      setFieldError(input, input.value && !isValidEmail(input.value)
        ? 'Informe um email válido (ex: nome@dominio.com).' : null);
    });
  }
}

/** Desliga o botão durante o envio (evita duplo clique). */
export async function withSubmitting(form, fn) {
  const button = form.querySelector('button[type="submit"]');
  const label = button?.textContent;
  if (button) {
    button.disabled = true;
    button.textContent = 'Aguarde…';
  }
  try {
    return await fn();
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = label;
    }
  }
}
