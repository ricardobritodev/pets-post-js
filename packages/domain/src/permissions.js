/**
 * permissions.js — Regras de autorização puras.
 * Spec: specs/domain/permissions.md
 *
 * `actor` é o usuário logado ({ id, role, isActive }) ou null (visitante).
 * `resource` é qualquer entidade com { userId, isActive }.
 */

export const isAdmin = (actor) => actor?.role === 'admin';

/** PERM-001: dono ou admin podem editar/excluir/resolver/marcar adotado. */
export function canManage(actor, resource) {
  if (!actor || !resource) return false;
  return actor.id === resource.userId || isAdmin(actor);
}

/**
 * PERM-002: post ativo é público; post inativo só é visível para dono/admin.
 * Para os demais a API deve responder 404 (não 403) — não revela existência.
 */
export function canView(actor, resource) {
  if (!resource) return false;
  if (resource.isActive) return true;
  return canManage(actor, resource);
}

/** PERM-005: admin não pode desativar a própria conta. */
export function canToggleUser(actor, targetUser) {
  if (!isAdmin(actor) || !targetUser) return false;
  return actor.id !== targetUser.id;
}
