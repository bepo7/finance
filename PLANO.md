# Plano de execução — Portfólio de projetos de finanças

Baseado no vídeo de 60 s ("3 projetos para seu currículo se destacar no mercado"). O vídeo mostra:

| # | Projeto | O que aparece no vídeo |
|---|---------|------------------------|
| 0 | **Simulação de Monte Carlo** (abertura) | Leque de trajetórias de carteira (US$ 100k, 10 anos), histograma de distribuição na lateral, KPIs P95 / mediana / P5 / média / prob. de perda |
| 1 | **Modelo DCF** | DRE → Balanço → Fluxo de caixa → FCF → WACC → valor terminal → *enterprise value*; abas tipo planilha com fórmulas visíveis (`=IS + BS + CF`, `=NI + D&A − ΔNWC − Capex`, `=Σ FCF/(1+WACC)^t + TV`) |
| 2 | **Stock pitch** | Escolher ação, pesquisar, pitch de 10 slides (Capa, Tese, Empresa, Indústria, Financeiros, Valuation, Catalisadores, Riscos, Preço-alvo, Recomendação); gráfico EV/EBITDA × margem (R²), Monte Carlo de 12 meses com cauda de risco, *football field* (DCF / comps / 52 semanas / alvo), "evidências" ligadas à sua visão |
| 3 | **Industry deep dive** (ex.: semicondutores) | Cadeia de valor, *major players* em grafo de bolhas, radar de regulação (antitruste, controle de exportação, subsídios), divisão de receita × lucro por elo, mapa de conceitos (EUV, HBM, node mix, yield, capex…) |

---

## 1. Stack escolhida

**TypeScript + React + Vite, site 100 % estático (sem servidor).**

Por quê:
- Todo o cálculo (DCF, Monte Carlo, regressões) roda no navegador — não precisa de backend nem banco, logo não precisa de hospedagem paga nem de conta em serviço de nuvem.
- O vídeo é fortemente visual/animado; o ecossistema JS é o melhor para isso.
- Tipagem forte evita erro em fórmulas financeiras.
- Python fica só como **script de coleta de dados** rodado localmente (gera JSONs que o site lê).

| Necessidade | Ferramenta (gratuita, sem conta) |
|---|---|
| Build / dev server | Vite |
| UI | React + Tailwind CSS |
| Gráficos | Apache ECharts (leque, histograma, barras, scatter, grafo, radar, sankey) |
| Animações | Framer Motion |
| Grade estilo planilha | Componente próprio (tabela + barra de fórmula) |
| Exportar Excel do DCF | SheetJS (`xlsx`, edição community) |
| Exportar pitch em .pptx | PptxGenJS |
| Exportar PDF | `window.print()` com CSS de impressão |
| Monte Carlo sem travar a tela | Web Worker nativo |
| Testes das fórmulas | Vitest |
| Coleta de dados | Python 3 + `yfinance`, `pandas`, `requests` |

### Fontes de dados (todas sem cadastro/chave)
- **Preços e múltiplos**: `yfinance` (API não oficial do Yahoo; pode mudar — por isso os dados ficam salvos em JSON).
- **Demonstrações financeiras (EUA)**: SEC EDGAR `companyfacts` / `submissions` (JSON público; exige só um cabeçalho `User-Agent` descritivo).
- **Taxa livre de risco / macro**: FRED, endpoint CSV público `fredgraph.csv?id=DGS10`.
- **Prêmio de risco e betas setoriais**: planilhas públicas do Prof. Damodaran (NYU).
- **Brasil (opcional)**: CVM Dados Abertos (DFP/ITR) e BCB SGS (Selic) — ambos sem conta.

### Hospedagem
- **Local**: `npm run dev` (zero conta).
- **Online**: GitHub Pages via a conta GitHub que você **já tem** (sem criar nada novo). Alternativa sem conta nenhuma: abrir o `dist/` gerado direto no navegador.

---

## 2. Arquitetura

```
finance/
├── data-pipeline/          # Python, roda localmente
│   ├── fetch_prices.py     # yfinance → public/data/prices/<TICKER>.json
│   ├── fetch_financials.py # SEC EDGAR → public/data/financials/<TICKER>.json
│   ├── fetch_macro.py      # FRED + Damodaran → public/data/macro.json
│   └── requirements.txt
├── public/data/            # JSONs versionados (site funciona offline)
├── src/
│   ├── lib/finance/        # funções puras + testes
│   │   ├── dcf.ts          # projeção, FCF, WACC, TV, EV, equity value, sensibilidade
│   │   ├── montecarlo.ts   # GBM, bootstrap, percentis, VaR/CVaR
│   │   ├── stats.ts        # regressão linear, R², volatilidade, beta
│   │   └── comps.ts        # múltiplos, medianas, implied value
│   ├── workers/montecarlo.worker.ts
│   ├── components/         # SpreadsheetGrid, FormulaBar, FanChart, Histogram,
│   │                       # FootballField, KpiTile, Slide, ProjectCard...
│   ├── pages/
│   │   ├── Home.tsx        # hero com Monte Carlo animado + cards 01/02/03
│   │   ├── MonteCarlo.tsx
│   │   ├── Dcf.tsx
│   │   ├── StockPitch.tsx
│   │   └── IndustryDeepDive.tsx
│   └── content/            # textos da tese/indústria em Markdown/JSON
└── vite.config.ts
```

Princípio: **fórmulas em `lib/finance` são funções puras e testadas**; componentes só exibem.

---

## 3. Fases de execução

### Fase 0 — Fundação (½ dia)
1. `npm create vite@latest` (React + TS), Tailwind, ECharts, Framer Motion, Vitest, React Router (HashRouter, para funcionar no GitHub Pages).
2. Tema visual do vídeo: fundo azul royal / preto, cards brancos, destaques de palavra em caixa, tipografia serifada para números de projeto ("01").
3. Layout: Home + 4 rotas.

**Pronto quando:** `npm run dev` abre a Home com navegação.

### Fase 1 — Pipeline de dados (1 dia)
1. `fetch_prices.py`: 5 anos de preços diários de uma lista de tickers (ação escolhida + pares + setor).
2. `fetch_financials.py`: receita, CPV, EBIT, D&A, capex, capital de giro, dívida, caixa, ações em circulação (tags XBRL us-gaap) dos últimos 5 anos.
3. `fetch_macro.py`: Treasury 10Y (FRED), ERP e beta setorial (Damodaran).
4. Saída em JSON com data de coleta; o site mostra "dados de AAAA-MM-DD".

**Pronto quando:** `public/data/` tem JSONs válidos para ~10 tickers.

### Fase 2 — Projeto 0: Monte Carlo de carteira (1 dia)
1. `montecarlo.ts`: GBM com μ/σ estimados do histórico ou informados; opção bootstrap de retornos.
2. Web Worker rodando 1.000–10.000 trajetórias.
3. UI: inputs (valor inicial, anos, aporte, alocação), **fan chart** com trajetórias coloridas por percentil + linha da mediana, **histograma lateral** do valor final, KPIs (P95, mediana, P5, média, prob. de perda).
4. Animação das trajetórias "crescendo" ano a ano (como no vídeo).

**Pronto quando:** testes de percentil/propriedades estatísticas passam e o gráfico anima.

### Fase 3 — Projeto 1: Modelo DCF (2–3 dias)
1. `dcf.ts`:
   - Premissas: crescimento de receita, margem bruta, opex %, D&A %, capex %, ΔNWC %, alíquota.
   - DRE projetada (5 anos) → NOPAT → FCF = NOPAT + D&A − ΔNWC − Capex.
   - WACC = E/V·Ke + D/V·Kd·(1−t), com Ke por CAPM (Rf FRED, beta, ERP Damodaran).
   - Valor terminal: Gordon e múltiplo de saída.
   - EV → equity value → preço por ação → upside.
   - Tabela de sensibilidade WACC × g.
2. `SpreadsheetGrid` com abas **Income Statement / Balance Sheet / Cash Flow / DCF**, barra de fórmula mostrando a fórmula da célula selecionada, células de premissa editáveis (azul) e calculadas (preto), recálculo instantâneo.
3. Gráficos: barras de receita com % de crescimento, cascata FCF → EV.
4. Botão **Exportar para Excel** (SheetJS) com fórmulas reais nas células.
5. Testes: reproduzir um DCF calculado à mão (valores conhecidos).

**Pronto quando:** mudar uma premissa atualiza todas as abas, o EV e a sensibilidade; o .xlsx abre no Excel/LibreOffice com fórmulas.

### Fase 4 — Projeto 2: Stock pitch (2–3 dias)
1. Seletor de ação ("Pick a stock") com mini-gráficos de preço dos tickers disponíveis.
2. Página de pesquisa: comps (P/E, EV/EBITDA, ROIC, margens) e **scatter EV/EBITDA × margem EBITDA com regressão e R²**, destacando a ação como sub/sobrevalorizada.
3. **Deck de 10 slides** navegável (setas/teclado), conteúdo em `content/`:
   1. Capa · 2. Tese · 3. Empresa · 4. Indústria · 5. Financeiros · 6. Valuation (Monte Carlo 12 meses reaproveitando a Fase 2, cauda de 5 % em vermelho) · 7. Catalisadores · 8. Riscos · 9. Preço-alvo (mediana) · 10. Recomendação (Buy/Hold/Sell).
4. **Football field**: faixas DCF (da Fase 3), comps, 52 semanas, preço-alvo, com linha do preço atual.
5. Gráfico "evidências → sua visão": preço histórico + projeção com cone, cartões de evidência ligados por linhas.
6. Exportar para **.pptx** (PptxGenJS) e **PDF** (print).

**Pronto quando:** o deck completo roda no navegador e exporta .pptx/PDF.

### Fase 5 — Projeto 3: Industry deep dive — semicondutores (2 dias)
1. Conteúdo pesquisado em `content/semis.md` (com fontes citadas).
2. **Cadeia de valor**: design → EDA/IP → equipamentos → foundry → memória → packaging → OEM, com gráfico de **divisão de receita × lucro** por elo.
3. **Major players**: grafo de bolhas (ECharts graph), tamanho = market cap, cor = elo da cadeia, clique mostra métricas.
4. **Regulação**: radar/polar com antitruste, controles de exportação, subsídios (CHIPS Act etc.) e quem é afetado.
5. **Mapa de conceitos** em volta de "SEMIS": wafer starts, node mix, fab capex, EUV, HBM, yield, utilização, estoques, backlog, ASPs — cada nó abre um glossário curto.
6. Performance do setor: índice dos players vs. mercado (dados da Fase 1).

**Pronto quando:** as 5 seções navegam com dados e fontes visíveis.

### Fase 6 — Home e acabamento (1 dia)
1. Hero com Monte Carlo animado ao fundo e frase de abertura.
2. Cards "01 / 02 / 03" empilhados com animação, levando a cada projeto.
3. Responsivo (o vídeo é vertical — garantir boa leitura no celular), acessibilidade (contraste, teclado), modo claro/escuro.
4. Aviso: "Projeto educacional, não é recomendação de investimento".

### Fase 7 — Publicação (½ dia)
1. `npm run build` → `dist/`.
2. GitHub Pages com GitHub Actions (conta existente) **ou** uso local/offline.
3. README com instruções e prints.

**Estimativa total: ~10–12 dias de trabalho.**

---

## 4. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| `yfinance` quebrar (API não oficial) | Dados salvos em JSON; o site não depende de rede em tempo real |
| CORS ao chamar APIs pelo navegador | Toda coleta é feita pelo script Python, nunca pelo browser |
| SEC EDGAR exige `User-Agent` com contato | Usar um identificador seu, definido em variável de ambiente local (não versionar) |
| Tags XBRL variam entre empresas | Mapeamento com fallbacks + revisão manual da ação escolhida |
| Monte Carlo pesado travando a UI | Web Worker + nº de trajetórias ajustável |
| Fórmulas erradas | Testes Vitest com casos calculados à mão |

## 5. Decisões tomadas (2026-11-22)
- **Stock pitch (Fase 4) adiado** — fica fora desta entrega; a arquitetura deixa espaço para ele depois.
- **Temas:** semicondutores, IA e tech.
- **Empresas BR e EUA:** universo misto (B3 + NYSE/Nasdaq). Demonstrações e preços via `yfinance` para ambos; macro BR via BCB (SGS e Focus), macro EUA via FRED. DCF em moeda local (BRL ou USD), com custo de capital BR derivado do USD por prêmio-país + diferencial de inflação.
- **Publicação:** GitHub Pages (repo `bepo7/finance`), deploy por GitHub Actions.
- O deep dive cobre três segmentos (Semicondutores, Infra de IA, Software/Tech) com players BR e EUA.

## 6. Status (2026-11-22)
- ✅ Fases 0–3, 5, 6 e 7 implementadas (DCF, Monte Carlo, Deep Dive, Home, deploy no GitHub Pages).
- ⏸️ Fase 4 (stock pitch) adiada.
- Universo: 32 empresas (9 com exposição ao Brasil). Instituições financeiras (NU, STNE) ficam fora do DCF.
