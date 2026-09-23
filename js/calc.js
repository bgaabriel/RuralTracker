// Motor de cálculo do Rural Tracker — funções puras, sem DOM nem armazenamento,
// para poderem ser testadas em Node (tests/calc.test.js).
//   RF-03  Cálculo de necessidade de insumos (calagem + NPK), RN-10
//   RF-12  Cálculo de dose de defensivo, RN-08
//   RF-04  Comparação aplicado x recomendado
//   RF-09  Sugestão de reajuste, RN-05
//   RF-15  Riscos climáticos e alertas de aplicação
//   RN-07  Promoção de produto personalizado para "Recorrente"
(function (root) {
  const FAIXA_OK = { min: 90, max: 110 }; // % do recomendado considerado adequado

  // "Fósforo (P₂O₅)" -> "fósforo (P₂O₅)": só a primeira palavra, para não estragar fórmulas químicas.
  const minusculaInicial = (s) => String(s).replace(/^\S+/, (w) => w.toLowerCase());
  const isNum = (v) => typeof v === "number" && Number.isFinite(v);
  const round = (v, d = 2) => {
    const f = Math.pow(10, d);
    return Math.round(v * f) / f;
  };

  /* ------------------------------------------------------------------ */
  /* RF-03 — Calagem                                                     */
  /* ------------------------------------------------------------------ */

  // RN-10: o método por saturação de bases é usado sempre que CTC e V1 forem
  // informados; na falta deles, cai no método simplificado — nunca o contrário.
  function temLaudoCompleto(laudo) {
    return !!laudo && isNum(laudo.ctc) && isNum(laudo.v1);
  }

  function validarLaudo(laudo) {
    const erros = [];
    if (!laudo) return erros;
    if (isNum(laudo.ctc) && (laudo.ctc <= 0 || laudo.ctc > 60)) erros.push("CTC deve estar entre 0 e 60 cmolc/dm³.");
    if (isNum(laudo.v1) && (laudo.v1 < 0 || laudo.v1 > 100)) erros.push("V1 deve estar entre 0% e 100%.");
    if (isNum(laudo.v2) && (laudo.v2 < 60 || laudo.v2 > 70)) erros.push("V2 para café deve ficar entre 60% e 70%.");
    if (isNum(laudo.prnt) && (laudo.prnt <= 0 || laudo.prnt > 150)) erros.push("PRNT deve estar entre 1% e 150%.");
    if (isNum(laudo.ctc) !== isNum(laudo.v1)) erros.push("Para o modo avançado informe CTC e V1 juntos.");
    return erros;
  }

  function calcularCalagem(talhao, catalogo, config = {}) {
    const f = catalogo.formulasCalculo;
    const area = talhao.areaHectares;

    if (temLaudoCompleto(talhao.laudo)) {
      const l = talhao.laudo;
      const v2 = isNum(l.v2) ? l.v2 : config.v2Padrao || 65;
      const prnt = isNum(l.prnt) ? l.prnt : 80;
      const forma = l.formaAplicacao || "incorporacaoA20cm";
      const fator = f.calagem.fatorProfundidade[forma];
      const ncBruto = (l.ctc * (v2 - l.v1)) / 100;
      const nc = Math.max(0, ncBruto * (100 / prnt) * fator);
      return {
        metodo: "saturacao",
        modo: "avancado",
        nomeMetodo: f.calagem.nome,
        doseTHa: round(nc),
        totalT: round(nc * area),
        necessario: nc > 0,
        memoria: [
          `NC bruto = CTC × (V2 − V1) / 100 = ${l.ctc} × (${v2} − ${l.v1}) / 100 = ${round(ncBruto)} t/ha`,
          `NC corrigido = NC bruto × (100 / PRNT) × fator = ${round(ncBruto)} × (100 / ${prnt}) × ${fator} = ${round(nc)} t/ha`,
          `Total = ${round(nc)} t/ha × ${area} ha = ${round(nc * area)} t`,
        ],
        parametros: { ctc: l.ctc, v1: l.v1, v2, prnt, forma, fator },
        fonte: f.calagem.fonte,
      };
    }

    const linha = f.calagemSimplificada.tabelaReferencia.find((r) => r.tipoSolo === talhao.tipoSolo);
    if (!linha) {
      return { metodo: "indisponivel", modo: "padrao", necessario: false, motivo: "Informe o tipo de solo do talhão para estimar a calagem." };
    }
    return {
      metodo: "simplificado",
      modo: "padrao",
      nomeMetodo: f.calagemSimplificada.nome,
      doseTHa: linha.doseReferenciaTha,
      totalT: round(linha.doseReferenciaTha * area),
      necessario: true,
      memoria: [
        `Solo ${linha.tipoSolo.toLowerCase()} (${linha.percentualArgila} de argila) → dose de referência ${linha.doseReferenciaTha} t/ha`,
        `Total = ${linha.doseReferenciaTha} t/ha × ${area} ha = ${round(linha.doseReferenciaTha * area)} t`,
      ],
      observacao: f.calagemSimplificada.observacao,
      fonte: f.calagemSimplificada.fonte,
    };
  }

  /* ------------------------------------------------------------------ */
  /* RF-03 — Adubação NPK                                                */
  /* ------------------------------------------------------------------ */

  function calcularAdubacao(talhao, catalogo, produtividadeEsperada) {
    const f = catalogo.formulasCalculo;
    const area = talhao.areaHectares;

    if (talhao.fase === "producao") {
      const prod = isNum(produtividadeEsperada) ? produtividadeEsperada : talhao.produtividadeEsperadaSacasHa;
      if (!isNum(prod) || prod <= 0) {
        return { tipo: "indisponivel", motivo: "Informe a produtividade esperada (sacas/ha) para calcular a adubação de produção." };
      }
      const fat = f.adubacaoProducao.fatoresPorSaca;
      const conv = f.adubacaoProducao.conversao;
      const mult = talhao.irrigado ? 1.5 : 1;
      const N = prod * fat.N_kgPorSaca * mult;
      const P = prod * fat.P_kgPorSaca * mult;
      const K = prod * fat.K_kgPorSaca * mult;
      const nutrientes = {
        N: round(N, 1),
        P2O5: round(P * conv.P_paraP2O5, 1),
        K2O: round(K * conv.K_paraK2O, 1),
      };
      return {
        tipo: "producao",
        nomeMetodo: f.adubacaoProducao.nome,
        produtividadeEsperada: prod,
        irrigado: !!talhao.irrigado,
        porHa: nutrientes,
        elementar: { N: round(N, 1), P: round(P, 1), K: round(K, 1) },
        total: { N: round(nutrientes.N * area, 1), P2O5: round(nutrientes.P2O5 * area, 1), K2O: round(nutrientes.K2O * area, 1) },
        memoria: [
          `N = ${prod} sc/ha × ${fat.N_kgPorSaca} kg/sc${mult > 1 ? " × 1,5 (irrigado)" : ""} = ${round(N, 1)} kg/ha`,
          `P = ${prod} × ${fat.P_kgPorSaca}${mult > 1 ? " × 1,5" : ""} = ${round(P, 1)} kg/ha → P₂O₅ = × ${conv.P_paraP2O5} = ${nutrientes.P2O5} kg/ha`,
          `K = ${prod} × ${fat.K_kgPorSaca}${mult > 1 ? " × 1,5" : ""} = ${round(K, 1)} kg/ha → K₂O = × ${conv.K_paraK2O} = ${nutrientes.K2O} kg/ha`,
        ],
        observacao: talhao.irrigado ? f.adubacaoProducao.observacaoIrrigacao : null,
        fonte: f.adubacaoProducao.fonte,
      };
    }

    const fase = talhao.fase === "formacao_1" ? 1 : talhao.fase === "formacao_2" ? 2 : null;
    if (fase) {
      const ref = f.adubacaoFormacao.doses.find((d) => d.anoAposPlantio === fase);
      const plantas = isNum(talhao.plantasPorHa) && talhao.plantasPorHa > 0 ? talhao.plantasPorHa : null;
      if (!plantas) return { tipo: "indisponivel", motivo: "Informe o número de plantas por hectare para calcular a adubação de formação." };
      const kgHa = (ref.gramasPorPlanta * plantas) / 1000;
      // Formulação 15-00-10: 15% de N e 10% de K₂O.
      const nutrientes = { N: round(kgHa * 0.15, 1), P2O5: 0, K2O: round(kgHa * 0.1, 1) };
      return {
        tipo: "formacao",
        nomeMetodo: f.adubacaoFormacao.nome,
        formulacao: f.adubacaoFormacao.formulacaoReferencia,
        gramasPorPlanta: ref.gramasPorPlanta,
        produtoKgHa: round(kgHa, 1),
        produtoTotalKg: round(kgHa * area, 1),
        porHa: nutrientes,
        total: { N: round(nutrientes.N * area, 1), P2O5: 0, K2O: round(nutrientes.K2O * area, 1) },
        memoria: [
          `${fase}º ano após o plantio → ${ref.gramasPorPlanta} g/planta de ${f.adubacaoFormacao.formulacaoReferencia}`,
          `${ref.gramasPorPlanta} g × ${plantas} plantas/ha ÷ 1000 = ${round(kgHa, 1)} kg/ha de produto`,
          `Total = ${round(kgHa, 1)} kg/ha × ${area} ha = ${round(kgHa * area, 1)} kg (${ref.aplicacoesPorAno})`,
        ],
        fonte: f.adubacaoFormacao.fonte,
      };
    }

    return {
      tipo: "indisponivel",
      motivo: "Mudas em viveiro: a adubação de substrato não faz parte do catálogo técnico atual. Siga a orientação do viveirista/agrônomo.",
    };
  }

  /* ------------------------------------------------------------------ */
  /* RF-08 / RF-15 — Leitura do clima                                    */
  /* ------------------------------------------------------------------ */

  // previsao: { dias: [{ data, tMin, tMax, chuvaMm, umidade }] }
  function avaliarClima(previsao, fase) {
    const riscos = [];
    const avisosAplicacao = [];
    if (!previsao || !previsao.dias || !previsao.dias.length) return { riscos, avisosAplicacao, disponivel: false };
    const dias = previsao.dias;

    const geada = dias.find((d) => isNum(d.tMin) && d.tMin <= 3);
    if (geada) {
      riscos.push({
        tipo: "geada",
        gravidade: geada.tMin <= 1 ? "alta" : "media",
        data: geada.data,
        mensagem: `Risco de geada: mínima de ${round(geada.tMin, 1)} °C prevista para ${geada.data}.` +
          (fase && fase !== "producao" ? " Lavouras jovens são mais sensíveis — considere proteger as mudas." : ""),
      });
    }

    const chuvaForte = dias.find((d) => isNum(d.chuvaMm) && d.chuvaMm >= 50);
    const chuva3d = dias.slice(0, 3).reduce((s, d) => s + (d.chuvaMm || 0), 0);
    if (chuvaForte || chuva3d >= 100) {
      riscos.push({
        tipo: "chuva",
        gravidade: "media",
        data: chuvaForte ? chuvaForte.data : dias[0].data,
        mensagem: chuvaForte
          ? `Chuva excessiva: ${round(chuvaForte.chuvaMm, 1)} mm previstos para ${chuvaForte.data}.`
          : `Chuva excessiva: ${round(chuva3d, 1)} mm acumulados nos próximos 3 dias.`,
      });
    }

    const chuva7d = dias.slice(0, 7).reduce((s, d) => s + (d.chuvaMm || 0), 0);
    const tMaxMedia = dias.reduce((s, d) => s + (d.tMax || 0), 0) / dias.length;
    if (chuva7d < 5 && tMaxMedia >= 30) {
      riscos.push({
        tipo: "seca",
        gravidade: fase === "producao" ? "media" : "alta",
        data: dias[0].data,
        mensagem: `Risco de seca: apenas ${round(chuva7d, 1)} mm de chuva em 7 dias, com máximas médias de ${round(tMaxMedia, 1)} °C.`,
      });
    }

    const umidadeMedia = dias.reduce((s, d) => s + (d.umidade || 0), 0) / dias.length;
    const tMedia = dias.reduce((s, d) => s + ((d.tMin + d.tMax) / 2 || 0), 0) / dias.length;
    if (umidadeMedia >= 80 && tMedia >= 18 && tMedia <= 28) {
      riscos.push({
        tipo: "doenca",
        gravidade: "media",
        data: dias[0].data,
        mensagem: `Tempo úmido (umidade média ${Math.round(umidadeMedia)}%) e temperatura amena favorecem ferrugem e cercosporiose. Fique atento às folhas.`,
      });
    }

    const chuva48h = dias.slice(0, 2).reduce((s, d) => s + (d.chuvaMm || 0), 0);
    if (chuva48h >= 10) {
      avisosAplicacao.push(`Previsão de ${round(chuva48h, 1)} mm de chuva em 48 h: evite pulverizar defensivos agora — a chuva pode lavar o produto.`);
    }
    if (chuva7d < 5) {
      avisosAplicacao.push("Sem chuva prevista na semana: adubo sólido em solo seco é mal aproveitado. Se não houver irrigação, aguarde umidade no solo.");
    } else if (chuva48h < 10 && chuva7d >= 15) {
      avisosAplicacao.push("Boa janela para adubação: chuva moderada prevista nos próximos dias ajuda a incorporar o adubo.");
    }

    return { riscos, avisosAplicacao, disponivel: true, resumo: { chuva7d: round(chuva7d, 1), tMaxMedia: round(tMaxMedia, 1), umidadeMedia: Math.round(umidadeMedia) } };
  }

  /* ------------------------------------------------------------------ */
  /* RF-12 — Dose de defensivo                                           */
  /* ------------------------------------------------------------------ */

  function unidadeBase(unidade) {
    return /^mL/i.test(String(unidade || "").trim()) ? "mL/ha" : "L/ha";
  }

  function escolherPorSeveridade(min, max, severidade) {
    if (!isNum(min) && !isNum(max)) return null;
    if (!isNum(min)) return max;
    if (!isNum(max)) return min;
    if (severidade === "leve") return min;
    if (severidade === "severa") return max;
    return round((min + max) / 2, 3);
  }

  function doseDoProduto(produto, ligacao, severidade) {
    const d = produto.dose;
    if (Array.isArray(d)) {
      const alvo = (ligacao.alvoPorSeveridade && ligacao.alvoPorSeveridade[severidade]) || ligacao.alvoDose;
      const linha = d.find((x) => x.alvo === alvo) || d[0];
      const calda = typeof linha.volumeCalda === "string" ? parseFloat(linha.volumeCalda) : null;
      return { doseHa: linha.valor, unidade: unidadeBase(linha.unidade), faixa: null, alvo: linha.alvo, obs: linha.obs || null, caldaHa: calda };
    }
    if (d && (isNum(d.min) || isNum(d.max))) {
      return { doseHa: escolherPorSeveridade(d.min, d.max, severidade), unidade: unidadeBase(d.unidade), faixa: { min: d.min, max: d.max }, alvo: null, obs: null, caldaHa: null };
    }
    return { doseHa: null, unidade: unidadeBase(d && d.unidade), faixa: null, alvo: null, obs: d && d.obs, caldaHa: null };
  }

  function volumeCalda(produto, severidade) {
    const v = produto.volumeCalda;
    if (!v) return null;
    if (isNum(v.valor)) return v.valor;
    return escolherPorSeveridade(v.min, v.max, severidade);
  }

  function precoProduto(produto, precos) {
    if (precos && isNum(precos[produto.id])) return precos[produto.id];
    return produto.precoReferencia && isNum(produto.precoReferencia.valor) ? produto.precoReferencia.valor : null;
  }

  // Retorna { oficiais, complementares, semRecomendacaoOficial }.
  // RN-08: produtos "Recorrente" entram só em `complementares`, nunca substituem os oficiais.
  function calcularDoseDefensivo({ praga, severidade, talhao, catalogo, cultura, produtosPersonalizados = [], precos = {} }) {
    const area = talhao.areaHectares;
    const oficiais = [];

    for (const lig of praga.defensivos) {
      if (lig.fases && !lig.fases.includes(talhao.fase)) continue;
      const produto = catalogo.defensivos.find((p) => p.id === lig.produtoId);
      if (!produto) continue;
      const dose = doseDoProduto(produto, lig, severidade);
      const caldaHa = dose.caldaHa || volumeCalda(produto, severidade);
      const restricao = cultura.restricoesRegionais && cultura.restricoesRegionais[produto.id];
      const restrito = !!(restricao && talhao.localizacao && restricao.ufs.includes(talhao.localizacao.uf));

      let totalL = null;
      if (isNum(dose.doseHa)) totalL = dose.unidade === "mL/ha" ? (dose.doseHa * area) / 1000 : dose.doseHa * area;
      const preco = precoProduto(produto, precos);

      oficiais.push({
        produtoId: produto.id,
        nome: produto.nome,
        fabricante: produto.fabricante,
        categoria: produto.categoria,
        ingredienteAtivo: produto.ingredienteAtivo,
        doseHa: dose.doseHa,
        unidade: dose.unidade,
        faixa: dose.faixa,
        alvoDose: dose.alvo,
        totalL: isNum(totalL) ? round(totalL, 2) : null,
        caldaHa,
        caldaTotalL: isNum(caldaHa) ? round(caldaHa * area, 0) : null,
        precoLitro: preco,
        custoEstimado: isNum(preco) && isNum(totalL) ? round(preco * totalL, 2) : null,
        maxAplicacoesPorCiclo: produto.maxAplicacoesPorCiclo || null,
        observacao: dose.obs || produto.observacaoAplicacao || null,
        semDose: !isNum(dose.doseHa),
        restrito,
        motivoRestricao: restrito ? restricao.motivo : null,
        fonte: produto.fonte,
      });
    }

    // Produtos sem restrição e com dose vêm primeiro.
    oficiais.sort((a, b) => (a.restrito - b.restrito) || (a.semDose - b.semDose));

    const complementares = produtosPersonalizados.filter(
      (p) => p.status === "Recorrente" && (p.pragasAlvo || []).includes(praga.id)
    );

    return {
      oficiais,
      complementares,
      semRecomendacaoOficial: oficiais.filter((o) => !o.restrito).length === 0,
      severidade,
      area,
    };
  }

  /* ------------------------------------------------------------------ */
  /* RF-04 — Comparação aplicado x recomendado                           */
  /* ------------------------------------------------------------------ */

  function classificar(aplicado, recomendado, opts = {}) {
    if (!isNum(aplicado) || !isNum(recomendado) || recomendado <= 0) return null;
    const pct = round((aplicado / recomendado) * 100, 0);
    let status = "ok";
    if (pct > FAIXA_OK.max) status = "excesso";
    else if (pct < FAIXA_OK.min) status = opts.parcial ? "parcial" : "deficiencia";
    return { aplicado: round(aplicado, 2), recomendado: round(recomendado, 2), pct, status, desvio: pct - 100 };
  }

  function classificarFaixa(aplicado, min, max) {
    if (!isNum(aplicado) || !isNum(min) || !isNum(max)) return null;
    const ref = aplicado > max ? max : aplicado < min ? min : aplicado;
    const pct = round((aplicado / ref) * 100, 0);
    const status = aplicado > max ? "excesso" : aplicado < min ? "deficiencia" : "ok";
    return { aplicado: round(aplicado, 3), recomendado: ref, faixa: { min, max }, pct, status, desvio: pct - 100 };
  }

  // Converte a quantidade registrada para a unidade da recomendação.
  function paraLitros(qtd, unidade) {
    return unidade === "mL" ? qtd / 1000 : qtd;
  }
  function paraToneladas(qtd, unidade) {
    return unidade === "kg" ? qtd / 1000 : qtd;
  }

  // Nutrientes (kg) contidos numa aplicação de fertilizante com formulação N-P₂O₅-K₂O.
  function nutrientesDaAplicacao(ap) {
    if (!ap.formulacao) return { N: 0, P2O5: 0, K2O: 0 };
    const kg = ap.unidade === "t" ? ap.quantidade * 1000 : ap.quantidade;
    return {
      N: (kg * (ap.formulacao.n || 0)) / 100,
      P2O5: (kg * (ap.formulacao.p || 0)) / 100,
      K2O: (kg * (ap.formulacao.k || 0)) / 100,
    };
  }

  // Compara as aplicações de uma safra com as recomendações vigentes.
  //   recomendacao = { calagem, adubacao } (saídas de calcularCalagem/calcularAdubacao)
  //   dosesDefensivo = { [ocorrenciaId]: [doses oficiais] }  (saída `oficiais` de calcularDoseDefensivo)
  function compararSafra({ talhao, safra, aplicacoes, recomendacao, dosesDefensivo = {}, catalogo }) {
    const area = talhao.areaHectares;
    const doSafra = aplicacoes.filter((a) => a.safraId === safra.id);
    const parcial = safra.status !== "Concluída";
    const itens = [];

    // Corretivo
    const calc = doSafra.filter((a) => a.categoria === "corretivo");
    if (calc.length && recomendacao.calagem && recomendacao.calagem.doseTHa > 0) {
      const tHa = calc.reduce((s, a) => s + paraToneladas(a.quantidade, a.unidade), 0) / area;
      const c = classificar(tHa, recomendacao.calagem.doseTHa, { parcial: false });
      if (c) itens.push({ chave: "calcario", insumo: "Calcário", unidade: "t/ha", categoria: "corretivo", ...c });
    }

    // Fertilizantes → nutrientes acumulados na safra
    const ferts = doSafra.filter((a) => a.categoria === "fertilizante");
    if (ferts.length && recomendacao.adubacao && recomendacao.adubacao.porHa) {
      const soma = ferts.reduce(
        (acc, a) => {
          const n = nutrientesDaAplicacao(a);
          acc.N += n.N; acc.P2O5 += n.P2O5; acc.K2O += n.K2O;
          return acc;
        },
        { N: 0, P2O5: 0, K2O: 0 }
      );
      const rec = recomendacao.adubacao.porHa;
      const rotulos = { N: "Nitrogênio (N)", P2O5: "Fósforo (P₂O₅)", K2O: "Potássio (K₂O)" };
      for (const k of ["N", "P2O5", "K2O"]) {
        if (!(rec[k] > 0)) continue;
        const c = classificar(soma[k] / area, rec[k], { parcial });
        if (c) itens.push({ chave: k, insumo: rotulos[k], unidade: "kg/ha", categoria: "fertilizante", ...c });
      }
    }

    // Defensivos → cada aplicação contra a dose recomendada para a ocorrência,
    // ou contra a faixa de bula do produto.
    doSafra
      .filter((a) => a.categoria === "defensivo")
      .forEach((a) => {
        const litrosHa = paraLitros(a.quantidade, a.unidade) / area;
        const recs = [].concat((a.ocorrenciaId && dosesDefensivo[a.ocorrenciaId]) || []);
        const rec = recs.find((r) => r.produtoId === a.produtoId);
        let c = null;
        let unidade = "L/ha";
        if (rec && isNum(rec.doseHa)) {
          const recL = rec.unidade === "mL/ha" ? rec.doseHa / 1000 : rec.doseHa;
          c = classificar(litrosHa, recL);
        } else if (catalogo && a.produtoId) {
          const p = catalogo.defensivos.find((x) => x.id === a.produtoId);
          if (p && p.dose && !Array.isArray(p.dose) && isNum(p.dose.min) && isNum(p.dose.max)) {
            c = classificarFaixa(litrosHa, p.dose.min, p.dose.max);
          }
        }
        if (c) itens.push({ chave: `def-${a.id}`, aplicacaoId: a.id, insumo: a.nomeProduto, unidade, categoria: "defensivo", data: a.data, ...c });
      });

    const pcts = itens.filter((i) => i.status !== "parcial").map((i) => i.pct);
    return {
      itens,
      pctMedio: pcts.length ? Math.round(pcts.reduce((s, v) => s + v, 0) / pcts.length) : null,
      parcial,
    };
  }

  /* ------------------------------------------------------------------ */
  /* RF-09 — Sugestão de reajuste (RN-05)                                */
  /* ------------------------------------------------------------------ */

  function regraReajuste(pctAplicado, rendimento) {
    // rendimento = produtividade obtida / esperada
    if (pctAplicado > FAIXA_OK.max) {
      const ajuste = -Math.min(50, Math.round((1 - 100 / pctAplicado) * 100));
      return rendimento >= 0.95
        ? { ajuste, motivo: `a dose ficou em ${pctAplicado}% do recomendado e a meta de produtividade foi atingida — há excesso (desperdício).` }
        : { ajuste, motivo: `a dose ficou em ${pctAplicado}% do recomendado sem retorno em produtividade — o excesso não resolveu; verifique também pragas, clima e solo.` };
    }
    if (pctAplicado < FAIXA_OK.min) {
      if (rendimento < 0.95) {
        return { ajuste: Math.min(50, Math.round((100 / pctAplicado - 1) * 100)), motivo: `a dose ficou em ${pctAplicado}% do recomendado e a produtividade ficou abaixo da meta — provável deficiência.` };
      }
      return { ajuste: 0, motivo: `a dose ficou em ${pctAplicado}% do recomendado, mas a meta foi atingida — mantenha a dose e acompanhe na próxima análise de solo.` };
    }
    if (rendimento < 0.85) {
      return { ajuste: 10, motivo: `a dose esteve dentro da faixa (${pctAplicado}%), mas a produtividade ficou bem abaixo da meta — faça uma nova análise de solo.` };
    }
    return { ajuste: 0, motivo: `a dose esteve dentro da faixa recomendada (${pctAplicado}%) e a produtividade respondeu bem — mantenha.` };
  }

  // safrasAnalisadas: [{ safra, comparacao }] — apenas safras concluídas.
  function sugerirReajuste(safrasAnalisadas) {
    const concluidas = safrasAnalisadas.filter((s) => s.safra.status === "Concluída" && s.safra.colheita);
    if (!concluidas.length) {
      return { disponivel: false, motivo: "Ainda não há safra concluída (com colheita registrada) neste talhão." };
    }

    // Fluxo alternativo 3a: média das últimas safras (até 3).
    const ultimas = concluidas.slice(-3);
    const rendimentos = ultimas
      .filter((s) => isNum(s.safra.produtividadeEsperadaSacasHa) && s.safra.produtividadeEsperadaSacasHa > 0)
      .map((s) => s.safra.colheita.produtividadeSacasHa / s.safra.produtividadeEsperadaSacasHa);
    const rendimento = rendimentos.length ? rendimentos.reduce((a, b) => a + b, 0) / rendimentos.length : 1;
    const prodMedia = ultimas.reduce((s, x) => s + x.safra.colheita.produtividadeSacasHa, 0) / ultimas.length;

    const ajustes = [];
    const nomes = { N: "Nitrogênio (N)", K2O: "Potássio (K₂O)", P2O5: "Fósforo (P₂O₅)", calcario: "Calcário" };
    for (const chave of ["N", "K2O", "P2O5"]) {
      const pcts = ultimas
        .map((s) => s.comparacao.itens.find((i) => i.chave === chave))
        .filter(Boolean)
        .map((i) => i.pct);
      if (!pcts.length) continue;
      const media = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
      const r = regraReajuste(media, rendimento);
      ajustes.push({ chave, insumo: nomes[chave], pctAplicadoMedio: media, percentualAjuste: r.ajuste, motivo: r.motivo });
    }

    if (!ajustes.length) {
      return {
        disponivel: true,
        semAplicacoes: true,
        safrasConsideradas: ultimas.length,
        rendimentoPct: Math.round(rendimento * 100),
        ajustes: [],
        justificativa: "Não há aplicações de fertilizante registradas nas safras concluídas, então não é possível relacionar dose e produtividade. Registre as aplicações da próxima safra.",
      };
    }

    const principal = ajustes.slice().sort((a, b) => Math.abs(b.percentualAjuste) - Math.abs(a.percentualAjuste))[0];
    const plural = ultimas.length > 1 ? `média das últimas ${ultimas.length} safras` : "última safra";
    return {
      disponivel: true,
      safrasConsideradas: ultimas.length,
      produtividadeMedia: round(prodMedia, 1),
      rendimentoPct: Math.round(rendimento * 100),
      ajustes,
      principal,
      justificativa: `Na ${plural}, a produtividade foi de ${round(prodMedia, 1)} sc/ha (${Math.round(rendimento * 100)}% da meta). Para ${minusculaInicial(principal.insumo)}, ${principal.motivo}`,
    };
  }

  /* ------------------------------------------------------------------ */
  /* RF-15 — Alertas de aplicação                                        */
  /* ------------------------------------------------------------------ */

  function precisaAlerta(item, tolerancia = 20) {
    if (!item || item.status === "ok" || item.status === "parcial") return false;
    return Math.abs(item.desvio) > tolerancia;
  }

  /* ------------------------------------------------------------------ */
  /* RN-07 — Promoção de produto personalizado                           */
  /* ------------------------------------------------------------------ */

  // produtorDe(aplicacao) -> id do produtor dono do talhão da aplicação
  function statusProdutoPersonalizado(produtoId, aplicacoes, produtorDe, cfg) {
    const porProdutor = {};
    aplicacoes
      .filter((a) => a.produtoPersonalizadoId === produtoId)
      .forEach((a) => {
        const p = produtorDe(a);
        if (p) porProdutor[p] = (porProdutor[p] || 0) + 1;
      });
    const qualificados = Object.values(porProdutor).filter((n) => n >= cfg.minAplicacoesPorProdutor).length;
    return {
      status: qualificados >= cfg.minProdutores ? "Recorrente" : "Novo",
      produtoresQualificados: qualificados,
      produtoresDistintos: Object.keys(porProdutor).length,
    };
  }

  /* ------------------------------------------------------------------ */
  /* RN-01 — CPF                                                         */
  /* ------------------------------------------------------------------ */

  function normalizarCPF(cpf) {
    return String(cpf || "").replace(/\D/g, "");
  }

  function validarCPF(cpf) {
    const c = normalizarCPF(cpf);
    if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
    const dig = (n) => {
      let s = 0;
      for (let i = 0; i < n; i++) s += parseInt(c[i], 10) * (n + 1 - i);
      const r = (s * 10) % 11;
      return r === 10 ? 0 : r;
    };
    return dig(9) === parseInt(c[9], 10) && dig(10) === parseInt(c[10], 10);
  }

  const api = {
    FAIXA_OK,
    round,
    temLaudoCompleto,
    validarLaudo,
    calcularCalagem,
    calcularAdubacao,
    avaliarClima,
    calcularDoseDefensivo,
    classificar,
    classificarFaixa,
    nutrientesDaAplicacao,
    compararSafra,
    regraReajuste,
    sugerirReajuste,
    precisaAlerta,
    minusculaInicial,
    statusProdutoPersonalizado,
    normalizarCPF,
    validarCPF,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Calc = api;
})(typeof window !== "undefined" ? window : globalThis);
