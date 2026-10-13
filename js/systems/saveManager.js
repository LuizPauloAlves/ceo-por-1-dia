// Salvamento automático em LocalStorage, restauração validada e trava de múltiplas abas.
import { CONFIG } from "../core/gameConfig.js";
import { getState } from "../core/gameState.js";
import { bus } from "../core/eventBus.js";
import { lsLer, lsGravar, lsRemover, localStorageDisponivel } from "../utils/storage.js";
import { validarEstadoSalvo } from "../utils/validators.js";
import { uid } from "../utils/random.js";

// O id da aba sobrevive ao F5 (sessionStorage), evitando falso conflito com a própria aba recarregada.
function obterTabId() {
  try {
    const s = globalThis.sessionStorage;
    let id = s?.getItem("ceo1d:tabId");
    if (!id) { id = uid("aba_"); s?.setItem("ceo1d:tabId", id); }
    return id;
  } catch { return uid("aba_"); }
}
export const TAB_ID = obterTabId();
let heartbeat = null;
let bloqueada = false;

export const abaBloqueada = () => bloqueada;
export const armazenamentoDisponivel = () => localStorageDisponivel();

// ---- Trava de aba: só uma aba "dona" aplica decisões na partida ----
function lerLock() {
  const r = lsLer(CONFIG.chaves.lockAba);
  if (!r.ok || !r.valor) return null;
  try { return JSON.parse(r.valor); } catch { return null; }
}

/** Há outra aba ativa (heartbeat recente) controlando o jogo? */
export function outraAbaAtiva() {
  const l = lerLock();
  return !!l && l.id !== TAB_ID && Date.now() - l.ts < CONFIG.lockAba.expiraMs;
}

function gravarLock() { lsGravar(CONFIG.chaves.lockAba, JSON.stringify({ id: TAB_ID, ts: Date.now() })); }

/** Assume o controle desta aba e inicia o heartbeat. */
export function assumirControle() {
  bloqueada = false;
  gravarLock();
  if (heartbeat) clearInterval(heartbeat);
  heartbeat = setInterval(() => {
    const l = lerLock();
    if (l && l.id !== TAB_ID && Date.now() - l.ts < CONFIG.lockAba.expiraMs) {
      bloqueada = true;
      bus.emit("save:conflito", { motivo: "outra_aba" });
    } else if (!bloqueada) gravarLock();
  }, CONFIG.lockAba.heartbeatMs);
  heartbeat.unref?.();
}

export function liberarControle() {
  if (heartbeat) clearInterval(heartbeat);
  heartbeat = null;
  const l = lerLock();
  if (l?.id === TAB_ID) lsRemover(CONFIG.chaves.lockAba);
}

// ---- Persistência da partida ----
function lerBruto() {
  const r = lsLer(CONFIG.chaves.partida);
  if (!r.ok) return { ok: false, erro: r.erro };
  if (!r.valor) return { ok: true, vazio: true };
  try { return { ok: true, estado: JSON.parse(r.valor) }; } catch { return { ok: false, erro: "Save corrompido (JSON inválido)." }; }
}

/** Existe partida salva e válida? Devolve { existe, estado?, erro? } sem alterar nada. */
export function inspecionarSave() {
  const r = lerBruto();
  if (!r.ok) return { existe: false, erro: r.erro };
  if (r.vazio) return { existe: false };
  const erros = validarEstadoSalvo(r.estado);
  if (erros.length) return { existe: false, erro: `Save inválido: ${erros[0]}`, corrompido: true };
  return { existe: true, estado: r.estado };
}

/** Antes de aplicar uma decisão: esta aba perdeu o controle ou há save mais novo de outra aba? */
export function bloqueadaOuConflito() {
  if (bloqueada) return true;
  const e = getState();
  const atual = lerBruto();
  if (e && atual.ok && atual.estado && atual.estado.id === e.id && atual.estado.versao > e.versao) {
    bloqueada = true;
    bus.emit("save:conflito", { motivo: "versao" });
    return true;
  }
  return false;
}

/** Grava o estado atual; recusa se outra aba assumiu a partida (versão salva maior). */
export function salvar() {
  const e = getState();
  if (!e) return { ok: false, erro: "Sem partida" };
  if (bloqueada) return { ok: false, erro: "Partida controlada por outra aba", conflito: true };
  const atual = lerBruto();
  if (atual.ok && atual.estado && atual.estado.id === e.id && atual.estado.versao > e.versao) {
    bloqueada = true;
    bus.emit("save:conflito", { motivo: "versao" });
    return { ok: false, erro: "Versão mais nova salva em outra aba", conflito: true };
  }
  e.versao += 1;
  const r = lsGravar(CONFIG.chaves.partida, JSON.stringify(e));
  if (!r.ok) {
    e.versao -= 1;
    bus.emit("save:erro", { erro: r.erro });
    return { ok: false, erro: r.erro };
  }
  bus.emit("save:ok", { versao: e.versao });
  return { ok: true };
}

export function apagarSave() { return lsRemover(CONFIG.chaves.partida); }

/** Salva automaticamente sempre que algum módulo avisa que o estado mudou. */
export function iniciarAutoSave() {
  bus.on("estado:alterado", () => salvar());
}
