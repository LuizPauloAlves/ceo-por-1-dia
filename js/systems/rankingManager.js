// Ranking local em cookies (um cookie compacto por posição, cada um bem abaixo de 4 KB).
import { CONFIG } from "../core/gameConfig.js";
import { cookieLer, cookieGravar, cookieRemover } from "../utils/storage.js";
import { normalizarRegistroRanking } from "../utils/validators.js";
import { indicadoresPreservados } from "./scoreManager.js";

const nomeCookie = (i) => `${CONFIG.chaves.cookieRanking}_${i}`;

/** Ordenação: pontuação, depois indicadores preservados, depois menos emergências expiradas, depois mais antigo. */
export function compararRegistros(a, b) {
  const pa = indicadoresPreservados({ financeiro: a.financeiroFinal, clientes: a.clientesFinal, equipe: a.equipeFinal, operacao: a.operacaoFinal });
  const pb = indicadoresPreservados({ financeiro: b.financeiroFinal, clientes: b.clientesFinal, equipe: b.equipeFinal, operacao: b.operacaoFinal });
  return (b.pontuacao - a.pontuacao)
    || (pb - pa)
    || (a.emergenciasExpiradas - b.emergenciasExpiradas)
    || (new Date(a.data) - new Date(b.data));
}

/** Lê e valida o ranking dos cookies; registros inválidos ou duplicados são ignorados. */
export function carregarRanking() {
  const vistos = new Set();
  const lista = [];
  for (let i = 0; i < CONFIG.ranking.maxRegistros * 2; i++) {
    const txt = cookieLer(nomeCookie(i));
    if (!txt) continue;
    let r = null;
    try { r = normalizarRegistroRanking(JSON.parse(txt)); } catch { r = null; }
    if (r && !vistos.has(r.partidaId)) { vistos.add(r.partidaId); lista.push(r); }
  }
  return lista.sort(compararRegistros).slice(0, CONFIG.ranking.maxRegistros);
}

function compactar(r) {
  return { n: r.nickname, p: r.pontuacao, f: r.financeiroFinal, c: r.clientesFinal, e: r.equipeFinal, o: r.operacaoFinal,
    a: r.atividadesRespondidas, r: r.emergenciasResolvidas, x: r.emergenciasExpiradas, k: r.concluiu ? 1 : 0, d: r.data, g: r.partidaId };
}

/** Monta o registro de ranking a partir do estado final da partida. */
export function montarRegistro(e) {
  return {
    nickname: e.nickname, pontuacao: e.pontuacao,
    financeiroFinal: e.indicadores.financeiro, clientesFinal: e.indicadores.clientes,
    equipeFinal: e.indicadores.equipe, operacaoFinal: e.indicadores.operacao,
    atividadesRespondidas: e.progresso.normaisConcluidas,
    emergenciasResolvidas: e.progresso.emergenciasNoPrazo,
    emergenciasExpiradas: e.progresso.emergenciasExpiradas,
    concluiu: !!e.resultado?.concluiu, data: new Date().toISOString(), partidaId: e.id,
  };
}

/** Insere o registro (ignora partida repetida), mantém as 10 melhores e grava. Erros são devolvidos. */
export function registrar(registro) {
  const atual = carregarRanking();
  if (atual.some((r) => r.partidaId === registro.partidaId)) {
    return { ok: true, duplicado: true, posicao: atual.findIndex((r) => r.partidaId === registro.partidaId) + 1, ranking: atual };
  }
  const nova = [...atual, registro].sort(compararRegistros).slice(0, CONFIG.ranking.maxRegistros);
  const posicao = nova.findIndex((r) => r.partidaId === registro.partidaId) + 1; // 0 -> fora do top 10
  const erros = [];
  nova.forEach((r, i) => {
    const res = cookieGravar(nomeCookie(i), JSON.stringify(compactar(r)), CONFIG.ranking.cookieDias, CONFIG.ranking.cookieBytesMax);
    if (!res.ok) erros.push(res.erro);
  });
  for (let i = nova.length; i < CONFIG.ranking.maxRegistros * 2; i++) cookieRemover(nomeCookie(i));
  if (erros.length) return { ok: false, erro: `Não foi possível salvar o ranking: ${erros[0]}`, posicao, ranking: nova };
  return { ok: true, posicao, ranking: nova };
}
