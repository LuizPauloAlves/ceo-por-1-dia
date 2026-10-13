// Tela de resultados finais.
import { el, porId, limpar, mostrarTela } from "./screenManager.js";
import { tabelaRanking } from "./rankingUI.js";
import { moeda, moedaComSinal, pontosComSinal } from "../utils/formatters.js";

const KEYS = ["financeiro", "clientes", "equipe", "operacao"];
const ABREV = { financeiro: "R$", clientes: "Cli", equipe: "Equ", operacao: "Ope" };

function resumoImpactos(ef) {
  return el("span", { class: "hist-imp" }, KEYS.filter((k) => ef[k]).map((k) =>
    el("span", { class: ef[k] > 0 ? "pos" : "neg" }, `${ABREV[k]} ${k === "financeiro" ? moedaComSinal(ef[k]).replace("R$ ", "") : pontosComSinal(ef[k])}`)));
}

export function renderResultado({ estado: e, ranking, erroRanking }, { onJogarNovamente, onRanking, onInicio }) {
  mostrarTela("resultado");
  const tela = limpar(porId("tela-resultado"));
  const ok = e.resultado.concluiu;
  const ind = e.indicadores;
  const hist = el("ol", { class: "historico" }, e.historico.map((h) => el("li", { class: h.tipo },
    el("span", { class: "hist-tipo" }, h.tipo === "emergencia" ? "🚨" : h.tipo === "consequencia" ? "🦋" : "📋"),
    el("div", {}, el("strong", {}, h.titulo), el("span", { class: "hist-esc" }, h.escolha), resumoImpactos(h.efetivos),
      h.motivoEncerramento === "tempo_esgotado" ? el("em", {}, " (tempo esgotado)") : null))));
  const stat = (rot, val) => el("div", { class: "stat" }, el("span", {}, rot), el("strong", {}, val));

  tela.append(el("div", { class: `resultado ${ok ? "vitoria" : "derrota"}` },
    el("h1", {}, ok ? "🏭 Empresa sobrevivente!" : "💥 Falência / colapso"),
    el("p", { class: "res-jogador" }, e.nickname),
    el("p", { class: "res-motivo" }, e.resultado.motivo),
    el("div", { class: "res-pontuacao" }, el("span", {}, "Pontuação final"), el("strong", {}, e.pontuacao), el("small", {}, "de 1000 possíveis")),
    el("div", { class: "stats" },
      stat("Atividades respondidas", `${e.progresso.normaisConcluidas}/${e.metas.normais}`),
      stat("Emergências no prazo", e.progresso.emergenciasNoPrazo),
      stat("Emergências expiradas", e.progresso.emergenciasExpiradas),
      stat("Posição no ranking local", e.resultado.posicao ? `${e.resultado.posicao}º` : "fora do top 10")),
    el("h2", {}, "Indicadores finais"),
    el("div", { class: "stats" },
      stat("Financeiro", moeda(ind.financeiro)), stat("Clientes", `${ind.clientes}/100`),
      stat("Equipe", `${ind.equipe}/100`), stat("Operação", `${ind.operacao}/100`)),
    (e.consequencias.descartadas.length || e.consequencias.pendentes.length)
      ? el("p", { class: "nota" }, `${e.consequencias.descartadas.length + e.consequencias.pendentes.length} desdobramento(s) futuro(s) ainda não tinham ocorrido quando a partida terminou.`) : null,
    erroRanking ? el("p", { class: "aviso-storage" }, `⚠ ${erroRanking}`) : null,
    el("h2", {}, "Histórico de decisões"), hist,
    el("h2", {}, "Ranking local"), tabelaRanking(ranking, e.id),
    el("div", { class: "res-botoes" },
      el("button", { class: "btn btn-primario btn-grande", type: "button", onclick: onJogarNovamente }, "JOGAR NOVAMENTE"),
      el("button", { class: "btn btn-sec btn-grande", type: "button", onclick: onRanking }, "VER RANKING"),
      el("button", { class: "btn btn-sec btn-grande", type: "button", onclick: onInicio }, "VOLTAR AO INÍCIO"))));
}
