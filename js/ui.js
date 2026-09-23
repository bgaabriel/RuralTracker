// Utilitários de interface compartilhados pelas telas.
(function (root) {
  const DISCLAIMER_TEXT =
    "Esta é uma orientação gerada pelo sistema a partir de fontes técnicas (Agrofit/MAPA, Embrapa, bulas). Ela não substitui a avaliação de um engenheiro agrônomo nem a leitura da bula do produto que você vai usar.";

  // Sempre escapar texto digitado pelo usuário antes de ir para innerHTML.
  function esc(v) {
    return String(v === null || v === undefined ? "" : v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  const num = (v, d = 2) =>
    typeof v === "number" && Number.isFinite(v) ? v.toLocaleString("pt-BR", { maximumFractionDigits: d }) : "—";
  const moeda = (v, d = 2) =>
    typeof v === "number" && Number.isFinite(v)
      ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: d, minimumFractionDigits: d > 0 ? 2 : 0 })
      : "—";
  const data = (iso) => (iso ? String(iso).slice(0, 10).split("-").reverse().join("/") : "—");
  const dataHora = (iso) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");

  function nomeFase(t) {
    const c = root.CULTURAS[t.cultura || "cafe"];
    const f = c.fases.find((x) => x.id === t.fase);
    return f ? f.nome : t.fase;
  }
  const rotuloTalhao = (t) => `${t.nome} — ${t.variedade || root.CULTURAS[t.cultura || "cafe"].nome}`;

  function disclaimer() {
    return `<div class="disclaimer" role="note">${Icon.info()}<span><strong>Atenção:</strong> ${DISCLAIMER_TEXT}</span></div>`;
  }

  function footnote(text) {
    return `<div class="card-footnote"><span class="nav-icon">${Icon.info()}</span><span>${text}</span></div>`;
  }

  function emptyState(icon, titulo, texto, acao = "") {
    return `
      <div class="empty-state">
        <span class="empty-state-icon">${Icon[icon]()}</span>
        <p class="empty-state-title">${titulo}</p>
        <p class="empty-state-text">${texto}</p>
        ${acao}
      </div>`;
  }

  const STATUS_TEXTO = {
    ok: "Dentro da faixa recomendada",
    excesso: "acima do recomendado — possível desperdício",
    deficiencia: "abaixo do recomendado — possível deficiência",
    parcial: "abaixo do total da safra — adubação ainda em andamento",
  };

  function statusComparacao(i) {
    if (i.status === "ok") return STATUS_TEXTO.ok;
    return `${Math.abs(i.desvio)}% ${STATUS_TEXTO[i.status]}`;
  }

  // Barra aplicado x recomendado (RF-04). A marca vertical = 100% do recomendado.
  function ratioBar(i) {
    const trackMax = 150;
    const fill = (Math.min(i.pct, trackMax) / trackMax) * 100;
    const alvo = (100 / trackMax) * 100;
    const off = i.status === "excesso" || i.status === "deficiencia";
    const faixa = i.faixa ? ` (bula: ${num(i.faixa.min)} a ${num(i.faixa.max)})` : "";
    return `
      <div class="compare-row">
        <div class="compare-row-head">
          <span class="name">${esc(i.insumo)}${i.data ? ` <span class="muted">· ${data(i.data)}</span>` : ""}</span>
          <span class="values">${num(i.aplicado)} de ${num(i.recomendado)} ${esc(i.unidade)}${faixa}</span>
        </div>
        <div class="compare-track" role="img" aria-label="${i.pct}% do recomendado">
          <div class="compare-fill ${off ? "is-off" : i.status === "parcial" ? "is-partial" : ""}" style="width:${fill}%"></div>
          <div class="compare-target" style="left:${alvo}%"></div>
        </div>
        <div class="compare-status ${off ? "is-off" : ""}">${i.pct}% · ${statusComparacao(i)}</div>
      </div>`;
  }

  /* ---------------- Toast ---------------- */
  function toast(msg, tipo = "ok") {
    let box = document.getElementById("toasts");
    if (!box) {
      box = document.createElement("div");
      box.id = "toasts";
      box.className = "toasts";
      box.setAttribute("aria-live", "polite");
      document.body.appendChild(box);
    }
    const el = document.createElement("div");
    el.className = `toast toast-${tipo}`;
    el.innerHTML = `${tipo === "erro" ? Icon.alertTriangle() : tipo === "info" ? Icon.info() : Icon.checkCircle()}<span>${esc(msg)}</span>`;
    box.appendChild(el);
    setTimeout(() => el.classList.add("is-leaving"), 4200);
    setTimeout(() => el.remove(), 4600);
  }

  /* ---------------- Modal ---------------- */
  function modal({ titulo, corpo, acoes = "", largo = false, onMount }) {
    fecharModal();
    const wrap = document.createElement("div");
    wrap.className = "modal-backdrop";
    wrap.id = "modal";
    wrap.innerHTML = `
      <div class="modal ${largo ? "is-wide" : ""}" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
        <div class="modal-head">
          <h2 id="modalTitle">${titulo}</h2>
          <button class="icon-btn" data-close aria-label="Fechar">${Icon.x()}</button>
        </div>
        <div class="modal-body">${corpo}</div>
        ${acoes ? `<div class="modal-actions">${acoes}</div>` : ""}
      </div>`;
    document.body.appendChild(wrap);
    wrap.addEventListener("click", (e) => {
      if (e.target === wrap || e.target.closest("[data-close]")) fecharModal();
    });
    const onKey = (e) => { if (e.key === "Escape") fecharModal(); };
    document.addEventListener("keydown", onKey);
    wrap._onKey = onKey;
    const foco = wrap.querySelector("input, select, textarea, button:not([data-close])");
    if (foco) foco.focus();
    if (onMount) onMount(wrap);
    return wrap;
  }

  function fecharModal() {
    const m = document.getElementById("modal");
    if (m) {
      document.removeEventListener("keydown", m._onKey);
      m.remove();
    }
  }

  function confirmar(mensagem, { textoOk = "Confirmar", perigo = false } = {}) {
    return new Promise((resolve) => {
      let respondeu = false;
      const m = modal({
        titulo: "Confirmar",
        corpo: `<p class="lead">${mensagem}</p>`,
        acoes: `<button class="btn btn-ghost" data-close>Cancelar</button><button class="btn ${perigo ? "btn-danger" : "btn-primary"}" id="okConfirm">${textoOk}</button>`,
      });
      m.querySelector("#okConfirm").addEventListener("click", () => { respondeu = true; fecharModal(); resolve(true); });
      const obs = new MutationObserver(() => {
        if (!document.body.contains(m)) { obs.disconnect(); if (!respondeu) resolve(false); }
      });
      obs.observe(document.body, { childList: true });
    });
  }

  /* ---------------- Formulários ---------------- */

  // Lê um <form>: campos com data-num viram número (ou null se vazios),
  // checkboxes viram boolean.
  function lerForm(form) {
    const out = {};
    form.querySelectorAll("input, select, textarea").forEach((el) => {
      if (!el.name) return;
      if (el.type === "checkbox") out[el.name] = el.checked;
      else if (el.type === "radio") { if (el.checked) out[el.name] = el.value; else if (!(el.name in out)) out[el.name] = null; }
      else if (el.dataset.num !== undefined) {
        const v = String(el.value).replace(",", ".").trim();
        out[el.name] = v === "" ? null : Number(v);
      } else out[el.name] = el.value.trim();
    });
    return out;
  }

  function erroForm(form, msg) {
    let el = form.querySelector(".form-error");
    if (!el) {
      el = document.createElement("div");
      el.className = "form-error";
      el.setAttribute("role", "alert");
      form.prepend(el);
    }
    el.innerHTML = msg ? `${Icon.alertTriangle()}<span>${esc(msg)}</span>` : "";
    el.hidden = !msg;
    if (msg) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // Executa uma ação que pode violar uma regra de negócio e mostra o erro.
  function tentar(form, fn) {
    try {
      erroForm(form, "");
      return fn();
    } catch (e) {
      if (e instanceof Store.RegraError) {
        erroForm(form, `${e.message} (${e.codigo})`);
        return undefined;
      }
      throw e;
    }
  }

  const opcoes = (lista, valor, { vazio } = {}) =>
    (vazio ? `<option value="">${esc(vazio)}</option>` : "") +
    lista.map((o) => `<option value="${esc(o.value)}" ${String(o.value) === String(valor ?? "") ? "selected" : ""}>${esc(o.label)}</option>`).join("");

  const opcoesTalhao = (valor, vazio = "Selecione o talhão") =>
    opcoes(Store.talhoes().map((t) => ({ value: t.id, label: rotuloTalhao(t) })), valor, { vazio });

  function baixar(nome, conteudo, tipo) {
    const blob = new Blob([conteudo], { type: tipo });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  root.UI = {
    DISCLAIMER_TEXT, esc, num, moeda, data, dataHora, nomeFase, rotuloTalhao, disclaimer, footnote, emptyState,
    statusComparacao, ratioBar, toast, modal, fecharModal, confirmar, lerForm, erroForm, tentar, opcoes, opcoesTalhao, baixar,
  };
})(typeof window !== "undefined" ? window : globalThis);
