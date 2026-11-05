// Unitário (sem banco): filtro do SQL de alinhamento do baseline (BR-DATA-004).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterAlignmentSql, PRESERVED_TABLES } from '../src/baseline.js';

test('BR-DATA-004 filterAlignmentSql nunca apaga a alembic_version (rollback para o Flask)', () => {
  const sql = [
    '-- AlterTable\nALTER TABLE `users` MODIFY x;',
    '-- DropTable\nDROP TABLE `alembic_version`;',
    '-- RenameIndex\nALTER TABLE y;',
  ].join('\n\n');
  const out = filterAlignmentSql(sql);
  assert.doesNotMatch(out, /alembic_version/);
  assert.match(out, /MODIFY x/);
  assert.match(out, /ALTER TABLE y/);
  assert.deepEqual(PRESERVED_TABLES, ['alembic_version']);
});

test('filterAlignmentSql mantém DROP de tabelas não preservadas', () => {
  assert.match(filterAlignmentSql('-- DropTable\nDROP TABLE `lixo`;'), /DROP TABLE `lixo`/);
});
