// Tela "aguardando emergência": após as atividades normais, enquanto faltam emergências.
import { el, porId, limpar, mostrarTela, aoSair } from "./screenManager.js";
import { cronometro } from "../utils/formatters.js";
import { CONFIG } from "../core/gameConfig.js";

export function renderEspera({ estado }, { onAvancar }) {
  mostrarTela("espera");
  const tela = limpar(porId("tela-espera"));
  const falta = estado.metas.emergencias - estado.progresso.emergenciasConcluidas;
  const maximo = el("strong", {}, "");
  const refresco = () => {
    const rest = CONFIG.emergencia.tempoMaximoSemEmergenciaSeg * 1000 - estado.relogio.semEmergenciaMs;
    maximo.textContent = cronometro(Math.max(0, rest) / 1000);
  };
  refresco();
  const h = setInterval(refresco, 1000);
  aoSair(() => clearInterval(h));
  tela.append(el("div", { class: "espera" },
    el("h1", {}, "⏳ Aguardando emergência"),
    el("p", {}, `Você concluiu todas as ${estado.metas.normais} atividades normais, mas ainda ${falta === 1 ? "falta 1 emergência" : `faltam ${falta} emergências`} para encerrar a partida.`),
    el("p", {}, "Uma emergência pode surgir a qualquer momento. Se nada acontecer, ela é forçada em até: ", maximo),
    el("button", { class: "btn btn-primario btn-grande", type: "button", onclick: onAvancar }, "⏩ AVANÇAR RELÓGIO DE SIMULAÇÃO"),
    el("p", { class: "nota" }, "O avanço segue as mesmas regras de disparo e nunca cria emergências extras.")));
}
