export function creationAudit(record,existing,email,now=new Date().toISOString()) {
  return {...record,criado_em:existing?existing.criado_em||'':now,criado_por:existing?existing.criado_por||'':String(email).trim().toLowerCase(),atualizado_em:existing?record.atualizado_em:now};
}
export function creationDateLabel(value) {
  if(!value||Number.isNaN(new Date(value).valueOf()))return 'Data não registrada';
  return new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value));
}
