// Área administrativa da PLATAFORMA (separada das empresas clientes).
// Mostra apenas dados cadastrais e de uso — nunca dados financeiros ou documentos privados dos clientes.
import { sb, esc, ic, moeda, data, dataHora, tag, toast, msgErro, q, tabela, formulario, ir, docFmt } from "../core.js";

const ST = { teste: ["Teste", "lar"], ativa: ["Ativa", "verde"], inadimplente: ["Inadimplente", "verm"], bloqueada: ["Bloqueada", "verm"], cancelada: ["Cancelada", "cinza"] };
const MODS = ["obras", "compras", "notas", "estoque", "epi", "diario", "financeiro", "relatorios", "fornecedores", "equipe"];
const RECS = ["relatorios_basicos", "relatorios_avancados", "relatorios_gerenciais", "permissoes_avancadas", "admin_extra"];

export async function render(el, [aba = "indicadores"]) {
  const abas = [["indicadores", "Indicadores"], ["empresas", "Empresas"], ["planos", "Planos e preços"], ["cobrancas", "Cobranças"], ["config", "Regras"]];
  el.innerHTML = `<div class="cab-pagina"><div><h1>Administração da plataforma</h1><p>Gestão do SaaS: empresas clientes, planos, assinaturas e uso.</p></div></div>
    <div class="abas">${abas.map(([k, l]) => `<button data-aba="${k}" class="${k === aba ? "on" : ""}">${l}</button>`).join("")}</div><div id="pl"></div>`;
  el.querySelectorAll("[data-aba]").forEach((b) => b.onclick = () => ir("plataforma/" + b.dataset.aba));
  try { await ABAS[aba](el.querySelector("#pl"), () => render(el, [aba])); } catch (e) { el.querySelector("#pl").innerHTML = `<div class="card"><div class="vazio verm">${esc(msgErro(e))}</div></div>`; }
}

const ABAS = {
  async indicadores(c) {
    const i = await q(sb.rpc("plat_indicadores"));
    const k = (ic_, cor, t, v) => `<div class="card kpi"><div class="ic t-${cor}">${ic(ic_)}</div><div><small>${t}</small><b>${v}</b></div></div>`;
    c.innerHTML = `<div class="grade g4">${k("obras", "azul", "Empresas cadastradas", i.empresas)}${k("ok", "verde", "Assinaturas ativas", i.ativas)}${k("relogio", "lar", "Em período de teste", i.teste)}${k("alerta", "verm", "Inadimplentes / bloqueadas", `${i.inadimplentes} / ${i.bloqueadas}`)}
      ${k("dinheiro", "verde", "Receita mensal recorrente", moeda(i.receita_mensal))}${k("equipe", "roxo", "Usuários ativos", i.usuarios)}${k("obras", "azul", "Obras cadastradas", i.obras)}${k("usuario", "azul", "Usuários com acesso (7 dias)", i.acessos_7d)}</div>
      <div class="card" style="margin-top:16px"><div class="ct"><h3>Empresas por plano</h3></div><div class="cc">${Object.entries(i.por_plano || {}).map(([p, n]) => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--bd)"><span>${esc(p)}</span><b>${n}</b></div>`).join("") || "Nenhuma empresa ainda."}</div></div>`;
  },
  async empresas(c, rec) {
    const [l, planos] = await Promise.all([q(sb.rpc("plat_empresas")), q(sb.from("planos").select("id,nome").order("ordem"))]);
    c.innerHTML = `<div class="card">${tabela([
      { l: "Empresa", pri: true, f: (r) => `<b>${esc(r.nome)}</b><div class="mu peq">${esc(docFmt(r.cnpj) || "")} ${esc(r.email || "")}</div>` }, { l: "Plano", f: (r) => esc(r.plano_id) },
      { l: "Situação", f: (r) => tag(...(ST[r.status_efetivo] || [r.status_efetivo, "cinza"])) + (r.bloqueio_manual ? ' <span class="tag verm">bloqueio manual</span>' : "") },
      { l: "Teste até", f: (r) => data(r.teste_ate) || "-" }, { l: "Usuários", num: true, k: "usuarios" }, { l: "Obras", num: true, k: "obras" },
      { l: "Assinatura", f: (r) => esc(r.assinatura_status || "-") + (r.proximo_vencimento ? `<div class="mu peq">próx.: ${data(r.proximo_vencimento)}</div>` : "") },
      { l: "Último acesso", f: (r) => dataHora(r.ultimo_acesso) || "-" }, { l: "Cliente desde", f: (r) => data(r.criado_em) }], l, { clique: true, vazio: "Nenhuma empresa cadastrada." })}</div>`;
    c.querySelectorAll("tr.clic").forEach((tr, i) => tr.onclick = () => {
      const e = l[i];
      formulario({ titulo: `Gerenciar: ${e.nome}`, valores: { ...e, bloqueio: e.bloqueio_manual }, campos: [
        { k: "plano_id", l: "Plano", t: "select", op: planos.map((p) => [p.id, p.nome]), req: true, vazio: false },
        { k: "teste_ate", l: "Período de teste até", t: "date" },
        { k: "limite_obras", l: "Limite de obras (contrato)", t: "num", min: 0, ajuda: "Vazio = usa o limite do plano" }, { k: "limite_usuarios", l: "Limite de usuários (contrato)", t: "num", min: 0 },
        { k: "bloqueio", l: "Bloquear acesso desta empresa", t: "check", s2: true }, { k: "motivo_bloqueio", l: "Motivo exibido ao cliente", s2: true, ph: "Ex.: pagamento em atraso" }],
        salvar: async (v) => { await q(sb.rpc("plat_atualizar_empresa", { p_id: e.id, p_plano: v.plano_id, p_bloqueio: v.bloqueio, p_motivo: v.motivo_bloqueio, p_limite_obras: v.limite_obras, p_limite_usuarios: v.limite_usuarios, p_teste_ate: v.teste_ate })); toast("Empresa atualizada.", "ok"); rec(); } });
    });
  },
  async planos(c, rec) {
    const l = await q(sb.from("planos").select("*").order("ordem"));
    c.innerHTML = `<div class="card">${tabela([{ l: "Plano", pri: true, f: (r) => `<b>${esc(r.nome)}</b> <span class="mu peq">${esc(r.id)}</span>` }, { l: "Preço mensal", num: true, f: (r) => moeda(r.preco_mensal) },
      { l: "Obras", num: true, f: (r) => r.max_obras ?? "contrato" }, { l: "Usuários", num: true, f: (r) => r.max_usuarios ?? "contrato" }, { l: "Módulos", f: (r) => `<span class="peq">${esc(r.modulos.join(", "))}</span>` }, { l: "Ativo", f: (r) => tag(r.ativo ? "Sim" : "Não", r.ativo ? "verde" : "cinza") }], l, { clique: true })}</div>
      <p class="mu peq">Clique em um plano para alterar preço, limites e módulos. Os limites são aplicados automaticamente pelo banco de dados.</p>`;
    c.querySelectorAll("tr.clic").forEach((tr, i) => tr.onclick = () => {
      const p = l[i];
      const campos = [{ k: "nome", l: "Nome", req: true }, { k: "preco_mensal", l: "Preço mensal (R$)", t: "money", req: true, min: 0 }, { k: "descricao", l: "Descrição", s2: true },
        { k: "max_obras", l: "Máx. obras ativas (vazio = contrato)", t: "num", min: 0 }, { k: "max_usuarios", l: "Máx. usuários (vazio = contrato)", t: "num", min: 0 },
        { t: "secao", l: "Módulos incluídos" }, ...MODS.map((m) => ({ k: "m_" + m, l: m, t: "check" })), { t: "secao", l: "Recursos" }, ...RECS.map((r) => ({ k: "r_" + r, l: r.replace(/_/g, " "), t: "check" })), { k: "ativo", l: "Plano disponível para contratação", t: "check", s2: true }];
      const val = { ...p, ...Object.fromEntries(MODS.map((m) => ["m_" + m, p.modulos.includes(m)])), ...Object.fromEntries(RECS.map((r) => ["r_" + r, p.recursos.includes(r)])) };
      formulario({ titulo: `Plano ${p.nome}`, campos, valores: val, tamanho: "larga", salvar: async (v) => {
        await q(sb.from("planos").update({ nome: v.nome, preco_mensal: v.preco_mensal, descricao: v.descricao, max_obras: v.max_obras, max_usuarios: v.max_usuarios, ativo: v.ativo,
          modulos: MODS.filter((m) => v["m_" + m]), recursos: RECS.filter((r) => v["r_" + r]) }).eq("id", p.id));
        toast("Plano atualizado.", "ok"); rec(); } });
    });
  },
  async cobrancas(c) {
    const l = await q(sb.rpc("plat_cobrancas"));
    c.innerHTML = `<div class="card">${tabela([{ l: "Data", f: (r) => dataHora(r.data) }, { l: "Empresa", pri: true, k: "empresa" }, { l: "Valor", num: true, f: (r) => moeda(r.valor) }, { l: "Situação", f: (r) => tag(r.status, r.status === "approved" ? "verde" : r.status === "rejected" ? "verm" : "lar") }, { l: "Detalhe", k: "status_detalhe" }], l, { vazio: "Nenhuma cobrança recebida ainda (depende da integração com o Mercado Pago)." })}</div>`;
  },
  async config(c, rec) {
    const l = await q(sb.from("plataforma_config").select("*"));
    const g = (k) => l.find((x) => x.chave === k)?.valor;
    c.innerHTML = `<div class="card"><div class="ct"><h3>Regras comerciais</h3><button class="bt peq" id="cf">${ic("editar")}Editar</button></div><div class="cc"><div class="info-lista">
      <div><small>Dias de teste grátis</small><span>${g("dias_teste")}</span></div><div><small>Tolerância antes de bloquear por inadimplência</small><span>${g("dias_tolerancia_inadimplencia")} dia(s)</span></div>
      <div><small>Administradores da plataforma (e-mails)</small><span>${esc((g("emails_admin_plataforma") || []).join(", "))}</span></div></div></div></div>`;
    c.querySelector("#cf").onclick = () => formulario({ titulo: "Regras comerciais", valores: { t: g("dias_teste"), d: g("dias_tolerancia_inadimplencia") },
      campos: [{ k: "t", l: "Dias de teste grátis para novas empresas", t: "num", req: true, min: 0 }, { k: "d", l: "Dias de tolerância após vencimento sem pagamento", t: "num", req: true, min: 0 }],
      salvar: async (v) => { await q(sb.from("plataforma_config").upsert([{ chave: "dias_teste", valor: Math.floor(v.t) }, { chave: "dias_tolerancia_inadimplencia", valor: Math.floor(v.d) }])); toast("Regras salvas.", "ok"); rec(); } });
  },
};
