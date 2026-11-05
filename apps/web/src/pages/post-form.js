/**
 * Formulário /posts/criar e /posts/:id/editar — T4.15 · BR-POST-001, BR-POST-007, PERM-001
 */
import '../styles/main.css';
import { api, ApiError } from '../lib/api.js';
import { mountLayout, showFlash } from '../lib/layout.js';
import { redirectToLogin } from '../lib/session.js';
import { flash } from '../lib/flash.js';
import { el } from '../lib/dom.js';
import { enhanceForm, clearErrors, showFieldErrors, withSubmitting } from '../lib/forms.js';

const FIELDS = ['status', 'title', 'description', 'petType', 'petName', 'petBreed', 'petColor', 'petSize',
  'lastSeenLocation', 'contactPhone', 'contactEmail', 'reward'];

const form = document.getElementById('post-form');
const editId = Number(/^\/posts\/(\d+)\/editar/.exec(location.pathname)?.[1]) || null;

/** Texto do campo de local e da recompensa muda conforme perdido/encontrado. */
function syncStatusUi() {
  const found = form.elements.status.value === 'found';
  document.getElementById('location-label').textContent = found ? 'Onde foi encontrado' : 'Onde foi visto por último';
  document.getElementById('reward-field').hidden = found;
}

function fill(values) {
  for (const name of FIELDS) {
    const field = form.elements[name];
    if (field && values[name] != null) field.value = values[name];
  }
  syncStatusUi();
}

function readForm() {
  const data = Object.fromEntries(FIELDS.map((name) => [name, form.elements[name].value]));
  if (data.status === 'found') data.reward = '';
  return data;
}

function blocked(message) {
  form.remove();
  document.getElementById('app-flash').after(
    el('div', { class: 'card text-center' },
      el('p', { class: 'text-stone-600' }, message),
      el('a', { href: '/posts/', class: 'btn btn-primary mt-5' }, 'Ver anúncios'),
    ),
  );
}

const user = await mountLayout();
if (!user) {
  redirectToLogin(); // BR-AUTH-009: volta para cá depois do login
} else {
  enhanceForm(form);
  form.addEventListener('change', (e) => e.target.name === 'status' && syncStatusUi());

  let ready = true;
  if (editId) {
    document.title = 'Editar anúncio · Pets Post';
    document.getElementById('form-title').textContent = 'Editar anúncio';
    form.querySelector('button[type="submit"]').textContent = 'Salvar alterações';
    document.getElementById('cancel').href = `/posts/${editId}`;
    try {
      const { post } = await api(`/posts/${editId}`);
      if (!post.canManage) {
        ready = false;
        blocked('Você não pode editar este anúncio.');
      } else {
        fill(post);
      }
    } catch (err) {
      ready = false;
      blocked(err instanceof ApiError && err.status === 404 ? 'Anúncio não encontrado.' : 'Não foi possível carregar o anúncio.');
    }
  } else {
    // BR-POST-007 — ?status=lost|found pré-seleciona a situação.
    const status = new URLSearchParams(location.search).get('status');
    fill({ status: ['lost', 'found'].includes(status) ? status : 'lost', contactPhone: user.phone ?? '' });
  }

  if (ready) {
    form.hidden = false;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearErrors(form);
      await withSubmitting(form, async () => {
        try {
          const { post } = await api(editId ? `/posts/${editId}` : '/posts', {
            method: editId ? 'PATCH' : 'POST',
            json: readForm(),
          });
          flash(editId ? 'Anúncio atualizado com sucesso!' : 'Seu anúncio foi publicado com sucesso!', 'success');
          location.assign(`/posts/${post.id}`);
        } catch (err) {
          if (!(err instanceof ApiError)) return showFlash('Sem conexão com o servidor. Tente novamente.', 'danger');
          if (err.code === 'VALIDATION_ERROR') {
            showFieldErrors(form, err.details).forEach((m) => showFlash(m, 'danger'));
            showFlash('Confira os campos destacados.', 'danger');
          } else if (err.status === 401) {
            redirectToLogin();
          } else {
            showFlash(err.message, 'danger');
          }
        }
      });
    });
  }
}
