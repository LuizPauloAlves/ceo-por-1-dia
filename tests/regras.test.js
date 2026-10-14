import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { resetar, catalogoReal, semente } from "./helpers.js";
import { CONFIG, INDICADORES } from "../js/core/gameConfig.js";
import { setRng } from "../js/utils/random.js";
import { selecionarAtividade, instanciarAtividade } from "../js/systems/questionSelector.js";
import { pesosEfetivos } from "../js/systems/categorySelector.js";
import { embaralhar } from "../js/systems/answerShuffler.js";
import { sortearImpacto, renderizarTexto, sortearVariaveis } from "../js/systems/variableGenerator.js";
import { criarEstadoInicial, setState, getState } from "../js/core/gameState.js";
import { aplicarImpactos, calcularPontuacao, verificarDerrota } from "../js/systems/scoreManager.js";
import { adaptarAtividades } from "../js/core/dataAdapter.js";
import { moeda, cronometro } from "../js/utils/formatters.js";
import { validarNickname } from "../js/utils/validators.js";
import { registrar, carregarRanking } from "../js/systems/rankingManager.js";
import * as Cons from "../js/systems/consequenceManager.js";

beforeEach(() => resetar());
const novo = () => setState(criarEstadoInicial("Teste", { normais: 20, emergencias: 5 }));

test("probabilidades das categorias somam 100%", () => {
  assert.equal(Object.values(CONFIG.probabilidadesCategorias).reduce((a, b) => a + b, 0), 100);
});

test("JSON real: 100 atividades e 60 emergências válidas, 4 alternativas cada, sem avisos", async () => {
  const c = await catalogoReal();
  assert.equal(c.atividades.length, 100);
  assert.equal(c.emergencias.length, 60);
  assert.deepEqual(c.avisos, []);
  assert.ok(c.atividades.every((a) => a.alternativas.length === 4 && a.alternativas.every((x) => x.borboleta.alternativas.length === 4)));
  assert.ok(c.emergencias.every((e) => e.alternativas.some((a) => a.id === e.piorAlternativaId)));
});

test("todos os marcadores {{...}} dos textos resolvem (nenhum vira \"—\")", async () => {
  const c = await catalogoReal();
  const avisos = [];
  const orig = console.warn; console.warn = (...a) => avisos.push(a.join(" "));
  try {
    for (const item of c.atividades) {
      const inst = instanciarAtividade(item, { caixaAtual: 25000, empresa: c.empresa, numero: 1 });
      const txt = [inst.titulo, inst.situacao, inst.pergunta, ...inst.alternativas.map((a) => a.texto)].join(" ");
      assert.ok(!txt.includes("{{") && !txt.includes("—"), item.id);
      for (const a of item.alternativas) {
        const pend = { problemaId: item.id, alternativaId: a.id, caso: inst.caso, origemTitulo: "t", origemEscolha: "x", eventoId: "c:" + a.borboleta.id, diasDepois: 30 };
        setState(criarEstadoInicial("T", { normais: 20, emergencias: 5 }));
        const ci = Cons.instanciar(c, pend, c.empresa);
        assert.ok(!ci.situacao.includes("{{") && !ci.situacao.includes("—"), a.borboleta.id);
      }
    }
  } finally { console.warn = orig; }
  assert.deepEqual(avisos, []);
});

test("seleção sem repetição: 100 sorteios distintos e depois null", async () => {
  const c = await catalogoReal();
  const usadas = [];
  for (let i = 0; i < 100; i++) { const it = selecionarAtividade(c, usadas); assert.ok(it); assert.ok(!usadas.includes(it.id)); usadas.push(it.id); }
  assert.equal(new Set(usadas).size, 100);
  assert.equal(selecionarAtividade(c, usadas), null);
});

test("distribuição de categorias respeita as probabilidades (amostra grande)", async () => {
  const c = await catalogoReal();
  setRng(semente(42));
  const cont = {}; const N = 20000;
  for (let i = 0; i < N; i++) { const it = selecionarAtividade(c, []); cont[it.categoria] = (cont[it.categoria] ?? 0) + 1; }
  for (const [cat, p] of Object.entries(CONFIG.probabilidadesCategorias)) {
    assert.ok(Math.abs(cont[cat] / N * 100 - p) < 1.5, `${cat}: ${(cont[cat] / N * 100).toFixed(1)}% vs ${p}%`);
  }
});

test("categoria esgotada redistribui proporcionalmente", () => {
  const w = pesosEfetivos({ Pessoas: 0, Clientes: 5, Financeiro: 5, "Operação": 5, Marketing: 5, Desenvolvimento: 5 });
  assert.equal(w.Pessoas, 0);
  assert.ok(Math.abs(Object.values(w).reduce((a, b) => a + b, 0) - 100) < 1e-9);
  assert.ok(Math.abs(w.Clientes / w.Desenvolvimento - 2) < 1e-9);
  assert.deepEqual(Object.values(pesosEfetivos({})).filter(Boolean), []);
});

test("embaralhamento: Fisher-Yates preserva ids/impactos, não altera o original e gera todas as ordens", async () => {
  const c = await catalogoReal();
  const orig = c.atividades[0].alternativas;
  const copia = JSON.stringify(orig);
  const ordens = new Set();
  setRng(semente(7));
  for (let i = 0; i < 400; i++) {
    const e = embaralhar(orig);
    assert.deepEqual(e.map((a) => a.id).sort(), orig.map((a) => a.id).sort());
    assert.deepEqual(e.map((a) => a.letra), ["A", "B", "C", "D"]);
    for (const a of e) assert.deepEqual(a.impactos, orig.find((o) => o.id === a.id).impactos);
    ordens.add(e.map((a) => a.id).join());
  }
  assert.equal(JSON.stringify(orig), copia);
  assert.equal(ordens.size, 24);
});

test("variação: sinal preservado, zero fixo, inteiros e dentro do intervalo do JSON", async () => {
  const c = await catalogoReal();
  for (let r = 0; r < 20; r++) for (const it of c.atividades) for (const a of it.alternativas) for (const k of INDICADORES) {
    const s = a.impactos[k]; const v = sortearImpacto(s);
    assert.ok(Number.isInteger(v));
    if (s.padrao === 0) assert.equal(v, 0); else {
      assert.equal(Math.sign(v), Math.sign(s.padrao));
      assert.ok(v >= Math.min(s.min, s.max) && v <= Math.max(s.min, s.max));
      assert.ok(Math.abs(v) >= 1);
    }
  }
  assert.equal(sortearImpacto({ padrao: -1, min: -1, max: -1 }), -1);
});

test("instância guarda valores sorteados (serializável e imutável após F5)", async () => {
  const c = await catalogoReal();
  const inst = instanciarAtividade(c.atividades[3], { caixaAtual: 18000, empresa: c.empresa, numero: 4 });
  const snap = JSON.stringify(inst);
  setRng(semente(1)); sortearImpacto({ padrao: 5, min: 1, max: 9 });
  assert.equal(JSON.stringify(JSON.parse(snap)), snap);
});

test("formatadores e marcadores", () => {
  assert.equal(moeda(25000), "R$ 25.000"); assert.equal(moeda(-1500), "-R$ 1.500"); assert.equal(cronometro(120), "02:00"); assert.equal(cronometro(0.2), "00:01");
  assert.equal(renderizarTexto("{{caso.h|hora}} {{caso.m|meses}} {{estado_atual.F_caixa_rs|moeda}}", { caso: { h: "05:30", m: 1 }, estado_atual: { F_caixa_rs: 25000 } }), "05h30 1 mês R$ 25.000");
  assert.equal(sortearVariaveis({ x: { valor_padrao: 90, min: 40, max: 300, passo: 5, tipo: "inteiro" } }).x % 5, 0);
});

test("nickname: obrigatório e limitado a 20 caracteres", () => {
  assert.equal(validarNickname("   ").ok, false);
  assert.equal(validarNickname("a".repeat(21)).ok, false);
  assert.deepEqual(validarNickname("  Ana  Maria "), { ok: true, valor: "Ana Maria" });
});

test("indicadores iniciais e exemplo do enunciado (-1.500, +5, -8, +3)", () => {
  const e = novo();
  assert.deepEqual(e.indicadores, { financeiro: 100000, clientes: 50, equipe: 50, operacao: 50 });
  const r = aplicarImpactos("x1", { financeiro: -1500, clientes: 5, equipe: -8, operacao: 3 });
  assert.deepEqual(getState().indicadores, { financeiro: 98500, clientes: 55, equipe: 42, operacao: 53 });
  assert.equal(r.derrota, null);
});

test("limites 0..100, caixa sem teto e idempotência por eventoId", () => {
  const e = novo();
  aplicarImpactos("a", { financeiro: 1000000, clientes: 90, equipe: 0, operacao: 0 });
  assert.equal(e.indicadores.clientes, 100); assert.equal(e.indicadores.financeiro, 1100000);
  const antes = JSON.stringify(e.indicadores);
  assert.equal(aplicarImpactos("a", { financeiro: -999999, clientes: -50, equipe: -50, operacao: -50 }).duplicado, true);
  assert.equal(JSON.stringify(e.indicadores), antes);
  assert.equal(e.historico.length, 1);
});

test("derrota por qualquer indicador zerado", () => {
  for (const [k, v] of [["financeiro", -100000], ["clientes", -50], ["equipe", -70], ["operacao", -60]]) {
    resetar(); novo();
    assert.equal(aplicarImpactos("d", { [k]: v }).derrota.indicador, k, k);
  }
  assert.equal(verificarDerrota({ financeiro: 1, clientes: 1, equipe: 1, operacao: 1 }), null);
});

test("pontuação: estado inicial = 500, máximo 1000, financeiro com teto, derrota penalizada", () => {
  const e = novo();
  assert.equal(calcularPontuacao(e), 500);
  e.indicadores = { financeiro: 1e9, clientes: 100, equipe: 100, operacao: 100 };
  e.resultado = { concluiu: true };
  assert.equal(calcularPontuacao(e), 1000);
  e.indicadores = { financeiro: 200000, clientes: 0, equipe: 0, operacao: 0 };
  assert.equal(calcularPontuacao(e), 250);
  e.indicadores = { financeiro: 100000, clientes: 100, equipe: 50, operacao: 50 };
  assert.equal(calcularPontuacao(e), 625);
  e.status = "encerrada"; e.resultado = { concluiu: false };
  assert.equal(calcularPontuacao(e), Math.round(625 * 0.3));
});

test("ranking: ordena, desempata, limita a 10, ignora partida repetida e cabe em cookies", () => {
  const base = { financeiroFinal: 30000, clientesFinal: 70, equipeFinal: 70, operacaoFinal: 70, atividadesRespondidas: 20, emergenciasResolvidas: 5, emergenciasExpiradas: 0, concluiu: true };
  for (let i = 0; i < 12; i++) registrar({ ...base, nickname: `J${i}`, pontuacao: 500 + i * 10, data: new Date(2026, 0, i + 1).toISOString(), partidaId: `p${i}` });
  const r = carregarRanking();
  assert.equal(r.length, 10);
  assert.deepEqual(r.map((x) => x.pontuacao), [...r.map((x) => x.pontuacao)].sort((a, b) => b - a));
  assert.equal(r[0].nickname, "J11");
  assert.equal(registrar({ ...base, nickname: "J11", pontuacao: 999, data: new Date().toISOString(), partidaId: "p11" }).duplicado, true);
  assert.equal(carregarRanking().length, 10);
  resetar();
  registrar({ ...base, nickname: "A", pontuacao: 700, clientesFinal: 10, data: new Date(2026, 1, 1).toISOString(), partidaId: "a" });
  registrar({ ...base, nickname: "B", pontuacao: 700, data: new Date(2026, 1, 2).toISOString(), partidaId: "b" });
  registrar({ ...base, nickname: "C", pontuacao: 700, emergenciasExpiradas: 2, data: new Date(2026, 1, 3).toISOString(), partidaId: "c" });
  assert.deepEqual(carregarRanking().map((x) => x.nickname), ["B", "C", "A"]);
  registrar({ ...base, nickname: "B", pontuacao: 100, data: new Date(2026, 1, 4).toISOString(), partidaId: "b2" });
  assert.equal(carregarRanking().filter((x) => x.nickname === "B").length, 2);
  for (const [k, v] of globalThis.document._jar) assert.ok(new TextEncoder().encode(`${k}=${v}`).length < 400, k);
});

test("ranking: registros corrompidos no cookie são ignorados", () => {
  globalThis.document.cookie = "ceo1d_rk_0=" + encodeURIComponent("{\"n\":\"X\",\"p\":\"abc\"}");
  globalThis.document.cookie = "ceo1d_rk_1=lixo";
  assert.deepEqual(carregarRanking(), []);
});

test("ranking: cookies bloqueados geram erro explícito", () => {
  Object.defineProperty(globalThis.document, "cookie", { get: () => "", set: () => {}, configurable: true });
  const r = registrar({ nickname: "Z", pontuacao: 1, financeiroFinal: 1, clientesFinal: 1, equipeFinal: 1, operacaoFinal: 1, atividadesRespondidas: 1, emergenciasResolvidas: 0, emergenciasExpiradas: 0, concluiu: false, data: new Date().toISOString(), partidaId: "z" });
  assert.equal(r.ok, false); assert.match(r.erro, /ranking/i);
});

test("adaptador detecta dados incompletos sem inventar conteúdo", () => {
  const r = adaptarAtividades({ problemas: [{ id: "X1", categoria: "Pessoas", titulo: "t", situacao: "s", pergunta: "p", alternativas: [{ id: "X1-A", texto: "a" }] }] });
  assert.equal(r.itens.length, 0); assert.ok(r.erros.length > 0);
  assert.equal(adaptarAtividades(null).itens.length, 0);
});
