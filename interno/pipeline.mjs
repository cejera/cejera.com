import { STATUSES, today, validateLead } from './domain.mjs';
export const activeLeads = leads => leads.filter(l => !l.excluido_em && l.status !== 'Lixeira');
export const leadOrder = l => l.ordem !== '' && l.ordem != null && Number.isFinite(Number(l.ordem)) ? Number(l.ordem) : Number(l._row || 1) * 1024;
export const orderedLeads = leads => [...leads].sort((a,b) => leadOrder(a)-leadOrder(b) || String(a.criado_em||'').localeCompare(String(b.criado_em||'')) || String(a.id).localeCompare(String(b.id)));
export function rankBetween(previous,next) {
  const a=previous?leadOrder(previous):null,b=next?leadOrder(next):null;
  const value=a==null?(b==null?1024:b-1024):b==null?a+1024:(a+b)/2;
  if ((a!=null&&value<=a)||(b!=null&&value>=b)) throw new Error('Atualize o funil antes de reordenar esta posição.');
  return value;
}
export function archiveLead(lead) {
  if(lead.excluido_em)throw new Error('Este lead já está na lixeira.');
  return validateLead({...lead,valor_anterior:lead.valor,status_anterior:lead.status,fechamento_anterior:lead.fechado_em,valor:0,status:'Lixeira',fechado_em:'',excluido_em:new Date().toISOString(),atualizado_em:new Date().toISOString()});
}
export function restoreLead(lead,newCampaign=false) {
  if(!lead.excluido_em)throw new Error('Este lead não está na lixeira.');
  return validateLead({...lead,excluido_em:'',valor:newCampaign?0:Number(lead.valor_anterior||0),status:newCampaign?'Lead novo':STATUSES.includes(lead.status_anterior)?lead.status_anterior:'Lead novo',fechado_em:newCampaign?'':lead.fechamento_anterior||'',valor_anterior:'',status_anterior:'',fechamento_anterior:'',atualizado_em:new Date().toISOString()});
}
export function stageChange(lead,status) {
  if(lead.excluido_em)throw new Error('Restaure o lead antes de mudar sua fase.');
  return validateLead({...lead,status,fechado_em:status==='Fechado'?(lead.fechado_em||today()):'',atualizado_em:new Date().toISOString()});
}
