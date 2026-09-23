// Testes das regras de negócio do armazenamento. Rodar com: node --test tests/*.test.js
const test = require("node:test");
const assert = require("node:assert/strict");

// Ambiente mínimo de navegador para o store.js.
const memoria = {};
globalThis.localStorage = {
  getItem: (k) => (k in memoria ? memoria[k] : null),
  setItem: (k, v) => { memoria[k] = String(v); },
  removeItem: (k) => { delete memoria[k]; },
};
let conectado = true;
Object.defineProperty(globalThis, "navigator", { value: { get onLine() { return conectado; } }, configurable: true });
globalThis.Calc = require("../js/calc.js");
require("../js/store.js");
const Store = globalThis.Store;

const ontem = () => { const d = new Date(Date.now() - 864e5); return d.toISOString().slice(0, 10); };
const amanha = () => { const d = new Date(Date.now() + 2 * 864e5); return d.toISOString().slice(0, 10); };

function comoMaria() {
  Store.reset();
  Store.login("maria@ruraltracker.demo", "demo1234");
}

test("RF-05: login com senha correta e recusa com senha errada; senha guardada só como hash", () => {
  Store.reset();
  assert.throws(() => Store.login("maria@ruraltracker.demo", "errada"), /incorretos/);
  const u = Store.login("MARIA@ruraltracker.demo", "demo1234");
  assert.equal(u.nome, "Maria Oliveira");
  assert.ok(!JSON.stringify(Store.state.usuarios).includes("demo1234"));
  assert.equal(u.senhaHash.length, 64);
});

test("SHA-256 confere com vetor conhecido", () => {
  assert.equal(Store.sha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("RN-01: não permite dois usuários com o mesmo CPF", () => {
  Store.reset();
  assert.throws(
    () => Store.registrarProdutor({ nome: "Outra Pessoa", email: "nova@x.com", cpf: "529.982.247-25", senha: "123456", consentimento: true }),
    (e) => e.codigo === "RN-01"
  );
  assert.throws(
    () => Store.registrarProdutor({ nome: "Outra Pessoa", email: "nova@x.com", cpf: "123", senha: "123456", consentimento: true }),
    (e) => e.codigo === "RN-01"
  );
  const u = Store.registrarProdutor({ nome: "Pessoa Nova", email: "nova@x.com", cpf: "935.411.347-80", senha: "123456", consentimento: true });
  assert.equal(u.tipo, "produtor");
});

test("RN-03: não registra aplicação com data futura", () => {
  comoMaria();
  assert.throws(
    () => Store.registrarAplicacao({ talhaoId: "t1", data: amanha(), categoria: "corretivo", nomeProduto: "Calcário", quantidade: 1, unidade: "t" }),
    (e) => e.codigo === "RN-03"
  );
  const ap = Store.registrarAplicacao({ talhaoId: "t1", data: ontem(), categoria: "corretivo", nomeProduto: "Calcário", quantidade: 1, unidade: "t" });
  assert.equal(ap.safraId, "s1d");
});

test("RNF-02: aplicação feita sem internet fica pendente e é sincronizada depois", () => {
  comoMaria();
  conectado = false;
  const ap = Store.registrarAplicacao({ talhaoId: "t1", data: ontem(), categoria: "corretivo", nomeProduto: "Calcário", quantidade: 1, unidade: "t" });
  assert.equal(ap.pendenteSync, true);
  assert.equal(Store.pendentesSync().length, 1);
  conectado = true;
  assert.equal(Store.sincronizar(), 1);
  assert.equal(Store.pendentesSync().length, 0);
});

test("RN-09: colheita não pode ser antes do início da safra nem da última aplicação", () => {
  comoMaria();
  Store.registrarAplicacao({ talhaoId: "t1", data: ontem(), categoria: "corretivo", nomeProduto: "Calcário", quantidade: 1, unidade: "t" });
  assert.throws(() => Store.registrarColheita("s1d", { dataColheita: "2026-08-01", produtividadeSacasHa: 30 }), (e) => e.codigo === "RN-09");
  assert.throws(() => Store.registrarColheita("s1d", { dataColheita: "2026-09-01", produtividadeSacasHa: 30 }), (e) => e.codigo === "RN-09");
  const s = Store.registrarColheita("s1d", { dataColheita: Store.hojeISO(), produtividadeSacasHa: 30 });
  assert.equal(s.status, "Concluída");
});

test("RN-04 / RN-06: colaborador opera, mas não exclui talhões nem gerencia equipe", () => {
  Store.reset();
  Store.login("joao@ruraltracker.demo", "demo1234");
  assert.equal(Store.talhoes().length, 3); // vê os talhões da conta da Maria
  assert.throws(() => Store.excluirTalhao("t1"), (e) => e.codigo === "RN-06");
  assert.throws(() => Store.convidarColaborador({ nome: "Fulano de Tal", email: "f@x.com", cpf: "93541134780", senha: "123456" }), (e) => e.codigo === "RN-06");
  // Não enxerga talhões de outras contas.
  assert.equal(Store.talhao("tc1"), null);
  // Editar não troca o dono do talhão.
  const t = Store.salvarTalhao({ ...Store.talhao("t1"), produtorId: "u_carlos", nome: "Talhão 1A" });
  assert.equal(t.produtorId, "u_maria");
});

test("RN-06: produtor exclui talhão e tudo que depende dele", () => {
  comoMaria();
  Store.excluirTalhao("t3");
  assert.equal(Store.talhao("t3"), null);
  assert.equal(Store.state.aplicacoes.filter((a) => a.talhaoId === "t3").length, 0);
  assert.equal(Store.state.ocorrencias.filter((o) => o.talhaoId === "t3").length, 0);
});

test("RN-07 / RNF-06: status do produto personalizado segue os parâmetros configuráveis", () => {
  comoMaria();
  const calda = () => Store.state.produtosPersonalizados.find((p) => p.id === "pp1");
  assert.equal(calda().status, "Recorrente");
  Store.salvarConfig({ promocao: { minProdutores: 4, minAplicacoesPorProdutor: 2 } });
  assert.equal(calda().status, "Novo");
  Store.logout();
  Store.login("joao@ruraltracker.demo", "demo1234");
  assert.throws(() => Store.salvarConfig({ climaIntervaloHoras: 1 }), (e) => e.codigo === "RNF-06");
});

test("RF-10: severidade é obrigatória ao declarar ocorrência", () => {
  comoMaria();
  assert.throws(() => Store.declararOcorrencia({ talhaoId: "t1", pragaId: "ferrugem" }), (e) => e.codigo === "RF-10");
  const o = Store.declararOcorrencia({ talhaoId: "t1", pragaId: "ferrugem", severidade: "leve" });
  assert.equal(o.severidade, "leve");
});
