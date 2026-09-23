// Telas de talhões (RF-01) e do cálculo de necessidade de insumos (RF-03) —
// o núcleo funcional do Rural Tracker.
(function (root) {
  const V = (root.Views = root.Views || {});
  const { esc, num, moeda, data, nomeFase, rotuloTalhao } = UI;

  /* ================================================================== */
  /* Lista de talhões                                                    */
  /* ================================================================== */

  V.talhoes = function (el) {
    App.setTitulo("Meus talhões", "Cadastre suas lavouras e acompanhe cada uma");
    const lista = Store.talhoes();

    if (!lista.length) {
      el.innerHTML = `<section class="card">${UI.emptyState(
        "leaf",
        "Você ainda não tem talhões cadastrados",
        "Comece cadastrando sua primeira lavoura: informe a área, o tipo de café, a fase e onde ela fica. Com isso o sistema já calcula o calcário e o adubo recomendados.",
        `<a class="btn btn-primary btn-lg" href="#/talhoes/novo">${Icon.plus()} Cadastrar talhão</a>`
      )}</section>`;
      return;
    }

    el.innerHTML = `
      <div class="toolbar">
        <p class="muted">${lista.length} talhão(ões) · ${num(lista.reduce((s, t) => s + t.areaHectares, 0), 1)} ha no total</p>
        <a class="btn btn-primary" href="#/talhoes/novo">${Icon.plus()} Novo talhão</a>
      </div>
      <div class="talhao-grid">
        ${lista.map(cardTalhao).join("")}
      </div>`;
  };

  function cardTalhao(t) {
    const safra = Store.safraAtiva(t.id);
    const ocorrencias = Store.ocorrenciasDaConta().filter((o) => o.talhaoId === t.id && !o.resolvida);
    const ultimaAp = Store.aplicacoesDaConta().find((a) => a.talhaoId === t.id);
    const alertas = Store.alertasDaConta().filter((a) => a.talhaoId === t.id && !["lido", "resolvido"].includes(a.status)).length;
    return `
      <article class="card talhao-card">
        <a class="talhao-card-head" href="#/talhoes/${t.id}">
          <div>
            <h2>${esc(t.nome)}</h2>
            <p class="muted">${esc(t.tipoCafe)} · ${esc(t.variedade || "")}</p>
          </div>
          ${alertas ? `<span class="badge sev-severa">${alertas} alerta(s)</span>` : ""}
        </a>
        <dl class="facts">
          <div><dt>Área</dt><dd>${num(t.areaHectares)} ha</dd></div>
          <div><dt>Fase</dt><dd>${esc(nomeFase(t))}</dd></div>
          <div><dt>Solo</dt><dd>${esc(t.tipoSolo || "—")}${t.laudo && t.laudo.ctc != null ? " · com laudo" : ""}</dd></div>
          <div><dt>Local</dt><dd>${esc(t.localizacao.cidade)} - ${esc(t.localizacao.uf)}</dd></div>
        </dl>
        <p class="talhao-card-status">
          ${safra ? `${Icon.calendar()} Safra desde ${data(safra.dataInicio)}` : `${Icon.info()} Nenhuma safra em andamento`}
          ${ultimaAp ? ` · última aplicação em ${data(ultimaAp.data)}` : ""}
          ${ocorrencias.length ? ` · <strong class="text-danger">${ocorrencias.length} praga(s)/doença(s) ativa(s)</strong>` : ""}
        </p>
        <div class="quick-actions">
          <a class="btn btn-primary" href="#/calculo/${t.id}">${Icon.calculator()} Calcular insumos</a>
          <a class="btn btn-soft" href="#/aplicacoes/nova?talhao=${t.id}">${Icon.droplet()} Registrar aplicação</a>
          <a class="btn btn-soft" href="#/pragas/declarar?talhao=${t.id}">${Icon.bug()} Declarar praga</a>
        </div>
      </article>`;
  }

  /* ================================================================== */
  /* Formulário de talhão                                                */
  /* ================================================================== */

  V.talhaoForm = function (el, [id]) {
    const t = id ? Store.talhao(id) : null;
    if (id && !t) return App.ir("#/talhoes");
    const c = CULTURAS.cafe;
    App.setTitulo(t ? `Editar ${t.nome}` : "Novo talhão", "Dados usados no cálculo de insumos e na consulta ao clima");
    const v = t || { tipoCafe: "Arábica", fase: "producao", plantasPorHa: 4000, localizacao: { cidade: "", uf: "MG" }, laudo: null };
    const l = v.laudo || {};
    const temLaudo = !!(v.laudo && v.laudo.ctc != null);

    el.innerHTML = `
      <form class="card form" id="talhaoForm" novalidate>
        <fieldset>
          <legend>Identificação</legend>
          <div class="form-grid">
            <label>Nome do talhão *<input name="nome" required value="${esc(v.nome || "")}" placeholder="Ex.: Talhão da Baixada" /></label>
            <label>Cultura<select name="cultura" disabled><option>${esc(c.nome)}</option></select>
              <small>Nesta versão o sistema atende apenas café.</small></label>
            <label>Tipo de café *<select name="tipoCafe">${UI.opcoes(c.tipos.map((x) => ({ value: x, label: x })), v.tipoCafe)}</select></label>
            <label>Variedade<input name="variedade" value="${esc(v.variedade || "")}" placeholder="Ex.: Catuaí Vermelho" /></label>
            <label>Área (hectares) *<input name="areaHectares" data-num inputmode="decimal" value="${v.areaHectares ?? ""}" placeholder="Ex.: 4,5" /></label>
            <label>Fase da lavoura *<select name="fase">${UI.opcoes(c.fases.map((f) => ({ value: f.id, label: f.nome })), v.fase)}</select></label>
            <label>Plantas por hectare<input name="plantasPorHa" data-num inputmode="numeric" value="${v.plantasPorHa ?? ""}" />
              <small>Usado na adubação de formação (gramas por planta).</small></label>
            <label>Produtividade esperada (sacas/ha)<input name="produtividadeEsperadaSacasHa" data-num inputmode="decimal" value="${v.produtividadeEsperadaSacasHa ?? ""}" />
              <small>Base para a adubação de produção.</small></label>
            <label class="check"><input type="checkbox" name="irrigado" ${v.irrigado ? "checked" : ""} /> Lavoura irrigada</label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Localização (para o clima)</legend>
          <div class="form-grid">
            <label>Cidade *<input name="cidade" value="${esc(v.localizacao.cidade)}" placeholder="Ex.: Poços de Caldas" /></label>
            <label>Estado *<select name="uf">${UI.opcoes(UFS.map((u) => ({ value: u, label: u })), v.localizacao.uf)}</select></label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Solo</legend>
          <p class="muted">Como é a terra deste talhão? (modo padrão de cálculo)</p>
          <div class="choice-grid">
            ${c.tiposSolo.map((s) => `
              <label class="choice">
                <input type="radio" name="tipoSolo" value="${esc(s.id)}" ${v.tipoSolo === s.id ? "checked" : ""} />
                <span class="choice-title">${esc(s.id)}</span>
                <span class="choice-help">${esc(s.ajuda)}</span>
              </label>`).join("")}
          </div>
          <details class="advanced" ${temLaudo ? "open" : ""}>
            <summary>Tenho laudo de análise de solo (modo avançado)</summary>
            <p class="muted">Com CTC e V1 preenchidos, o calcário é calculado pelo método de saturação por bases, mais preciso (RN-10).</p>
            <div class="form-grid">
              <label>CTC a pH 7 (cmolc/dm³)<input name="ctc" data-num inputmode="decimal" value="${l.ctc ?? ""}" /></label>
              <label>V1 — saturação por bases atual (%)<input name="v1" data-num inputmode="decimal" value="${l.v1 ?? ""}" /></label>
              <label>V2 — saturação desejada (%)<input name="v2" data-num inputmode="decimal" value="${l.v2 ?? Store.state.config.v2Padrao}" /><small>Para café: 60% a 70%.</small></label>
              <label>PRNT do calcário (%)<input name="prnt" data-num inputmode="decimal" value="${l.prnt ?? 80}" /><small>Vem escrito na embalagem.</small></label>
              <label>Forma de aplicação<select name="formaAplicacao">${UI.opcoes(OPCOES_FORMA, l.formaAplicacao || "incorporacaoA20cm")}</select></label>
              <label>Data do laudo<input type="date" name="dataLaudo" value="${esc(l.dataLaudo || "")}" max="${Store.hojeISO()}" /></label>
            </div>
          </details>
        </fieldset>

        ${t ? "" : `
        <fieldset>
          <legend>Safra atual</legend>
          <div class="form-grid">
            <label>Início da safra atual<input type="date" name="inicioSafra" value="${Store.hojeISO()}" max="${Store.hojeISO()}" />
              <small>As aplicações são ligadas à safra em andamento.</small></label>
          </div>
        </fieldset>`}

        <div class="form-actions">
          <a class="btn btn-ghost" href="${t ? `#/talhoes/${t.id}` : "#/talhoes"}">Cancelar</a>
          <button class="btn btn-primary btn-lg" type="submit">${Icon.check()} Salvar talhão</button>
        </div>
      </form>`;

    const form = el.querySelector("#talhaoForm");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const f = UI.lerForm(form);
      const salvo = UI.tentar(form, () => {
        const laudo = [f.ctc, f.v1].some((x) => x !== null)
          ? { ctc: f.ctc, v1: f.v1, v2: f.v2, prnt: f.prnt, formaAplicacao: f.formaAplicacao, dataLaudo: f.dataLaudo || null }
          : null;
        const dados = {
          id: t ? t.id : undefined,
          nome: f.nome,
          cultura: "cafe",
          tipoCafe: f.tipoCafe,
          variedade: f.variedade,
          areaHectares: f.areaHectares,
          fase: f.fase,
          plantasPorHa: f.plantasPorHa,
          produtividadeEsperadaSacasHa: f.produtividadeEsperadaSacasHa,
          irrigado: f.irrigado,
          tipoSolo: f.tipoSolo,
          localizacao: { ...(t ? t.localizacao : {}), cidade: f.cidade, uf: f.uf },
          laudo,
        };
        if (t && (t.localizacao.cidade !== f.cidade || t.localizacao.uf !== f.uf)) {
          delete dados.localizacao.lat; delete dados.localizacao.lon;
        }
        const novo = Store.salvarTalhao(dados);
        if (!t) Store.iniciarSafra(novo.id, { dataInicio: f.inicioSafra || Store.hojeISO(), produtividadeEsperadaSacasHa: f.produtividadeEsperadaSacasHa });
        return novo;
      });
      if (salvo) {
        UI.toast(t ? "Talhão atualizado." : "Talhão cadastrado! Veja agora a recomendação de insumos.");
        App.ir(t ? `#/talhoes/${salvo.id}` : `#/calculo/${salvo.id}`);
      }
    });
  };

  const OPCOES_FORMA = [
    { value: "aplicacaoSuperficialSemIncorporacao", label: "Na superfície, sem incorporar (fator 0,5)" },
    { value: "incorporacaoA20cm", label: "Incorporado até 20 cm (fator 1,0)" },
    { value: "incorporacaoA30cm", label: "Incorporado até 30 cm (fator 1,5)" },
  ];

  /* ================================================================== */
  /* Detalhe do talhão                                                   */
  /* ================================================================== */

  V.talhaoDetalhe = function (el, [id]) {
    const t = Store.talhao(id);
    if (!t) return App.ir("#/talhoes");
    App.setTitulo(rotuloTalhao(t), `${t.tipoCafe} · ${nomeFase(t)} · ${t.localizacao.cidade} - ${t.localizacao.uf}`);

    const safra = Store.safraAtiva(t.id);
    const comp = Servicos.comparacao(t, safra);
    const custo = Servicos.custoSafra(t, safra);
    const aps = Store.aplicacoesDaConta().filter((a) => a.talhaoId === t.id).slice(0, 6);
    const ocorr = Store.ocorrenciasDaConta().filter((o) => o.talhaoId === t.id);

    el.innerHTML = `
      <section class="card">
        <div class="detail-head">
          <dl class="facts facts-wide">
            <div><dt>Área</dt><dd>${num(t.areaHectares)} ha</dd></div>
            <div><dt>Tipo / variedade</dt><dd>${esc(t.tipoCafe)} · ${esc(t.variedade || "—")}</dd></div>
            <div><dt>Fase</dt><dd>${esc(nomeFase(t))}</dd></div>
            <div><dt>Solo</dt><dd>${esc(t.tipoSolo || "—")}</dd></div>
            <div><dt>Análise de solo</dt><dd>${t.laudo && t.laudo.ctc != null ? `CTC ${num(t.laudo.ctc)} · V1 ${num(t.laudo.v1)}%` : "Não informada"}</dd></div>
            <div><dt>Plantas/ha</dt><dd>${num(t.plantasPorHa, 0)}</dd></div>
            <div><dt>Irrigação</dt><dd>${t.irrigado ? "Sim" : "Não"}</dd></div>
            <div><dt>Produtividade esperada</dt><dd>${t.produtividadeEsperadaSacasHa ? `${num(t.produtividadeEsperadaSacasHa)} sc/ha` : "—"}</dd></div>
          </dl>
          <div class="quick-actions">
            <a class="btn btn-primary" href="#/calculo/${t.id}">${Icon.calculator()} Calcular insumos</a>
            <a class="btn btn-soft" href="#/aplicacoes/nova?talhao=${t.id}">${Icon.droplet()} Registrar aplicação</a>
            <a class="btn btn-soft" href="#/pragas/declarar?talhao=${t.id}">${Icon.bug()} Declarar praga</a>
            <a class="btn btn-ghost" href="#/talhoes/${t.id}/editar">${Icon.edit()} Editar</a>
            ${Store.ehProdutor() ? `<button class="btn btn-ghost btn-danger-text" id="excluirTalhao">${Icon.trash()} Excluir</button>` : ""}
          </div>
        </div>
      </section>

      <div class="grid-2">
        <section class="card">
          <div class="card-header"><h2>Safra atual</h2>
            <p class="card-subtitle">${safra ? `Desde ${data(safra.dataInicio)}${safra.dataColheitaPrevista ? ` · colheita prevista ${data(safra.dataColheitaPrevista)}` : ""}` : "Nenhuma safra em andamento"}</p></div>
          ${safra ? `
            <div class="mini-kpis">
              <div><span>Custo na safra</span><strong>${moeda(custo.total, 0)}</strong></div>
              <div><span>Custo por hectare</span><strong>${moeda(custo.porHa, 0)}/ha</strong></div>
              <div><span>Aplicações</span><strong>${Store.state.aplicacoes.filter((a) => a.safraId === safra.id).length}</strong></div>
            </div>
            <h3 class="section-title">Aplicado x recomendado</h3>
            ${comp.itens.length ? comp.itens.map(UI.ratioBar).join("") : `<p class="no-data-inline">${Icon.info()} Registre aplicações para comparar com o recomendado.</p>`}
            ${UI.footnote("Faixa adequada: 90% a 110% da dose recomendada. A marca na barra indica 100%.")}`
          : UI.emptyState("calendar", "Inicie uma safra", "É preciso ter uma safra em andamento para registrar aplicações.", `<a class="btn btn-soft" href="#/safras">Ir para safras</a>`)}
        </section>

        <section class="card" id="climaCard"></section>
      </div>

      <div class="grid-2">
        <section class="card" id="reajusteCard"></section>
        <section class="card">
          <div class="card-header"><h2>Pragas e doenças</h2><p class="card-subtitle">Ocorrências declaradas neste talhão</p></div>
          ${ocorr.length ? ocorr.map((o) => Views.itemOcorrencia(o, { compacto: true })).join("") : UI.emptyState("bug", "Nenhuma ocorrência declarada", "Se notar alguma praga ou doença, declare para receber a dose recomendada.")}
        </section>
      </div>

      <section class="card">
        <div class="card-header row-between"><div><h2>Últimas aplicações</h2></div><a class="btn btn-ghost" href="#/aplicacoes?talhao=${t.id}">Ver todas ${Icon.arrowRight()}</a></div>
        ${aps.length ? Views.tabelaAplicacoes(aps, { semTalhao: true }) : `<p class="no-data-inline">${Icon.info()} Nenhuma aplicação registrada ainda.</p>`}
      </section>`;

    Views.cardClima(el.querySelector("#climaCard"), t);
    Views.cardReajuste(el.querySelector("#reajusteCard"), t);

    const btn = el.querySelector("#excluirTalhao");
    if (btn) btn.onclick = async () => {
      const ok = await UI.confirmar(`Excluir <strong>${esc(t.nome)}</strong>? Todas as safras, aplicações e ocorrências dele também serão apagadas. Esta ação não pode ser desfeita.`, { textoOk: "Excluir talhão", perigo: true });
      if (!ok) return;
      try { Store.excluirTalhao(t.id); UI.toast("Talhão excluído."); App.ir("#/talhoes"); }
      catch (e) { UI.toast(e.message, "erro"); }
    };
  };

  /* ---------------- Card de clima (RF-08) ---------------- */

  V.cardClima = function (card, t, { compacto = false, carregando = false, erro = null } = {}) {
    const cache = Store.climaDo(t.id);
    const av = Calc.avaliarClima(cache, t.fase);
    const atualizado = cache ? `Atualizado em ${UI.dataHora(cache.atualizadoEm)} · ${esc(cache.fonte)}` : "Ainda sem dados de clima";

    card.innerHTML = `
      <div class="card-header row-between">
        <div><h2>Clima — ${esc(t.localizacao.cidade)}</h2><p class="card-subtitle">${atualizado}</p></div>
        <button class="btn btn-ghost" data-atualizar ${Store.online() ? "" : "disabled"}>${Icon.refresh()} Atualizar</button>
      </div>
      ${cache ? `
        ${cache.atual ? `<p class="clima-atual">${Icon.thermometer()} Agora: <strong>${num(cache.atual.temperatura, 1)} °C</strong> · umidade ${num(cache.atual.umidade, 0)}%</p>` : ""}
        ${compacto ? "" : `<div class="forecast">${cache.dias.map((d) => `
          <div class="forecast-day">
            <span class="fd-date">${esc(d.data.slice(0, 5))}</span>
            <span class="fd-temp">${num(d.tMin, 0)}° / ${num(d.tMax, 0)}°</span>
            <span class="fd-rain">${num(d.chuvaMm, 1)} mm</span>
          </div>`).join("")}</div>`}
        ${av.riscos.length ? av.riscos.map((r) => `<div class="risk risk-${r.tipo}">${r.tipo === "doenca" ? Icon.bug() : Icon.alertTriangle()}<span>${esc(r.mensagem)}</span></div>`).join("") : `<p class="no-data-inline">${Icon.checkCircle()} Nenhum risco climático relevante nos próximos 7 dias.</p>`}
        ${av.avisosAplicacao.map((a) => `<div class="tip">${Icon.cloudRain()}<span>${esc(a)}</span></div>`).join("")}
      ` : `<p class="no-data-inline">${Icon.info()} ${
        !Store.online() ? "Sem internet: a previsão será buscada quando a conexão voltar. O cálculo de insumos continua funcionando."
        : carregando ? "Buscando previsão do tempo…"
        : "Sem previsão do tempo por enquanto. O cálculo de insumos funciona normalmente sem ela."}</p>`}
      ${erro ? `<p class="no-data-inline text-danger">${Icon.alertTriangle()} Não foi possível consultar o clima: ${esc(erro)}</p>` : ""}`;

    const carregar = async (forcar) => {
      V.cardClima(card, t, { compacto, carregando: true });
      const b = card.querySelector("[data-atualizar]");
      if (b) { b.disabled = true; b.innerHTML = `${Icon.refresh()} Atualizando…`; }
      try {
        await Servicos.Clima.atualizar(Store.talhao(t.id) || t, { forcar });
        V.cardClima(card, Store.talhao(t.id) || t, { compacto });
        card.dispatchEvent(new CustomEvent("clima-atualizado", { bubbles: true }));
      } catch (e) {
        V.cardClima(card, t, { compacto, erro: e.message === "Failed to fetch" ? "serviço de clima fora do ar ou sem conexão." : e.message });
      }
    };
    if (carregando) return;
    card.querySelector("[data-atualizar]").onclick = () => carregar(true);
    // Busca automática no máximo a cada 5 min por talhão, mesmo que o card seja
    // redesenhado várias vezes (ex.: ao digitar no formulário de cálculo).
    const ultimaTentativa = tentativasClima[t.id] || 0;
    if (Store.online() && Servicos.Clima.precisaAtualizar(t.id) && Date.now() - ultimaTentativa > 5 * 60 * 1000) {
      tentativasClima[t.id] = Date.now();
      carregar(false);
    }
  };
  const tentativasClima = {};

  /* ---------------- Card de sugestão de reajuste (RF-09) ---------------- */

  V.cardReajuste = function (card, t) {
    const head = `<div class="card-header"><h2>Sugestão de reajuste</h2><p class="card-subtitle">Com base nas safras concluídas deste talhão</p></div>`;
    if (!Store.online()) {
      card.innerHTML = head + `<p class="no-data-inline">${Icon.wifiOff()} A sugestão de reajuste precisa de internet.</p>`;
      return;
    }
    const r = Servicos.reajuste(t);
    if (!r.disponivel) {
      card.innerHTML = head + UI.emptyState("sprout", "Ainda não há dados suficientes", `${esc(r.motivo)} Registre a colheita para receber sugestões (RN-05).`, `<a class="btn btn-soft" href="#/safras">Registrar colheita</a>`);
      return;
    }
    if (r.semAplicacoes) {
      card.innerHTML = head + `<p class="adjustment-text">${esc(r.justificativa)}</p>`;
      return;
    }
    const p = r.principal;
    const sinal = p.percentualAjuste > 0 ? "+" : "";
    const titulo = p.percentualAjuste === 0
      ? `Mantenha a dose de ${Calc.minusculaInicial(p.insumo)}`
      : `Sugerimos ${p.percentualAjuste < 0 ? "reduzir" : "aumentar"} em ${Math.abs(p.percentualAjuste)}% a dose de ${Calc.minusculaInicial(p.insumo)}`;
    card.innerHTML = head + `
      <div class="adjustment-hero">
        <span class="adjustment-badge ${p.percentualAjuste < 0 ? "is-down" : p.percentualAjuste > 0 ? "is-up" : ""}">${sinal}${p.percentualAjuste}%</span>
        <p class="adjustment-title">${titulo}</p>
      </div>
      <p class="adjustment-text">${esc(r.justificativa)}</p>
      <table class="table table-compact">
        <thead><tr><th>Nutriente</th><th>Aplicado (média)</th><th>Ajuste sugerido</th></tr></thead>
        <tbody>${r.ajustes.map((a) => `<tr><td>${esc(a.insumo)}</td><td>${a.pctAplicadoMedio}% do recomendado</td><td><strong>${a.percentualAjuste > 0 ? "+" : ""}${a.percentualAjuste}%</strong></td></tr>`).join("")}</tbody>
      </table>
      <p class="muted small">Considerou ${r.safrasConsideradas} safra(s) concluída(s). O percentual é aplicado sobre a dose que você usou.</p>
      ${UI.disclaimer()}`;
  };

  /* ================================================================== */
  /* Cálculo de necessidade de insumos (RF-03) — núcleo do sistema       */
  /* ================================================================== */

  V.calculo = function (el, [id]) {
    const lista = Store.talhoes();
    App.setTitulo("Calcular insumos", "Calcário, adubo e defensivos recomendados para o seu talhão");
    if (!lista.length) {
      el.innerHTML = `<section class="card">${UI.emptyState("calculator", "Cadastre um talhão primeiro", "O cálculo usa a área, a fase, o tipo de solo e a localização do talhão.", `<a class="btn btn-primary" href="#/talhoes/novo">${Icon.plus()} Cadastrar talhão</a>`)}</section>`;
      return;
    }
    const t = id ? Store.talhao(id) : null;
    if (!t) return App.ir(`#/calculo/${lista[0].id}`);

    const c = CULTURAS.cafe;
    const safra = Store.safraAtiva(t.id);
    const esperada = (safra && safra.produtividadeEsperadaSacasHa) || t.produtividadeEsperadaSacasHa;
    const l = t.laudo || {};
    const avancado = !!(t.laudo && t.laudo.ctc != null && t.laudo.v1 != null);

    el.innerHTML = `
      <div class="context-tabs" role="tablist" aria-label="Escolha o talhão">
        ${lista.map((x) => `<a class="context-tab ${x.id === t.id ? "is-active" : ""}" role="tab" aria-selected="${x.id === t.id}" href="#/calculo/${x.id}">${esc(rotuloTalhao(x))}</a>`).join("")}
      </div>

      <div class="calc-layout">
        <form class="card form calc-form" id="calcForm" novalidate>
          <div class="card-header"><h2>Dados do talhão</h2><p class="card-subtitle">Altere para simular. O resultado muda na hora.</p></div>
          <label>Área (ha)<input name="areaHectares" data-num inputmode="decimal" value="${t.areaHectares}" /></label>
          <label>Fase da lavoura<select name="fase">${UI.opcoes(c.fases.map((f) => ({ value: f.id, label: f.nome })), t.fase)}</select></label>
          <label data-show="producao">Produtividade esperada (sacas/ha)<input name="produtividadeEsperadaSacasHa" data-num inputmode="decimal" value="${esperada ?? ""}" /></label>
          <label data-show="formacao">Plantas por hectare<input name="plantasPorHa" data-num inputmode="numeric" value="${t.plantasPorHa ?? ""}" /></label>
          <label class="check"><input type="checkbox" name="irrigado" ${t.irrigado ? "checked" : ""} /> Lavoura irrigada</label>

          <div class="segmented" role="radiogroup" aria-label="Modo de cálculo do calcário">
            <label><input type="radio" name="modo" value="padrao" ${avancado ? "" : "checked"} /><span>Modo padrão<small>pelo tipo de solo</small></span></label>
            <label><input type="radio" name="modo" value="avancado" ${avancado ? "checked" : ""} /><span>Modo avançado<small>com análise de solo</small></span></label>
          </div>

          <div data-modo="padrao">
            <label>Tipo de solo<select name="tipoSolo">${UI.opcoes(c.tiposSolo.map((s) => ({ value: s.id, label: `${s.id} — ${s.ajuda}` })), t.tipoSolo, { vazio: "Selecione" })}</select></label>
          </div>
          <div data-modo="avancado">
            <div class="form-grid form-grid-2">
              <label>CTC (cmolc/dm³)<input name="ctc" data-num inputmode="decimal" value="${l.ctc ?? ""}" /></label>
              <label>V1 atual (%)<input name="v1" data-num inputmode="decimal" value="${l.v1 ?? ""}" /></label>
              <label>V2 desejada (%)<input name="v2" data-num inputmode="decimal" value="${l.v2 ?? Store.state.config.v2Padrao}" /></label>
              <label>PRNT (%)<input name="prnt" data-num inputmode="decimal" value="${l.prnt ?? 80}" /></label>
            </div>
            <label>Forma de aplicação<select name="formaAplicacao">${UI.opcoes(OPCOES_FORMA, l.formaAplicacao || "incorporacaoA20cm")}</select></label>
            <label>Tipo de solo (reserva)<select name="tipoSoloAv">${UI.opcoes(c.tiposSolo.map((s) => ({ value: s.id, label: s.id })), t.tipoSolo, { vazio: "Selecione" })}</select>
              <small>Usado se CTC ou V1 ficarem em branco (RN-10).</small></label>
          </div>

          <div class="form-actions">
            <button class="btn btn-soft" type="submit">${Icon.check()} Salvar estes dados no talhão</button>
          </div>
        </form>

        <div class="calc-results" id="calcResults"></div>
      </div>`;

    const form = el.querySelector("#calcForm");
    const out = el.querySelector("#calcResults");

    const talhaoSimulado = () => {
      const f = UI.lerForm(form);
      const modo = f.modo;
      const sim = {
        ...t,
        areaHectares: f.areaHectares > 0 ? f.areaHectares : t.areaHectares,
        fase: f.fase,
        produtividadeEsperadaSacasHa: f.produtividadeEsperadaSacasHa,
        plantasPorHa: f.plantasPorHa,
        irrigado: f.irrigado,
        tipoSolo: modo === "avancado" ? f.tipoSoloAv || t.tipoSolo : f.tipoSolo,
        laudo: modo === "avancado" ? { ...l, ctc: f.ctc, v1: f.v1, v2: f.v2, prnt: f.prnt, formaAplicacao: f.formaAplicacao } : t.laudo,
      };
      return { sim, modo, f };
    };

    const atualizarVisibilidade = () => {
      const { f, modo } = talhaoSimulado();
      form.querySelector('[data-show="producao"]').hidden = f.fase !== "producao";
      form.querySelector('[data-show="formacao"]').hidden = !String(f.fase).startsWith("formacao");
      form.querySelector('[data-modo="padrao"]').hidden = modo !== "padrao";
      form.querySelector('[data-modo="avancado"]').hidden = modo !== "avancado";
    };

    const recalcular = () => {
      atualizarVisibilidade();
      const { sim, modo } = talhaoSimulado();
      // No modo padrão, ignoramos o laudo mesmo que exista (escolha explícita do usuário).
      const alvo = modo === "padrao" ? { ...sim, laudo: null } : sim;
      renderResultados(out, alvo, t, modo);
    };

    form.addEventListener("input", recalcular);
    form.addEventListener("change", recalcular);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const { sim, modo } = talhaoSimulado();
      const ok = UI.tentar(form, () => {
        const dados = { ...sim };
        if (modo === "padrao") dados.laudo = t.laudo; // não apaga um laudo salvo
        else if (sim.laudo.ctc == null && sim.laudo.v1 == null) dados.laudo = null;
        Store.salvarTalhao(dados);
        const s = Store.safraAtiva(t.id);
        if (s && sim.fase === "producao" && sim.produtividadeEsperadaSacasHa) {
          s.produtividadeEsperadaSacasHa = sim.produtividadeEsperadaSacasHa;
          Store.save();
        }
        return true;
      });
      if (ok) { UI.toast("Dados do talhão salvos."); App.render(); }
    });
    out.addEventListener("clima-atualizado", recalcular);
    recalcular();
  };

  function renderResultados(out, sim, original, modo) {
    const cat = Servicos.catalogo();
    const cal = Calc.calcularCalagem(sim, cat, Store.state.config);
    const safra = Store.safraAtiva(original.id);
    const adu = Calc.calcularAdubacao(sim, cat, sim.produtividadeEsperadaSacasHa);
    const precos = Store.precos();
    const calcario = cat.corretivos[0];
    const precoCalc = precos[calcario.id] ?? calcario.precoReferencia.valor;

    // RF-04 — compara com o que já foi aplicado na safra atual.
    const aplicado = safra
      ? Calc.compararSafra({ talhao: sim, safra, aplicacoes: Store.state.aplicacoes, recomendacao: { calagem: cal, adubacao: adu }, catalogo: cat })
      : { itens: [] };
    const compDe = (categoria) => aplicado.itens.filter((i) => i.categoria === categoria);
    const ultima = (categoria) => Store.aplicacoesDaConta().find((a) => a.talhaoId === original.id && a.categoria === categoria);

    const avisoModo = modo === "avancado" && cal.metodo !== "saturacao"
      ? `<div class="tip">${Icon.info()}<span>CTC e V1 não foram preenchidos, então o cálculo usou o <strong>modo padrão</strong> por tipo de solo (RN-10).</span></div>`
      : modo === "padrao" && cal.metodo === "simplificado"
        ? `<div class="tip">${Icon.info()}<span>Tem análise de solo? Use o <strong>modo avançado</strong> para um cálculo mais preciso.</span></div>`
        : "";

    const ocorr = Store.ocorrenciasDaConta().filter((o) => o.talhaoId === original.id && !o.resolvida);

    out.innerHTML = `
      <section class="card result-card">
        <div class="card-header row-between">
          <div><h2>1. Calcário (correção do solo)</h2><p class="card-subtitle">${esc(cal.nomeMetodo || "")}</p></div>
          <span class="badge ${cal.modo === "avancado" ? "badge-oficial" : "badge-neutral"}">${cal.modo === "avancado" ? "Modo avançado" : "Modo padrão"}</span>
        </div>
        ${cal.metodo === "indisponivel" ? `<p class="no-data-inline">${Icon.info()} ${esc(cal.motivo)}</p>` : `
          <div class="big-result">
            <div><span class="big-number">${num(cal.doseTHa)}</span><span class="big-unit">t/ha</span></div>
            <div class="big-side">
              <p>Total para ${num(sim.areaHectares)} ha: <strong>${num(cal.totalT)} toneladas</strong></p>
              <p>Custo estimado: <strong>${precoCalc != null ? moeda(cal.totalT * precoCalc) : "—"}</strong> <span class="muted">(${moeda(precoCalc)}/t)</span></p>
            </div>
          </div>
          ${!cal.necessario ? `<div class="tip">${Icon.checkCircle()}<span>A saturação por bases já está no nível desejado: não é preciso aplicar calcário agora.</span></div>` : ""}
          ${avisoModo}
          ${compDe("corretivo").map(UI.ratioBar).join("") || (ultima("corretivo") ? `<p class="muted small">Última aplicação de calcário: ${data(ultima("corretivo").data)} (safra anterior).</p>` : "")}
          <details class="memoria"><summary>Ver como foi calculado</summary><ul>${cal.memoria.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>
            ${cal.observacao ? `<p class="muted small">${esc(cal.observacao)}</p>` : ""}<p class="muted small">Fonte: ${esc(cal.fonte)}</p></details>`}
      </section>

      <section class="card result-card">
        <div class="card-header"><h2>2. Adubação (NPK)</h2><p class="card-subtitle">${esc(adu.nomeMetodo || "")}</p></div>
        ${adu.tipo === "indisponivel" ? `<p class="no-data-inline">${Icon.info()} ${esc(adu.motivo)}</p>` : `
          ${adu.tipo === "formacao" ? `
            <div class="big-result">
              <div><span class="big-number">${num(adu.gramasPorPlanta, 0)}</span><span class="big-unit">g/planta</span></div>
              <div class="big-side">
                <p>Adubo <strong>${esc(adu.formulacao)}</strong>: ${num(adu.produtoKgHa, 1)} kg/ha</p>
                <p>Total para ${num(sim.areaHectares)} ha: <strong>${num(adu.produtoTotalKg, 0)} kg</strong> (dividir em várias aplicações)</p>
              </div>
            </div>` : ""}
          <table class="table nutrient-table">
            <thead><tr><th>Nutriente</th><th>Por hectare</th><th>Total no talhão</th></tr></thead>
            <tbody>
              <tr><td>Nitrogênio (N)</td><td>${num(adu.porHa.N, 1)} kg</td><td>${num(adu.total.N, 0)} kg</td></tr>
              <tr><td>Fósforo (P₂O₅)</td><td>${num(adu.porHa.P2O5, 1)} kg</td><td>${num(adu.total.P2O5, 0)} kg</td></tr>
              <tr><td>Potássio (K₂O)</td><td>${num(adu.porHa.K2O, 1)} kg</td><td>${num(adu.total.K2O, 0)} kg</td></tr>
            </tbody>
          </table>
          ${adu.observacao ? `<div class="tip">${Icon.droplet()}<span>${esc(adu.observacao)} O cálculo já considera +50%.</span></div>` : ""}
          ${compDe("fertilizante").length ? `<h3 class="section-title">Já aplicado nesta safra</h3>${compDe("fertilizante").map(UI.ratioBar).join("")}` : ""}
          <details class="memoria"><summary>Ver como foi calculado</summary><ul>${adu.memoria.map((m) => `<li>${esc(m)}</li>`).join("")}</ul><p class="muted small">Fonte: ${esc(adu.fonte)}</p></details>`}
      </section>

      <section class="card result-card">
        <div class="card-header row-between"><div><h2>3. Defensivos</h2><p class="card-subtitle">Para as pragas e doenças declaradas neste talhão</p></div>
          <a class="btn btn-soft" href="#/pragas/declarar?talhao=${original.id}">${Icon.bug()} Declarar praga</a></div>
        ${ocorr.length ? ocorr.map((o) => Views.resumoDose(o, sim)).join("") : `<p class="no-data-inline">${Icon.checkCircle()} Nenhuma praga ou doença ativa declarada. Se notar algo, declare para receber a dose.</p>`}
      </section>

      <section class="card result-card" id="calcClima"></section>

      ${UI.disclaimer()}`;

    V.cardClima(out.querySelector("#calcClima"), original, { compacto: false });
  }
})(window);
