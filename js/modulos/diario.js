import { sb, S, esc, ic, data, hoje, tag, pode, toast, msgErro, q, tabela, formulario, obrasOp, ir, dataHora, linkArquivo } from "../core.js";
import { listaRecurso } from "../crud.js";
import { anexos } from "../anexos.js";
import { pdf } from "../exportar.js";

const CLIMA = ["Ensolarado", "Parcialmente nublado", "Nublado", "Chuvoso", "Chuva forte (paralisação)", "Frio", "Calor intenso"];
const campos = (obras, aprovado) => [
  { k: "obra_id", l: "Obra", t: "select", op: obras, req: true, numerico: true, dis: aprovado },
  { k: "data", l: "Data", t: "date", req: true, padrao: hoje(), dis: aprovado },
  { k: "responsavel", l: "Responsável", padrao: S.sessao.membro.nome }, { k: "clima", l: "Condições climáticas", t: "select", op: CLIMA },
  { k: "equipe_presente", l: "Equipe presente", t: "textarea", s2: true, ph: "Ex.: 2 pedreiros, 3 serventes, 1 eletricista" },
  { k: "servicos_executados", l: "Serviços executados", t: "textarea", s2: true, req: true },
  { k: "materiais_utilizados", l: "Materiais utilizados", t: "textarea", s2: true }, { k: "equipamentos_utilizados", l: "Equipamentos utilizados", t: "textarea", s2: true },
  { k: "ocorrencias", l: "Ocorrências", t: "textarea", s2: true }, { k: "problemas", l: "Problemas encontrados", t: "textarea", s2: true },
  { k: "observacoes", l: "Observações", t: "textarea", s2: true },
  ...(aprovado ? [{ k: "motivo_correcao", l: "Motivo da correção (obrigatório — o registro já foi aprovado)", req: true, s2: true }] : []),
];

export async function render(el, [p1, p2]) {
  if (p1 === "novo") { await render(el, []); return novo(p2 ? +p2 : null); }
  if (p1 === "galeria") return galeria(el);
  if (p1) return detalhe(el, +p1);
  const obras = await obrasOp(true);
  el.innerHTML = `<div class="cab-pagina"><div><h1>Diário de Obra</h1><p>Registro diário da execução, com fotos tiradas pelo celular.</p></div>
    <div class="botoes"><a class="bt sec" href="#diario/galeria">${ic("camera")}Galeria de fotos</a></div></div><div id="lista"></div>`;
  await listaRecurso(el.querySelector("#lista"), {
    titulo: "Diário de obra", fonte: "diarios", tabela: "diarios", modulo: "diario", novoTexto: "Novo registro", select: "*, obras(codigo,nome)",
    busca: ["servicos_executados", "ocorrencias", "problemas", "responsavel"], dicaBusca: "Pesquisar nos serviços, ocorrências, problemas...", ordem: ["data", false],
    filtros: [{ k: "obra_id", l: "Obra", op: obras }, { k: "status", l: "Status", op: [["rascunho", "Rascunho"], ["aprovado", "Aprovado"]] },
      { k: "de", l: "De", tipo: "data", aplicar: (q2, v) => q2.gte("data", v) }, { k: "ate", l: "Até", tipo: "data", aplicar: (q2, v) => q2.lte("data", v) }],
    colunas: [{ l: "Data", pri: true, k: "data", tipo: "data", f: (r) => `<b>${data(r.data)}</b>` }, { l: "Obra", v: (r) => r.obras?.nome, f: (r) => esc(`${r.obras?.codigo} · ${r.obras?.nome}`) },
      { l: "Responsável", k: "responsavel" }, { l: "Clima", k: "clima" }, { l: "Serviços", k: "servicos_executados", f: (r) => esc((r.servicos_executados || "").slice(0, 70)) + ((r.servicos_executados || "").length > 70 ? "…" : "") },
      { l: "Problemas", k: "problemas", f: (r) => r.problemas ? tag("Sim", "verm") : "" }, { l: "Status", k: "status", f: (r) => tag(r.status === "aprovado" ? "Aprovado" : "Rascunho", r.status === "aprovado" ? "verde" : "lar") }],
    aoClicar: (r) => ir("diario/" + r.id), aoNovo: () => novo(null),
  });
}

async function novo(obra) {
  const obras = await obrasOp();
  if (!obras.length) return toast("Cadastre uma obra primeiro.", "erro");
  formulario({ titulo: "Novo registro do diário", campos: campos(obras, false), valores: { obra_id: obra }, tamanho: "larga", textoOk: "Salvar e anexar fotos",
    salvar: async (v) => { const d = await q(sb.from("diarios").insert(v).select().single()); toast("Registro salvo. Agora anexe as fotos do dia.", "ok"); ir("diario/" + d.id); } });
}

async function detalhe(el, id) {
  const [d, cor] = await Promise.all([q(sb.from("diarios").select("*, obras(codigo,nome)").eq("id", id).maybeSingle()), q(sb.from("diario_correcoes").select("*").eq("diario_id", id).order("em", { ascending: false }))]);
  if (!d) { el.innerHTML = '<div class="card"><div class="vazio">Registro não encontrado.</div></div>'; return; }
  const apr = d.status === "aprovado", rec = () => detalhe(el, id);
  el.innerHTML = `<div class="trilha"><a href="#diario">Diário de obra</a> / ${data(d.data)}</div>
    <div class="cab-pagina"><div><h1>Diário · ${data(d.data)}</h1><p>${tag(apr ? "Aprovado" : "Rascunho", apr ? "verde" : "lar")} · <a href="#obras/${d.obra_id}">${esc(d.obras?.codigo)} · ${esc(d.obras?.nome)}</a>${apr ? ` · aprovado por ${esc(d.aprovado_por_nome)} em ${dataHora(d.aprovado_em)}` : ""}</p></div>
    <div class="botoes">${pode("diario", "exportar") ? `<button class="bt sec" id="d-pdf">${ic("pdf")}PDF</button>` : ""}${pode("diario", "editar") ? `<button class="bt sec" id="d-ed">${ic("editar")}${apr ? "Registrar correção" : "Editar"}</button>` : ""}${!apr && pode("diario", "aprovar") ? `<button class="bt verde" id="d-apr">${ic("ok")}Aprovar</button>` : ""}</div></div>
    <div class="grade g-2-1"><div style="display:grid;gap:16px;align-content:start;min-width:0"><div class="card"><div class="cc"><div class="info-lista" style="grid-template-columns:1fr">
      ${[["Responsável", d.responsavel], ["Condições climáticas", d.clima], ["Equipe presente", d.equipe_presente], ["Serviços executados", d.servicos_executados], ["Materiais utilizados", d.materiais_utilizados], ["Equipamentos utilizados", d.equipamentos_utilizados], ["Ocorrências", d.ocorrencias], ["Problemas encontrados", d.problemas], ["Observações", d.observacoes]]
        .map(([k, v]) => `<div><small>${k}</small><span style="white-space:pre-wrap">${esc(v || "-")}</span></div>`).join("")}</div></div></div>
      <div id="d-fotos"></div></div>
      <div class="card" style="align-self:start"><div class="ct"><h3>Histórico de correções</h3></div><div class="cc">${cor.length ? `<div class="linha-tempo">${cor.map((c) => `<div><b>${esc(c.motivo)}</b><small>${esc(c.usuario_nome)} · ${dataHora(c.em)}</small><small>${esc(difs(c.antes, c.depois))}</small></div>`).join("")}</div>` : '<span class="mu">Nenhuma correção registrada.</span>'}</div></div></div>`;
  anexos(el.querySelector("#d-fotos"), "diario", id, { titulo: "Fotos do dia", fotos: true, categorias: ["foto", "documento", "outro"] });
  el.querySelector("#d-apr")?.addEventListener("click", async () => { try { await q(sb.from("diarios").update({ status: "aprovado" }).eq("id", id)); toast("Diário aprovado. Alterações futuras ficarão registradas.", "ok"); rec(); } catch (e) { toast(msgErro(e), "erro"); } });
  el.querySelector("#d-ed")?.addEventListener("click", async () => {
    const obras = await obrasOp(true);
    formulario({ titulo: apr ? "Correção de diário aprovado" : "Editar diário", campos: campos(obras, apr), valores: { ...d, motivo_correcao: "" }, tamanho: "larga",
      salvar: async (v) => { delete v.obra_id; delete v.data; await q(sb.from("diarios").update(v).eq("id", id)); toast("Diário atualizado.", "ok"); rec(); } });
  });
  el.querySelector("#d-pdf")?.addEventListener("click", () => pdf(`Diário de obra · ${data(d.data)}`, [], [], { blocos: [{ titulo: `${d.obras?.codigo} · ${d.obras?.nome}`, linhas: [["Data", data(d.data)], ["Status", apr ? `Aprovado por ${d.aprovado_por_nome} em ${dataHora(d.aprovado_em)}` : "Rascunho"], ["Responsável", d.responsavel], ["Clima", d.clima], ["Equipe presente", d.equipe_presente], ["Serviços executados", d.servicos_executados], ["Materiais", d.materiais_utilizados], ["Equipamentos", d.equipamentos_utilizados], ["Ocorrências", d.ocorrencias], ["Problemas", d.problemas], ["Observações", d.observacoes]].map(([k, v]) => [k, v || "-"]) },
    ...(cor.length ? [{ titulo: "Correções após aprovação", linhas: cor.map((c) => [dataHora(c.em), `${c.usuario_nome}: ${c.motivo}`]) }] : [])], paisagem: false }));
}

const NOMES = { responsavel: "Responsável", clima: "Clima", equipe_presente: "Equipe", servicos_executados: "Serviços", materiais_utilizados: "Materiais", equipamentos_utilizados: "Equipamentos", ocorrencias: "Ocorrências", problemas: "Problemas", observacoes: "Observações" };
const difs = (a, b) => Object.keys(NOMES).filter((k) => (a?.[k] || "") !== (b?.[k] || "")).map((k) => `${NOMES[k]} alterado`).join(", ");

async function galeria(el) {
  const obras = await obrasOp(true);
  el.innerHTML = `<div class="trilha"><a href="#diario">Diário de obra</a> / Galeria</div><div class="cab-pagina"><div><h1>Galeria de fotos</h1><p>Fotos do diário organizadas por obra e data.</p></div>
    <div class="botoes"><select class="inp" id="g-o" style="min-width:240px"><option value="">Todas as obras</option>${obras.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join("")}</select></div></div><div id="g-c"></div>`;
  const carregar = async () => {
    const o = el.querySelector("#g-o").value;
    let dq = sb.from("diarios").select("id,data,obra_id,obras(nome)").order("data", { ascending: false }).limit(200); if (o) dq = dq.eq("obra_id", o);
    const ds = await q(dq); const ids = ds.map((d) => d.id);
    const fotos = ids.length ? await q(sb.from("anexos").select("*").eq("entidade", "diario").in("entidade_id", ids).like("tipo_mime", "image/%").order("criado_em", { ascending: false })) : [];
    if (!fotos.length) { el.querySelector("#g-c").innerHTML = '<div class="card"><div class="vazio">Nenhuma foto encontrada.</div></div>'; return; }
    const grupos = ds.filter((d) => fotos.some((f) => f.entidade_id === d.id));
    el.querySelector("#g-c").innerHTML = grupos.map((d) => `<div class="card" style="margin-bottom:14px"><div class="ct"><h3>${data(d.data)} · ${esc(d.obras?.nome)}</h3><a class="bt sec peq" href="#diario/${d.id}">Abrir diário</a></div><div class="cc"><div class="galeria">
      ${fotos.filter((f) => f.entidade_id === d.id).map((f) => `<a href="#" data-c="${esc(f.caminho)}"><img data-img="${esc(f.caminho)}" alt=""><small>${dataHora(f.criado_em)}</small></a>`).join("")}</div></div></div>`).join("");
    el.querySelectorAll("[data-img]").forEach(async (i) => { try { i.src = await linkArquivo(i.dataset.img); } catch { /* */ } });
    el.querySelectorAll("[data-c]").forEach((a) => a.onclick = async (e) => { e.preventDefault(); window.open(await linkArquivo(a.dataset.c, 600), "_blank"); });
  };
  el.querySelector("#g-o").onchange = carregar; carregar();
}
