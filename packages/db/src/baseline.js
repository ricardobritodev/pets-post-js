/**
 * baseline.js — Adota um banco do Pets Post (Flask) existente no Prisma Migrate.
 * Spec: specs/data/migration-plan.md (Passo 1) · BR-DATA-004
 *
 * O banco Flask foi criado pelo SQLAlchemy e DIVERGE do schema.prisma em estrutura
 * (nunca em colunas/tipos):
 *   - sem DEFAULT no banco (eram do ORM);
 *   - FKs sem ON DELETE CASCADE → sem alinhar, excluir post com fotos falha (P2003);
 *   - nomes de índices/FKs diferentes (ix_users_email, pet_posts_ibfk_1, ...);
 *   - tabela extra `alembic_version` (Flask-Migrate) — MANTIDA, para rollback.
 *
 * Fluxo: inspect (só leitura) → align (DDL, sem tocar em dados) → resolve 0_init → verify.
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const require = createRequire(import.meta.url);
const PRISMA_CLI = resolve(require.resolve('prisma/package.json'), '..', 'build/index.js');
const PKG_DIR = resolve(import.meta.dirname, '..');
const SCHEMA = resolve(PKG_DIR, 'prisma/schema.prisma');
export const BASELINE_MIGRATION = '0_init';

/** Tabelas que existem no banco Flask mas não no schema Prisma e devem ser preservadas. */
export const PRESERVED_TABLES = Object.freeze(['alembic_version']);

const TABLES = Object.freeze({
  users: 'users',
  petPosts: 'pet_posts',
  photos: 'photos',
  adoptionPosts: 'adoption_posts',
  adoptionPhotos: 'adoption_photos',
  partners: 'partners',
});

/** Registros órfãos impediriam recriar as FKs (ADD CONSTRAINT falha). */
const ORPHAN_QUERIES = Object.freeze({
  photosSemPost: 'SELECT COUNT(*) AS n FROM photos f LEFT JOIN pet_posts p ON p.id = f.post_id WHERE p.id IS NULL',
  fotosAdocaoSemAnuncio:
    'SELECT COUNT(*) AS n FROM adoption_photos f LEFT JOIN adoption_posts a ON a.id = f.adoption_post_id WHERE a.id IS NULL',
  postsSemDono: 'SELECT COUNT(*) AS n FROM pet_posts p LEFT JOIN users u ON u.id = p.user_id WHERE u.id IS NULL',
  anunciosSemDono: 'SELECT COUNT(*) AS n FROM adoption_posts a LEFT JOIN users u ON u.id = a.user_id WHERE u.id IS NULL',
});

/** Executa o CLI do Prisma e devolve { status, stdout, stderr }. */
function prisma(args, url) {
  const r = spawnSync(process.execPath, [PRISMA_CLI, ...args], {
    cwd: PKG_DIR,
    env: { ...process.env, DATABASE_URL: url },
    encoding: 'utf8',
  });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function prismaOrThrow(args, url, what) {
  const r = prisma(args, url);
  if (r.status !== 0) throw new Error(`${what} falhou:\n${r.stderr || r.stdout}`);
  return r.stdout;
}

/**
 * Remove do SQL gerado pelo `migrate diff` os blocos que apagariam tabelas preservadas.
 * O diff separa cada passo com uma linha de comentário "-- Xxx".
 */
export function filterAlignmentSql(sql, preserved = PRESERVED_TABLES) {
  const blocks = sql.split(/\n(?=-- )/);
  const dropsPreserved = (b) => preserved.some((t) => new RegExp(`DROP TABLE \`${t}\``).test(b));
  return blocks
    .filter((b) => !dropsPreserved(b))
    .join('\n')
    .trim();
}

/** SQL que leva o banco ao schema.prisma (sem os DROPs de tabelas preservadas). */
export function alignmentSql(url) {
  const raw = prismaOrThrow(
    ['migrate', 'diff', '--from-url', url, '--to-schema-datamodel', SCHEMA, '--script'],
    url,
    'migrate diff',
  );
  const sql = filterAlignmentSql(raw);
  // Diff vazio = "-- This is an empty migration."
  return /^-- This is an empty migration\.?$/.test(sql) || sql === '' ? '' : sql;
}

async function withClient(url, fn) {
  const db = new PrismaClient({ datasourceUrl: url, log: [] });
  try {
    return await fn(db);
  } finally {
    await db.$disconnect();
  }
}

/** Leitura apenas: contagens, órfãos, estado das migrations. */
export async function inspect(url) {
  return withClient(url, async (db) => {
    const tables = (await db.$queryRawUnsafe('SHOW TABLES')).map((r) => Object.values(r)[0]);
    const missing = Object.values(TABLES).filter((t) => !tables.includes(t));
    if (missing.length) throw new Error(`Banco não parece ser do Pets Post: faltam tabelas ${missing.join(', ')}.`);

    const counts = {};
    for (const [key, table] of Object.entries(TABLES)) {
      const [{ n }] = await db.$queryRawUnsafe(`SELECT COUNT(*) AS n FROM \`${table}\``);
      counts[key] = Number(n);
    }
    const orphans = {};
    for (const [key, sql] of Object.entries(ORPHAN_QUERIES)) {
      const [{ n }] = await db.$queryRawUnsafe(sql);
      orphans[key] = Number(n);
    }
    let baselined = false;
    if (tables.includes('_prisma_migrations')) {
      const rows = await db.$queryRawUnsafe(
        'SELECT COUNT(*) AS n FROM _prisma_migrations WHERE migration_name = ? AND finished_at IS NOT NULL',
        BASELINE_MIGRATION,
      );
      baselined = Number(rows[0].n) > 0;
    }
    return { counts, orphans, baselined, extraTables: tables.filter((t) => !Object.values(TABLES).includes(t)) };
  });
}

export const MAX_ALIGN_PASSES = 3;

/**
 * Aplica o SQL de alinhamento até o diff ficar vazio.
 *
 * DDL no MySQL não é transacional: se um comando falhar, os anteriores já valeram.
 * Por isso cada passada recalcula o diff a partir do estado REAL do banco — o que
 * também torna o processo retomável. Exemplo real (MySQL 9+/26): ao remover uma FK,
 * o índice implícito antigo some e o novo nasce com o nome da FK; o RENAME INDEX
 * planejado falha e a passada seguinte renomeia o índice certo.
 * Aborta se uma passada não fizer progresso (mesmo SQL de antes).
 */
async function alignSchema(url, { outDir, log }) {
  const dir = outDir ?? mkdtempSync(join(tmpdir(), 'petspost-baseline-'));
  mkdirSync(dir, { recursive: true });
  const executed = [];
  let previous = null;

  for (let pass = 1; pass <= MAX_ALIGN_PASSES; pass++) {
    const sql = alignmentSql(url);
    if (!sql) {
      log(pass === 1 ? 'Estrutura já alinhada ao schema.prisma.' : 'Estrutura alinhada.');
      break;
    }
    if (sql === previous) throw new Error(`Alinhamento não progrediu. SQL pendente:\n${sql}`);
    previous = sql;

    const file = resolve(dir, `baseline-align.pass${pass}.sql`);
    writeFileSync(file, sql + '\n');
    log(`Alinhando estrutura (passada ${pass}: defaults, FKs com CASCADE, nomes de índices)...`);
    const r = prisma(['db', 'execute', '--file', file, '--schema', SCHEMA], url);
    executed.push(`-- ===== passada ${pass} (${r.status === 0 ? 'ok' : 'falhou, refeita na próxima'}) =====\n${sql}`);
    if (r.status !== 0) {
      log(`Passada ${pass} parou em: ${(r.stderr.match(/Error: .*/) ?? ['?'])[0]} — recalculando o diff.`);
    }
    if (pass === MAX_ALIGN_PASSES && alignmentSql(url)) {
      throw new Error(`Alinhamento incompleto após ${MAX_ALIGN_PASSES} passadas.`);
    }
  }
  if (executed.length) writeFileSync(resolve(dir, 'baseline-align.sql'), executed.join('\n\n') + '\n');
  return executed;
}

/**
 * Executa o baseline completo. Idempotente: se 0_init já está aplicada, só verifica.
 * @param {string} url
 * @param {{ outDir?: string, log?: (msg: string) => void }} [opts]
 */
export async function applyBaseline(url, { outDir, log = () => {} } = {}) {
  const before = await inspect(url);

  const orphanTotal = Object.values(before.orphans).reduce((a, b) => a + b, 0);
  if (orphanTotal > 0) {
    throw new Error(
      `Há registros órfãos ${JSON.stringify(before.orphans)}; as FKs não podem ser recriadas. ` +
        'Corrija os dados (com backup!) antes do baseline.',
    );
  }

  await alignSchema(url, { outDir, log });

  if (!before.baselined) {
    log(`Marcando ${BASELINE_MIGRATION} como aplicada...`);
    prismaOrThrow(['migrate', 'resolve', '--applied', BASELINE_MIGRATION], url, 'migrate resolve');
  } else {
    log(`${BASELINE_MIGRATION} já estava marcada como aplicada.`);
  }

  return verifyBaseline(url, before.counts);
}

/** Confere: sem diferença de schema, migrations em dia e nenhuma linha alterada. */
export async function verifyBaseline(url, expectedCounts) {
  const after = await inspect(url);
  const remainingSql = alignmentSql(url);
  const status = prisma(['migrate', 'status'], url);
  const countsUnchanged = !expectedCounts || JSON.stringify(after.counts) === JSON.stringify(expectedCounts);
  return {
    ok: remainingSql === '' && status.status === 0 && after.baselined && countsUnchanged,
    schemaInSync: remainingSql === '',
    remainingSql,
    migrateStatusOk: status.status === 0,
    baselined: after.baselined,
    countsUnchanged,
    counts: after.counts,
    preservedTables: after.extraTables.filter((t) => PRESERVED_TABLES.includes(t)),
  };
}
