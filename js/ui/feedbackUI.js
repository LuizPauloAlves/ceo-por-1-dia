// Componentes de retorno ao jogador: banners, confirmação em modal e bloco de feedback pós-decisão.
import { el, porId, limpar } from "./screenManager.js";
import { moeda, moedaComSinal, pontosComSinal } from "../utils/formatters.js";

const ROTULOS = { financeiro: "Financeiro", clientes: "Clientes", equipe: "Equipe", operacao: "Operação" };

/** Exibe/atualiza um banner fixo (id evita duplicatas). */
export function mostrarBanner(id, texto, { tipo = "aviso", acao = null, fechavel = true } = {}) {
  removerBanner(id);
  const b = el("div", { class: `banner ${tipo}`, dataset: { id } }, el("span", {}, texto));
  if (acao) b.append(el("button", { class: "btn btn-mini", type: "button", onclick: acao.fn }, acao.texto));
  if (fechavel) b.append(el("button", { class: "banner-fechar", type: "button", "aria-label": "Fechar", onclick: () => b.remove() }, "×"));
  porId("banners").append(b);
}

export function removerBanner(id) {
  porId("banners").querySelectorAll(`[data-id="${id}"]`).forEach((n) => n.remove());
}

/** Modal de confirmação; resolve true/false. */
export function confirmar(titulo, texto, sim = "Confirmar", nao = "Cancelar") {
  return new Promise((resolve) => {
    const m = limpar(porId("modal"));
    const fechar = (v) => { m.hidden = true; limpar(m); resolve(v); };
    m.append(el("div", { class: "modal-caixa" },
      el("h2", {}, titulo), el("p", {}, texto),
      el("div", { class: "modal-acoes" },
        el("button", { class: "btn btn-sec", type: "button", onclick: () => fechar(false) }, nao),
        el("button", { class: "btn btn-primario", type: "button", onclick: () => fechar(true) }, sim))));
    m.hidden = false;
    m.querySelector(".btn-primario").focus();
  });
}

/** Lista com os 4 indicadores e seus ganhos/perdas. */
export function tabelaImpactos(res) {
  const lista = el("ul", { class: "impactos" });
  for (const k of Object.keys(ROTULOS)) {
    const d = res.efetivos[k];
    const fmt = k === "financeiro" ? moedaComSinal : pontosComSinal;
    const depois = k === "financeiro" ? moeda(res.depois[k]) : `${res.depois[k]}/100`;
    lista.append(el("li", { class: d > 0 ? "pos" : d < 0 ? "neg" : "neutro" },
      el("span", { class: "imp-nome" }, ROTULOS[k]),
      el("strong", { class: "imp-delta" }, d === 0 ? "0" : fmt(d)),
      el("span", { class: "imp-novo" }, `agora ${depois}`)));
  }
  return lista;
}

/** Bloco de feedback: decisão, alterações, mensagens (dos dados ou avisos do sistema) e botão. */
export function criarFeedback({ escolha, resultado, mensagens = [], alerta = null, textoBotao, onContinuar, classe = "" }) {
  return el("section", { class: `feedback ${classe}`, "aria-live": "polite" },
    el("h3", {}, "Decisão registrada"),
    alerta ? el("p", { class: "feedback-alerta" }, alerta) : null,
    el("p", { class: "feedback-escolha" }, el("span", {}, "Sua decisão: "), escolha),
    el("p", { class: "feedback-sub" }, "Consequência imediata nos indicadores:"),
    tabelaImpactos(resultado),
    resultado.limitado ? el("p", { class: "nota" }, "Alguns valores foram limitados ao intervalo de 0 a 100.") : null,
    ...mensagens.map((m) => el("p", { class: "feedback-msg" }, m)),
    el("button", { class: "btn btn-primario btn-grande", type: "button", onclick: onContinuar }, textoBotao));
}
