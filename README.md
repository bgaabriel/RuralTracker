# Rural Tracker

Gestão e monitoramento agrícola para produtores de café de pequeno e médio porte.
Implementação da **versão 3** do Documento de Especificação de Requisitos: o núcleo do
sistema é o cadastro de talhões, o registro de aplicações e ocorrências de pragas e,
sobretudo, o **cálculo de necessidade de insumos** (RF-03) apoiado pelo Catálogo de
Produtos e Fórmulas Técnicas (RF-18). O painel de indicadores (RF-14) é uma visão
consolidada secundária.

## Como rodar

Não há dependências nem etapa de build — é HTML, CSS e JavaScript puros.

```bash
npm start          # ou: python3 -m http.server 8080
# abra http://localhost:8080
```

Também funciona abrindo o `index.html` direto no navegador. Servido por HTTP, um
service worker guarda o app no aparelho para abrir sem internet.

**Contas de demonstração** (senha `demo1234`):

| Conta | Papel |
|---|---|
| `maria@ruraltracker.demo` | Produtora (dona da conta) e administradora do sistema |
| `joao@ruraltracker.demo` | Colaborador da Maria |

Em *Minha conta → Restaurar dados de demonstração* os dados de exemplo são recriados.

## Testes

```bash
npm test           # node --test tests/*.test.js  (Node 18+)
```

- `tests/calc.test.js` — fórmulas de calagem (padrão e avançado), NPK de produção e
  formação, doses de defensivo, comparação aplicado × recomendado, sugestão de
  reajuste, riscos climáticos, promoção de produto e CPF.
- `tests/store.test.js` — regras de negócio: CPF único, data futura, colheita,
  permissões de colaborador, sincronização offline, parâmetros configuráveis.

## Estrutura

```
index.html                 casca da aplicação
styles.css                 estilos (mobile-first a partir de 390 px)
sw.js                      service worker (app disponível offline)
data/produtos_cafe.json    catálogo técnico de referência (fonte)
scripts/build-catalog.js   gera js/catalogo-produtos.js a partir do JSON
js/
  catalogo-produtos.js     catálogo embutido (gerado — não editar à mão)
  culturas.js              culturas, fases, tipos de solo e pragas (RNF-08)
  calc.js                  motor de cálculo — funções puras, testáveis em Node
  store.js                 dados locais, contas e regras de negócio
  services.js              recomendações, clima (Open-Meteo) e WhatsApp
  ui.js                    utilitários de interface
  views-talhoes.js         talhões e cálculo de insumos
  views-registros.js       aplicações, pragas e safras
  views-gestao.js          painel, alertas, relatórios, catálogo, equipe, conta, admin
  app.js                   rotas, layout e status de conexão
```

Para atualizar o catálogo, edite `data/produtos_cafe.json` e rode `npm run build:catalogo`.

## Rastreabilidade dos requisitos

| Requisito | Onde |
|---|---|
| RF-01 Cadastro de talhões | *Meus talhões* → `views-talhoes.js` |
| RF-02 Registro de aplicações | *Aplicações* → `views-registros.js`, `Store.registrarAplicacao` |
| RF-03 Cálculo de insumos (modo padrão e avançado) | *Calcular insumos* → `Calc.calcularCalagem`, `Calc.calcularAdubacao` |
| RF-04 Aplicado × recomendado | `Calc.compararSafra`; exibido no talhão, no cálculo, no painel e após cada aplicação |
| RF-05 Login e conta | *Entrar / Cadastro / Minha conta* |
| RF-06 Colaboradores | *Equipe* |
| RF-07 Colheita/safra | *Safras e colheitas* |
| RF-08 Clima externo | `Servicos.Clima` (Open-Meteo, sem chave de API) |
| RF-09 Sugestão de reajuste | `Calc.sugerirReajuste`; card no talhão e no painel |
| RF-10 / RF-11 Declarar praga, busca por nome popular | *Pragas e doenças → Declarar* (`Servicos.buscarPraga`) |
| RF-12 Dose de defensivo | `Calc.calcularDoseDefensivo` |
| RF-13 Produto personalizado | "Outro produto" no registro de aplicação |
| RF-14 Painel | *Painel geral* |
| RF-15 / RF-16 Alertas e WhatsApp | *Alertas*; `Servicos.Mensageria` |
| RF-17 Relatório periódico | *Relatórios* (CSV e impressão/PDF) |
| RF-18 Catálogo técnico | *Catálogo técnico* (com preço configurável por conta) |
| RNF-01 Atualização periódica do clima | intervalo configurável em *Administração* |
| RNF-02 Internet instável | dados no aparelho; aplicações offline sincronizadas ao reconectar; painel, reajuste e alertas exigem conexão |
| RNF-03 Usabilidade | linguagem simples, cartões grandes de escolha, ícones, layout para celular |
| RNF-04 LGPD | consentimento no cadastro, senha com hash + salt, exportar/excluir dados |
| RNF-06 Parâmetros configuráveis | *Administração* |
| RNF-07 WhatsApp desacoplado | falha ou ausência do serviço não bloqueia nada; envio manual por link |
| RNF-08 Novas culturas | `js/culturas.js` |
| RNF-09 Aviso de responsabilidade | em toda recomendação de dose e sugestão de reajuste |
| RN-01 a RN-10 | validações em `store.js` / `calc.js`, cobertas por testes |

## Limitações desta versão

- **Sem servidor:** os dados ficam no `localStorage` do navegador. "Sincronizar" hoje
  confirma os registros feitos offline; ao ligar um backend, é esse o ponto de envio.
  Cada navegador tem seus próprios dados.
- **WhatsApp:** envio automático exige configurar, em *Administração*, a URL de um serviço
  (WhatsApp Business API ou equivalente) que receba `POST { destinatarios, mensagem, alertaId }`.
  Sem isso, o alerta fica no app com botões que abrem o WhatsApp do próprio usuário.
- **Catálogo:** doses e preços vêm de `data/produtos_cafe.json`. Itens sem dose ou sem preço
  na pesquisa (ex.: Nomolt 150, glifosato) aparecem como "consultar bula" ou "sem preço" até
  serem cadastrados. A broca-do-café não tem defensivo no catálogo: o sistema informa a
  ausência de recomendação oficial e permite apenas o registro manual.

> As recomendações do sistema são apoio à decisão e não substituem a orientação de um
> engenheiro agrônomo nem a leitura da bula do produto utilizado.
