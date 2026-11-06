/**
 * Serviço do painel admin — BR-ADMIN-001..005, PERM-003/005, BR-PARTNER-002.
 */
import { HttpError } from '../../middleware/errors.js';
import { toAdminUser, toAdminPost, toAdminAdoption, toAdminPartner } from './presenter.js';

const notFound = (what) => new HttpError(404, 'NOT_FOUND', `${what} não encontrado.`);
const mapPage = (page, fn) => ({ ...page, items: page.items.map(fn) });

/**
 * @param {{
 *   admin: ReturnType<typeof import('./repository.js').createAdminRepository>,
 *   geocoder: { geocode: (address: string) => Promise<{ lat: number, lng: number } | null> } | null,
 *   sessions: { destroyAllForUser?: (userId: number) => Promise<number> },
 *   securityLog: (event: string, fields: object) => void,
 * }} deps
 */
export function createAdminService({ admin, geocoder, sessions, securityLog }) {
  /**
   * Geocodifica na hora (o admin precisa saber se o parceiro vai aparecer no mapa).
   * @returns {Promise<{ coords: object, geocoded: boolean|null }>}
   */
  async function partnerCoords(data, before) {
    if (data.lat != null && data.lng != null) return { coords: { lat: data.lat, lng: data.lng }, geocoded: null };
    const address = data.address ?? before?.address;
    const changed = data.address !== undefined && data.address !== before?.address;
    const missing = !before || before.lat == null || before.lng == null;
    if (!changed && !missing) return { coords: {}, geocoded: null }; // BR-GEO-002
    const found = geocoder ? await geocoder.geocode(address) : null;
    // Endereço mudou e não achou: as coordenadas antigas apontariam para o lugar errado.
    if (!found) return { coords: changed ? { lat: null, lng: null } : {}, geocoded: false };
    return { coords: { lat: found.lat, lng: found.lng }, geocoded: true };
  }

  /** O formulário usa `type`; a tabela, `partner_type`. */
  const toPartnerData = ({ type, lat, lng, ...rest }) => ({ ...rest, ...(type !== undefined && { partnerType: type }) });

  return {
    /** BR-ADMIN-001/004 */
    async stats() {
      const [counts, [posts, adoptions, users]] = await Promise.all([admin.counts(), admin.recent()]);
      return {
        ...counts,
        recent: { posts: posts.map(toAdminPost), adoptions: adoptions.map(toAdminAdoption), users: users.map(toAdminUser) },
      };
    },

    listUsers: async (query) => mapPage(await admin.listUsers(query), toAdminUser),

    /** BR-ADMIN-002/005, PERM-005 */
    async toggleUser(id, actor) {
      const user = id ? await admin.findUser(id) : null;
      if (!user) throw notFound('Usuário');
      if (user.id === actor.id) {
        throw new HttpError(400, 'VALIDATION_ERROR', 'Você não pode desativar sua própria conta.');
      }
      const updated = await admin.setUserActive(id, !user.isActive);
      let sessionsClosed = 0;
      if (!updated.isActive && sessions.destroyAllForUser) sessionsClosed = await sessions.destroyAllForUser(id);
      securityLog('admin_user_toggled', { adminId: actor.id, userId: id, isActive: updated.isActive, sessionsClosed });
      return toAdminUser(updated);
    },

    listPosts: async (query) => mapPage(await admin.listPosts(query), toAdminPost),
    listAdoptions: async (query) => mapPage(await admin.listAdoptions(query), toAdminAdoption),

    /** BR-ADMIN-003 */
    async setPostVisibility(id, isActive, actor) {
      const post = id ? await admin.setPostActive(id, isActive) : null;
      if (!post) throw notFound('Anúncio');
      securityLog('admin_post_visibility', { adminId: actor.id, postId: id, isActive });
      return toAdminPost(post);
    },
    async setAdoptionVisibility(id, isActive, actor) {
      const a = id ? await admin.setAdoptionActive(id, isActive) : null;
      if (!a) throw notFound('Anúncio');
      securityLog('admin_adoption_visibility', { adminId: actor.id, adoptionId: id, isActive });
      return toAdminAdoption(a);
    },

    listPartners: async (query) => mapPage(await admin.listPartners(query), toAdminPartner),

    async getPartner(id) {
      const p = id ? await admin.findPartner(id) : null;
      if (!p) throw notFound('Parceiro');
      return toAdminPartner(p);
    },

    /** BR-PARTNER-002 */
    async createPartner(data) {
      const { coords, geocoded } = await partnerCoords(data, null);
      const partner = await admin.createPartner({ ...toPartnerData(data), ...coords });
      return { partner: toAdminPartner(partner), geocoded };
    },

    async updatePartner(id, data) {
      const before = id ? await admin.findPartner(id) : null;
      if (!before) throw notFound('Parceiro');
      const { coords, geocoded } = await partnerCoords(data, before);
      const partner = await admin.updatePartner(id, { ...toPartnerData(data), ...coords });
      return { partner: toAdminPartner(partner), geocoded };
    },

    async deletePartner(id) {
      if (!id || !(await admin.findPartner(id))) throw notFound('Parceiro');
      await admin.deletePartner(id);
    },
  };
}
