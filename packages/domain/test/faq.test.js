import { test } from 'node:test';
import assert from 'node:assert/strict';
import { askFaq, tokenize, FAQ, FAQ_TOPICS, popularFaq, faqById, MIN_SCORE } from '../src/faq.js';

test('BR-FAQ-001 normalização: acento, maiúscula, pontuação, plural, palavras vazias e sinônimos', () => {
  assert.deepEqual(tokenize('Como faço pra ANUNCIAR meus Cães?'), ['anuncio', 'cachorro']);
  assert.deepEqual(tokenize('Achei uma gatinha!!!'), ['encontr', 'gato']);
  assert.deepEqual(tokenize('apaguei as fotos'), ['excluir', 'foto']);
  assert.deepEqual(tokenize(''), []);
  assert.deepEqual(tokenize(null), []);
});

/** Perguntas escritas como as pessoas escrevem (sem acento, com gíria, erro de concordância…). */
const CASES = {
  'perdi meu cachorro': 'perdi-meu-pet',
  'socorro meu gato fugiu': 'perdi-meu-pet',
  'Achei um gato na rua!': 'encontrei-um-pet',
  'apareceu um cachorro aqui em casa': 'encontrei-um-pet',
  'como faço pra anunciar': 'como-publicar',
  'quantas fotos posso por': 'fotos',
  'a foto nao envia': 'fotos',
  'como apago meu anuncio': 'editar-anuncio',
  'quero deletar meu post': 'editar-anuncio',
  'meu cachorro voltou pra casa': 'editar-anuncio',
  'o mapa nao aparece no meu post': 'mapa-do-anuncio',
  'como compartilho no whats': 'compartilhar',
  'quero adotar um filhote': 'adotar',
  'doei meu cachorro': 'doar-para-adocao',
  'quero doar meus filhotes': 'doar-para-adocao',
  'como me cadastro': 'criar-conta',
  'esqueci a senha': 'esqueci-senha',
  'minha conta foi bloqueada': 'conta-desativada',
  'meu anuncio sumiu': 'anuncio-sumiu',
  'tem veterinario perto?': 'mapa-parceiros',
  'vocês vendem ração?': 'loja',
  'sou de uma ONG e quero ser parceiro': 'ser-parceiro',
  'pediram pix pra devolver meu cão': 'golpes',
  'meu telefone aparece no site?': 'privacidade',
  'é de graça?': 'gratuito',
  'quero falar com um atendente': 'falar-com-equipe',
};

test('BR-FAQ-002 perguntas reais caem na resposta certa', () => {
  const wrong = [];
  for (const [question, id] of Object.entries(CASES)) {
    const got = askFaq(question).answer?.id ?? null;
    if (got !== id) wrong.push(`"${question}" → ${got} (esperado ${id})`);
  }
  assert.deepEqual(wrong, []);
});

test('BR-FAQ-003 resposta vem com até 3 relacionadas, sem repetir a principal', () => {
  const r = askFaq('perdi meu cachorro, como anuncio?');
  assert.ok(r.answer);
  assert.ok(r.related.length <= 3);
  assert.ok(!r.related.some((e) => e.id === r.answer.id));
  assert.deepEqual(r.suggestions, []);
});

test('BR-FAQ-004 sem resposta boa: sugestões populares (com o contato)', () => {
  for (const q of ['asdfgh qwerty', 'oi', '', '?!']) {
    const r = askFaq(q);
    assert.equal(r.answer, null, q);
    assert.ok(r.suggestions.length >= 4, q);
    assert.ok(r.suggestions.some((e) => e.id === 'falar-com-equipe'), q);
  }
  assert.ok(MIN_SCORE > 0);
});

test('conteúdo do FAQ bem formado: ids únicos, assunto conhecido, links com rótulo', () => {
  const ids = FAQ.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const e of FAQ) {
    assert.match(e.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, e.id);
    assert.ok(FAQ_TOPICS[e.topic], `${e.id}: assunto ${e.topic}`);
    assert.ok(e.question.endsWith('?') || e.question.endsWith('.'), e.id);
    assert.ok(e.answer.length > 20 && e.examples.length >= 3 && e.keywords.length >= 1, e.id);
    for (const l of e.links) assert.ok(l.label && (l.href.startsWith('/') || l.href === 'contact:whatsapp'), `${e.id}: ${l.href}`);
    // cada pergunta precisa ser achada pelo próprio texto
    assert.equal(askFaq(e.question).answer?.id, e.id, `a própria pergunta de ${e.id}`);
  }
  assert.equal(popularFaq().length, 6);
  assert.equal(faqById('nao-existe'), null);
});
