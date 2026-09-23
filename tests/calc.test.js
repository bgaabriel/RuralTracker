// Testes do motor de cálculo. Rodar com: node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");

const catalogo = require("../js/catalogo-produtos.js");
const { CULTURAS } = require("../js/culturas.js");
const Calc = require("../js/calc.js");

const cafe = CULTURAS.cafe;
const praga = (id) => cafe.pragas.find((p) => p.id === id);
const talhaoBase = (extra = {}) => ({
  id: "t", areaHectares: 4, fase: "producao", tipoSolo: "Argiloso", plantasPorHa: 4000,
  produtividadeEsperadaSacasHa: 30, irrigado: false, laudo: null, localizacao: { cidade: "X", uf: "MG" }, ...extra,
});

test("RF-03 calagem: modo padrão usa a tabela por tipo de solo", () => {
  const r = Calc.calcularCalagem(talhaoBase({ tipoSolo: "Textura média" }), catalogo);
  assert.equal(r.metodo, "simplificado");
  assert.equal(r.doseTHa, 2);
  assert.equal(r.totalT, 8);
});

test("RF-03 calagem: modo avançado aplica saturação por bases com PRNT e profundidade", () => {
  const t = talhaoBase({ laudo: { ctc: 8.5, v1: 42, v2: 65, prnt: 80, formaAplicacao: "incorporacaoA20cm" } });
  const r = Calc.calcularCalagem(t, catalogo);
  // 8,5 × (65 − 42) / 100 = 1,955 → × 100/80 = 2,44375 → × 1,0
  assert.equal(r.metodo, "saturacao");
  assert.equal(r.doseTHa, 2.44);
  assert.equal(r.totalT, 9.78);
});

test("RF-03 calagem: fator de profundidade e resultado nunca negativo", () => {
  const sup = Calc.calcularCalagem(talhaoBase({ laudo: { ctc: 10, v1: 40, v2: 60, prnt: 100, formaAplicacao: "aplicacaoSuperficialSemIncorporacao" } }), catalogo);
  assert.equal(sup.doseTHa, 1); // 10 × 20/100 × 1 × 0,5
  const alto = Calc.calcularCalagem(talhaoBase({ laudo: { ctc: 10, v1: 75, prnt: 80 } }), catalogo, { v2Padrao: 65 });
  assert.equal(alto.doseTHa, 0);
  assert.equal(alto.necessario, false);
});

test("RN-10: com CTC e V1 usa saturação; sem eles, cai no método por solo (nunca o contrário)", () => {
  const soCTC = Calc.calcularCalagem(talhaoBase({ laudo: { ctc: 8, v1: null } }), catalogo);
  assert.equal(soCTC.metodo, "simplificado");
  const semSolo = Calc.calcularCalagem(talhaoBase({ tipoSolo: null }), catalogo);
  assert.equal(semSolo.metodo, "indisponivel");
  assert.deepEqual(Calc.validarLaudo({ ctc: 8, v1: null }), ["Para o modo avançado informe CTC e V1 juntos."]);
  assert.equal(Calc.validarLaudo({ ctc: 8, v1: 40, v2: 80 }).length, 1);
});

test("RF-03 adubação de produção: fatores por saca, conversão P₂O₅/K₂O e irrigação", () => {
  const r = Calc.calcularAdubacao(talhaoBase(), catalogo, 30);
  assert.equal(r.porHa.N, 186); // 30 × 6,2
  assert.equal(r.elementar.P, 18); // 30 × 0,6
  assert.equal(r.porHa.P2O5, 41.2); // 18 × 2,29
  assert.equal(r.porHa.K2O, 212.4); // 30 × 5,9 × 1,2
  assert.equal(r.total.N, 744);
  const irr = Calc.calcularAdubacao(talhaoBase({ irrigado: true }), catalogo, 30);
  assert.equal(irr.porHa.N, 279);
});

test("RF-03 adubação de formação: gramas por planta de 15-00-10", () => {
  const r = Calc.calcularAdubacao(talhaoBase({ fase: "formacao_2", plantasPorHa: 5000 }), catalogo);
  assert.equal(r.gramasPorPlanta, 80);
  assert.equal(r.produtoKgHa, 400);
  assert.equal(r.porHa.N, 60);
  assert.equal(r.porHa.K2O, 40);
  assert.equal(Calc.calcularAdubacao(talhaoBase({ fase: "viveiro" }), catalogo).tipo, "indisponivel");
});

test("RF-12 dose de defensivo varia com a severidade dentro da faixa de bula", () => {
  const args = { praga: praga("ferrugem"), talhao: talhaoBase(), catalogo, cultura: cafe };
  const leve = Calc.calcularDoseDefensivo({ ...args, severidade: "leve" });
  const mod = Calc.calcularDoseDefensivo({ ...args, severidade: "moderada" });
  const sev = Calc.calcularDoseDefensivo({ ...args, severidade: "severa" });
  const opera = (r) => r.oficiais.find((o) => o.produtoId === "FUNG-01");
  assert.equal(opera(leve).doseHa, 0.75);
  assert.equal(opera(mod).doseHa, 1.125);
  assert.equal(opera(sev).doseHa, 1.5);
  assert.equal(opera(sev).totalL, 6);
  assert.equal(opera(sev).custoEstimado, 1098); // 6 L × R$ 183
  assert.ok(mod.oficiais.some((o) => o.produtoId === "FUNG-02" && o.doseHa === 0.75));
});

test("RF-12 doses por alvo: Tilt só em viveiro para cercosporiose; mL/ha convertido para litros", () => {
  const cer = Calc.calcularDoseDefensivo({ praga: praga("cercosporiose"), severidade: "leve", talhao: talhaoBase({ fase: "viveiro" }), catalogo, cultura: cafe });
  const tilt = cer.oficiais.find((o) => o.produtoId === "FUNG-02");
  assert.equal(tilt.doseHa, 0.56);
  assert.equal(tilt.caldaHa, 400);
  const cerProd = Calc.calcularDoseDefensivo({ praga: praga("cercosporiose"), severidade: "leve", talhao: talhaoBase(), catalogo, cultura: cafe });
  assert.ok(!cerProd.oficiais.some((o) => o.produtoId === "FUNG-02"));

  const leve = Calc.calcularDoseDefensivo({ praga: praga("bicho-mineiro"), severidade: "leve", talhao: talhaoBase(), catalogo, cultura: cafe });
  const sev = Calc.calcularDoseDefensivo({ praga: praga("bicho-mineiro"), severidade: "severa", talhao: talhaoBase(), catalogo, cultura: cafe });
  const b = (r) => r.oficiais.find((o) => o.produtoId === "INSET-01");
  assert.equal(b(leve).doseHa, 600);
  assert.equal(b(leve).unidade, "mL/ha");
  assert.equal(b(leve).totalL, 2.4);
  assert.equal(b(sev).doseHa, 800);
});

test("RF-12 restrição regional (Nomolt no PR) e ausência de recomendação oficial (exceção 2b)", () => {
  const pr = Calc.calcularDoseDefensivo({ praga: praga("bicho-mineiro"), severidade: "leve", talhao: talhaoBase({ localizacao: { uf: "PR" } }), catalogo, cultura: cafe });
  const nomolt = pr.oficiais.find((o) => o.produtoId === "INSET-02");
  assert.equal(nomolt.restrito, true);
  assert.equal(nomolt.semDose, true);
  assert.equal(pr.oficiais[pr.oficiais.length - 1].produtoId, "INSET-02");

  const broca = Calc.calcularDoseDefensivo({ praga: praga("broca"), severidade: "moderada", talhao: talhaoBase(), catalogo, cultura: cafe });
  assert.equal(broca.semRecomendacaoOficial, true);
  assert.equal(broca.oficiais.length, 0);
});

test("RN-08: produto Recorrente entra só como complemento", () => {
  const pp = [
    { id: "a", status: "Recorrente", pragasAlvo: ["ferrugem"] },
    { id: "b", status: "Novo", pragasAlvo: ["ferrugem"] },
  ];
  const r = Calc.calcularDoseDefensivo({ praga: praga("ferrugem"), severidade: "leve", talhao: talhaoBase(), catalogo, cultura: cafe, produtosPersonalizados: pp });
  assert.deepEqual(r.complementares.map((x) => x.id), ["a"]);
  assert.ok(r.oficiais.length > 0);
});

test("RF-04 comparação: nutrientes acumulados, faixa de bula e status parcial em safra aberta", () => {
  const t = talhaoBase({ areaHectares: 2 });
  const recomendacao = { calagem: { doseTHa: 2 }, adubacao: { porHa: { N: 100, P2O5: 0, K2O: 100 } } };
  const aps = [
    { id: "1", safraId: "s", categoria: "fertilizante", quantidade: 1000, unidade: "kg", formulacao: { n: 20, p: 0, k: 20 } }, // 100 kg N/ha
    { id: "2", safraId: "s", categoria: "corretivo", quantidade: 6, unidade: "t" }, // 3 t/ha
    { id: "3", safraId: "s", categoria: "defensivo", produtoId: "FUNG-01", quantidade: 1000, unidade: "mL" }, // 0,5 L/ha < 0,75
  ];
  const fechada = Calc.compararSafra({ talhao: t, safra: { id: "s", status: "Concluída" }, aplicacoes: aps, recomendacao, catalogo });
  const by = (k) => fechada.itens.find((i) => i.chave === k);
  assert.equal(by("N").pct, 100);
  assert.equal(by("N").status, "ok");
  assert.equal(by("calcario").pct, 150);
  assert.equal(by("calcario").status, "excesso");
  const def = fechada.itens.find((i) => i.categoria === "defensivo");
  assert.equal(def.status, "deficiencia");

  const aberta = Calc.compararSafra({ talhao: t, safra: { id: "s", status: "Em andamento" }, aplicacoes: [{ ...aps[0], quantidade: 400 }], recomendacao, catalogo });
  assert.equal(aberta.itens[0].status, "parcial");
  assert.equal(Calc.precisaAlerta(aberta.itens[0]), false);
});

test("RF-04 defensivo comparado com a dose recomendada da ocorrência", () => {
  const t = talhaoBase({ areaHectares: 3.8 });
  const aps = [{ id: "x", safraId: "s", categoria: "defensivo", produtoId: "FUNG-01", ocorrenciaId: "o1", quantidade: 5.7, unidade: "L", nomeProduto: "Opera" }];
  const r = Calc.compararSafra({ talhao: t, safra: { id: "s", status: "Em andamento" }, aplicacoes: aps, recomendacao: {}, dosesDefensivo: { o1: [{ produtoId: "FUNG-01", doseHa: 1.125, unidade: "L/ha" }] }, catalogo });
  assert.equal(r.itens[0].pct, 133);
  assert.equal(r.itens[0].status, "excesso");
  assert.equal(Calc.precisaAlerta(r.itens[0], 20), true);
});

test("RF-09 / RN-05: sem safra concluída não há sugestão", () => {
  const r = Calc.sugerirReajuste([{ safra: { status: "Em andamento" }, comparacao: { itens: [] } }]);
  assert.equal(r.disponivel, false);
});

test("RF-09: excesso com meta atingida sugere redução; deficiência com meta perdida sugere aumento", () => {
  const safra = (esperada, obtida) => ({ status: "Concluída", produtividadeEsperadaSacasHa: esperada, colheita: { produtividadeSacasHa: obtida } });
  const comp = (pctN) => ({ itens: [{ chave: "N", pct: pctN }] });

  const reduzir = Calc.sugerirReajuste([
    { safra: safra(35, 34), comparacao: comp(124) },
    { safra: safra(35, 38), comparacao: comp(128) },
    { safra: safra(38, 39), comparacao: comp(126) },
  ]);
  assert.equal(reduzir.principal.pctAplicadoMedio, 126);
  assert.equal(reduzir.principal.percentualAjuste, -21); // 1 − 100/126
  assert.equal(reduzir.safrasConsideradas, 3);

  const aumentar = Calc.sugerirReajuste([{ safra: safra(32, 26), comparacao: comp(72) }]);
  assert.equal(aumentar.principal.percentualAjuste, 39); // 100/72 − 1

  const manter = Calc.sugerirReajuste([{ safra: safra(30, 31), comparacao: comp(100) }]);
  assert.equal(manter.principal.percentualAjuste, 0);
});

test("RF-15 clima: geada, chuva excessiva, seca e janela de aplicação", () => {
  const dia = (d) => ({ data: "01/01", tMin: 15, tMax: 26, chuvaMm: 2, umidade: 60, ...d });
  const geada = Calc.avaliarClima({ dias: [dia({ tMin: 0.5 }), dia(), dia(), dia(), dia(), dia(), dia()] }, "formacao_1");
  assert.equal(geada.riscos[0].tipo, "geada");
  assert.equal(geada.riscos[0].gravidade, "alta");

  const chuva = Calc.avaliarClima({ dias: [dia({ chuvaMm: 60 }), dia(), dia(), dia(), dia(), dia(), dia()] }, "producao");
  assert.ok(chuva.riscos.some((r) => r.tipo === "chuva"));
  assert.ok(chuva.avisosAplicacao.some((a) => a.includes("evite pulverizar")));

  const seca = Calc.avaliarClima({ dias: Array.from({ length: 7 }, () => dia({ tMax: 33, chuvaMm: 0 })) }, "producao");
  assert.ok(seca.riscos.some((r) => r.tipo === "seca"));

  assert.equal(Calc.avaliarClima(null).disponivel, false);
});

test("RN-07: promoção para Recorrente com limites configuráveis", () => {
  const aps = [
    { produtoPersonalizadoId: "p", talhaoId: "a" }, { produtoPersonalizadoId: "p", talhaoId: "a" },
    { produtoPersonalizadoId: "p", talhaoId: "b" }, { produtoPersonalizadoId: "p", talhaoId: "b" },
    { produtoPersonalizadoId: "p", talhaoId: "c" }, { produtoPersonalizadoId: "p", talhaoId: "c" },
    { produtoPersonalizadoId: "p", talhaoId: "d" },
  ];
  const dono = (a) => ({ a: "u1", b: "u2", c: "u3", d: "u4" })[a.talhaoId];
  assert.equal(Calc.statusProdutoPersonalizado("p", aps, dono, { minProdutores: 3, minAplicacoesPorProdutor: 2 }).status, "Recorrente");
  assert.equal(Calc.statusProdutoPersonalizado("p", aps, dono, { minProdutores: 4, minAplicacoesPorProdutor: 2 }).status, "Novo");
  assert.equal(Calc.statusProdutoPersonalizado("p", aps, dono, { minProdutores: 4, minAplicacoesPorProdutor: 1 }).status, "Recorrente");
});

test("RN-01: validação de CPF", () => {
  for (const ok of ["529.982.247-25", "11144477735", "39053344705", "15350946056"]) assert.ok(Calc.validarCPF(ok), ok);
  for (const ruim of ["111.111.111-11", "12345678900", "123"]) assert.ok(!Calc.validarCPF(ruim), ruim);
});
