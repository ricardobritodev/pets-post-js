/**
 * Cria (ou promove) um administrador. Feito para produção, onde o seed de dev se recusa a rodar.
 *
 *   npm run admin:create -w @petspost/api -- --email voce@exemplo.com --name "Seu Nome"
 *
 * A senha é pedida no terminal (não aparece na tela) ou lida de ADMIN_PASSWORD.
 * Se o email já existe, a conta vira admin e é reativada; a senha só muda com --reset-password.
 */
import { createInterface } from 'node:readline';
import { prisma } from '@petspost/db';
import { hashPassword, PASSWORD_MIN_LENGTH } from '@petspost/domain';
import { emailSchema } from '@petspost/contracts';

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

/** Pergunta sem mostrar o que é digitado. */
function askHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl.stdoutMuted = false;
    rl._writeToOutput = (s) => rl.output.write(rl.stdoutMuted ? '' : s);
    rl.question(question, (answer) => {
      rl.output.write('\n');
      rl.close();
      resolve(answer);
    });
    rl.stdoutMuted = true;
  });
}

async function main() {
  const email = emailSchema.safeParse(arg('email') ?? '');
  const name = (arg('name') ?? '').trim();
  const resetPassword = process.argv.includes('--reset-password');
  if (!email.success) throw new Error('Informe um email válido: --email voce@exemplo.com');

  const existing = await prisma.user.findUnique({ where: { email: email.data } });
  if (!existing && !name) throw new Error('Conta nova precisa de nome: --name "Seu Nome"');

  let passwordHash;
  if (!existing || resetPassword) {
    const password = process.env.ADMIN_PASSWORD ?? (await askHidden('Senha do admin: '));
    if (password.length < PASSWORD_MIN_LENGTH) throw new Error(`A senha precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`);
    if (!process.env.ADMIN_PASSWORD && password !== (await askHidden('Repita a senha: '))) throw new Error('As senhas não conferem.');
    passwordHash = await hashPassword(password);
  }

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { role: 'admin', isActive: true, ...(name && { name }), ...(passwordHash && { passwordHash }) },
    });
    console.log(`Conta ${email.data} agora é admin${passwordHash ? ' (senha trocada)' : ''}.`);
  } else {
    await prisma.user.create({ data: { name, email: email.data, passwordHash, role: 'admin' } });
    console.log(`Admin ${email.data} criado.`);
  }
}

try {
  await main();
} catch (err) {
  console.error(`Erro: ${err.message}`);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
