/**
 * Página /login/ — specs/api/auth.md · BR-AUTH-005, 006, 009
 */
import '../styles/main.css';
import { safeRedirectPath } from '@petspost/domain/redirect';
import { ApiError } from '../lib/api.js';
import { mountLayout, showFlash } from '../lib/layout.js';
import { login } from '../lib/session.js';
import { flash } from '../lib/flash.js';
import { enhanceForm, clearErrors, showFieldErrors, withSubmitting } from '../lib/forms.js';

const next = new URLSearchParams(location.search).get('next');
const destination = safeRedirectPath(next); // BR-AUTH-009

const user = await mountLayout();
if (user) location.replace(destination);

// Mantém o ?next= ao ir para o cadastro e voltar.
if (next) {
  document.getElementById('register-link').href = `/cadastro/?next=${encodeURIComponent(next)}`;
}

const form = document.getElementById('login-form');
enhanceForm(form);

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearErrors(form);
  const data = {
    email: form.email.value,
    password: form.password.value,
    remember: form.remember.checked,
  };

  await withSubmitting(form, async () => {
    try {
      const logged = await login(data);
      flash(`Bem-vindo de volta, ${logged.name}!`, 'success');
      location.assign(destination);
    } catch (err) {
      if (!(err instanceof ApiError)) return showFlash('Sem conexão com o servidor. Tente novamente.', 'danger');
      if (err.code === 'VALIDATION_ERROR') {
        showFieldErrors(form, err.details).forEach((m) => showFlash(m, 'danger'));
      } else if (err.code === 'ACCOUNT_INACTIVE' || err.code === 'RATE_LIMITED') {
        showFlash(err.message, 'warning');
      } else {
        showFlash(err.message, 'danger'); // INVALID_CREDENTIALS: mensagem genérica (BR-AUTH-006)
        form.password.value = '';
        form.password.focus();
      }
    }
  });
});
