// Lógica de renderização do Dashboard de Indicadores (RF-14).
// Tudo roda em memória a partir de data.js — sem chamadas de rede reais.

const DISCLAIMER_TEXT =
  "Orientação gerada pelo sistema — não substitui a avaliação de um responsável técnico/agrônomo.";

let selectedContextId = "overview"; // "overview" | talhao.id

function getTalhao(id) {
  return talhoes.find((t) => t.id === id);
}

function formatCurrency(value) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function footnote(text) {
  return `<span class="nav-icon">${Icon.info()}</span><span>${text}</span>`;
}

/* ---------------- Header ---------------- */
function renderHeader() {
  document.getElementById("lastUpdated").textContent = lastUpdatedLabel;
  document.getElementById("userName").textContent = currentUser.nome;
  document.getElementById("userRole").textContent = currentUser.papel;
  document.getElementById("userAvatar").textContent = currentUser.nome
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
}

/* ---------------- Context tabs ---------------- */
function renderContextTabs() {
  const el = document.getElementById("contextTabs");
  const tabs = [{ id: "overview", label: "Visão geral da propriedade" }].concat(
    talhoes.map((t) => ({ id: t.id, label: `${t.nome} — ${t.variedade}` }))
  );
  el.innerHTML = tabs
    .map(
      (tab) => `
      <button class="context-tab ${tab.id === selectedContextId ? "is-active" : ""}"
        data-context="${tab.id}" role="tab" aria-selected="${tab.id === selectedContextId}">
        ${tab.label}
      </button>`
    )
    .join("");
  el.querySelectorAll(".context-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedContextId = btn.dataset.context;
      renderAll();
    });
  });
}

/* ---------------- KPIs ---------------- */
function kpiCard({ label, value, delta, iconKey, isAlert }) {
  return `
    <div class="kpi-card ${isAlert ? "is-alert" : ""}">
      <div class="kpi-top">
        <span class="kpi-label">${label}</span>
        <span class="kpi-icon">${Icon[iconKey]()}</span>
      </div>
      <div class="kpi-value">${value}</div>
      ${delta ? `<div class="kpi-delta ${delta.direction}">${delta.icon || ""} ${delta.text}</div>` : ""}
    </div>`;
}

function renderKpis() {
  const el = document.getElementById("kpiGrid");
  const talhoesComAlerta = talhoes.filter((t) => t.alertaAtivo).length;

  if (selectedContextId === "overview") {
    const totalArea = talhoes.reduce((s, t) => s + t.areaHectares, 0);
    const custoMedioHa = talhoes.reduce((s, t) => s + t.custoPorHectare * t.areaHectares, 0) / totalArea;

    const produtividades = talhoes
      .map((t) => {
        const concluidas = t.safras.filter((s) => s.colheita);
        const ultima = concluidas[concluidas.length - 1];
        return ultima ? ultima.colheita.produtividadeSacasHa : null;
      })
      .filter((v) => v !== null);
    const produtividadeMedia = produtividades.length
      ? produtividades.reduce((a, b) => a + b, 0) / produtividades.length
      : null;

    const pcts = talhoes.map((t) => t.aplicadoVsRecomendadoPct).filter((v) => v !== null);
    const pctMedio = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null;

    el.innerHTML = [
      kpiCard({
        label: "Custo médio por hectare",
        value: formatCurrency(Math.round(custoMedioHa)) + "/ha",
        delta: { direction: "neutral", text: "Média ponderada por área, safra atual" },
        iconKey: "leaf",
      }),
      kpiCard({
        label: "Produtividade média",
        value: produtividadeMedia !== null ? `${produtividadeMedia.toFixed(1)} sacas/ha` : "—",
        delta: {
          direction: "neutral",
          text: produtividadeMedia !== null ? "Média entre talhões com safra concluída" : "Nenhuma safra concluída ainda",
        },
        iconKey: "sprout",
      }),
      kpiCard({
        label: "Aplicado vs. recomendado",
        value: pctMedio !== null ? `${pctMedio}%` : "—",
        delta: { direction: "neutral", text: pctMedio !== null ? "Média entre talhões com aplicações" : "Aguardando registros de aplicação" },
        iconKey: "droplet",
      }),
      kpiCard({
        label: "Talhões com alerta ativo",
        value: String(talhoesComAlerta),
        delta: { direction: talhoesComAlerta > 0 ? "down" : "neutral", text: talhoesComAlerta > 0 ? "Requer atenção" : "Tudo dentro do esperado" },
        iconKey: "alertTriangle",
        isAlert: talhoesComAlerta > 0,
      }),
    ].join("");
    return;
  }

  const t = getTalhao(selectedContextId);
  const concluidas = t.safras.filter((s) => s.colheita);
  const ultima = concluidas[concluidas.length - 1];
  const penultima = concluidas[concluidas.length - 2];

  let produtividadeDelta = { direction: "neutral", text: "Ainda sem safra anterior para comparar" };
  if (ultima && penultima) {
    const variacao = ((ultima.colheita.produtividadeSacasHa - penultima.colheita.produtividadeSacasHa) / penultima.colheita.produtividadeSacasHa) * 100;
    produtividadeDelta = {
      direction: variacao >= 0 ? "up" : "down",
      icon: variacao >= 0 ? Icon.trendingUp() : Icon.trendingDown(),
      text: `${variacao >= 0 ? "+" : ""}${variacao.toFixed(1)}% vs. safra anterior`,
    };
  } else if (ultima) {
    produtividadeDelta = { direction: "neutral", text: "Primeira safra concluída registrada" };
  }

  const pct = t.aplicadoVsRecomendadoPct;
  let pctStatus = { direction: "neutral", text: "Aguardando registros de aplicação" };
  if (pct !== null) {
    if (pct >= 90 && pct <= 110) pctStatus = { direction: "up", text: "Dentro da faixa recomendada" };
    else if (pct > 110) pctStatus = { direction: "down", text: `${pct - 100}% acima do recomendado` };
    else pctStatus = { direction: "down", text: `${100 - pct}% abaixo do recomendado` };
  }

  el.innerHTML = [
    kpiCard({
      label: "Custo por hectare",
      value: formatCurrency(t.custoPorHectare) + "/ha",
      delta: { direction: "neutral", text: `Safra atual · ${t.areaHectares} ha` },
      iconKey: "leaf",
    }),
    kpiCard({
      label: "Produtividade da última safra",
      value: ultima ? `${ultima.colheita.produtividadeSacasHa} sacas/ha` : "—",
      delta: produtividadeDelta,
      iconKey: "sprout",
    }),
    kpiCard({
      label: "Insumo aplicado vs. recomendado",
      value: pct !== null ? `${pct}%` : "—",
      delta: pctStatus,
      iconKey: "droplet",
      isAlert: pct !== null && (pct < 90 || pct > 110),
    }),
    kpiCard({
      label: "Talhões com alerta ativo",
      value: String(talhoesComAlerta),
      delta: { direction: t.alertaAtivo ? "down" : "neutral", text: t.alertaAtivo ? "Este talhão tem um alerta ativo" : "Este talhão está sem alertas" },
      iconKey: "alertTriangle",
      isAlert: talhoesComAlerta > 0,
    }),
  ].join("");
}

/* ---------------- Comparação aplicado x recomendado ---------------- */
function ratioBar(label, aplicado, recomendado, unidade) {
  const ratio = (aplicado / recomendado) * 100;
  const trackMax = 150;
  const fillPct = Math.min(ratio, trackMax) / trackMax * 100;
  const targetPct = (100 / trackMax) * 100;
  const dentroDaFaixa = ratio >= 90 && ratio <= 110;
  const diff = Math.round(Math.abs(ratio - 100));
  const statusText = dentroDaFaixa
    ? "Dentro da faixa recomendada"
    : `${diff}% ${ratio > 100 ? "acima" : "abaixo"} do recomendado`;

  return `
    <div class="compare-row">
      <div class="compare-row-head">
        <span class="name">${label}</span>
        <span class="values">${aplicado} de ${recomendado} ${unidade}</span>
      </div>
      <div class="compare-track">
        <div class="compare-fill ${dentroDaFaixa ? "" : "is-off"}" style="width:${fillPct}%"></div>
        <div class="compare-target" style="left:${targetPct}%"></div>
      </div>
      <div class="compare-status ${dentroDaFaixa ? "" : "is-off"}">${statusText}</div>
    </div>`;
}

function renderComparison() {
  const subtitleEl = document.getElementById("comparisonSubtitle");
  const bodyEl = document.getElementById("comparisonBody");
  const legendEl = document.getElementById("comparisonLegend");
  legendEl.innerHTML = footnote(
    "A faixa ideal considera de 90% a 110% da dose recomendada pela fonte técnica de referência (Agrofit/MAPA). A marca no meio da barra indica 100% do recomendado."
  );

  if (selectedContextId === "overview") {
    subtitleEl.textContent = "% da dose recomendada aplicada, por talhão";
    bodyEl.innerHTML = talhoes
      .map((t) => {
        if (t.aplicadoVsRecomendadoPct === null) {
          return `
            <div class="compare-row">
              <div class="compare-row-head"><span class="name">${t.nome} — ${t.variedade}</span></div>
              <div class="no-data-inline">${Icon.info()} Nenhuma aplicação registrada ainda neste talhão.</div>
            </div>`;
        }
        return ratioBar(`${t.nome} — ${t.variedade}`, t.aplicadoVsRecomendadoPct, 100, "%");
      })
      .join("");
    return;
  }

  const t = getTalhao(selectedContextId);
  subtitleEl.textContent = `Insumos da safra atual · ${t.nome} — ${t.variedade}`;
  if (!t.insumosComparacao.length) {
    bodyEl.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">${Icon.droplet()}</span>
        <p class="empty-state-title">Ainda não há aplicações registradas</p>
        <p class="empty-state-text">Registre sua primeira aplicação de insumo neste talhão para começar a ver comparações entre o aplicado e o recomendado.</p>
      </div>`;
    return;
  }
  bodyEl.innerHTML = t.insumosComparacao
    .map((i) => ratioBar(i.insumo, i.aplicado, i.recomendado, i.unidade))
    .join("");
}

/* ---------------- Safra atual ---------------- */
function miniLineChart(values) {
  const w = 240, h = 56, pad = 6;
  const max = Math.max(...values) * 1.1;
  const min = Math.min(...values) * 0.9;
  const stepX = (w - pad * 2) / Math.max(values.length - 1, 1);
  const points = values.map((v, i) => {
    const x = pad + i * stepX;
    const y = h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2);
    return [x, y];
  });
  const path = points.map((p) => p.join(",")).join(" ");
  const dots = points.map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="#3f6b3f"/>`).join("");
  return `
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Evolução da produtividade">
      <polyline points="${path}" fill="none" stroke="#3f6b3f" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}
    </svg>`;
}

function renderSeason() {
  const subtitleEl = document.getElementById("seasonSubtitle");
  const bodyEl = document.getElementById("seasonBody");

  if (selectedContextId === "overview") {
    subtitleEl.textContent = "Selecione um talhão para ver detalhes";
    bodyEl.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">${Icon.calendar()}</span>
        <p class="empty-state-title">Escolha um talhão acima</p>
        <p class="empty-state-text">O status da safra atual é exibido por talhão. Selecione um deles na barra de contexto para ver a fase da lavoura, a previsão de colheita e o histórico de produtividade.</p>
      </div>`;
    return;
  }

  const t = getTalhao(selectedContextId);
  subtitleEl.textContent = `${t.nome} — ${t.variedade} · ${t.localizacao}`;
  const concluidas = t.safras.filter((s) => s.colheita);

  let historico = "";
  if (concluidas.length >= 2) {
    const valores = concluidas.map((s) => s.colheita.produtividadeSacasHa);
    historico = `
      <div class="sparkline-wrap">
        <p class="sparkline-title">Produtividade nas últimas safras</p>
        ${miniLineChart(valores)}
        <div class="sparkline-points">${valores.map((v) => `<span>${v} sc/ha</span>`).join("")}</div>
      </div>`;
  } else if (concluidas.length === 1) {
    historico = `
      <div class="no-data-inline">${Icon.info()} Apenas uma safra concluída até agora (${concluidas[0].colheita.produtividadeSacasHa} sacas/ha). O histórico de evolução aparecerá após a próxima colheita.</div>`;
  } else {
    historico = `
      <div class="no-data-inline">${Icon.info()} Nenhuma safra concluída neste talhão ainda. Registre a colheita para começar o histórico de produtividade.</div>`;
  }

  bodyEl.innerHTML = `
    <div class="season-phase-row">
      <div>
        <div class="season-phase">${t.faseAtual}</div>
      </div>
      <div class="season-date">${Icon.calendar()} Colheita prevista: ${t.dataColheitaPrevista}</div>
    </div>
    <div class="progress-track"><div class="progress-fill" style="width:${Math.round(t.cicloProgresso * 100)}%"></div></div>
    <div class="progress-label">${Math.round(t.cicloProgresso * 100)}% do ciclo da safra atual concluído</div>
    ${historico}
  `;
}

/* ---------------- Sugestão de reajuste ---------------- */
function adjustmentHero(t) {
  const s = t.sugestaoReajuste;
  const sinal = s.percentualAjuste > 0 ? "+" : "";
  return `
    <div class="adjustment-hero">
      <span class="adjustment-badge">${sinal}${s.percentualAjuste}%</span>
      <div>
        <p class="adjustment-title">${s.percentualAjuste < 0 ? "Sugerimos reduzir" : "Sugerimos aumentar"} em ${Math.abs(s.percentualAjuste)}% a próxima aplicação de ${s.insumo.toLowerCase()} neste talhão</p>
      </div>
    </div>
    <p class="adjustment-text">${s.justificativa}</p>`;
}

function adjustmentEmpty() {
  return `
    <div class="empty-state">
      <span class="empty-state-icon">${Icon.sprout()}</span>
      <p class="empty-state-title">Ainda não há uma safra concluída neste talhão</p>
      <p class="empty-state-text">Registre a colheita para receber sugestões de reajuste de insumos com base no histórico de aplicações e na produtividade obtida.</p>
    </div>`;
}

function renderAdjustment() {
  const bodyEl = document.getElementById("adjustmentBody");

  if (selectedContextId === "overview") {
    const rows = talhoes
      .map((t) => {
        if (t.sugestaoReajuste) {
          const s = t.sugestaoReajuste;
          const sinal = s.percentualAjuste > 0 ? "+" : "";
          return `
            <div class="compare-row">
              <div class="compare-row-head">
                <span class="name">${t.nome} — ${t.variedade}</span>
                <span class="values">${sinal}${s.percentualAjuste}% em ${s.insumo}</span>
              </div>
            </div>`;
        }
        return `
          <div class="compare-row">
            <div class="compare-row-head"><span class="name">${t.nome} — ${t.variedade}</span></div>
            <div class="no-data-inline">${Icon.info()} Aguardando a primeira safra concluída.</div>
          </div>`;
      })
      .join("");
    bodyEl.innerHTML = rows + `<div class="card-footnote">${footnote(DISCLAIMER_TEXT)}</div>`;
    return;
  }

  const t = getTalhao(selectedContextId);
  if (t.sugestaoReajuste) {
    bodyEl.innerHTML = adjustmentHero(t) + `<div class="card-footnote">${footnote(DISCLAIMER_TEXT)}</div>`;
  } else {
    bodyEl.innerHTML = adjustmentEmpty();
  }
}

/* ---------------- Pragas e doenças ---------------- */
function renderPests() {
  const bodyEl = document.getElementById("pestBody");
  const footEl = document.getElementById("pestFootnote");
  footEl.innerHTML = footnote(DISCLAIMER_TEXT);

  bodyEl.innerHTML = ocorrenciasPragas
    .map((p) => {
      const talhao = getTalhao(p.talhaoId);
      const popular = p.nomesPopulares.length ? ` <span class="pest-popular">(popularmente "${p.nomesPopulares[0]}")</span>` : "";
      return `
        <div class="pest-item">
          <div class="pest-head">
            <span class="pest-name">${p.nomeTecnico}${popular}</span>
            <span class="badge sev-${p.severidade}">${p.severidade}</span>
          </div>
          <div class="pest-meta">
            <span>${Icon.leaf()}</span>
            <span>${talhao.nome} — ${talhao.variedade}</span>
          </div>
          <div class="pest-dose">
            <span class="badge badge-oficial">Oficial</span>
            &nbsp;${p.doseRecomendada}
          </div>
          ${
            p.complementoRecorrente
              ? `<div class="pest-dose"><span class="badge badge-recorrente">Recorrente entre produtores</span> &nbsp;${p.complementoRecorrente}</div>`
              : ""
          }
        </div>`;
    })
    .join("");
}

/* ---------------- Alertas ---------------- */
function renderAlerts() {
  const bodyEl = document.getElementById("alertsBody");
  bodyEl.innerHTML = alertas
    .map((a) => {
      const talhao = getTalhao(a.talhaoId);
      const isClima = a.tipo === "clima";
      const channelLabel = a.canal === "whatsapp" ? "Enviado via WhatsApp" : "Enviado no app";
      return `
        <div class="alert-item">
          <span class="alert-icon tipo-${a.tipo}">${isClima ? Icon.cloudRain() : Icon.alertTriangle()}</span>
          <div class="alert-body">
            <p class="alert-desc">${a.descricao}</p>
            <div class="alert-meta">
              <span>${talhao.nome} — ${talhao.variedade}</span>
              <span class="channel-chip ${a.canal === "whatsapp" ? "channel-whatsapp" : ""}">
                ${a.canal === "whatsapp" ? Icon.whatsapp() : Icon.bell()} ${channelLabel}
              </span>
              <span class="status-chip">· ${a.status}</span>
            </div>
          </div>
        </div>`;
    })
    .join("");
}

/* ---------------- Bootstrap ---------------- */
function renderAll() {
  renderContextTabs();
  renderKpis();
  renderComparison();
  renderSeason();
  renderAdjustment();
}

function renderStaticIcons() {
  document.querySelectorAll("[data-icon]").forEach((el) => {
    const key = el.dataset.icon;
    if (Icon[key]) el.innerHTML = Icon[key]();
  });
}

function init() {
  renderStaticIcons();
  renderHeader();
  renderAll();
  renderPests();
  renderAlerts();
}

document.addEventListener("DOMContentLoaded", init);
