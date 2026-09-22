// Dados fictícios (mock) do Dashboard de Indicadores (RF-14).
// Nenhuma chamada de rede real é feita — tudo está definido estaticamente aqui,
// em memória, para manter o carregamento leve (RNF-05).

const currentUser = {
  nome: "Maria Oliveira",
  papel: "Produtora", // ou "Colaborador" — ambos veem o mesmo dashboard
};

const lastUpdatedLabel = "Atualizado há 4 min";

// Estrutura de cultivo genérica (RNF-08): "tipoCultivo" e "variedade" em vez de
// campos amarrados exclusivamente a café.
const talhoes = [
  {
    id: "t1",
    nome: "Talhão 1",
    variedade: "Bourbon Amarelo",
    tipoCultivo: "Café",
    areaHectares: 4.5,
    localizacao: "Poços de Caldas - MG",
    faseAtual: "Frutificação",
    dataColheitaPrevista: "15/06/2026",
    cicloProgresso: 0.65,
    custoPorHectare: 1240,
    aplicadoVsRecomendadoPct: 92,
    insumosComparacao: [
      { insumo: "Nitrogênio (N)", aplicado: 42, recomendado: 46, unidade: "kg/ha" },
      { insumo: "Fósforo (P₂O₅)", aplicado: 28, recomendado: 30, unidade: "kg/ha" },
      { insumo: "Potássio (K₂O)", aplicado: 50, recomendado: 44, unidade: "kg/ha" },
    ],
    safras: [
      {
        id: "s1a",
        dataInicio: "2023-10-01",
        status: "Concluída",
        colheita: { dataColheita: "2024-06-08", produtividadeSacasHa: 34, qualidadeGrao: "Tipo 6 · bebida mole" },
      },
      {
        id: "s1b",
        dataInicio: "2024-10-05",
        status: "Concluída",
        colheita: { dataColheita: "2025-06-10", produtividadeSacasHa: 38, qualidadeGrao: "Tipo 5 · bebida dura" },
      },
      {
        id: "s1c",
        dataInicio: "2025-10-10",
        status: "Em andamento",
        colheita: null,
      },
    ],
    sugestaoReajuste: {
      percentualAjuste: -8,
      insumo: "Nitrogênio",
      justificativa:
        "A comparação entre aplicado e recomendado nas últimas safras, somada à produtividade de 38 sacas/ha na última colheita, indica espaço para reduzir a dose sem perda de produtividade.",
    },
    alertaAtivo: true,
  },
  {
    id: "t2",
    nome: "Talhão 2",
    variedade: "Catuaí Vermelho",
    tipoCultivo: "Café",
    areaHectares: 6.2,
    localizacao: "Poços de Caldas - MG",
    faseAtual: "Floração",
    dataColheitaPrevista: "20/07/2026",
    cicloProgresso: 0.2,
    custoPorHectare: 860,
    aplicadoVsRecomendadoPct: null, // nenhuma aplicação registrada ainda
    insumosComparacao: [],
    safras: [
      {
        id: "s2a",
        dataInicio: "2026-01-15",
        status: "Em andamento",
        colheita: null,
      },
    ],
    sugestaoReajuste: null, // RN-05: sem safra concluída ainda
    alertaAtivo: true,
  },
  {
    id: "t3",
    nome: "Talhão 3",
    variedade: "Mundo Novo",
    tipoCultivo: "Café",
    areaHectares: 3.8,
    localizacao: "Alfenas - MG",
    faseAtual: "Maturação",
    dataColheitaPrevista: "10/05/2026",
    cicloProgresso: 0.85,
    custoPorHectare: 1010,
    aplicadoVsRecomendadoPct: 78,
    insumosComparacao: [
      { insumo: "Nitrogênio (N)", aplicado: 30, recomendado: 38, unidade: "kg/ha" },
      { insumo: "Fósforo (P₂O₅)", aplicado: 22, recomendado: 24, unidade: "kg/ha" },
      { insumo: "Potássio (K₂O)", aplicado: 33, recomendado: 35, unidade: "kg/ha" },
    ],
    safras: [
      {
        id: "s3a",
        dataInicio: "2024-11-01",
        status: "Concluída",
        colheita: { dataColheita: "2025-05-12", produtividadeSacasHa: 29, qualidadeGrao: "Tipo 6 · bebida dura" },
      },
      {
        id: "s3b",
        dataInicio: "2025-11-05",
        status: "Em andamento",
        colheita: null,
      },
    ],
    sugestaoReajuste: {
      percentualAjuste: 12,
      insumo: "Nitrogênio",
      justificativa:
        "A aplicação de nitrogênio ficou abaixo do recomendado na última safra, o que pode ter contribuído para a produtividade de 29 sacas/ha. Sugerimos aumentar a próxima aplicação.",
    },
    alertaAtivo: true,
  },
];

// RF-10 / RF-11 / RF-12 — ocorrências declaradas recentes (visão da propriedade)
const ocorrenciasPragas = [
  {
    id: "p1",
    nomeTecnico: "Ferrugem-do-cafeeiro",
    nomesPopulares: ["ferrugem"],
    talhaoId: "t1",
    severidade: "moderada",
    doseRecomendada: "Fungicida triazol — 1,5 L/ha",
    statusConfiabilidade: "Oficial",
  },
  {
    id: "p2",
    nomeTecnico: "Broca-do-café",
    nomesPopulares: ["broca"],
    talhaoId: "t3",
    severidade: "leve",
    doseRecomendada: "Inseticida à base de tiametoxam — 0,4 L/ha",
    statusConfiabilidade: "Oficial",
    complementoRecorrente: "Armadilhas com álcool + óleo de cravo — 1 a cada 5 m de linha",
  },
  {
    id: "p3",
    nomeTecnico: "Cercosporiose",
    nomesPopulares: ["olho-de-pomba"],
    talhaoId: "t2",
    severidade: "severa",
    doseRecomendada: "Fungicida cúprico — 2,0 L/ha",
    statusConfiabilidade: "Oficial",
  },
];

// RF-15 / RF-16 — feed de alertas (visão da propriedade)
const alertas = [
  {
    id: "a1",
    tipo: "aplicacao",
    descricao: "Aplicação de Potássio no Talhão 1 — Bourbon Amarelo ficou 14% acima da faixa recomendada.",
    talhaoId: "t1",
    canal: "whatsapp",
    status: "enviado",
  },
  {
    id: "a2",
    tipo: "clima",
    descricao: "Risco de geada nos próximos 3 dias para o Talhão 2 — Catuaí Vermelho, atualmente em floração.",
    talhaoId: "t2",
    canal: "app",
    status: "lido",
  },
  {
    id: "a3",
    tipo: "aplicacao",
    descricao: "Aplicação de Nitrogênio no Talhão 3 — Mundo Novo ficou 21% abaixo da faixa recomendada.",
    talhaoId: "t3",
    canal: "whatsapp",
    status: "pendente",
  },
];
