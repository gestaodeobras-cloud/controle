import { sb, S, esc, ic, moeda, data, num, hoje, tag, pode, toast, msgErro, q, tabela, confirmar, formulario, modal, camposHTML, lerCampos, obrasOp, fornecedoresOp, depositosOp, lerNumero, ir, docFmt, dataHora } from "../core.js";
import { listaRecurso } from "../crud.js";
import { anexos } from "../anexos.js";
import { pdf, imprimir } from "../exportar.js";

export const STATUS_OC = {
  elaboracao: ["Em elaboração", "cinza"], aguardando: ["Aguardando aprovação", "lar"], aprovada: ["Aprovada", "verde"], reprovada: ["Reprovada", "verm"],
  enviada: ["Enviada ao fornecedor", "azul"], parcial: ["Parcialmente recebida", "roxo"], recebida: ["Recebida", "verde"], cancelada: ["Cancelada", "cinza"],
};
const UNIDADES = ["UN", "KG", "G", "M", "M²", "M³", "L", "ML", "CX", "PCT", "SC", "ROLO", "PAR", "JOGO", "TON", "H", "DIA", "VB"];
export { UNIDADES };

export async function render(el, [p1, p2]) {
  if (p1 === "nova") { await render(el, []); return nova(p2 ? +p2 : null); }
  if (p1) return detalhe(el, +p1);
  el.innerHTML = `<div class="cab-pagina"><div><h1>Ordens de Compra</h1><p>Pedidos de compra por obra, com aprovação e recebimento.</p></div></div><div id="lista"></div>`;
  await listaRecurso(el.querySelector("#lista"), {
    titulo: "Ordens de compra", fonte: "v_ocs", tabela: "ordens_compra", modulo: "compras", novoTexto: "Nova OC",
    busca: ["numero", "fornecedor_nome", "obra_nome"], ordem: ["id", false],
    filtros: [{ k: "status", l: "Status", op: Object.entries(STATUS_OC).map(([v, [l]]) => [v, l]) }, { k: "obra_id", l: "Obra", op: () => obrasOp(true) },
      { k: "de", l: "De", tipo: "data", aplicar: (q2, v) => q2.gte("data_compra", v) }, { k: "ate", l: "Até", tipo: "data", aplicar: (q2, v) => q2.lte("data_compra", v) }],
    colunas: [
      { l: "Número", pri: true, k: "numero", f: (r) => `<b>${esc(r.numero)}</b>` }, { l: "Obra", k: "obra_nome" }, { l: "Fornecedor", k: "fornecedor_nome" },
      { l: "Data", k: "data_compra", tipo: "data", f: (r) => data(r.data_compra) }, { l: "Total", k: "total", tipo: "moeda", num: true, f: (r) => moeda(r.total) },
      { l: "Status", k: "status", v: (r) => STATUS_OC[r.status]?.[0], f: (r) => tag(...(STATUS_OC[r.status] || [r.status, "cinza"])) },
    ],
    exportar: { totais: (d) => ["Total", "", "", "", moeda(d.reduce((a, r) => a + +r.total, 0)), ""] },
    aoClicar: (r) => ir("compras/" + r.id), aoNovo: () => nova(null),
  });
}

async function nova(obra) {
  const [obras, forn] = await Promise.all([obrasOp(), fornecedoresOp()]);
  if (!forn.length) return toast("Cadastre um fornecedor antes de criar uma OC.", "erro");
  if (!obras.length) return toast("Cadastre uma obra antes de criar uma OC.", "erro");
  formulario({
    titulo: "Nova ordem de compra", campos: [
      { k: "obra_id", l: "Obra", t: "select", op: obras, req: true, numerico: true },
      { k: "fornecedor_id", l: "Fornecedor", t: "select", op: forn, req: true, numerico: true },
      { k: "data_compra", l: "Data da compra", t: "date", req: true, padrao: hoje() },
      { k: "condicao_pagamento", l: "Condições de pagamento", ph: "Ex.: 30/60/90 dias, boleto" },
      { k: "observacoes", l: "Observações", t: "textarea", s2: true }],
    valores: { obra_id: obra }, textoOk: "Criar e adicionar itens",
    salvar: async (v) => { const oc = await q(sb.from("ordens_compra").insert(v).select().single()); toast(`${oc.numero} criada. Agora adicione os itens.`, "ok"); ir("compras/" + oc.id); },
  });
}

async function detalhe(el, id) {
  const [oc, itens, hist, nfs] = await Promise.all([
    q(sb.from("v_ocs").select("*").eq("id", id).maybeSingle()),
    q(sb.from("oc_itens").select("*, materiais(codigo,nome)").eq("oc_id", id).order("id")),
    q(sb.from("oc_historico").select("*").eq("oc_id", id).order("em", { ascending: false })),
    pode("notas", "ver") ? q(sb.from("v_notas").select("id,numero,valor_total,status_pagamento,data_emissao").eq("oc_id", id)) : [],
  ]);
  if (!oc) { el.innerHTML = '<div class="card"><div class="vazio">OC não encontrada.</div></div>'; return; }
  const ed = pode("compras", "editar"), apr = pode("compras", "aprovar");
  const editavel = ed && ["elaboracao", "reprovada"].includes(oc.status);
  const acoes = [];
  if (ed && ["elaboracao", "reprovada"].includes(oc.status)) acoes.push(["aguardando", "Enviar para aprovação", ""]);
  if (apr && oc.status === "aguardando") acoes.push(["aprovada", "Aprovar", "verde"], ["reprovada", "Reprovar", "verm"]);
  if (ed && oc.status === "aguardando") acoes.push(["elaboracao", "Voltar para elaboração", "sec"]);
  if (ed && oc.status === "aprovada") acoes.push(["enviada", "Marcar como enviada", ""]);
  if (ed && ["aprovada", "enviada", "parcial"].includes(oc.status)) acoes.push(["receber", "Registrar recebimento", "verde"]);
  if (ed && !["recebida", "cancelada"].includes(oc.status)) acoes.push(["cancelada", "Cancelar OC", "sec"]);
  const recebido = itens.reduce((a, i) => a + +i.quantidade_recebida * +i.valor_unitario, 0);
  el.innerHTML = `<div class="trilha"><a href="#compras">Ordens de compra</a> / ${esc(oc.numero)}</div>
    <div class="cab-pagina"><div><h1>${esc(oc.numero)}</h1><p>${tag(...(STATUS_OC[oc.status] || [oc.status, "cinza"]))} · ${esc(oc.obra_nome)} · ${esc(oc.fornecedor_nome)}</p></div>
      <div class="botoes">${pode("compras", "exportar") ? `<button class="bt sec" id="oc-pdf">${ic("pdf")}PDF</button><button class="bt sec" id="oc-imp">${ic("impressora")}Imprimir</button>` : ""}
      ${editavel ? `<button class="bt sec" id="oc-ed">${ic("editar")}Editar dados</button>` : ""}</div></div>
    ${oc.status === "reprovada" && oc.motivo_reprovacao ? `<div class="faixa alerta">${ic("alerta")}<span><b>Reprovada:</b> ${esc(oc.motivo_reprovacao)} — ajuste e envie novamente.</span></div>` : ""}
    ${acoes.length ? `<div class="card" style="margin-bottom:16px"><div class="cc" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><b style="margin-right:6px">Ações:</b>${acoes.map(([s, l, c]) => `<button class="bt ${c} peq" data-st="${s}">${esc(l)}</button>`).join("")}</div></div>` : ""}
    <div class="grade g-2-1">
      <div style="display:grid;gap:16px;align-content:start;min-width:0">
        <div class="card"><div class="ct"><h3>Itens</h3>${editavel ? `<button class="bt peq" id="it-novo">${ic("mais")}Adicionar item</button>` : ""}</div>
          ${tabela([
            { l: "Descrição", pri: true, f: (r) => `${esc(r.descricao)}${r.materiais ? `<div class="mu peq">${esc(r.materiais.codigo)} · estoque</div>` : ""}` },
            { l: "Qtd.", num: true, f: (r) => `${num(r.quantidade, 3)} ${esc(r.unidade)}` }, { l: "Valor unit.", num: true, f: (r) => moeda(r.valor_unitario) },
            { l: "Subtotal", num: true, f: (r) => moeda(r.quantidade * r.valor_unitario) },
            ...(["parcial", "recebida", "enviada", "aprovada"].includes(oc.status) ? [{ l: "Recebido", num: true, f: (r) => `${num(r.quantidade_recebida, 3)}` }] : []),
            ...(editavel ? [{ l: "", f: (r) => `<button class="bt sec peq" data-ed-it="${r.id}">${ic("editar")}</button> <button class="bt sec peq" data-del-it="${r.id}">${ic("lixo")}</button>` }] : []),
          ], itens, { vazio: "Nenhum item. Adicione os produtos e materiais desta compra." })}
          <div class="cc" style="border-top:1px solid var(--bd);display:grid;gap:6px;justify-items:end">
            <div>Subtotal: <b>${moeda(oc.subtotal)}</b></div>
            <div>Desconto: <b>${moeda(oc.desconto)}</b> ${editavel ? '<button class="lnk peq" id="oc-desc">alterar</button>' : ""}</div>
            <div style="font-size:18px">Total: <b>${moeda(oc.total)}</b></div>
            ${recebido ? `<div class="mu peq">Recebido até agora: ${moeda(recebido)}</div>` : ""}
          </div></div>
        <div id="oc-anexos"></div>
      </div>
      <div style="display:grid;gap:16px;align-content:start;min-width:0">
        <div class="card"><div class="ct"><h3>Dados da compra</h3></div><div class="cc"><div class="info-lista" style="grid-template-columns:1fr">
          ${[["Obra", `<a href="#obras/${oc.obra_id}">${esc(oc.obra_nome)}</a>`], ["Fornecedor", `<a href="#fornecedores/${oc.fornecedor_id}">${esc(oc.fornecedor_nome)}</a>`], ["Data da compra", data(oc.data_compra)], ["Condições de pagamento", esc(oc.condicao_pagamento || "-")], ["Observações", esc(oc.observacoes || "-")],
            ...(oc.aprovado_em ? [[oc.status === "reprovada" ? "Reprovada por" : "Aprovada por", `${esc(oc.aprovado_por_nome)} em ${dataHora(oc.aprovado_em)}`]] : [])].map(([k, v]) => `<div><small>${k}</small><span>${v}</span></div>`).join("")}
        </div></div></div>
        ${pode("notas", "ver") ? `<div class="card"><div class="ct"><h3>Notas fiscais</h3>${pode("notas", "cadastrar") && ["aprovada", "enviada", "parcial", "recebida"].includes(oc.status) ? `<a class="bt peq" href="#notas/nova/${oc.id}">${ic("mais")}Lançar NF</a>` : ""}</div>
          ${nfs.length ? `<div class="cc" style="display:grid;gap:8px">${nfs.map((n) => `<a class="anexo" href="#notas/${n.id}">${ic("notas")}<span class="nm">NF ${esc(n.numero)} · ${data(n.data_emissao)}</span><b>${moeda(n.valor_total)}</b></a>`).join("")}</div>` : '<div class="cc mu">Nenhuma NF lançada.</div>'}</div>` : ""}
        <div class="card"><div class="ct"><h3>Histórico</h3></div><div class="cc"><div class="linha-tempo">${hist.map((h) => `<div><b>${esc(h.acao)}</b><small>${esc(h.usuario_nome || "")} · ${dataHora(h.em)}</small>${h.detalhe ? `<small>${esc(h.detalhe)}</small>` : ""}</div>`).join("")}</div></div></div>
      </div>
    </div>`;
  anexos(el.querySelector("#oc-anexos"), "oc", id, { titulo: "Documentos anexos", categorias: ["pdf", "documento", "foto", "outro"] });
  const recarregar = () => detalhe(el, id);

  el.querySelectorAll("[data-st]").forEach((b) => b.onclick = async () => {
    const s = b.dataset.st;
    if (s === "receber") return receber(oc, itens, recarregar);
    let extra = {};
    if (s === "reprovada") {
      return formulario({ titulo: "Reprovar ordem de compra", campos: [{ k: "motivo", l: "Justificativa da reprovação", t: "textarea", req: true, s2: true }], textoOk: "Reprovar",
        salvar: async (v) => { await q(sb.from("ordens_compra").update({ status: "reprovada", motivo_reprovacao: v.motivo }).eq("id", id)); toast("OC reprovada."); recarregar(); } });
    }
    if (s === "aguardando" && !itens.length) return toast("Adicione ao menos um item antes de enviar.", "erro");
    const msgs = { aguardando: "Enviar esta OC para aprovação?", aprovada: `Aprovar a ${oc.numero} no valor de ${moeda(oc.total)}?`, cancelada: "Cancelar esta OC? O registro será mantido no histórico.", enviada: "Confirmar que a OC foi enviada ao fornecedor?", elaboracao: "Voltar a OC para elaboração?" };
    if (!(await confirmar(msgs[s] || "Confirmar?", { perigo: s === "cancelada" }))) return;
    try { await q(sb.from("ordens_compra").update({ status: s, ...extra }).eq("id", id)); toast("Status atualizado.", "ok"); recarregar(); } catch (e) { toast(msgErro(e), "erro"); }
  });
  el.querySelector("#it-novo")?.addEventListener("click", () => item(oc, null, recarregar));
  el.querySelectorAll("[data-ed-it]").forEach((b) => b.onclick = () => item(oc, itens.find((i) => i.id == b.dataset.edIt), recarregar));
  el.querySelectorAll("[data-del-it]").forEach((b) => b.onclick = async () => {
    if (!(await confirmar("Remover este item?", { perigo: true, ok: "Remover" }))) return;
    try { await q(sb.from("oc_itens").delete().eq("id", b.dataset.delIt)); recarregar(); } catch (e) { toast(msgErro(e), "erro"); }
  });
  el.querySelector("#oc-desc")?.addEventListener("click", () => formulario({ titulo: "Desconto da OC", campos: [{ k: "desconto", l: "Desconto (R$)", t: "money", min: 0, req: true }], valores: oc,
    salvar: async (v) => { if (v.desconto > oc.subtotal) throw new Error("O desconto não pode ser maior que o subtotal."); await q(sb.from("ordens_compra").update({ desconto: v.desconto }).eq("id", id)); recarregar(); } }));
  el.querySelector("#oc-ed")?.addEventListener("click", async () => {
    const [obras, forn] = await Promise.all([obrasOp(), fornecedoresOp()]);
    formulario({ titulo: "Editar dados da OC", campos: [
      { k: "obra_id", l: "Obra", t: "select", op: obras, req: true, numerico: true }, { k: "fornecedor_id", l: "Fornecedor", t: "select", op: forn, req: true, numerico: true },
      { k: "data_compra", l: "Data da compra", t: "date", req: true }, { k: "condicao_pagamento", l: "Condições de pagamento" }, { k: "observacoes", l: "Observações", t: "textarea", s2: true }],
      valores: oc, salvar: async (v) => { await q(sb.from("ordens_compra").update(v).eq("id", id)); recarregar(); } });
  });
  const docOC = () => ({ titulo: `Ordem de Compra ${oc.numero}`, cols: [{ l: "Descrição", k: "descricao" }, { l: "Un.", k: "unidade" }, { l: "Qtd.", k: "quantidade", tipo: "num" }, { l: "Valor unit.", k: "valor_unitario", tipo: "moeda" }, { l: "Subtotal", v: (r) => r.quantidade * r.valor_unitario, tipo: "moeda" }],
    blocos: [{ titulo: "Dados da compra", linhas: [["Status", STATUS_OC[oc.status][0]], ["Obra", oc.obra_nome], ["Fornecedor", oc.fornecedor_nome], ["Data", data(oc.data_compra)], ["Condições", oc.condicao_pagamento || "-"], ["Observações", oc.observacoes || "-"], ...(oc.aprovado_em ? [["Aprovação", `${oc.aprovado_por_nome} em ${dataHora(oc.aprovado_em)}`]] : [])] }],
    totais: ["", "", "", "Subtotal / desconto / total", `${moeda(oc.subtotal)} / ${moeda(oc.desconto)} / ${moeda(oc.total)}`] });
  el.querySelector("#oc-pdf")?.addEventListener("click", () => { const d = docOC(); pdf(d.titulo, d.cols, itens, { blocos: d.blocos, totais: d.totais, paisagem: false }); });
  el.querySelector("#oc-imp")?.addEventListener("click", () => { const d = docOC(); imprimir(d.titulo, d.cols, itens.map((r) => d.cols.map((c) => { const v = c.v ? c.v(r) : r[c.k]; return c.tipo === "moeda" ? moeda(v) : c.tipo === "num" ? num(v, 3) : v; })), { blocos: d.blocos, totais: d.totais }); });
}

async function item(oc, it, ok) {
  const mats = await q(sb.from("materiais").select("id,codigo,nome,unidade,valor_unitario").eq("ativo", true).order("nome"));
  const m = formulario({
    titulo: it ? "Editar item" : "Adicionar item", campos: [
      { k: "material_id", l: "Material do estoque (opcional)", t: "select", op: mats.map((x) => [x.id, `${x.codigo} · ${x.nome}`]), vazio: "— Item avulso (não entra no estoque) —", numerico: true, s2: true },
      { k: "descricao", l: "Descrição", req: true, s2: true }, { k: "unidade", l: "Unidade", t: "select", op: UNIDADES, req: true, vazio: false, padrao: "UN" },
      { k: "quantidade", l: "Quantidade", t: "num", req: true, min: 0.001 }, { k: "valor_unitario", l: "Valor unitário (R$)", t: "money", req: true, min: 0 }],
    valores: it || {},
    salvar: async (v) => {
      if (it) await q(sb.from("oc_itens").update(v).eq("id", it.id)); else await q(sb.from("oc_itens").insert({ ...v, oc_id: oc.id }));
      ok();
    },
  });
  m.el.querySelector('[name="material_id"]').addEventListener("change", (e) => {
    const x = mats.find((y) => y.id == e.target.value); if (!x) return;
    const f = m.el; f.querySelector('[name="descricao"]').value = x.nome; f.querySelector('[name="unidade"]').value = x.unidade;
    if (+x.valor_unitario) f.querySelector('[name="valor_unitario"]').value = Number(x.valor_unitario).toFixed(2).replace(".", ",");
  });
}

async function receber(oc, itens, ok) {
  const deps = await depositosOp();
  const pend = itens.filter((i) => +i.quantidade_recebida < +i.quantidade);
  const obraDep = (await q(sb.from("depositos").select("id").eq("obra_id", oc.obra_id).limit(1)))[0]?.id;
  const m = modal({ titulo: `Recebimento da ${oc.numero}`, tamanho: "larga", corpo: `
    <div class="campo" style="margin-bottom:14px"><label>Depósito de destino (itens com material de estoque)</label><select class="inp" id="rc-dep">${deps.map(([v, l]) => `<option value="${v}" ${v == obraDep ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></div>
    ${tabela([{ l: "Item", pri: true, f: (r) => esc(r.descricao) + (r.material_id ? ' <span class="tag azul">estoque</span>' : "") }, { l: "Pedido", num: true, f: (r) => num(r.quantidade, 3) }, { l: "Já recebido", num: true, f: (r) => num(r.quantidade_recebida, 3) },
      { l: "Receber agora", f: (r) => `<input class="inp" style="width:110px;height:36px" inputmode="decimal" data-q="${r.id}" value="${String(+r.quantidade - +r.quantidade_recebida).replace(".", ",")}">` }], pend)}
    <div class="form-erro oculto"></div>`, rodape: `<button class="bt sec" data-c>Cancelar</button><button class="bt verde" data-ok>Confirmar recebimento</button>` });
  m.el.querySelector("[data-c]").onclick = m.fechar;
  m.el.querySelector("[data-ok]").onclick = async () => {
    const itensQ = [...m.el.querySelectorAll("[data-q]")].map((i) => ({ item_id: +i.dataset.q, quantidade: lerNumero(i.value) || 0 })).filter((x) => x.quantidade > 0);
    if (!itensQ.length) return toast("Informe ao menos uma quantidade.", "erro");
    const { error } = await sb.rpc("oc_receber", { p_oc: oc.id, p_itens: itensQ, p_deposito: +m.el.querySelector("#rc-dep").value || null });
    if (error) { const b = m.el.querySelector(".form-erro"); b.textContent = msgErro(error); b.classList.remove("oculto"); return; }
    m.fechar(); toast("Recebimento registrado e estoque atualizado.", "ok"); ok();
  };
}
