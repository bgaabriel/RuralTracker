// Armazenamento local e regras de negócio do Rural Tracker.
// Todos os dados ficam no localStorage do navegador, o que permite registrar
// aplicações sem internet (RNF-02). Registros criados offline ficam marcados
// como "pendentes de sincronização" e são sincronizados quando a conexão volta.
(function (root) {
  const STORAGE_KEY = "ruraltracker:v1";

  /* ---------------- SHA-256 (hash de senha — RNF-04) ---------------- */
  function sha256(ascii) {
    const utf8 = unescape(encodeURIComponent(ascii));
    const rotr = (v, n) => (v >>> n) | (v << (32 - n));
    const K = [];
    const H = [];
    let prime = 2;
    const isPrime = (n) => { for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; };
    while (K.length < 64) {
      if (isPrime(prime)) {
        if (H.length < 8) H.push((Math.pow(prime, 1 / 2) * 4294967296) | 0);
        K.push((Math.pow(prime, 1 / 3) * 4294967296) | 0);
      }
      prime++;
    }
    const bytes = [];
    for (let i = 0; i < utf8.length; i++) bytes.push(utf8.charCodeAt(i));
    const bitLen = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    for (let i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (bitLen >>> (i * 8)) & 0xff);
    const h = H.slice();
    for (let off = 0; off < bytes.length; off += 64) {
      const w = new Array(64);
      for (let i = 0; i < 16; i++) w[i] = (bytes[off + i * 4] << 24) | (bytes[off + i * 4 + 1] << 16) | (bytes[off + i * 4 + 2] << 8) | bytes[off + i * 4 + 3];
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      let [a, b, c, d, e, f, g, hh] = h;
      for (let i = 0; i < 64; i++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (hh + S1 + ch + K[i] + w[i]) | 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
      h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
    }
    return h.map((x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
  }

  function novoSalt() {
    const arr = new Uint8Array(16);
    if (root.crypto && root.crypto.getRandomValues) root.crypto.getRandomValues(arr);
    else for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
    return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  const hashSenha = (senha, salt) => sha256(`${salt}:${senha}`);

  /* ---------------- Utilidades ---------------- */
  const uid = (p) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const hojeISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const online = () => (typeof navigator === "undefined" ? true : navigator.onLine !== false);

  class RegraError extends Error {
    constructor(codigo, mensagem) {
      super(mensagem);
      this.codigo = codigo;
    }
  }

  const CONFIG_PADRAO = {
    promocao: { minProdutores: 3, minAplicacoesPorProdutor: 2 }, // RN-07 / RNF-06
    climaIntervaloHoras: 3, // RNF-01
    v2Padrao: 65,
    toleranciaAlertaPct: 20, // RF-15: "significativamente fora da faixa"
    whatsappWebhookUrl: "", // RF-16 / RNF-07
  };

  function estadoVazio() {
    return {
      versao: 1,
      usuarios: [],
      sessao: null,
      talhoes: [],
      safras: [],
      aplicacoes: [],
      ocorrencias: [],
      produtosPersonalizados: [],
      sugestoes: [],
      alertas: [],
      climaCache: {},
      precos: {}, // RF-18: preço de mercado configurável, por conta (contaId -> { produtoId: R$ })
      config: JSON.parse(JSON.stringify(CONFIG_PADRAO)),
    };
  }

  let state = null;

  function load() {
    try {
      const raw = root.localStorage && root.localStorage.getItem(STORAGE_KEY);
      state = raw ? JSON.parse(raw) : null;
    } catch (e) {
      state = null;
    }
    if (!state) {
      state = estadoVazio();
      seed(state);
      save();
    }
    state.config = Object.assign(JSON.parse(JSON.stringify(CONFIG_PADRAO)), state.config || {});
    state.precos = state.precos || {};
    return state;
  }

  function save() {
    try {
      root.localStorage && root.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Falha ao salvar dados locais", e);
    }
  }

  function reset() {
    try { root.localStorage && root.localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
    state = null;
    return load();
  }

  /* ---------------- Conta e acesso (RF-05, RF-06, RN-01, RN-06) ---------------- */

  function usuarioAtual() {
    if (!state.sessao) return null;
    return state.usuarios.find((u) => u.id === state.sessao.usuarioId) || null;
  }

  // Id da conta principal (Produtor) à qual o usuário logado pertence.
  function contaAtualId() {
    const u = usuarioAtual();
    if (!u) return null;
    return u.tipo === "produtor" ? u.id : u.produtorId;
  }

  const ehProdutor = () => { const u = usuarioAtual(); return !!u && u.tipo === "produtor"; };
  const ehAdmin = () => { const u = usuarioAtual(); return !!u && !!u.admin; };

  function exigirProdutor(acao) {
    if (!ehProdutor()) throw new RegraError("RN-06", `Apenas o Produtor (conta principal) pode ${acao}.`);
  }

  function validarNovoUsuario({ nome, email, cpf, senha }) {
    if (!nome || nome.trim().length < 3) throw new RegraError("RF-05", "Informe o nome completo.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "")) throw new RegraError("RF-05", "Informe um e-mail válido.");
    if (!Calc.validarCPF(cpf)) throw new RegraError("RN-01", "CPF inválido. Confira os números digitados.");
    const cpfNorm = Calc.normalizarCPF(cpf);
    if (state.usuarios.some((u) => u.cpf === cpfNorm)) throw new RegraError("RN-01", "Já existe um usuário cadastrado com este CPF.");
    if (state.usuarios.some((u) => u.email.toLowerCase() === email.toLowerCase())) throw new RegraError("RF-05", "Já existe um usuário com este e-mail.");
    if (!senha || senha.length < 6) throw new RegraError("RF-05", "A senha deve ter pelo menos 6 caracteres.");
  }

  function criarUsuario(dados) {
    const salt = novoSalt();
    return {
      id: uid("u"),
      tipo: dados.tipo,
      nome: dados.nome.trim(),
      email: dados.email.trim().toLowerCase(),
      cpf: Calc.normalizarCPF(dados.cpf),
      telefone: (dados.telefone || "").replace(/\D/g, ""),
      salt,
      senhaHash: hashSenha(dados.senha, salt),
      produtorId: dados.produtorId || null,
      papel: dados.papel || null,
      receberAlertas: dados.receberAlertas !== false,
      admin: !!dados.admin,
      consentimentoLGPD: dados.consentimentoLGPD || null,
      criadoEm: new Date().toISOString(),
    };
  }

  function registrarProdutor(dados) {
    validarNovoUsuario(dados);
    if (!dados.consentimento) throw new RegraError("RNF-04", "É preciso aceitar o uso dos dados conforme a LGPD para criar a conta.");
    const u = criarUsuario({ ...dados, tipo: "produtor", consentimentoLGPD: new Date().toISOString() });
    state.usuarios.push(u);
    state.sessao = { usuarioId: u.id, desde: new Date().toISOString() };
    save();
    return u;
  }

  function login(email, senha) {
    const u = state.usuarios.find((x) => x.email === String(email || "").trim().toLowerCase());
    if (!u || u.senhaHash !== hashSenha(senha || "", u.salt)) throw new RegraError("RF-05", "E-mail ou senha incorretos.");
    state.sessao = { usuarioId: u.id, desde: new Date().toISOString() };
    save();
    return u;
  }

  function logout() {
    state.sessao = null;
    save();
  }

  function alterarSenha(atual, nova) {
    const u = usuarioAtual();
    if (u.senhaHash !== hashSenha(atual, u.salt)) throw new RegraError("RF-05", "Senha atual incorreta.");
    if (!nova || nova.length < 6) throw new RegraError("RF-05", "A nova senha deve ter pelo menos 6 caracteres.");
    u.salt = novoSalt();
    u.senhaHash = hashSenha(nova, u.salt);
    save();
  }

  function atualizarPerfil({ nome, telefone }) {
    const u = usuarioAtual();
    if (nome && nome.trim().length >= 3) u.nome = nome.trim();
    if (telefone !== undefined) u.telefone = String(telefone).replace(/\D/g, "");
    save();
  }

  function colaboradores() {
    const conta = contaAtualId();
    return state.usuarios.filter((u) => u.tipo === "colaborador" && u.produtorId === conta);
  }

  function convidarColaborador(dados) {
    exigirProdutor("convidar colaboradores");
    validarNovoUsuario(dados);
    const u = criarUsuario({ ...dados, tipo: "colaborador", produtorId: contaAtualId() });
    state.usuarios.push(u);
    save();
    return u;
  }

  function atualizarColaborador(id, dados) {
    exigirProdutor("editar colaboradores");
    const u = colaboradores().find((c) => c.id === id);
    if (!u) throw new RegraError("RF-06", "Colaborador não encontrado.");
    if (dados.papel !== undefined) u.papel = dados.papel;
    if (dados.telefone !== undefined) u.telefone = String(dados.telefone).replace(/\D/g, "");
    if (dados.receberAlertas !== undefined) u.receberAlertas = !!dados.receberAlertas;
    save();
  }

  function removerColaborador(id) {
    exigirProdutor("remover colaboradores");
    const idx = state.usuarios.findIndex((u) => u.id === id && u.tipo === "colaborador" && u.produtorId === contaAtualId());
    if (idx < 0) throw new RegraError("RF-06", "Colaborador não encontrado.");
    state.usuarios.splice(idx, 1);
    save();
  }

  // LGPD (RNF-04): portabilidade e eliminação dos dados da conta.
  function exportarDadosConta() {
    const conta = contaAtualId();
    const talhoes = state.talhoes.filter((t) => t.produtorId === conta);
    const ids = new Set(talhoes.map((t) => t.id));
    const semSegredos = (u) => { const { senhaHash, salt, ...rest } = u; return rest; };
    return {
      exportadoEm: new Date().toISOString(),
      usuarios: state.usuarios.filter((u) => u.id === conta || u.produtorId === conta).map(semSegredos),
      talhoes,
      safras: state.safras.filter((s) => ids.has(s.talhaoId)),
      aplicacoes: state.aplicacoes.filter((a) => ids.has(a.talhaoId)),
      ocorrencias: state.ocorrencias.filter((o) => ids.has(o.talhaoId)),
      sugestoes: state.sugestoes.filter((s) => ids.has(s.talhaoId)),
      alertas: state.alertas.filter((a) => a.produtorId === conta),
    };
  }

  function excluirConta() {
    exigirProdutor("excluir a conta");
    const conta = contaAtualId();
    const ids = new Set(state.talhoes.filter((t) => t.produtorId === conta).map((t) => t.id));
    state.talhoes = state.talhoes.filter((t) => !ids.has(t.id));
    state.safras = state.safras.filter((s) => !ids.has(s.talhaoId));
    state.aplicacoes = state.aplicacoes.filter((a) => !ids.has(a.talhaoId));
    state.ocorrencias = state.ocorrencias.filter((o) => !ids.has(o.talhaoId));
    state.sugestoes = state.sugestoes.filter((s) => !ids.has(s.talhaoId));
    state.alertas = state.alertas.filter((a) => a.produtorId !== conta);
    delete state.precos[conta];
    state.usuarios = state.usuarios.filter((u) => u.id !== conta && u.produtorId !== conta);
    state.sessao = null;
    save();
  }

  /* ---------------- Talhões (RF-01, RN-04) ---------------- */

  function talhoes() {
    const conta = contaAtualId();
    return state.talhoes.filter((t) => t.produtorId === conta);
  }

  function talhao(id) {
    return talhoes().find((t) => t.id === id) || null;
  }

  function salvarTalhao(dados) {
    if (!dados.nome || !dados.nome.trim()) throw new RegraError("RF-01", "Informe um nome para o talhão.");
    if (!(dados.areaHectares > 0)) throw new RegraError("RF-01", "A área deve ser maior que zero.");
    if (!dados.fase) throw new RegraError("RF-01", "Informe a fase da lavoura.");
    if (!dados.localizacao || !dados.localizacao.cidade || !dados.localizacao.uf) throw new RegraError("RF-01", "Informe a cidade e o estado do talhão.");
    const erros = Calc.validarLaudo(dados.laudo);
    if (erros.length) throw new RegraError("RN-10", erros.join(" "));

    if (dados.id) {
      const t = talhao(dados.id);
      if (!t) throw new RegraError("RN-04", "Talhão não encontrado nesta conta.");
      const locMudou = t.localizacao.cidade !== dados.localizacao.cidade || t.localizacao.uf !== dados.localizacao.uf;
      // produtorId nunca é alterado — não há transferência entre contas (RN-04).
      Object.assign(t, { ...dados, produtorId: t.produtorId });
      if (locMudou) delete state.climaCache[t.id];
      save();
      return t;
    }
    const t = {
      ...dados,
      id: uid("t"),
      produtorId: contaAtualId(),
      cultura: dados.cultura || "cafe",
      criadoEm: new Date().toISOString(),
    };
    state.talhoes.push(t);
    save();
    return t;
  }

  function excluirTalhao(id) {
    exigirProdutor("excluir talhões");
    const t = talhao(id);
    if (!t) throw new RegraError("RN-04", "Talhão não encontrado nesta conta.");
    state.talhoes = state.talhoes.filter((x) => x.id !== id);
    state.safras = state.safras.filter((s) => s.talhaoId !== id);
    state.aplicacoes = state.aplicacoes.filter((a) => a.talhaoId !== id);
    state.ocorrencias = state.ocorrencias.filter((o) => o.talhaoId !== id);
    state.sugestoes = state.sugestoes.filter((s) => s.talhaoId !== id);
    state.alertas = state.alertas.filter((a) => a.talhaoId !== id);
    delete state.climaCache[id];
    save();
  }

  /* ---------------- Safras e colheitas (RF-07, RN-09) ---------------- */

  const safrasDo = (talhaoId) =>
    state.safras.filter((s) => s.talhaoId === talhaoId).sort((a, b) => a.dataInicio.localeCompare(b.dataInicio));
  const safraAtiva = (talhaoId) => safrasDo(talhaoId).find((s) => s.status !== "Concluída") || null;

  function iniciarSafra(talhaoId, { dataInicio, produtividadeEsperadaSacasHa, dataColheitaPrevista }) {
    const t = talhao(talhaoId);
    if (!t) throw new RegraError("RN-04", "Talhão não encontrado nesta conta.");
    if (safraAtiva(talhaoId)) throw new RegraError("RF-07", "Este talhão já tem uma safra em andamento. Registre a colheita antes de iniciar outra.");
    if (!dataInicio) throw new RegraError("RF-07", "Informe a data de início da safra.");
    const ultima = safrasDo(talhaoId).slice(-1)[0];
    if (ultima && ultima.colheita && dataInicio < ultima.colheita.dataColheita) {
      throw new RegraError("RF-07", "A nova safra não pode começar antes da colheita da safra anterior.");
    }
    const s = {
      id: uid("s"),
      talhaoId,
      dataInicio,
      dataColheitaPrevista: dataColheitaPrevista || null,
      produtividadeEsperadaSacasHa: produtividadeEsperadaSacasHa || t.produtividadeEsperadaSacasHa || null,
      status: "Em andamento",
      colheita: null,
    };
    state.safras.push(s);
    save();
    return s;
  }

  function registrarColheita(safraId, { dataColheita, produtividadeSacasHa, qualidadeGrao }) {
    const s = state.safras.find((x) => x.id === safraId);
    if (!s || !talhao(s.talhaoId)) throw new RegraError("RN-04", "Safra não encontrada nesta conta.");
    if (s.status === "Concluída") throw new RegraError("RF-07", "Esta safra já foi encerrada.");
    if (!dataColheita) throw new RegraError("RF-07", "Informe a data da colheita.");
    if (dataColheita > hojeISO()) throw new RegraError("RF-07", "A data da colheita não pode estar no futuro.");
    if (dataColheita < s.dataInicio) throw new RegraError("RN-09", "A data da colheita não pode ser anterior ao início da safra.");
    const ultimaAp = state.aplicacoes
      .filter((a) => a.talhaoId === s.talhaoId)
      .map((a) => a.data)
      .sort()
      .slice(-1)[0];
    if (ultimaAp && dataColheita < ultimaAp) {
      throw new RegraError("RN-09", `A data da colheita não pode ser anterior à última aplicação registrada no talhão (${ultimaAp.split("-").reverse().join("/")}).`);
    }
    if (!(produtividadeSacasHa >= 0)) throw new RegraError("RF-07", "Informe a produtividade obtida em sacas por hectare.");
    s.colheita = { dataColheita, produtividadeSacasHa, qualidadeGrao: qualidadeGrao || "" };
    s.status = "Concluída";
    save();
    return s;
  }

  /* ---------------- Aplicações (RF-02, RN-03, RNF-02) ---------------- */

  function aplicacoesDaConta() {
    const ids = new Set(talhoes().map((t) => t.id));
    return state.aplicacoes.filter((a) => ids.has(a.talhaoId)).sort((a, b) => b.data.localeCompare(a.data));
  }

  function registrarAplicacao(dados) {
    const t = talhao(dados.talhaoId);
    if (!t) throw new RegraError("RN-04", "Selecione um talhão da sua conta.");
    if (!dados.data) throw new RegraError("RF-02", "Informe a data da aplicação.");
    if (dados.data > hojeISO()) throw new RegraError("RN-03", "Não é permitido registrar uma aplicação com data futura.");
    if (!(dados.quantidade > 0)) throw new RegraError("RF-02", "Informe a quantidade aplicada.");
    if (!dados.nomeProduto) throw new RegraError("RF-02", "Informe o insumo aplicado.");
    if (dados.custo !== null && dados.custo !== undefined && dados.custo < 0) throw new RegraError("RF-02", "O custo não pode ser negativo.");

    // A aplicação é a classe associativa entre Safra e Insumo: vai para a safra
    // que estava em curso na data informada.
    const safra = safrasDo(t.id).find(
      (s) => s.dataInicio <= dados.data && (!s.colheita || dados.data <= s.colheita.dataColheita)
    );
    if (!safra) {
      throw new RegraError("RF-02", "Não há safra deste talhão cobrindo essa data. Inicie uma safra (em Safras e colheitas) antes de registrar a aplicação.");
    }

    const u = usuarioAtual();
    const ap = {
      ...dados,
      id: uid("a"),
      safraId: safra.id,
      criadoPor: u ? u.id : null,
      criadoEm: new Date().toISOString(),
      pendenteSync: !online(),
    };
    state.aplicacoes.push(ap);
    if (ap.produtoPersonalizadoId) atualizarStatusProdutos();
    save();
    return ap;
  }

  function excluirAplicacao(id) {
    const ap = aplicacoesDaConta().find((a) => a.id === id);
    if (!ap) throw new RegraError("RN-04", "Aplicação não encontrada nesta conta.");
    state.aplicacoes = state.aplicacoes.filter((a) => a.id !== id);
    if (ap.produtoPersonalizadoId) atualizarStatusProdutos();
    save();
  }

  function pendentesSync() {
    return state.aplicacoes.filter((a) => a.pendenteSync);
  }

  // Sem backend nesta versão: "sincronizar" confirma os registros feitos offline.
  function sincronizar() {
    const pend = pendentesSync();
    pend.forEach((a) => { a.pendenteSync = false; a.sincronizadoEm = new Date().toISOString(); });
    if (pend.length) save();
    return pend.length;
  }

  /* ---------------- Pragas e doenças (RF-10, RF-13, RN-07) ---------------- */

  function ocorrenciasDaConta() {
    const ids = new Set(talhoes().map((t) => t.id));
    return state.ocorrencias.filter((o) => ids.has(o.talhaoId)).sort((a, b) => b.dataDeclaracao.localeCompare(a.dataDeclaracao));
  }

  function declararOcorrencia({ talhaoId, pragaId, severidade, observacao, recomendacao }) {
    const t = talhao(talhaoId);
    if (!t) throw new RegraError("RN-04", "Selecione um talhão da sua conta.");
    if (!pragaId) throw new RegraError("RF-10", "Selecione a praga ou doença no catálogo.");
    if (!["leve", "moderada", "severa"].includes(severidade)) throw new RegraError("RF-10", "Informe a severidade observada.");
    const o = {
      id: uid("o"),
      talhaoId,
      pragaId,
      severidade,
      observacao: observacao || "",
      dataDeclaracao: hojeISO(),
      recomendacao: recomendacao || null,
      declaradoPor: usuarioAtual() ? usuarioAtual().id : null,
      resolvida: false,
    };
    state.ocorrencias.push(o);
    save();
    return o;
  }

  function resolverOcorrencia(id) {
    const o = ocorrenciasDaConta().find((x) => x.id === id);
    if (o) { o.resolvida = true; save(); }
  }

  function cadastrarProdutoPersonalizado({ nome, fabricante, categoria, unidade, pragasAlvo, ingredienteAtivo }) {
    if (!nome || !nome.trim()) throw new RegraError("RF-13", "Informe o nome do produto.");
    if (!categoria) throw new RegraError("RF-13", "Informe a categoria do produto.");
    const existente = state.produtosPersonalizados.find((p) => p.nome.trim().toLowerCase() === nome.trim().toLowerCase());
    if (existente) return existente; // produto compartilhado entre produtores (RN-07)
    const p = {
      id: uid("pp"),
      nome: nome.trim(),
      fabricante: fabricante || "",
      categoria,
      unidade: unidade || "L",
      ingredienteAtivo: ingredienteAtivo || "",
      pragasAlvo: pragasAlvo || [],
      status: "Novo",
      criadoPor: contaAtualId(),
      criadoEm: new Date().toISOString(),
    };
    state.produtosPersonalizados.push(p);
    save();
    return p;
  }

  // RN-07: recalcula "Novo" x "Recorrente" com os limites configuráveis (RNF-06).
  function atualizarStatusProdutos() {
    const produtorDe = (a) => {
      const t = state.talhoes.find((x) => x.id === a.talhaoId);
      return t ? t.produtorId : null;
    };
    state.produtosPersonalizados.forEach((p) => {
      const r = Calc.statusProdutoPersonalizado(p.id, state.aplicacoes, produtorDe, state.config.promocao);
      p.status = r.status;
      p.produtoresQualificados = r.produtoresQualificados;
      p.produtoresDistintos = r.produtoresDistintos;
    });
  }

  /* ---------------- Sugestões e alertas (RF-09, RF-15) ---------------- */

  function registrarSugestao(talhaoId, safraRefId, sugestao) {
    // Pós-condição do caso de uso 5.3: a sugestão fica registrada para consulta.
    const existente = state.sugestoes.find((s) => s.talhaoId === talhaoId && s.safraRefId === safraRefId);
    if (existente) return existente;
    const s = { id: uid("sg"), talhaoId, safraRefId, dataGeracao: new Date().toISOString(), ...sugestao };
    state.sugestoes.push(s);
    save();
    return s;
  }

  function sugestoesDo(talhaoId) {
    return state.sugestoes.filter((s) => s.talhaoId === talhaoId).sort((a, b) => b.dataGeracao.localeCompare(a.dataGeracao));
  }

  function alertasDaConta() {
    const conta = contaAtualId();
    return state.alertas.filter((a) => a.produtorId === conta).sort((a, b) => b.dataGeracao.localeCompare(a.dataGeracao));
  }

  // Evita duplicar o mesmo alerta (mesma chave) enquanto ele estiver aberto.
  function adicionarAlerta({ chave, tipo, talhaoId, descricao, gravidade }) {
    const conta = contaAtualId();
    if (chave && state.alertas.some((a) => a.chave === chave && a.produtorId === conta)) return null;
    const a = {
      id: uid("al"),
      chave: chave || null,
      tipo,
      talhaoId,
      produtorId: conta,
      descricao,
      gravidade: gravidade || "media",
      dataGeracao: new Date().toISOString(),
      canal: "app",
      status: "pendente",
      envios: [],
    };
    state.alertas.push(a);
    save();
    return a;
  }

  function atualizarAlerta(id, patch) {
    const a = state.alertas.find((x) => x.id === id);
    if (a) { Object.assign(a, patch); save(); }
    return a;
  }

  /* ---------------- Clima (RF-08, RNF-01) ---------------- */

  const climaDo = (talhaoId) => state.climaCache[talhaoId] || null;
  function salvarClima(talhaoId, dados) {
    state.climaCache[talhaoId] = { ...dados, atualizadoEm: new Date().toISOString() };
    save();
  }
  function salvarCoordenadas(talhaoId, lat, lon, nomeResolvido) {
    const t = state.talhoes.find((x) => x.id === talhaoId);
    if (!t) return;
    t.localizacao = { ...t.localizacao, lat, lon, nomeResolvido: nomeResolvido || t.localizacao.nomeResolvido };
    save();
  }

  /* ---------------- Configuração (RNF-06) ---------------- */

  function salvarConfig(patch) {
    if (!ehAdmin()) throw new RegraError("RNF-06", "Apenas o administrador do sistema pode alterar estes parâmetros.");
    if (patch.promocao) {
      const { minProdutores, minAplicacoesPorProdutor } = patch.promocao;
      if (!(minProdutores >= 1) || !(minAplicacoesPorProdutor >= 1)) throw new RegraError("RNF-06", "Os limites de promoção devem ser números inteiros maiores que zero.");
    }
    state.config = { ...state.config, ...patch };
    atualizarStatusProdutos();
    save();
  }

  // Preços variam por região e época, então cada conta mantém os seus.
  function precos() {
    return state.precos[contaAtualId()] || {};
  }

  function salvarPreco(produtoId, valor) {
    const conta = contaAtualId();
    const tabela = (state.precos[conta] = state.precos[conta] || {});
    if (valor === null || valor === "" || Number.isNaN(valor)) delete tabela[produtoId];
    else if (valor < 0) throw new RegraError("RF-18", "O preço não pode ser negativo.");
    else tabela[produtoId] = valor;
    save();
  }

  /* ---------------- Dados de demonstração ---------------- */

  function seed(s) {
    const mkUser = (d) => {
      const salt = novoSalt();
      return {
        id: d.id, tipo: d.tipo, nome: d.nome, email: d.email, cpf: d.cpf, telefone: d.telefone || "",
        salt, senhaHash: hashSenha("demo1234", salt), produtorId: d.produtorId || null, papel: d.papel || null,
        receberAlertas: true, admin: !!d.admin, consentimentoLGPD: "2026-01-10T12:00:00.000Z", criadoEm: "2026-01-10T12:00:00.000Z",
      };
    };
    s.usuarios.push(
      mkUser({ id: "u_maria", tipo: "produtor", nome: "Maria Oliveira", email: "maria@ruraltracker.demo", cpf: "52998224725", telefone: "35999990001", admin: true }),
      mkUser({ id: "u_joao", tipo: "colaborador", nome: "João Pereira", email: "joao@ruraltracker.demo", cpf: "11144477735", telefone: "35999990002", produtorId: "u_maria", papel: "Técnico agrícola" }),
      mkUser({ id: "u_carlos", tipo: "produtor", nome: "Carlos Souza", email: "carlos@ruraltracker.demo", cpf: "39053344705", telefone: "35999990003" }),
      mkUser({ id: "u_ana", tipo: "produtor", nome: "Ana Ribeiro", email: "ana@ruraltracker.demo", cpf: "15350946056", telefone: "35999990004" })
    );

    const loc = {
      pocos: { cidade: "Poços de Caldas", uf: "MG", lat: -21.7878, lon: -46.5614 },
      alfenas: { cidade: "Alfenas", uf: "MG", lat: -21.4256, lon: -45.9475 },
      franca: { cidade: "Franca", uf: "SP", lat: -20.5386, lon: -47.4008 },
    };
    const T = (d) => ({ cultura: "cafe", irrigado: false, laudo: null, criadoEm: "2026-01-10T12:00:00.000Z", ...d });
    s.talhoes.push(
      T({ id: "t1", produtorId: "u_maria", nome: "Talhão 1", tipoCafe: "Arábica", variedade: "Bourbon Amarelo", areaHectares: 4.5, fase: "producao", tipoSolo: "Argiloso", plantasPorHa: 4000, produtividadeEsperadaSacasHa: 38, localizacao: { ...loc.pocos }, laudo: { ctc: 8.5, v1: 42, v2: 65, prnt: 80, formaAplicacao: "incorporacaoA20cm", dataLaudo: "2026-07-20" } }),
      T({ id: "t2", produtorId: "u_maria", nome: "Talhão 2", tipoCafe: "Arábica", variedade: "Catuaí Vermelho", areaHectares: 6.2, fase: "formacao_2", tipoSolo: "Textura média", plantasPorHa: 5000, irrigado: true, produtividadeEsperadaSacasHa: null, localizacao: { ...loc.pocos } }),
      T({ id: "t3", produtorId: "u_maria", nome: "Talhão 3", tipoCafe: "Arábica", variedade: "Mundo Novo", areaHectares: 3.8, fase: "producao", tipoSolo: "Argiloso", plantasPorHa: 3300, produtividadeEsperadaSacasHa: 32, localizacao: { ...loc.alfenas } }),
      T({ id: "tc1", produtorId: "u_carlos", nome: "Lavoura do Alto", tipoCafe: "Arábica", variedade: "Catuaí Amarelo", areaHectares: 8, fase: "producao", tipoSolo: "Argiloso", plantasPorHa: 4000, produtividadeEsperadaSacasHa: 30, localizacao: { ...loc.franca } }),
      T({ id: "ta1", produtorId: "u_ana", nome: "Sítio Boa Vista", tipoCafe: "Arábica", variedade: "Topázio", areaHectares: 5, fase: "producao", tipoSolo: "Textura média", plantasPorHa: 4500, produtividadeEsperadaSacasHa: 28, localizacao: { ...loc.alfenas } })
    );

    const S = (id, talhaoId, dataInicio, esperada, colheita) => ({
      id, talhaoId, dataInicio, produtividadeEsperadaSacasHa: esperada,
      dataColheitaPrevista: colheita ? null : null,
      status: colheita ? "Concluída" : "Em andamento",
      colheita: colheita ? { dataColheita: colheita[0], produtividadeSacasHa: colheita[1], qualidadeGrao: colheita[2] } : null,
    });
    s.safras.push(
      S("s1a", "t1", "2023-08-01", 35, ["2024-06-08", 34, "Tipo 6 · bebida mole"]),
      S("s1b", "t1", "2024-08-05", 35, ["2025-06-10", 38, "Tipo 5 · bebida dura"]),
      S("s1c", "t1", "2025-08-04", 38, ["2026-06-12", 39, "Tipo 5 · bebida mole"]),
      { ...S("s1d", "t1", "2026-08-03", 38, null), dataColheitaPrevista: "2027-06-15" },
      { ...S("s2a", "t2", "2026-08-10", null, null), dataColheitaPrevista: "2027-07-20" },
      S("s3a", "t3", "2025-07-01", 32, ["2026-05-20", 26, "Tipo 6 · bebida dura"]),
      { ...S("s3b", "t3", "2026-07-15", 32, null), dataColheitaPrevista: "2027-05-10" },
      S("sc1", "tc1", "2025-08-01", 30, null),
      S("sa1", "ta1", "2025-08-01", 28, null)
    );

    // Adubo 20-05-20 dimensionado para atingir `pctN`% do N recomendado (6,2 kg N/saca).
    let n = 0;
    const A = (d) => s.aplicacoes.push({ id: `a_seed${++n}`, criadoPor: "u_maria", criadoEm: `${d.data}T10:00:00.000Z`, pendenteSync: false, custo: null, ...d });
    const adubo = (talhaoId, safraId, data, area, esperada, pctN, precoKg = 3.2) => {
      const kg = Math.round(((esperada * 6.2 * pctN) / 100 / 0.2) * area);
      A({ talhaoId, safraId, data, categoria: "fertilizante", produtoId: "FERT-02", nomeProduto: "Adubo NPK 20-05-20", formulacao: { n: 20, p: 5, k: 20 }, quantidade: kg, unidade: "kg", custo: Math.round(kg * precoKg) });
    };
    // Talhão 1: adubação acima do recomendado nas safras passadas, com meta atingida.
    adubo("t1", "s1a", "2023-11-10", 4.5, 35, 124);
    adubo("t1", "s1b", "2024-11-12", 4.5, 35, 128);
    adubo("t1", "s1c", "2025-11-08", 4.5, 38, 126);
    A({ talhaoId: "t1", safraId: "s1d", data: "2026-08-20", categoria: "corretivo", produtoId: "COR-01", nomeProduto: "Calcário Dolomítico", quantidade: 9, unidade: "t", custo: 765 });
    adubo("t1", "s1d", "2026-09-15", 4.5, 38, 45);
    // Talhão 2: formação, calcário + adubo de formação.
    A({ talhaoId: "t2", safraId: "s2a", data: "2026-08-25", categoria: "corretivo", produtoId: "COR-01", nomeProduto: "Calcário Dolomítico", quantidade: 12.4, unidade: "t", custo: 1054 });
    A({ talhaoId: "t2", safraId: "s2a", data: "2026-09-10", categoria: "fertilizante", produtoId: "FERT-01", nomeProduto: "NPK 15-00-10 (formação)", formulacao: { n: 15, p: 0, k: 10 }, quantidade: 1240, unidade: "kg", custo: 3720 });
    // Talhão 3: adubação abaixo do recomendado e produtividade abaixo da meta.
    adubo("t3", "s3a", "2025-10-20", 3.8, 32, 72);
    A({ id: "a_opera", talhaoId: "t3", safraId: "s3b", data: "2026-09-02", categoria: "defensivo", produtoId: "FUNG-01", nomeProduto: "Opera", quantidade: 5.7, unidade: "L", custo: 1043, ocorrenciaId: "o1" });

    // Produto personalizado aplicado por 3 produtores, 2x cada -> "Recorrente" (RN-07).
    s.produtosPersonalizados.push(
      { id: "pp1", nome: "Calda bordalesa (preparo próprio)", fabricante: "Preparo na propriedade", categoria: "Fungicida", unidade: "L", ingredienteAtivo: "Sulfato de cobre + cal virgem", pragasAlvo: ["ferrugem", "cercosporiose"], status: "Novo", criadoPor: "u_carlos", criadoEm: "2025-09-01T12:00:00.000Z" },
      { id: "pp2", nome: "Óleo de neem 1%", fabricante: "Diversos", categoria: "Inseticida", unidade: "L", ingredienteAtivo: "Azadiractina", pragasAlvo: ["bicho-mineiro"], status: "Novo", criadoPor: "u_ana", criadoEm: "2025-09-01T12:00:00.000Z" }
    );
    const P = (talhaoId, safraId, data, produtoPersonalizadoId, nomeProduto, produtor) =>
      A({ talhaoId, safraId, data, categoria: "defensivo", produtoPersonalizadoId, nomeProduto, quantidade: 400, unidade: "L", custo: 120, criadoPor: produtor });
    P("tc1", "sc1", "2025-11-05", "pp1", "Calda bordalesa (preparo próprio)", "u_carlos");
    P("tc1", "sc1", "2026-01-10", "pp1", "Calda bordalesa (preparo próprio)", "u_carlos");
    P("ta1", "sa1", "2025-11-20", "pp1", "Calda bordalesa (preparo próprio)", "u_ana");
    P("ta1", "sa1", "2026-02-02", "pp1", "Calda bordalesa (preparo próprio)", "u_ana");
    P("t1", "s1c", "2025-12-01", "pp1", "Calda bordalesa (preparo próprio)", "u_maria");
    P("t1", "s1c", "2026-02-15", "pp1", "Calda bordalesa (preparo próprio)", "u_maria");
    P("ta1", "sa1", "2026-03-01", "pp2", "Óleo de neem 1%", "u_ana");

    s.ocorrencias.push(
      { id: "o1", talhaoId: "t3", pragaId: "ferrugem", severidade: "moderada", observacao: "Terço inferior das plantas com pústulas.", dataDeclaracao: "2026-09-01", declaradoPor: "u_joao", resolvida: false },
      { id: "o2", talhaoId: "t2", pragaId: "cercosporiose", severidade: "severa", observacao: "Mudas das bordas com muitas manchas.", dataDeclaracao: "2026-09-18", declaradoPor: "u_maria", resolvida: false },
      { id: "o3", talhaoId: "t1", pragaId: "bicho-mineiro", severidade: "leve", observacao: "Primeiras minas ativas no terço superior.", dataDeclaracao: "2026-09-20", declaradoPor: "u_joao", resolvida: false }
    );

    // Alerta correspondente à aplicação de Opera acima da dose (1,5 L/ha contra 1,125 L/ha).
    s.alertas.push({
      id: "al_seed1", chave: "ap-s3b-def-a_opera-excesso", tipo: "aplicacao", talhaoId: "t3", produtorId: "u_maria",
      descricao: "Opera no Talhão 3 — Mundo Novo: 33% acima do recomendado (1,5 de 1,13 L/ha).",
      gravidade: "media", dataGeracao: "2026-09-02T10:05:00.000Z", canal: "app", status: "aguardando envio", envios: [],
    });

    state = s;
    atualizarStatusProdutos();
  }

  root.Store = {
    RegraError,
    STORAGE_KEY,
    load,
    save,
    reset,
    get state() { return state; },
    hojeISO,
    online,
    sha256,
    // conta
    usuarioAtual, contaAtualId, ehProdutor, ehAdmin, registrarProdutor, login, logout, alterarSenha, atualizarPerfil,
    colaboradores, convidarColaborador, atualizarColaborador, removerColaborador, exportarDadosConta, excluirConta,
    // talhões e safras
    talhoes, talhao, salvarTalhao, excluirTalhao, safrasDo, safraAtiva, iniciarSafra, registrarColheita,
    // aplicações
    aplicacoesDaConta, registrarAplicacao, excluirAplicacao, pendentesSync, sincronizar,
    // pragas
    ocorrenciasDaConta, declararOcorrencia, resolverOcorrencia, cadastrarProdutoPersonalizado, atualizarStatusProdutos,
    // sugestões, alertas, clima, config
    registrarSugestao, sugestoesDo, alertasDaConta, adicionarAlerta, atualizarAlerta,
    climaDo, salvarClima, salvarCoordenadas, salvarConfig, precos, salvarPreco,
  };
})(typeof window !== "undefined" ? window : globalThis);
