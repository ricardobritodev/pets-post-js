/**
 * Página /cadastro/ — specs/api/auth.md · BR-AUTH-001..003
 * O cadastro não loga: depois de criar a conta, vai para o login (como no sistema antigo).
 */
import '../styles/main.css';
import { PASSWORD_MIN_LENGTH } from '@petspost/domain/constants';
import { safeRedirectPath } from '@petspost/domain/redirect';
import { ApiError } from '../lib/api.js';
import { mountLayout, showFlash } from '../lib/layout.js';
import { register } from '../lib/session.js';
import { flash } from '../lib/flash.js';
import { enhanceForm, clearErrors, setFieldError, showFieldErrors, withSubmitting } from '../lib/forms.js';

const next = new URLSearchParams(location.search).get('next');
const loginUrl = next ? `/login/?next=${encodeURIComponent(next)}` : '/login/';
document.getElementById('login-link').href = loginUrl;

const user = await mountLayout();
if (user) location.replace(safeRedirectPath(next));

const form = document.getElementById('register-form');
enhanceForm(form);

/** Checagens rápidas no navegador; a API continua sendo quem decide. */
function checkLocally() {
  let ok = true;
  if (form.password.value.length < PASSWORD_MIN_LENGTH) {
    setFieldError(form.password, `A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`);
    ok = false;
  }
  if (form.password.value !== form.confirmPassword.value) {
    setFieldError(form.confirmPassword, 'As senhas não coincidem.');
    ok = false;
  }
  return ok;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearErrors(form);
  if (!checkLocally()) return;

  const data = Object.fromEntries(
    ['name', 'email', 'phone', 'password', 'confirmPassword'].map((k) => [k, form.elements[k].value]),
  );

  await withSubmitting(form, async () => {
    try {
      await register(data);
      flash('Conta criada com sucesso! Faça login para continuar.', 'success');
      location.assign(loginUrl);
    } catch (err) {
      if (!(err instanceof ApiError)) return showFlash('Sem conexão com o servidor. Tente novamente.', 'danger');
      if (err.code === 'VALIDATION_ERROR') {
        showFieldErrors(form, err.details).forEach((m) => showFlash(m, 'danger'));
      } else if (err.code === 'CONFLICT') {
        setFieldError(form.email, err.message);
        form.email.focus();
      } else {
        showFlash(err.message, err.code === 'RATE_LIMITED' ? 'warning' : 'danger');
      }
    }
  });
});
