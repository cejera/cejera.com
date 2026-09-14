import { CONFIG } from './config.mjs';
export const ROLES = ['Admin', 'Gerente', 'Vendedor'];
export const PROTECTIONS = { Equipe: 'CRM: administradores', Badges: 'CRM: administradores', Metas: 'CRM: gestores', Conquistas: 'CRM: gestores' };
export function roleFor(email, team) {
  if (email === CONFIG.ownerEmail) return 'Admin';
  const role = team.find(m => m.email === email)?.permissao;
  return ROLES.includes(role) ? role : 'Vendedor';
}
export function permissionsFor(email, team, sheets, canEdit) {
  const role = roleFor(email, team);
  const allowed = name => !!canEdit && !!sheets[name]?.protectedRanges?.some(p =>
    p.description === PROTECTIONS[name] && !p.warningOnly && p.requestingUserCanEdit === true &&
    p.range?.sheetId === sheets[name].properties.sheetId &&
    !p.range.startRowIndex && p.range.endRowIndex == null && !p.range.startColumnIndex && p.range.endColumnIndex == null && !p.unprotectedRanges?.length);
  const manageLeads=!!canEdit&&['Admin','Gerente'].includes(role)&&!!sheets.Leads?.protectedRanges?.some(p=>p.description==='CRM: leads e atribuicoes'&&!p.warningOnly&&p.requestingUserCanEdit===true);
  return { role, Leads: !!canEdit, manageLeads, Equipe: role === 'Admin' && allowed('Equipe'), Badges: role === 'Admin' && allowed('Badges'),
    Metas: ['Admin','Gerente'].includes(role) && allowed('Metas'), Conquistas: ['Admin','Gerente'].includes(role) && allowed('Conquistas') };
}
export function protectionUpdates(team, sheets) {
  const admins = [...new Set([CONFIG.ownerEmail, ...team.filter(m => m.permissao === 'Admin').map(m => m.email)])].sort();
  const managers = [...new Set([...admins, ...team.filter(m => m.permissao === 'Gerente').map(m => m.email)])].sort();
  return Object.entries(PROTECTIONS).map(([name,description]) => {
    const protection = sheets[name]?.protectedRanges?.find(p => p.description === description);
    if (!protection) throw new Error(`A proteção da aba ${name} não foi encontrada. Restaure-a na planilha.`);
    return { updateProtectedRange: { protectedRange: { protectedRangeId: protection.protectedRangeId,
      editors: { users: ['Metas','Conquistas'].includes(name) ? managers : admins, groups: [], domainUsersCanEdit: false } }, fields: 'editors' } };
  });
}
export function validateMember(input) {
  const m = { ...input, email: String(input.email || '').trim().toLowerCase(), nome: String(input.nome || '').trim(), comissao: Number(input.comissao), nivel: Number(input.nivel), permissao: input.permissao || 'Vendedor' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.email) || !m.nome || m.nome.length > 120) throw new Error('Confira o nome e o e-mail do membro.');
  if (!Number.isFinite(m.comissao) || m.comissao < 0 || m.comissao > 1 || !Number.isInteger(m.nivel) || m.nivel < 1 || m.nivel > 999 || !ROLES.includes(m.permissao)) throw new Error('Confira a comissão, o nível e a permissão.');
  if (m.email === CONFIG.ownerEmail) m.permissao = 'Admin';
  return m;
}
export function canChangeStage(email,permissions,lead,sheets) {
  if(!lead||lead.excluido_em||lead.status==='Lixeira')return false;
  if(permissions.manageLeads)return true;
  if(!permissions.Leads||lead.responsavel!==email)return false;
  const column=lead._headers?.indexOf('status');
  return !!sheets.Leads?.protectedRanges?.some(p=>p.description==='CRM: fase:'+lead.id+':status'&&!p.warningOnly&&p.requestingUserCanEdit===true&&p.range.startRowIndex===lead._row-1&&p.range.endRowIndex===lead._row&&p.range.startColumnIndex===column&&p.range.endColumnIndex===column+1);
}
export function assertLeadWrite(email,permissions,existing,patch,sheets) {
  if(permissions.manageLeads)return;
  if(!canChangeStage(email,permissions,existing,sheets)||!Object.hasOwn(patch,'status')||Object.keys(patch).some(k=>!['status','fechado_em','atualizado_em'].includes(k))) throw new Error('Vendedores podem alterar somente a fase dos próprios leads. Atribuições e demais dados são gerenciados por Admin ou Gerente.');
}
export function leadProtectionUpdates(team,leads,sheets) {
  const sheet=sheets.Leads,sheetId=sheet.properties.sheetId;
  const managers=[...new Set([CONFIG.ownerEmail,...team.filter(m=>['Admin','Gerente'].includes(m.permissao)).map(m=>m.email)])];
  const base=sheet.protectedRanges?.find(p=>p.description==='CRM: leads e atribuicoes');
  const existing=(sheet.protectedRanges||[]).filter(p=>p.description?.startsWith('CRM: fase:'));
  const requests=[],exceptions=[],keep=new Set();
  for(const lead of leads.filter(l=>l.id&&l.responsavel&&!l.excluido_em&&l.status!=='Lixeira')){
    for(const key of ['status','fechado_em','atualizado_em']){
      const col=lead._headers.indexOf(key);
      if(col<0)throw new Error('Confira os cabeçalhos antes de aplicar as permissões.');
      const range={sheetId,startRowIndex:lead._row-1,endRowIndex:lead._row,startColumnIndex:col,endColumnIndex:col+1};
      const description='CRM: fase:'+lead.id+':'+key;
      const prior=existing.find(p=>p.description===description);keep.add(description);exceptions.push(range);
      const protectedRange={description,range,warningOnly:false,editors:{users:[...new Set([...managers,lead.responsavel])],groups:[],domainUsersCanEdit:false}};
      requests.push(prior?{updateProtectedRange:{protectedRange:{...protectedRange,protectedRangeId:prior.protectedRangeId},fields:'range,description,warningOnly,editors'}}:{addProtectedRange:{protectedRange}});
    }
  }
  for(const range of existing.filter(p=>!keep.has(p.description)))requests.push({deleteProtectedRange:{protectedRangeId:range.protectedRangeId}});
  const protectedRange={description:'CRM: leads e atribuicoes',range:{sheetId},warningOnly:false,unprotectedRanges:exceptions,editors:{users:managers,groups:[],domainUsersCanEdit:false}};
  requests.push(base?{updateProtectedRange:{protectedRange:{...protectedRange,protectedRangeId:base.protectedRangeId},fields:'range,description,warningOnly,unprotectedRanges,editors'}}:{addProtectedRange:{protectedRange}});
  return requests;
}
