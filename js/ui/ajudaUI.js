// Painel "Como funciona": lateral direita fixa em telas largas; no fim da página (recolhido, ☰) em telas estreitas.
import { el, porId } from "./screenManager.js";

export const REGRAS = [
  "Você é o CEO: decida sobre pessoas, clientes, finanças, operação, marketing e desenvolvimento.",
  "Quatro indicadores importam: caixa, clientes, equipe e operação. Se qualquer um chegar a zero, a empresa acaba.",
  "São 20 atividades normais e 5 emergências com 2 minutos para decidir. Sem resposta, vale a pior alternativa.",
  "Decisões podem ter desdobramentos futuros (efeito borboleta). Pense no longo prazo.",
  "Seu progresso é salvo automaticamente neste navegador.",
];

const larga = () => globalThis.matchMedia?.("(min-width: 1100px)").matches ?? true;

/** Monta o painel uma única vez dentro de #ajuda. */
export function montarAjuda() {
  const raiz = porId("ajuda");
  if (!raiz || raiz.dataset.pronto) return;
  raiz.dataset.pronto = "1";
  const det = el("details", { class: "ajuda-det" },
    el("summary", {}, el("span", { class: "ajuda-icone", "aria-hidden": "true" }, "☰"), " Como funciona"),
    el("ul", {}, REGRAS.map((r) => el("li", {}, r))));
  raiz.append(det);
  let tocou = false;
  det.addEventListener("toggle", () => { if (det.open !== larga()) tocou = true; });
  const ajustar = () => { if (!tocou) det.open = larga(); };
  ajustar();
  globalThis.matchMedia?.("(min-width: 1100px)").addEventListener?.("change", () => { tocou = false; ajustar(); });
}

/** Mostra/esconde o painel (visível só durante a partida). */
export function mostrarAjuda(visivel) {
  const raiz = porId("ajuda");
  if (!raiz) return;
  raiz.hidden = !visivel;
  document.body.classList.toggle("com-ajuda", visivel);
}
