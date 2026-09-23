// Shell da aplicação: roteamento por hash, layout, sessão e status de conexão.
(function (root) {
  const { esc } = UI;

  // Itens do menu. O núcleo do sistema (v3) vem primeiro: talhões, cálculo de
  // insumos, aplicações e pragas. O painel é uma visão consolidada secundária.
  const NAV = [
    { id: "talhoes", href: "#/talhoes", icon: "leaf", label: "Meus talhões" },
    { id: "calculo", href: "#/calculo", icon: "calculator", label: "Calcular insumos" },
    { id: "aplicacoes", href: "#/aplicacoes", icon: "droplet", label: "Aplicações" },
    { id: "pragas", href: "#/pragas", icon: "bug", label: "Pragas e doenças" },
    { id: "safras", href: "#/safras", icon: "sprout", label: "Safras e colheitas" },
    { sep: true },
    { id: "painel", href: "#/painel", icon: "layers", label: "Painel geral" },
    { id: "alertas", href: "#/alertas", icon: "bell", label: "Alertas" },
    { id: "relatorios", href: "#/relatorios", icon: "file", label: "Relatórios" },
    { id: "catalogo", href: "#/catalogo", icon: "book", label: "Catálogo técnico" },
    { sep: true },
    { id: "equipe", href: "#/equipe", icon: "users", label: "Equipe" },
    { id: "conta", href: "#/conta", icon: "user", label: "Minha conta" },
    { id: "admin", href: "#/admin", icon: "settings", label: "Administração", soAdmin: true },
  ];

  const ROTAS = [
    { re: /^\/entrar$/, view: "login", publica: true },
    { re: /^\/cadastro$/, view: "cadastro", publica: true },
    { re: /^\/talhoes$/, view: "talhoes", nav: "talhoes" },
    { re: /^\/talhoes\/novo$/, view: "talhaoForm", nav: "talhoes" },
    { re: /^\/talhoes\/([^/]+)\/editar$/, view: "talhaoForm", nav: "talhoes" },
    { re: /^\/talhoes\/([^/]+)$/, view: "talhaoDetalhe", nav: "talhoes" },
    { re: /^\/calculo(?:\/([^/]+))?$/, view: "calculo", nav: "calculo" },
    { re: /^\/aplicacoes$/, view: "aplicacoes", nav: "aplicacoes" },
    { re: /^\/aplicacoes\/nova$/, view: "aplicacaoForm", nav: "aplicacoes" },
    { re: /^\/pragas$/, view: "pragas", nav: "pragas" },
    { re: /^\/pragas\/declarar$/, view: "declararPraga", nav: "pragas" },
    { re: /^\/safras$/, view: "safras", nav: "safras" },
    { re: /^\/painel$/, view: "painel", nav: "painel" },
    { re: /^\/alertas$/, view: "alertas", nav: "alertas" },
    { re: /^\/relatorios$/, view: "relatorios", nav: "relatorios" },
    { re: /^\/catalogo$/, view: "catalogo", nav: "catalogo" },
    { re: /^\/equipe$/, view: "equipe", nav: "equipe" },
    { re: /^\/conta$/, view: "conta", nav: "conta" },
    { re: /^\/admin$/, view: "admin", nav: "admin" },
  ];

  function parseHash() {
    const raw = (location.hash || "#/talhoes").slice(1);
    const [path, qs] = raw.split("?");
    const query = Object.fromEntries(new URLSearchParams(qs || ""));
    for (const r of ROTAS) {
      const m = path.match(r.re);
      if (m) return { rota: r, params: m.slice(1).filter((x) => x !== undefined), query, path };
    }
    return null;
  }

  function ir(hash) {
    if (location.hash === hash) render();
    else location.hash = hash;
  }

  /* ---------------- Layout ---------------- */

  function renderShell() {
    const u = Store.usuarioAtual();
    const alertasPend = Store.alertasDaConta().filter((a) => !["lido", "resolvido"].includes(a.status)).length;
    const nav = NAV.filter((n) => !n.soAdmin || Store.ehAdmin())
      .map((n) =>
        n.sep
          ? `<div class="nav-sep"></div>`
          : `<a class="nav-item" href="${n.href}" data-nav="${n.id}">
               <span class="nav-icon">${Icon[n.icon]()}</span><span>${n.label}</span>
               ${n.id === "alertas" && alertasPend ? `<span class="nav-count">${alertasPend}</span>` : ""}
             </a>`
      )
      .join("");

    document.getElementById("app").innerHTML = `
      <div class="app-shell">
        <aside class="sidebar" id="sidebar">
          <div class="brand">
            <span class="brand-mark" aria-hidden="true"></span>
            <span class="brand-name">Rural Tracker</span>
            <button class="icon-btn sidebar-close" id="closeMenu" aria-label="Fechar menu">${Icon.x()}</button>
          </div>
          <nav class="nav" aria-label="Menu principal">${nav}</nav>
          <p class="sidebar-note">Cultura: Café · versão 3</p>
        </aside>
        <div class="sidebar-backdrop" id="sidebarBackdrop"></div>
        <div class="main">
          <header class="topbar">
            <div class="topbar-left">
              <button class="icon-btn menu-btn" id="openMenu" aria-label="Abrir menu">${Icon.menu()}</button>
              <div>
                <h1 class="page-title" id="pageTitle"></h1>
                <p class="page-subtitle" id="pageSubtitle"></p>
              </div>
            </div>
            <div class="topbar-right">
              <div class="sync-indicator" id="syncIndicator"></div>
              <div class="user-chip">
                <span class="user-avatar">${esc(u.nome.split(" ").map((p) => p[0]).slice(0, 2).join(""))}</span>
                <div class="user-meta">
                  <span class="user-name">${esc(u.nome)}</span>
                  <span class="user-role">${u.tipo === "produtor" ? "Produtor" : `Colaborador${u.papel ? " · " + esc(u.papel) : ""}`}</span>
                </div>
                <button class="icon-btn" id="logoutBtn" title="Sair" aria-label="Sair">${Icon.logout()}</button>
              </div>
            </div>
          </header>
          <main class="content" id="view" tabindex="-1"></main>
        </div>
      </div>`;

    const sidebar = document.getElementById("sidebar");
    const fechar = () => sidebar.classList.remove("is-open");
    document.getElementById("openMenu").onclick = () => sidebar.classList.add("is-open");
    document.getElementById("closeMenu").onclick = fechar;
    document.getElementById("sidebarBackdrop").onclick = fechar;
    sidebar.querySelectorAll(".nav-item").forEach((a) => a.addEventListener("click", fechar));
    document.getElementById("logoutBtn").onclick = () => { Store.logout(); ir("#/entrar"); };
    atualizarIndicador();
  }

  function atualizarIndicador() {
    const el = document.getElementById("syncIndicator");
    if (!el) return;
    const pend = Store.pendentesSync().length;
    if (!Store.online()) {
      el.className = "sync-indicator is-offline";
      el.innerHTML = `${Icon.wifiOff()}<span>Sem internet${pend ? ` · ${pend} registro(s) guardado(s) no aparelho` : " · registros ficam salvos no aparelho"}</span>`;
    } else {
      el.className = "sync-indicator";
      el.innerHTML = `<span class="dot"></span><span>Conectado${pend ? ` · sincronizando ${pend}` : " · dados em dia"}</span>`;
    }
  }

  function setTitulo(titulo, sub = "") {
    const t = document.getElementById("pageTitle");
    const s = document.getElementById("pageSubtitle");
    if (t) t.textContent = titulo;
    if (s) s.textContent = sub;
    document.title = `${titulo} · Rural Tracker`;
  }

  // RNF-02: painel, sugestões e alertas exigem conexão ativa.
  function exigeConexao(el, oque) {
    if (Store.online()) return false;
    el.innerHTML = `<section class="card">${UI.emptyState(
      "wifiOff",
      "Esta tela precisa de internet",
      `${oque} depende de conexão ativa. Enquanto estiver sem sinal, você pode continuar <a href="#/aplicacoes/nova">registrando aplicações</a> — elas ficam guardadas no aparelho e são enviadas quando a conexão voltar.`
    )}</section>`;
    return true;
  }

  /* ---------------- Render ---------------- */

  function render() {
    const r = parseHash();
    const logado = !!Store.usuarioAtual();
    if (!r) return ir(logado ? "#/talhoes" : "#/entrar");
    if (!r.rota.publica && !logado) return ir("#/entrar");
    if (r.rota.publica && logado) return ir("#/talhoes");

    const view = Views[r.rota.view];
    if (r.rota.publica) {
      document.getElementById("app").innerHTML = `<div class="auth-shell" id="view"></div>`;
      view(document.getElementById("view"), r.params, r.query);
      return;
    }

    renderShell();
    document.querySelectorAll("[data-nav]").forEach((a) => {
      const ativo = a.dataset.nav === r.rota.nav;
      a.classList.toggle("is-active", ativo);
      if (ativo) a.setAttribute("aria-current", "page");
    });
    const el = document.getElementById("view");
    try {
      view(el, r.params, r.query);
    } catch (e) {
      console.error(e);
      el.innerHTML = `<section class="card">${UI.emptyState("alertTriangle", "Algo deu errado ao abrir esta tela", esc(e.message))}</section>`;
    }
    window.scrollTo(0, 0);
  }

  /* ---------------- Conexão (RNF-02) ---------------- */

  function aoVoltarConexao() {
    const n = Store.sincronizar();
    if (n) UI.toast(`${n} aplicação(ões) registrada(s) sem internet foram sincronizadas.`);
    Servicos.Mensageria.reenviarPendentes();
    Servicos.Clima.atualizarTodos();
    render();
  }

  function init() {
    Store.load();
    window.addEventListener("hashchange", render);
    window.addEventListener("online", aoVoltarConexao);
    window.addEventListener("offline", () => { UI.toast("Você está sem internet. Os registros de aplicação continuam sendo salvos no aparelho.", "info"); render(); });

    if (Store.online() && Store.pendentesSync().length) Store.sincronizar();
    render();

    // RNF-01: atualização periódica do clima (o intervalo em horas é configurável).
    Servicos.Clima.atualizarTodos();
    setInterval(() => Servicos.Clima.atualizarTodos(), 15 * 60 * 1000);

    if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register("sw.js").catch((e) => console.warn("Service worker:", e.message));
    }
  }

  root.App = { ir, render, setTitulo, exigeConexao, atualizarIndicador };
  document.addEventListener("DOMContentLoaded", init);
})(window);
