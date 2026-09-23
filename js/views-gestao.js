// Telas de gestão: painel (RF-14), alertas (RF-15/16), relatórios (RF-17),
// catálogo técnico (RF-18), equipe (RF-06), conta (RF-05/LGPD), administração
// (RNF-06) e acesso (login/cadastro).
(function (root) {
  const V = (root.Views = root.Views || {});
  const { esc, num, moeda, data, rotuloTalhao, nomeFase } = UI;

  /* ================================================================== */
  /* Painel de indicadores (RF-14)                                       */
  /* ================================================================== */

  let contextoPainel = "geral";

  function kpi({ label, value, delta, icon, alerta }) {
    return `
      <div class="kpi-card ${alerta ? "is-alert" : ""}">
        <div class="kpi-top"><span class="kpi-label">${label}</span><span class="kpi-icon">${Icon[icon]()}</span></div>
        <div class="kpi-value">${value}</div>
        ${delta ? `<div class="kpi-delta ${delta.dir || "neutral"}">${delta.text}</div>` : ""}
      </div>`;
  }

  function ultimaColheita(t) {
    const c = Store.safrasDo(t.id).filter((s) => s.colheita);
    return { ultima: c[c.length - 1], penultima: c[c.length - 2], todas: c };
  }

  function sparkline(values) {
    const w = 260, h = 56, pad = 6;
    const max = Math.max(...values) * 1.1, min = Math.min(...values) * 0.9;
    const stepX = (w - pad * 2) / Math.max(values.length - 1, 1);
    const pts = values.map((v, i) => [pad + i * stepX, h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2)]);
    return `<svg width="100%" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Produtividade por safra">
      <polyline points="${pts.map((p) => p.join(",")).join(" ")}" fill="none" stroke="var(--verde-medio)" stroke-width="2" stroke-linejoin="round"/>
      ${pts.map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="var(--verde-medio)"/>`).join("")}</svg>`;
  }

  V.painel = function (el) {
    App.setTitulo("Painel geral", "Visão consolidada da propriedade e dos talhões");
    if (App.exigeConexao(el, "O painel de indicadores")) return;
    const talhoes = Store.talhoes();
    if (!talhoes.length) {
      el.innerHTML = `<section class="card">${UI.emptyState("layers", "Sem dados para exibir", "Cadastre talhões e registre aplicações para ver os indicadores.", `<a class="btn btn-primary" href="#/talhoes/novo">Cadastrar talhão</a>`)}</section>`;
      return;
    }
    if (contextoPainel !== "geral" && !Store.talhao(contextoPainel)) contextoPainel = "geral";

    const dados = talhoes.map((t) => {
      const safra = Store.safraAtiva(t.id);
      return { t, safra, comp: Servicos.comparacao(t, safra), custo: Servicos.custoSafra(t, safra), colheitas: ultimaColheita(t) };
    });
    const alertasAtivos = Store.alertasDaConta().filter((a) => !["lido", "resolvido"].includes(a.status));
    const sel = dados.find((d) => d.t.id === contextoPainel);

    let kpis;
    if (!sel) {
      const area = talhoes.reduce((s, t) => s + t.areaHectares, 0);
      const custoTotal = dados.reduce((s, d) => s + d.custo.total, 0);
      const prods = dados.map((d) => d.colheitas.ultima && d.colheitas.ultima.colheita.produtividadeSacasHa).filter((v) => v != null);
      const pcts = dados.map((d) => d.comp.pctMedio).filter((v) => v != null);
      const pctMedio = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null;
      const comAlerta = new Set(alertasAtivos.map((a) => a.talhaoId)).size;
      kpis = [
        kpi({ label: "Custo médio por hectare", value: `${moeda(custoTotal / area, 0)}/ha`, delta: { text: `Safra atual · ${num(area, 1)} ha` }, icon: "leaf" }),
        kpi({ label: "Produtividade média", value: prods.length ? `${num(prods.reduce((a, b) => a + b, 0) / prods.length, 1)} sc/ha` : "—", delta: { text: prods.length ? "Última colheita de cada talhão" : "Nenhuma colheita registrada" }, icon: "sprout" }),
        kpi({ label: "Aplicado vs. recomendado", value: pctMedio != null ? `${pctMedio}%` : "—", delta: { text: pctMedio != null ? "Média dos insumos já comparáveis" : "Aguardando aplicações" }, icon: "droplet", alerta: pctMedio != null && (pctMedio < 90 || pctMedio > 110) }),
        kpi({ label: "Talhões com alerta ativo", value: String(comAlerta), delta: { dir: comAlerta ? "down" : "neutral", text: comAlerta ? "Requer atenção" : "Tudo dentro do esperado" }, icon: "alertTriangle", alerta: comAlerta > 0 }),
      ];
    } else {
      const { ultima, penultima } = sel.colheitas;
      let delta = { text: ultima ? "Primeira safra registrada" : "Sem colheita registrada" };
      if (ultima && penultima) {
        const v = ((ultima.colheita.produtividadeSacasHa - penultima.colheita.produtividadeSacasHa) / penultima.colheita.produtividadeSacasHa) * 100;
        delta = { dir: v >= 0 ? "up" : "down", text: `${v >= 0 ? "+" : ""}${num(v, 1)}% vs. safra anterior` };
      }
      const pct = sel.comp.pctMedio;
      const alertasT = alertasAtivos.filter((a) => a.talhaoId === sel.t.id).length;
      kpis = [
        kpi({ label: "Custo por hectare", value: `${moeda(sel.custo.porHa, 0)}/ha`, delta: { text: `Safra atual · ${num(sel.t.areaHectares)} ha` }, icon: "leaf" }),
        kpi({ label: "Produtividade da última safra", value: ultima ? `${num(ultima.colheita.produtividadeSacasHa)} sc/ha` : "—", delta, icon: "sprout" }),
        kpi({ label: "Aplicado vs. recomendado", value: pct != null ? `${pct}%` : "—", delta: { dir: pct == null ? "neutral" : pct >= 90 && pct <= 110 ? "up" : "down", text: pct == null ? "Aguardando aplicações" : pct >= 90 && pct <= 110 ? "Dentro da faixa" : pct > 110 ? `${pct - 100}% acima` : `${100 - pct}% abaixo` }, icon: "droplet", alerta: pct != null && (pct < 90 || pct > 110) }),
        kpi({ label: "Alertas ativos", value: String(alertasT), delta: { dir: alertasT ? "down" : "neutral", text: alertasT ? "Veja em Alertas" : "Sem alertas" }, icon: "alertTriangle", alerta: alertasT > 0 }),
      ];
    }

    const compararHtml = sel
      ? sel.comp.itens.length ? sel.comp.itens.map(UI.ratioBar).join("") : `<p class="no-data-inline">${Icon.info()} Nenhuma aplicação comparável na safra atual.</p>`
      : dados.map((d) => d.comp.pctMedio != null
          ? UI.ratioBar({ insumo: rotuloTalhao(d.t), aplicado: d.comp.pctMedio, recomendado: 100, unidade: "%", pct: d.comp.pctMedio, desvio: d.comp.pctMedio - 100, status: d.comp.pctMedio > 110 ? "excesso" : d.comp.pctMedio < 90 ? "deficiencia" : "ok" })
          : `<div class="compare-row"><div class="compare-row-head"><span class="name">${esc(rotuloTalhao(d.t))}</span></div><p class="no-data-inline">${Icon.info()} Sem aplicações comparáveis ainda.</p></div>`).join("");

    const produtividadeHtml = sel
      ? (() => {
          const vals = sel.colheitas.todas.map((s) => s.colheita.produtividadeSacasHa);
          return vals.length >= 2
            ? `${sparkline(vals)}<div class="sparkline-points">${sel.colheitas.todas.map((s) => `<span>${s.dataInicio.slice(0, 4)}: ${num(s.colheita.produtividadeSacasHa)} sc/ha</span>`).join("")}</div>`
            : `<p class="no-data-inline">${Icon.info()} ${vals.length ? `Uma safra registrada (${num(vals[0])} sc/ha).` : "Nenhuma colheita registrada."} O histórico aparece a partir da segunda colheita.</p>`;
        })()
      : `<div class="table-wrap"><table class="table table-compact"><thead><tr><th>Talhão</th><th>Safras</th><th>Última</th><th>Média</th></tr></thead><tbody>
          ${dados.map((d) => {
            const v = d.colheitas.todas.map((s) => s.colheita.produtividadeSacasHa);
            return `<tr><td>${esc(rotuloTalhao(d.t))}</td><td>${v.length}</td><td>${v.length ? `${num(v[v.length - 1])} sc/ha` : "—"}</td><td>${v.length ? `${num(v.reduce((a, b) => a + b, 0) / v.length, 1)} sc/ha` : "—"}</td></tr>`;
          }).join("")}</tbody></table></div>`;

    const ocorr = Store.ocorrenciasDaConta().filter((o) => !o.resolvida && (!sel || o.talhaoId === sel.t.id));

    el.innerHTML = `
      <div class="context-tabs" role="tablist">
        <button class="context-tab ${!sel ? "is-active" : ""}" data-ctx="geral">Propriedade</button>
        ${talhoes.map((t) => `<button class="context-tab ${sel && sel.t.id === t.id ? "is-active" : ""}" data-ctx="${t.id}">${esc(rotuloTalhao(t))}</button>`).join("")}
      </div>
      <section class="kpi-grid">${kpis.join("")}</section>
      <div class="grid-2">
        <section class="card"><div class="card-header"><h2>Aplicado vs. recomendado</h2><p class="card-subtitle">${sel ? "Insumos da safra atual" : "% médio da dose recomendada, por talhão"}</p></div>
          ${compararHtml}${UI.footnote("Faixa adequada: 90% a 110% da dose recomendada pela fonte técnica de referência.")}</section>
        <section class="card"><div class="card-header"><h2>Produtividade por safra</h2><p class="card-subtitle">${sel ? `${esc(nomeFase(sel.t))}${sel.safra ? ` · safra desde ${data(sel.safra.dataInicio)}` : ""}` : "Resumo por talhão"}</p></div>
          ${produtividadeHtml}</section>
      </div>
      <div class="grid-2">
        <section class="card" id="painelReajuste"></section>
        <section class="card"><div class="card-header"><h2>Pragas e doenças ativas</h2></div>
          ${ocorr.length ? ocorr.slice(0, 4).map((o) => V.itemOcorrencia(o, { compacto: !!sel })).join("") : `<p class="no-data-inline">${Icon.checkCircle()} Nenhuma ocorrência ativa.</p>`}</section>
      </div>
      <section class="card"><div class="card-header row-between"><div><h2>Alertas recentes</h2></div><a class="btn btn-ghost" href="#/alertas">Ver todos ${Icon.arrowRight()}</a></div>
        ${alertasAtivos.filter((a) => !sel || a.talhaoId === sel.t.id).slice(0, 4).map(itemAlerta).join("") || `<p class="no-data-inline">${Icon.checkCircle()} Nenhum alerta ativo.</p>`}</section>`;

    const reaj = el.querySelector("#painelReajuste");
    if (sel) V.cardReajuste(reaj, sel.t);
    else {
      reaj.innerHTML = `<div class="card-header"><h2>Sugestões de reajuste</h2><p class="card-subtitle">Geradas a partir das safras concluídas</p></div>` +
        dados.map((d) => {
          const r = Servicos.reajuste(d.t);
          const p = r.principal;
          return `<div class="compare-row"><div class="compare-row-head"><span class="name">${esc(rotuloTalhao(d.t))}</span>
            <span class="values">${p ? `${p.percentualAjuste > 0 ? "+" : ""}${p.percentualAjuste}% em ${esc(p.insumo)}` : ""}</span></div>
            ${p ? "" : `<p class="no-data-inline">${Icon.info()} ${r.disponivel ? "Sem aplicações registradas nas safras concluídas." : "Aguardando a primeira safra concluída."}</p>`}</div>`;
        }).join("") + UI.disclaimer();
    }

    el.querySelectorAll("[data-ctx]").forEach((b) => b.addEventListener("click", () => { contextoPainel = b.dataset.ctx; V.painel(el); }));
  };

  /* ================================================================== */
  /* Alertas (RF-15, RF-16)                                              */
  /* ================================================================== */

  function itemAlerta(a, { acoes = false } = {}) {
    const t = Store.talhao(a.talhaoId);
    const destinatarios = acoes ? Servicos.Mensageria.destinatarios() : [];
    return `
      <div class="alert-item ${["lido", "resolvido"].includes(a.status) ? "is-read" : ""}">
        <span class="alert-icon tipo-${a.tipo}">${a.tipo === "clima" ? Icon.cloudRain() : Icon.alertTriangle()}</span>
        <div class="alert-body">
          <p class="alert-desc">${esc(a.descricao)}</p>
          <div class="alert-meta">
            <span>${t ? esc(rotuloTalhao(t)) : ""}</span>
            <span>${UI.dataHora(a.dataGeracao)}</span>
            <span class="channel-chip ${a.canal === "whatsapp" ? "channel-whatsapp" : ""}">${a.canal === "whatsapp" ? Icon.whatsapp() : Icon.bell()} ${a.canal === "whatsapp" ? "WhatsApp" : "No app"}</span>
            <span class="status-chip">· ${esc(a.status)}</span>
          </div>
          ${acoes ? `<div class="quick-actions">
            ${destinatarios.map((u) => `<a class="btn btn-whatsapp" target="_blank" rel="noopener" href="${Servicos.Mensageria.linkWhatsApp(u.telefone, a)}" data-wa="${a.id}">${Icon.whatsapp()} Enviar para ${esc(u.nome.split(" ")[0])}</a>`).join("")}
            ${a.status !== "lido" && a.status !== "resolvido" ? `<button class="btn btn-ghost" data-lido="${a.id}">${Icon.check()} Marcar como lido</button>` : ""}
          </div>` : ""}
        </div>
      </div>`;
  }

  V.alertas = function (el) {
    App.setTitulo("Alertas", "Aplicações fora da faixa e riscos de clima");
    if (App.exigeConexao(el, "A central de alertas")) return;
    const lista = Store.alertasDaConta();
    const webhook = !!Store.state.config.whatsappWebhookUrl;
    el.innerHTML = `
      <div class="toolbar">
        <p class="muted">${webhook ? "Envio automático via WhatsApp ativo." : "Envio automático via WhatsApp não configurado — use os botões verdes para enviar pelo seu WhatsApp."}</p>
        <button class="btn btn-soft" id="verificarClima">${Icon.refresh()} Verificar clima agora</button>
      </div>
      <section class="card">
        ${lista.length ? lista.map((a) => itemAlerta(a, { acoes: true })).join("") : UI.emptyState("bell", "Nenhum alerta", "Alertas aparecem quando uma aplicação fica muito fora do recomendado ou quando a previsão indica geada, seca ou chuva excessiva.")}
      </section>`;
    el.querySelectorAll("[data-lido]").forEach((b) => b.addEventListener("click", () => { Store.atualizarAlerta(b.dataset.lido, { status: "lido" }); App.render(); }));
    el.querySelectorAll("[data-wa]").forEach((b) => b.addEventListener("click", () => Store.atualizarAlerta(b.dataset.wa, { status: "enviado", canal: "whatsapp" })));
    el.querySelector("#verificarClima").onclick = async (e) => {
      e.target.disabled = true;
      let erros = 0;
      for (const t of Store.talhoes()) {
        try { await Servicos.Clima.atualizar(t, { forcar: true }); } catch (err) { erros++; }
      }
      UI.toast(erros ? `Não foi possível consultar o clima de ${erros} talhão(ões).` : "Previsão atualizada para todos os talhões.", erros ? "erro" : "ok");
      App.render();
    };
  };

  /* ================================================================== */
  /* Relatórios (RF-17)                                                  */
  /* ================================================================== */

  const rotuloSafra = (s) => `${s.dataInicio.slice(0, 4)}/${String(Number(s.dataInicio.slice(0, 4)) + 1).slice(2)}`;

  function montarRelatorio(tipo, valor) {
    const talhoes = Store.talhoes();
    const aps = Store.aplicacoesDaConta();
    return talhoes.map((t) => {
      let doPeriodo, safra = null;
      if (tipo === "mensal") {
        doPeriodo = aps.filter((a) => a.talhaoId === t.id && a.data.slice(0, 7) === valor);
      } else {
        safra = Store.safrasDo(t.id).find((s) => rotuloSafra(s) === valor) || null;
        doPeriodo = safra ? aps.filter((a) => a.safraId === safra.id) : [];
      }
      const insumos = {};
      doPeriodo.forEach((a) => {
        const k = `${a.nomeProduto}|${a.unidade}`;
        insumos[k] = insumos[k] || { nome: a.nomeProduto, unidade: a.unidade, quantidade: 0, custo: 0, categoria: a.categoria };
        insumos[k].quantidade += a.quantidade;
        insumos[k].custo += a.custo || 0;
      });
      const custo = doPeriodo.reduce((s, a) => s + (a.custo || 0), 0);
      return { t, safra, aplicacoes: doPeriodo.sort((a, b) => a.data.localeCompare(b.data)), insumos: Object.values(insumos), custo, custoHa: custo / t.areaHectares };
    });
  }

  function csv(rel, tipo, valor) {
    const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const n = (v) => (typeof v === "number" ? v.toFixed(2).replace(".", ",") : "");
    const linhas = [
      [q("Rural Tracker — Relatório " + (tipo === "mensal" ? `mensal ${valor}` : `da safra ${valor}`))],
      [],
      ["Talhão", "Área (ha)", "Aplicações", "Custo total (R$)", "Custo por ha (R$)", "Produtividade (sc/ha)"].map(q),
      ...rel.map((r) => [q(rotuloTalhao(r.t)), n(r.t.areaHectares), r.aplicacoes.length, n(r.custo), n(r.custoHa), r.safra && r.safra.colheita ? n(r.safra.colheita.produtividadeSacasHa) : ""]),
      [],
      ["Data", "Talhão", "Categoria", "Insumo", "Quantidade", "Unidade", "Quantidade/ha", "Custo (R$)"].map(q),
      ...rel.flatMap((r) => r.aplicacoes.map((a) => [q(data(a.data)), q(r.t.nome), q(a.categoria), q(a.nomeProduto), n(a.quantidade), q(a.unidade), n(a.quantidade / r.t.areaHectares), n(a.custo)])),
    ];
    return "﻿" + linhas.map((l) => l.join(";")).join("\r\n");
  }

  V.relatorios = function (el, _p, q) {
    App.setTitulo("Relatórios", "Custos e uso de insumos por talhão");
    const tipo = q.tipo === "safra" ? "safra" : "mensal";
    const safrasRotulos = [...new Set(Store.talhoes().flatMap((t) => Store.safrasDo(t.id).map(rotuloSafra)))].sort().reverse();
    const valor = q.valor || (tipo === "mensal" ? Store.hojeISO().slice(0, 7) : safrasRotulos[0]);
    const rel = valor ? montarRelatorio(tipo, valor) : [];
    const totalCusto = rel.reduce((s, r) => s + r.custo, 0);
    const totalArea = rel.reduce((s, r) => s + r.t.areaHectares, 0);

    el.innerHTML = `
      <form class="card form toolbar-form no-print" id="relForm">
        <label>Período<select name="tipo"><option value="mensal" ${tipo === "mensal" ? "selected" : ""}>Mensal</option><option value="safra" ${tipo === "safra" ? "selected" : ""}>Por safra</option></select></label>
        ${tipo === "mensal"
          ? `<label>Mês<input type="month" name="valor" value="${esc(valor)}" max="${Store.hojeISO().slice(0, 7)}" /></label>`
          : `<label>Safra<select name="valor">${UI.opcoes(safrasRotulos.map((s) => ({ value: s, label: s })), valor)}</select></label>`}
        <button class="btn btn-soft" type="submit">Gerar</button>
        <span class="spacer"></span>
        <button class="btn btn-ghost" type="button" id="baixarCsv">${Icon.download()} Baixar planilha (CSV)</button>
        <button class="btn btn-ghost" type="button" id="imprimir">${Icon.printer()} Imprimir / PDF</button>
      </form>

      <section class="card print-area">
        <div class="card-header"><h2>Relatório ${tipo === "mensal" ? `mensal — ${esc(valor.split("-").reverse().join("/"))}` : `da safra ${esc(valor)}`}</h2>
          <p class="card-subtitle">${esc(Store.usuarioAtual().nome)} · gerado em ${UI.dataHora(new Date().toISOString())}</p></div>
        <div class="mini-kpis">
          <div><span>Custo total</span><strong>${moeda(totalCusto)}</strong></div>
          <div><span>Custo médio por hectare</span><strong>${moeda(totalArea ? totalCusto / totalArea : 0)}/ha</strong></div>
          <div><span>Aplicações</span><strong>${rel.reduce((s, r) => s + r.aplicacoes.length, 0)}</strong></div>
        </div>
        ${rel.map((r) => `
          <div class="report-block">
            <h3>${esc(rotuloTalhao(r.t))} <span class="muted small">· ${num(r.t.areaHectares)} ha${r.safra && r.safra.colheita ? ` · colheita: ${num(r.safra.colheita.produtividadeSacasHa)} sc/ha` : ""}</span></h3>
            ${r.insumos.length ? `<div class="table-wrap"><table class="table table-compact">
              <thead><tr><th>Insumo</th><th>Quantidade</th><th>Por hectare</th><th>Custo</th></tr></thead>
              <tbody>${r.insumos.map((i) => `<tr><td>${esc(i.nome)}</td><td>${num(i.quantidade)} ${esc(i.unidade)}</td><td>${num(i.quantidade / r.t.areaHectares)} ${esc(i.unidade)}/ha</td><td>${moeda(i.custo)}</td></tr>`).join("")}</tbody>
              <tfoot><tr><td colspan="3">Total do talhão</td><td><strong>${moeda(r.custo)}</strong> (${moeda(r.custoHa)}/ha)</td></tr></tfoot>
            </table></div>` : `<p class="muted">Nenhuma aplicação no período.</p>`}
          </div>`).join("")}
      </section>`;

    const form = el.querySelector("#relForm");
    form.addEventListener("submit", (e) => { e.preventDefault(); const f = UI.lerForm(form); App.ir(`#/relatorios?tipo=${f.tipo}&valor=${encodeURIComponent(f.valor || "")}`); });
    form.querySelector('[name="tipo"]').onchange = (e) => App.ir(`#/relatorios?tipo=${e.target.value}`);
    el.querySelector("#baixarCsv").onclick = () => UI.baixar(`ruraltracker-relatorio-${tipo}-${String(valor).replace("/", "-")}.csv`, csv(rel, tipo, valor), "text/csv;charset=utf-8");
    el.querySelector("#imprimir").onclick = () => window.print();
  };

  /* ================================================================== */
  /* Catálogo técnico (RF-18)                                            */
  /* ================================================================== */

  let abaCatalogo = "defensivos";

  V.catalogo = function (el) {
    App.setTitulo("Catálogo técnico", "Produtos, doses de bula e fórmulas usadas nos cálculos");
    const cat = Servicos.catalogo();
    const precos = Store.precos();
    const abas = { defensivos: "Defensivos", nutricao: "Calcário e adubos", formulas: "Fórmulas de cálculo", pragas: "Pragas e doenças" };

    const campoPreco = (p, unidade) => {
      const ref = p.precoReferencia && p.precoReferencia.valor;
      return `<div class="price-field">
        <label>Seu preço (${esc(unidade)})<input data-preco="${p.id}" data-num inputmode="decimal" value="${precos[p.id] ?? ""}" placeholder="${ref != null ? num(ref) : "não informado"}" /></label>
        <small>Referência: ${ref != null ? `${moeda(ref)} ${p.precoReferencia.faixaObservada ? `(${esc(p.precoReferencia.faixaObservada)})` : ""}` : esc(p.precoReferencia && p.precoReferencia.obs ? "sem preço coletado" : "—")}</small>
      </div>`;
    };

    const doseTxt = (d) => {
      if (Array.isArray(d)) return d.map((x) => `${esc(x.alvo)}: <strong>${num(x.valor)} ${esc(x.unidade)}</strong>`).join("<br>");
      if (d.min == null && d.max == null) return `<em>${esc(d.obs || "Consultar bula")}</em>`;
      return `<strong>${num(d.min)} a ${num(d.max)}</strong> ${esc(d.unidade)}`;
    };

    const conteudo = {
      defensivos: () => cat.defensivos.map((p) => `
        <article class="catalog-item">
          <div class="row-between"><h3>${esc(p.nome)}</h3><span class="badge badge-neutral">${esc(p.categoria)}</span></div>
          <p class="muted small">${esc(p.fabricante)} · ${esc(p.ingredienteAtivo)}</p>
          <p><strong>Alvos:</strong> ${p.alvos.map(esc).join("; ")}</p>
          <p><strong>Dose:</strong> ${doseTxt(p.dose)}</p>
          ${p.volumeCalda ? `<p><strong>Volume de calda:</strong> ${p.volumeCalda.valor != null ? num(p.volumeCalda.valor) : `${num(p.volumeCalda.min)} a ${num(p.volumeCalda.max)}`} ${esc(p.volumeCalda.unidade)}</p>` : ""}
          ${p.maxAplicacoesPorCiclo ? `<p><strong>Máx. aplicações por ciclo:</strong> ${p.maxAplicacoesPorCiclo}</p>` : ""}
          ${p.observacaoAplicacao ? `<p class="small">${esc(p.observacaoAplicacao)}</p>` : ""}
          ${campoPreco(p, "R$/litro")}
          <p class="muted small">Fonte: ${esc(p.fonte)}</p>
        </article>`).join(""),
      nutricao: () => [...cat.corretivos, ...cat.fertilizantesNPK].map((p) => `
        <article class="catalog-item">
          <div class="row-between"><h3>${esc(p.nome)}</h3><span class="badge badge-neutral">${esc(p.categoria)}</span></div>
          ${p.funcao ? `<p>${esc(p.funcao)}</p>` : ""}
          <p><strong>Unidade de dose:</strong> ${esc(p.unidadeDose)}</p>
          ${p.precoReferencia && p.precoReferencia.obs ? `<p class="small muted">${esc(p.precoReferencia.obs)}</p>` : ""}
          ${campoPreco(p, p.id === "COR-01" ? "R$/tonelada" : "R$/kg")}
          ${p.fonte ? `<p class="muted small">Fonte: ${esc(p.fonte)}</p>` : ""}
        </article>`).join(""),
      formulas: () => Object.values(cat.formulasCalculo).map((f) => `
        <article class="catalog-item">
          <h3>${esc(f.nome)}</h3>
          <p>${esc(f.descricao)}</p>
          ${f.formulaCompleta || f.formula ? `<p class="formula">${esc(f.formulaCompleta || f.formula)}</p>` : ""}
          ${f.tabelaReferencia ? `<table class="table table-compact"><thead><tr><th>Solo</th><th>Argila</th><th>Dose</th></tr></thead><tbody>${f.tabelaReferencia.map((r) => `<tr><td>${esc(r.tipoSolo)}</td><td>${esc(r.percentualArgila)}</td><td>${num(r.doseReferenciaTha)} t/ha</td></tr>`).join("")}</tbody></table>` : ""}
          ${f.fatoresPorSaca ? `<p>N: ${num(f.fatoresPorSaca.N_kgPorSaca)} kg/saca · P: ${num(f.fatoresPorSaca.P_kgPorSaca)} kg/saca · K: ${num(f.fatoresPorSaca.K_kgPorSaca)} kg/saca</p>` : ""}
          ${f.doses ? `<p>${f.doses.map((d) => `${d.anoAposPlantio}º ano: ${d.gramasPorPlanta} g/planta`).join(" · ")} de ${esc(f.formulacaoReferencia)}</p>` : ""}
          <p class="muted small">Fonte: ${esc(f.fonte)}</p>
        </article>`).join(""),
      pragas: () => CULTURAS.cafe.pragas.map((p) => `
        <article class="catalog-item">
          <div class="row-between"><h3>${esc(p.nomeTecnico)} <em class="muted small">${esc(p.nomeCientifico)}</em></h3><span class="badge badge-neutral">${esc(p.tipo)}</span></div>
          <p><strong>Nomes populares:</strong> ${p.nomesPopulares.map(esc).join(", ")}</p>
          <p>${esc(p.sintoma)}</p>
          <p><strong>Defensivos no catálogo:</strong> ${p.defensivos.length ? p.defensivos.map((d) => esc(cat.defensivos.find((x) => x.id === d.produtoId).nome.split(" (")[0])).join(", ") : "<em>nenhum com recomendação oficial</em>"}</p>
        </article>`).join(""),
    };

    el.innerHTML = `
      <div class="context-tabs" role="tablist">${Object.entries(abas).map(([k, v]) => `<button class="context-tab ${k === abaCatalogo ? "is-active" : ""}" data-aba="${k}">${v}</button>`).join("")}</div>
      <section class="card">
        <p class="muted small">${esc(cat._meta.descricao)} Versão ${esc(cat._meta.versao)}, compilado em ${data(cat._meta.dataCompilacao)}.</p>
        <div class="catalog-grid">${conteudo[abaCatalogo]()}</div>
        ${UI.disclaimer()}
      </section>`;

    el.querySelectorAll("[data-aba]").forEach((b) => b.addEventListener("click", () => { abaCatalogo = b.dataset.aba; V.catalogo(el); }));
    el.querySelectorAll("[data-preco]").forEach((inp) => inp.addEventListener("change", () => {
      const v = inp.value.trim() === "" ? null : Number(inp.value.replace(",", "."));
      try { Store.salvarPreco(inp.dataset.preco, v); UI.toast(v == null ? "Voltou a usar o preço de referência." : "Preço salvo."); }
      catch (e) { UI.toast(e.message, "erro"); }
    }));
  };

  /* ================================================================== */
  /* Equipe (RF-06, RN-06)                                               */
  /* ================================================================== */

  V.equipe = function (el) {
    App.setTitulo("Equipe", "Colaboradores que ajudam a operar o sistema");
    const lista = Store.colaboradores();
    const produtor = Store.ehProdutor();

    el.innerHTML = `
      ${produtor ? "" : `<div class="tip">${Icon.info()}<span>Apenas o produtor (dono da conta) pode convidar, editar ou remover colaboradores.</span></div>`}
      <section class="card">
        <div class="card-header"><h2>Colaboradores</h2><p class="card-subtitle">Colaboradores podem registrar aplicações, colheitas e pragas, mas não excluem talhões nem gerenciam a equipe.</p></div>
        ${lista.length ? `<div class="table-wrap"><table class="table">
          <thead><tr><th>Nome</th><th>E-mail</th><th>Função</th><th>WhatsApp</th><th>Recebe alertas</th>${produtor ? "<th></th>" : ""}</tr></thead>
          <tbody>${lista.map((u) => `<tr>
            <td><strong>${esc(u.nome)}</strong></td><td>${esc(u.email)}</td><td>${esc(u.papel || "—")}</td><td>${esc(u.telefone || "—")}</td>
            <td>${u.receberAlertas ? "Sim" : "Não"}</td>
            ${produtor ? `<td class="nowrap"><button class="icon-btn" data-editar="${u.id}" aria-label="Editar">${Icon.edit()}</button><button class="icon-btn" data-remover="${u.id}" aria-label="Remover">${Icon.trash()}</button></td>` : ""}
          </tr>`).join("")}</tbody></table></div>` : `<p class="muted">Nenhum colaborador cadastrado.</p>`}
      </section>
      ${produtor ? `
      <form class="card form" id="convidarForm" novalidate>
        <div class="card-header"><h2>Convidar colaborador</h2><p class="card-subtitle">Ele entra com o e-mail e a senha provisória abaixo.</p></div>
        <div class="form-grid">
          <label>Nome completo *<input name="nome" /></label>
          <label>CPF *<input name="cpf" inputmode="numeric" placeholder="000.000.000-00" /></label>
          <label>E-mail *<input type="email" name="email" /></label>
          <label>WhatsApp (com DDD)<input name="telefone" inputmode="tel" placeholder="(35) 99999-0000" /></label>
          <label>Função<input name="papel" placeholder="Ex.: Agrônomo, Tratorista, Gerente" /></label>
          <label>Senha provisória *<input type="password" name="senha" autocomplete="new-password" /></label>
          <label class="check"><input type="checkbox" name="receberAlertas" checked /> Receber alertas pelo WhatsApp</label>
        </div>
        <div class="form-actions"><button class="btn btn-primary" type="submit">${Icon.plus()} Convidar</button></div>
      </form>` : ""}`;

    if (!produtor) return;
    const form = el.querySelector("#convidarForm");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const ok = UI.tentar(form, () => Store.convidarColaborador(UI.lerForm(form)));
      if (ok) { UI.toast("Colaborador convidado."); App.render(); }
    });
    el.querySelectorAll("[data-remover]").forEach((b) => b.addEventListener("click", async () => {
      const u = lista.find((x) => x.id === b.dataset.remover);
      if (!(await UI.confirmar(`Remover <strong>${esc(u.nome)}</strong> da equipe? Ele perde o acesso imediatamente.`, { textoOk: "Remover", perigo: true }))) return;
      Store.removerColaborador(u.id); UI.toast("Colaborador removido."); App.render();
    }));
    el.querySelectorAll("[data-editar]").forEach((b) => b.addEventListener("click", () => {
      const u = lista.find((x) => x.id === b.dataset.editar);
      const m = UI.modal({
        titulo: `Editar ${esc(u.nome)}`,
        corpo: `<form class="form" id="editColab">
          <label>Função<input name="papel" value="${esc(u.papel || "")}" /></label>
          <label>WhatsApp<input name="telefone" value="${esc(u.telefone || "")}" /></label>
          <label class="check"><input type="checkbox" name="receberAlertas" ${u.receberAlertas ? "checked" : ""} /> Receber alertas</label></form>`,
        acoes: `<button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" id="salvarColab">Salvar</button>`,
      });
      m.querySelector("#salvarColab").onclick = () => {
        const f = m.querySelector("#editColab");
        if (UI.tentar(f, () => { Store.atualizarColaborador(u.id, UI.lerForm(f)); return true; })) { UI.fecharModal(); App.render(); }
      };
    }));
  };

  /* ================================================================== */
  /* Minha conta (RF-05, RNF-04 / LGPD)                                  */
  /* ================================================================== */

  V.conta = function (el) {
    const u = Store.usuarioAtual();
    App.setTitulo("Minha conta", u.tipo === "produtor" ? "Produtor · conta principal" : "Colaborador");
    el.innerHTML = `
      <div class="grid-2">
        <form class="card form" id="perfilForm">
          <div class="card-header"><h2>Dados pessoais</h2></div>
          <label>Nome<input name="nome" value="${esc(u.nome)}" /></label>
          <label>E-mail<input value="${esc(u.email)}" disabled /></label>
          <label>CPF<input value="${esc(u.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4"))}" disabled /></label>
          <label>WhatsApp (com DDD)<input name="telefone" value="${esc(u.telefone)}" inputmode="tel" /><small>Usado para receber alertas.</small></label>
          <div class="form-actions"><button class="btn btn-primary" type="submit">Salvar</button></div>
        </form>
        <form class="card form" id="senhaForm">
          <div class="card-header"><h2>Trocar senha</h2></div>
          <label>Senha atual<input type="password" name="atual" autocomplete="current-password" /></label>
          <label>Nova senha<input type="password" name="nova" autocomplete="new-password" /></label>
          <div class="form-actions"><button class="btn btn-soft" type="submit">Trocar senha</button></div>
        </form>
      </div>
      <section class="card">
        <div class="card-header"><h2>Privacidade (LGPD)</h2>
          <p class="card-subtitle">Seus dados ficam guardados neste aparelho. Senhas são armazenadas apenas como hash (SHA-256 com salt).${u.consentimentoLGPD ? ` Consentimento registrado em ${UI.dataHora(u.consentimentoLGPD)}.` : ""}</p></div>
        <div class="quick-actions">
          <button class="btn btn-soft" id="exportarDados">${Icon.download()} Baixar meus dados (JSON)</button>
          ${u.tipo === "produtor" ? `<button class="btn btn-ghost btn-danger-text" id="excluirConta">${Icon.trash()} Excluir minha conta e todos os dados</button>` : ""}
        </div>
      </section>
      <section class="card">
        <div class="card-header"><h2>Dados de demonstração</h2><p class="card-subtitle">Apaga tudo o que está salvo neste navegador e recria as contas de exemplo.</p></div>
        <button class="btn btn-ghost" id="resetDemo">${Icon.refresh()} Restaurar dados de demonstração</button>
      </section>`;

    const perfil = el.querySelector("#perfilForm");
    perfil.addEventListener("submit", (e) => { e.preventDefault(); Store.atualizarPerfil(UI.lerForm(perfil)); UI.toast("Dados atualizados."); App.render(); });
    const senha = el.querySelector("#senhaForm");
    senha.addEventListener("submit", (e) => {
      e.preventDefault();
      const f = UI.lerForm(senha);
      if (UI.tentar(senha, () => { Store.alterarSenha(f.atual, f.nova); return true; })) { senha.reset(); UI.toast("Senha alterada."); }
    });
    el.querySelector("#exportarDados").onclick = () => UI.baixar("ruraltracker-meus-dados.json", JSON.stringify(Store.exportarDadosConta(), null, 2), "application/json");
    const exc = el.querySelector("#excluirConta");
    if (exc) exc.onclick = async () => {
      if (!(await UI.confirmar("Excluir sua conta apaga <strong>todos</strong> os talhões, safras, aplicações, colaboradores e alertas. Não pode ser desfeito.", { textoOk: "Excluir tudo", perigo: true }))) return;
      Store.excluirConta(); App.ir("#/entrar");
    };
    el.querySelector("#resetDemo").onclick = async () => {
      if (!(await UI.confirmar("Apagar todos os dados deste navegador e restaurar a demonstração?", { textoOk: "Restaurar", perigo: true }))) return;
      Store.reset(); App.ir("#/entrar");
    };
  };

  /* ================================================================== */
  /* Administração (RNF-06)                                              */
  /* ================================================================== */

  V.admin = function (el) {
    App.setTitulo("Administração do sistema", "Parâmetros configuráveis sem alterar o código");
    if (!Store.ehAdmin()) {
      el.innerHTML = `<section class="card">${UI.emptyState("settings", "Acesso restrito", "Apenas o administrador do sistema pode alterar estes parâmetros.")}</section>`;
      return;
    }
    const c = Store.state.config;
    el.innerHTML = `
      <form class="card form" id="adminForm" novalidate>
        <fieldset><legend>Promoção de produto personalizado para "Recorrente" (RN-07)</legend>
          <div class="form-grid">
            <label>Mínimo de produtores distintos<input name="minProdutores" data-num inputmode="numeric" value="${c.promocao.minProdutores}" /></label>
            <label>Mínimo de aplicações por produtor<input name="minAplicacoesPorProdutor" data-num inputmode="numeric" value="${c.promocao.minAplicacoesPorProdutor}" /></label>
          </div></fieldset>
        <fieldset><legend>Clima e alertas</legend>
          <div class="form-grid">
            <label>Atualizar clima a cada (horas) — RNF-01<input name="climaIntervaloHoras" data-num inputmode="decimal" value="${c.climaIntervaloHoras}" /></label>
            <label>Gerar alerta quando a aplicação desviar mais de (%)<input name="toleranciaAlertaPct" data-num inputmode="numeric" value="${c.toleranciaAlertaPct}" /></label>
            <label>V2 padrão para calagem (%)<input name="v2Padrao" data-num inputmode="decimal" value="${c.v2Padrao}" /></label>
          </div></fieldset>
        <fieldset><legend>WhatsApp (RF-16)</legend>
          <label>URL do serviço de envio (WhatsApp Business API ou equivalente)<input name="whatsappWebhookUrl" value="${esc(c.whatsappWebhookUrl)}" placeholder="https://..." />
            <small>O sistema faz um POST JSON com { destinatarios, mensagem, alertaId }. Se ficar em branco ou o serviço falhar, os alertas continuam no app e podem ser enviados manualmente (RNF-07).</small></label>
        </fieldset>
        <div class="form-actions"><button class="btn btn-primary" type="submit">Salvar parâmetros</button></div>
      </form>`;
    const form = el.querySelector("#adminForm");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const f = UI.lerForm(form);
      const ok = UI.tentar(form, () => {
        if (!(f.climaIntervaloHoras > 0)) throw new Store.RegraError("RNF-01", "O intervalo do clima deve ser maior que zero.");
        if (!(f.v2Padrao >= 60 && f.v2Padrao <= 70)) throw new Store.RegraError("RN-10", "V2 para café deve ficar entre 60% e 70%.");
        if (f.whatsappWebhookUrl && !/^https:\/\//.test(f.whatsappWebhookUrl)) throw new Store.RegraError("RNF-04", "Use uma URL https:// para o serviço de WhatsApp.");
        Store.salvarConfig({
          promocao: { minProdutores: Math.round(f.minProdutores), minAplicacoesPorProdutor: Math.round(f.minAplicacoesPorProdutor) },
          climaIntervaloHoras: f.climaIntervaloHoras,
          toleranciaAlertaPct: f.toleranciaAlertaPct,
          v2Padrao: f.v2Padrao,
          whatsappWebhookUrl: f.whatsappWebhookUrl,
        });
        return true;
      });
      if (ok) UI.toast("Parâmetros salvos. Status dos produtos recalculados.");
    });
  };

  /* ================================================================== */
  /* Acesso (RF-05)                                                      */
  /* ================================================================== */

  const marca = `<div class="auth-brand"><span class="brand-mark"></span><span>Rural Tracker</span></div>`;

  V.login = function (el) {
    document.title = "Entrar · Rural Tracker";
    el.innerHTML = `
      <div class="auth-card card">
        ${marca}
        <h1>Entrar</h1>
        <p class="muted">Gestão e monitoramento da sua lavoura de café.</p>
        <form class="form" id="loginForm" novalidate>
          <label>E-mail<input type="email" name="email" autocomplete="username" /></label>
          <label>Senha<input type="password" name="senha" autocomplete="current-password" /></label>
          <button class="btn btn-primary btn-lg btn-block" type="submit">Entrar</button>
        </form>
        <p class="center">Ainda não tem conta? <a href="#/cadastro">Cadastre-se</a></p>
        <div class="demo-box">
          <p><strong>Demonstração</strong> — senha <code>demo1234</code></p>
          <div class="quick-actions">
            <button class="btn btn-soft" data-demo="maria@ruraltracker.demo">Entrar como produtora (Maria)</button>
            <button class="btn btn-soft" data-demo="joao@ruraltracker.demo">Entrar como colaborador (João)</button>
          </div>
        </div>
      </div>`;
    const form = el.querySelector("#loginForm");
    const entrar = (email, senha) => {
      if (UI.tentar(form, () => Store.login(email, senha))) App.ir("#/talhoes");
    };
    form.addEventListener("submit", (e) => { e.preventDefault(); const f = UI.lerForm(form); entrar(f.email, f.senha); });
    el.querySelectorAll("[data-demo]").forEach((b) => b.addEventListener("click", () => entrar(b.dataset.demo, "demo1234")));
  };

  V.cadastro = function (el) {
    document.title = "Criar conta · Rural Tracker";
    el.innerHTML = `
      <div class="auth-card card">
        ${marca}
        <h1>Criar conta de produtor</h1>
        <form class="form" id="cadForm" novalidate>
          <label>Nome completo<input name="nome" autocomplete="name" /></label>
          <label>CPF<input name="cpf" inputmode="numeric" placeholder="000.000.000-00" /></label>
          <label>E-mail<input type="email" name="email" autocomplete="email" /></label>
          <label>WhatsApp (com DDD)<input name="telefone" inputmode="tel" /></label>
          <label>Senha (mínimo 6 caracteres)<input type="password" name="senha" autocomplete="new-password" /></label>
          <label>Repita a senha<input type="password" name="senha2" autocomplete="new-password" /></label>
          <label class="check"><input type="checkbox" name="consentimento" /> <span>Autorizo o uso dos meus dados para o funcionamento do Rural Tracker, conforme a LGPD. Posso baixar ou apagar meus dados a qualquer momento.</span></label>
          <button class="btn btn-primary btn-lg btn-block" type="submit">Criar conta</button>
        </form>
        <p class="center">Já tem conta? <a href="#/entrar">Entrar</a></p>
      </div>`;
    const form = el.querySelector("#cadForm");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const f = UI.lerForm(form);
      const ok = UI.tentar(form, () => {
        if (f.senha !== f.senha2) throw new Store.RegraError("RF-05", "As senhas não conferem.");
        return Store.registrarProdutor(f);
      });
      if (ok) { UI.toast("Conta criada! Cadastre seu primeiro talhão."); App.ir("#/talhoes"); }
    });
  };
})(window);
