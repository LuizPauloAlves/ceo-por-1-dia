// Cronômetro das emergências: baseado em timestamp de expiração (Date.now), não em contagem de ticks.
import { CONFIG } from "../core/gameConfig.js";

let handle = null;
let aoVoltarAba = null;

export const restanteMs = (expiraEm, agora = Date.now()) => Math.max(0, expiraEm - agora);

/** Faixa visual conforme o tempo restante. */
export function faixaAlerta(restMs, duracaoMs) {
  if (restMs <= CONFIG.emergencia.alertaFinalSeg * 1000) return "critico";
  if (restMs <= duracaoMs / 2) return "atencao";
  return "normal";
}

export function pararTimer() {
  if (handle) clearInterval(handle);
  handle = null;
  if (aoVoltarAba && globalThis.document) globalThis.document.removeEventListener("visibilitychange", aoVoltarAba);
  aoVoltarAba = null;
}

/**
 * Inicia o cronômetro. `onExpirar` é chamado no máximo uma vez.
 * O restante é sempre recalculado por Date.now(): mudar de aba não pausa o relógio.
 */
export function iniciarTimer(expiraEm, { onTick, onExpirar }) {
  pararTimer();
  let expirou = false;
  const verificar = () => {
    const rest = restanteMs(expiraEm);
    if (rest <= 0) {
      if (expirou) return;
      expirou = true;
      pararTimer();
      onExpirar();
      return;
    }
    onTick(rest);
  };
  handle = setInterval(verificar, 250);
  handle.unref?.(); // Node (testes): não segura o processo
  if (globalThis.document) {
    aoVoltarAba = () => { if (!globalThis.document.hidden) verificar(); };
    globalThis.document.addEventListener("visibilitychange", aoVoltarAba);
  }
  verificar();
}
