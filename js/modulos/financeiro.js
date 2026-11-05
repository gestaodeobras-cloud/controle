import { sb, esc, ic, moeda, data, hoje, somaMeses, inicioMes, fimMes, tag, pode, toast, q, tabela, obrasOp, fornecedoresOp, ir, carregando } from "../core.js";
import { listaRecurso } from "../crud.js";
import { registrarPagamento } from "./notas.js";
import { barras, linhas, mesCurto, CORES } from "../graficos.js";

const CAT_D = ["Materiais", "Mão de obra", "Equipamentos e locação", "Serviços terceirizados", "Impostos e taxas", "Transporte e frete", "Administrativo", "EPI e segurança", "Outros"];
const CAT_R = ["Medição", "Adiantamento", "Venda de unidade", "Aditivo de contrato", "Outros"];
const FORMAS = ["Boleto", "PIX", "Transferência", "Cartão", "Dinheiro", "Cheque", "Outro"];
const SIT = { pendente: ["A vencer", "azul"], parcial: ["Parcial", "lar"], pago: ["Pago", "verde"], vencido: ["Vencido", "verm"], cancelado: ["Cancelado", "cinza"] };

export async function render(el, [aba = "visao"]) {
  const abas = [["visao", "Fluxo de caixa"], ["pagar", "Contas a pagar"], ["receber", "Contas a receber"], ["obras", "Resultado por obra"], ["todos", "Todos os lançamentos"]];
  el.innerHTML = `<div class="cab-pagina"><div><h1>Financeiro</h1><p>Receitas, despesas, contas a pagar e a receber, integradas às notas fiscais.</p></div>
    <div class="botoes">${pode("financeiro", "cadastrar") ? `<button class="bt verde" data-n="receita">${ic("mais")}Receita</button><button class="bt verm" data-n="despesa">${ic("mais")}Despesa</button>` : ""}</div></div>
    <div class="faixa info">${ic("info")}<span>As parcelas das notas fiscais entram automaticamente em <b>Contas a pagar</b>. Não lance a mesma compra de novo como despesa manual — o sistema bloqueia a duplicidade.</span></div>
    <div class="abas">${abas.map(([k, l]) => `<button data-aba="${k}" class="${k === aba ? "on" : ""}">${l}</button>`).join("")}</div><div id="f-aba"></div>`;
  el.querySelectorAll("[data-aba]").forEach((b) => b.onclick = () => ir("financeiro/" + b.dataset.aba));
  el.querySelectorAll("[data-n]").forEach((b) => b.onclick = () => novo(b.dataset.n, () => render(el, [aba])));
  const c = el.querySelector("#f-aba");
  await (ABAS[aba] || ABAS.visao)(c, () => render(el, [aba]));
}

async function camposLanc(tipo) {
  const [obras, forn] = await Promise.all([obrasOp(), fornecedoresOp()]);
  const ocs = tipo === "despesa" ? await q(sb.from("v_ocs").select("id,numero,fornecedor_nome").in("status", ["aprovada", "enviada", "parcial", "recebida"]).order("id", { ascending: false }).limit(200)) : [];
  return [
    { k: "descricao", l: "Descrição", req: true, s2: true }, { k: "categoria", l: "Categoria", t: "select", op: tipo === "receita" ? CAT_R : CAT_D, req: true },
    { k: "obra_id", l: "Obra", t: "select", op: obras, numerico: true },
    ...(tipo === "receita" ? [{ k: "cliente", l: "Cliente" }] : [{ k: "fornecedor_id", l: "Fornecedor", t: "select", op: forn, numerico: true },
      { k: "oc_id", l: "OC relacionada (somente se ainda não houver NF)", t: "select", op: ocs.map((o) => [o.id, `${o.numero} · ${o.fornecedor_nome}`]), numerico: true }]),
    { k: "valor", l: "Valor (R$)", t: "money", req: true, min: 0.01 }, { k: "vencimento", l: tipo === "receita" ? "Data prevista de recebimento" : "Vencimento", t: "date", req: true, padrao: hoje() },
    { k: "forma_pagamento", l: "Forma de pagamento", t: "select", op: FORMAS }, { k: "parcelas", l: "Repetir por (meses)", t: "num", min: 1, max: 60, padrao: 1, ajuda: "Para lançamentos recorrentes ou parcelados" },
    { k: "observacoes", l: "Observações", t: "textarea", s2: true },
  ];
}

async function novo(tipo, ok) {
  const { formulario } = await import("../core.js");
  formulario({ titulo: tipo === "receita" ? "Nova receita" : "Nova despesa", campos: await camposLanc(tipo), tamanho: "larga",
    salvar: async (v) => {
      const n = Math.max(1, Math.floor(v.parcelas || 1)); delete v.parcelas;
      const base = Math.floor((v.valor * 100) / n), resto = Math.round(v.valor * 100) - base * n;
      const linhas_ = Array.from({ length: n }, (_, i) => ({ ...v, tipo, parcela: i + 1, total_parcelas: n, valor: (base + (i === 0 ? resto : 0)) / 100,
        vencimento: somaMeses(v.vencimento, i), descricao: n > 1 ? `${v.descricao} (${i + 1}/${n})` : v.descricao }));
      await q(sb.from("lancamentos").insert(linhas_));
      toast("Lançamento registrado.", "ok"); ok();
    } });
}

function lista(c, tipo, rec, extra = {}) {
  return listaRecurso(c, {
    titulo: tipo === "receita" ? "Contas a receber" : tipo === "despesa" ? "Contas a pagar" : "Lançamentos", fonte: "v_lancamentos", tabela: "lancamentos", modulo: "financeiro", semNovo: true,
    busca: ["descricao", "fornecedor_nome", "cliente", "obra_nome", "nf_numero"], ordem: ["vencimento", true],
    fixo: (q2) => (tipo ? q2.eq("tipo", tipo) : q2),
    filtros: [{ k: "situacao", l: "Situação", op: [["pendente", "A vencer"], ["vencido", "Vencido"], ["parcial", "Parcial"], ["pago", tipo === "receita" ? "Recebido" : "Pago"], ["cancelado", "Cancelado"]], padrao: extra.situacao },
      { k: "obra_id", l: "Obra", op: () => obrasOp(true) }, ...(tipo ? [] : [{ k: "tipo", l: "Tipo", op: [["receita", "Receita"], ["despesa", "Despesa"]] }]),
      { k: "de", l: "Vencimento de", tipo: "data", aplicar: (q2, v) => q2.gte("vencimento", v) }, { k: "ate", l: "até", tipo: "data", aplicar: (q2, v) => q2.lte("vencimento", v) }],
    colunas: [
      { l: "Vencimento", k: "vencimento", tipo: "data", f: (r) => `<span class="${r.situacao === "vencido" ? "verm neg" : ""}">${data(r.vencimento)}</span>` },
      { l: "Descrição", pri: true, k: "descricao", f: (r) => `${esc(r.descricao)}${r.nf_id ? ` <a href="#notas/${r.nf_id}" class="tag azul">NF ${esc(r.nf_numero)}</a>` : ""}` },
      ...(tipo ? [] : [{ l: "Tipo", k: "tipo", f: (r) => tag(r.tipo === "receita" ? "Receita" : "Despesa", r.tipo === "receita" ? "verde" : "verm") }]),
      { l: tipo === "receita" ? "Cliente" : "Fornecedor", v: (r) => r.cliente || r.fornecedor_nome, f: (r) => esc(r.cliente || r.fornecedor_nome || "-") },
      { l: "Obra", k: "obra_nome" }, { l: "Categoria", k: "categoria" },
      { l: "Valor", k: "valor", tipo: "moeda", num: true, f: (r) => moeda(r.valor) }, { l: tipo === "receita" ? "Recebido" : "Pago", k: "valor_pago", tipo: "moeda", num: true, f: (r) => moeda(r.valor_pago) },
      { l: "Situação", k: "situacao", v: (r) => SIT[r.situacao]?.[0], f: (r) => tag(...(SIT[r.situacao] || [r.situacao, "cinza"])) },
    ],
    acoesLinha: (r) => pode("financeiro", "editar") && r.status !== "cancelado" ? `<button class="bt ${r.status === "pago" ? "sec" : "verde"} peq" data-pg="${r.id}">${r.status === "pago" ? "Ajustar" : r.tipo === "receita" ? "Receber" : "Pagar"}</button>${!r.nf_id && +r.valor_pago === 0 ? `<button class="bt sec peq" data-cn="${r.id}" title="Cancelar">${ic("x")}</button>` : ""}` : "",
    aoCarregar: (cx, ls) => {
      cx.querySelectorAll("[data-pg]").forEach((b) => b.onclick = () => registrarPagamento(ls.find((x) => x.id == b.dataset.pg), rec));
      cx.querySelectorAll("[data-cn]").forEach((b) => b.onclick = async () => { const { confirmar } = await import("../core.js"); if (!(await confirmar("Cancelar este lançamento?", { perigo: true }))) return; await q(sb.from("lancamentos").update({ status: "cancelado" }).eq("id", b.dataset.cn)); rec(); });
    },
    aoClicar: (r) => (r.nf_id ? ir("notas/" + r.nf_id) : null),
    rodape: (d) => { const cols = tipo ? 5 : 6; return [...Array(cols - 1).fill(""), "Total da página", moeda(d.reduce((a, r) => a + +r.valor, 0)), moeda(d.reduce((a, r) => a + +r.valor_pago, 0)), "", ""]; },
    exportar: { totais: (d) => [...Array(tipo ? 4 : 5).fill(""), "Total", moeda(d.reduce((a, r) => a + +r.valor, 0)), moeda(d.reduce((a, r) => a + +r.valor_pago, 0)), ""] },
  });
}

const ABAS = {
  async visao(c) {
    c.innerHTML = carregando();
    const ini = inicioMes(somaMeses(hoje(), -11)), fim = fimMes(somaMeses(hoje(), 6));
    const l = await q(sb.from("v_lancamentos").select("tipo,valor,valor_pago,vencimento,situacao,status").neq("status", "cancelado").gte("vencimento", ini).lte("vencimento", fim));
    const todos = await q(sb.from("v_lancamentos").select("tipo,valor,valor_pago,situacao").in("status", ["pendente", "parcial"]));
    const meses = []; for (let i = 0; i < 18; i++) meses.push(somaMeses(ini, i).slice(0, 7));
    const s = (t, m) => l.filter((x) => x.tipo === t && x.vencimento.slice(0, 7) === m).reduce((a, x) => a + +x.valor, 0);
    const rec = meses.map((m) => s("receita", m)), des = meses.map((m) => s("despesa", m));
    let ac = 0; const saldo = meses.map((_, i) => (ac += rec[i] - des[i]));
    const sum = (f) => todos.filter(f).reduce((a, x) => a + (+x.valor - +x.valor_pago), 0);
    const atual = hoje().slice(0, 7), iA = meses.indexOf(atual);
    const kpi = (i, cor, t, v, sub) => `<div class="card kpi"><div class="ic t-${cor}">${ic(i)}</div><div><small>${t}</small><b>${v}</b><div class="sub">${sub}</div></div></div>`;
    c.innerHTML = `<div class="grade g4" style="margin-bottom:16px">
      ${kpi("dinheiro", "verde", "Receitas do mês", moeda(rec[iA]), "previstas")}${kpi("financeiro", "verm", "Despesas do mês", moeda(des[iA]), "previstas")}
      ${kpi("alerta", "lar", "A pagar em aberto", moeda(sum((x) => x.tipo === "despesa")), `vencido: ${moeda(sum((x) => x.tipo === "despesa" && x.situacao === "vencido"))}`)}
      ${kpi("dinheiro", "azul", "A receber em aberto", moeda(sum((x) => x.tipo === "receita")), `inadimplência: ${moeda(sum((x) => x.tipo === "receita" && x.situacao === "vencido"))}`)}</div>
      <div class="grade g2"><div class="card"><div class="ct"><h3>Receitas x despesas por mês</h3><span class="mu peq">12 meses + 6 de previsão</span></div><div class="cc" id="fc-b"></div></div>
      <div class="card"><div class="ct"><h3>Saldo acumulado e previsão</h3></div><div class="cc" id="fc-l"></div></div></div>
      <div class="card" style="margin-top:16px"><div class="ct"><h3>Resultado mensal</h3></div>${tabela([{ l: "Mês", pri: true, f: (r) => mesCurto(r.m) + (r.m > atual ? ' <span class="tag cinza">previsão</span>' : "") }, { l: "Receitas", num: true, f: (r) => moeda(r.r) }, { l: "Despesas", num: true, f: (r) => moeda(r.d) },
        { l: "Resultado", num: true, f: (r) => `<b class="${r.r - r.d >= 0 ? "verde" : "verm"}">${moeda(r.r - r.d)}</b>` }, { l: "Saldo acumulado", num: true, f: (r) => moeda(r.s) }], meses.map((m, i) => ({ m, r: rec[i], d: des[i], s: saldo[i] })).reverse())}</div>`;
    const rot = meses.map(mesCurto);
    barras(c.querySelector("#fc-b"), rot, [{ nome: "Receitas", cor: CORES[1], valores: rec }, { nome: "Despesas", cor: CORES[3], valores: des }]);
    linhas(c.querySelector("#fc-l"), rot, [{ nome: "Saldo acumulado", cor: CORES[0], valores: saldo }]);
  },
  pagar: (c, rec) => lista(c, "despesa", rec),
  receber: (c, rec) => lista(c, "receita", rec),
  todos: (c, rec) => lista(c, null, rec),
  async obras(c) {
    c.innerHTML = carregando();
    const [obras, l] = await Promise.all([q(sb.from("obras").select("id,codigo,nome,orcamento,status,arquivada").order("nome")), q(sb.from("lancamentos").select("obra_id,tipo,valor,valor_pago").neq("status", "cancelado"))]);
    const ls = obras.map((o) => { const x = l.filter((y) => y.obra_id === o.id); const r = x.filter((y) => y.tipo === "receita").reduce((a, y) => a + +y.valor, 0), d = x.filter((y) => y.tipo === "despesa").reduce((a, y) => a + +y.valor, 0); return { ...o, r, d, res: r - d, uso: o.orcamento ? (d / o.orcamento) * 100 : 0 }; });
    const semObra = l.filter((y) => !y.obra_id);
    c.innerHTML = `<div class="card">${tabela([{ l: "Obra", pri: true, f: (r) => `<a href="#obras/${r.id}">${esc(r.codigo)} · ${esc(r.nome)}</a>` }, { l: "Orçamento", num: true, f: (r) => moeda(r.orcamento) }, { l: "Receitas", num: true, f: (r) => moeda(r.r) },
      { l: "Despesas", num: true, f: (r) => moeda(r.d) }, { l: "% do orçamento", num: true, f: (r) => `<span class="${r.uso > 100 ? "verm neg" : r.uso > 85 ? "lar" : ""}">${r.uso.toFixed(1).replace(".", ",")}%</span>` },
      { l: "Resultado", num: true, f: (r) => `<b class="${r.res >= 0 ? "verde" : "verm"}">${moeda(r.res)}</b>` }], ls, { rodape: ["Total", moeda(ls.reduce((a, x) => a + +x.orcamento, 0)), moeda(ls.reduce((a, x) => a + x.r, 0)), moeda(ls.reduce((a, x) => a + x.d, 0)), "", moeda(ls.reduce((a, x) => a + x.res, 0))] })}</div>
      ${semObra.length ? `<p class="mu peq">Há ${semObra.length} lançamento(s) sem obra vinculada (despesas administrativas).</p>` : ""}`;
  },
};
