// Simulação em massa: partidas completas com escolhas aleatórias; valida invariantes e ausência de travamentos.
import test from "node:test";
import assert from "node:assert/strict";
import { resetar, catalogoReal, semente } from "./helpers.js";
import { bus } from "../js/core/eventBus.js";
import { setRng, rand } from "../js/utils/random.js";
import * as E from "../js/core/gameEngine.js";

const c = await catalogoReal();

function jogar(seed) {
  resetar(); setRng(semente(seed)); E.iniciarEngine(c);
  const inicios = [];
  bus.on("tela:emergencia", ({ em, estado }) => { if (em.estado === "aguardando") inicios.push(estado.progresso.normaisConcluidas); });
  assert.ok(E.novaPartida("Sim").ok);
  let passos = 0;
  while (passos++ < 600) {
    const e = E.obterEstado();
    for (const k of ["clientes", "equipe", "operacao"]) assert.ok(e.indicadores[k] >= 0 && e.indicadores[k] <= 100);
    assert.ok(Number.isInteger(e.indicadores.financeiro));
    const pend = e.emergenciaAtual?.estado === "feedback" || e.atual?.estado === "feedback";
    if (e.status === "encerrada" && !pend) break;
    if (pend) E.avancar();
    else if (!e.atual && !e.emergenciaAtual) assert.ok(E.avancarRelogio().ok, "espera deve sempre avançar");
    else {
      if (!e.emergenciaAtual && rand() < 0.6) E.processarTempo(5000 + Math.floor(rand() * 60000));
      const cur = E.obterEstado();
      const q = cur.emergenciaAtual?.estado === "aguardando" ? cur.emergenciaAtual : cur.atual;
      E.responder(q.alternativas[Math.floor(rand() * 4)].id);
    }
  }
  assert.ok(passos < 600, "partida não terminou (travamento)");
  return { e: E.obterEstado(), inicios };
}

test("300 partidas aleatórias: invariantes, sem travar e sem emergência antes da 3ª atividade", () => {
  let concluidas = 0, derrotas = 0; const causas = {}; let pontos = 0;
  for (let s = 1; s <= 300; s++) {
    const { e, inicios } = jogar(s);
    assert.ok(inicios.every((n) => n >= 3), `emergência antes da 3ª atividade (seed ${s})`);
    assert.equal(new Set(e.usadas.perguntas).size, e.usadas.perguntas.length);
    assert.equal(new Set(e.usadas.emergencias).size, e.usadas.emergencias.length);
    assert.ok(e.usadas.emergencias.length <= 5);
    assert.equal(e.appliedEvents.length, new Set(e.appliedEvents).size);
    assert.equal(e.historico.length, e.appliedEvents.length);
    assert.ok(e.pontuacao >= 0 && e.pontuacao <= 1000);
    if (e.resultado.concluiu) {
      concluidas++; pontos += e.pontuacao;
      assert.equal(e.progresso.normaisConcluidas, 20); assert.equal(e.progresso.emergenciasConcluidas, 5);
      assert.equal(e.progresso.emergenciasNoPrazo + e.progresso.emergenciasExpiradas, 5);
    } else {
      derrotas++; causas[e.resultado.indicadorCritico] = (causas[e.resultado.indicadorCritico] ?? 0) + 1;
      assert.ok(e.indicadores[e.resultado.indicadorCritico] <= 0);
    }
  }
  console.log(`# simulação: ${concluidas} concluídas, ${derrotas} derrotas ${JSON.stringify(causas)}, pontuação média das concluídas ${(pontos / Math.max(1, concluidas)).toFixed(0)}`);
  assert.ok(concluidas > 0 && derrotas > 0, "o jogo deve ser desafiador porém vencível");
});
