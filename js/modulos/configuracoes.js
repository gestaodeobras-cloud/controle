import { sb, S, esc, ic, moeda, data, dataHora, tag, pode, ehAdmin, temRecurso, toast, msgErro, q, tabela, formulario, confirmar, modal, ir, cnpjValido, docFmt } from "../core.js";
import { PERFIL_NOME, recarregarSessao } from "../app.js";
import { excelVariasAbas } from "../exportar.js";

const MODS = [["dashboard", "Dashboard"], ["obras", "Obras"], ["compras", "Ordens de compra"], ["notas", "Notas fiscais"], ["estoque", "Estoque"], ["epi", "EPI"], ["diario", "Diário de obra"], ["financeiro", "Financeiro"], ["relatorios", "Relatórios"], ["fornecedores", "Fornecedores"], ["equipe", "Equipe"]];
const ACOES = [["ver", "Ver"], ["cadastrar", "Cadastrar"], ["editar", "Editar"], ["excluir", "Excluir"], ["aprovar", "Aprovar"], ["exportar", "Exportar"]];

async function chamar(fn, body) {
  const { data: r, error } = await sb.functions.invoke(fn, { body });
  if (error) { let m = error.message; try { m = (await error.context.json()).erro || m; } catch { /* */ } throw new Error(m); }
  if (r?.erro) throw new Error(r.erro);
  return r;
}

export async function render(el, [aba]) {
  const adm = ehAdmin();
  const abas = [...(adm ? [["empresa", "Empresa"], ["usuarios", "Usuários e permissões"], ["plano", "Plano e assinatura"], ["atividades", "Registro de atividades"], ["backup", "Backup e exportação"]] : []), ["conta", "Minha conta"]];
  aba = abas.some((a) => a[0] === aba) ? aba : abas[0][0];
  el.innerHTML = `<div class="cab-pagina"><div><h1>Configurações</h1><p>${adm ? "Empresa, usuários, permissões e assinatura." : "Seus dados de acesso."}</p></div></div>
    <div class="abas">${abas.map(([k, l]) => `<button data-aba="${k}" class="${k === aba ? "on" : ""}">${l}</button>`).join("")}</div><div id="c-aba"></div>`;
  el.querySelectorAll("[data-aba]").forEach((b) => b.onclick = () => ir("configuracoes/" + b.dataset.aba));
  await ABAS[aba](el.querySelector("#c-aba"), () => render(el, [aba]));
}

const ABAS = {
  async empresa(c, rec) {
    const e = await q(sb.from("empresas").select("*").eq("id", S.sessao.empresa.id).single());
    const campos = [{ k: "nome", l: "Nome da empresa", req: true, s2: true }, { k: "cnpj", l: "CNPJ", valida: (v) => (cnpjValido(v) ? null : "CNPJ inválido") }, { k: "telefone", l: "Telefone", t: "tel" },
      { k: "email", l: "E-mail", t: "email" }, { k: "endereco", l: "Endereço", s2: true }];
    c.innerHTML = `<div class="card"><div class="ct"><h3>Dados da empresa</h3><button class="bt peq" id="e-ed">${ic("editar")}Editar</button></div><div class="cc"><div class="info-lista">
      ${[["Nome", e.nome], ["CNPJ", docFmt(e.cnpj)], ["Telefone", e.telefone], ["E-mail", e.email], ["Endereço", e.endereco], ["Cliente desde", data(e.criado_em)]].map(([k, v]) => `<div><small>${k}</small><span>${esc(v || "-")}</span></div>`).join("")}</div></div></div>`;
    c.querySelector("#e-ed").onclick = () => formulario({ titulo: "Dados da empresa", campos, valores: e, salvar: async (v) => {
      await q(sb.from("empresas").update({ ...v, cnpj: v.cnpj ? v.cnpj.replace(/\D/g, "") : null }).eq("id", e.id)); toast("Dados salvos.", "ok"); recarregarSessao(); } });
  },
  async usuarios(c, rec) {
    const us = await q(sb.from("membros").select("*").order("nome"));
    const lim = S.sessao.limites, avanc = temRecurso("permissoes_avancadas");
    c.innerHTML = `<div class="card"><div class="ct"><div><h3>Usuários da empresa</h3><span class="mu peq">${lim.usuarios_ativos} ativo(s)${lim.usuarios ? ` de ${lim.usuarios} permitidos no plano` : ""}</span></div><button class="bt peq" id="u-novo">${ic("mais")}Novo usuário</button></div>
      ${tabela([{ l: "Nome", pri: true, f: (r) => `<b>${esc(r.nome)}</b><div class="mu peq">${esc(r.email)}</div>` }, { l: "Perfil", f: (r) => tag(PERFIL_NOME[r.perfil], r.perfil === "administrador" ? "roxo" : "azul") + (r.permissoes ? ' <span class="tag lar">personalizado</span>' : "") },
        { l: "Situação", f: (r) => tag(r.ativo ? "Ativo" : "Bloqueado", r.ativo ? "verde" : "verm") }, { l: "Último acesso", f: (r) => dataHora(r.ultimo_acesso) || "nunca" },
        { l: "", f: (r) => r.user_id === S.sessao.membro.user_id ? '<span class="mu peq">você</span>' : `<button class="bt sec peq" data-ed="${r.user_id}">${ic("editar")}Editar</button><button class="bt sec peq" data-pw="${r.user_id}">${ic("cadeado")}Senha</button><button class="bt ${r.ativo ? "verm" : "verde"} peq" data-at="${r.user_id}">${r.ativo ? "Bloquear" : "Desbloquear"}</button>` }], us)}</div>
      <div class="card" style="margin-top:16px"><div class="ct"><h3>O que cada perfil pode fazer</h3></div><div class="cc peq mu">
        <b>Administrador</b>: tudo, inclusive usuários, empresa e assinatura. <b>Gerente de obras</b>: obras, compras (aprova), estoque, EPI, diário (aprova), equipe; vê o financeiro.
        <b>Engenheiro</b>: obras, compras, diário (aprova). <b>Comprador</b>: compras, notas, fornecedores. <b>Financeiro</b>: financeiro completo e notas.
        <b>Almoxarife</b>: estoque e EPI. <b>Técnico de segurança</b>: EPI (completo) e diário. <b>Visualizador</b>: somente consulta.
        ${avanc ? "<br><br>Seu plano permite <b>permissões individuais</b>: ao editar um usuário, marque exatamente o que ele pode fazer em cada módulo." : "<br><br>Permissões individuais por usuário estão disponíveis no plano Empresarial."}</div></div>`;
    c.querySelector("#u-novo").onclick = () => editarUsuario(null, rec);
    c.querySelectorAll("[data-ed]").forEach((b) => b.onclick = () => editarUsuario(us.find((u) => u.user_id === b.dataset.ed), rec));
    c.querySelectorAll("[data-pw]").forEach((b) => b.onclick = () => formulario({ titulo: "Redefinir senha", campos: [{ k: "s", l: "Nova senha (mín. 8 caracteres)", t: "password", req: true, s2: true, valida: (v) => (v.length < 8 ? "Mínimo 8 caracteres" : null) }],
      salvar: async (v) => { await chamar("usuarios", { acao: "senha", user_id: b.dataset.pw, senha: v.s }); toast("Senha redefinida. Informe a nova senha ao usuário.", "ok"); } }));
    c.querySelectorAll("[data-at]").forEach((b) => b.onclick = async () => {
      const u = us.find((x) => x.user_id === b.dataset.at);
      if (!(await confirmar(u.ativo ? `Bloquear o acesso de ${u.nome}? Ele não conseguirá mais entrar.` : `Desbloquear ${u.nome}?`, { perigo: u.ativo }))) return;
      try { await chamar("usuarios", { acao: "ativo", user_id: u.user_id, ativo: !u.ativo }); toast("Situação atualizada.", "ok"); await recarregarSessao(); } catch (e) { toast(msgErro(e), "erro"); }
    });
  },
  async plano(c, rec) {
    const [planos, ass, cob] = await Promise.all([q(sb.from("planos").select("*").eq("ativo", true).order("ordem")), q(sb.from("assinaturas").select("*").maybeSingle()), q(sb.from("cobrancas").select("*").order("data", { ascending: false }).limit(50))]);
    const e = S.sessao.empresa, p = S.sessao.plano, l = S.sessao.limites;
    const ST = { teste: ["Período de teste", "lar"], ativa: ["Ativa", "verde"], inadimplente: ["Pagamento pendente", "verm"], bloqueada: ["Bloqueada", "verm"], cancelada: ["Cancelada", "cinza"] };
    const NOMES_MOD = Object.fromEntries(MODS);
    c.innerHTML = `<div class="grade g3" style="margin-bottom:16px">
      <div class="card kpi"><div class="ic t-azul">${ic("plataforma")}</div><div><small>Plano atual</small><b>${esc(p.nome)}</b><div class="sub">${tag(...(ST[e.status] || [e.status, "cinza"]))}${e.status === "teste" ? ` até ${data(e.teste_ate)}` : ""}</div></div></div>
      <div class="card kpi"><div class="ic t-verde">${ic("obras")}</div><div><small>Obras ativas</small><b>${l.obras_ativas}${l.obras ? " / " + l.obras : ""}</b><div class="sub">${l.obras ? "limite do plano" : "conforme contrato"}</div></div></div>
      <div class="card kpi"><div class="ic t-roxo">${ic("equipe")}</div><div><small>Usuários ativos</small><b>${l.usuarios_ativos}${l.usuarios ? " / " + l.usuarios : ""}</b></div></div></div>
      ${ass?.status === "pendente" ? `<div class="faixa aviso">${ic("relogio")}<span>Há uma contratação aguardando confirmação do Mercado Pago. O plano é liberado automaticamente assim que o pagamento for aprovado.</span><button class="bt sec peq" id="p-sync">Verificar agora</button></div>` : ""}
      <div class="grade g3">${planos.map((x) => `<div class="card plano-card ${x.id === p.id ? "atual" : ""}"><div style="display:flex;justify-content:space-between;align-items:center"><h3>${esc(x.nome)}</h3>${x.id === p.id ? tag("Seu plano", "azul") : ""}</div>
        <div class="preco">${moeda(x.preco_mensal)}<span class="mu peq" style="font-weight:500">/mês</span></div><p class="mu" style="margin:0">${esc(x.descricao || "")}</p>
        <ul><li>${x.max_obras ? `Até ${x.max_obras} obras ativas` : "Obras conforme contrato"}</li><li>${x.max_usuarios ? `Até ${x.max_usuarios} usuários` : "Usuários conforme contrato"}</li>
          <li>${x.modulos.map((m) => NOMES_MOD[m]).filter(Boolean).join(", ")}</li>${x.recursos.includes("relatorios_avancados") ? "<li>Relatórios avançados</li>" : ""}${x.recursos.includes("permissoes_avancadas") ? "<li>Permissões individuais por usuário</li>" : ""}</ul>
        <div style="margin-top:auto">${x.id === p.id && e.status === "ativa" ? '<button class="bt sec bloco" disabled>Plano ativo</button>' : `<button class="bt bloco" data-assinar="${x.id}">${x.id === p.id ? "Pagar assinatura" : "Contratar este plano"}</button>`}</div></div>`).join("")}</div>
      <div class="card" style="margin-top:16px"><div class="ct"><h3>Histórico de cobranças</h3>${ass?.mp_preapproval_id && ["ativa", "pendente", "pausada"].includes(ass.status) ? '<button class="bt sec peq" id="p-cancel">Cancelar assinatura</button>' : ""}</div>
        ${tabela([{ l: "Data", f: (r) => dataHora(r.data) }, { l: "Valor", num: true, f: (r) => moeda(r.valor) }, { l: "Situação", pri: true, f: (r) => tag(r.status === "approved" ? "Aprovado" : r.status === "rejected" ? "Recusado" : r.status, r.status === "approved" ? "verde" : r.status === "rejected" ? "verm" : "lar") }, { l: "Detalhe", k: "status_detalhe" }], cob, { vazio: "Nenhuma cobrança registrada ainda." })}
        ${ass?.proximo_vencimento ? `<div class="cc mu peq">Próxima cobrança: ${data(ass.proximo_vencimento)}</div>` : ""}</div>
      <p class="mu peq">Pagamentos processados com segurança pelo Mercado Pago. O plano só é liberado após a confirmação do pagamento pelo Mercado Pago.</p>`;
    c.querySelectorAll("[data-assinar]").forEach((b) => b.onclick = () => formulario({ titulo: "Contratar plano", textoOk: "Ir para o pagamento",
      campos: [{ k: "email", l: "E-mail da sua conta no Mercado Pago (pagador)", t: "email", req: true, s2: true, padrao: S.user.email, ajuda: "Você será levado ao site do Mercado Pago para concluir a assinatura mensal." }],
      salvar: async (v) => { const r = await chamar("mp-assinatura", { acao: "assinar", plano_id: b.dataset.assinar, email_pagador: v.email }); location.href = r.link_pagamento; } }));
    c.querySelector("#p-sync")?.addEventListener("click", async () => { try { await chamar("mp-assinatura", { acao: "sincronizar" }); await recarregarSessao(); } catch (er) { toast(msgErro(er), "erro"); } });
    c.querySelector("#p-cancel")?.addEventListener("click", async () => {
      if (!(await confirmar("Cancelar a assinatura? O acesso continua até o fim do período já pago.", { perigo: true, ok: "Cancelar assinatura" }))) return;
      try { await chamar("mp-assinatura", { acao: "cancelar" }); toast("Pedido de cancelamento enviado ao Mercado Pago."); rec(); } catch (er) { toast(msgErro(er), "erro"); }
    });
  },
  async atividades(c) {
    const { listaRecurso } = await import("../crud.js");
    const T = { obras: "Obras", ordens_compra: "Ordens de compra", notas_fiscais: "Notas fiscais", lancamentos: "Financeiro", materiais: "Materiais", fornecedores: "Fornecedores", funcionarios: "Funcionários", epis: "EPIs", diarios: "Diário", membros: "Usuários", empresas: "Empresa", depositos: "Depósitos" };
    await listaRecurso(c, { titulo: "Registro de atividades", fonte: "auditoria", modulo: "_", semNovo: true, ordem: ["em", false], busca: ["usuario_nome", "tabela"],
      filtros: [{ k: "tabela", l: "Área", op: Object.entries(T) }, { k: "acao", l: "Ação", op: [["insert", "Criação"], ["update", "Alteração"], ["delete", "Exclusão"]] }],
      colunas: [{ l: "Data/hora", f: (r) => dataHora(r.em) }, { l: "Usuário", pri: true, k: "usuario_nome" }, { l: "Área", f: (r) => esc(T[r.tabela] || r.tabela) }, { l: "Ação", f: (r) => tag({ insert: "Criação", update: "Alteração", delete: "Exclusão" }[r.acao], { insert: "verde", update: "azul", delete: "verm" }[r.acao]) },
        { l: "Registro", f: (r) => esc((r.depois || r.antes)?.nome || (r.depois || r.antes)?.numero || (r.depois || r.antes)?.descricao || (r.depois || r.antes)?.razao_social || "#" + r.registro_id) }],
      aoClicar: (r) => modal({ titulo: "Detalhes da alteração", tamanho: "larga", corpo: `<pre style="white-space:pre-wrap;font-size:12px;background:var(--bg);padding:12px;border-radius:10px;max-height:60vh;overflow:auto">${esc(JSON.stringify(difObj(r.antes, r.depois), null, 2))}</pre>` }) });
  },
  async backup(c) {
    c.innerHTML = `<div class="card"><div class="ct"><h3>Exportar todos os dados da empresa</h3></div><div class="cc">
      <p>Gera uma planilha Excel com todas as informações da sua empresa (obras, compras, notas, financeiro, estoque, EPI, diário, fornecedores e equipe). Guarde em local seguro.</p>
      <p class="mu peq">O banco de dados da plataforma também possui cópias de segurança mantidas pelo provedor. Esta exportação é uma cópia extra, sob o seu controle (LGPD: portabilidade dos dados).</p>
      <button class="bt" id="bk">${ic("excel")}Gerar exportação completa</button></div></div>`;
    c.querySelector("#bk").onclick = async (ev) => {
      ev.target.disabled = true; ev.target.textContent = "Gerando...";
      try {
        const tabs = [["Obras", "obras"], ["Fornecedores", "fornecedores"], ["Funcionarios", "funcionarios"], ["Ordens de compra", "ordens_compra"], ["Itens das OCs", "oc_itens"], ["Notas fiscais", "notas_fiscais"], ["Financeiro", "lancamentos"], ["Materiais", "materiais"], ["Depositos", "depositos"], ["Saldos", "estoque_saldos"], ["Movimentacoes", "estoque_movimentos"], ["EPIs", "epis"], ["Entregas EPI", "epi_entregas"], ["Diario", "diarios"]];
        const abas = [];
        for (const [n, t] of tabs) { const { data: d } = await sb.from(t).select("*").limit(20000); abas.push({ nome: n, linhas: (d || []).map((r) => { const o = { ...r }; delete o.empresa_id; return o; }) }); }
        excelVariasAbas(`Backup ${S.sessao.empresa.nome}`, abas); toast("Exportação gerada.", "ok");
      } catch (e) { toast(msgErro(e), "erro"); } finally { ev.target.disabled = false; ev.target.innerHTML = `${ic("excel")}Gerar exportação completa`; }
    };
  },
  async conta(c) {
    const m = S.sessao.membro;
    c.innerHTML = `<div class="grade g2"><div class="card"><div class="ct"><h3>Meus dados</h3></div><div class="cc"><div class="info-lista">${[["Nome", m.nome], ["E-mail", m.email], ["Perfil", PERFIL_NOME[m.perfil]], ["Empresa", S.sessao.empresa.nome]].map(([k, v]) => `<div><small>${k}</small><span>${esc(v)}</span></div>`).join("")}</div></div></div>
      <div class="card"><div class="ct"><h3>Segurança</h3></div><div class="cc" style="display:grid;gap:10px;justify-items:start"><button class="bt" id="pw">${ic("cadeado")}Alterar minha senha</button><button class="bt sec" id="sair-todos">${ic("sair")}Sair de todos os dispositivos</button></div></div></div>`;
    c.querySelector("#pw").onclick = () => formulario({ titulo: "Alterar senha", campos: [{ k: "s1", l: "Nova senha (mín. 8, letras e números)", t: "password", req: true, s2: true }, { k: "s2", l: "Repita a nova senha", t: "password", req: true, s2: true }],
      salvar: async (v) => { if (v.s1.length < 8 || !/[A-Za-z]/.test(v.s1) || !/\d/.test(v.s1)) throw new Error("Use ao menos 8 caracteres com letras e números."); if (v.s1 !== v.s2) throw new Error("As senhas não conferem.");
        const { error } = await sb.auth.updateUser({ password: v.s1 }); if (error) throw error; toast("Senha alterada.", "ok"); } });
    c.querySelector("#sair-todos").onclick = async () => { if (await confirmar("Encerrar a sessão em todos os aparelhos?")) await sb.auth.signOut({ scope: "global" }); };
  },
};

function difObj(a, b) {
  if (!a || !b) return a || b;
  const o = {}; for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) o[k] = { antes: a[k], depois: b[k] };
  return o;
}

function editarUsuario(u, rec) {
  const avanc = temRecurso("permissoes_avancadas");
  const campos = [{ k: "nome", l: "Nome", req: true, s2: true }, ...(u ? [] : [{ k: "email", l: "E-mail (será o login)", t: "email", req: true }, { k: "senha", l: "Senha inicial (mín. 8)", t: "password", req: true, valida: (v) => (v.length < 8 ? "Mínimo 8 caracteres" : null) }]),
    { k: "perfil", l: "Perfil", t: "select", op: Object.entries(PERFIL_NOME), req: true, vazio: false, padrao: "visualizador", s2: !u }];
  if (avanc) campos.push({ k: "personalizar", l: "Personalizar permissões deste usuário (em vez do padrão do perfil)", t: "check", s2: true, padrao: !!u?.permissoes });
  const perm = u?.permissoes || {};
  const grade = avanc ? `<div id="perm-grade" class="${u?.permissoes ? "" : "oculto"}" style="margin-top:14px;overflow:auto"><table class="tab"><thead><tr><th>Módulo</th>${ACOES.map(([, l]) => `<th class="cen">${l}</th>`).join("")}</tr></thead><tbody>
    ${MODS.map(([m, l]) => `<tr><td>${l}</td>${ACOES.map(([a]) => `<td class="cen"><input type="checkbox" data-p="${m}:${a}" ${perm[m]?.includes(a) ? "checked" : ""}></td>`).join("")}</tr>`).join("")}</tbody></table></div>` : "";
  const m = formulario({ titulo: u ? `Editar ${u.nome}` : "Novo usuário", campos, valores: u || {}, tamanho: avanc ? "larga" : "", extra: grade,
    salvar: async (v) => {
      let permissoes = null;
      if (avanc && v.personalizar) { permissoes = {}; m.el.querySelectorAll("[data-p]").forEach((i) => { const [md, a] = i.dataset.p.split(":"); permissoes[md] ??= []; if (i.checked) permissoes[md].push(a); }); }
      await chamar("usuarios", u ? { acao: "editar", user_id: u.user_id, nome: v.nome, perfil: v.perfil, permissoes } : { acao: "criar", nome: v.nome, email: v.email, senha: v.senha, perfil: v.perfil, permissoes });
      toast(u ? "Usuário atualizado." : "Usuário criado. Informe o e-mail e a senha inicial à pessoa.", "ok"); await recarregarSessao();
    } });
  m.el.querySelector('[name="personalizar"]')?.addEventListener("change", (e) => m.el.querySelector("#perm-grade").classList.toggle("oculto", !e.target.checked));
}
