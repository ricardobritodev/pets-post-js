/**
 * faq.js — "Cérebro" do chatbot de ajuda: acha a melhor resposta do FAQ para o que a pessoa digitou.
 * specs/site/faq.md (BR-FAQ-001..004) · ADR 007. Puro, sem I/O: roda no navegador (BR-FAQ-006).
 */
import { FAQ, FAQ_POPULAR, FAQ_TOPICS } from './faq-data.js';

export { FAQ, FAQ_POPULAR, FAQ_TOPICS };

/** Palavras que não ajudam a diferenciar uma pergunta da outra. */
const STOPWORDS = new Set(`a o as os um uma uns umas de da do das dos em na no nas nos por pra para pro com sem
e ou que se como qual quais quando onde porque por quê pq eu me meu minha meus minhas voce vc seu sua
ele ela isso esse essa este esta aqui la ja nao sim tem ter faco fazer posso pode quero queria gostaria
preciso tenho foi era ser estou esta sao muito mais menos ao aos the oi ola bom dia boa tarde noite
consigo consegue alguem algum alguma site pets post petspost`.split(/\s+/));

/** Sinônimos → uma forma só (depois de tirar acento e plural). */
const SYNONYMS = new Map(Object.entries({
  cao: 'cachorro', caes: 'cachorro', cachorra: 'cachorro', cachorrinho: 'cachorro', dog: 'cachorro', filhote: 'filhote',
  gata: 'gato', gatinho: 'gato', gatinha: 'gato', felino: 'gato',
  bicho: 'pet', animal: 'pet', animais: 'pet', bichinho: 'pet',
  achei: 'encontr', acharam: 'encontr', encontrei: 'encontr', encontrado: 'encontr', encontrada: 'encontr', encontrar: 'encontr',
  sumiu: 'perd', perdi: 'perd', perdido: 'perd', perdida: 'perd', fugiu: 'perd', desapareceu: 'perd', desaparecido: 'perd',
  doar: 'doacao', doando: 'doacao', doei: 'doacao', doamos: 'doacao', doou: 'doacao', adotar: 'adocao', adotado: 'adocao', adotada: 'adocao',
  anunciar: 'anuncio', anuncios: 'anuncio', post: 'anuncio', postar: 'anuncio', publicar: 'anuncio', publicacao: 'anuncio',
  apagar: 'excluir', deletar: 'excluir', remover: 'excluir', tirar: 'excluir',
  alterar: 'editar', mudar: 'editar', trocar: 'editar', corrigir: 'editar',
  imagem: 'foto', imagens: 'foto', fotografia: 'foto',
  veterinaria: 'veterinario', vet: 'veterinario', clinica: 'veterinario',
  gratis: 'gratuito', graca: 'gratuito',
  cadastrar: 'cadastro', registrar: 'cadastro', registro: 'cadastro', inscrever: 'cadastro',
  whats: 'whatsapp', zap: 'whatsapp', wpp: 'whatsapp',
}));

/** Sinônimos por raiz: cobrem as conjugações ("apago", "apaguei", "apagando" → excluir). */
const ROOT_SYNONYMS = [
  ['apag', 'excluir'], ['delet', 'excluir'], ['exclu', 'excluir'], ['remov', 'excluir'],
  ['edit', 'editar'], ['alter', 'editar'], ['corrig', 'editar'],
  ['anunc', 'anuncio'], ['publiq', 'anuncio'], ['public', 'anuncio'], ['divulg', 'anuncio'],
  ['compartilh', 'compartilhar'], ['cadastr', 'cadastro'], ['adot', 'adocao'], ['doa', 'doacao'],
];

const stripAccents = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Plural simples: "fotos" → "foto", "anuncios" → "anuncio" (não mexe em palavras curtas). */
function singular(word) {
  if (word.length > 4 && word.endsWith('oes')) return `${word.slice(0, -3)}ao`;
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

function canon(word) {
  const w = singular(word);
  const direct = SYNONYMS.get(word) ?? SYNONYMS.get(w);
  if (direct) return direct;
  const root = ROOT_SYNONYMS.find(([prefix]) => w.startsWith(prefix) && w.length >= prefix.length + 1);
  return root ? root[1] : w;
}

/** BR-FAQ-001 — texto → palavras comparáveis. */
export function tokenize(text) {
  return stripAccents(String(text ?? '').toLowerCase())
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w.length > 1 && !STOPWORDS.has(w))
    .map(canon);
}

/** Mesma palavra, ou mesma raiz (ex.: "publico" × "publicar"): prefixo comum de 5+ letras. */
function sameWord(a, b) {
  if (a === b) return true;
  const min = Math.min(a.length, b.length);
  if (min < 5) return false;
  let i = 0;
  while (i < min && a[i] === b[i]) i++;
  return i >= 5;
}

const indexed = FAQ.map((entry) => ({
  entry,
  keywords: [...new Set(entry.keywords.flatMap(tokenize))],
  words: [...new Set([entry.question, ...entry.examples].flatMap(tokenize))],
  phrases: new Set([entry.question, ...entry.examples].map((t) => tokenize(t).join(' '))),
}));

/** BR-FAQ-002 — nota de uma pergunta do FAQ para as palavras digitadas. */
function scoreEntry(item, tokens, joined) {
  let raw = 0;
  let matched = 0;
  for (const t of tokens) {
    if (item.keywords.some((k) => sameWord(t, k))) {
      raw += 3;
      matched++;
    } else if (item.words.some((w) => sameWord(t, w))) {
      raw += 1;
      matched++;
    }
  }
  if (item.phrases.has(joined)) raw += 5; // digitou igualzinho a um dos exemplos
  const coverage = tokens.length ? matched / tokens.length : 0;
  return raw * (0.5 + 0.5 * coverage);
}

/** Nota mínima para virar resposta (BR-FAQ-002). */
export const MIN_SCORE = 2;

/**
 * Responde uma pergunta.
 * @param {string} text
 * @returns {{ answer: object|null, related: object[], suggestions: object[] }}
 *   answer = entrada do FAQ (ou null); related = até 3 parecidas (BR-FAQ-003);
 *   suggestions = assuntos populares quando não há resposta (BR-FAQ-004).
 */
export function askFaq(text) {
  const tokens = tokenize(text);
  const joined = tokens.join(' ');
  const ranked = indexed
    .map((item) => ({ entry: item.entry, score: tokens.length ? scoreEntry(item, tokens, joined) : 0 }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  if (!best || best.score < MIN_SCORE) {
    return { answer: null, related: ranked.slice(0, 3).map((r) => r.entry), suggestions: popularFaq() };
  }
  return { answer: best.entry, related: ranked.slice(1, 4).filter((r) => r.score >= 1).map((r) => r.entry), suggestions: [] };
}

export const faqById = (id) => FAQ.find((e) => e.id === id) ?? null;
export const popularFaq = () => FAQ_POPULAR.map(faqById).filter(Boolean);
