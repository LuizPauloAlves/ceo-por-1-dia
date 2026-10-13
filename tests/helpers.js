// Ambiente de teste: simula localStorage, sessionStorage, cookies e relógio; carrega os JSON reais.
import fs from "node:fs";
import { bus } from "../js/core/eventBus.js";
import { limparState } from "../js/core/gameState.js";
import { setRng } from "../js/utils/random.js";
import { carregarCatalogo } from "../js/core/dataAdapter.js";
import { pararTimer } from "../js/systems/emergencyTimer.js";

const dir = new URL("../", import.meta.url).pathname;
const realNow = Date.now.bind(Date);
let agora = realNow();

function mapaStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear() };
}

export function instalarAmbiente() {
  globalThis.localStorage = mapaStorage();
  globalThis.sessionStorage = mapaStorage();
  const jar = new Map();
  const doc = {
    hidden: false, addEventListener() {}, removeEventListener() {},
    _jar: jar,
  };
  Object.defineProperty(doc, "cookie", {
    configurable: true,
    get() { return [...jar].map(([k, v]) => `${k}=${v}`).join("; "); },
    set(s) {
      const [par, ...attrs] = s.split(";");
      const i = par.indexOf("=");
      const k = par.slice(0, i).trim(); const v = par.slice(i + 1);
      const exp = attrs.find((a) => a.trim().toLowerCase().startsWith("expires="));
      if (exp && new Date(exp.split("=")[1]) < new Date(Date.now())) jar.delete(k); else jar.set(k, v);
    },
  });
  globalThis.document = doc;
  Date.now = () => agora;
}

export const avancarRelogio = (ms) => { agora += ms; };

export function resetar() {
  pararTimer(); bus.limpar(); limparState(); setRng(null);
  instalarAmbiente();
}

let cache = null;
export async function catalogoReal() {
  if (cache) return cache;
  const ler = async (p) => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(dir + p, "utf8")) });
  cache = await carregarCatalogo({ atividades: "data/atividades.json", emergencias: "data/emergencias.json" }, ler);
  return cache;
}

/** Gerador pseudoaleatório determinístico (mulberry32) para testes reprodutíveis. */
export function semente(s) {
  return () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
