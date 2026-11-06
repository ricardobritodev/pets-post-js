/**
 * Formulário /adocao/criar e /adocao/:id/editar — BR-ADOPT-001/004 · PERM-001
 */
import '../styles/main.css';
import { setupListingForm } from '../lib/listing-form.js';

await setupListingForm({
  form: document.getElementById('adoption-form'),
  editId: Number(/^\/adocao\/(\d+)\/editar/.exec(location.pathname)?.[1]) || null,
  apiPath: '/adoption',
  key: 'adoption',
  pagePath: (id) => `/adocao/${id}`,
  listHref: '/adocao/',
  addressField: 'location',
  fields: ['title', 'description', 'petType', 'petName', 'petBreed', 'petColor', 'petSize',
    'adopterRequirements', 'location', 'contactPhone', 'contactEmail'],
  checkboxes: ['isNeutered', 'isVaccinated'],
  messages: {
    created: 'Anúncio de adoção publicado com sucesso!',
    updated: 'Anúncio atualizado com sucesso!',
    editTitle: 'Editar anúncio de adoção',
  },
});
