// Acesso de baixo nível a LocalStorage e cookies. Nunca lança exceção: devolve { ok, ... }.

function ls() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

/** Testa se o LocalStorage está acessível e gravável. */
export function localStorageDisponivel() {
  const s = ls();
  if (!s) return false;
  try {
    s.setItem("__ceo1d_teste", "1");
    s.removeItem("__ceo1d_teste");
    return true;
  } catch { return false; }
}

export function lsLer(chave) {
  try {
    const s = ls();
    if (!s) return { ok: false, erro: "LocalStorage indisponível" };
    return { ok: true, valor: s.getItem(chave) };
  } catch (e) { return { ok: false, erro: String(e?.message ?? e) }; }
}

export function lsGravar(chave, texto) {
  try {
    const s = ls();
    if (!s) return { ok: false, erro: "LocalStorage indisponível" };
    s.setItem(chave, texto);
    return { ok: true };
  } catch (e) { return { ok: false, erro: String(e?.message ?? e) }; }
}

export function lsRemover(chave) {
  try { ls()?.removeItem(chave); return { ok: true }; } catch (e) { return { ok: false, erro: String(e?.message ?? e) }; }
}

// ---- Cookies ----
function doc() { return globalThis.document ?? null; }

/** Tamanho em bytes (UTF-8) do cookie "nome=valor". */
export function tamanhoCookie(nome, valorCodificado) {
  return new TextEncoder().encode(`${nome}=${valorCodificado}`).length;
}

export function cookieLer(nome) {
  const d = doc();
  if (!d) return null;
  const alvo = `${nome}=`;
  for (const parte of d.cookie.split(";")) {
    const p = parte.trim();
    if (p.startsWith(alvo)) {
      try { return decodeURIComponent(p.slice(alvo.length)); } catch { return null; }
    }
  }
  return null;
}

/** Grava e confirma por releitura (detecta cookies bloqueados). */
export function cookieGravar(nome, texto, dias = 400, limiteBytes = 3800) {
  const d = doc();
  if (!d) return { ok: false, erro: "Cookies indisponíveis neste ambiente" };
  const cod = encodeURIComponent(texto);
  const bytes = tamanhoCookie(nome, cod);
  if (bytes > limiteBytes) return { ok: false, erro: `Cookie excede o limite (${bytes} > ${limiteBytes} bytes)`, codigo: "tamanho" };
  const expira = new Date(Date.now() + dias * 86400000).toUTCString();
  d.cookie = `${nome}=${cod}; expires=${expira}; path=/; SameSite=Lax`;
  if (cookieLer(nome) !== texto) return { ok: false, erro: "O navegador recusou o cookie (cookies bloqueados?)", codigo: "bloqueado" };
  return { ok: true, bytes };
}

export function cookieRemover(nome) {
  const d = doc();
  if (d) d.cookie = `${nome}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
}
