import { esc, data, tag, obrasOp, cpfValido, docFmt } from "../core.js";
import { listaRecurso } from "../crud.js";

const SIT = { ativo: ["Ativo", "verde"], afastado: ["Afastado", "lar"], ferias: ["Férias", "azul"], desligado: ["Desligado", "cinza"] };
const FUNCOES = ["Engenheiro", "Mestre de obras", "Encarregado", "Pedreiro", "Servente", "Carpinteiro", "Armador", "Eletricista", "Encanador", "Pintor", "Operador de máquinas", "Técnico de segurança", "Almoxarife", "Administrativo", "Outro"];

export async function render(el) {
  const obras = await obrasOp(true);
  el.innerHTML = `<div class="cab-pagina"><div><h1>Equipe</h1><p>Funcionários e colaboradores. Dados pessoais (CPF, contato) são visíveis apenas para quem tem acesso a este módulo.</p></div></div><div id="lista"></div>`;
  await listaRecurso(el.querySelector("#lista"), {
    titulo: "Funcionários", singular: "funcionário", tabela: "funcionarios", modulo: "equipe", novoTexto: "Novo funcionário", cache: "funcionarios",
    select: "*, obras(codigo,nome)", busca: ["nome", "cpf", "cargo", "funcao"], ordem: ["nome", true],
    filtros: [{ k: "obra_id", l: "Obra", op: obras }, { k: "funcao", l: "Função", op: FUNCOES }, { k: "situacao", l: "Situação", op: Object.entries(SIT).map(([v, [l]]) => [v, l]), padrao: "ativo" }],
    colunas: [{ l: "Nome", pri: true, k: "nome", f: (r) => `<b>${esc(r.nome)}</b>` }, { l: "CPF", k: "cpf", f: (r) => esc(docFmt(r.cpf)) }, { l: "Cargo", k: "cargo" }, { l: "Função", k: "funcao" },
      { l: "Obra", v: (r) => r.obras?.nome, f: (r) => esc(r.obras ? `${r.obras.codigo} · ${r.obras.nome}` : "-") }, { l: "Admissão", k: "data_admissao", tipo: "data", f: (r) => data(r.data_admissao) },
      { l: "Telefone", k: "telefone" }, { l: "Situação", k: "situacao", f: (r) => tag(...(SIT[r.situacao] || [r.situacao, "cinza"])) }],
    campos: [{ k: "nome", l: "Nome completo", req: true, s2: true }, { k: "cpf", l: "CPF", valida: (v) => (cpfValido(v) ? null : "CPF inválido") },
      { k: "data_admissao", l: "Data de admissão", t: "date" }, { k: "telefone", l: "Telefone", t: "tel" }, { k: "email", l: "E-mail", t: "email" },
      { k: "cargo", l: "Cargo" }, { k: "funcao", l: "Função", t: "select", op: FUNCOES }, { k: "obra_id", l: "Obra vinculada", t: "select", op: await obrasOp(), numerico: true },
      { k: "situacao", l: "Situação", t: "select", op: Object.entries(SIT).map(([v, [l]]) => [v, l]), vazio: false, padrao: "ativo" }, { k: "observacoes", l: "Observações", t: "textarea", s2: true }],
    preparar: (v) => ({ ...v, cpf: v.cpf ? v.cpf.replace(/\D/g, "") : null }), padroes: () => ({ situacao: "ativo" }), permiteExcluir: false,
  });
}
