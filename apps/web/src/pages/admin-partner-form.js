/**
 * /admin/parceiros/criar e /admin/parceiros/:id/editar — BR-PARTNER-002, BR-GEO-002.
 */
import '../styles/main.css';
import { api, ApiError } from '../lib/api.js';
import { mountAdmin } from '../lib/admin.js';
import { showFlash } from '../lib/layout.js';
import { flash } from '../lib/flash.js';
import { el } from '../lib/dom.js';
import { enhanceForm, clearErrors, showFieldErrors, withSubmitting } from '../lib/forms.js';

const editId = Number(/^\/admin\/parceiros\/(\d+)\/editar/.exec(location.pathname)?.[1]) || null;
const FIELDS = ['name', 'type', 'address', 'description', 'phone', 'email', 'website', 'lat', 'lng'];

const field = (id, label, input, hint) =>
  el('div', {}, el('label', { for: id, class: 'label' }, label), input, hint && el('p', { class: 'mt-1 text-xs text-stone-500' }, hint));
const optional = (text) => [text, ' ', el('span', { class: 'font-normal text-stone-500' }, '(opcional)')];

function buildForm() {
  const input = (name, attrs = {}) => el('input', { id: name, name, class: 'input', ...attrs });
  return el('form', { id: 'partner-form', class: 'space-y-6', novalidate: true },
    el('fieldset', { class: 'card grid gap-4 sm:grid-cols-2' },
      el('legend', { class: 'text-lg font-semibold' }, 'Dados do parceiro'),
      field('name', 'Nome', input('name', { required: true, maxlength: '150' })),
      field('type', 'Tipo', el('select', { id: 'type', name: 'type', class: 'input', required: true },
        el('option', { value: '' }, 'Selecione…'),
        el('option', { value: 'foster_home' }, 'Lar temporário'),
        el('option', { value: 'petshop' }, 'Petshop parceiro'),
        el('option', { value: 'vet_clinic' }, 'Clínica veterinária'))),
      el('div', { class: 'sm:col-span-2' }, field('description', optional('Descrição'),
        el('textarea', { id: 'description', name: 'description', class: 'input', rows: '3', maxlength: '2000' }))),
      el('label', { class: 'choice sm:col-span-2' }, el('input', { type: 'checkbox', id: 'isActive', name: 'isActive', checked: true }), 'Ativo (aparece no mapa público)'),
    ),
    el('fieldset', { class: 'card grid gap-4 sm:grid-cols-2' },
      el('legend', { class: 'text-lg font-semibold' }, 'Endereço e mapa'),
      el('div', { class: 'sm:col-span-2' }, field('address', 'Endereço', input('address', { required: true, maxlength: '255', placeholder: 'Rua, número, bairro, cidade e estado' }),
        'O endereço é localizado no mapa ao salvar.')),
      field('lat', optional('Latitude'), input('lat', { inputmode: 'decimal', placeholder: '-23.5505' })),
      field('lng', optional('Longitude'), input('lng', { inputmode: 'decimal', placeholder: '-46.6333' })),
      el('p', { class: 'text-xs text-stone-500 sm:col-span-2' },
        'Só preencha latitude e longitude se o mapa não achar o endereço (dá para copiar do Google Maps, clicando no lugar).'),
    ),
    el('fieldset', { class: 'card grid gap-4 sm:grid-cols-3' },
      el('legend', { class: 'text-lg font-semibold' }, 'Contato'),
      field('phone', optional('Telefone'), input('phone', { type: 'tel', inputmode: 'numeric', placeholder: '(11) 3333-4444' })),
      field('email', optional('Email'), input('email', { type: 'email', maxlength: '120' })),
      field('website', optional('Site'), input('website', { type: 'url', maxlength: '255', placeholder: 'https://' })),
    ),
    el('div', { class: 'flex flex-col-reverse gap-3 sm:flex-row sm:justify-end' },
      el('a', { href: '/admin/parceiros', class: 'btn btn-ghost' }, 'Cancelar'),
      el('button', { type: 'submit', class: 'btn btn-primary' }, editId ? 'Salvar alterações' : 'Cadastrar parceiro'),
    ),
  );
}

if (await mountAdmin()) {
  const content = document.getElementById('admin-content');
  const form = buildForm();
  content.replaceChildren(form);
  enhanceForm(form);

  let loaded = true;
  if (editId) {
    document.title = 'Editar parceiro · Admin · Pets Post';
    document.getElementById('admin-title').textContent = 'Editar parceiro';
    try {
      const { partner } = await api(`/admin/partners/${editId}`);
      for (const name of FIELDS) if (partner[name] != null) form.elements[name].value = partner[name];
      form.elements.isActive.checked = partner.isActive;
    } catch (err) {
      loaded = false;
      content.replaceChildren(el('div', { class: 'card text-center' },
        el('p', { class: 'text-stone-600' }, err instanceof ApiError && err.status === 404 ? 'Parceiro não encontrado.' : 'Não foi possível carregar o parceiro.'),
        el('a', { href: '/admin/parceiros', class: 'btn btn-primary mt-5' }, 'Voltar para a lista')));
    }
  }

  if (loaded) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearErrors(form);
      const data = Object.fromEntries(FIELDS.map((name) => [name, form.elements[name].value]));
      data.isActive = form.elements.isActive.checked;
      await withSubmitting(form, async () => {
        try {
          const { partner, geocoded } = await api(editId ? `/admin/partners/${editId}` : '/admin/partners', {
            method: editId ? 'PATCH' : 'POST',
            json: data,
          });
          flash(editId ? `Parceiro "${partner.name}" atualizado.` : `Parceiro "${partner.name}" cadastrado.`, 'success');
          if (geocoded === false) {
            flash('O endereço não foi encontrado no mapa, então o parceiro não aparece no mapa público. Confira o endereço ou informe latitude e longitude.', 'warning');
          }
          location.assign('/admin/parceiros');
        } catch (err) {
          if (!(err instanceof ApiError)) return showFlash('Sem conexão com o servidor.', 'danger');
          if (err.code === 'VALIDATION_ERROR') {
            showFieldErrors(form, err.details).forEach((m) => showFlash(m, 'danger'));
            showFlash('Confira os campos destacados.', 'danger');
          } else {
            showFlash(err.message, 'danger');
          }
        }
      });
    });
  }
}
