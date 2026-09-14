import { BADGE_CODES, today } from './domain.mjs';
import { CATALOG } from './catalog.mjs';
import { creationAudit } from './audit.mjs';
export function demoData() {
  const date = today(), month = date.slice(0,7);
  const leads = [
    ['demo-1','Studio Aurora','Marca','Lead novo',5,8500,'Identidade visual para uma nova coleção.','cejerag@gmail.com'],
    ['demo-2','DJ Horizonte','DJ','Lead novo',3,2200,'Press kit e direção para o lançamento.','bia@example.com'],
    ['demo-3','Casa do Café','Pequena empresa','Primeiro contato',4,6400,'Redesign da marca e presença digital.','cejerag@gmail.com'],
    ['demo-4','Luna Martins','Influenciador','Primeiro contato',4,3800,'Direção de marca pessoal.','bia@example.com'],
    ['demo-5','Festival Órbita','Marca','Em andamento',5,18000,'Proposta enviada. Aguardando retorno.','cejerag@gmail.com'],
    ['demo-6','Ateliê Forma','Pequena empresa','Em andamento',3,5200,'Alinhamento de escopo nesta semana.','bia@example.com'],
    ['demo-7','Coletivo Norte','Marca','Fechado',5,12000,'Projeto aprovado.','cejerag@gmail.com'],
    ['demo-8','Maré Records','Pequena empresa','Fechado',4,7500,'Identidade do novo selo.','bia@example.com'],
    ['demo-9','Pedro Almeida','Pessoa','Aberto para remarketing',2,1500,'Retomar conversa no próximo lançamento.','cejerag@gmail.com'],
  ].map(([id,nome,tipo,status,qualidade,valor,descricao,responsavel],i)=>({id,nome,tipo,status,qualidade,valor,descricao,responsavel,telefone:'',email:'',fechado_em:status==='Fechado'?date:'',proximo_contato:i===2?date:'',criado_em:date+'T12:00:00Z',atualizado_em:date+'T12:00:00Z'}));
  return {Leads:leads,Equipe:[{email:'cejerag@gmail.com',nome:'Cejera',comissao:.04,nivel:1},{email:'bia@example.com',nome:'Bia (exemplo)',comissao:.04,nivel:2}],Metas:[{id:month+':cejerag@gmail.com',email:'cejerag@gmail.com',mes:month,faturamento:30000,vendas:5},{id:month+':bia@example.com',email:'bia@example.com',mes:month,faturamento:20000,vendas:4}],Badges:BADGE_CODES.map(id=>({id,nome:id==='777'?'Colheita':'Conquista '+id,descricao:'Reconhecimento concedido por Cejera.',imagem:id+'.png'})),Conquistas:[{id:'demo-award',email:'cejerag@gmail.com',badge_id:'777',concedido_em:date,mensagem:'Um ciclo de boas conquistas.'}]};
}
export class DemoRepository {
  constructor(){this.data=demoData();this.data.Badges=structuredClone(CATALOG);this.data.Equipe[0].permissao='Admin';this.data.Equipe[1].permissao='Vendedor';this.data.Equipe.push({email:'ziero.true@gmail.com',nome:'Ziero',comissao:.04,nivel:1,permissao:'Gerente'});this.data.Conquistas=[{id:'demo-first',email:'cejerag@gmail.com',badge_id:'147',concedido_em:today(),mensagem:'A primeira colheita do ciclo.'}];this.canEdit=true;this.admin=true;this.role='Admin';this.permissions={Leads:true,Equipe:true,Metas:true,Badges:true,Conquistas:true};this.user={email:'cejerag@gmail.com',name:'Cejera'};}
  canStage(lead){return !!lead&&!lead.excluido_em;}
  async load(){this.permissions.manageLeads=true;this.data.Leads=this.data.Leads.map((l,i)=>({...l,gerente:l.gerente||'cejerag@gmail.com',ordem:l.ordem??(i+1)*1024,criado_por:l.criado_por||'cejerag@gmail.com'}));return structuredClone(this.data);}
  async syncPermissions(){return this.load();}
  async save(name,record,base){const key=name==='Equipe'?'email':'id',id=record[key];const index=this.data[name].findIndex(r=>r[key]===id);if(name==='Leads')record=creationAudit(record,index<0?null:this.data[name][index],this.user.email);if(index<0)this.data[name].push(record);else this.data[name][index]={...this.data[name][index],...record};return this.load();}
  destroy(){this.data=null;}
}
