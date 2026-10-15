// Painel "Como funciona": abre e fecha pelo botão ☰ no canto esquerdo da barra escura.
// Telas largas: coluna à esquerda (aberta por padrão). Telas estreitas: gaveta sobre o conteúdo (fechada por padrão).
import { el, porId } from "./screenManager.js";

export const REGRAS = [
  "Você é o CEO: decida sobre pessoas, clientes, finanças, operação, marketing e desenvolvimento.",
  "Quatro indicadores importam: caixa, clientes, equipe e operação. Se qualquer um chegar a zero, a empresa acaba.",
  "São 20 atividades normais e 5 emergências com 2 minutos para decidir. Sem resposta, vale a pior alternativa.",
  "Decisões podem ter desdobramentos futuros (efeito borboleta). Pense no longo prazo.",
  "Seu progresso é salvo automaticamente neste navegador.",
];

const CHAVE = "ceo1d:ajuda";
const mq = globalThis.matchMedia?.("(min-width: 1100px)");
const larga = () => mq?.matches ?? true;
const lerPref = () => { try { return localStorage.getItem(CHAVE); } catch { return null; } };
const gravarPref = (v) => { try { localStorage.setItem(CHAVE, v); } catch { /* sem storage: só não lembra */ } };

/** Monta o painel e o botão uma única vez. */
export function montarAjuda() {
  const raiz = porId("ajuda");
  const btn = porId("btn-ajuda");
  if (!raiz || !btn || raiz.dataset.pronto) return;
  raiz.dataset.pronto = "1";
  raiz.append(
    el("div", { class: "ajuda-topo" },
      el("h2", { class: "ajuda-titulo" }, "Como funciona"),
      el("button", { class: "ajuda-fechar", type: "button", "aria-label": "Recolher", title: "Recolher", onclick: () => alternar(false, true) }, "✕")),
    el("ol", { class: "ajuda-lista" }, REGRAS.map((r) => el("li", {}, r))));

  // Posição vertical logo abaixo da barra fixa (a altura muda com a largura da tela)
  const barra = porId("barra-fixa");
  const posicionar = () => {
    const alt = barra && !barra.hidden ? barra.getBoundingClientRect().bottom : 0;
    document.documentElement.style.setProperty("--ajuda-topo", `${Math.max(0, Math.round(alt))}px`);
  };
  if (globalThis.ResizeObserver && barra) new ResizeObserver(posicionar).observe(barra);
  globalThis.addEventListener?.("resize", posicionar);
  globalThis.addEventListener?.("scroll", posicionar, { passive: true });
  globalThis.addEventListener?.("ajuda:layout", posicionar);

  function alternar(aberto, doUsuario = false) {
    document.body.classList.toggle("ajuda-aberta", aberto);
    btn.setAttribute("aria-expanded", String(aberto));
    btn.classList.toggle("ativo", aberto);
    if (doUsuario && larga()) gravarPref(aberto ? "aberta" : "fechada");
    posicionar();
  }
  const padrao = () => larga() && lerPref() !== "fechada";

  btn.addEventListener("click", () => alternar(!document.body.classList.contains("ajuda-aberta"), true));
  // Telas estreitas: tocar fora da gaveta ou apertar Esc fecha
  document.addEventListener("click", (ev) => {
    if (larga() || !document.body.classList.contains("ajuda-aberta")) return;
    if (!raiz.contains(ev.target) && !btn.contains(ev.target)) alternar(false);
  });
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && !larga()) alternar(false); });
  mq?.addEventListener?.("change", () => alternar(padrao()));
  alternar(padrao());
}

/** Mostra/esconde o painel (visível só durante a partida). */
export function mostrarAjuda(visivel) {
  const raiz = porId("ajuda");
  if (!raiz) return;
  raiz.hidden = !visivel;
  document.body.classList.toggle("com-ajuda", visivel);
}
