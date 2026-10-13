// Estado da partida em andamento (única fonte de verdade). Serializável em JSON.
import { CONFIG } from "./gameConfig.js";
import { uid } from "../utils/random.js";

let estado = null;

/** Cria um estado novo. `metas` considera a quantidade de conteúdo realmente disponível. */
export function criarEstadoInicial(nickname, metas) {
  return {
    versaoSave: CONFIG.versaoSave,
    id: uid("p_"),
    versao: 0,                       // incrementa a cada gravação (controle de múltiplas abas)
    nickname,
    status: "jogando",               // "jogando" | "encerrada"
    iniciadaEm: new Date().toISOString(),
    metas: { ...metas },             // { normais, emergencias }
    indicadores: { ...CONFIG.indicadoresIniciais },
    pontuacao: 0,
    progresso: { normaisConcluidas: 0, emergenciasConcluidas: 0, emergenciasNoPrazo: 0, emergenciasExpiradas: 0 },
    usadas: { perguntas: [], emergencias: [] },
    atual: null,                     // pergunta normal OU desdobramento em andamento
    emergenciaAtual: null,
    consequencias: { pendentes: [], aplicadas: [], descartadas: [] },
    historico: [],
    appliedEvents: [],               // ids de eventos já aplicados (idempotência)
    relogio: { semEmergenciaMs: 0, sorteioMs: 0, agendadaRestanteMs: null, normaisDesdeUltima: 0 },
    resultado: null,
    rankingRegistrado: false,
  };
}

export function getState() { return estado; }
export function setState(novo) { estado = novo; return estado; }
export function limparState() { estado = null; }
