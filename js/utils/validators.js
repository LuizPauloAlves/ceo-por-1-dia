// Validações de dados externos: nickname, itens dos JSON, estado salvo e registros de ranking.
import { CONFIG, INDICADORES } from "../core/gameConfig.js";

/** Valida e normaliza o nickname (1 a 20 caracteres, sem caracteres de controle). */
export function validarNickname(texto) {
  const v = String(texto ?? "").replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim();
  if (!v) return { ok: false, erro: "Digite um nickname para jogar." };
  if (v.length > CONFIG.nicknameMax) return { ok: false, erro: `Use no máximo ${CONFIG.nicknameMax} caracteres.` };
  return { ok: true, valor: v };
}

const ehNum = (x) => typeof x === "number" && Number.isFinite(x);

/** Uma "spec" de impacto é {padrao, min, max}. */
export function specValida(s) {
  return !!s && ehNum(s.padrao) && ehNum(s.min) && ehNum(s.max) && s.min <= s.max;
}

function validarAlternativas(alts, rotulo, erros, comEfeito) {
  if (!Array.isArray(alts) || alts.length !== 4) { erros.push(`${rotulo}: precisa ter exatamente 4 alternativas`); return; }
  const ids = new Set();
  for (const a of alts) {
    if (!a?.id || ids.has(a.id)) erros.push(`${rotulo}: id de alternativa ausente ou duplicado (${a?.id})`);
    ids.add(a?.id);
    if (!a?.texto || typeof a.texto !== "string") erros.push(`${rotulo}/${a?.id}: texto ausente`);
    for (const ind of INDICADORES) {
      if (!specValida(a?.impactos?.[ind])) erros.push(`${rotulo}/${a?.id}: impacto "${ind}" ausente ou inválido`);
    }
    if (comEfeito) {
      const eb = a.borboleta;
      if (!eb?.id || !specValida(eb.dias) || !eb.narrativa || !eb.novoDilema) erros.push(`${rotulo}/${a.id}: efeito borboleta incompleto`);
      else validarAlternativas(eb.alternativas, `${rotulo}/${a.id}/${eb.id}`, erros, false);
    }
  }
}

/** Valida atividade normal já adaptada; devolve lista de erros (vazia = válida). */
export function validarAtividade(item) {
  const erros = [];
  if (!item?.id) erros.push("atividade sem id");
  if (!item?.categoria) erros.push(`${item?.id}: sem categoria`);
  if (!item?.situacao || !item?.titulo) erros.push(`${item?.id}: sem título ou situação`);
  validarAlternativas(item?.alternativas, String(item?.id), erros, true);
  return erros;
}

/** Valida emergência adaptada. */
export function validarEmergencia(item) {
  const erros = [];
  if (!item?.id) erros.push("emergência sem id");
  if (!item?.situacao || !item?.titulo) erros.push(`${item?.id}: sem título ou situação`);
  validarAlternativas(item?.alternativas, String(item?.id), erros, false);
  if (!item?.alternativas?.some((a) => a.id === item?.piorAlternativaId)) erros.push(`${item?.id}: pior alternativa não identificada nos dados`);
  return erros;
}

/** Valida a estrutura mínima de um estado salvo. Devolve lista de erros. */
export function validarEstadoSalvo(e) {
  const erros = [];
  if (!e || typeof e !== "object") return ["estado inexistente"];
  if (e.versaoSave !== CONFIG.versaoSave) erros.push("versão de save incompatível");
  if (!e.id || typeof e.id !== "string") erros.push("id da partida ausente");
  if (typeof e.nickname !== "string" || !e.nickname) erros.push("nickname ausente");
  if (!["jogando", "encerrada"].includes(e.status)) erros.push("status inválido");
  if (!ehNum(e.versao)) erros.push("versão do estado inválida");
  for (const ind of INDICADORES) {
    const v = e.indicadores?.[ind];
    if (!ehNum(v) || !Number.isInteger(v)) erros.push(`indicador ${ind} inválido`);
    else if (ind !== "financeiro" && (v < 0 || v > 100)) erros.push(`indicador ${ind} fora dos limites`);
  }
  if (!Array.isArray(e.usadas?.perguntas) || !Array.isArray(e.usadas?.emergencias)) erros.push("listas de usados ausentes");
  if (new Set(e.usadas?.perguntas).size !== e.usadas?.perguntas?.length) erros.push("perguntas repetidas no save");
  if (new Set(e.usadas?.emergencias).size !== e.usadas?.emergencias?.length) erros.push("emergências repetidas no save");
  if (!ehNum(e.progresso?.normaisConcluidas) || !ehNum(e.progresso?.emergenciasConcluidas)) erros.push("progresso inválido");
  if (!Array.isArray(e.appliedEvents)) erros.push("registro de eventos aplicados ausente");
  if (!e.consequencias || !Array.isArray(e.consequencias.pendentes)) erros.push("consequências inválidas");
  if (!e.relogio || !ehNum(e.relogio.semEmergenciaMs)) erros.push("contadores de emergência ausentes");
  return erros;
}

/** Valida/normaliza um registro compacto de ranking. Devolve registro completo ou null. */
export function normalizarRegistroRanking(r) {
  if (!r || typeof r !== "object") return null;
  const nick = validarNickname(r.n);
  const inteiros = ["p", "f", "c", "e", "o", "a", "r", "x"];
  if (!nick.ok || inteiros.some((k) => !ehNum(r[k]))) return null;
  if ([r.c, r.e, r.o].some((v) => v < 0 || v > 100)) return null;
  if (typeof r.g !== "string" || !r.g || typeof r.d !== "string" || Number.isNaN(new Date(r.d).getTime())) return null;
  return {
    nickname: nick.valor, pontuacao: r.p, financeiroFinal: r.f, clientesFinal: r.c, equipeFinal: r.e,
    operacaoFinal: r.o, atividadesRespondidas: r.a, emergenciasResolvidas: r.r, emergenciasExpiradas: r.x,
    concluiu: r.k === 1, data: r.d, partidaId: r.g,
  };
}
