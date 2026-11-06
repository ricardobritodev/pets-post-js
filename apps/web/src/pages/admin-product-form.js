/**
 * /admin/produtos/criar e /admin/produtos/:id/editar — BR-STORE-003/005/006/007/012/013.
 * Preço digitado em reais ("189,90"); a API recebe centavos.
 */
import '../styles/main.css';
import { reaisToCents, centsToInput } from '@petspost/domain/store';
import { api, ApiError } from '../lib/api.js';
import { mountAdmin } from '../lib/admin.js';
import { showFlash } from '../lib/layout.js';
import { flash } from '../lib/flash.js';
import { el, formatDate } from '../lib/dom.js';
import { clearErrors, showFieldErrors, setFieldError, withSubmitting } from '../lib/forms.js';
import { createPhotoPicker } from '../lib/photo-picker.js';
import { syncPhotos } from '../lib/photo-sync.js';
import { icon } from '../lib/icons.js';

const editId = Number(/^\/admin\/produtos\/(\d+)\/editar/.exec(location.pathname)?.[1]) || null;
/** Valor da opção "Nova loja" no select de parceiro (BR-STORE-012). */
const NEW_PARTNER = 'nova-loja';
const TEXT_FIELDS = ['partnerId', 'sellerName', 'name', 'description', 'category', 'petType', 'stock', 'url'];

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
      field('sellerName', optional('Vendido e entregue por'), input('sellerName', { maxlength: '120', placeholder: 'Ex.: Cobasi' }),
        'Aparece no produto como "Vendido e entregue por …". Vazio = nome do parceiro.'),
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

/**
 * Quadro "Importar de um link" (BR-STORE-009): busca o rascunho na API e preenche o formulário.
 * As fotos da loja aparecem como miniaturas (data:, sem carregar nada de fora) para marcar quais entram.
 * @returns {{ node: HTMLElement, selectedImageUrls: () => string[], newPartner: () => ({ name: string, website: string }|null) }}
 */
function importBox(form) {
  const urlInput = el('input', { id: 'import-url', type: 'url', class: 'input', placeholder: 'https://loja-do-parceiro.com.br/produto/…', maxlength: '2000' });
  const status = el('p', { class: 'text-sm', 'aria-live': 'polite' });
  const gallery = el('div', { class: 'grid grid-cols-3 gap-2 sm:grid-cols-6' });
  const galleryBox = el('div', { class: 'space-y-2', hidden: true },
    el('p', { class: 'text-sm font-medium' }, 'Fotos da loja (marque as que entram no produto):'), gallery);
  let images = [];
  let newPartner = null;

  const button = el('button', {
    type: 'button',
    class: 'btn btn-outline shrink-0',
    onclick: async () => {
      button.disabled = true;
      status.className = 'text-sm text-stone-500';
      status.textContent = 'Lendo a página da loja…';
      try {
        const { draft, images: found, warnings } = await api('/admin/products/import', { method: 'POST', json: { url: urlInput.value } });
        form.elements.name.value = draft.name ?? '';
        form.elements.description.value = draft.description ?? '';
        form.elements.url.value = draft.url ?? '';
        form.elements.sellerName.value = draft.sellerName ?? '';
        // BR-STORE-012 — a loja vem escolhida pelo site ou pelo nome; sem parceiro, a própria loja entra como nova.
        form.querySelector(`option[value="${NEW_PARTNER}"]`)?.remove();
        newPartner = draft.newPartner ?? null;
        if (draft.partnerId) form.elements.partnerId.value = String(draft.partnerId);
        else if (newPartner) {
          form.elements.partnerId.append(el('option', { value: NEW_PARTNER }, `Nova loja: ${newPartner.name} (cadastrada ao salvar)`));
          form.elements.partnerId.value = NEW_PARTNER;
        }
        if (draft.priceCents != null) form.elements.priceCents.value = centsToInput(draft.priceCents);
        if (draft.category) form.elements.category.value = draft.category;
        if (draft.petType) form.elements.petType.value = draft.petType;
        if (draft.inStock === false) form.elements.stock.value = '0';
        else if (draft.inStock === true && Number(form.elements.stock.value) === 0) form.elements.stock.value = '1';
        images = found.map((img, i) => ({ ...img, checked: i < 6 }));
        gallery.replaceChildren(...images.map((img, i) =>
          el('label', { class: 'photo-tile cursor-pointer' },
            el('img', { src: img.thumb, alt: `Foto ${i + 1} da loja` }),
            el('input', {
              type: 'checkbox', class: 'absolute left-1 top-1 size-5 accent-brand-600', checked: img.checked,
              'aria-label': `Usar a foto ${i + 1}`, onchange: (e) => { img.checked = e.currentTarget.checked; },
            }))));
        galleryBox.hidden = images.length === 0;
        status.className = 'text-sm text-found-600';
        const chosen = form.elements.partnerId.selectedOptions[0];
        status.replaceChildren(draft.partnerId && chosen?.value
          ? `Dados de ${draft.siteName} preenchidos e parceiro ${chosen.textContent} identificado pelo link. Confira tudo e salve.`
          : newPartner
            ? `Dados de ${draft.siteName} preenchidos. ${newPartner.name} será cadastrada como parceira (loja online) ao salvar.`
            : 'Dados preenchidos, mas não identifiquei a loja: escolha o parceiro na lista.');
        for (const w of warnings) showFlash(w, 'warning');
        if (!form.elements.category.value) setFieldError(form.elements.category, 'Não consegui adivinhar a categoria: escolha uma.');
        if (!form.elements.partnerId.value) setFieldError(form.elements.partnerId, 'Escolha quem vende este produto.');
      } catch (err) {
        status.className = 'text-sm text-lost-600';
        status.textContent = err instanceof ApiError ? err.message : 'Sem conexão com o servidor.';
      } finally {
        button.disabled = false;
      }
    },
  }, icon('search', { size: 16 }), 'Buscar');

  const node = el('fieldset', { class: 'card space-y-3 border-brand-500/40 bg-brand-50/40' },
    el('legend', { class: 'flex items-center gap-2 text-lg font-semibold' }, icon('arrow-right', { class: 'text-brand-600' }), 'Importar de um link'),
    el('p', { class: 'text-sm text-stone-600' },
      'Cole o link do produto na loja do parceiro: nome, descrição, preço, fotos e o parceiro (pelo site) são preenchidos para você revisar. ',
      'Alguns sites não permitem leitura automática; nesses, preencha à mão.'),
    el('div', { class: 'flex flex-col gap-2 sm:flex-row' }, urlInput, button),
    status,
    galleryBox,
  );
  return {
    node,
    selectedImageUrls: () => images.filter((i) => i.checked).map((i) => i.url),
    newPartner: () => newPartner,
  };
}

/** "Atualizar do link" (BR-STORE-011), só na edição de produto com link. */
function refreshBox(product, form) {
  if (!product?.url) return null;
  const info = el('p', { class: 'text-sm text-stone-600' },
    `Preço consultado em ${formatDate(product.priceCheckedAt ?? product.updatedAt)}.`);
  const button = el('button', {
    type: 'button',
    class: 'btn btn-outline btn-sm',
    onclick: async () => {
      button.disabled = true;
      try {
        const { product: fresh, changed } = await api(`/admin/products/${product.id}/refresh`, { method: 'POST' });
        form.elements.priceCents.value = centsToInput(fresh.priceCents);
        form.elements.promoPriceCents.value = centsToInput(fresh.promoPriceCents);
        form.elements.stock.value = String(fresh.stock);
        info.textContent = `Preço consultado em ${formatDate(fresh.priceCheckedAt)}.`;
        const notes = [];
        if (changed.priceCents) notes.push(`preço de ${centsToInput(changed.priceCents[0])} para ${centsToInput(changed.priceCents[1])}`);
        if (changed.inStock) notes.push(changed.inStock[1] ? 'voltou a ter estoque' : 'ficou esgotado na loja');
        showFlash(notes.length ? `Atualizado pelo link: ${notes.join(', ')}.` : 'Conferido no link: nada mudou.', notes.length ? 'success' : 'info');
      } catch (err) {
        showFlash(err instanceof ApiError ? err.message : 'Sem conexão com o servidor.', 'danger');
      } finally {
        button.disabled = false;
      }
    },
  }, icon('arrow-uturn-left', { size: 16 }), 'Atualizar do link');
  return el('div', { class: 'card flex flex-wrap items-center justify-between gap-3 p-4 sm:p-4' }, info, button);
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
      const importer = importBox(form);
      content.replaceChildren(...[editId ? refreshBox(product, form) : importer.node, form].filter(Boolean));
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
        // "Nova loja" escolhida: a API cadastra a loja como parceiro junto com o produto (BR-STORE-012)
        if (data.partnerId === NEW_PARTNER) {
          delete data.partnerId;
          data.newPartner = importer.newPartner();
        }
        await withSubmitting(form, async () => {
          try {
            const { product: saved } = await api(editId ? `/admin/products/${editId}` : '/admin/products', {
              method: editId ? 'PATCH' : 'POST',
              json: data,
            });
            const problems = await syncPhotos(`/admin/products/${saved.id}`, picker, (t) => (submitButton.textContent = t));
            // Fotos escolhidas na importação: o servidor baixa e trata como as enviadas (BR-PHOTO-*).
            const imported = editId ? [] : importer.selectedImageUrls();
            if (imported.length) {
              submitButton.textContent = 'Baixando as fotos da loja…';
              try {
                const { rejected } = await api(`/admin/products/${saved.id}/photos/import`, { method: 'POST', json: { urls: imported } });
                problems.push(...rejected.map((r) => r.message));
              } catch (err) {
                problems.push(err instanceof ApiError ? err.message : 'Não consegui baixar as fotos da loja.');
              }
            }
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
