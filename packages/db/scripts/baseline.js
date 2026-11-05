/**
 * Baseline de um banco Flask existente (BR-DATA-004).
 *
 *   npm run db:baseline -- --url "mysql://user:senha@host:3306/banco"            # relatório (só leitura)
 *   npm run db:baseline -- --url "mysql://user:senha@host:3306/banco" --apply    # alinha + resolve 0_init
 *
 * Sem --url usa DATABASE_URL. NUNCA rode --apply direto em produção sem antes:
 *   1. fazer backup (mysqldump) e
 *   2. testar o mesmo comando numa cópia restaurada desse backup.
 * Procedimento completo: packages/db/scripts/BASELINE.md
 */
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { inspect, alignmentSql, applyBaseline } from '../src/baseline.js';

const { values } = parseArgs({
  options: { url: { type: 'string' }, apply: { type: 'boolean', default: false } },
});
const url = values.url ?? process.env.DATABASE_URL;
if (!url) {
  console.error('Informe --url "mysql://..." ou defina DATABASE_URL.');
  process.exit(1);
}
const dbName = new URL(url).pathname.slice(1);
const outDir = resolve(import.meta.dirname, 'output', dbName);

try {
  const info = await inspect(url);
  console.log(`\nBanco: ${dbName}`);
  console.log('Linhas por tabela:', info.counts);
  console.log('Registros órfãos:', info.orphans);
  console.log('Tabelas extras (preservadas se conhecidas):', info.extraTables);
  console.log(`0_init já aplicada: ${info.baselined ? 'sim' : 'não'}`);

  if (!values.apply) {
    const sql = alignmentSql(url);
    console.log('\nSQL de alinhamento que o --apply executaria (só estrutura, nenhum dado):\n');
    console.log(sql || '-- nada: estrutura já igual ao schema.prisma');
    console.log('\nNada foi alterado. Rode de novo com --apply para executar.');
    process.exit(0);
  }

  const result = await applyBaseline(url, { outDir, log: (m) => console.log(`→ ${m}`) });
  console.log('\nVerificação:', {
    schemaIgualAoPrisma: result.schemaInSync,
    migrateStatusOk: result.migrateStatusOk,
    baselineRegistrado: result.baselined,
    nenhumaLinhaAlterada: result.countsUnchanged,
    tabelasPreservadas: result.preservedTables,
  });
  console.log(`SQL executado salvo em: ${outDir}/baseline-align.sql`);
  if (!result.ok) {
    console.error('\nBaseline INCOMPLETO. SQL restante:\n' + result.remainingSql);
    process.exit(1);
  }
  console.log('\nBaseline concluído. Daqui pra frente use: npm run db:deploy');
} catch (err) {
  console.error(`\nErro: ${err.message}`);
  process.exit(1);
}
