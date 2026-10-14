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

44 testes: regras isoladas (probabilidades, seleção, embaralhamento, variação, limites, pontuação, ranking), fluxo do motor (gatilhos A/B/C, emergências, expiração, F5, efeito borboleta, derrota, duas abas, storage bloqueado) uma simulação de 300 partidas aleatórias (invariantes e ausência de travamentos) e testes de balanceamento por estratégia (melhor, 2ª, 3ª e pior alternativa; ver abaixo).

## Dados (`data/`)

`atividades.json` (100 problemas, 400 efeitos borboleta) e `emergencias.json` (60 emergências) foram revisados (textos em linguagem simples e impactos refeitos com trade-off em cada alternativa). `js/core/dataAdapter.js` os converte para o formato interno: resolve as referências `{"$var": ...}` em intervalos `{padrao, min, max}` e valida cada item (4 alternativas, impactos completos, pior alternativa da emergência). Itens inválidos são ignorados com aviso; JSON ausente ou malformado mostra uma tela de erro.

## Decisões de projeto e pontos de atenção

- **Valores iniciais**: R$ 100.000 / 50 / 50 / 50 (iguais aos dos JSON). Terminar a partida exatamente com esses valores vale **500 pontos**.
- **Variação de impactos**: sorteio inteiro dentro de `min`/`max` do próprio JSON (o enunciado manda priorizar os intervalos dos dados), nunca invertendo o sinal nem zerando. O modo "±20 %" existe em `gameConfig.js` (`variacao.modo = "percentual"`).
- **Duração das emergências**: fixa em 120 s (enunciado). O `tempo_limite_segundos` do JSON (60 a 120) é lido, mas não usado.
- **Pior alternativa** no timeout: `gabarito.alternativa_pior_caso_id` do JSON.
- **Prazo do efeito borboleta**: o JSON dá `dias_depois` (7 a 180 dias). Como o jogo não tem calendário, converte-se em atividades normais (`dias / 30`, entre 1 e 4) — `consequencias.diasPorAtividade` em `gameConfig.js`. O dilema de segundo nível não conta como atividade principal.
- **Tempo "elegível"** das emergências: só conta com a aba visível, com uma pergunta aberta (não em feedback) ou na tela de espera. O cronômetro de 120 s da emergência em si usa `Date.now()` e não pausa.
- **Ranking**: um cookie compacto por posição (`ceo1d_rk_0` … `_9`), cada um bem abaixo de 4 KB. Se o navegador recusar cookies, o erro é mostrado, não engolido. É local ao navegador.
- **Duas abas**: id da aba + heartbeat em LocalStorage + versão do save. Uma aba sem controle não aplica decisões e oferece "Assumir controle".

## Pontuação (0 a 1000)

`pontuação = 1000 × média de [caixa ÷ (2 × R$ 100.000) (teto 1), clientes ÷ 100, equipe ÷ 100, operação ÷ 100]`

| Situação | Pontuação |
|---|---:|
| Terminar com 100.000 / 50 / 50 / 50 | 500 |
| Caixa ≥ R$ 200.000 e os três indicadores em 100 | 1000 |
| Derrota (algum indicador zerado) | pontuação × 0,3 |

Cada indicador vale 250 pontos no máximo: 1 ponto de clientes/equipe/operação = 2,5 pontos de placar; R$ 1.000 de caixa = 1,25 ponto. Parâmetros em `js/core/gameConfig.js`.

Desempate no ranking: mais indicadores em valor igual ou superior ao inicial, depois menos emergências expiradas, depois a partida mais antiga.

## Balanceamento dos dados

Cada decisão (atividade, desdobramento ou emergência) tem 4 alternativas, todas com ganho e custo, e nenhuma domina outra. Para o placar, as alternativas de cada decisão têm saldo nominal em torno de **+19 / +0,5 / −2,5 / −16** pontos de placar (melhor, 2ª, 3ª, pior), distribuído por igual entre caixa, clientes, equipe e operação — ninguém ganha o jogo olhando só para um indicador. Resultado medido nas simulações (≈ 43 decisões por partida):

| Estratégia | Pontuação média |
|---|---:|
| Sempre a melhor | ≈ 945 |
| Sempre a 2ª melhor | ≈ 540 |
| 2ª ou 3ª ao acaso | ≈ 465 |
| Sempre a 3ª | ≈ 390 |
| Escolhas aleatórias | ≈ 505 |
| Sempre a pior | ≈ 70 (derrota antes do fim) |

A "melhor" alternativa é a de maior saldo nominal; ela não é perfeita (sempre tem um custo) e não aparece indicada ao jogador.

## Estrutura

Conforme o enunciado, mais `core/dataAdapter.js` (adaptação dos JSON), `ui/startUI.js` (tela inicial e de erro) e `ui/waitUI.js` (tela "aguardando emergência").
