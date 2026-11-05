import { sb, esc, ic, moeda, data, tag, pode, q, tabela, docFmt, docValido, ir, formulario, toast, limparCache } from "../core.js";
import { listaRecurso } from "../crud.js";
import { STATUS_OC } from "./compras.js";
import { tagNF } from "./obras.js";
import { anexos } from "../anexos.js";

const CATS = ["Materiais de construção", "Elétrica", "Hidráulica", "Concreto e agregados", "Aço e ferragens", "Madeira", "Locação de equipamentos", "Serviços", "EPI", "Transporte", "Outros"];
export const camposForn = [
  { k: "razao_social", l: "Razão social", req: true, s2: true }, { k: "nome_fantasia", l: "Nome fantasia" },
  { k: "documento", l: "CNPJ ou CPF", valida: (v) => (docValido(v) ? null : "CPF/CNPJ inválido") }, { k: "inscricao_estadual", l: "Inscrição estadual" },
  { k: "categoria", l: "Categoria de fornecimento", t: "select", op: CATS }, { k: "endereco", l: "Endereço", s2: true },
  { k: "telefone", l: "Telefone", t: "tel" }, { k: "whatsapp", l: "WhatsApp", t: "tel" }, { k: "email", l: "E-mail", t: "email" }, { k: "contato", l: "Nome do contato" },
  { k: "observacoes", l: "Observações", t: "textarea", s2: true }, { k: "ativo", l: "Fornecedor ativo", t: "check", padrao: true },
];
const prep = (v) => ({ ...v, documento: v.documento ? v.documento.replace(/\D/g, "") : null });

export async function render(el, [id]) {
  if (id) return detalhe(el, +id);
  el.innerHTML = `<div class="cab-pagina"><div><h1>Fornecedores</h1><p>Cadastro completo e histórico de compras, notas e pagamentos.</p></div></div><div id="lista"></div>`;
  await listaRecurso(el.querySelector("#lista"), {
    titulo: "Fornecedores", singular: "fornecedor", tabela: "fornecedores", modulo: "fornecedores", cache: "fornecedores", novoTexto: "Novo fornecedor",
    busca: ["razao_social", "nome_fantasia", "documento", "contato", "email"], ordem: ["razao_social", true],
    filtros: [{ k: "categoria", l: "Categoria", op: CATS }, { k: "ativo", l: "Situação", op: [["true", "Ativos"], ["false", "Inativos"]], padrao: "true" }],
    colunas: [{ l: "Fornecedor", pri: true, k: "razao_social", f: (r) => `<b>${esc(r.nome_fantasia || r.razao_social)}</b>${r.nome_fantasia ? `<div class="mu peq">${esc(r.razao_social)}</div>` : ""}` },
      { l: "CNPJ/CPF", k: "documento", f: (r) => esc(docFmt(r.documento)) }, { l: "Categoria", k: "categoria" }, { l: "Contato", k: "contato" },
      { l: "Telefone", k: "telefone", f: (r) => esc(r.telefone || r.whatsapp || "") }, { l: "E-mail", k: "email" }],
    campos: camposForn, preparar: prep, padroes: () => ({ ativo: true }), aoClicar: (r) => ir("fornecedores/" + r.id), permiteExcluir: false,
  });
}

async function detalhe(el, id) {
  const f = await q(sb.from("fornecedores").select("*").eq("id", id).maybeSingle());
  if (!f) { el.innerHTML = '<div class="card"><div class="vazio">Fornecedor não encontrado.</div></div>'; return; }
  const [ocs, nfs, pg] = await Promise.all([
    pode("compras", "ver") ? q(sb.from("v_ocs").select("*").eq("fornecedor_id", id).order("data_compra", { ascending: false })) : [],
    pode("notas", "ver") ? q(sb.from("v_notas").select("*").eq("fornecedor_id", id).order("data_emissao", { ascending: false })) : [],
    pode("financeiro", "ver") || pode("notas", "ver") ? q(sb.from("v_lancamentos").select("*").eq("fornecedor_id", id).gt("valor_pago", 0).order("data_pagamento", { ascending: false })) : [],
  ]);
  const zap = (f.whatsapp || "").replace(/\D/g, "");
  el.innerHTML = `<div class="trilha"><a href="#fornecedores">Fornecedores</a> / ${esc(f.nome_fantasia || f.razao_social)}</div>
    <div class="cab-pagina"><div><h1>${esc(f.nome_fantasia || f.razao_social)}</h1><p>${esc(f.razao_social)} · ${esc(docFmt(f.documento) || "sem documento")} ${f.ativo ? "" : tag("Inativo", "cinza")}</p></div>
    <div class="botoes">${zap ? `<a class="bt sec" target="_blank" rel="noopener" href="https://wa.me/55${zap.replace(/^55/, "")}">WhatsApp</a>` : ""}${pode("fornecedores", "editar") ? `<button class="bt" id="f-ed">${ic("editar")}Editar</button>` : ""}</div></div>
    <div class="grade g4" style="margin-bottom:16px">
      <div class="card kpi"><div class="ic t-roxo">${ic("compras")}</div><div><small>Ordens de compra</small><b>${ocs.length}</b><div class="sub">${moeda(ocs.filter((o) => !["cancelada", "reprovada"].includes(o.status)).reduce((a, o) => a + +o.total, 0))}</div></div></div>
      <div class="card kpi"><div class="ic t-azul">${ic("notas")}</div><div><small>Notas fiscais</small><b>${nfs.length}</b><div class="sub">${moeda(nfs.filter((n) => !n.cancelada).reduce((a, n) => a + +n.valor_total, 0))}</div></div></div>
      <div class="card kpi"><div class="ic t-verde">${ic("ok")}</div><div><small>Total pago</small><b>${moeda(pg.reduce((a, p) => a + +p.valor_pago, 0))}</b></div></div>
      <div class="card kpi"><div class="ic t-lar">${ic("relogio")}</div><div><small>Saldo a pagar</small><b>${moeda(nfs.reduce((a, n) => a + (n.cancelada ? 0 : +n.saldo), 0))}</b></div></div></div>
    <div class="abas">${[["oc", "Ordens de compra"], ["nf", "Notas fiscais"], ["pg", "Pagamentos"], ["dados", "Dados cadastrais"], ["arq", "Arquivos"]].map(([k, l], i) => `<button data-aba="${k}" class="${i === 0 ? "on" : ""}">${l}</button>`).join("")}</div><div id="f-aba"></div>`;
  const c = el.querySelector("#f-aba");
  const A = {
    oc: () => { c.innerHTML = `<div class="card">${tabela([{ l: "Número", pri: true, k: "numero" }, { l: "Obra", k: "obra_nome" }, { l: "Data", f: (r) => data(r.data_compra) }, { l: "Total", num: true, f: (r) => moeda(r.total) }, { l: "Status", f: (r) => tag(...STATUS_OC[r.status]) }], ocs, { clique: true })}</div>`; c.querySelectorAll("tr.clic").forEach((t, i) => t.onclick = () => ir("compras/" + ocs[i].id)); },
    nf: () => { c.innerHTML = `<div class="card">${tabela([{ l: "NF", pri: true, f: (r) => "NF " + esc(r.numero) }, { l: "Emissão", f: (r) => data(r.data_emissao) }, { l: "Valor", num: true, f: (r) => moeda(r.valor_total) }, { l: "Saldo", num: true, f: (r) => moeda(r.saldo) }, { l: "Pagamento", f: (r) => tagNF(r.status_pagamento) }], nfs, { clique: true })}</div>`; c.querySelectorAll("tr.clic").forEach((t, i) => t.onclick = () => ir("notas/" + nfs[i].id)); },
    pg: () => { c.innerHTML = `<div class="card">${tabela([{ l: "Data", f: (r) => data(r.data_pagamento) }, { l: "Descrição", pri: true, k: "descricao" }, { l: "Forma", k: "forma_pagamento" }, { l: "Valor pago", num: true, f: (r) => moeda(r.valor_pago) }], pg, { vazio: "Nenhum pagamento registrado." })}</div>`; },
    dados: () => { c.innerHTML = `<div class="card"><div class="cc"><div class="info-lista">${[["Razão social", f.razao_social], ["Nome fantasia", f.nome_fantasia], ["CNPJ/CPF", docFmt(f.documento)], ["Inscrição estadual", f.inscricao_estadual], ["Categoria", f.categoria], ["Endereço", f.endereco], ["Telefone", f.telefone], ["WhatsApp", f.whatsapp], ["E-mail", f.email], ["Contato", f.contato], ["Observações", f.observacoes]].map(([k, v]) => `<div><small>${k}</small><span>${esc(v || "-")}</span></div>`).join("")}</div></div></div>`; },
    arq: () => anexos(c, "fornecedor", id, { titulo: "Documentos do fornecedor", categorias: ["documento", "pdf", "outro"] }),
  };
  el.querySelectorAll("[data-aba]").forEach((b) => b.onclick = () => { el.querySelectorAll("[data-aba]").forEach((x) => x.classList.toggle("on", x === b)); A[b.dataset.aba](); });
  A.oc();
  el.querySelector("#f-ed")?.addEventListener("click", () => formulario({ titulo: "Editar fornecedor", campos: camposForn, valores: f, tamanho: "larga",
    salvar: async (v) => { await q(sb.from("fornecedores").update(prep(v)).eq("id", id)); limparCache("fornecedores"); toast("Fornecedor atualizado.", "ok"); detalhe(el, id); } }));
}
