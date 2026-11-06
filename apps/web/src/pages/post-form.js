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
import { createPhotoPicker } from '../lib/photo-picker.js';
import { attachCepLookup } from '../lib/cep-lookup.js';

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

/**
 * Depois de salvar o anúncio: remove as fotos marcadas e envia as novas, uma por requisição.
 * Falha numa foto não desfaz o anúncio (BR-PHOTO-006); devolve os avisos para mostrar.
 */
async function syncPhotos(postId, picker, onProgress) {
  const problems = [];
  for (const photoId of picker.removedIds()) {
    try {
      await api(`/posts/${postId}/photos/${photoId}`, { method: 'DELETE' });
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) problems.push('Não foi possível remover uma das fotos.');
    }
  }
  const files = picker.newFiles();
  for (const [i, file] of files.entries()) {
    onProgress(`Enviando foto ${i + 1} de ${files.length}…`);
    const body = new FormData();
    body.append('photos', file, file.name);
    try {
      const { rejected } = await api(`/posts/${postId}/photos`, { method: 'POST', body });
      for (const r of rejected) problems.push(`${r.name}: ${r.message}`);
    } catch (err) {
      problems.push(`${file.name}: ${err instanceof ApiError ? err.message : 'falha no envio.'}`);
      if (err instanceof ApiError && err.status === 401) break;
    }
  }
  return problems;
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
  attachCepLookup(document.getElementById('cep'), form.elements.lastSeenLocation, document.getElementById('cep-status'));

  let ready = true;
  let existingPhotos = [];
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
        existingPhotos = post.photos;
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
    const picker = createPhotoPicker(document.getElementById('photo-picker'), { existing: existingPhotos });
    const submitButton = form.querySelector('button[type="submit"]');
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
          const problems = await syncPhotos(post.id, picker, (text) => (submitButton.textContent = text));
          flash(editId ? 'Anúncio atualizado com sucesso!' : 'Seu anúncio foi publicado com sucesso!', 'success');
          if (problems.length) {
            flash(`O anúncio foi salvo, mas algumas fotos não entraram: ${problems.join(' · ')}`, 'warning');
          }
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
