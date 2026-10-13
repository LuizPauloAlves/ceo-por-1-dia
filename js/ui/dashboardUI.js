// Barra superior: cabeçalho da partida e os quatro indicadores fixos. Só exibe, não calcula regras.
import { el, porId, limpar } from "./screenManager.js";
import { moeda, moedaComSinal, pontosComSinal } from "../utils/formatters.js";

const DEFS = [
  { k: "financeiro", nome: "Financeiro", icone: "R$", cls: "fin" },
  { k: "clientes", nome: "Relacionamento com clientes", curto: "Clientes", icone: "🤝", cls: "cli" },
  { k: "equipe", nome: "Engajamento da equipe", curto: "Equipe", icone: "👥", cls: "eq" },
  { k: "operacao", nome: "Operação", icone: "⚙️", cls: "op" },
];
const refs = {};
let anterior = null;
let selo = null;

export function montarDashboard() {
  const box = limpar(porId("indicadores"));
  for (const d of DEFS) {
    const valor = el("strong", { class: "ind-valor" });
    const barra = el("span", { class: "ind-barra-preench" });
    const chip = el("span", { class: "ind-delta", "aria-hidden": "true" });
    const card = el("article", { class: `ind ind-${d.cls}`, "aria-label": d.nome },
      el("span", { class: "ind-icone", "aria-hidden": "true" }, d.icone),
      el("div", { class: "ind-texto" },
        el("span", { class: "ind-nome" }, el("span", { class: "nome-longo" }, d.nome), el("span", { class: "nome-curto" }, d.curto ?? d.nome)),
        valor),
      d.k === "financeiro" ? null : el("span", { class: "ind-barra" }, barra),
      chip);
    box.append(card);
    refs[d.k] = { card, valor, barra, chip };
  }
  selo = el("span", { class: "selo-save", title: "Estado do salvamento automático" }, "");
}

function texto(k, v) { return k === "financeiro" ? moeda(v) : `${v}/100`; }

/** Atualiza valores; anima quando mudam e sinaliza situação crítica. */
export function atualizarDashboard(e) {
  if (!refs.financeiro) return;
  for (const d of DEFS) {
    const v = e.indicadores[d.k];
    const r = refs[d.k];
    r.valor.textContent = texto(d.k, v);
    if (d.k !== "financeiro") r.barra.style.width = `${v}%`;
    r.card.classList.toggle("critico", d.k === "financeiro" ? v <= 5000 : v <= 20);
    if (anterior && anterior[d.k] !== v) {
      r.card.classList.remove("sobe", "desce");
      void r.card.offsetWidth; // reinicia a animação
      r.card.classList.add(v > anterior[d.k] ? "sobe" : "desce");
    }
  }
  anterior = { ...e.indicadores };
  atualizarCabecalho(e);
}

/** Mostra os ganhos/perdas (+5, -R$ 1.500) sobre cada indicador após uma decisão. */
export function mostrarDeltas(res) {
  if (!refs.financeiro || !res.efetivos) return;
  for (const d of DEFS) {
    const x = res.efetivos[d.k];
    const r = refs[d.k];
    if (!x) { r.chip.textContent = ""; continue; }
    r.chip.textContent = d.k === "financeiro" ? moedaComSinal(x) : pontosComSinal(x);
    r.chip.className = `ind-delta ${x > 0 ? "pos" : "neg"} visivel`;
    clearTimeout(r.t);
    r.t = setTimeout(() => r.chip.classList.remove("visivel"), 3500);
  }
}

export function atualizarCabecalho(e) {
  const c = limpar(porId("cabecalho"));
  const normais = Math.min(e.progresso.normaisConcluidas, e.metas.normais);
  c.append(
    el("span", { class: "marca" }, "CEO POR 1 DIA"),
    el("span", { class: "jogador" }, "👤 ", e.nickname),
    el("span", { class: "progresso" }, `Atividades ${normais}/${e.metas.normais} · Emergências ${e.progresso.emergenciasConcluidas}/${e.metas.emergencias}`),
    el("span", { class: "pontos" }, `${e.pontuacao} pts`),
    selo,
  );
}

/** Estado do salvamento: ok, erro ou conflito. */
export function mostrarSelo(tipo) {
  if (!selo) return;
  selo.className = `selo-save ${tipo}`;
  selo.textContent = tipo === "ok" ? "● salvo" : tipo === "erro" ? "⚠ NÃO salvo" : "⚠ aba inativa";
}
