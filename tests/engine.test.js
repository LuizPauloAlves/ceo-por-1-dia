import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { resetar, catalogoReal, avancarRelogio, semente } from "./helpers.js";
import { bus } from "../js/core/eventBus.js";
import { setRng } from "../js/utils/random.js";
import { limparState } from "../js/core/gameState.js";
import * as E from "../js/core/gameEngine.js";
import * as Emerg from "../js/systems/emergencyManager.js";
import { carregarRanking } from "../js/systems/rankingManager.js";
import { CONFIG } from "../js/core/gameConfig.js";

const c = await catalogoReal();
let telas;
beforeEach(() => {
  resetar();
  setRng(semente(2026)); // testes reprodutíveis (cada teste pode trocar o gerador)
  telas = [];
  for (const t of ["pergunta", "emergencia", "espera", "resultado"]) bus.on(`tela:${t}`, (d) => telas.push({ t, d }));
  E.iniciarEngine(c);
});

const est = () => E.obterEstado();
const clone = (o) => JSON.parse(JSON.stringify(o));
const comecar = (catalogo = c) => { if (catalogo !== c) E.iniciarEngine(catalogo); const r = E.novaPartida("Ana"); assert.ok(r.ok, r.erro); blindar(); return est(); };
/** Indicadores altos para os testes não serem encerrados por derrota. */
function blindar() { Object.assign(est().indicadores, { financeiro: 500000, clientes: 100, equipe: 100, operacao: 100 }); }
const responderPrimeira = () => E.responder((est().emergenciaAtual?.estado === "aguardando" ? est().emergenciaAtual : est().atual).alternativas[0].id);
function normaisAte(n) { while (est().progresso.normaisConcluidas < n) { responderPrimeira(); E.avancar(); blindar(); } }

test("nova partida: estado inicial correto e uma pergunta exibida", () => {
  const e = comecar();
  assert.equal(e.atual.tipo, "normal"); assert.equal(e.atual.numero, 1); assert.equal(e.atual.alternativas.length, 4);
  assert.equal(e.usadas.perguntas.length, 1); assert.deepEqual(e.usadas.emergencias, []);
  assert.deepEqual(e.metas, { normais: 20, emergencias: 5 });
  assert.equal(telas.at(-1).t, "pergunta");
});

test("emergências só a partir da 3ª atividade respondida", () => {
  comecar();
  for (let n = 0; n < 3; n++) {
    normaisAte(n);
    assert.equal(E.processarTempo(3600000), null, `com ${n} atividades`); assert.equal(est().emergenciaAtual, null);
    assert.equal(est().usadas.emergencias.length, 0);
  }
  normaisAte(3);
  assert.equal(est().progresso.normaisConcluidas, 3);
  assert.equal(E.processarTempo(1000), null); // Mecanismo C: ainda faltam 19s
  assert.ok(E.processarTempo(3600000));       // agora habilitadas
});

test("Mecanismo C: 3 atividades -> emergência 20s depois (tempo elegível)", () => {
  comecar(); setRng(() => 0.99); normaisAte(3);
  assert.equal(est().relogio.agendadaRestanteMs, 20000);
  assert.equal(E.processarTempo(19000), null);
  assert.equal(E.processarTempo(1000), "perguntas");
  assert.ok(est().emergenciaAtual);
});

test("Mecanismo B: força emergência após 5 minutos elegíveis", () => {
  comecar(); setRng(() => 0.99); normaisAte(3);
  Object.assign(est().relogio, { agendadaRestanteMs: null, normaisDesdeUltima: 0, semEmergenciaMs: 0, sorteioMs: 0 });
  assert.equal(E.processarTempo(299000), null);
  assert.equal(E.processarTempo(1000), "tempo_maximo");
});

test("Mecanismo A: sorteio de 25% a cada 60s", () => {
  comecar(); normaisAte(3);
  const zerar = () => Object.assign(est().relogio, { agendadaRestanteMs: null, normaisDesdeUltima: 0, semEmergenciaMs: 0, sorteioMs: 0 });
  zerar(); setRng(() => 0.3); assert.equal(E.processarTempo(120000), null);
  zerar(); setRng(() => 0.1); assert.equal(E.processarTempo(59000), null); assert.equal(E.processarTempo(1000), "sorteio");
});

test("nunca duas emergências simultâneas; contadores zerados após disparo", () => {
  comecar(); setRng(() => 0.99); normaisAte(3);
  assert.equal(E.processarTempo(20000), "perguntas");
  const em = est().emergenciaAtual;
  assert.equal(E.processarTempo(3600000), null);
  assert.equal(Emerg.disparar(c, "sorteio"), null);
  assert.equal(est().emergenciaAtual, em);
  assert.equal(est().usadas.emergencias.length, 1);
  assert.deepEqual(est().relogio, { semEmergenciaMs: 0, sorteioMs: 0, agendadaRestanteMs: null, normaisDesdeUltima: 0 });
});

test("emergência durante pergunta: pergunta preservada exatamente e restaurada depois", () => {
  comecar(); setRng(() => 0.99); normaisAte(3);
  const antes = clone(est().atual);
  E.processarTempo(20000);
  assert.equal(telas.at(-1).t, "emergencia");
  assert.deepEqual(clone(est().atual), antes);
  responderPrimeira();
  assert.equal(est().emergenciaAtual.estado, "feedback");
  E.avancar();
  assert.equal(est().emergenciaAtual, null);
  assert.deepEqual(clone(est().atual), antes);
  assert.equal(telas.at(-1).t, "pergunta"); assert.equal(telas.at(-1).d.atual.estado, "aguardando");
});

test("emergência: 120 segundos exatos e 4 alternativas com pior caso identificado", () => {
  comecar(); setRng(() => 0.99); normaisAte(3); E.processarTempo(20000);
  const em = est().emergenciaAtual;
  assert.equal(em.expiraEm - em.iniciadaEm, 120000); assert.equal(em.duracaoMs, 120000);
  assert.equal(em.alternativas.length, 4);
  assert.ok(em.alternativas.some((a) => a.id === em.piorAlternativaId));
});

test("expiração: pior alternativa aplicada uma única vez; clique no instante do vencimento perde", () => {
  comecar(); setRng(() => 0.99); normaisAte(3); E.processarTempo(20000);
  const em = est().emergenciaAtual;
  const pior = em.alternativas.find((a) => a.id === em.piorAlternativaId);
  const antes = { ...est().indicadores };
  avancarRelogio(120000);
  const r = E.responder(em.alternativas.find((a) => a.id !== pior.id).id);
  assert.ok(r.ok);
  assert.equal(est().emergenciaAtual.motivoEncerramento, "tempo_esgotado");
  assert.equal(est().emergenciaAtual.escolhaId, pior.id);
  const dep = est().indicadores;
  assert.equal(dep.financeiro, antes.financeiro + pior.impactos.financeiro);
  assert.equal(dep.clientes, Math.min(100, Math.max(0, antes.clientes + pior.impactos.clientes)));
  assert.equal(est().progresso.emergenciasExpiradas, 1);
  const snap = JSON.stringify(est().indicadores);
  assert.equal(E.responder(pior.id).ok, false);
  assert.equal(Emerg.expirarEmergencia().ignorado, true);
  assert.equal(JSON.stringify(est().indicadores), snap);
  assert.equal(est().appliedEvents.filter((x) => x === `e:${em.emergenciaId}`).length, 1);
});

test("F5 durante emergência: mesma emergência, mesmo prazo; vencida durante ausência -> penalidade 1 vez", () => {
  comecar(); setRng(() => 0.99); normaisAte(3); E.processarTempo(20000);
  const antes = clone(est().emergenciaAtual);
  avancarRelogio(45000);
  limparState(); assert.ok(E.continuarPartida().ok);
  assert.deepEqual(clone(est().emergenciaAtual), antes);
  assert.equal(est().emergenciaAtual.expiraEm, antes.expiraEm);
  avancarRelogio(100000);
  const ind0 = { ...est().indicadores };
  limparState(); assert.ok(E.continuarPartida().ok);
  assert.equal(est().emergenciaAtual.motivoEncerramento, "tempo_esgotado");
  assert.equal(est().progresso.emergenciasExpiradas, 1);
  const ind1 = JSON.stringify(est().indicadores);
  assert.notEqual(ind1, JSON.stringify(ind0));
  for (let i = 0; i < 3; i++) { limparState(); E.continuarPartida(); }
  assert.equal(JSON.stringify(est().indicadores), ind1);
  assert.equal(est().progresso.emergenciasExpiradas, 1);
  assert.equal(est().appliedEvents.filter((x) => x.startsWith("e:")).length, 1);
});

test("F5 durante pergunta: mesma pergunta, mesmo embaralhamento e impactos; sem aplicar duas vezes", () => {
  comecar(); normaisAte(2);
  while (est().atual.tipo !== "normal") { responderPrimeira(); E.avancar(); blindar(); }
  const n0 = est().progresso.normaisConcluidas;
  const antes = clone(est().atual);
  limparState(); E.continuarPartida();
  assert.deepEqual(clone(est().atual), antes);
  const alt = est().atual.alternativas[1];
  const f0 = est().indicadores.financeiro;
  E.responder(alt.id); const f1 = est().indicadores.financeiro;
  assert.equal(f1, f0 + alt.impactos.financeiro);
  assert.equal(E.responder(alt.id).ok, false);
  limparState(); E.continuarPartida();
  assert.equal(est().indicadores.financeiro, f1);
  assert.equal(est().atual.estado, "feedback");
  assert.equal(est().progresso.normaisConcluidas, n0 + 1);
});

test("efeito borboleta: agendado, salvo, restaurado e aplicado uma vez sem contar como atividade", () => {
  comecar();
  responderPrimeira();
  const pend = est().consequencias.pendentes;
  assert.equal(pend.length, 1);
  assert.ok(pend[0].diasDepois >= 7);
  const vence = pend[0].venceAposNormais;
  assert.ok(vence >= 2 && vence <= 5);
  limparState(); E.continuarPartida();
  assert.deepEqual(est().consequencias.pendentes, pend);
  E.avancar(); blindar();
  let visto = null;
  for (let i = 0; i < 12 && !visto; i++) {
    if (est().atual?.tipo === "consequencia") visto = clone(est().atual); else { responderPrimeira(); E.avancar(); blindar(); }
  }
  assert.ok(visto, "o desdobramento deveria aparecer");
  assert.equal(visto.alternativas.length, 4);
  const antes = est().progresso.normaisConcluidas;
  const proprio = est().consequencias.pendentes.find((p) => p.eventoId === visto.eventoId);
  assert.ok(antes >= proprio.venceAposNormais, "só aparece depois do prazo");
  limparState(); E.continuarPartida();
  assert.deepEqual(clone(est().atual), visto);
  responderPrimeira();
  assert.equal(est().progresso.normaisConcluidas, antes);
  assert.equal(est().consequencias.aplicadas.length >= 1, true);
  assert.equal(est().consequencias.pendentes.some((p) => p.eventoId === visto.eventoId), false);
  assert.equal(est().appliedEvents.filter((x) => x === visto.eventoId).length, 1);
});

test("derrota imediata: indicador zerado encerra, mostra feedback final e registra ranking uma vez", () => {
  comecar();
  est().indicadores.operacao = 2;
  est().atual.alternativas.forEach((a) => { a.impactos.operacao = -5; });
  responderPrimeira();
  assert.equal(est().status, "encerrada"); assert.equal(est().resultado.tipo, "derrota"); assert.equal(est().indicadores.operacao, 0);
  assert.equal(telas.at(-1).d.final, true);
  assert.equal(E.responder(est().atual.alternativas[0].id).ok, false);
  E.avancar();
  assert.equal(telas.at(-1).t, "resultado");
  assert.equal(carregarRanking().length, 1);
  limparState(); E.continuarPartida(); E.avancar();
  assert.equal(carregarRanking().length, 1);
  assert.equal(carregarRanking()[0].concluiu, false);
});

test("partida completa: 20 atividades + 5 emergências, sem repetição, resultado e ranking", () => {
  comecar(); setRng(semente(5));
  let guarda = 0;
  while (est().status === "jogando" && guarda++ < 500) {
    const e = est();
    if (e.emergenciaAtual?.estado === "feedback" || e.atual?.estado === "feedback") E.avancar();
    else if (!e.atual && !e.emergenciaAtual) assert.ok(E.avancarRelogio().ok);
    else { if (!e.emergenciaAtual) E.processarTempo(30000); responderPrimeira(); }
    blindar();
  }
  const e = est();
  assert.equal(e.status, "encerrada");
  assert.equal(e.resultado.concluiu, true);
  assert.equal(e.progresso.normaisConcluidas, 20); assert.equal(e.progresso.emergenciasConcluidas, 5);
  assert.equal(new Set(e.usadas.perguntas).size, e.usadas.perguntas.length);
  assert.ok(e.usadas.perguntas.length >= 20);
  assert.equal(new Set(e.usadas.emergencias).size, 5);
  assert.equal(e.historico.filter((h) => h.tipo === "normal").length, 20);
  assert.equal(e.historico.filter((h) => h.tipo === "emergencia").length, 5);
  assert.equal(telas.at(-1).t, "resultado");
  assert.equal(carregarRanking().length, 1);
  assert.equal(carregarRanking()[0].pontuacao, e.pontuacao);
});

test("após 20 atividades com emergências faltando: tela de espera e avanço sem criar extras", () => {
  comecar(); setRng(() => 0.99);
  while (est().progresso.normaisConcluidas < 20) { responderPrimeira(); if (est().emergenciaAtual) throw new Error("emergência inesperada"); E.avancar(); blindar(); }
  while (est().atual?.tipo === "consequencia") { responderPrimeira(); E.avancar(); }
  assert.equal(telas.at(-1).t, "espera");
  for (let i = 1; i <= 5; i++) {
    const r = E.avancarRelogio(); assert.ok(r.ok, `emergência ${i}`);
    assert.equal(est().usadas.emergencias.length, i);
    responderPrimeira(); E.avancar(); blindar();
  }
  assert.equal(est().status, "encerrada"); assert.equal(est().usadas.emergencias.length, 5);
  assert.equal(E.avancarRelogio().ok, false);
});

test("pouco conteúdo: metas reduzidas, sem repetir perguntas", () => {
  const pequeno = { ...c, atividades: c.atividades.slice(0, 7), emergencias: c.emergencias.slice(0, 2) };
  comecar(pequeno);
  assert.deepEqual(est().metas, { normais: 7, emergencias: 2 });
  setRng(semente(9)); let g = 0;
  while (est().status === "jogando" && g++ < 300) {
    const e = est();
    if (e.emergenciaAtual?.estado === "feedback" || e.atual?.estado === "feedback") E.avancar();
    else if (!e.atual && !e.emergenciaAtual) E.avancarRelogio();
    else { if (!e.emergenciaAtual) E.processarTempo(40000); responderPrimeira(); }
    blindar();
  }
  assert.equal(est().resultado.concluiu, true);
  assert.equal(est().progresso.normaisConcluidas, 7);
  assert.equal(new Set(est().usadas.perguntas).size, est().usadas.perguntas.length);
});

test("duas abas: nova partida bloqueada, tomada de controle e conflito de versão", () => {
  localStorage.setItem(CONFIG.chaves.lockAba, JSON.stringify({ id: "outra", ts: Date.now() }));
  const r = E.novaPartida("Ana"); assert.equal(r.ok, false); assert.equal(r.outraAba, true);
  assert.ok(E.novaPartida("Ana", { forcar: true }).ok);
  blindar();
  const salvo = JSON.parse(localStorage.getItem(CONFIG.chaves.partida));
  salvo.versao += 10; localStorage.setItem(CONFIG.chaves.partida, JSON.stringify(salvo)); // "outra aba" jogou
  const f0 = est().indicadores.financeiro;
  const resp = E.responder(est().atual.alternativas[0].id);
  assert.equal(resp.ok, false); assert.equal(resp.motivo, "aba");
  assert.equal(est().indicadores.financeiro, f0);
  assert.equal(est().atual.estado, "aguardando");
});

test("armazenamento bloqueado: aviso explícito, sem afirmar que salvou", () => {
  let erros = 0; bus.on("save:erro", () => erros++);
  globalThis.localStorage = { getItem() { throw new Error("bloqueado"); }, setItem() { throw new Error("bloqueado"); }, removeItem() {} };
  const r = E.novaPartida("Ana");
  assert.ok(r.ok); assert.ok(r.avisoSave); assert.ok(erros >= 1);
});

test("partidas independentes: ids, listas e embaralhamento reiniciam", () => {
  const a = comecar(); const idA = a.id;
  normaisAte(3);
  E.descartarPartida();
  const b = comecar();
  assert.notEqual(b.id, idA); assert.equal(b.usadas.perguntas.length, 1); assert.equal(b.progresso.normaisConcluidas, 0);
  assert.equal(b.appliedEvents.length, 0); assert.deepEqual(b.consequencias.pendentes, []);
});
