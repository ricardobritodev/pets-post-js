/**
 * BR-FAQ-005 — todo link do FAQ aponta para uma página que existe (page-routes.js).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FAQ } from '@petspost/domain/faq';
import { resolvePage } from '../page-routes.js';

test('BR-FAQ-005 links internos do FAQ existem no site', () => {
  const broken = [];
  for (const entry of FAQ) {
    for (const { href } of entry.links) {
      if (href === 'contact:whatsapp') continue;
      const path = new URL(href, 'https://x').pathname;
      if (!resolvePage(path)) broken.push(`${entry.id}: ${href}`);
    }
  }
  assert.deepEqual(broken, []);
});
