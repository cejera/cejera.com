export function googleErrorMessage(status, payload = {}) {
  const detail = String(payload?.error?.message || '').toLowerCase();
  if (status === 401) return 'Sua sessão expirou. Entre novamente com Google.';
  if (/protect|proteg|permission to edit/.test(detail)) return 'O Google bloqueou uma célula protegida. Atualize o CRM e confira as permissões com Cejera. Seu formulário foi preservado.';
  if (status === 403) return 'O Google não permitiu esta operação. Confira se sua conta tem acesso de editor à planilha.';
  if (status === 404) return 'A planilha não está disponível para esta conta.';
  if (status === 429) return 'Muitas atualizações. Aguarde alguns segundos para tentar novamente.';
  if (status >= 500) return 'O Google está temporariamente indisponível. Aguarde e tente novamente com o mesmo formulário.';
  return `Não foi possível salvar no Google (código ${status}). Seu formulário foi preservado. Confira os campos e tente novamente.`;
}
