// Telas de registro: aplicações (RF-02, RF-04), pragas e doenças (RF-10 a RF-13)
// e safras/colheitas (RF-07).
(function (root) {
  const V = (root.Views = root.Views || {});
  const { esc, num, moeda, data, rotuloTalhao } = UI;

  const CATEGORIAS = {
    corretivo: { nome: "Calcário / corretivo", icon: "layers", unidades: ["t", "kg"] },
    fertilizante: { nome: "Adubo / fertilizante", icon: "sprout", unidades: ["kg", "t"] },
    defensivo: { nome: "Defensivo (veneno)", icon: "bug", unidades: ["L", "mL"] },
  };

  const FORMULAS_COMUNS = [
    ["20-05-20", 20, 5, 20], ["20-00-20", 20, 0, 20], ["25-00-25", 25, 0, 25], ["04-14-08", 4, 14, 8],
    ["Ureia 45-00-00", 45, 0, 0], ["KCl 00-00-60", 0, 0, 60], ["MAP 11-52-00", 11, 52, 0],
  ];

  /* ================================================================== */
  /* Aplicações                                                          */
  /* ================================================================== */

  V.tabelaAplicacoes = function (aps, { semTalhao = false, excluir = false } = {}) {
    const usuarios = Store.state.usuarios;
    return `
      <div class="table-wrap"><table class="table">
        <thead><tr>
          <th>Data</th>${semTalhao ? "" : "<th>Talhão</th>"}<th>Insumo</th><th>Quantidade</th><th>Por hectare</th><th>Custo</th><th>Registrado por</th>${excluir ? "<th></th>" : ""}
        </tr></thead>
        <tbody>${aps.map((a) => {
          const t = Store.talhao(a.talhaoId);
          const u = usuarios.find((x) => x.id === a.criadoPor);
          return `<tr>
            <td>${data(a.data)}${a.pendenteSync ? ` <span class="badge badge-pending" title="Registrado sem internet">no aparelho</span>` : ""}</td>
            ${semTalhao ? "" : `<td>${t ? esc(rotuloTalhao(t)) : "—"}</td>`}
            <td><strong>${esc(a.nomeProduto)}</strong><br><span class="muted small">${esc(CATEGORIAS[a.categoria].nome)}${a.formulacao ? ` · ${a.formulacao.n}-${a.formulacao.p}-${a.formulacao.k}` : ""}</span></td>
            <td>${num(a.quantidade)} ${esc(a.unidade)}</td>
            <td>${t ? `${num(a.quantidade / t.areaHectares)} ${esc(a.unidade)}/ha` : "—"}</td>
            <td>${a.custo != null ? moeda(a.custo) : "—"}</td>
            <td>${u ? esc(u.nome.split(" ")[0]) : "—"}</td>
            ${excluir ? `<td><button class="icon-btn" data-excluir-ap="${a.id}" aria-label="Excluir aplicação">${Icon.trash()}</button></td>` : ""}
          </tr>`;
        }).join("")}</tbody>
      </table></div>`;
  };

  V.aplicacoes = function (el, _p, q) {
    App.setTitulo("Aplicações", "Registro de adubos, calcário e defensivos aplicados");
    const filtro = q.talhao || "";
    const aps = Store.aplicacoesDaConta().filter((a) => !filtro || a.talhaoId === filtro);
    const total = aps.reduce((s, a) => s + (a.custo || 0), 0);
    el.innerHTML = `
      ${!Store.online() ? `<div class="banner-offline">${Icon.wifiOff()}<span>Você está sem internet. Pode registrar normalmente: os dados ficam guardados no aparelho e são enviados quando a conexão voltar.</span></div>` : ""}
      <div class="toolbar">
        <label class="inline-label">Talhão <select id="filtroTalhao">${UI.opcoesTalhao(filtro, "Todos os talhões")}</select></label>
        <a class="btn btn-primary btn-lg" href="#/aplicacoes/nova${filtro ? `?talhao=${filtro}` : ""}">${Icon.plus()} Registrar aplicação</a>
      </div>
      <section class="card">
        ${aps.length
          ? `<p class="muted">${aps.length} aplicação(ões) · custo total ${moeda(total)}</p>${V.tabelaAplicacoes(aps, { excluir: true })}`
          : UI.emptyState("droplet", "Nenhuma aplicação registrada", "Registre o que foi aplicado para comparar com o recomendado e acompanhar os custos.")}
      </section>`;
    el.querySelector("#filtroTalhao").onchange = (e) => App.ir(`#/aplicacoes${e.target.value ? `?talhao=${e.target.value}` : ""}`);
    el.querySelectorAll("[data-excluir-ap]").forEach((b) =>
      b.addEventListener("click", async () => {
        if (!(await UI.confirmar("Excluir esta aplicação?", { textoOk: "Excluir", perigo: true }))) return;
        try { Store.excluirAplicacao(b.dataset.excluirAp); UI.toast("Aplicação excluída."); App.render(); }
        catch (e) { UI.toast(e.message, "erro"); }
      })
    );
  };

  V.aplicacaoForm = function (el, _p, q) {
    App.setTitulo("Registrar aplicação", "O que foi aplicado, quanto, quando e quanto custou");
    if (!Store.talhoes().length) {
      el.innerHTML = `<section class="card">${UI.emptyState("leaf", "Cadastre um talhão primeiro", "", `<a class="btn btn-primary" href="#/talhoes/novo">Cadastrar talhão</a>`)}</section>`;
      return;
    }
    const cat = Servicos.catalogo();
    const ocorrencia = q.ocorrencia ? Store.ocorrenciasDaConta().find((o) => o.id === q.ocorrencia) : null;
    const categoriaIni = q.categoria || (ocorrencia ? "defensivo" : "fertilizante");
    const personalizados = Store.state.produtosPersonalizados;

    el.innerHTML = `
      ${!Store.online() ? `<div class="banner-offline">${Icon.wifiOff()}<span>Sem internet: esta aplicação será guardada no aparelho e sincronizada depois.</span></div>` : ""}
      <form class="card form" id="apForm" novalidate>
        <div class="form-grid">
          <label>Talhão *<select name="talhaoId">${UI.opcoesTalhao(q.talhao || (ocorrencia && ocorrencia.talhaoId))}</select></label>
          <label>Data da aplicação *<input type="date" name="data" value="${Store.hojeISO()}" max="${Store.hojeISO()}" />
            <small>Não é possível registrar datas futuras.</small></label>
        </div>

        <fieldset>
          <legend>O que foi aplicado?</legend>
          <div class="choice-grid choice-grid-3">
            ${Object.entries(CATEGORIAS).map(([k, c]) => `
              <label class="choice choice-icon">
                <input type="radio" name="categoria" value="${k}" ${k === categoriaIni ? "checked" : ""} />
                <span class="choice-ico">${Icon[c.icon]()}</span>
                <span class="choice-title">${c.nome}</span>
              </label>`).join("")}
          </div>
        </fieldset>

        <div data-cat="corretivo">
          <div class="form-grid">
            <label>Produto<select name="produtoCorretivo">
              ${cat.corretivos.map((p) => `<option value="${p.id}">${esc(p.nome)}</option>`).join("")}
              <option value="outro">Outro corretivo</option></select></label>
            <label data-outro-corretivo hidden>Nome do corretivo<input name="nomeCorretivo" /></label>
          </div>
        </div>

        <div data-cat="fertilizante">
          <div class="form-grid">
            <label>Adubo<select name="produtoFertilizante">
              <option value="FERT-01">NPK 15-00-10 (formação)</option>
              <option value="FERT-02" selected>Outro adubo (informar a fórmula)</option></select></label>
            <label data-outro-fert>Nome / marca<input name="nomeFertilizante" placeholder="Ex.: Adubo 20-05-20" /></label>
          </div>
          <div data-outro-fert>
            <p class="muted">Fórmula N-P-K (vem escrita no saco):</p>
            <div class="chips">${FORMULAS_COMUNS.map(([n, a, b, c]) => `<button type="button" class="chip" data-formula="${a}-${b}-${c}" data-nome="${esc(n)}">${esc(n)}</button>`).join("")}</div>
            <div class="form-grid form-grid-3">
              <label>N (%)<input name="fn" data-num inputmode="decimal" value="20" /></label>
              <label>P₂O₅ (%)<input name="fp" data-num inputmode="decimal" value="5" /></label>
              <label>K₂O (%)<input name="fk" data-num inputmode="decimal" value="20" /></label>
            </div>
          </div>
        </div>

        <div data-cat="defensivo">
          <div class="form-grid">
            <label>Produto<select name="produtoDefensivo">
              <optgroup label="Catálogo técnico (bula oficial)">
                ${cat.defensivos.map((p) => `<option value="cat:${p.id}" ${q.produto === p.id ? "selected" : ""}>${esc(p.nome.split(" (")[0])} — ${esc(p.categoria)}</option>`).join("")}
              </optgroup>
              ${personalizados.length ? `<optgroup label="Produtos cadastrados por produtores">
                ${personalizados.map((p) => `<option value="pp:${p.id}" ${q.produto === p.id ? "selected" : ""}>${esc(p.nome)} (${p.status})</option>`).join("")}
              </optgroup>` : ""}
              <option value="novo">+ Outro produto (cadastrar)</option>
            </select></label>
            <label>Praga/doença tratada<select name="ocorrenciaId"></select></label>
          </div>
          <div data-novo-produto hidden class="subform">
            <p class="muted">${Icon.info()} Produto fora da base oficial: será cadastrado como <strong>produto personalizado</strong> (status "Novo") só para o histórico (RF-13).</p>
            <div class="form-grid">
              <label>Nome do produto *<input name="ppNome" /></label>
              <label>Tipo<select name="ppCategoria">${UI.opcoes(["Fungicida", "Inseticida", "Herbicida", "Acaricida", "Outro"].map((x) => ({ value: x, label: x })), "Fungicida")}</select></label>
              <label>Fabricante<input name="ppFabricante" /></label>
              <label>Princípio ativo<input name="ppIngrediente" /></label>
            </div>
          </div>
        </div>

        <fieldset>
          <legend>Quanto foi aplicado?</legend>
          <div class="form-grid form-grid-3">
            <label>Quantidade total *<input name="quantidade" data-num inputmode="decimal" value="${esc(q.quantidade || "")}" /></label>
            <label>Unidade<select name="unidade"></select></label>
            <label>Custo total (R$)<input name="custo" data-num inputmode="decimal" placeholder="Opcional" /></label>
          </div>
          <p class="hint" id="porHa"></p>
          <button type="button" class="btn btn-ghost" id="estimarCusto">${Icon.calculator()} Estimar custo pelo preço de referência</button>
        </fieldset>

        <label>Observação<textarea name="observacao" rows="2" placeholder="Opcional"></textarea></label>

        <div class="form-actions">
          <a class="btn btn-ghost" href="#/aplicacoes">Cancelar</a>
          <button class="btn btn-primary btn-lg" type="submit">${Icon.check()} Salvar aplicação</button>
        </div>
      </form>`;

    const form = el.querySelector("#apForm");
    const $ = (s) => form.querySelector(s);

    const atualizarOcorrencias = () => {
      const tid = $('[name="talhaoId"]').value;
      const lista = Store.ocorrenciasDaConta().filter((o) => o.talhaoId === tid && !o.resolvida);
      $('[name="ocorrenciaId"]').innerHTML = `<option value="">Nenhuma / prevenção</option>` + lista.map((o) => {
        const p = Servicos.praga(o.pragaId);
        return `<option value="${o.id}" ${ocorrencia && ocorrencia.id === o.id ? "selected" : ""}>${esc(p.nomeTecnico)} (${o.severidade}) — ${data(o.dataDeclaracao)}</option>`;
      }).join("");
    };

    const atualizar = () => {
      const f = UI.lerForm(form);
      form.querySelectorAll("[data-cat]").forEach((d) => (d.hidden = d.dataset.cat !== f.categoria));
      form.querySelector("[data-outro-corretivo]").hidden = f.produtoCorretivo !== "outro";
      form.querySelectorAll("[data-outro-fert]").forEach((d) => (d.hidden = f.produtoFertilizante !== "FERT-02"));
      form.querySelector("[data-novo-produto]").hidden = f.produtoDefensivo !== "novo";
      // Ao trocar de categoria, volta para a unidade padrão dela (t para calcário,
      // kg para adubo, L para defensivo) para não interpretar 20 t como 20 kg.
      const un = $('[name="unidade"]');
      if (form.dataset.categoria !== f.categoria) {
        const unidades = CATEGORIAS[f.categoria].unidades;
        un.innerHTML = UI.opcoes(unidades.map((u) => ({ value: u, label: u })), unidades[0]);
        form.dataset.categoria = f.categoria;
      }
      const t = Store.talhao(f.talhaoId);
      $("#porHa").textContent = t && f.quantidade > 0 ? `= ${num(f.quantidade / t.areaHectares)} ${un.value}/ha nos ${num(t.areaHectares)} ha do ${t.nome}` : "";
    };

    form.addEventListener("input", atualizar);
    form.addEventListener("change", (e) => { if (e.target.name === "talhaoId") atualizarOcorrencias(); atualizar(); });
    form.querySelectorAll("[data-formula]").forEach((b) => b.addEventListener("click", () => {
      const [n, p, k] = b.dataset.formula.split("-");
      $('[name="fn"]').value = n; $('[name="fp"]').value = p; $('[name="fk"]').value = k;
      $('[name="nomeFertilizante"]').value = `Adubo ${b.dataset.nome}`;
    }));

    $("#estimarCusto").addEventListener("click", () => {
      const f = UI.lerForm(form);
      const precos = Store.precos();
      let preco = null, qtdBase = null;
      if (f.categoria === "corretivo" && f.produtoCorretivo !== "outro") {
        const p = cat.corretivos.find((x) => x.id === f.produtoCorretivo);
        preco = precos[p.id] ?? p.precoReferencia.valor; // R$/t
        qtdBase = f.unidade === "kg" ? f.quantidade / 1000 : f.quantidade;
      } else if (f.categoria === "defensivo" && String(f.produtoDefensivo).startsWith("cat:")) {
        const p = cat.defensivos.find((x) => x.id === f.produtoDefensivo.slice(4));
        preco = precos[p.id] ?? p.precoReferencia.valor; // R$/L
        qtdBase = f.unidade === "mL" ? f.quantidade / 1000 : f.quantidade;
      } else if (f.categoria === "fertilizante") {
        preco = precos[f.produtoFertilizante] ?? null; // R$/kg cadastrado pelo produtor
        qtdBase = f.unidade === "t" ? f.quantidade * 1000 : f.quantidade;
      }
      if (preco == null || !(qtdBase > 0)) {
        UI.toast(preco == null ? "Este produto ainda não tem preço de referência. Cadastre o preço no Catálogo técnico." : "Informe a quantidade primeiro.", "info");
        return;
      }
      $('[name="custo"]').value = (preco * qtdBase).toFixed(2);
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const f = UI.lerForm(form);
      const ap = UI.tentar(form, () => {
        const dados = { talhaoId: f.talhaoId, data: f.data, categoria: f.categoria, quantidade: f.quantidade, unidade: f.unidade, custo: f.custo, observacao: f.observacao };
        if (f.categoria === "corretivo") {
          if (f.produtoCorretivo === "outro") dados.nomeProduto = f.nomeCorretivo;
          else { dados.produtoId = f.produtoCorretivo; dados.nomeProduto = cat.corretivos.find((p) => p.id === f.produtoCorretivo).nome; }
        } else if (f.categoria === "fertilizante") {
          dados.produtoId = f.produtoFertilizante;
          if (f.produtoFertilizante === "FERT-01") { dados.nomeProduto = "NPK 15-00-10 (formação)"; dados.formulacao = { n: 15, p: 0, k: 10 }; }
          else {
            if ([f.fn, f.fp, f.fk].some((x) => x === null || x < 0) || f.fn + f.fp + f.fk > 100) throw new Store.RegraError("RF-02", "Confira a fórmula N-P-K: cada valor entre 0 e 100, somando no máximo 100.");
            dados.formulacao = { n: f.fn, p: f.fp, k: f.fk };
            dados.nomeProduto = f.nomeFertilizante || `Adubo ${f.fn}-${f.fp}-${f.fk}`;
          }
        } else {
          dados.ocorrenciaId = f.ocorrenciaId || null;
          if (f.produtoDefensivo === "novo") {
            if (!f.ppNome) throw new Store.RegraError("RF-13", "Informe o nome do produto novo.");
            const o = dados.ocorrenciaId && Store.ocorrenciasDaConta().find((x) => x.id === dados.ocorrenciaId);
            const pp = Store.cadastrarProdutoPersonalizado({ nome: f.ppNome, categoria: f.ppCategoria, fabricante: f.ppFabricante, ingredienteAtivo: f.ppIngrediente, unidade: "L", pragasAlvo: o ? [o.pragaId] : [] });
            dados.produtoPersonalizadoId = pp.id;
            dados.nomeProduto = pp.nome;
          } else if (f.produtoDefensivo.startsWith("pp:")) {
            const pp = personalizados.find((p) => p.id === f.produtoDefensivo.slice(3));
            dados.produtoPersonalizadoId = pp.id;
            dados.nomeProduto = pp.nome;
          } else {
            const p = cat.defensivos.find((x) => x.id === f.produtoDefensivo.slice(4));
            dados.produtoId = p.id;
            dados.nomeProduto = p.nome.split(" (")[0];
          }
        }
        return Store.registrarAplicacao(dados);
      });
      if (!ap) return;
      App.atualizarIndicador();
      mostrarResultadoAplicacao(ap);
    });

    atualizarOcorrencias();
    atualizar();
  };

  // RF-04 + RF-15: logo após salvar, mostra a comparação e os alertas gerados.
  function mostrarResultadoAplicacao(ap) {
    const r = Servicos.verificarAplicacao(ap);
    const offline = ap.pendenteSync;
    UI.modal({
      titulo: "Aplicação registrada",
      corpo: `
        ${offline ? `<div class="banner-offline">${Icon.wifiOff()}<span>Salva no aparelho. Será sincronizada quando a internet voltar.</span></div>` : ""}
        ${r.itens.length ? `<h3 class="section-title">Comparação com o recomendado</h3>${r.itens.map(UI.ratioBar).join("")}` : `<p class="muted">Sem recomendação técnica para comparar este insumo (produto fora do catálogo ou sem dose de bula).</p>`}
        ${r.alertas.length ? `<div class="risk risk-geada">${Icon.alertTriangle()}<span>${r.alertas.length} alerta(s) gerado(s): ${r.alertas.map((a) => esc(a.descricao)).join(" ")}</span></div>` : ""}
        ${UI.disclaimer()}`,
      acoes: `<a class="btn btn-ghost" href="#/aplicacoes/nova?talhao=${ap.talhaoId}" data-close>Registrar outra</a>
              <a class="btn btn-primary" href="#/talhoes/${ap.talhaoId}" data-close>Ver o talhão</a>`,
    });
  }

  /* ================================================================== */
  /* Pragas e doenças                                                    */
  /* ================================================================== */

  // RF-12 — resumo da dose recomendada para uma ocorrência.
  V.resumoDose = function (o, talhaoOverride, { completo = false } = {}) {
    const t = talhaoOverride || Store.talhao(o.talhaoId);
    const p = Servicos.praga(o.pragaId);
    const r = Servicos.doseOcorrencia(o, t);
    const validos = r.oficiais.filter((x) => !x.restrito);
    const restritos = r.oficiais.filter((x) => x.restrito);
    const principal = validos.find((x) => !x.semDose) || validos[0];

    const linhaProduto = (d, destaque) => `
      <div class="dose-item ${destaque ? "is-main" : ""}">
        <div class="dose-head">
          <span class="badge badge-oficial">Oficial</span>
          <strong>${esc(d.nome.split(" (")[0])}</strong> <span class="muted">${esc(d.fabricante || "")} · ${esc(d.categoria)}</span>
        </div>
        ${d.semDose
          ? `<p class="small">Dose para café não disponível no catálogo — consulte a bula vigente do produto.</p>`
          : `<p class="dose-line"><strong>${num(d.doseHa, 3)} ${esc(d.unidade)}</strong>${d.faixa ? ` <span class="muted">(bula: ${num(d.faixa.min)} a ${num(d.faixa.max)})</span>` : ""}
               → <strong>${num(d.totalL)} L</strong> para ${num(t.areaHectares)} ha${d.caldaTotalL ? ` · calda: ${num(d.caldaHa, 0)} L/ha (${num(d.caldaTotalL, 0)} L no total)` : ""}${d.custoEstimado != null ? ` · custo estimado ${moeda(d.custoEstimado)}` : ""}</p>`}
        ${completo && d.observacao ? `<p class="small muted">${esc(d.observacao)}</p>` : ""}
        ${completo && d.maxAplicacoesPorCiclo ? `<p class="small muted">Máximo de ${d.maxAplicacoesPorCiclo} aplicações por ciclo.</p>` : ""}
      </div>`;

    return `
      <div class="dose-box">
        <p class="dose-title">${esc(p.nomeTecnico)} · severidade <span class="badge sev-${o.severidade}">${o.severidade}</span></p>
        ${r.semRecomendacaoOficial
          ? `<div class="tip">${Icon.info()}<span>Não há recomendação oficial no catálogo técnico para <strong>${esc(p.nomeTecnico)}</strong>${restritos.length ? " que possa ser usada na sua região" : ""}. Você pode registrar manualmente o produto aplicado.</span></div>`
          : linhaProduto(principal, true) + (completo ? validos.filter((x) => x !== principal).map((d) => linhaProduto(d, false)).join("") : validos.length > 1 ? `<p class="small muted">+ ${validos.length - 1} outra(s) opção(ões) no catálogo.</p>` : "")}
        ${restritos.map((d) => `<div class="risk risk-geada">${Icon.alertTriangle()}<span><strong>${esc(d.nome)}</strong>: ${esc(d.motivoRestricao)} Não recomendado para ${esc(t.localizacao.uf)}.</span></div>`).join("")}
        ${r.complementares.map((c) => `
          <div class="dose-item">
            <div class="dose-head"><span class="badge badge-recorrente">Recorrente</span> <strong>${esc(c.nome)}</strong></div>
            <p class="small muted">Sugestão complementar: produto usado com frequência por outros produtores para esta praga. Não substitui a recomendação oficial.</p>
          </div>`).join("")}
        ${completo ? `<div class="quick-actions">
          ${principal && !principal.semDose ? `<a class="btn btn-primary" href="#/aplicacoes/nova?talhao=${t.id}&ocorrencia=${o.id}&produto=${principal.produtoId}&quantidade=${principal.totalL}">${Icon.droplet()} Registrar esta aplicação</a>` : ""}
          <a class="btn btn-soft" href="#/aplicacoes/nova?talhao=${t.id}&ocorrencia=${o.id}">Registrar outro produto</a>
        </div>` : ""}
      </div>`;
  };

  V.itemOcorrencia = function (o, { compacto = false } = {}) {
    const t = Store.talhao(o.talhaoId);
    const p = Servicos.praga(o.pragaId);
    return `
      <div class="pest-item ${o.resolvida ? "is-resolved" : ""}">
        <div class="pest-head">
          <span class="pest-name">${esc(p.nomeTecnico)} <span class="pest-popular">(${esc(p.nomesPopulares[0])})</span></span>
          <span>${o.resolvida ? `<span class="badge badge-neutral">resolvida</span>` : `<span class="badge sev-${o.severidade}">${o.severidade}</span>`}</span>
        </div>
        <div class="pest-meta">${compacto ? "" : Icon.leaf()}<span>${compacto ? "" : `${esc(rotuloTalhao(t))} · `}declarada em ${data(o.dataDeclaracao)}${o.observacao ? ` · “${esc(o.observacao)}”` : ""}</span></div>
        ${o.resolvida ? "" : V.resumoDose(o, t)}
        ${compacto || o.resolvida ? "" : `<div class="quick-actions">
          <button class="btn btn-ghost" data-ver-dose="${o.id}">Ver dose completa</button>
          <a class="btn btn-ghost" href="#/aplicacoes/nova?talhao=${t.id}&ocorrencia=${o.id}">${Icon.droplet()} Registrar aplicação</a>
          <button class="btn btn-ghost" data-resolver="${o.id}">${Icon.check()} Marcar como resolvida</button>
        </div>`}
      </div>`;
  };

  function mostrarDoseCompleta(o) {
    UI.modal({ titulo: "Dose recomendada", largo: true, corpo: V.resumoDose(o, null, { completo: true }) + UI.disclaimer() });
  }

  V.pragas = function (el) {
    App.setTitulo("Pragas e doenças", "Declare o que apareceu na lavoura e veja a dose recomendada");
    const ocorr = Store.ocorrenciasDaConta();
    const ativas = ocorr.filter((o) => !o.resolvida);
    const resolvidas = ocorr.filter((o) => o.resolvida);
    const pp = Store.state.produtosPersonalizados;
    const cfg = Store.state.config.promocao;

    el.innerHTML = `
      <div class="toolbar">
        <p class="muted">${ativas.length} ocorrência(s) ativa(s)</p>
        <a class="btn btn-primary btn-lg" href="#/pragas/declarar">${Icon.plus()} Declarar praga ou doença</a>
      </div>

      <section class="card">
        <div class="card-header"><h2>Ocorrências ativas</h2></div>
        ${ativas.length ? ativas.map((o) => V.itemOcorrencia(o)).join("") : UI.emptyState("bug", "Nenhuma ocorrência ativa", "Quando notar uma praga ou doença, declare aqui para receber a dose de defensivo recomendada.")}
        ${ativas.length ? UI.footnote(UI.DISCLAIMER_TEXT) : ""}
      </section>

      ${resolvidas.length ? `<section class="card"><details><summary class="summary-title">Resolvidas (${resolvidas.length})</summary>${resolvidas.map((o) => V.itemOcorrencia(o)).join("")}</details></section>` : ""}

      <section class="card">
        <div class="card-header"><h2>Produtos cadastrados por produtores</h2>
          <p class="card-subtitle">Produtos fora da base oficial (RF-13). Viram "Recorrente" quando usados por ${cfg.minProdutores} produtores diferentes, com pelo menos ${cfg.minAplicacoesPorProdutor} aplicações cada.</p></div>
        ${pp.length ? `<div class="table-wrap"><table class="table">
          <thead><tr><th>Produto</th><th>Tipo</th><th>Alvos</th><th>Produtores que usam</th><th>Status</th></tr></thead>
          <tbody>${pp.map((p) => `<tr>
            <td><strong>${esc(p.nome)}</strong>${p.ingredienteAtivo ? `<br><span class="muted small">${esc(p.ingredienteAtivo)}</span>` : ""}</td>
            <td>${esc(p.categoria)}</td>
            <td>${(p.pragasAlvo || []).map((id) => esc(Servicos.praga(id).nomeTecnico)).join(", ") || "—"}</td>
            <td>${p.produtoresQualificados || 0} de ${cfg.minProdutores} necessários</td>
            <td><span class="badge ${p.status === "Recorrente" ? "badge-recorrente" : "badge-neutral"}">${p.status}</span></td>
          </tr>`).join("")}</tbody></table></div>` : `<p class="muted">Nenhum produto personalizado cadastrado.</p>`}
        ${UI.footnote("Mesmo quando “Recorrente”, o produto aparece apenas como sugestão complementar — a recomendação oficial sempre prevalece (RN-08).")}
      </section>`;

    el.querySelectorAll("[data-ver-dose]").forEach((b) => b.addEventListener("click", () => mostrarDoseCompleta(ocorr.find((o) => o.id === b.dataset.verDose))));
    el.querySelectorAll("[data-resolver]").forEach((b) => b.addEventListener("click", () => { Store.resolverOcorrencia(b.dataset.resolver); UI.toast("Ocorrência marcada como resolvida."); App.render(); }));
  };

  // Caso de uso 5.1 — Declarar ocorrência de praga/doença.
  V.declararPraga = function (el, _p, q) {
    App.setTitulo("Declarar praga ou doença", "Passo a passo: talhão → o que apareceu → gravidade");
    if (!Store.talhoes().length) return App.ir("#/talhoes/novo");
    let selecionada = null;

    el.innerHTML = `
      <form class="card form" id="pragaForm" novalidate>
        <fieldset>
          <legend><span class="step">1</span> Em qual talhão?</legend>
          <select name="talhaoId">${UI.opcoesTalhao(q.talhao)}</select>
        </fieldset>
        <fieldset>
          <legend><span class="step">2</span> O que apareceu?</legend>
          <label class="search-box">${Icon.search()}<input type="search" id="buscaPraga" placeholder="Digite o nome, até o nome popular (ex.: olho de pomba, mineiro, mato)" autocomplete="off" /></label>
          <div id="resultadosPraga" class="pest-results"></div>
        </fieldset>
        <fieldset>
          <legend><span class="step">3</span> Qual a gravidade?</legend>
          <div class="choice-grid choice-grid-3">
            ${SEVERIDADES.map((s) => `
              <label class="choice sev-choice sev-${s.id}">
                <input type="radio" name="severidade" value="${s.id}" />
                <span class="choice-title">${s.nome}</span>
                <span class="choice-help">${s.ajuda}</span>
              </label>`).join("")}
          </div>
        </fieldset>
        <label>Observação<textarea name="observacao" rows="2" placeholder="Opcional: onde viu, quantas plantas…"></textarea></label>
        <div class="form-actions">
          <a class="btn btn-ghost" href="#/pragas">Cancelar</a>
          <button class="btn btn-primary btn-lg" type="submit">${Icon.check()} Confirmar e ver a dose</button>
        </div>
      </form>`;

    const form = el.querySelector("#pragaForm");
    const res = el.querySelector("#resultadosPraga");

    const cardPraga = (p) => `
      <label class="choice pest-choice">
        <input type="radio" name="pragaId" value="${p.id}" ${selecionada === p.id ? "checked" : ""} />
        <span class="choice-title">${esc(p.nomeTecnico)} <span class="muted small">· ${esc(p.tipo)}</span></span>
        <span class="choice-help"><em>${esc(p.nomeCientifico)}</em>${p.apelidoEncontrado ? ` · conhecido como “${esc(p.apelidoEncontrado)}”` : ` · também: ${esc(p.nomesPopulares.slice(0, 3).join(", "))}`}</span>
        <span class="choice-help">${esc(p.sintoma)}</span>
      </label>`;

    const buscar = () => {
      const termo = el.querySelector("#buscaPraga").value;
      const r = Servicos.buscarPraga(termo);
      if (r.resultados.length) {
        res.innerHTML = `<div class="choice-grid">${r.resultados.map(cardPraga).join("")}</div>`;
      } else {
        // Fluxo alternativo 2a: sugere os nomes técnicos mais próximos.
        res.innerHTML = `<p class="no-data-inline">${Icon.info()} Nada encontrado para “${esc(termo)}”. Você quis dizer:</p>
          <div class="choice-grid">${r.sugestoes.map(cardPraga).join("")}</div>`;
      }
    };
    el.querySelector("#buscaPraga").addEventListener("input", buscar);
    res.addEventListener("change", (e) => { if (e.target.name === "pragaId") selecionada = e.target.value; });
    buscar();

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const f = UI.lerForm(form);
      const o = UI.tentar(form, () => {
        // Exceção 4a: a severidade é obrigatória.
        if (!selecionada) throw new Store.RegraError("RF-10", "Escolha a praga ou doença na lista.");
        if (!f.severidade) throw new Store.RegraError("RF-10", "Escolha a gravidade (leve, moderada ou severa) antes de confirmar.");
        return Store.declararOcorrencia({ talhaoId: f.talhaoId, pragaId: selecionada, severidade: f.severidade, observacao: f.observacao });
      });
      if (!o) return;
      // Passo 6: executa Calcular Dose de Defensivo (RF-12) e guarda o resultado.
      const dose = Servicos.doseOcorrencia(o);
      o.recomendacao = { geradaEm: new Date().toISOString(), oficiais: dose.oficiais.map((d) => ({ produtoId: d.produtoId, doseHa: d.doseHa, unidade: d.unidade, totalL: d.totalL })) };
      Store.save();
      UI.toast("Ocorrência registrada.");
      App.ir("#/pragas");
      mostrarDoseCompleta(o);
    });
  };

  /* ================================================================== */
  /* Safras e colheitas (RF-07)                                          */
  /* ================================================================== */

  const QUALIDADES = ["Tipo 2", "Tipo 3", "Tipo 4", "Tipo 5", "Tipo 6", "Tipo 7", "Tipo 8"];
  const BEBIDAS = ["estritamente mole", "mole", "apenas mole", "dura", "riada", "rio", "rio zona"];

  V.safras = function (el) {
    App.setTitulo("Safras e colheitas", "Encerre a safra registrando a colheita e a produtividade");
    const lista = Store.talhoes();
    if (!lista.length) return App.ir("#/talhoes");

    el.innerHTML = lista.map((t) => {
      const safras = Store.safrasDo(t.id);
      const ativa = safras.find((s) => s.status !== "Concluída");
      const concluidas = safras.filter((s) => s.status === "Concluída").reverse();
      return `
        <section class="card">
          <div class="card-header row-between">
            <div><h2>${esc(rotuloTalhao(t))}</h2><p class="card-subtitle">${num(t.areaHectares)} ha · ${esc(UI.nomeFase(t))}</p></div>
            ${ativa
              ? `<button class="btn btn-primary" data-colher="${ativa.id}">${Icon.sprout()} Registrar colheita</button>`
              : `<button class="btn btn-primary" data-iniciar="${t.id}">${Icon.plus()} Iniciar nova safra</button>`}
          </div>
          ${ativa ? `<p class="season-line">${Icon.calendar()} Safra em andamento desde <strong>${data(ativa.dataInicio)}</strong>
            ${ativa.produtividadeEsperadaSacasHa ? ` · meta de ${num(ativa.produtividadeEsperadaSacasHa)} sc/ha` : ""}
            ${ativa.dataColheitaPrevista ? ` · colheita prevista ${data(ativa.dataColheitaPrevista)}` : ""}</p>` : `<p class="muted">Nenhuma safra em andamento.</p>`}
          ${concluidas.length ? `<div class="table-wrap"><table class="table table-compact">
            <thead><tr><th>Safra</th><th>Colheita</th><th>Produtividade</th><th>Meta</th><th>Qualidade</th><th>Custo/ha</th></tr></thead>
            <tbody>${concluidas.map((s) => `<tr>
              <td>${s.dataInicio.slice(0, 4)}/${s.colheita.dataColheita.slice(2, 4)}</td>
              <td>${data(s.colheita.dataColheita)}</td>
              <td><strong>${num(s.colheita.produtividadeSacasHa)} sc/ha</strong></td>
              <td>${s.produtividadeEsperadaSacasHa ? `${num(s.produtividadeEsperadaSacasHa)} sc/ha` : "—"}</td>
              <td>${esc(s.colheita.qualidadeGrao || "—")}</td>
              <td>${moeda(Servicos.custoSafra(t, s).porHa, 0)}</td>
            </tr>`).join("")}</tbody></table></div>
            <a class="btn btn-ghost" href="#/talhoes/${t.id}">Ver sugestão de reajuste ${Icon.arrowRight()}</a>` : ""}
        </section>`;
    }).join("");

    el.querySelectorAll("[data-colher]").forEach((b) => b.addEventListener("click", () => formColheita(b.dataset.colher)));
    el.querySelectorAll("[data-iniciar]").forEach((b) => b.addEventListener("click", () => formSafra(b.dataset.iniciar)));
  };

  function formColheita(safraId) {
    const s = Store.state.safras.find((x) => x.id === safraId);
    const t = Store.talhao(s.talhaoId);
    const m = UI.modal({
      titulo: `Registrar colheita — ${esc(t.nome)}`,
      corpo: `<form class="form" id="colheitaForm" novalidate>
        <label>Data da colheita *<input type="date" name="dataColheita" min="${s.dataInicio}" max="${Store.hojeISO()}" value="${Store.hojeISO()}" /></label>
        <label>Produtividade obtida (sacas beneficiadas por hectare) *<input name="produtividadeSacasHa" data-num inputmode="decimal" /></label>
        <div class="form-grid form-grid-2">
          <label>Tipo<select name="tipo">${UI.opcoes(QUALIDADES.map((x) => ({ value: x, label: x })), "Tipo 6", { vazio: "—" })}</select></label>
          <label>Bebida<select name="bebida">${UI.opcoes(BEBIDAS.map((x) => ({ value: x, label: x })), "dura", { vazio: "—" })}</select></label>
        </div>
        <p class="muted small">A data não pode ser anterior ao início da safra (${data(s.dataInicio)}) nem à última aplicação registrada no talhão (RN-09).</p>
      </form>`,
      acoes: `<button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" id="salvarColheita">Salvar colheita</button>`,
    });
    m.querySelector("#salvarColheita").onclick = () => {
      const form = m.querySelector("#colheitaForm");
      const f = UI.lerForm(form);
      const ok = UI.tentar(form, () => Store.registrarColheita(safraId, {
        dataColheita: f.dataColheita,
        produtividadeSacasHa: f.produtividadeSacasHa,
        qualidadeGrao: [f.tipo, f.bebida ? `bebida ${f.bebida}` : ""].filter(Boolean).join(" · "),
      }));
      if (ok) { UI.fecharModal(); UI.toast("Colheita registrada. A sugestão de reajuste já está disponível no talhão."); App.render(); }
    };
  }

  function formSafra(talhaoId) {
    const t = Store.talhao(talhaoId);
    const m = UI.modal({
      titulo: `Iniciar safra — ${esc(t.nome)}`,
      corpo: `<form class="form" id="safraForm" novalidate>
        <label>Data de início *<input type="date" name="dataInicio" value="${Store.hojeISO()}" max="${Store.hojeISO()}" /></label>
        <label>Meta de produtividade (sacas/ha)<input name="produtividadeEsperadaSacasHa" data-num inputmode="decimal" value="${t.produtividadeEsperadaSacasHa ?? ""}" /></label>
        <label>Colheita prevista<input type="date" name="dataColheitaPrevista" /></label>
      </form>`,
      acoes: `<button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" id="salvarSafra">Iniciar safra</button>`,
    });
    m.querySelector("#salvarSafra").onclick = () => {
      const form = m.querySelector("#safraForm");
      const f = UI.lerForm(form);
      const ok = UI.tentar(form, () => Store.iniciarSafra(talhaoId, { ...f, dataColheitaPrevista: f.dataColheitaPrevista || null }));
      if (ok) { UI.fecharModal(); UI.toast("Safra iniciada."); App.render(); }
    };
  }
})(window);
