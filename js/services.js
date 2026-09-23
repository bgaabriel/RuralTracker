// Camada de serviços: junta o armazenamento (Store), o motor de cálculo (Calc),
// o catálogo técnico (RF-18) e os serviços externos (clima e WhatsApp).
(function (root) {
  const catalogo = () => root.CATALOGO_PRODUTOS;
  const cultura = (t) => root.CULTURAS[(t && t.cultura) || "cafe"];

  const semAcento = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

  /* ---------------- Pragas: busca por nome popular (RF-11) ---------------- */

  function praga(id, culturaId = "cafe") {
    return root.CULTURAS[culturaId].pragas.find((p) => p.id === id) || null;
  }

  function distancia(a, b) {
    const m = a.length, n = b.length;
    const d = Array.from({ length: m + 1 }, (_, i) => [i].concat(new Array(n).fill(0)));
    for (let j = 1; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++)
      for (let j = 1; j <= n; j++)
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[m][n];
  }

  function buscarPraga(termo, culturaId = "cafe") {
    const lista = root.CULTURAS[culturaId].pragas;
    const q = semAcento(termo);
    if (!q) return { resultados: lista, sugestoes: [], termo };
    const nomes = (p) => [p.nomeTecnico, p.nomeCientifico].concat(p.nomesPopulares).map(semAcento);
    const resultados = lista
      .map((p) => {
        const alvo = nomes(p);
        const popular = p.nomesPopulares.find((n) => semAcento(n).includes(q));
        const hit = alvo.some((n) => n.includes(q));
        return hit ? { ...p, apelidoEncontrado: popular && !semAcento(p.nomeTecnico).includes(q) ? popular : null } : null;
      })
      .filter(Boolean);
    if (resultados.length) return { resultados, sugestoes: [], termo };
    // Fluxo alternativo 2a: sugere os nomes técnicos mais próximos.
    const sugestoes = lista
      .map((p) => ({ p, d: Math.min(...nomes(p).map((n) => distancia(q, n.slice(0, Math.max(q.length, 4))))) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 3)
      .map((x) => x.p);
    return { resultados: [], sugestoes, termo };
  }

  /* ---------------- Recomendações (RF-03, RF-12) ---------------- */

  function recomendacao(talhao, safra) {
    const s = safra || Store.safraAtiva(talhao.id);
    const esperada = s && s.produtividadeEsperadaSacasHa ? s.produtividadeEsperadaSacasHa : talhao.produtividadeEsperadaSacasHa;
    const cache = Store.climaDo(talhao.id);
    return {
      calagem: Calc.calcularCalagem(talhao, catalogo(), Store.state.config),
      adubacao: Calc.calcularAdubacao(talhao, catalogo(), esperada),
      clima: Calc.avaliarClima(cache, talhao.fase),
      climaCache: cache,
      safra: s,
    };
  }

  function doseOcorrencia(ocorrencia, talhaoOverride) {
    const t = talhaoOverride || Store.talhao(ocorrencia.talhaoId);
    const p = praga(ocorrencia.pragaId, t.cultura);
    return Calc.calcularDoseDefensivo({
      praga: p,
      severidade: ocorrencia.severidade,
      talhao: t,
      catalogo: catalogo(),
      cultura: cultura(t),
      produtosPersonalizados: Store.state.produtosPersonalizados,
      precos: Store.precos(),
    });
  }

  /* ---------------- Comparação e reajuste (RF-04, RF-09) ---------------- */

  function comparacao(talhao, safra) {
    if (!safra) return { itens: [], pctMedio: null, parcial: true };
    const dosesDefensivo = {};
    Store.state.ocorrencias
      .filter((o) => o.talhaoId === talhao.id)
      .forEach((o) => { dosesDefensivo[o.id] = doseOcorrencia(o, talhao).oficiais; });
    return Calc.compararSafra({
      talhao,
      safra,
      aplicacoes: Store.state.aplicacoes,
      recomendacao: recomendacao(talhao, safra),
      dosesDefensivo,
      catalogo: catalogo(),
    });
  }

  function reajuste(talhao) {
    const analisadas = Store.safrasDo(talhao.id)
      .filter((s) => s.status === "Concluída")
      .map((safra) => ({ safra, comparacao: comparacao(talhao, safra) }));
    const r = Calc.sugerirReajuste(analisadas);
    if (r.disponivel) {
      const ultima = analisadas[analisadas.length - 1].safra;
      Store.registrarSugestao(talhao.id, ultima.id, {
        percentualAjuste: r.principal ? r.principal.percentualAjuste : 0,
        insumo: r.principal ? r.principal.insumo : null,
        justificativa: r.justificativa,
      });
    }
    return r;
  }

  /* ---------------- Custos ---------------- */

  function custoSafra(talhao, safra) {
    if (!safra) return { total: 0, porHa: 0 };
    const total = Store.state.aplicacoes.filter((a) => a.safraId === safra.id).reduce((s, a) => s + (a.custo || 0), 0);
    return { total, porHa: total / talhao.areaHectares };
  }

  /* ---------------- Alertas (RF-15) ---------------- */

  function verificarAplicacao(ap) {
    const t = Store.talhao(ap.talhaoId);
    const safra = Store.state.safras.find((s) => s.id === ap.safraId);
    if (!t || !safra) return { itens: [], alertas: [] };
    const comp = comparacao(t, safra);
    const tol = Store.state.config.toleranciaAlertaPct;
    const relevantes = comp.itens.filter((i) =>
      ap.categoria === "defensivo" ? i.aplicacaoId === ap.id : i.categoria === ap.categoria
    );
    const alertas = [];
    relevantes.forEach((i) => {
      if (!Calc.precisaAlerta(i, tol)) return;
      const dir = i.status === "excesso" ? "acima" : "abaixo";
      const a = Store.adicionarAlerta({
        chave: `ap-${safra.id}-${i.chave}-${i.status}`,
        tipo: "aplicacao",
        talhaoId: t.id,
        gravidade: Math.abs(i.desvio) > 50 ? "alta" : "media",
        descricao: `${i.insumo} no ${t.nome} — ${t.variedade}: ${Math.abs(i.desvio)}% ${dir} do recomendado (${fmt(i.aplicado)} de ${fmt(i.recomendado)} ${i.unidade}).`,
      });
      if (a) { alertas.push(a); Mensageria.enviar(a); }
    });
    return { itens: relevantes, alertas };
  }

  const fmt = (v) => (typeof v === "number" ? v.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : v);

  /* ---------------- Clima (RF-08, RNF-01) — Open-Meteo, sem chave ---------------- */

  const NOMES_UF = {
    AC: "Acre", AL: "Alagoas", AM: "Amazonas", AP: "Amapá", BA: "Bahia", CE: "Ceará", DF: "Distrito Federal",
    ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão", MG: "Minas Gerais", MS: "Mato Grosso do Sul", MT: "Mato Grosso",
    PA: "Pará", PB: "Paraíba", PE: "Pernambuco", PI: "Piauí", PR: "Paraná", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte",
    RO: "Rondônia", RR: "Roraima", RS: "Rio Grande do Sul", SC: "Santa Catarina", SE: "Sergipe", SP: "São Paulo", TO: "Tocantins",
  };

  async function geocodificar(cidade, uf) {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cidade)}&count=10&language=pt&format=json&countryCode=BR`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Geocodificação falhou (${r.status})`);
    const j = await r.json();
    const lista = j.results || [];
    const alvo = semAcento(NOMES_UF[uf]);
    const achado = lista.find((x) => semAcento(x.admin1) === alvo) || lista[0];
    if (!achado) throw new Error("Cidade não encontrada no serviço de clima.");
    return { lat: achado.latitude, lon: achado.longitude, nome: `${achado.name} - ${uf}` };
  }

  const Clima = {
    precisaAtualizar(talhaoId) {
      const c = Store.climaDo(talhaoId);
      if (!c) return true;
      const horas = (Date.now() - new Date(c.atualizadoEm).getTime()) / 36e5;
      return horas >= Store.state.config.climaIntervaloHoras;
    },

    async atualizar(talhao, { forcar = false } = {}) {
      if (!Store.online()) throw new Error("Sem conexão com a internet.");
      if (!forcar && !this.precisaAtualizar(talhao.id)) return Store.climaDo(talhao.id);
      let { lat, lon } = talhao.localizacao;
      if (typeof lat !== "number" || typeof lon !== "number") {
        const g = await geocodificar(talhao.localizacao.cidade, talhao.localizacao.uf);
        lat = g.lat; lon = g.lon;
        Store.salvarCoordenadas(talhao.id, lat, lon, g.nome);
      }
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,relative_humidity_2m_mean" +
        "&current=temperature_2m,relative_humidity_2m,precipitation&timezone=America%2FSao_Paulo&forecast_days=7";
      const r = await fetch(url);
      if (!r.ok) throw new Error(`Serviço de clima indisponível (${r.status})`);
      const j = await r.json();
      const d = j.daily;
      const dias = d.time.map((data, i) => ({
        data: data.split("-").reverse().join("/"),
        iso: data,
        tMin: d.temperature_2m_min[i],
        tMax: d.temperature_2m_max[i],
        chuvaMm: d.precipitation_sum[i],
        umidade: d.relative_humidity_2m_mean ? d.relative_humidity_2m_mean[i] : null,
      }));
      const dados = {
        fonte: "Open-Meteo",
        atual: j.current ? { temperatura: j.current.temperature_2m, umidade: j.current.relative_humidity_2m, chuva: j.current.precipitation } : null,
        dias,
      };
      Store.salvarClima(talhao.id, dados);
      this.gerarAlertas(talhao);
      return Store.climaDo(talhao.id);
    },

    gerarAlertas(talhao) {
      const av = Calc.avaliarClima(Store.climaDo(talhao.id), talhao.fase);
      av.riscos
        .filter((r) => ["geada", "seca", "chuva"].includes(r.tipo))
        .forEach((r) => {
          const a = Store.adicionarAlerta({
            chave: `clima-${talhao.id}-${r.tipo}-${r.data}`,
            tipo: "clima",
            talhaoId: talhao.id,
            gravidade: r.gravidade,
            descricao: `${talhao.nome} — ${talhao.variedade}: ${r.mensagem}`,
          });
          if (a) Mensageria.enviar(a);
        });
    },

    // RNF-01: atualização periódica para todos os talhões da conta.
    async atualizarTodos() {
      if (!Store.online() || !Store.usuarioAtual()) return 0;
      let n = 0;
      for (const t of Store.talhoes()) {
        if (!this.precisaAtualizar(t.id)) continue;
        try { await this.atualizar(t); n++; } catch (e) { console.warn("Clima:", t.nome, e.message); }
      }
      return n;
    },
  };

  /* ---------------- Mensageria WhatsApp (RF-16, RNF-07) ---------------- */

  const Mensageria = {
    destinatarios() {
      const conta = Store.contaAtualId();
      return Store.state.usuarios.filter(
        (u) => (u.id === conta || (u.tipo === "colaborador" && u.produtorId === conta && u.receberAlertas)) && u.telefone
      );
    },

    texto(alerta) {
      return `🌱 Rural Tracker — Alerta\n${alerta.descricao}\n\nOrientação do sistema; não substitui a avaliação de um agrônomo.`;
    },

    linkWhatsApp(telefone, alerta) {
      const num = String(telefone).replace(/\D/g, "");
      const intl = num.startsWith("55") ? num : `55${num}`;
      return `https://wa.me/${intl}?text=${encodeURIComponent(this.texto(alerta))}`;
    },

    // Com um webhook configurado (WhatsApp Business API ou serviço equivalente),
    // envia automaticamente. Sem ele — ou se o serviço falhar — o alerta continua
    // no app e pode ser enviado manualmente; nada mais é bloqueado (RNF-07).
    async enviar(alerta) {
      const url = Store.state.config.whatsappWebhookUrl;
      const para = this.destinatarios();
      if (!url || !para.length) {
        Store.atualizarAlerta(alerta.id, { status: para.length ? "aguardando envio" : "sem destinatário" });
        return false;
      }
      if (!Store.online()) {
        Store.atualizarAlerta(alerta.id, { status: "aguardando conexão" });
        return false;
      }
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ destinatarios: para.map((u) => ({ nome: u.nome, telefone: u.telefone })), mensagem: this.texto(alerta), alertaId: alerta.id }),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        Store.atualizarAlerta(alerta.id, { status: "enviado", canal: "whatsapp", envios: para.map((u) => ({ usuarioId: u.id, em: new Date().toISOString() })) });
        return true;
      } catch (e) {
        Store.atualizarAlerta(alerta.id, { status: "falha no envio", erroEnvio: e.message });
        return false;
      }
    },

    // Reenvia o que ficou pendente por falta de conexão.
    async reenviarPendentes() {
      const pend = Store.alertasDaConta().filter((a) => a.status === "aguardando conexão" || a.status === "falha no envio");
      for (const a of pend) await this.enviar(a);
    },
  };

  root.Servicos = {
    catalogo,
    cultura,
    praga,
    buscarPraga,
    recomendacao,
    doseOcorrencia,
    comparacao,
    reajuste,
    custoSafra,
    verificarAplicacao,
    Clima,
    Mensageria,
    semAcento,
  };
})(typeof window !== "undefined" ? window : globalThis);
