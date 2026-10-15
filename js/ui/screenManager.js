// Controle de telas visíveis e utilitário de criação de elementos (sempre via textContent: sem XSS).
const TELAS = ["inicio", "jogo", "espera", "ranking", "resultado", "erro"];
let limpezas = [];

/** Cria elemento: el("div", {class:"x", onclick:fn}, "texto", outroEl). */
export function el(tag, attrs = {}, ...filhos) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === false || v == null) continue;
    if (k === "class") n.className = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else if (k === "dataset") Object.assign(n.dataset, v);
    else n.setAttribute(k, v === true ? "" : v);
  }
  for (const f of filhos.flat()) {
    if (f == null || f === false) continue;
    n.append(f instanceof Node ? f : document.createTextNode(String(f)));
  }
  return n;
}

export const porId = (id) => document.getElementById(id);

/** Registra função executada ao trocar de tela (limpar intervalos, etc.). */
export function aoSair(fn) { limpezas.push(fn); }

/** Mostra uma tela e esconde as demais. A barra de indicadores só aparece em jogo/espera. */
export function mostrarTela(nome) {
  limpezas.forEach((f) => { try { f(); } catch (e) { console.error(e); } });
  limpezas = [];
  for (const t of TELAS) porId(`tela-${t}`).hidden = t !== nome;
  const emPartida = ["jogo", "espera"].includes(nome);
  porId("barra-fixa").hidden = !emPartida;
  const ajuda = porId("ajuda");
  if (ajuda) { ajuda.hidden = !emPartida; document.body.classList.toggle("com-ajuda", emPartida); globalThis.dispatchEvent?.(new Event("ajuda:layout")); }
  window.scrollTo({ top: 0 });
}

export function limpar(no) { while (no.firstChild) no.removeChild(no.firstChild); return no; }
