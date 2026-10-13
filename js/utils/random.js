// Utilitários de aleatoriedade. O gerador pode ser substituído em testes.
let gerador = Math.random;

export function setRng(fn) { gerador = fn ?? Math.random; }
export function rand() { return gerador(); }

/** Inteiro uniforme em [min, max], inclusive. */
export function randInt(min, max) {
  const lo = Math.ceil(Math.min(min, max));
  const hi = Math.floor(Math.max(min, max));
  return lo + Math.floor(gerador() * (hi - lo + 1));
}

/** Elemento aleatório de um array (undefined se vazio). */
export function escolher(arr) { return arr.length ? arr[Math.floor(gerador() * arr.length)] : undefined; }

/** Fisher-Yates: devolve NOVA lista embaralhada, sem alterar a original. */
export function fisherYates(lista) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(gerador() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Sorteio ponderado {chave: peso}. Pesos <= 0 são ignorados; null se nenhum peso positivo. */
export function sorteioPonderado(pesos) {
  const entradas = Object.entries(pesos).filter(([, p]) => p > 0);
  const total = entradas.reduce((s, [, p]) => s + p, 0);
  if (total <= 0) return null;
  let alvo = gerador() * total;
  for (const [chave, p] of entradas) {
    alvo -= p;
    if (alvo < 0) return chave;
  }
  return entradas[entradas.length - 1][0];
}

/** Identificador único (partida, aba, eventos). */
export function uid(prefixo = "") {
  const a = Math.random().toString(36).slice(2, 8);
  return `${prefixo}${Date.now().toString(36)}${a}`;
}
