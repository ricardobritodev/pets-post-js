// specs/domain/permissions.md
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canManage, canView, canToggleUser } from '../src/permissions.js';

const owner = { id: 1, role: 'user' };
const other = { id: 2, role: 'user' };
const admin = { id: 9, role: 'admin' };
const activePost = { userId: 1, isActive: true };
const inactivePost = { userId: 1, isActive: false };

test('PERM-001 dono e admin podem gerenciar; outros e visitante não', () => {
  assert.equal(canManage(owner, activePost), true);
  assert.equal(canManage(admin, activePost), true);
  assert.equal(canManage(other, activePost), false);
  assert.equal(canManage(null, activePost), false);
});

test('PERM-002 post ativo é público', () => {
  assert.equal(canView(null, activePost), true);
  assert.equal(canView(other, activePost), true);
});

test('PERM-002 post inativo só para dono/admin', () => {
  assert.equal(canView(null, inactivePost), false);
  assert.equal(canView(other, inactivePost), false);
  assert.equal(canView(owner, inactivePost), true);
  assert.equal(canView(admin, inactivePost), true);
});

test('PERM-005 admin não desativa a si mesmo; usuário comum não desativa ninguém', () => {
  assert.equal(canToggleUser(admin, other), true);
  assert.equal(canToggleUser(admin, admin), false);
  assert.equal(canToggleUser(owner, other), false);
});
