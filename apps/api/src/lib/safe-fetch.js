/**
 * safe-fetch.js — Busca páginas e fotos de sites de fora sem virar porta de entrada para a rede interna
 * (BR-STORE-010; o ataque se chama SSRF).
 *
 *   - só https, porta 443, sem usuário/senha na URL;
 *   - o IP é conferido na hora de conectar (lookup próprio): localhost, rede privada, link-local
 *     (169.254.x, onde ficam os metadados da nuvem), multicast etc. são recusados — inclusive quando o
 *     DNS aponta para eles ou quando um redirecionamento leva para eles;
 *   - até 3 redirecionamentos, tempo máximo, tamanho máximo, gzip/br/deflate;
 *   - User-Agent honesto do Pets Post (não se passa por navegador nem tenta burlar bloqueio de robôs).
 */
import https from 'node:https';
import dns from 'node:dns';
import net from 'node:net';
import zlib from 'node:zlib';

export const USER_AGENT = 'PetsPostBot/2.0 (+https://www.petspost.com.br; importação de produto pelo admin)';

/** Erro com mensagem que pode ir para o admin. */
export class SafeFetchError extends Error {
  constructor(message, code = 'FETCH_FAILED', status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/** Faixas que nunca podem ser acessadas. */
const BLOCKED = new net.BlockList();
for (const [net4, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
]) BLOCKED.addSubnet(net4, prefix, 'ipv4');
for (const [net6, prefix] of [['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8], ['2001:db8::', 32], ['64:ff9b::', 96]]) {
  BLOCKED.addSubnet(net6, prefix, 'ipv6');
}

/** O IP é público? (IPv4 dentro de IPv6, ex. ::ffff:127.0.0.1, é conferido como IPv4.) */
export function isPublicAddress(address) {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  if (mapped) return isPublicAddress(mapped[1]);
  const family = net.isIP(address);
  if (!family) return false;
  return !BLOCKED.check(address, family === 6 ? 'ipv6' : 'ipv4');
}

/** Valida a URL antes de qualquer conexão. */
export function parseSafeUrl(raw) {
  let url;
  try {
    url = new URL(String(raw ?? '').trim());
  } catch {
    throw new SafeFetchError('Link inválido.', 'INVALID_URL');
  }
  if (url.protocol !== 'https:') throw new SafeFetchError('Use um link https://.', 'INVALID_URL');
  if (url.port && url.port !== '443') throw new SafeFetchError('Link com porta diferente da padrão não é aceito.', 'INVALID_URL');
  if (url.username || url.password) throw new SafeFetchError('Link com usuário/senha não é aceito.', 'INVALID_URL');
  // IP escrito direto no link: o Node não consulta o DNS (o lookup seguro não roda), então confere aqui.
  const literal = url.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(literal)) {
    if (!isPublicAddress(literal)) throw new SafeFetchError('Endereço não permitido.', 'BLOCKED_ADDRESS');
  } else if (!url.hostname.includes('.') || url.hostname.endsWith('.local') || url.hostname.endsWith('.internal')) {
    throw new SafeFetchError('Endereço não permitido.', 'BLOCKED_ADDRESS');
  }
  url.hash = '';
  return url;
}

/**
 * @param {{ lookup?: typeof dns.lookup, request?: typeof https.request, timeoutMs?: number, maxRedirects?: number }} [options]
 *   `lookup` e `request` são injetáveis para os testes (sem rede).
 */
export function createSafeFetcher({ lookup = dns.lookup, request = https.request, timeoutMs = 8000, maxRedirects = 3 } = {}) {
  /** lookup que só devolve IPs públicos — a conexão usa exatamente o IP conferido. */
  const safeLookup = (hostname, options, callback) => {
    lookup(hostname, { all: true }, (err, addresses) => {
      if (err) return callback(new SafeFetchError('Não encontrei esse site (DNS).', 'DNS_FAILED'));
      const list = Array.isArray(addresses) ? addresses : [{ address: addresses, family: net.isIP(addresses) }];
      if (!list.length || list.some((a) => !isPublicAddress(a.address))) {
        return callback(new SafeFetchError('Endereço não permitido.', 'BLOCKED_ADDRESS'));
      }
      if (options?.all) return callback(null, list);
      return callback(null, list[0].address, list[0].family);
    });
  };

  function once(url, { maxBytes, accept }) {
    return new Promise((resolve, reject) => {
      const req = request(url, {
        method: 'GET',
        lookup: safeLookup,
        headers: { 'User-Agent': USER_AGENT, Accept: accept, 'Accept-Encoding': 'gzip, deflate, br', 'Accept-Language': 'pt-BR,pt;q=0.9' },
        timeout: timeoutMs,
      }, (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          return resolve({ redirect: res.headers.location, status });
        }
        const encoding = String(res.headers['content-encoding'] ?? '').toLowerCase();
        const stream = encoding === 'gzip' ? res.pipe(zlib.createGunzip())
          : encoding === 'br' ? res.pipe(zlib.createBrotliDecompress())
          : encoding === 'deflate' ? res.pipe(zlib.createInflate())
          : res;
        const chunks = [];
        let size = 0;
        stream.on('data', (chunk) => {
          size += chunk.length;
          if (size > maxBytes) {
            req.destroy();
            reject(new SafeFetchError('O arquivo é grande demais.', 'TOO_LARGE'));
            return;
          }
          chunks.push(chunk);
        });
        stream.on('end', () => resolve({ status, headers: res.headers, body: Buffer.concat(chunks) }));
        stream.on('error', () => reject(new SafeFetchError('A resposta do site veio corrompida.', 'BAD_RESPONSE')));
      });
      req.on('timeout', () => req.destroy(new SafeFetchError('O site demorou demais para responder.', 'TIMEOUT')));
      req.on('error', (err) => reject(err instanceof SafeFetchError ? err : new SafeFetchError('Não consegui acessar esse site.', 'NETWORK')));
      req.end();
    });
  }

  /**
   * @param {string} raw URL
   * @param {{ maxBytes?: number, accept?: string }} [options]
   * @returns {Promise<{ url: string, status: number, contentType: string, body: Buffer }>}
   */
  async function fetchUrl(raw, { maxBytes = 3 * 1024 * 1024, accept = 'text/html,application/xhtml+xml' } = {}) {
    let url = parseSafeUrl(raw);
    for (let hop = 0; hop <= maxRedirects; hop++) {
      const res = await once(url, { maxBytes, accept });
      if (res.redirect) {
        if (hop === maxRedirects) throw new SafeFetchError('O link redireciona demais.', 'TOO_MANY_REDIRECTS');
        url = parseSafeUrl(new URL(res.redirect, url).toString()); // cada destino passa pela mesma checagem
        continue;
      }
      return {
        url: url.toString(),
        status: res.status,
        contentType: String(res.headers['content-type'] ?? '').toLowerCase(),
        body: res.body,
      };
    }
    throw new SafeFetchError('O link redireciona demais.', 'TOO_MANY_REDIRECTS');
  }

  return { fetchUrl };
}
