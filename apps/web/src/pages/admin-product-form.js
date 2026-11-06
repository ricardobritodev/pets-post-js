/**
 * /admin/produtos/criar e /admin/produtos/:id/editar — BR-STORE-003/005/006/007.
 * Preço digitado em reais ("189,90"); a API recebe centavos.
 */
import '../styles/main.css';
import { reaisToCents, centsToInput } from '@petspost/domain/store';
import { api, ApiError } from '../lib/api.js';
import { mountAdmin } from '../lib/admin.js';
import { showFlash } from '../lib/layout.js';
import { flash } from '../lib/flash.js';
import { el } from '../lib/dom.js';
import { clearErrors, showFieldErrors, setFieldError, withSubmitting } from '../lib/forms.js';
import { createPhotoPicker } from '../lib/photo-picker.js';
import { syncPhotos } from '../lib/photo-sync.js';

const editId = Number(/^\/admin\/produtos\/(\d+)\/editar/.exec(location.pathname)?.[1]) || null;
const TEXT_FIELDS = ['partnerId', 'name', 'description', 'category', 'petType', 'stock', 'url'];

const field = (id, label, input, hint) =>
  el('div', {}, el('label', { for: id, class: 'label' }, label), input, hint && el('p', { class: 'mt-1 text-xs text-stone-500' }, hint));
const optional = (text) => [text, ' ', el('span', { class: 'font-normal text-stone-500' }, '(opcional)')];
const input = (name, attrs = {}) => el('input', { id: name, name, class: 'input', ...attrs });
const select = (name, options) =>
  el('select', { id: name, name, class: 'input' }, ...options.map(([value, text]) => el('option', { value }, text)));

/** Todos os parceiros (o admin lista 20 por página). */
async function loadPartners() {
  const all = [];
  for (let page = 1; page <= 50; page++) {
    const body = await api(`/admin/partners?page=${page}`);
    all.push(...body.items);
    if (page >= body.totalPages) break;
  }
  return all;
}

function buildForm(partners) {
  return el('form', { id: 'product-form', class: 'space-y-6', novalidate: true },
    el('fieldset', { class: 'card grid gap-4 sm:grid-cols-2' },
      el('legend', { class: 'text-lg font-semibold' }, 'Produto'),
      el('div', { class: 'sm:col-span-2' }, field('name', 'Nome', input('name', { required: true, maxlength: '150', placeholder: 'Ex.: Ração Premium Cães Adultos 10 kg' }))),
      field('partnerId', 'Parceiro (quem vende)', select('partnerId', [['', 'Selecione…'],
        ...partners.map((p) => [String(p.id), `${p.name}${p.isActive ? '' : ' (inativo)'}`])])),
      field('category', 'Categoria', select('category', [['', 'Selecione…'], ['food', 'Ração'], ['treats', 'Petiscos'], ['toys', 'Brinquedos'],
        ['hygiene', 'Higiene e beleza'], ['health', 'Farmácia e saúde'], ['accessories', 'Coleiras e acessórios'], ['beds', 'Camas e casinhas']])),
      field('petType', 'Para qual pet', select('petType', [['', 'Todos os pets'], ['dog', 'Cachorro'], ['cat', 'Gato'], ['bird', 'Pássaro'], ['other', 'Outros']])),
      field('url', optional('Link do produto na loja'), input('url', { type: 'url', maxlength: '500', placeholder: 'https://' }),
        'Sem link, o botão leva para o site ou o WhatsApp do parceiro.'),
      el('div', { class: 'sm:col-span-2' }, field('description', optional('Descrição'), el('textarea', { id: 'description', name: 'description', rows: '4', maxlength: '5000', class: 'input' }))),
    ),
    el('fieldset', { class: 'card grid gap-4 sm:grid-cols-3' },
      el('legend', { class: 'text-lg font-semibold' }, 'Preço e estoque'),
      field('priceCents', 'Preço (R$)', input('priceCents', { inputmode: 'decimal', placeholder: '189,90', required: true })),
      field('promoPriceCents', optional('Preço promocional (R$)'), input('promoPriceCents', { inputmode: 'decimal', placeholder: '159,90' })),
      field('stock', 'Estoque', input('stock', { type: 'number', min: '0', step: '1', value: '0' }), 'Com 0, aparece como "Esgotado".'),
      el('label', { class: 'choice' }, el('input', { type: 'checkbox', id: 'isActive', name: 'isActive', checked: true }), 'Ativo (aparece na vitrine)'),
      el('label', { class: 'choice' }, el('input', { type: 'checkbox', id: 'isFeatured', name: 'isFeatured' }), 'Destaque'),
    ),
    el('fieldset', { class: 'card space-y-3' },
      el('legend', { class: 'text-lg font-semibold' }, 'Fotos'),
      el('div', { id: 'photo-picker', class: 'space-y-3' }),
    ),
    el('div', { class: 'flex flex-col-reverse gap-3 sm:flex-row sm:justify-end' },
      el('a', { href: '/admin/produtos', class: 'btn btn-ghost' }, 'Cancelar'),
      el('button', { type: 'submit', class: 'btn btn-primary' }, editId ? 'Salvar alterações' : 'Cadastrar produto'),
    ),
  );
}

/** Lê o formulário; preço inválido vira erro no campo (e devolve null). */
function readForm(form) {
  const data = Object.fromEntries(TEXT_FIELDS.map((n) => [n, form.elements[n].value]));
  data.isActive = form.elements.isActive.checked;
  data.isFeatured = form.elements.isFeatured.checked;
  let ok = true;
  for (const name of ['priceCents', 'promoPriceCents']) {
    const raw = form.elements[name].value.trim();
    if (!raw) {
      data[name] = name === 'promoPriceCents' ? null : '';
      continue;
    }
    const cents = reaisToCents(raw);
    if (cents === null) {
      setFieldError(form.elements[name], 'Valor inválido. Use o formato 189,90.');
      ok = false;
    }
    data[name] = cents;
  }
  return ok ? data : null;
}

if (await mountAdmin()) {
  const content = document.getElementById('admin-content');
  let partners = [];
  let product = null;
  try {
    [partners, product] = await Promise.all([loadPartners(), editId ? api(`/admin/products/${editId}`).then((b) => b.product) : null]);
  } catch (err) {
    content.replaceChildren(el('div', { class: 'card text-center' },
      el('p', { class: 'text-stone-600' }, err instanceof ApiError && err.status === 404 ? 'Produto não encontrado.' : 'Não foi possível carregar o formulário.'),
      el('a', { href: '/admin/produtos', class: 'btn btn-primary mt-5' }, 'Voltar para a lista')));
  }

  if (content.querySelector('.card') === null) {
    if (!partners.length) {
      content.replaceChildren(el('div', { class: 'card text-center' },
        el('p', { class: 'text-stone-600' }, 'Cadastre um parceiro antes: todo produto pertence a um parceiro.'),
        el('a', { href: '/admin/parceiros/criar', class: 'btn btn-primary mt-5' }, 'Novo parceiro')));
    } else {
      const form = buildForm(partners);
      content.replaceChildren(form);
      if (product) {
        document.title = 'Editar produto · Admin · Pets Post';
        document.getElementById('admin-title').textContent = 'Editar produto';
        for (const n of TEXT_FIELDS) if (product[n] != null) form.elements[n].value = String(product[n]);
        form.elements.priceCents.value = centsToInput(product.priceCents);
        form.elements.promoPriceCents.value = centsToInput(product.promoPriceCents);
        form.elements.isActive.checked = product.isActive;
        form.elements.isFeatured.checked = product.isFeatured;
      }
      const picker = createPhotoPicker(document.getElementById('photo-picker'), { existing: product?.photos ?? [] });
      const submitButton = form.querySelector('button[type="submit"]');

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        clearErrors(form);
        const data = readForm(form);
        if (!data) return showFlash('Confira os campos destacados.', 'danger');
        await withSubmitting(form, async () => {
          try {
            const { product: saved } = await api(editId ? `/admin/products/${editId}` : '/admin/products', {
              method: editId ? 'PATCH' : 'POST',
              json: data,
            });
            const problems = await syncPhotos(`/admin/products/${saved.id}`, picker, (t) => (submitButton.textContent = t));
            flash(editId ? `Produto "${saved.name}" atualizado.` : `Produto "${saved.name}" cadastrado.`, 'success');
            if (problems.length) flash(`Algumas fotos não entraram: ${problems.join(' · ')}`, 'warning');
            location.assign('/admin/produtos');
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
}
