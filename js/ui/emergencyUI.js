// Tela de emergência: visual de urgência, cronômetro regressivo e barra de tempo.
import { el, porId, limpar, mostrarTela } from "./screenManager.js";
import { listaAlternativas } from "./questionUI.js";
import { criarFeedback } from "./feedbackUI.js";
import { cronometro } from "../utils/formatters.js";

const TIPO = { "Operação": "OPERACIONAL", Pessoas: "DE PESSOAS", Clientes: "COM CLIENTES", Financeiro: "FINANCEIRA", "Marketing e estratégia": "DE MARKETING", Desenvolvimento: "DE DESENVOLVIMENTO" };
let refs = null;

function faixaInicial(em) {
  const r = em.expiraEm - Date.now();
  return r <= 20000 ? "critico" : r <= em.duracaoMs / 2 ? "atencao" : "normal";
}

/** Renderiza a emergência (aguardando resposta ou já com feedback). */
export function renderEmergencia({ em, estado, final }, { onResponder, onContinuar }) {
  mostrarTela("jogo");
  const area = limpar(porId("area-jogo"));
  const aguardando = em.estado === "aguardando";
  const tempo = el("strong", { class: "em-tempo", role: "timer", "aria-label": "Tempo restante" }, cronometro(Math.max(0, em.expiraEm - Date.now()) / 1000));
  const preench = el("span", { class: "em-barra-preench" });
  const card = el("article", { class: "emergencia faixa-normal" },
    el("div", { class: "em-faixa" },
      el("span", { class: "em-selo" }, "🚨 EMERGÊNCIA"),
      el("span", { class: "em-numero" }, `${em.numero} de ${estado.metas.emergencias}`)),
    el("h2", { class: "em-tipo" }, `EMERGÊNCIA ${TIPO[em.categoria] ?? em.categoria.toUpperCase()}`),
    aguardando ? el("div", { class: "em-relogio" }, el("span", {}, "Tempo restante: "), tempo) : null,
    aguardando ? el("div", { class: "em-barra" }, preench) : null,
    el("h3", { class: "q-titulo" }, em.titulo),
    el("p", { class: "q-situacao" }, em.situacao),
    el("p", { class: "q-pergunta" }, em.pergunta),
    listaAlternativas(em.alternativas, { escolhaId: aguardando ? null : em.escolhaId, onEscolher: onResponder }));
  area.append(card);
  refs = aguardando ? { card, tempo, preench } : null;
  if (aguardando) atualizarTimer({ restanteMs: Math.max(0, em.expiraEm - Date.now()), duracaoMs: em.duracaoMs, faixa: faixaInicial(em) });

  if (!aguardando) {
    const escolhida = em.alternativas.find((a) => a.id === em.escolhaId);
    const esgotou = em.motivoEncerramento === "tempo_esgotado";
    const msgs = [];
    if (esgotou && em.motivoTimeout) msgs.push(em.motivoTimeout);
    if (final) msgs.push(estado.resultado.motivo);
    area.append(criarFeedback({
      escolha: escolhida.texto, resultado: em.resultado, mensagens: msgs,
      alerta: esgotou ? "⏱ TEMPO ESGOTADO: a pior alternativa foi aplicada automaticamente." : (final ? "FIM DE JOGO" : null),
      classe: final ? "derrota" : (esgotou ? "expirou" : ""),
      textoBotao: final ? "VER RESULTADO" : "CONTINUAR", onContinuar,
    }));
    area.lastChild.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

/** Chamado a cada tick do cronômetro (evento emergencia:tick). */
export function atualizarTimer({ restanteMs, duracaoMs, faixa }) {
  if (!refs) return;
  refs.tempo.textContent = cronometro(restanteMs / 1000);
  refs.preench.style.width = `${Math.max(0, Math.min(100, (restanteMs / duracaoMs) * 100))}%`;
  refs.card.className = `emergencia faixa-${faixa}`;
}
