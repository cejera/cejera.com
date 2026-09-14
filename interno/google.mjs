import { CONFIG } from './config.mjs';
import { SCHEMA, parseRows, mergeChanges, sheetValue, validateLead } from './domain.mjs';
import { permissionsFor, protectionUpdates, validateMember, canChangeStage, assertLeadWrite, leadProtectionUpdates, roleFor } from './permissions.mjs';
import { validateBadge } from './achievements.mjs';
import { commissionSplit } from './commissions.mjs';
import { creationAudit } from './audit.mjs';
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.email';
export class GoogleError extends Error { constructor(status,message){super(message);this.status=status;} }
let client, pending, token='', expires=0, expiryTimer, automatic=false;
export async function initGoogle(onExpiry) {
  if (!globalThis.google?.accounts?.oauth2) await new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;
    script.onload=resolve;script.onerror=()=>reject(new Error('Não foi possível carregar o login Google. Confira sua conexão.'));
    document.head.append(script);
  });
  client=google.accounts.oauth2.initTokenClient({client_id:CONFIG.clientId,scope:SCOPE,include_granted_scopes:false,
    callback:response=>{
      const current=pending;pending=null;
      if(response.error){current?.reject(new Error(automatic?'Clique em Entrar com Google para continuar.':'O Google não autorizou o acesso. Tente novamente.'));return;}
      if(!google.accounts.oauth2.hasGrantedAllScopes(response,...SCOPE.split(' '))){current?.reject(new Error('Autorize o acesso às planilhas para usar o CRM.'));return;}
      token=response.access_token;expires=Date.now()+Number(response.expires_in)*1000;
      clearTimeout(expiryTimer);expiryTimer=setTimeout(()=>{signOut();onExpiry();},Math.max(0,expires-Date.now()-15000));
      current?.resolve();
    },error_callback:()=>{const current=pending;pending=null;current?.reject(new Error('Clique em Entrar com Google e permita a janela de login.'));}});
}
export function login(silent=false,select=false) {
  if(!client) return Promise.reject(new Error('O login Google ainda está carregando.'));
  if(pending) return Promise.reject(new Error('Conclua a janela de login já aberta.'));
  automatic=silent;
  return new Promise((resolve,reject)=>{pending={resolve,reject};try{client.requestAccessToken({prompt:silent?'none':select?'select_account':''});}catch(error){pending=null;reject(error);}});
}
export function signOut(){token='';expires=0;clearTimeout(expiryTimer);}
async function request(url,options={}) {
  if(!token||Date.now()>=expires)throw new GoogleError(401,'Sua sessão expirou. Entre novamente com Google.');
  const response=await fetch(url,{...options,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},cache:'no-store',signal:AbortSignal.timeout(25000)});
  if(!response.ok){
    const message=response.status===401?'Sua sessão expirou. Entre novamente com Google.':response.status===403?'O Google não permitiu esta operação. Confira suas permissões na planilha.':response.status===404?'A planilha não está disponível para esta conta.':response.status===429?'Muitas atualizações. Aguarde alguns segundos para tentar novamente.':'Não foi possível concluir a operação no Google. Tente novamente.';
    throw new GoogleError(response.status,message);
  }
  return response.status===204?{}:response.json();
}
export class SheetsRepository {
  constructor(){this.base=`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}`;this.data={};this.sheets={};this.canEdit=false;this.admin=false;this.permissions={};this.role='Vendedor';this.generation=0;}
  async connect(){
    if(!CONFIG.spreadsheetId)throw new Error('A conexão com a planilha ainda não foi configurada.');
    const user=await request('https://www.googleapis.com/oauth2/v2/userinfo');
    if(!user.email||!user.verified_email)throw new Error('O Google não confirmou o e-mail desta conta.');
    this.user={email:user.email.toLowerCase(),name:user.name||user.email.split('@')[0]};
    await this.metadata();return this.load();
  }
  async metadata(){
    const meta=await request(this.base+'?fields=sheets(properties,protectedRanges,tables)');
    this.sheets=Object.fromEntries(meta.sheets.map(s=>[s.properties.title,s]));
    for(const name of Object.keys(SCHEMA))if(!this.sheets[name])throw new Error(`A aba ${name} não foi encontrada na planilha.`);
    // This Google-enforced range covers the editable lead cells. UI flags are never the authorization boundary.
    this.canEdit=this.sheets.Leads.protectedRanges?.some(p=>p.description==='CRM: permissao de edicao'&&p.requestingUserCanEdit===true)??false;
  }
  applyPermissions(team){
    this.permissions=permissionsFor(this.user.email,team,this.sheets,this.canEdit);
    this.role=this.permissions.role;this.admin=this.permissions.Equipe&&this.permissions.Badges;
  }
  canStage(lead){return canChangeStage(this.user.email,this.permissions,lead,this.sheets);}
  async readSheets(names){
    const query=new URLSearchParams({valueRenderOption:'UNFORMATTED_VALUE',dateTimeRenderOption:'SERIAL_NUMBER'});
    for(const name of names){const grid=this.sheets[name].properties.gridProperties;query.append('ranges',`'${name}'!A1:${columnName(grid.columnCount-1)}${grid.rowCount}`);}
    const data=await request(this.base+'/values:batchGet?'+query);
    return Object.fromEntries(names.map((name,i)=>[name,parseRows(name,data.valueRanges[i].values||[])]));
  }
  async load(){
    const generation=++this.generation;
    await this.metadata();
    const data=await this.readSheets(Object.keys(SCHEMA));
    if(generation===this.generation){this.data=data;this.applyPermissions(data.Equipe);}
    return this.data;
  }
  async save(name,record,base=null){
    if(!this.canEdit)throw new Error('Seu acesso à planilha é somente leitura.');
    await this.metadata();
    const team=(await this.readSheets(['Equipe'])).Equipe;
    this.applyPermissions(team);
    if(!this.permissions[name])throw new Error('Seu nível de permissão não permite esta alteração.');
    if(name==='Equipe')record=validateMember(record);
    if(name==='Badges')record=validateBadge(record);
    ++this.generation;
    const fresh=(await this.readSheets([name]))[name],key=name==='Equipe'?'email':'id';
    let existing=base?(base[key]?fresh.find(r=>r[key]===base[key]):fresh.find(r=>r._row===base._row)):fresh.find(r=>r[key]===record[key]);
    if(base&&!existing)throw new Error('Este registro foi removido da planilha. Atualize o painel antes de continuar.');
    if(base&&!base[key] && existing.nome!==base.nome)throw new Error('A ordem da planilha mudou. Reabra o registro antes de salvar.');
    if(!base&&existing){
      if(SCHEMA[name].every(k=>String(existing[k]??'')===String(record[k]??'')))return this.load();
      throw new Error('Este registro já existe. Atualize o painel para editá-lo.');
    }
    if(name==='Leads')record=creationAudit(record,existing,this.user.email);
    const patch=Object.fromEntries(SCHEMA[name].filter(k=>!base||String(base[k]??'')!==String(record[k]??'')).map(k=>[k,record[k]??'']));
    if(existing&&base)record=mergeChanges(base,existing,patch);
    if(name==='Leads'){
      assertLeadWrite(this.user.email,this.permissions,existing,patch,this.sheets);
      record=validateLead(record);
      if(!record.excluido_em){
        if(!record.responsavel||!record.gerente)throw new Error('Escolha o vendedor e o gerente responsáveis.');
        if(!['Admin','Gerente'].includes(roleFor(record.gerente,team)))throw new Error('O gerente deve ter cargo Admin ou Gerente na equipe.');
        commissionSplit(record,team);
      }
    }
    const headers=existing?existing._headers:SCHEMA[name];
    const sheetId=this.sheets[name].properties.sheetId;
    const nextTeam=name==='Equipe'?[...team.filter(m=>m.email!==record.email),record]:team;
    const protections=name==='Equipe'?[...protectionUpdates(nextTeam,this.sheets),...leadProtectionUpdates(nextTeam,(await this.readSheets(['Leads'])).Leads,this.sheets)]:[];
    if(existing){
      const requests=Object.keys(patch).map(k=>({updateCells:{start:{sheetId,rowIndex:existing._row-1,columnIndex:headers.indexOf(k)},rows:[{values:[cellValue(sheetValue(k,record[k]))]}],fields:'userEnteredValue'}}));
      if(name==='Leads'&&this.permissions.manageLeads&&['responsavel','gerente','excluido_em','id'].some(k=>k in patch))requests.push(...leadProtectionUpdates(team,fresh.map(l=>l._row===existing._row?{...record,_row:l._row,_headers:headers}:l),this.sheets));
      requests.push(...protections);
      if(requests.length)await request(this.base+':batchUpdate',{method:'POST',body:JSON.stringify({requests})});
    }else{
      // Read the current header order before append; sheet users can reorder columns.
      const values=await request(this.base+'/values/'+encodeURIComponent(`'${name}'!1:1`));
      const currentHeaders=values.values[0];
      if(SCHEMA[name].some(h=>!currentHeaders.includes(h)))throw new Error('Os cabeçalhos da planilha foram alterados.');
      if(name==='Equipe'||name==='Leads'){
        // Profile and Google-enforced permissions change in one atomic batch.
        const rowIndex=Math.max(1,...fresh.map(r=>r._row));
        if(name==='Leads')protections.push(...leadProtectionUpdates(team,[...fresh,{...record,_row:rowIndex+1,_headers:currentHeaders}],this.sheets));
        const requests=[];
        if(rowIndex>=this.sheets[name].properties.gridProperties.rowCount)requests.push({appendDimension:{sheetId,dimension:'ROWS',length:1}});
        const table=name==='Leads'?this.sheets.Leads.tables?.find(t=>t.name==='Leads_Cejera'):null;
        if(table&&rowIndex>=table.range.endRowIndex)requests.push({updateTable:{table:{tableId:table.tableId,range:{...table.range,endRowIndex:rowIndex+1,endColumnIndex:currentHeaders.length}},fields:'range'}});
        requests.push({copyPaste:{source:{sheetId,startRowIndex:Math.max(1,rowIndex-1),endRowIndex:Math.max(1,rowIndex-1)+1,startColumnIndex:0,endColumnIndex:currentHeaders.length},destination:{sheetId,startRowIndex:rowIndex,endRowIndex:rowIndex+1,startColumnIndex:0,endColumnIndex:currentHeaders.length},pasteType:'PASTE_FORMAT'}},
          {updateCells:{start:{sheetId,rowIndex,columnIndex:0},rows:[{values:currentHeaders.map(k=>cellValue(sheetValue(k,record[k])))}],fields:'userEnteredValue'}},...protections);
        await request(this.base+':batchUpdate',{method:'POST',body:JSON.stringify({requests})});
      }else await request(this.base+'/values/'+encodeURIComponent(`'${name}'!A1`)+':append?valueInputOption=RAW&insertDataOption=OVERWRITE',{method:'POST',body:JSON.stringify({values:[currentHeaders.map(k=>sheetValue(k,record[k]))]})});
    }
    try { return await this.load(); } catch(error) { error.saved=true; throw error; }
  }
  async syncPermissions(){
    await this.load();
    if(!this.admin)throw new Error('Somente Admin pode aplicar permissões.');
    await request(this.base+':batchUpdate',{method:'POST',body:JSON.stringify({requests:[...protectionUpdates(this.data.Equipe,this.sheets),...leadProtectionUpdates(this.data.Equipe,this.data.Leads,this.sheets)]})});
    return this.load();
  }
  destroy(){++this.generation;this.data={};this.user=null;this.canEdit=false;this.admin=false;this.permissions={};signOut();}
}
export function cellValue(value){return {userEnteredValue:typeof value==='number'?{numberValue:value}:{stringValue:String(value??'')}};}
export function columnName(index){let s='';for(let i=index+1;i>0;i=Math.floor((i-1)/26))s=String.fromCharCode(65+(i-1)%26)+s;return s;}
