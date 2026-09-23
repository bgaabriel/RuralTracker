// Estrutura genérica de culturas (RNF-08). A versão 1 cadastra apenas o café,
// mas nada no restante do sistema assume "café": fases, tipos e o catálogo
// fechado de pragas/doenças (RF-10) são lidos daqui pelo id da cultura.
(function (root) {
  const CULTURAS = {
    cafe: {
      id: "cafe",
      nome: "Café",
      unidadeProdutividade: "sacas/ha",
      tipos: ["Arábica", "Conilon"],
      fases: [
        { id: "viveiro", nome: "Viveiro (mudas)" },
        { id: "formacao_1", nome: "Formação — 1º ano após o plantio", anoAposPlantio: 1 },
        { id: "formacao_2", nome: "Formação — 2º ano após o plantio", anoAposPlantio: 2 },
        { id: "producao", nome: "Produção" },
      ],
      tiposSolo: [
        { id: "Arenoso", ajuda: "Solo solto, esfarela na mão (até 15% de argila)" },
        { id: "Textura média", ajuda: "Nem muito solto, nem muito grudento (15% a 35% de argila)" },
        { id: "Argiloso", ajuda: "Solo que gruda e forma bolo na mão (35% a 60% de argila)" },
        { id: "Muito argiloso", ajuda: "Barro pesado, muito grudento (acima de 60% de argila)" },
      ],

      // Catálogo FECHADO de pragas e doenças (RF-10), com apelidos regionais (RF-11)
      // e a ligação com os defensivos do Catálogo de Produtos (RF-18 / RF-12).
      //   produtoId   -> id no catálogo (data/produtos_cafe.json)
      //   alvoDose    -> quando o produto tem doses por alvo, qual linha usar
      //   alvoPorSeveridade -> idem, variando conforme a severidade declarada
      //   fases       -> restringe o produto a certas fases da lavoura
      pragas: [
        {
          id: "ferrugem",
          nomeTecnico: "Ferrugem-do-cafeeiro",
          nomeCientifico: "Hemileia vastatrix",
          tipo: "Doença",
          nomesPopulares: ["ferrugem", "ferrugem alaranjada", "pó alaranjado", "mal das folhas", "fungo amarelo"],
          sintoma: "Manchas amarelo-alaranjadas, com pó, na parte de baixo das folhas.",
          defensivos: [
            { produtoId: "FUNG-01" },
            { produtoId: "FUNG-02", alvoDose: "Ferrugem (lavoura em produção)", fases: ["formacao_1", "formacao_2", "producao"] },
          ],
        },
        {
          id: "cercosporiose",
          nomeTecnico: "Cercosporiose",
          nomeCientifico: "Cercospora coffeicola",
          tipo: "Doença",
          nomesPopulares: ["mancha-de-olho-pardo", "olho pardo", "olho-de-pomba", "olho de pomba", "cercospora", "mancha de olho"],
          sintoma: "Manchas marrons redondas com o centro claro nas folhas e frutos.",
          defensivos: [
            { produtoId: "FUNG-01" },
            { produtoId: "FUNG-02", alvoDose: "Cercosporiose (viveiro de mudas)", fases: ["viveiro"] },
          ],
        },
        {
          id: "bicho-mineiro",
          nomeTecnico: "Bicho-mineiro",
          nomeCientifico: "Leucoptera coffeella",
          tipo: "Praga",
          nomesPopulares: ["mineiro", "bicho mineiro", "lagarta minadora", "larva minadora", "mariposinha"],
          sintoma: "Manchas secas e marrons nas folhas, que se soltam como papel (minas).",
          defensivos: [
            {
              produtoId: "INSET-01",
              alvoPorSeveridade: {
                leve: "Bicho-mineiro, infestação abaixo de 20%",
                moderada: "Bicho-mineiro, infestação igual ou acima de 20%",
                severa: "Bicho-mineiro, infestação igual ou acima de 20%",
              },
            },
            { produtoId: "INSET-02" },
          ],
        },
        {
          id: "acaro-vermelho",
          nomeTecnico: "Ácaro-vermelho",
          nomeCientifico: "Oligonychus ilicis",
          tipo: "Praga",
          nomesPopulares: ["aranha vermelha", "aranha-vermelha", "ácaro", "acaro", "ferrugem vermelha"],
          sintoma: "Folhas com aspecto bronzeado/avermelhado e sem brilho, principalmente na seca.",
          defensivos: [{ produtoId: "INSET-01", alvoDose: "Ácaro-vermelho" }],
        },
        {
          id: "plantas-daninhas",
          nomeTecnico: "Plantas daninhas na entrelinha",
          nomeCientifico: "Diversas espécies",
          tipo: "Planta daninha",
          nomesPopulares: ["mato", "capim", "buva", "capim-amargoso", "pé-de-galinha", "erva daninha", "praga de mato"],
          sintoma: "Mato competindo com o cafeeiro por água e adubo.",
          defensivos: [{ produtoId: "HERB-01" }],
        },
        {
          id: "broca",
          nomeTecnico: "Broca-do-café",
          nomeCientifico: "Hypothenemus hampei",
          tipo: "Praga",
          nomesPopulares: ["broca", "besourinho", "bichinho do grão", "broca do grão"],
          sintoma: "Furinho na ponta (coroa) do fruto; grão por dentro fica comido.",
          // Sem defensivo no catálogo técnico atual: exercita a exceção 2b do caso
          // de uso 5.2 (sem recomendação oficial -> apenas registro manual).
          defensivos: [],
        },
      ],

      // Restrições regionais de uso (observação do Nomolt 150 no catálogo).
      restricoesRegionais: {
        "INSET-02": { ufs: ["PR"], motivo: "Restrição de uso para café no Paraná, segundo comunicado do fabricante." },
      },
    },
  };

  const SEVERIDADES = [
    { id: "leve", nome: "Leve", ajuda: "Poucas plantas ou folhas atingidas" },
    { id: "moderada", nome: "Moderada", ajuda: "Várias plantas atingidas, espalhando" },
    { id: "severa", nome: "Severa", ajuda: "Grande parte do talhão atingida" },
  ];

  const UFS = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];

  const api = { CULTURAS, SEVERIDADES, UFS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof window !== "undefined" ? window : globalThis);
