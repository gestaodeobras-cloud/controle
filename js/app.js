// =====================================================================
//  APLICAÇÃO: login, cadastro, estrutura (menu/topo), rotas e notificações
// =====================================================================
import { sb, S, CFG, $, $$, esc, ic, toast, msgErro, pode, iniciais, data as fdata, debounce, limparCache, modal, ir } from "./core.js";

const raiz = $("#raiz");
const MENU = [
  { r: "dashboard", l: "Dashboard", i: "dashboard", m: "dashboard" },
  { r: "obras", l: "Obras", i: "obras", m: "obras" },
  { r: "compras", l: "Ordens de Compra", i: "compras", m: "compras" },
  { r: "notas", l: "Notas Fiscais", i: "notas", m: "notas" },
  { r: "estoque", l: "Estoque", i: "estoque", m: "estoque" },
  { r: "epi", l: "EPI", i: "epi", m: "epi" },
  { r: "diario", l: "Diário de Obra", i: "diario", m: "diario" },
  { r: "financeiro", l: "Financeiro", i: "financeiro", m: "financeiro" },
  { r: "relatorios", l: "Relatórios", i: "relatorios", m: "relatorios" },
  { r: "fornecedores", l: "Fornecedores", i: "fornecedores", m: "fornecedores" },
  { r: "equipe", l: "Equipe", i: "equipe", m: "equipe" },
  { r: "configuracoes", l: "Configurações", i: "configuracoes", m: null },
];
const PERFIL_NOME = { administrador: "Administrador", gerente: "Gerente de obras", engenheiro: "Engenheiro", comprador: "Comprador", financeiro: "Financeiro", almoxarife: "Almoxarife", tecnico_seguranca: "Técnico de segurança", visualizador: "Visualizador" };
export { PERFIL_NOME };

// ---------------- inicialização ----------------
async function iniciar() {
  if (!sb) { raiz.innerHTML = `<div class="carregando-tela"><p>Não foi possível carregar o sistema. Verifique a internet e recarregue a página.</p></div>`; return; }
  if (!CFG.SUPABASE_URL || /COLE_AQUI|SEU_PROJETO/.test(CFG.SUPABASE_URL + CFG.SUPABASE_ANON_KEY)) { raiz.innerHTML = `<div class="carregando-tela"><p>Configure o arquivo <b>config.js</b> com os dados do seu projeto Supabase.</p></div>`; return; }
  document.title = CFG.NOME_APP || "Gestão de Obras";
  sb.auth.onAuthStateChange((ev) => {
    if (ev === "PASSWORD_RECOVERY") telaNovaSenha();
    if (ev === "SIGNED_OUT") { S.sessao = null; telaLogin(); }
  });
  if (/type=recovery/.test(location.hash)) return; // tratado pelo evento acima
  const { data } = await sb.auth.getSession();
  if (data.session) await entrar(); else telaLogin();
}

async function entrar() {
  try {
    const { data: u } = await sb.auth.getUser();
    S.user = u.user;
    const { data: s, error } = await sb.rpc("minha_sessao");
    if (error) throw error;
    S.sessao = s;
    if (!s.membro && !s.admin_plataforma) { await sb.auth.signOut(); return telaLogin("Seu usuário não está vinculado a nenhuma empresa."); }
    if (s.membro && !s.membro.ativo && !s.admin_plataforma) { await sb.auth.signOut(); return telaLogin("Seu acesso está bloqueado. Fale com o administrador da sua empresa."); }
    sb.rpc("registrar_acesso");
    limparCache();
    montarEstrutura();
    vigiarInatividade();
    if (!window.__rotas) { window.addEventListener("hashchange", rotear); window.__rotas = true; }
    if (!location.hash || location.hash.length < 2) location.hash = s.membro ? "dashboard" : "plataforma";
    rotear();
  } catch (e) { telaLogin(msgErro(e)); }
}

export async function recarregarSessao() {
  const { data } = await sb.rpc("minha_sessao");
  if (data) S.sessao = data;
  montarEstrutura(); rotear();
}

// ---------------- telas de acesso ----------------
function ladoMarketing() {
  return `<div class="lado"><div style="display:flex;align-items:center;gap:10px"><div style="width:40px;height:40px;border-radius:11px;background:linear-gradient(150deg,#1e63e9,#3b82f6);display:grid;place-items:center">${ic("obras")}</div><b style="font-size:17px">${esc(CFG.NOME_APP || "Gestão de Obras")}</b></div>
  <div><h2>Controle completo das suas obras, do pedido de compra ao fluxo de caixa.</h2>
  <ul>${["Obras, compras, notas fiscais e estoque integrados", "Diário de obra com fotos pelo celular", "Controle de EPI com validade de CA", "Financeiro, relatórios em PDF e Excel", "Acesso por perfil e por empresa, com segurança"].map((t) => `<li>${ic("ok")}${t}</li>`).join("")}</ul></div>
  <small style="color:#8ea3c4">© ${new Date().getFullYear()} · Plataforma para construtoras</small></div>`;
}

function telaLogin(msg = "") {
  raiz.innerHTML = `<div class="login">${ladoMarketing()}<div class="form"><div class="caixa">
    <h1>Entrar</h1><p class="mu">Acesse com o e-mail e a senha cadastrados.</p>
    <form id="fl" novalidate>
      <div class="campo"><label>E-mail</label><input type="email" name="email" autocomplete="username" required></div>
      <div class="campo"><label>Senha</label><input type="password" name="senha" autocomplete="current-password" required></div>
      <div class="form-erro ${msg ? "" : "oculto"}">${esc(msg)}</div>
      <button class="bt bloco" style="margin-top:16px;height:46px">Entrar</button>
    </form>
    <p style="display:flex;justify-content:space-between;margin-top:14px;flex-wrap:wrap;gap:8px"><button class="lnk" id="esq">Esqueci minha senha</button><button class="lnk" id="cad">Cadastrar minha empresa</button></p>
  </div></div></div>`;
  const f = $("#fl"), err = f.querySelector(".form-erro");
  f.onsubmit = async (e) => {
    e.preventDefault();
    const email = f.email.value.trim().toLowerCase(), senha = f.senha.value;
    if (!email || !senha) { err.textContent = "Informe e-mail e senha."; err.classList.remove("oculto"); return; }
    const b = f.querySelector("button"); b.disabled = true; b.textContent = "Entrando...";
    const { error } = await sb.auth.signInWithPassword({ email, password: senha });
    b.disabled = false; b.textContent = "Entrar";
    if (error) { err.textContent = /banned/i.test(error.message) ? "Seu acesso está bloqueado. Fale com o administrador." : msgErro(error); err.classList.remove("oculto"); return; }
    entrar();
  };
  $("#esq").onclick = telaEsqueci;
  $("#cad").onclick = telaCadastro;
}

function telaEsqueci() {
  raiz.innerHTML = `<div class="login">${ladoMarketing()}<div class="form"><div class="caixa">
    <h1>Recuperar senha</h1><p class="mu">Enviaremos um link para você criar uma nova senha.</p>
    <form id="fe" novalidate><div class="campo"><label>E-mail</label><input type="email" name="email" required></div>
    <div class="form-erro oculto"></div><button class="bt bloco" style="margin-top:16px;height:46px">Enviar link</button></form>
    <p><button class="lnk" id="volta">← Voltar para o login</button></p></div></div></div>`;
  $("#volta").onclick = () => telaLogin();
  $("#fe").onsubmit = async (e) => {
    e.preventDefault();
    const email = e.target.email.value.trim();
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    const box = e.target.querySelector(".form-erro");
    if (error) { box.textContent = msgErro(error); box.classList.remove("oculto"); return; }
    raiz.querySelector(".caixa").innerHTML = `<h1>Verifique seu e-mail</h1><p class="mu">Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha. Confira também a caixa de spam.</p><button class="bt" id="volta2">Voltar ao login</button>`;
    $("#volta2").onclick = () => telaLogin();
  };
}

function telaNovaSenha() {
  raiz.innerHTML = `<div class="login">${ladoMarketing()}<div class="form"><div class="caixa">
    <h1>Criar nova senha</h1><form id="fn" novalidate>
    <div class="campo"><label>Nova senha</label><input type="password" name="s1" autocomplete="new-password"></div>
    <div class="campo"><label>Repita a nova senha</label><input type="password" name="s2" autocomplete="new-password"></div>
    <div class="form-erro oculto"></div><button class="bt bloco" style="margin-top:16px;height:46px">Salvar nova senha</button></form></div></div></div>`;
  $("#fn").onsubmit = async (e) => {
    e.preventDefault();
    const s1 = e.target.s1.value, s2 = e.target.s2.value, box = e.target.querySelector(".form-erro");
    const falha = (m) => { box.textContent = m; box.classList.remove("oculto"); };
    if (s1.length < 8 || !/[A-Za-z]/.test(s1) || !/\d/.test(s1)) return falha("Use ao menos 8 caracteres, com letras e números.");
    if (s1 !== s2) return falha("As senhas não conferem.");
    const { error } = await sb.auth.updateUser({ password: s1 });
    if (error) return falha(msgErro(error));
    toast("Senha alterada com sucesso.", "ok"); history.replaceState(null, "", location.pathname); entrar();
  };
}

async function telaCadastro() {
  const { data: planos } = await sb.from("planos").select("*").eq("ativo", true).order("ordem");
  raiz.innerHTML = `<div class="login">${ladoMarketing()}<div class="form"><div class="caixa" style="max-width:460px">
    <h1>Cadastrar empresa</h1><p class="mu">Teste grátis. Você será o administrador da sua empresa.</p>
    <form id="fc" novalidate>
      <div class="campo"><label>Nome da empresa *</label><input name="empresa"></div>
      <div class="campo"><label>CNPJ</label><input name="cnpj" inputmode="numeric" placeholder="Opcional"></div>
      <div class="campo"><label>Seu nome *</label><input name="nome" autocomplete="name"></div>
      <div class="campo"><label>Seu e-mail *</label><input name="email" type="email" autocomplete="email"></div>
      <div class="campo"><label>Senha * <span class="mu2">(mín. 8, letras e números)</span></label><input name="senha" type="password" autocomplete="new-password"></div>
      <div class="campo"><label>Plano desejado</label><div class="planos-escolha">${(planos || []).map((p, i) => `<label><input type="radio" name="plano" value="${p.id}" ${i === 0 ? "checked" : ""}><span><b>${esc(p.nome)} · ${Number(p.preco_mensal).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/mês</b><small class="mu">${esc(p.descricao || "")}${p.max_obras ? ` · até ${p.max_obras} obras e ${p.max_usuarios} usuários` : ""}</small></span></label>`).join("")}</div></div>
      <label class="campo check" style="margin-top:12px"><input type="checkbox" name="aceite"><span class="peq">Concordo com o tratamento dos meus dados para uso da plataforma (LGPD).</span></label>
      <div class="form-erro oculto"></div><button class="bt bloco" style="margin-top:16px;height:46px">Criar conta</button>
    </form><p><button class="lnk" id="volta">← Já tenho conta</button></p></div></div></div>`;
  $("#volta").onclick = () => telaLogin();
  $("#fc").onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target, box = f.querySelector(".form-erro"), b = f.querySelector("button");
    const falha = (m) => { box.textContent = m; box.classList.remove("oculto"); };
    if (!f.aceite.checked) return falha("É preciso concordar com o tratamento dos dados.");
    const corpo = { empresa: f.empresa.value, cnpj: f.cnpj.value, nome: f.nome.value, email: f.email.value, senha: f.senha.value, plano: f.plano.value };
    b.disabled = true; b.textContent = "Criando...";
    const { data: r, error } = await sb.functions.invoke("cadastro-empresa", { body: corpo });
    b.disabled = false; b.textContent = "Criar conta";
    if (error) { let m = error.message; try { m = (await error.context.json()).erro || m; } catch { /* */ } return falha(m); }
    if (!r?.ok) return falha(r?.erro || "Não foi possível criar a conta.");
    const { error: e2 } = await sb.auth.signInWithPassword({ email: corpo.email.trim().toLowerCase(), password: corpo.senha });
    if (e2) return telaLogin("Conta criada! Entre com seu e-mail e senha.");
    toast("Bem-vindo! Sua empresa foi criada.", "ok"); entrar();
  };
}

// ---------------- estrutura ----------------
function montarEstrutura() {
  const s = S.sessao, emp = s.empresa;
  const itens = s.membro ? MENU.filter((m) => !m.m || pode(m.m, "ver")) : [];
  const bloqueada = emp && ["bloqueada", "cancelada"].includes(emp.status);
  raiz.innerHTML = `<div class="app" id="app">
    <aside class="lateral">
      <div class="marca"><div class="logo">${ic("obras")}</div><div><b>${esc(CFG.NOME_APP || "Gestão de Obras")}</b><small>${esc(emp?.nome || "Plataforma")}</small></div></div>
      <nav>
        ${itens.length ? `<div class="grupo">Principal</div>` : ""}
        ${itens.map((m) => `<a href="#${m.r}" data-r="${m.r}">${ic(m.i)}<span>${m.l}</span></a>`).join("")}
        ${s.admin_plataforma ? `<div class="grupo">Plataforma</div><a href="#plataforma" data-r="plataforma">${ic("plataforma")}<span>Administração SaaS</span></a>` : ""}
        <a href="#" id="sair-menu">${ic("sair")}<span>Sair</span></a>
      </nav>
      ${s.plano ? `<div class="rodape"><div class="plano"><span>Plano ${esc(s.plano.nome)}</span>${emp.status === "teste" ? `<span class="tag lar">Teste até ${fdata(emp.teste_ate)}</span>` : ""}</div></div>` : ""}
    </aside>
    <div class="fundo-menu" id="fundo-menu"></div>
    <div class="principal">
      <header class="topo">
        <button class="icone-btn hamb" id="hamb" aria-label="Menu">${ic("menu")}</button>
        <div class="busca-global" id="busca">${ic("busca")}<input placeholder="Pesquisar obras, OCs, notas, fornecedores..." id="busca-inp" ${s.membro ? "" : "disabled"}><div class="resultados oculto" id="busca-res"></div></div>
        <div class="acoes">
          <button class="icone-btn bt-busca-movel" id="bt-busca" aria-label="Pesquisar">${ic("busca")}</button>
          <div style="position:relative"><button class="icone-btn" id="bt-notif" aria-label="Notificações">${ic("sino")}<span class="ponto oculto" id="notif-cont"></span></button><div class="painel-flut oculto" id="notif-painel"></div></div>
          <div style="position:relative"><button class="perfil-btn" id="bt-perfil"><span class="avatar">${esc(iniciais(s.membro?.nome || S.user?.email))}</span><span class="txt"><b>${esc(s.membro?.nome || "Administrador")}</b><small>${esc(PERFIL_NOME[s.membro?.perfil] || "Plataforma")}</small></span></button>
            <div class="painel-flut menu-perfil oculto" id="perfil-menu" style="width:240px"><div class="cab"><div><b>${esc(s.membro?.nome || "")}</b><div class="mu peq">${esc(S.user?.email || "")}</div></div></div>
              ${s.membro ? `<a href="#configuracoes/conta">${ic("usuario")}Minha conta</a>` : ""}<button id="sair-perfil">${ic("sair")}Sair</button></div></div>
        </div>
      </header>
      <main class="conteudo">
        ${bloqueada ? `<div class="faixa alerta">${ic("alerta")}<span><b>Acesso suspenso.</b> ${esc(emp.motivo_bloqueio || (emp.status === "cancelada" ? "Assinatura cancelada." : "Período de teste encerrado ou pagamento pendente."))} ${s.admin_empresa ? 'Regularize em <a href="#configuracoes/plano">Plano e assinatura</a>.' : "Fale com o administrador da sua empresa."}</span></div>` : ""}
        <div id="pagina"></div>
      </main>
    </div>
    ${s.membro ? `<nav class="nav-inferior">${[["dashboard", "Início", "dashboard"], ["obras", "Obras", "obras"], ["compras", "Compras", "compras"], ["diario", "Diário", "diario"]].filter(([r]) => pode(r === "dashboard" ? "dashboard" : r, "ver")).map(([r, l, i]) => `<a href="#${r}" data-r="${r}">${ic(i)}${l}</a>`).join("")}<a href="#" id="nav-mais">${ic("menu")}Mais</a></nav>` : ""}
  </div>`;
  const app = $("#app");
  const alterna = () => app.classList.toggle("menu-aberto");
  $("#hamb").onclick = alterna; $("#fundo-menu").onclick = alterna; $("#nav-mais") && ($("#nav-mais").onclick = (e) => { e.preventDefault(); alterna(); });
  $$(".lateral nav a[data-r]").forEach((a) => a.addEventListener("click", () => app.classList.remove("menu-aberto")));
  const sair = async (e) => { e?.preventDefault(); await sb.auth.signOut(); };
  $("#sair-menu").onclick = sair; $("#sair-perfil").onclick = sair;
  $("#bt-perfil").onclick = (e) => { e.stopPropagation(); $("#perfil-menu").classList.toggle("oculto"); $("#notif-painel").classList.add("oculto"); };
  $("#bt-notif").onclick = (e) => { e.stopPropagation(); abrirNotificacoes(); };
  $("#bt-busca").onclick = () => { $("#busca").classList.toggle("aberta"); $("#busca-inp").focus(); };
  if (!window.__cliq) (window.__cliq = 1) && document.addEventListener("click", (e) => {
    if (!e.target.closest("#perfil-menu,#bt-perfil")) $("#perfil-menu")?.classList.add("oculto");
    if (!e.target.closest("#notif-painel,#bt-notif")) $("#notif-painel")?.classList.add("oculto");
    if (!e.target.closest("#busca,#bt-busca")) { $("#busca-res")?.classList.add("oculto"); $("#busca")?.classList.remove("aberta"); }
  });
  $("#busca-inp").addEventListener("input", debounce((e) => buscaGlobal(e.target.value), 350));
  if (s.membro) atualizarNotificacoes();
}

// ---------------- rotas ----------------
const MODULOS = {
  dashboard: () => import("./modulos/dashboard.js"), obras: () => import("./modulos/obras.js"), compras: () => import("./modulos/compras.js"),
  notas: () => import("./modulos/notas.js"), estoque: () => import("./modulos/estoque.js"), epi: () => import("./modulos/epi.js"),
  diario: () => import("./modulos/diario.js"), financeiro: () => import("./modulos/financeiro.js"), relatorios: () => import("./modulos/relatorios.js"),
  fornecedores: () => import("./modulos/fornecedores.js"), equipe: () => import("./modulos/equipe.js"), configuracoes: () => import("./modulos/configuracoes.js"),
  plataforma: () => import("./modulos/plataforma.js"),
};
let rotaAtual = "";
async function rotear() {
  if (!S.sessao) return;
  const [r, ...resto] = location.hash.slice(1).split("/");
  const rota = MODULOS[r] ? r : (S.sessao.membro ? "dashboard" : "plataforma");
  const item = MENU.find((m) => m.r === rota);
  const pg = $("#pagina"); if (!pg) return;
  $$("[data-r]").forEach((a) => a.classList.toggle("on", a.dataset.r === rota));
  if (rota === "plataforma" && !S.sessao.admin_plataforma) return negar(pg);
  if (rota !== "plataforma" && !S.sessao.membro) { location.hash = "plataforma"; return; }
  if (item?.m && !pode(item.m, "ver")) return negar(pg, item);
  if (rota !== rotaAtual) window.scrollTo(0, 0);
  rotaAtual = rota;
  pg.innerHTML = `<div class="vazio"><div class="spinner" style="margin:0 auto"></div></div>`;
  try {
    const mod = await MODULOS[rota]();
    await mod.render(pg, resto);
  } catch (e) { console.error(e); pg.innerHTML = `<div class="card"><div class="vazio verm">${esc(msgErro(e))}</div></div>`; }
}
function negar(pg, item) {
  const fora = item && !S.sessao.plano?.modulos?.includes(item.m) && item.m !== "dashboard";
  pg.innerHTML = `<div class="card"><div class="vazio">${ic("cadeado")}<h3>${fora ? "Módulo não incluído no seu plano" : "Acesso não permitido"}</h3><p>${fora ? "Faça upgrade do plano para usar este módulo." : "Seu perfil não tem permissão para esta área. Fale com o administrador."}</p>${fora && S.sessao.admin_empresa ? '<a class="bt" href="#configuracoes/plano">Ver planos</a>' : ""}</div></div>`;
}

// ---------------- notificações ----------------
let NOTIF = [];
export async function atualizarNotificacoes() {
  const { data } = await sb.rpc("minhas_notificacoes");
  NOTIF = data || [];
  const n = NOTIF.filter((x) => !x.lida).length, c = $("#notif-cont");
  if (c) { c.textContent = n > 99 ? "99+" : n; c.classList.toggle("oculto", !n); }
}
function abrirNotificacoes() {
  const p = $("#notif-painel"); $("#perfil-menu").classList.add("oculto");
  if (!p.classList.contains("oculto")) return p.classList.add("oculto");
  const cor = { alta: "var(--verm)", media: "var(--lar)", baixa: "var(--azul)" };
  p.innerHTML = `<div class="cab"><b>Notificações</b>${NOTIF.some((x) => !x.lida) ? '<button class="lnk peq" id="ler-todas">Marcar todas como lidas</button>' : ""}</div>
    <div class="lista">${NOTIF.length ? NOTIF.map((x, i) => `<div class="notif ${x.lida ? "lida" : ""}" data-i="${i}"><span class="marca-g" style="background:${cor[x.gravidade]}"></span><div><b>${esc(x.titulo)}</b><p>${esc(x.mensagem)}</p></div></div>`).join("") : '<div class="vazio">Nenhuma notificação. Tudo em dia!</div>'}</div>`;
  p.classList.remove("oculto");
  p.querySelectorAll(".notif").forEach((d) => d.onclick = async () => {
    const x = NOTIF[+d.dataset.i];
    if (!x.lida) await sb.from("notificacoes_lidas").upsert({ chave: x.chave }, { onConflict: "user_id,chave" });
    p.classList.add("oculto"); atualizarNotificacoes(); ir(x.link);
  });
  $("#ler-todas") && ($("#ler-todas").onclick = async () => {
    await sb.from("notificacoes_lidas").upsert(NOTIF.filter((x) => !x.lida).map((x) => ({ chave: x.chave })), { onConflict: "user_id,chave" });
    await atualizarNotificacoes(); p.classList.add("oculto");
  });
}

// ---------------- busca global ----------------
async function buscaGlobal(t) {
  const res = $("#busca-res"); t = t.replace(/[,()%]/g, " ").trim();
  if (t.length < 2) return res.classList.add("oculto");
  const fontes = [
    ["obras", "obras", "id,codigo,nome,cliente", ["codigo", "nome", "cliente"], (r) => [`${r.codigo} · ${r.nome}`, r.cliente || "Obra", `obras/${r.id}`]],
    ["compras", "v_ocs", "id,numero,fornecedor_nome,obra_nome", ["numero", "fornecedor_nome"], (r) => [r.numero, `${r.fornecedor_nome || ""} · ${r.obra_nome || ""}`, `compras/${r.id}`]],
    ["notas", "v_notas", "id,numero,fornecedor_nome", ["numero", "fornecedor_nome", "chave_acesso"], (r) => [`NF ${r.numero}`, r.fornecedor_nome, `notas/${r.id}`]],
    ["fornecedores", "fornecedores", "id,razao_social,nome_fantasia,documento", ["razao_social", "nome_fantasia", "documento"], (r) => [r.nome_fantasia || r.razao_social, "Fornecedor", `fornecedores/${r.id}`]],
    ["estoque", "materiais", "id,codigo,nome", ["codigo", "nome"], (r) => [`${r.codigo} · ${r.nome}`, "Material", `estoque/material/${r.id}`]],
  ].filter((f) => pode(f[0], "ver"));
  const partes = await Promise.all(fontes.map(async ([, tab, sel, cols, fmt]) => {
    const { data } = await sb.from(tab).select(sel).or(cols.map((c) => `${c}.ilike.%${t}%`).join(",")).limit(5);
    return (data || []).map(fmt);
  }));
  const it = partes.flat();
  res.innerHTML = it.length ? it.map(([a, b, l]) => `<a href="#${l}">${esc(a)}<small>${esc(b || "")}</small></a>`).join("") : '<div class="vazio peq">Nada encontrado.</div>';
  res.classList.remove("oculto");
  res.querySelectorAll("a").forEach((a) => a.onclick = () => { res.classList.add("oculto"); $("#busca-inp").value = ""; $("#busca").classList.remove("aberta"); });
}

// ---------------- encerramento por inatividade ----------------
let timer;
function vigiarInatividade() {
  if (window.__inat) return; window.__inat = true;
  const min = Number(CFG.MINUTOS_INATIVIDADE || 30);
  const reinicia = () => { clearTimeout(timer); timer = setTimeout(async () => { await sb.auth.signOut(); toast("Sessão encerrada por inatividade."); }, min * 60000); };
  ["click", "keydown", "touchstart", "scroll"].forEach((ev) => document.addEventListener(ev, reinicia, { passive: true }));
  reinicia();
  setInterval(() => { if (S.sessao?.membro && !document.hidden) atualizarNotificacoes(); }, 120000);
}

window.addEventListener("unhandledrejection", (e) => { console.error(e.reason); toast(msgErro(e.reason), "erro"); });
iniciar();
