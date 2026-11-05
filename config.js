// =====================================================================
//  CONFIGURAÇÃO DO SISTEMA — este é o ÚNICO arquivo que você precisa editar.
//  Os dados ficam no painel do Supabase: Project Settings > API (ou "Connect")
// =====================================================================
window.CONFIG = {
  // URL do projeto Supabase (ex.: https://abcdefghijk.supabase.co)
  SUPABASE_URL: "COLE_AQUI_A_URL_DO_PROJETO",

  // Chave PÚBLICA "anon" (começa com eyJ...). NUNCA coloque aqui a "service_role"
  // nem o Access Token do Mercado Pago.
  SUPABASE_ANON_KEY: "COLE_AQUI_A_CHAVE_ANON",

  // Nome exibido no sistema
  NOME_APP: "Gestão de Obras",

  // Minutos sem uso até encerrar a sessão automaticamente
  MINUTOS_INATIVIDADE: 30,
};
