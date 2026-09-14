import { CONFIG } from './config.mjs';
import { activeLeads } from './pipeline.mjs';
export function commissionSplit(lead,team) {
  const rateFor=email=>{
    const value=team.find(m=>m.email===email)?.comissao;
    const rate=value===''||value==null?CONFIG.defaultCommission:Number(value);
    if(!Number.isFinite(rate)||rate<0||rate>=1)throw new Error('Confira as taxas de comissão na aba Equipe.');
    return rate;
  };
  if(!lead.responsavel||!lead.gerente)throw new Error('Defina o gerente e o vendedor para distribuir a venda.');
  const sellerRate=lead.responsavel===CONFIG.ownerEmail?0:rateFor(lead.responsavel);
  const managerRate=lead.gerente===CONFIG.ownerEmail?0:rateFor(lead.gerente);
  const ownerRate=1-sellerRate-managerRate;
  if(ownerRate<0.000001)throw new Error('As comissões do gerente e do vendedor precisam somar menos de 100%, mantendo a participação de Cejera.');
  const cents=Math.round(Number(lead.valor||0)*100);
  // Fractional cents stay with Cejera; the allocation always equals the sale exactly.
  const sellerCents=Math.floor(cents*sellerRate+1e-7),managerCents=Math.floor(cents*managerRate+1e-7),ownerCents=cents-sellerCents-managerCents;
  return [
    {email:lead.responsavel,papel:'Vendedor',rate:sellerRate,amount:sellerCents/100},
    {email:lead.gerente,papel:'Gerente',rate:managerRate,amount:managerCents/100},
    {email:CONFIG.ownerEmail,papel:'Cejera',rate:ownerRate,amount:ownerCents/100}
  ].filter(p=>p.rate>0);
}
export function commercialStats(leads,team,member,month) {
  const all=activeLeads(leads),own=all.filter(l=>l.responsavel===member.email),won=own.filter(l=>l.status==='Fechado'&&l.fechado_em?.startsWith(month));
  const totalWon=all.filter(l=>l.status==='Fechado'&&l.fechado_em?.startsWith(month));
  let commission=0,invalid=0;
  for(const lead of totalWon){try{commission+=commissionSplit(lead,team).filter(p=>p.email===member.email).reduce((sum,p)=>sum+Math.round(p.amount*100),0);}catch{invalid++;}}
  return {leads:own.length,won:won.length,revenue:won.reduce((sum,l)=>sum+Math.round(Number(l.valor||0)*100),0)/100,commission:commission/100,invalid,rate:member.comissao===''||member.comissao==null?CONFIG.defaultCommission:Number(member.comissao)};
}
