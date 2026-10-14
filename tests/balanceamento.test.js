// Balanceamento: com a estratégia "melhor/2ª/3ª/pior alternativa" (ordem pela variação líquida nominal),
// a pontuação final deve cair nas faixas combinadas. Estado inicial = 500; melhor caminho ~1000; pior ~100.
import test from "node:test";
import assert from "node:assert/strict";
import { resetar, catalogoReal, semente } from "./helpers.js";
import { setRng, rand } from "../js/utils/random.js";
import * as E from "../js/core/gameEngine.js";

const c = await catalogoReal();
const nominal = new Map();
const U = (imp) => (imp.financeiro?.padrao ?? 0) / 800 + 2.5 * ((imp.clientes?.padrao ?? 0) + (imp.equipe?.padrao ?? 0) + (imp.operacao?.padrao ?? 0));
for (const a of c.atividades) for (const alt of a.alternativas) { nominal.set(alt.id, U(alt.impactos)); for (const b of alt.borboleta?.alternativas ?? []) nominal.set(b.id, U(b.impactos)); }
for (const em of c.emergencias) for (const alt of em.alternativas) nominal.set(alt.id, U(alt.impactos));

function jogar(seed, estrategia) {
  resetar(); setRng(semente(seed)); E.iniciarEngine(c);
  E.novaPartida("Bal");
  for (let passos = 0; passos < 800; passos++) {
    const e = E.obterEstado();
    const pend = e.emergenciaAtual?.estado === "feedback" || e.atual?.estado === "feedback";
    if (e.status === "encerrada" && !pend) break;
    if (pend) E.avancar();
    else if (!e.atual && !e.emergenciaAtual) E.avancarRelogio();
    else {
      if (!e.emergenciaAtual && rand() < 0.6) E.processarTempo(5000 + Math.floor(rand() * 60000));
      const cur = E.obterEstado();
      const q = cur.emergenciaAtual?.estado === "aguardando" ? cur.emergenciaAtual : cur.atual;
      const ord = [...q.alternativas].sort((a, b) => nominal.get(b.id) - nominal.get(a.id));
      const esc = { melhor: ord[0], "2a": ord[1], "3a": ord[2], pior: ord[3], meio: ord[1 + Math.floor(rand() * 2)], aleatoria: ord[Math.floor(rand() * 4)] }[estrategia];
      E.responder(esc.id);
    }
  }
  return E.obterEstado();
}
const media = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
function rodar(estrategia, n = 40) {
  const rs = Array.from({ length: n }, (_, i) => jogar(i * 7 + 1, estrategia));
  return { media: media(rs.map((r) => r.pontuacao)), derrotas: rs.filter((r) => !r.resultado.concluiu).length, n };
}

test("estado inicial vale 500 pontos", () => {
  resetar(); E.iniciarEngine(c); E.novaPartida("X");
  assert.equal(E.obterEstado().pontuacao ?? 500, 500);
});

test("sempre a melhor alternativa: perto de 1000", () => {
  const r = rodar("melhor"); console.log("# melhor", r);
  assert.ok(r.media >= 880, `média ${r.media}`);
});

test("alternativas intermediárias: entre 350 e 550", () => {
  for (const est of ["meio", "2a", "3a"]) {
    const r = rodar(est); console.log("#", est, r);
    assert.ok(r.media >= 350 && r.media <= 550, `${est}: média ${r.media}`);
  }
});

test("sempre a pior alternativa: ~100 ou derrota", () => {
  const r = rodar("pior"); console.log("# pior", r);
  assert.ok(r.media <= 200, `média ${r.media}`);
  assert.ok(r.derrotas >= r.n * 0.9, "quase todas as partidas devem terminar em derrota");
});

test("escolhas aleatórias: média próxima de 500", () => {
  const r = rodar("aleatoria", 80); console.log("# aleatoria", r);
  assert.ok(r.media >= 430 && r.media <= 570, `média ${r.media}`);
});
