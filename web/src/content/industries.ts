import type { Segment } from '../lib/finance/types'

export interface ChainStep {
  /** precisa bater com o campo `chain` do universo (data-pipeline) */
  key: string
  title: string
  text: string
  outside?: string
}

export interface Regulation {
  region: 'EUA' | 'Brasil' | 'UE' | 'Global'
  year: string
  title: string
  text: string
}

export interface Industry {
  segment: Segment
  name: string
  hub: string
  headline: string
  why: string
  benchmark: string
  chain: ChainStep[]
  regulations: Regulation[]
  /** avaliação qualitativa (0–5) — exibida como tal */
  pressure: { axis: string; us: number; br: number }[]
  concepts: { term: string; def: string; links?: string[] }[]
  brazil: string
  watch: string[]
}

export const INDUSTRIES: Record<Segment, Industry> = {
  semis: {
    segment: 'semis',
    name: 'Semicondutores',
    hub: 'SEMIS',
    headline: 'Quem projeta, quem fabrica e quem vende a pá.',
    why: 'Todo ciclo de tecnologia — PC, smartphone, nuvem e agora IA — começa num chip. É um setor cíclico, intensivo em capital e muito concentrado: poucos fornecedores dominam cada elo, o que torna geopolítica e capex variáveis de valuation.',
    benchmark: 'SOXX',
    chain: [
      { key: 'IP & EDA', title: 'IP & software de design (EDA)', text: 'Arquiteturas licenciadas (Arm) e ferramentas sem as quais nenhum chip é desenhado (Cadence, Synopsys). Receita recorrente, margens altas.' },
      { key: 'Design (fabless)', title: 'Design (fabless)', text: 'Projetam o chip e terceirizam a fabricação: GPUs e aceleradores de IA, CPUs, conectividade, modems.' },
      { key: 'Equipamentos', title: 'Equipamentos de fabricação', text: 'Litografia (ASML detém o monopólio de EUV), deposição, corrosão e inspeção (Applied Materials, Lam, KLA). Dependem do capex das fábricas.' },
      { key: 'Foundry', title: 'Foundry', text: 'Fabricam chips de terceiros nos nós mais avançados. TSMC lidera com folga; a Intel tenta reconstruir o negócio de foundry.', outside: 'Samsung Foundry e SMIC também competem, mas não estão no universo.' },
      { key: 'Memória', title: 'Memória', text: 'DRAM, NAND e HBM — a memória empilhada que alimenta GPUs de IA. Mercado de commodity, com ciclos violentos de preço.', outside: 'SK hynix e Samsung são os outros grandes players (listados na Coreia).' },
      { key: 'Hardware & montagem', title: 'Hardware & montagem (Brasil)', text: 'Montagem de eletrônicos, equipamentos de rede e segurança. No Brasil, a exposição listada à cadeia de chips está aqui.' },
    ],
    regulations: [
      { region: 'EUA', year: '2022–2025', title: 'Controles de exportação (BIS)', text: 'Regras a partir de out/2022, ampliadas depois, restringem venda de chips avançados de IA e de equipamentos de fabricação para a China.' },
      { region: 'EUA', year: '2022', title: 'CHIPS and Science Act', text: 'Cerca de US$ 52,7 bi para semicondutores, dos quais ~US$ 39 bi em incentivos para fábricas nos EUA, além de crédito fiscal para investimento.' },
      { region: 'Global', year: '2023', title: 'Holanda e Japão restringem litografia', text: 'Alinhados aos EUA, passaram a exigir licença para exportar equipamentos avançados; EUV da ASML nunca foi vendido à China.' },
      { region: 'UE', year: '2023', title: 'European Chips Act', text: 'Pacote de apoio à produção local com a meta de 20% da produção mundial até 2030.' },
      { region: 'Global', year: '2022', title: 'Antitruste: Nvidia × Arm', text: 'A compra da Arm pela Nvidia foi abandonada após oposição de reguladores nos EUA, Reino Unido e UE.' },
      { region: 'Brasil', year: '2007–hoje', title: 'PADIS', text: 'Programa federal de incentivos fiscais para design, fabricação e encapsulamento de semicondutores no país.' },
      { region: 'Brasil', year: '2020–2023', title: 'CEITEC', text: 'Estatal de chips de Porto Alegre teve liquidação iniciada em 2020 e interrompida em 2023.' },
    ],
    pressure: [
      { axis: 'Controle de exportação', us: 5, br: 1 },
      { axis: 'Subsídio / política industrial', us: 5, br: 3 },
      { axis: 'Antitruste', us: 3, br: 1 },
      { axis: 'Privacidade / dados', us: 1, br: 1 },
      { axis: 'Regulação de IA', us: 2, br: 1 },
      { axis: 'Tributação', us: 2, br: 4 },
    ],
    concepts: [
      { term: 'Wafer starts', def: 'Quantidade de wafers de silício iniciados por período — medida de volume de produção de uma fab.', links: ['Utilização', 'Fab capex'] },
      { term: 'Node (nm)', def: 'Geração do processo de fabricação (ex.: 3 nm). Nós menores = mais transistores por área, custo de fab muito maior.', links: ['EUV', 'Yield'] },
      { term: 'EUV', def: 'Litografia de ultravioleta extremo, necessária nos nós mais avançados. Só a ASML fabrica.', links: ['Node (nm)', 'Export rules'] },
      { term: 'HBM', def: 'High Bandwidth Memory: DRAM empilhada ao lado da GPU. Gargalo de oferta na era da IA.', links: ['ASPs', 'Packaging'] },
      { term: 'Yield', def: 'Percentual de chips bons por wafer. Yield baixo em nó novo destrói margem.', links: ['Node (nm)'] },
      { term: 'Utilização', def: 'Percentual da capacidade da fab em uso. Custos fixos enormes → margem muito sensível à utilização.', links: ['Fab capex', 'Estoques'] },
      { term: 'Fab capex', def: 'Investimento em fábricas. É a receita dos fabricantes de equipamentos e um termômetro do ciclo.', links: ['Utilização'] },
      { term: 'Estoques', def: 'Dias de estoque na cadeia. Excesso de estoque antecede quedas de preço e de pedidos.', links: ['ASPs', 'Backlog'] },
      { term: 'ASPs', def: 'Average selling price — preço médio de venda. Em memória, oscila com oferta e demanda.', links: ['Estoques'] },
      { term: 'Backlog', def: 'Pedidos contratados e não entregues. Dá visibilidade de receita, principalmente em equipamentos.', links: ['Fab capex'] },
      { term: 'Packaging', def: 'Encapsulamento avançado (ex.: chiplets e 2.5D) que junta GPU e HBM. Virou gargalo de capacidade.', links: ['HBM'] },
      { term: 'Export rules', def: 'Restrições de exportação que limitam mercados endereçáveis e mudam a receita por região.', links: ['EUV'] },
    ],
    brazil:
      'O Brasil não tem fabricação de chips de ponta. A participação está em encapsulamento e teste (ex.: HT Micron, no RS), em design de nicho e na montagem de eletrônicos, onde estão as empresas listadas (Positivo, Intelbras). Para o investidor brasileiro, exposição relevante ao tema vem principalmente via BDRs e ETFs.',
    watch: ['Capex anual de TSMC e das hyperscalers', 'Preços de DRAM/HBM', 'Book-to-bill dos fabricantes de equipamentos', 'Novas regras de exportação EUA–China', 'Estoques de chips em PCs e smartphones'],
  },

  ai: {
    segment: 'ai',
    name: 'Infraestrutura de IA & Cloud',
    hub: 'IA',
    headline: 'Quem compra as GPUs — e como transforma isso em receita.',
    why: 'As hyperscalers são as maiores compradoras de chips de IA e o principal canal de distribuição dos modelos. A pergunta do mercado é se o capex bilionário em data centers vai gerar retorno acima do custo de capital.',
    benchmark: '^IXIC',
    chain: [
      { key: 'Hyperscaler', title: 'Hyperscalers / nuvem', text: 'Constroem data centers, compram GPUs e alugam computação (AWS, Azure, Google Cloud, Oracle). Capex recorde e margens de nuvem altas.' },
      { key: 'Modelos & apps', title: 'Modelos e aplicações', text: 'Treinam modelos próprios ou vendem plataformas de dados e IA para empresas (Meta, Palantir).', outside: 'Laboratórios de IA de capital fechado também competem aqui, mas não estão no universo.' },
      { key: 'Cloud & hospedagem', title: 'Cloud & hospedagem (Brasil)', text: 'Hospedagem, e-commerce e software para PMEs. Exposição local ao tema de nuvem.' },
    ],
    regulations: [
      { region: 'UE', year: '2024', title: 'AI Act', text: 'Primeira lei abrangente de IA: classifica sistemas por risco, com obrigações aplicadas em etapas até 2026–2027.' },
      { region: 'EUA', year: '2023–2025', title: 'Ordem executiva de IA', text: 'A EO 14110 (out/2023) criou exigências de reporte para modelos de fronteira e foi revogada em jan/2025. A política federal segue em disputa com regras estaduais.' },
      { region: 'EUA', year: '2022–2025', title: 'Exportação de chips de IA', text: 'Limita onde as GPUs avançadas podem ser vendidas e, indiretamente, onde se instalam data centers.' },
      { region: 'EUA', year: '2024', title: 'Antitruste: EUA × Google', text: 'Decisão federal de 2024 concluiu que o Google mantinha monopólio ilegal em buscas; as medidas corretivas seguem em discussão.' },
      { region: 'Brasil', year: '2024–hoje', title: 'PL 2338/2023 — marco da IA', text: 'Aprovado no Senado em dez/2024, propõe regulação por nível de risco. Acompanhe a tramitação na Câmara.' },
      { region: 'Brasil', year: '2018', title: 'LGPD', text: 'Lei Geral de Proteção de Dados (13.709/2018), fiscalizada pela ANPD — relevante para treinar e usar modelos.' },
    ],
    pressure: [
      { axis: 'Controle de exportação', us: 4, br: 1 },
      { axis: 'Subsídio / política industrial', us: 3, br: 2 },
      { axis: 'Antitruste', us: 5, br: 2 },
      { axis: 'Privacidade / dados', us: 3, br: 4 },
      { axis: 'Regulação de IA', us: 3, br: 4 },
      { axis: 'Tributação', us: 2, br: 4 },
    ],
    concepts: [
      { term: 'GPU', def: 'Processador paralelo usado para treinar e rodar modelos. Principal linha de capex de IA.', links: ['Capex', 'Utilização de GPU'] },
      { term: 'Treino × inferência', def: 'Treino cria o modelo (custo concentrado); inferência é o uso no dia a dia (custo recorrente, escala com usuários).', links: ['Tokens'] },
      { term: 'Tokens', def: 'Unidade de texto processada por um modelo de linguagem. Preço e volume por token viram métricas de receita.', links: ['Custo por token'] },
      { term: 'Custo por token', def: 'Quanto custa gerar cada token. Cai rápido com hardware e software melhores, o que pressiona preço.', links: ['GPU'] },
      { term: 'Capex', def: 'Investimento das hyperscalers em data centers e chips — hoje a variável mais observada do setor.', links: ['Depreciação', 'Energia'] },
      { term: 'Depreciação', def: 'Capex de hoje vira despesa de depreciação amanhã. A vida útil assumida para servidores muda o lucro reportado.', links: ['Capex'] },
      { term: 'Energia', def: 'Data centers de IA medem-se em MW/GW. Acesso a energia e rede elétrica limita a expansão.', links: ['Capex'] },
      { term: 'Utilização de GPU', def: 'Parcela do tempo em que as GPUs estão faturando. Baixa utilização = retorno sobre capital ruim.', links: ['GPU'] },
      { term: 'Backlog de nuvem', def: 'Contratos de nuvem assinados e ainda não reconhecidos (RPO). Indica demanda futura.', links: ['Capex'] },
      { term: 'Lock-in', def: 'Custo de mudar de provedor de nuvem/dados — sustenta poder de preço.', links: ['Backlog de nuvem'] },
    ],
    brazil:
      'O Brasil é consumidor de IA e nuvem, com data centers de hyperscalers concentrados principalmente em São Paulo. A matriz elétrica renovável é argumento recorrente para atrair novos data centers. Na bolsa, a exposição direta é pequena — Locaweb e empresas de software capturam o tema na ponta de aplicação.',
    watch: ['Capex trimestral de Microsoft, Alphabet, Amazon, Meta e Oracle', 'Crescimento de Azure / Google Cloud / AWS', 'Backlog (RPO) de nuvem', 'Preço por token e lançamentos de modelos', 'Disponibilidade de energia para data centers'],
  },

  software: {
    segment: 'software',
    name: 'Software & Internet',
    hub: 'SOFTWARE',
    headline: 'Receita recorrente, margem alta — e a IA como ameaça e alavanca.',
    why: 'Software vende assinatura com margem bruta alta e baixo capex. O debate de valuation é se a IA amplia a receita (novos produtos, preço) ou comprime (menos licenças por usuário, competição de agentes).',
    benchmark: '^IXIC',
    chain: [
      { key: 'SaaS', title: 'SaaS corporativo', text: 'CRM, fluxo de trabalho, criatividade, ERP e e-commerce vendidos por assinatura (Salesforce, ServiceNow, Adobe, TOTVS, VTEX).' },
      { key: 'Internet', title: 'Internet & marketplaces', text: 'Plataformas que monetizam audiência e transações (Mercado Livre, Méliuz).' },
      { key: 'Fintech', title: 'Fintech', text: 'Bancos digitais e meios de pagamento (Nubank, Stone). Avaliados por múltiplos e retorno sobre patrimônio, não por FCFF.' },
    ],
    regulations: [
      { region: 'Brasil', year: '2018', title: 'LGPD', text: 'Regras de uso de dados pessoais; impacta produtos de dados, marketing e crédito.' },
      { region: 'Brasil', year: '2020–hoje', title: 'Pix e Open Finance (BCB)', text: 'Pagamentos instantâneos gratuitos para pessoa física e compartilhamento de dados bancários: reduzem barreiras e pressionam tarifas.' },
      { region: 'Brasil', year: '2023–2033', title: 'Reforma tributária (EC 132/2023)', text: 'Substitui PIS/Cofins/ICMS/ISS por CBS e IBS, com transição a partir de 2026 — muda a carga sobre serviços de software.' },
      { region: 'Brasil', year: '2025', title: 'STF e Marco Civil (art. 19)', text: 'STF ampliou hipóteses de responsabilidade de plataformas por conteúdo de terceiros.' },
      { region: 'UE', year: '2022–2024', title: 'Digital Markets Act', text: 'Obrigações para “gatekeepers” digitais, com multas de até 10% do faturamento global.' },
      { region: 'Global', year: '2016–hoje', title: 'GDPR e privacidade', text: 'Padrão europeu de proteção de dados, referência para leis no mundo todo.' },
    ],
    pressure: [
      { axis: 'Controle de exportação', us: 1, br: 0 },
      { axis: 'Subsídio / política industrial', us: 1, br: 2 },
      { axis: 'Antitruste', us: 4, br: 2 },
      { axis: 'Privacidade / dados', us: 4, br: 4 },
      { axis: 'Regulação de IA', us: 2, br: 3 },
      { axis: 'Tributação', us: 2, br: 5 },
    ],
    concepts: [
      { term: 'ARR', def: 'Annual recurring revenue — receita recorrente anualizada de assinaturas.', links: ['NRR', 'Churn'] },
      { term: 'NRR', def: 'Net revenue retention: quanto a base de clientes de um ano gasta no ano seguinte, incluindo upsell e cancelamentos.', links: ['Churn', 'ARR'] },
      { term: 'Churn', def: 'Taxa de cancelamento de clientes ou receita.', links: ['LTV/CAC'] },
      { term: 'LTV/CAC', def: 'Valor do cliente na vida útil ÷ custo de aquisição. Acima de ~3x costuma indicar crescimento saudável.', links: ['Churn'] },
      { term: 'Rule of 40', def: 'Crescimento de receita + margem (FCF ou EBITDA) ≥ 40% — atalho de mercado para SaaS.', links: ['ARR'] },
      { term: 'Margem bruta', def: 'Em SaaS costuma passar de 70%. Custos de IA (computação) podem pressioná-la.', links: ['Rule of 40'] },
      { term: 'Take rate', def: 'Percentual do volume transacionado que vira receita de um marketplace ou adquirente.', links: ['TPV'] },
      { term: 'TPV', def: 'Total payment volume — volume processado em pagamentos.', links: ['Take rate'] },
      { term: 'Inadimplência', def: 'Atrasos acima de 90 dias (NPL) — variável crítica para fintechs que concedem crédito.', links: ['TPV'] },
      { term: 'Seats', def: 'Licenças por usuário. Agentes de IA podem reduzir o número de seats — e forçar novos modelos de preço.', links: ['ARR'] },
    ],
    brazil:
      'É onde o Brasil tem mais empresas listadas com peso: TOTVS lidera ERP local, VTEX exporta software de e-commerce, Mercado Livre e Nubank estão entre as maiores empresas de tecnologia da América Latina. O ambiente de juros altos encarece o custo de capital e comprime múltiplos de crescimento.',
    watch: ['NRR e crescimento de ARR', 'Margem bruta com custo de IA', 'Selic e curva de juros (custo de capital)', 'Inadimplência e custo de funding das fintechs', 'Transição da reforma tributária'],
  },
}
