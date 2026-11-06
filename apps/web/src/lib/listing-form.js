/**
 * listing-form.js — Fluxo dos formulários de anúncio (posts e adoção):
 * login obrigatório, carregar na edição (só dono/admin), CEP, fotos, enviar, mostrar erros
 * de campo e ir para o detalhe. Cada página passa só o que é dela.
 */
import { api, ApiError } from './api.js';
import { mountLayout, showFlash } from './layout.js';
import { redirectToLogin } from './session.js';
import { flash } from './flash.js';
import { el } from './dom.js';
import { enhanceForm, clearErrors, showFieldErrors, withSubmitting } from './forms.js';
import { createPhotoPicker } from './photo-picker.js';
import { attachCepLookup } from './cep-lookup.js';
import { syncPhotos } from './photo-sync.js';

/**
 * @param {{
 *   form: HTMLFormElement,
 *   editId: number|null,
 *   apiPath: string,          // '/posts' ou '/adoption'
 *   key: string,              // 'post' ou 'adoption' (objeto na resposta)
 *   pagePath: (id: number) => string,   // URL do detalhe
 *   listHref: string,
 *   addressField: string,     // campo preenchido pelo CEP
 *   fields: string[],         // campos de texto/select
 *   checkboxes?: string[],    // campos booleanos
 *   messages: { created: string, updated: string, editTitle: string },
 *   defaults?: (user: object) => object,  // valores iniciais na criação
 *   beforeSubmit?: (data: object) => object,
 *   onFill?: () => void,      // depois de preencher (ex.: ajustar textos)
 * }} o
 */
export async function setupListingForm(o) {
  const { form, editId, apiPath, key } = o;
  const checkboxes = o.checkboxes ?? [];

  function fill(values) {
    for (const name of o.fields) {
      const field = form.elements[name];
      if (field && values[name] != null) field.value = values[name];
    }
    for (const name of checkboxes) if (values[name] != null) form.elements[name].checked = Boolean(values[name]);
    o.onFill?.();
  }

  function readForm() {
    const data = Object.fromEntries(o.fields.map((name) => [name, form.elements[name].value]));
    for (const name of checkboxes) data[name] = form.elements[name].checked;
    return o.beforeSubmit ? o.beforeSubmit(data) : data;
  }

  function blocked(message) {
    form.remove();
    document.getElementById('app-flash').after(
      el('div', { class: 'card text-center' },
        el('p', { class: 'text-stone-600' }, message),
        el('a', { href: o.listHref, class: 'btn btn-primary mt-5' }, 'Ver anúncios'),
      ),
    );
  }

  const user = await mountLayout();
  if (!user) return redirectToLogin(); // BR-AUTH-009: volta para cá depois do login

  enhanceForm(form);
  attachCepLookup(document.getElementById('cep'), form.elements[o.addressField], document.getElementById('cep-status'));

  let existingPhotos = [];
  if (editId) {
    document.title = `${o.messages.editTitle} · Pets Post`;
    document.getElementById('form-title').textContent = o.messages.editTitle;
    form.querySelector('button[type="submit"]').textContent = 'Salvar alterações';
    document.getElementById('cancel').href = o.pagePath(editId);
    try {
      const item = (await api(`${apiPath}/${editId}`))[key];
      if (!item.canManage) return blocked('Você não pode editar este anúncio.');
      fill(item);
      existingPhotos = item.photos;
    } catch (err) {
      return blocked(err instanceof ApiError && err.status === 404 ? 'Anúncio não encontrado.' : 'Não foi possível carregar o anúncio.');
    }
  } else {
    fill(o.defaults ? o.defaults(user) : { contactPhone: user.phone ?? '' });
  }

  const picker = createPhotoPicker(document.getElementById('photo-picker'), { existing: existingPhotos });
  const submitButton = form.querySelector('button[type="submit"]');
  form.hidden = false;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors(form);
    await withSubmitting(form, async () => {
      try {
        const item = (await api(editId ? `${apiPath}/${editId}` : apiPath, {
          method: editId ? 'PATCH' : 'POST',
          json: readForm(),
        }))[key];
        const problems = await syncPhotos(`${apiPath}/${item.id}`, picker, (text) => (submitButton.textContent = text));
        flash(editId ? o.messages.updated : o.messages.created, 'success');
        if (problems.length) {
          flash(`O anúncio foi salvo, mas algumas fotos não entraram: ${problems.join(' · ')}`, 'warning');
        }
        location.assign(o.pagePath(item.id));
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
