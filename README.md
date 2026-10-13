# CEO POR 1 DIA

Simulador gerencial de uma pequena indústria de laticínios. HTML5 + CSS3 + JavaScript ES6 (módulos), sem frameworks e sem backend.

## Como executar

Os JSON são carregados com `fetch()`, então **não funciona abrindo o `index.html` por `file://`**. Use um servidor HTTP:

```bash
cd ceo-por-1-dia
python3 -m http.server 8080      # ou: npm start
# abra http://localhost:8080
```

Hospedagem estática (GitHub Pages, Netlify, Vercel, S3, Nginx): basta publicar a pasta inteira, sem build.

## Testes

```bash
npm test      # Node 18+ (usa node:test, sem dependências)
```

39 testes: regras isoladas (probabilidades, seleção, embaralhamento, variação, limites, pontuação, ranking), fluxo do motor (gatilhos A/B/C, emergências, expiração, F5, efeito borboleta, derrota, duas abas, storage bloqueado) e uma simulação de 300 partidas aleatórias que verifica invariantes e ausência de travamentos.

## Dados (`data/`)

`atividades.json` (100 problemas, 400 efeitos borboleta) e `emergencias.json` (60 emergências) são os arquivos fornecidos, sem alteração. `js/core/dataAdapter.js` os converte para o formato interno: resolve as referências `{"$var": ...}` em intervalos `{padrao, min, max}` e valida cada item (4 alternativas, impactos completos, pior alternativa da emergência). Itens inválidos são ignorados com aviso; JSON ausente ou malformado mostra uma tela de erro.

## Decisões de projeto e pontos de atenção

- **Valores iniciais**: usam os do enunciado (R$ 25.000 / 65 / 65 / 60). Os JSON trazem 200.000 / 50 / 50 / 50, que são ignorados.
- **Variação de impactos**: sorteio inteiro dentro de `min`/`max` do próprio JSON (o enunciado manda priorizar os intervalos dos dados), nunca invertendo o sinal nem zerando. O modo "±20 %" existe em `gameConfig.js` (`variacao.modo = "percentual"`).
- **Duração das emergências**: fixa em 120 s (enunciado). O `tempo_limite_segundos` do JSON (60 a 120) é lido, mas não usado.
- **Pior alternativa** no timeout: `gabarito.alternativa_pior_caso_id` do JSON.
- **Prazo do efeito borboleta**: o JSON dá `dias_depois` (7 a 180 dias). Como o jogo não tem calendário, converte-se em atividades normais (`dias / 30`, entre 1 e 4) — `consequencias.diasPorAtividade` em `gameConfig.js`. O dilema de segundo nível não conta como atividade principal.
- **Tempo "elegível"** das emergências: só conta com a aba visível, com uma pergunta aberta (não em feedback) ou na tela de espera. O cronômetro de 120 s da emergência em si usa `Date.now()` e não pausa.
- **Ranking**: um cookie compacto por posição (`ceo1d_rk_0` … `_9`), cada um bem abaixo de 4 KB. Se o navegador recusar cookies, o erro é mostrado, não engolido. É local ao navegador.
- **Duas abas**: id da aba + heartbeat em LocalStorage + versão do save. Uma aba sem controle não aplica decisões e oferece "Assumir controle".

## Pontuação (0 a 1000)

| Parcela | Cálculo | Máx. |
|---|---|---:|
| Clientes, equipe, operação | valor × 2 cada | 600 |
| Financeiro | caixa ÷ (2 × R$ 25.000), com teto em 1 | 200 |
| Atividades concluídas | 3 por atividade | 60 |
| Emergências no prazo | 8 por emergência | 40 |
| Conclusão integral | bônus | 100 |

Desempate no ranking: mais indicadores em valor igual ou superior ao inicial, depois menos emergências expiradas, depois a partida mais antiga. Tudo configurável em `js/core/gameConfig.js`.

## Estrutura

Conforme o enunciado, mais `core/dataAdapter.js` (adaptação dos JSON), `ui/startUI.js` (tela inicial e de erro) e `ui/waitUI.js` (tela "aguardando emergência").
