import { sb, S, esc, ic, moeda, data, num, tag, barra, pode, toast, msgErro, q, tabela, confirmar, limparCache, docValido, docFmt, ir } from "../core.js";
import { listaRecurso } from "../crud.js";
import { anexos } from "../anexos.js";
import { STATUS_OBRA } from "./dashboard.js";
import { pdf } from "../exportar.js";
import { STATUS_OC } from "./compras.js";

export const camposObra = () => [
  { k: "nome", l: "Nome da obra", req: true, s2: true },
  { k: "codigo", l: "Código", ajuda: "Deixe em branco para gerar automaticamente (OB-0001)" },
  { k: "status", l: "Status", t: "select", op: Object.entries(STATUS_OBRA).map(([v, [l]]) => [v, l]), req: true, vazio: false, padrao: "planejamento" },
  { t: "secao", l: "Cliente" },
  { k: "cliente", l: "Cliente" },
  { k: "cliente_documento", l: "CNPJ ou CPF do cliente", valida: (v) => docValido(v) ? null : "CPF/CNPJ inválido" },
  { k: "endereco", l: "Endereço da obra", s2: true },
  { t: "secao", l: "Execução" },
  { k: "responsavel_tecnico", l: "Responsável técnico" },
  { k: "orcamento", l: "Orçamento inicial (R$)", t: "money", min: 0 },
  { k: "data_inicio", l: "Data de início", t: "date" },
  { k: "previsao_termino", l: "Previsão de término", t: "date" },
  { k: "progresso", l: "Percentual de conclusão (%)", t: "pct", min: 0, max: 100 },
  { k: "descricao", l: "Descrição", t: "textarea", s2: true },
];
const preparar = (v) => ({ ...v, cliente_documento: v.cliente_documento ? v.cliente_documento.replace(/\D/g, "") : null, orcamento: v.orcamento || 0, progresso: Math.round(v.progresso || 0), codigo: v.codigo || null });

export async function render(el, [id]) {
  if (id) return detalhe(el, +id);
  el.innerHTML = `<div class="cab-pagina"><div><h1>Obras</h1><p>Cadastro e acompanhamento das obras da empresa.</p></div></div><div id="lista"></div>`;
  await listaRecurso(el.querySelector("#lista"), {
    titulo: "Obras", singular: "obra", tabela: "obras", modulo: "obras", cache: "obras", novoTexto: "Nova obra",
    busca: ["nome", "codigo", "cliente", "responsavel_tecnico"], ordem: ["criado_em", false],
    filtros: [
      { k: "status", l: "Status", op: Object.entries(STATUS_OBRA).map(([v, [l]]) => [v, l]) },
      { k: "arq", l: "Exibir", todos: "Ativas e arquivadas", op: [["nao", "Somente ativas"], ["sim", "Somente arquivadas"]], padrao: "nao", aplicar: (q2, v) => q2.eq("arquivada", v === "sim") },
    ],
    colunas: [
      { l: "Obra", pri: true, k: "nome", f: (r) => `<b>${esc(r.codigo)}</b> · ${esc(r.nome)}${r.arquivada ? " " + tag("Arquivada", "cinza") : ""}` },
      { l: "Cliente", k: "cliente" },
      { l: "Responsável", k: "responsavel_tecnico" },
      { l: "Orçamento", k: "orcamento", tipo: "moeda", num: true, f: (r) => moeda(r.orcamento) },
      { l: "Conclusão", k: "progresso", f: (r) => `<div style="display:flex;gap:8px;align-items:center;justify-content:flex-end">${barra(r.progresso)}${r.progresso}%</div>` },
      { l: "Previsão", k: "previsao_termino", tipo: "data", f: (r) => { const at = r.previsao_termino && r.previsao_termino < new Date().toISOString().slice(0, 10) && !["concluida", "cancelada"].includes(r.status); return `<span class="${at ? "verm neg" : ""}">${data(r.previsao_termino) || "-"}</span>`; } },
      { l: "Status", k: "status", f: (r) => tag(...(STATUS_OBRA[r.status] || [r.status, "cinza"])) },
    ],
    campos: camposObra, preparar,
    aoClicar: (r) => ir("obras/" + r.id),
    aposSalvar: async (o, novo) => { if (novo) ir("obras/" + o.id); },
  });
}

// ---------------- detalhe da obra ----------------
async function detalhe(el, id) {
  const o = await q(sb.from("obras").select("*").eq("id", id).maybeSingle());
  if (!o) { el.innerHTML = '<div class="card"><div class="vazio">Obra não encontrada.</div></div>'; return; }
  const [sl, sc] = STATUS_OBRA[o.status] || [o.status, "cinza"];
  const atrasada = o.previsao_termino && o.previsao_termino < new Date().toISOString().slice(0, 10) && !["concluida", "cancelada"].includes(o.status);
  const abas = [["resumo", "Resumo"], ["financeiro", "Receitas e despesas", "financeiro"], ["compras", "Ordens de compra", "compras"], ["notas", "Notas fiscais", "notas"],
    ["materiais", "Materiais e estoque", "estoque"], ["equipe", "Funcionários", "equipe"], ["diario", "Diário de obra", "diario"], ["fotos", "Fotos e arquivos"]].filter((a) => !a[2] || pode(a[2], "ver"));
  el.innerHTML = `<div class="trilha"><a href="#obras">Obras</a> / ${esc(o.codigo)}</div>
    <div class="cab-pagina"><div><h1>${esc(o.nome)}</h1><p>${esc(o.codigo)} · ${tag(sl, sc)} ${atrasada ? tag("Prazo vencido", "verm") : ""} ${o.arquivada ? tag("Arquivada", "cinza") : ""}</p></div>
      <div class="botoes">${pode("obras", "exportar") ? `<button class="bt sec" id="o-pdf">${ic("pdf")}Relatório</button>` : ""}
      ${pode("obras", "editar") ? `<button class="bt sec" id="o-arq">${ic("arquivo")}${o.arquivada ? "Desarquivar" : "Arquivar"}</button><button class="bt" id="o-ed">${ic("editar")}Editar</button>` : ""}</div></div>
    <div class="abas">${abas.map(([k, l], i) => `<button data-aba="${k}" class="${i === 0 ? "on" : ""}">${l}</button>`).join("")}</div><div id="o-aba"></div>`;
  const caixa = el.querySelector("#o-aba");
  const abrir = (k) => { el.querySelectorAll("[data-aba]").forEach((b) => b.classList.toggle("on", b.dataset.aba === k)); ABAS[k](caixa, o); };
  el.querySelectorAll("[data-aba]").forEach((b) => b.onclick = () => abrir(b.dataset.aba));
  el.querySelector("#o-ed")?.addEventListener("click", async () => {
    const { formulario } = await import("../core.js");
    formulario({ titulo: "Editar obra", campos: camposObra(), valores: o, tamanho: "larga", salvar: async (v) => {
      await q(sb.from("obras").update(preparar(v)).eq("id", id)); limparCache("obras"); toast("Obra atualizada.", "ok"); detalhe(el, id);
    } });
  });
  el.querySelector("#o-arq")?.addEventListener("click", async () => {
    if (!(await confirmar(o.arquivada ? "Desarquivar esta obra?" : "Arquivar esta obra? O histórico será mantido e ela deixará de aparecer nas listas."))) return;
    try { await q(sb.from("obras").update({ arquivada: !o.arquivada }).eq("id", id)); limparCache("obras"); detalhe(el, id); } catch (e) { toast(msgErro(e), "erro"); }
  });
  el.querySelector("#o-pdf")?.addEventListener("click", () => relatorioObra(o));
  abrir("resumo");
}

const ABAS = {
  async resumo(c, o) {
    const fin = pode("financeiro", "ver");
    const l = fin ? await q(sb.from("lancamentos").select("tipo,valor,valor_pago,status").eq("obra_id", o.id).neq("status", "cancelado")) : [];
    const rec = l.filter((x) => x.tipo === "receita").reduce((a, x) => a + +x.valor, 0), des = l.filter((x) => x.tipo === "despesa").reduce((a, x) => a + +x.valor, 0);
    const uso = o.orcamento ? (des / o.orcamento) * 100 : 0;
    c.innerHTML = `<div class="grade g4" style="margin-bottom:16px">
      <div class="card kpi"><div class="ic t-azul">${ic("dinheiro")}</div><div><small>Orçamento</small><b>${moeda(o.orcamento)}</b></div></div>
      ${fin ? `<div class="card kpi"><div class="ic t-verm">${ic("financeiro")}</div><div><small>Despesas</small><b>${moeda(des)}</b><div class="sub">${num(uso, 1)}% do orçamento</div></div></div>
      <div class="card kpi"><div class="ic t-verde">${ic("dinheiro")}</div><div><small>Receitas</small><b>${moeda(rec)}</b></div></div>
      <div class="card kpi"><div class="ic t-${rec - des >= 0 ? "verde" : "verm"}">${ic("relatorios")}</div><div><small>Resultado</small><b class="${rec - des >= 0 ? "verde" : "verm"}">${moeda(rec - des)}</b></div></div>` : ""}
    </div>
    <div class="grade g2"><div class="card"><div class="ct"><h3>Informações gerais</h3></div><div class="cc"><div class="info-lista">
      ${[["Responsável técnico", o.responsavel_tecnico], ["Início", data(o.data_inicio)], ["Previsão de término", data(o.previsao_termino)], ["Endereço", o.endereco], ["Descrição", o.descricao]].map(([k, v]) => `<div><small>${k}</small><span>${esc(v || "-")}</span></div>`).join("")}
      </div><div style="margin-top:16px"><small class="mu">Conclusão: <b>${o.progresso}%</b></small>${barra(o.progresso)}</div>
      ${fin && o.orcamento ? `<div style="margin-top:12px"><small class="mu">Orçamento consumido: <b>${num(uso, 1)}%</b></small>${barra(uso, uso > 100 ? "verm" : uso > 85 ? "lar" : "verde")}</div>` : ""}</div></div>
      <div class="card"><div class="ct"><h3>Informações do cliente</h3></div><div class="cc"><div class="info-lista">
      ${[["Cliente", o.cliente], ["CNPJ/CPF", docFmt(o.cliente_documento)]].map(([k, v]) => `<div><small>${k}</small><span>${esc(v || "-")}</span></div>`).join("")}</div></div></div></div>`;
  },
  async financeiro(c, o) {
    const l = await q(sb.from("v_lancamentos").select("*").eq("obra_id", o.id).order("vencimento", { ascending: false }).limit(300));
    const S_ = { pendente: ["Pendente", "lar"], parcial: ["Parcial", "lar"], pago: ["Pago", "verde"], vencido: ["Vencido", "verm"], cancelado: ["Cancelado", "cinza"] };
    c.innerHTML = `<div class="card">${tabela([
      { l: "Descrição", pri: true, f: (r) => `${esc(r.descricao)}${r.nf_numero ? ` <span class="mu peq">NF ${esc(r.nf_numero)}</span>` : ""}` },
      { l: "Tipo", f: (r) => tag(r.tipo === "receita" ? "Receita" : "Despesa", r.tipo === "receita" ? "verde" : "verm") },
      { l: "Categoria", k: "categoria" }, { l: "Vencimento", f: (r) => data(r.vencimento) },
      { l: "Valor", num: true, f: (r) => moeda(r.valor) }, { l: "Pago", num: true, f: (r) => moeda(r.valor_pago) },
      { l: "Situação", f: (r) => tag(...(S_[r.situacao] || [r.situacao, "cinza"])) }], l, { vazio: "Nenhum lançamento financeiro para esta obra." })}</div>`;
  },
  async compras(c, o) {
    const l = await q(sb.from("v_ocs").select("*").eq("obra_id", o.id).order("id", { ascending: false }));
    c.innerHTML = `<div class="card"><div class="ct"><h3>Ordens de compra</h3>${pode("compras", "cadastrar") ? `<a class="bt peq" href="#compras/nova/${o.id}">${ic("mais")}Nova OC</a>` : ""}</div>${tabela([
      { l: "Número", pri: true, k: "numero" }, { l: "Fornecedor", k: "fornecedor_nome" }, { l: "Data", f: (r) => data(r.data_compra) },
      { l: "Total", num: true, f: (r) => moeda(r.total) }, { l: "Status", f: (r) => tag(...(STATUS_OC[r.status] || [r.status, "cinza"])) }], l, { clique: true, vazio: "Nenhuma OC vinculada." })}</div>`;
    c.querySelectorAll("tr.clic").forEach((tr, i) => tr.onclick = () => ir("compras/" + l[i].id));
  },
  async notas(c, o) {
    const l = await q(sb.from("v_notas").select("*").eq("obra_id", o.id).order("data_emissao", { ascending: false }));
    c.innerHTML = `<div class="card">${tabela([
      { l: "NF", pri: true, f: (r) => `NF ${esc(r.numero)}` }, { l: "Fornecedor", k: "fornecedor_nome" }, { l: "Emissão", f: (r) => data(r.data_emissao) },
      { l: "Valor", num: true, f: (r) => moeda(r.valor_total) }, { l: "Saldo", num: true, f: (r) => moeda(r.saldo) }, { l: "Pagamento", f: (r) => tagNF(r.status_pagamento) }], l, { clique: true, vazio: "Nenhuma nota fiscal vinculada." })}</div>`;
    c.querySelectorAll("tr.clic").forEach((tr, i) => tr.onclick = () => ir("notas/" + l[i].id));
  },
  async materiais(c, o) {
    const dep = await q(sb.from("depositos").select("id").eq("obra_id", o.id));
    const ids = dep.map((d) => d.id);
    const [sal, mov] = await Promise.all([
      ids.length ? q(sb.from("v_saldos").select("*").in("deposito_id", ids).neq("quantidade", 0).order("material_nome")) : [],
      q(sb.from("estoque_movimentos").select("*, materiais(codigo,nome,unidade)").eq("obra_id", o.id).order("criado_em", { ascending: false }).limit(100)),
    ]);
    c.innerHTML = `<div class="grade g2"><div class="card"><div class="ct"><h3>Estoque da obra</h3></div>${tabela([
      { l: "Material", pri: true, f: (r) => `${esc(r.codigo)} · ${esc(r.material_nome)}` }, { l: "Saldo", num: true, f: (r) => `${num(r.quantidade, 3)} ${esc(r.unidade)}` },
      { l: "Valor", num: true, f: (r) => moeda(r.quantidade * r.valor_unitario) }], sal, { vazio: "Sem materiais no depósito desta obra." })}</div>
      <div class="card"><div class="ct"><h3>Materiais movimentados</h3></div>${tabela([
      { l: "Data", f: (r) => data(r.data) }, { l: "Material", pri: true, f: (r) => esc(r.materiais?.nome || "") }, { l: "Tipo", f: (r) => esc(r.tipo) },
      { l: "Qtd.", num: true, f: (r) => `${num(r.quantidade, 3)} ${esc(r.materiais?.unidade || "")}` }], mov, { vazio: "Nenhuma movimentação." })}</div></div>`;
  },
  async equipe(c, o) {
    const l = await q(sb.from("funcionarios").select("id,nome,cargo,funcao,situacao,telefone").eq("obra_id", o.id).order("nome"));
    c.innerHTML = `<div class="card">${tabela([{ l: "Nome", pri: true, k: "nome" }, { l: "Cargo", k: "cargo" }, { l: "Função", k: "funcao" }, { l: "Telefone", k: "telefone" }, { l: "Situação", k: "situacao" }], l, { vazio: "Nenhum funcionário vinculado a esta obra." })}</div>`;
  },
  async diario(c, o) {
    const l = await q(sb.from("diarios").select("id,data,responsavel,clima,servicos_executados,status").eq("obra_id", o.id).order("data", { ascending: false }).limit(60));
    c.innerHTML = `<div class="card"><div class="ct"><h3>Diário de obra</h3>${pode("diario", "cadastrar") ? `<a class="bt peq" href="#diario/novo/${o.id}">${ic("mais")}Novo registro</a>` : ""}</div>${tabela([
      { l: "Data", pri: true, f: (r) => data(r.data) }, { l: "Responsável", k: "responsavel" }, { l: "Clima", k: "clima" },
      { l: "Serviços", f: (r) => esc((r.servicos_executados || "").slice(0, 80)) }, { l: "Status", f: (r) => tag(r.status === "aprovado" ? "Aprovado" : "Rascunho", r.status === "aprovado" ? "verde" : "lar") }], l, { clique: true, vazio: "Nenhum registro de diário." })}</div>`;
    c.querySelectorAll("tr.clic").forEach((tr, i) => tr.onclick = () => ir("diario/" + l[i].id));
  },
  async fotos(c, o) { await anexos(c, "obra", o.id, { titulo: "Fotos e documentos da obra", fotos: true, categorias: ["foto", "documento", "pdf", "outro"] }); },
};

export const tagNF = (s) => tag(...({ pendente: ["Pendente", "lar"], parcial: ["Parcialmente paga", "lar"], paga: ["Paga", "verde"], vencida: ["Vencida", "verm"], cancelada: ["Cancelada", "cinza"] }[s] || [s, "cinza"]));

async function relatorioObra(o) {
  try {
    const fin = pode("financeiro", "ver");
    const [ocs, l] = await Promise.all([
      pode("compras", "ver") ? q(sb.from("v_ocs").select("numero,fornecedor_nome,data_compra,total,status").eq("obra_id", o.id).order("data_compra")) : [],
      fin ? q(sb.from("lancamentos").select("tipo,valor").eq("obra_id", o.id).neq("status", "cancelado")) : [],
    ]);
    const rec = l.filter((x) => x.tipo === "receita").reduce((a, x) => a + +x.valor, 0), des = l.filter((x) => x.tipo === "despesa").reduce((a, x) => a + +x.valor, 0);
    pdf(`Relatório da obra ${o.codigo}`, [{ l: "OC", k: "numero" }, { l: "Fornecedor", k: "fornecedor_nome" }, { l: "Data", k: "data_compra", tipo: "data" }, { l: "Total", k: "total", tipo: "moeda" }, { l: "Status", v: (r) => STATUS_OC[r.status]?.[0] || r.status }], ocs, {
      blocos: [{ titulo: "Dados da obra", linhas: [["Obra", o.nome], ["Cliente", o.cliente || "-"], ["CNPJ/CPF", docFmt(o.cliente_documento) || "-"], ["Endereço", o.endereco || "-"], ["Responsável", o.responsavel_tecnico || "-"], ["Início / previsão", `${data(o.data_inicio) || "-"} a ${data(o.previsao_termino) || "-"}`], ["Status / conclusão", `${STATUS_OBRA[o.status]?.[0]} · ${o.progresso}%`], ["Orçamento", moeda(o.orcamento)], ...(fin ? [["Receitas", moeda(rec)], ["Despesas", moeda(des)], ["Resultado", moeda(rec - des)]] : [])] }],
      paisagem: false,
    });
  } catch (e) { toast(msgErro(e), "erro"); }
}
