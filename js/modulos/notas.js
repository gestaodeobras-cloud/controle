import { sb, esc, ic, moeda, data, hoje, somaDias, tag, pode, toast, msgErro, q, tabela, confirmar, formulario, modal, fornecedoresOp, obrasOp, lerNumero, ir, docFmt, dataHora } from "../core.js";
import { listaRecurso } from "../crud.js";
import { anexos } from "../anexos.js";
import { tagNF } from "./obras.js";

const FORMAS = ["Boleto", "PIX", "Transferência", "Cartão", "Dinheiro", "Cheque", "Outro"];

export async function render(el, [p1, p2]) {
  if (p1 === "nova") { await render(el, []); return nova(p2 ? +p2 : null); }
  if (p1) return detalhe(el, +p1);
  const { count: venc } = await sb.from("v_notas").select("id", { count: "exact", head: true }).eq("status_pagamento", "vencida");
  const prox = await q(sb.from("v_notas").select("id").in("status_pagamento", ["pendente", "parcial"]).gte("prox_venc", hoje()).lte("prox_venc", somaDias(hoje(), 7)));
  el.innerHTML = `<div class="cab-pagina"><div><h1>Notas Fiscais</h1><p>Notas recebidas dos fornecedores, parcelas e pagamentos.</p></div></div>
    ${venc ? `<div class="faixa alerta">${ic("alerta")}<span><b>${venc} nota(s) com pagamento atrasado.</b> Filtre por "Vencida" para ver.</span></div>` : ""}
    ${prox.length ? `<div class="faixa aviso">${ic("relogio")}<span><b>${prox.length} nota(s)</b> com parcela vencendo nos próximos 7 dias.</span></div>` : ""}
    <div id="lista"></div>`;
  await listaRecurso(el.querySelector("#lista"), {
    titulo: "Notas fiscais", fonte: "v_notas", tabela: "notas_fiscais", modulo: "notas", novoTexto: "Nova NF",
    busca: ["numero", "fornecedor_nome", "chave_acesso", "oc_numero"], ordem: ["data_emissao", false], ordem2: ["id", false],
    filtros: [{ k: "status_pagamento", l: "Pagamento", op: [["pendente", "Pendente"], ["parcial", "Parcialmente paga"], ["paga", "Paga"], ["vencida", "Vencida"], ["cancelada", "Cancelada"]] },
      { k: "fornecedor_id", l: "Fornecedor", op: fornecedoresOp }, { k: "de", l: "Emissão de", tipo: "data", aplicar: (q2, v) => q2.gte("data_emissao", v) }, { k: "ate", l: "até", tipo: "data", aplicar: (q2, v) => q2.lte("data_emissao", v) }],
    colunas: [
      { l: "NF", pri: true, k: "numero", f: (r) => `<b>NF ${esc(r.numero)}${r.serie ? "/" + esc(r.serie) : ""}</b>` }, { l: "Fornecedor", k: "fornecedor_nome" },
      { l: "Obra", k: "obra_nome" }, { l: "OC", k: "oc_numero" }, { l: "Emissão", k: "data_emissao", tipo: "data", f: (r) => data(r.data_emissao) },
      { l: "Valor", k: "valor_total", tipo: "moeda", num: true, f: (r) => moeda(r.valor_total) }, { l: "Saldo", k: "saldo", tipo: "moeda", num: true, f: (r) => moeda(r.saldo) },
      { l: "Próx. venc.", k: "prox_venc", tipo: "data", f: (r) => data(r.prox_venc) || "-" }, { l: "Pagamento", k: "status_pagamento", f: (r) => tagNF(r.status_pagamento) },
    ],
    exportar: { totais: (d) => ["Total", "", "", "", "", moeda(d.reduce((a, r) => a + +r.valor_total, 0)), moeda(d.reduce((a, r) => a + +r.saldo, 0)), "", ""] },
    aoClicar: (r) => ir("notas/" + r.id), aoNovo: () => nova(null),
  });
}

async function camposNF(valores = {}) {
  const forn = await fornecedoresOp();
  const ocs = await q(sb.from("v_ocs").select("id,numero,fornecedor_id,obra_nome,total").in("status", ["aprovada", "enviada", "parcial", "recebida"]).order("id", { ascending: false }).limit(300));
  return { ocs, campos: [
    { k: "fornecedor_id", l: "Fornecedor", t: "select", op: forn, req: true, numerico: true },
    { k: "oc_id", l: "Ordem de compra relacionada", t: "select", op: ocs.filter((o) => !valores.fornecedor_id || o.fornecedor_id == valores.fornecedor_id).map((o) => [o.id, `${o.numero} · ${o.obra_nome} · ${moeda(o.total)}`]), vazio: "— Sem OC —", numerico: true },
    { k: "numero", l: "Número da NF", req: true }, { k: "serie", l: "Série" },
    { k: "chave_acesso", l: "Chave de acesso (44 dígitos)", s2: true, valida: (v) => v.replace(/\D/g, "").length === 44 ? null : "A chave deve ter 44 dígitos" },
    { k: "data_emissao", l: "Data de emissão", t: "date", req: true, padrao: hoje() }, { k: "data_recebimento", l: "Data de recebimento", t: "date", padrao: hoje() },
    { k: "valor_total", l: "Valor total (R$)", t: "money", req: true, min: 0.01 }, { k: "condicao_pagamento", l: "Condição de pagamento", t: "select", op: FORMAS, padrao: "Boleto" },
    { k: "obra_id", l: "Obra (se não houver OC)", t: "select", op: await obrasOp(), numerico: true },
    { k: "observacoes", l: "Observações", t: "textarea", s2: true },
  ] };
}
const limpaNF = (v) => ({ ...v, chave_acesso: v.chave_acesso ? v.chave_acesso.replace(/\D/g, "") : null });

async function nova(oc) {
  let valores = {};
  if (oc) { const o = await q(sb.from("ordens_compra").select("id,fornecedor_id,obra_id,total,condicao_pagamento").eq("id", oc).maybeSingle()); if (o) valores = { oc_id: o.id, fornecedor_id: o.fornecedor_id, obra_id: o.obra_id, valor_total: o.total }; }
  const { ocs, campos } = await camposNF(valores);
  if (!campos[0].op.length) return toast("Cadastre um fornecedor primeiro.", "erro");
  const m = formulario({ titulo: "Nova nota fiscal", campos, valores, tamanho: "larga", textoOk: "Salvar e definir parcelas",
    salvar: async (v) => { const n = await q(sb.from("notas_fiscais").insert(limpaNF(v)).select().single()); setTimeout(() => parcelas(n, () => ir("notas/" + n.id)), 50); } });
  // ao trocar fornecedor, filtra as OCs
  const sf = m.el.querySelector('[name="fornecedor_id"]'), so = m.el.querySelector('[name="oc_id"]');
  sf.addEventListener("change", () => { so.innerHTML = '<option value="">— Sem OC —</option>' + ocs.filter((o) => o.fornecedor_id == sf.value).map((o) => `<option value="${o.id}">${esc(o.numero)} · ${esc(o.obra_nome)} · ${moeda(o.total)}</option>`).join(""); });
}

// editor de parcelas (contas a pagar da NF)
export function parcelas(n, ok) {
  const m = modal({ titulo: `Parcelas da NF ${n.numero} · ${moeda(n.valor_total)}`, tamanho: "larga", corpo: `
    <div class="form-grade" style="grid-template-columns:repeat(4,minmax(0,1fr))">
      <div class="campo"><label>Nº de parcelas</label><input class="inp" id="p-n" type="number" min="1" max="60" value="1"></div>
      <div class="campo"><label>1º vencimento</label><input class="inp" id="p-v" type="date" value="${n.data_vencimento || somaDias(n.data_emissao, 30)}"></div>
      <div class="campo"><label>Intervalo (dias)</label><input class="inp" id="p-i" type="number" min="1" value="30"></div>
      <div class="campo"><label>Forma</label><select class="inp" id="p-f">${FORMAS.map((f) => `<option ${f === (n.condicao_pagamento || "Boleto") ? "selected" : ""}>${f}</option>`).join("")}</select></div>
    </div><div id="p-lista" style="margin-top:14px"></div><p id="p-soma" class="peq"></p><div class="form-erro oculto"></div>`,
    rodape: `<button class="bt sec" data-c>Depois</button><button class="bt" data-ok>Salvar parcelas</button>` });
  const $m = (s) => m.el.querySelector(s);
  const gerar = () => {
    const qtd = Math.max(1, Math.min(60, +$m("#p-n").value || 1)), int = +$m("#p-i").value || 30;
    const base = Math.floor((n.valor_total * 100) / qtd), resto = Math.round(n.valor_total * 100) - base * qtd;
    let html = ""; let d = $m("#p-v").value || hoje();
    for (let i = 0; i < qtd; i++) {
      const v = (base + (i === 0 ? resto : 0)) / 100;
      html += `<div style="display:grid;grid-template-columns:70px 1fr 1fr 1fr;gap:8px;margin-bottom:6px;align-items:center"><b>${i + 1}/${qtd}</b><input class="inp" type="date" data-d value="${d}"><input class="inp" inputmode="decimal" data-v value="${v.toFixed(2).replace(".", ",")}"><input class="inp" data-b placeholder="Nº do boleto (opcional)"></div>`;
      d = somaDias(d, int);
    }
    $m("#p-lista").innerHTML = html; soma();
    $m("#p-lista").querySelectorAll("[data-v]").forEach((i) => i.oninput = soma);
  };
  const soma = () => { const s = [...m.el.querySelectorAll("[data-v]")].reduce((a, i) => a + (lerNumero(i.value) || 0), 0), dif = Math.round((n.valor_total - s) * 100) / 100;
    $m("#p-soma").innerHTML = `Soma: <b>${moeda(s)}</b> · Diferença: <b class="${dif ? "verm" : "verde"}">${moeda(dif)}</b>`; };
  ["#p-n", "#p-v", "#p-i"].forEach((s) => $m(s).addEventListener("change", gerar));
  gerar();
  $m("[data-c]").onclick = () => { m.fechar(); ok?.(); };
  $m("[data-ok]").onclick = async () => {
    const d = [...m.el.querySelectorAll("[data-d]")], v = [...m.el.querySelectorAll("[data-v]")], b = [...m.el.querySelectorAll("[data-b]")];
    const p = d.map((x, i) => ({ vencimento: x.value, valor: lerNumero(v[i].value), numero_boleto: b[i].value, forma_pagamento: $m("#p-f").value }));
    const erro = $m(".form-erro");
    if (p.some((x) => !x.vencimento || !(x.valor > 0))) { erro.textContent = "Informe data e valor de todas as parcelas."; erro.classList.remove("oculto"); return; }
    const { error } = await sb.rpc("nf_definir_parcelas", { p_nf: n.id, p_parcelas: p });
    if (error) { erro.textContent = msgErro(error); erro.classList.remove("oculto"); return; }
    m.fechar(); toast("Parcelas registradas em Contas a pagar.", "ok"); ok?.();
  };
}

export function registrarPagamento(l, ok) {
  formulario({ titulo: `${l.tipo === "receita" ? "Registrar recebimento" : "Registrar pagamento"} · ${l.descricao}`, campos: [
    { k: "valor_pago", l: `Valor ${l.tipo === "receita" ? "recebido" : "pago"} acumulado (R$) — total ${moeda(l.valor)}`, t: "money", req: true, min: 0, max: +l.valor, s2: true },
    { k: "data_pagamento", l: "Data", t: "date", req: true }, { k: "forma_pagamento", l: "Forma", t: "select", op: FORMAS },
    { k: "observacoes", l: "Observações", t: "textarea", s2: true }],
    valores: { ...l, valor_pago: +l.valor_pago || +l.valor, data_pagamento: l.data_pagamento || hoje() },
    salvar: async (v) => { await q(sb.from("lancamentos").update(v).eq("id", l.id)); toast("Pagamento registrado.", "ok"); ok(); },
  });
}

async function detalhe(el, id) {
  const [n, par] = await Promise.all([
    q(sb.from("v_notas").select("*").eq("id", id).maybeSingle()),
    q(sb.from("v_lancamentos").select("*").eq("nf_id", id).order("parcela")),
  ]);
  if (!n) { el.innerHTML = '<div class="card"><div class="vazio">Nota fiscal não encontrada.</div></div>'; return; }
  const ed = pode("notas", "editar") && !n.cancelada, temPago = par.some((p) => +p.valor_pago > 0);
  const recarregar = () => detalhe(el, id);
  const SIT = { pendente: ["A vencer", "azul"], parcial: ["Parcial", "lar"], pago: ["Pago", "verde"], vencido: ["Vencido", "verm"], cancelado: ["Cancelado", "cinza"] };
  el.innerHTML = `<div class="trilha"><a href="#notas">Notas fiscais</a> / NF ${esc(n.numero)}</div>
    <div class="cab-pagina"><div><h1>NF ${esc(n.numero)}${n.serie ? "/" + esc(n.serie) : ""}</h1><p>${tagNF(n.status_pagamento)} · ${esc(n.fornecedor_nome)}</p></div>
    <div class="botoes">${ed ? `<button class="bt sec" id="nf-cancel">${ic("x")}Cancelar NF</button><button class="bt sec" id="nf-ed">${ic("editar")}Editar</button>${!temPago ? `<button class="bt" id="nf-par">${ic("financeiro")}${par.length ? "Refazer parcelas" : "Definir parcelas"}</button>` : ""}` : ""}</div></div>
    ${n.cancelada ? `<div class="faixa alerta">${ic("alerta")}Esta nota fiscal foi cancelada. O registro é mantido para histórico.</div>` : ""}
    <div class="grade g4" style="margin-bottom:16px">
      <div class="card kpi"><div class="ic t-azul">${ic("notas")}</div><div><small>Valor original</small><b>${moeda(n.valor_total)}</b></div></div>
      <div class="card kpi"><div class="ic t-verde">${ic("ok")}</div><div><small>Valor pago</small><b>${moeda(n.valor_pago)}</b></div></div>
      <div class="card kpi"><div class="ic t-lar">${ic("relogio")}</div><div><small>Saldo pendente</small><b>${moeda(n.saldo)}</b></div></div>
      <div class="card kpi"><div class="ic t-${n.status_pagamento === "vencida" ? "verm" : "azul"}">${ic("relogio")}</div><div><small>Próximo vencimento</small><b>${data(n.prox_venc) || "-"}</b></div></div>
    </div>
    <div class="grade g-2-1"><div style="display:grid;gap:16px;align-content:start;min-width:0">
      <div class="card"><div class="ct"><h3>Parcelas e pagamentos</h3></div>${tabela([
        { l: "Parcela", pri: true, f: (r) => `${r.parcela}/${r.total_parcelas}` }, { l: "Vencimento", f: (r) => data(r.vencimento) }, { l: "Valor", num: true, f: (r) => moeda(r.valor) },
        { l: "Pago", num: true, f: (r) => moeda(r.valor_pago) }, { l: "Boleto", f: (r) => esc(r.numero_boleto || "-") }, { l: "Pago em", f: (r) => data(r.data_pagamento) || "-" },
        { l: "Situação", f: (r) => tag(...(SIT[r.situacao] || [r.situacao, "cinza"])) },
        ...(pode("notas", "editar") || pode("financeiro", "editar") ? [{ l: "", f: (r) => r.status === "cancelado" ? "" : `<button class="bt ${r.status === "pago" ? "sec" : "verde"} peq" data-pg="${r.id}">${r.status === "pago" ? "Ajustar" : "Pagar"}</button> <button class="bt sec peq" data-bol="${r.id}" title="Vencimento/boleto">${ic("editar")}</button>` }] : []),
      ], par, { vazio: "Parcelas ainda não definidas. Use “Definir parcelas”." })}</div>
      <div id="nf-anexos"></div></div>
      <div class="card" style="align-self:start"><div class="ct"><h3>Dados da nota</h3></div><div class="cc"><div class="info-lista" style="grid-template-columns:1fr">
        ${[["Fornecedor", `<a href="#fornecedores/${n.fornecedor_id}">${esc(n.fornecedor_nome)}</a>`], ["CNPJ do emitente", esc(docFmt(n.cnpj_emitente) || "-")], ["Chave de acesso", `<span style="font-family:monospace;font-size:12px">${esc(n.chave_acesso || "-")}</span>`],
          ["Obra", n.obra_id ? `<a href="#obras/${n.obra_id}">${esc(n.obra_nome)}</a>` : "-"], ["Ordem de compra", n.oc_id ? `<a href="#compras/${n.oc_id}">${esc(n.oc_numero)}</a>` : "-"],
          ["Emissão", data(n.data_emissao)], ["Recebimento", data(n.data_recebimento) || "-"], ["Condição de pagamento", esc(n.condicao_pagamento || "-")], ["Observações", esc(n.observacoes || "-")], ["Lançada em", dataHora(n.criado_em)]].map(([k, v]) => `<div><small>${k}</small><span>${v}</span></div>`).join("")}
      </div></div></div></div>`;
  anexos(el.querySelector("#nf-anexos"), "nf", id, { titulo: "Arquivos da nota (PDF, XML, boleto, comprovante)", categorias: ["pdf", "xml", "boleto", "comprovante", "foto", "outro"] });
  el.querySelectorAll("[data-pg]").forEach((b) => b.onclick = () => registrarPagamento(par.find((p) => p.id == b.dataset.pg), recarregar));
  el.querySelectorAll("[data-bol]").forEach((b) => b.onclick = () => { const p = par.find((x) => x.id == b.dataset.bol);
    formulario({ titulo: `Parcela ${p.parcela}/${p.total_parcelas}`, campos: [{ k: "vencimento", l: "Vencimento", t: "date", req: true }, { k: "numero_boleto", l: "Número/linha do boleto", s2: true }], valores: p,
      salvar: async (v) => { await q(sb.from("lancamentos").update(v).eq("id", p.id)); recarregar(); } }); });
  el.querySelector("#nf-par")?.addEventListener("click", () => parcelas(n, recarregar));
  el.querySelector("#nf-ed")?.addEventListener("click", async () => {
    const { campos } = await camposNF(n);
    formulario({ titulo: "Editar nota fiscal", campos: temPago ? campos.filter((c) => !["valor_total", "fornecedor_id", "oc_id"].includes(c.k)) : campos, valores: n, tamanho: "larga",
      salvar: async (v) => {
        const mudouValor = v.valor_total != null && +v.valor_total !== +n.valor_total;
        await q(sb.from("notas_fiscais").update(limpaNF(v)).eq("id", id));
        if (mudouValor && par.length) toast("O valor mudou: redefina as parcelas.", "erro");
        recarregar();
      } });
  });
  el.querySelector("#nf-cancel")?.addEventListener("click", async () => {
    if (!(await confirmar("Cancelar esta nota fiscal? As parcelas não pagas serão canceladas. O registro será mantido.", { perigo: true, ok: "Cancelar NF" }))) return;
    try { await q(sb.from("notas_fiscais").update({ cancelada: true }).eq("id", id)); recarregar(); } catch (e) { toast(msgErro(e), "erro"); }
  });
}
