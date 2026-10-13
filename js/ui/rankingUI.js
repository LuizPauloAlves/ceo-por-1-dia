// Tela do ranking local (cookies).
import { el, porId, limpar, mostrarTela } from "./screenManager.js";
import { moeda, dataCurta } from "../utils/formatters.js";

/** Tabela do ranking (também usada na tela de resultados). */
export function tabelaRanking(lista, destacarId = null) {
  if (!lista.length) return el("p", { class: "nota" }, "Ainda não há partidas registradas neste navegador.");
  const cab = ["#", "Jogador", "Pontos", "Caixa", "Cli.", "Equ.", "Ope.", "Ativ.", "Emerg. (ok/exp.)", "Resultado", "Data"];
  return el("div", { class: "tabela-wrap" }, el("table", { class: "tabela-ranking" },
    el("thead", {}, el("tr", {}, cab.map((c) => el("th", { scope: "col" }, c)))),
    el("tbody", {}, lista.map((r, i) => el("tr", { class: r.partidaId === destacarId ? "destaque" : "" },
      el("td", {}, i + 1), el("td", { class: "nick" }, r.nickname), el("td", { class: "pts" }, r.pontuacao),
      el("td", {}, moeda(r.financeiroFinal)), el("td", {}, r.clientesFinal), el("td", {}, r.equipeFinal), el("td", {}, r.operacaoFinal),
      el("td", {}, r.atividadesRespondidas), el("td", {}, `${r.emergenciasResolvidas}/${r.emergenciasExpiradas}`),
      el("td", {}, r.concluiu ? "✅ Concluiu" : "💥 Colapso"), el("td", {}, dataCurta(r.data)))))));
}

export function renderRanking({ lista, erro }, { onVoltar }) {
  mostrarTela("ranking");
  const tela = limpar(porId("tela-ranking"));
  tela.append(el("div", { class: "ranking" },
    el("h1", {}, "🏆 Ranking local"),
    el("p", { class: "nota" }, "As 10 melhores partidas deste navegador. Não é um ranking mundial nem compartilhado entre pessoas."),
    erro ? el("p", { class: "aviso-storage" }, `⚠ ${erro}`) : null,
    tabelaRanking(lista),
    el("button", { class: "btn btn-primario btn-grande", type: "button", onclick: onVoltar }, "VOLTAR")));
}
