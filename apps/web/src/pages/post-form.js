/**
 * Formulário /posts/criar e /posts/:id/editar — T4.15 · BR-POST-001, BR-POST-007, PERM-001
 */
import '../styles/main.css';
import { setupListingForm } from '../lib/listing-form.js';

const form = document.getElementById('post-form');

/** Texto do campo de local e da recompensa muda conforme perdido/encontrado. */
function syncStatusUi() {
  const found = form.elements.status.value === 'found';
  document.getElementById('location-label').textContent = found ? 'Onde foi encontrado' : 'Onde foi visto por último';
  document.getElementById('reward-field').hidden = found;
}
form.addEventListener('change', (e) => e.target.name === 'status' && syncStatusUi());

await setupListingForm({
  form,
  editId: Number(/^\/posts\/(\d+)\/editar/.exec(location.pathname)?.[1]) || null,
  apiPath: '/posts',
  key: 'post',
  pagePath: (id) => `/posts/${id}`,
  listHref: '/posts/',
  addressField: 'lastSeenLocation',
  fields: ['status', 'title', 'description', 'petType', 'petName', 'petBreed', 'petColor', 'petSize',
    'lastSeenLocation', 'contactPhone', 'contactEmail', 'reward'],
  messages: { created: 'Seu anúncio foi publicado com sucesso!', updated: 'Anúncio atualizado com sucesso!', editTitle: 'Editar anúncio' },
  // BR-POST-007 — ?status=lost|found pré-seleciona a situação.
  defaults: (user) => {
    const status = new URLSearchParams(location.search).get('status');
    return { status: ['lost', 'found'].includes(status) ? status : 'lost', contactPhone: user.phone ?? '' };
  },
  beforeSubmit: (data) => (data.status === 'found' ? { ...data, reward: '' } : data),
  onFill: syncStatusUi,
});
