import { activeLeads, orderedLeads, rankBetween, archiveLead, restoreLead, stageChange } from './pipeline.mjs';
import { commissionSplit, commercialStats } from './commissions.mjs';
import { creationDateLabel } from './audit.mjs';
import { ROLES, roleFor, validateMember } from './permissions.mjs';
import { METRICS, RARITIES, achievementStats, badgeProgress, metricValue, validateBadge } from './achievements.mjs';
import { CONFIG } from './config.mjs';
import { STATUSES,TYPES,SCHEMA,money,percent,today,validateLead,memberStats,badgeAsset } from './domain.mjs';
import { SheetsRepository,initGoogle,login,signOut } from './google.mjs';
const root=document.querySelector('#root'),dialog=document.querySelector('#editor');
const demo=['localhost','127.0.0.1','[::1]'].includes(location.hostname)&&new URLSearchParams(location.search).get('demo')==='1';
let badgeMember='',repo,data,user,view='pipeline',listView=false,query='',typeFilter='',ownerFilter='',month=today().slice(0,7),loading=false,saving=false,connected=false,timer,session=0,toastTimer;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons={grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',funnel:'M3 4h18L14 12v7l-4 2v-9z',users:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 3a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',award:'M12 14a6 6 0 1 0 0-12 6 6 0 0 0 0 12 M8 13l-1 9 5-3 5 3-1-9',sheet:'M5 2h10l4 4v16H5z M15 2v5h4 M8 11h8 M8 15h8 M8 19h8',search:'M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',plus:'M12 5v14 M5 12h14',list:'M8 6h13 M8 12h13 M8 18h13 M3 6h1 M3 12h1 M3 18h1',board:'M4 4h4v16H4z M10 4h4v10h-4z M16 4h4v13h-4z',out:'M9 3H4v18h5 M10 12h11 M17 8l4 4-4 4',refresh:'M20 8a8 8 0 0 0-14-3L3 8 M3 3v5h5 M4 16a8 8 0 0 0 14 3l3-3 M21 21v-5h-5',calendar:'M3 5h18v16H3z M7 2v6 M17 2v6 M3 11h18'};
const icon=name=>`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[name]||icons.grid}"/></svg>`;
const initials=name=>String(name||'?').replace(/\([^)]*\)/g,'').trim().split(/[\s@]+/).slice(0,2).map(s=>s[0]).join('').toUpperCase();
const active=()=>activeLeads(data.Leads);
const statsFor=(m)=>commercialStats(data.Leads,data.Equipe,m,month);
const member=email=>data.Equipe.find(m=>m.email===email)||{email,nome:email||'Sem responsável',comissao:CONFIG.defaultCommission,nivel:1};
const cherries=n=>`<span class="cherries" aria-label="${Number(n)||0} de 5 cerejas">${[1,2,3,4,5].map(i=>`<img alt="" src="./assets/cherry.svg" class="${i<=n?'':'empty'}">`).join('')}</span>`;
const dateLabel=value=>value?new Date(value+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}):'—';
function toast(message){const el=document.querySelector('#toast');el.textContent=message;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),6500);}
function status(text,state='ok'){const el=document.querySelector('#sync');if(el){el.textContent=text;el.dataset.state=state;}}
function members(){return [...new Set([...data.Equipe.map(m=>m.email),...data.Leads.flatMap(l=>[l.responsavel,l.gerente]).filter(Boolean),user.email])].map(member);}
function loginScreen(message='',denied=false){
  root.innerHTML=`<main class="login" id="main"><img class="brand" src="./assets/logo.svg" alt="Cejera"><section class="login-box ${denied?'error':''}"><div class="eyebrow">Cejera / Interno</div><h1>${denied?'Acesso não autorizado.':'Seu próximo contato começa aqui.'}</h1><p>${denied?'Esta conta não tem acesso à planilha do CRM. Peça a Cejera para compartilhar a planilha com seu e-mail.':'Entre com sua conta Google para acessar leads, metas e conquistas da equipe.'}</p>${message?`<p class="${denied?'error-text':'muted'}">${esc(message)}</p>`:''}<button class="primary" id="google-login"><span class="google-mark" aria-hidden="true">G</span>${denied?'Usar outra conta':'Entrar com Google'}</button><p class="note">O acesso é definido pelo compartilhamento da planilha.</p></section><div class="login-footer">cejera.com / espaço da equipe</div></main>`;
  document.querySelector('#google-login').onclick=()=>authenticate(false,denied);
}
function lock(message,denied=false){session++;connected=false;clearTimeout(timer);repo?.destroy();repo=null;data=null;user=null;dialog.close();dialog.innerHTML='';signOut();loginScreen(message,denied);}
async function authenticate(silent=false,select=false){
  const button=document.querySelector('#google-login');if(button)button.disabled=true;
  try{await login(silent,select);repo=new SheetsRepository();data=await repo.connect();user=repo.user;connected=true;session++;render();schedule();}
  catch(error){repo?.destroy();repo=null;signOut();loginScreen(error.message,error.status===403||error.status===404);}
}
function schedule(delay=CONFIG.pollMs){clearTimeout(timer);if(connected&&!demo)timer=setTimeout(refresh,delay);}
async function refresh(manual=false){
  if(!connected||loading||saving){schedule();return;}
  if(document.hidden&&!manual){schedule();return;}
  const current=session;loading=true;status('Sincronizando…','busy');
  try{const next=await repo.load();if(current!==session)return;const changed=JSON.stringify(data)!==JSON.stringify(next);data=next;if(changed)render();status('Planilha atualizada');}
  catch(error){if(current!==session)return;if([401,403,404].includes(error.status)){lock(error.message,error.status!==401);return;}status('Sem sincronização','error');if(manual)toast(error.message);schedule(error.status===429?60000:30000);return;}
  finally{loading=false;}
  schedule();
}
function render(){
  const title={overview:'Visão geral',pipeline:'Funil de vendas',team:'Equipe e metas',badges:'Conquistas',trash:'Lixeira'}[view];
  root.innerHTML=`${demo?'<div class="demo-strip"><strong>DEMONSTRAÇÃO</strong> · Dados fictícios. As alterações ficam apenas nesta sessão.</div>':''}<div class="app"><aside class="sidebar"><div><img class="brand" src="./assets/logo.svg" alt="Cejera"><div class="space-label">INTERNO</div></div><nav aria-label="Navegação principal">${[['overview','grid','Visão geral'],['pipeline','funnel','Funil de vendas'],['team','users','Equipe e metas'],['badges','award','Conquistas'],['trash','out','Lixeira']].map(([key,ico,label])=>`<button class="nav-button ${view===key?'active':''}" data-view="${key}" ${view===key?'aria-current="page"':''}>${icon(ico)}${label}</button>`).join('')}</nav><div class="sidebar-bottom"><a class="sheet-link" href="https://docs.google.com/spreadsheets/d/${esc(CONFIG.spreadsheetId)}/edit" target="_blank" rel="noopener noreferrer">${icon('sheet')}Abrir planilha ↗</a><div class="user"><span class="avatar">${esc(initials(member(user.email).nome))}</span><div class="user-info"><strong>${esc(member(user.email).nome)}</strong><small>${esc(repo.role)}</small></div><button class="quiet small" id="logout" aria-label="Sair">${icon('out')}</button></div></div></aside><div class="main-wrap"><header class="topbar"><div class="breadcrumb"><span>Interno /</span>${title}</div><div style="display:flex;align-items:center;gap:12px"><span class="sync" id="sync" data-state="ok">${demo?'Modo de demonstração':'Planilha atualizada'}</span><button class="quiet small" id="refresh" aria-label="Atualizar planilha">${icon('refresh')}</button></div></header><main id="main" class="workspace"></main></div></div>`;
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;render();});
  document.querySelector('#logout').onclick=()=>{if(demo){location.href='./';return;}lock('Você saiu do CRM.');};
  document.querySelector('#refresh').onclick=()=>refresh(true);
  renderContent();
}
function heading(title,description,action=''){return `<div class="page-heading"><div><h1>${title}</h1><p>${description}</p></div>${action}</div>`;}
function metrics(items){return `<div class="metrics">${items.map(([label,value,note])=>`<div class="metric"><span class="metric-label">${label}</span><strong>${value}</strong><small>${note}</small></div>`).join('')}</div>`;}
function renderContent(){
  if(!connected)return;
  const el=document.querySelector('#main');if(!el)return;
  const scroll=el.querySelector('.board-scroll')?.scrollLeft||0;
  const oldFocus=document.activeElement?.id,selection=oldFocus==='search'?document.activeElement.selectionStart:null;
  el.innerHTML=(!repo.canEdit?'<div class="notice">Você tem acesso de leitura. Para editar leads, peça acesso de editor na planilha.</div>':'')+({pipeline:renderPipeline,overview:renderOverview,team:renderTeam,badges:renderBadges,trash:renderTrash}[view])();
  el.querySelectorAll('[data-new]').forEach(b=>b.onclick=()=>leadEditor(null,b.dataset.new));
  el.querySelectorAll('[data-lead]').forEach(b=>b.onclick=()=>leadEditor(data.Leads.find(l=>(l.id||'row-'+l._row)===b.dataset.lead)));
  if(el.querySelector('#search'))el.querySelector('#search').oninput=e=>{query=e.target.value;renderContent();};
  for(const [id,fn] of [['type-filter',v=>typeFilter=v],['owner-filter',v=>ownerFilter=v],['badge-member',v=>badgeMember=v],['month',v=>{if(/^\d{4}-\d{2}$/.test(v))month=v;}]])if(el.querySelector('#'+id))el.querySelector('#'+id).onchange=e=>{fn(e.target.value);renderContent();};
  el.querySelectorAll('[data-layout]').forEach(b=>b.onclick=()=>{listView=b.dataset.layout==='list';renderContent();});
  if(el.querySelector('#sync-permissions'))el.querySelector('#sync-permissions').onclick=syncPermissions;
  el.querySelectorAll('[data-member]').forEach(b=>b.onclick=()=>memberEditor(b.dataset.member));
  el.querySelectorAll('[data-goal]').forEach(b=>b.onclick=()=>goalEditor(b.dataset.goal));
  el.querySelectorAll('[data-award]').forEach(b=>b.onclick=()=>awardEditor(b.dataset.award));
  el.querySelectorAll('[data-badge]').forEach(b=>b.onclick=()=>badgeEditor(b.dataset.badge));
  el.querySelectorAll('[data-restore]').forEach(b=>b.onclick=()=>restoreEditor(b.dataset.restore));
  el.querySelectorAll('[data-shift]').forEach(b=>b.onclick=()=>shiftLead(b.dataset.id,Number(b.dataset.shift)));
  el.querySelectorAll('.lead-card').forEach(card=>{
    card.ondragstart=e=>{const lead=data.Leads.find(l=>l.id===card.dataset.lead);if(!repo.canStage(lead)){e.preventDefault();return;}e.dataTransfer.setData('text/plain',card.dataset.lead);e.dataTransfer.effectAllowed='move';};
    card.ondragover=e=>{if(repo.permissions.manageLeads)e.preventDefault();};
    card.ondrop=async e=>{if(!repo.permissions.manageLeads)return;e.preventDefault();e.stopPropagation();const id=e.dataTransfer.getData('text/plain');if(id!==card.dataset.lead)await reorderLead(id,card.dataset.lead);};
  });
  el.querySelectorAll('[data-status]').forEach(col=>{col.ondragover=e=>{e.preventDefault();col.classList.add('over');};col.ondragleave=()=>col.classList.remove('over');col.ondrop=async e=>{e.preventDefault();col.classList.remove('over');const lead=data.Leads.find(l=>l.id===e.dataTransfer.getData('text/plain'));if(lead)await moveLead(lead,col.dataset.status);};});
  if(el.querySelector('.board-scroll'))el.querySelector('.board-scroll').scrollLeft=scroll;
  if(oldFocus==='search'&&el.querySelector('#search')){el.querySelector('#search').focus();el.querySelector('#search').setSelectionRange(selection,selection);}
}
function renderPipeline(){
  const open=active().filter(l=>l.status!=='Fechado'),won=active().filter(l=>l.status==='Fechado'),revenue=won.reduce((s,l)=>s+Number(l.valor||0),0);
  const results=orderedLeads(active()).filter(l=>(!query||[l.nome,l.email,l.telefone,l.descricao].some(v=>String(v).toLowerCase().includes(query.toLowerCase())))&&(!typeFilter||l.tipo===typeFilter)&&(!ownerFilter||l.responsavel===ownerFilter||l.gerente===ownerFilter));
  const unknown=results.filter(l=>!STATUSES.includes(l.status));
  return heading('Funil de vendas','Cada conversa, um próximo passo.',repo.permissions.manageLeads?`<button class="primary" data-new="Lead novo">${icon('plus')} Novo lead</button>`:'')+metrics([['LEADS NO FUNIL',open.length,'Em todos os estágios abertos'],['EM NEGOCIAÇÃO',money(open.reduce((s,l)=>s+Number(l.valor||0),0)),'Valor potencial'],['VENDAS FECHADAS',money(revenue),`${won.length} ${won.length===1?'conversão':'conversões'}`],['CONVERSÃO GERAL',percent(active().length?won.length/active().length:0),'Fechados / total de leads']])+`<div class="toolbar"><label class="search">${icon('search')}<input id="search" aria-label="Buscar leads" placeholder="Buscar nome, telefone, e-mail…" value="${esc(query)}"></label><select id="type-filter" aria-label="Filtrar por tipo"><option value="">Todos os tipos</option>${TYPES.map(t=>`<option ${t===typeFilter?'selected':''}>${t}</option>`).join('')}</select><select id="owner-filter" aria-label="Filtrar responsável"><option value="">Toda a equipe</option>${members().map(m=>`<option value="${esc(m.email)}" ${m.email===ownerFilter?'selected':''}>${esc(m.nome)}</option>`).join('')}</select><div class="view-toggle" aria-label="Visualização"><button data-layout="board" class="${!listView?'selected':''}" aria-label="Visualização em funil" aria-pressed="${!listView}">${icon('board')}</button><button data-layout="list" class="${listView?'selected':''}" aria-label="Visualização em lista" aria-pressed="${listView}">${icon('list')}</button></div></div>${unknown.length?`<div class="notice">${unknown.length} lead(s) com status inválido na planilha. Abra a visualização em lista para corrigir.</div>`:''}`+(listView?leadTable(results):`<div class="board-scroll"><div class="board">${STATUSES.map((s,i)=>{const group=results.filter(l=>l.status===s);return `<section class="column" data-status="${s}" aria-label="${s}"><h2 class="column-title">${s}<span>${group.length}</span></h2><div class="column-total">${money(group.reduce((n,l)=>n+Number(l.valor||0),0))}</div>${group.length?group.map(card).join(''):'<p class="empty-column">Nenhum lead por aqui.</p>'}${repo.permissions.manageLeads?`<button class="add-column" data-new="${s}">+ Adicionar lead</button>`:''}</section>`;}).join('')}</div></div><p class="note">${repo.permissions.manageLeads?'Arraste para mudar a etapa ou a ordem. Use as setas para reordenar com teclado ou no celular.':'Vendedores podem mudar a fase dos próprios leads; atribuições e demais campos ficam com os gestores.'}</p>`);
}
function card(l){return `<article class="lead-tile"><button class="lead-card" draggable="${repo.canStage(l)}" data-lead="${esc(l.id||'row-'+l._row)}"><div class="card-top"><span class="chip">${esc(l.tipo)}</span>${cherries(l.qualidade)}</div><h3>${esc(l.nome)}</h3><p class="description">${esc(l.descricao||'Adicione um contexto para a próxima conversa.')}</p><div class="card-bottom"><strong>${money(l.valor)}</strong><span class="initial" title="${esc(member(l.responsavel).nome)}">${esc(initials(member(l.responsavel).nome))}</span></div><div class="assignments"><span>V: ${esc(member(l.responsavel).nome)}</span><span>G: ${esc(member(l.gerente).nome)}</span></div>${l.proximo_contato&&l.status!=='Fechado'?`<div class="followup ${l.proximo_contato<today()?'overdue':''}">${icon('calendar')}${l.proximo_contato===today()?'Contato hoje':dateLabel(l.proximo_contato)}</div>`:''}<div class="creation-stamp"><time>${esc(creationDateLabel(l.criado_em))}</time><span>Criado por ${esc(l.criado_por?member(l.criado_por).nome:'autor não registrado')}</span></div></button>${repo.permissions.manageLeads?`<div class="reorder-controls"><button class="quiet small" data-shift="-1" data-id="${esc(l.id)}" aria-label="Mover ${esc(l.nome)} para cima">↑</button><button class="quiet small" data-shift="1" data-id="${esc(l.id)}" aria-label="Mover ${esc(l.nome)} para baixo">↓</button></div>`:''}</article>`;}
function leadTable(leads){return `<div class="table-wrap"><table><thead><tr><th>Nome</th><th>Qualidade</th><th>Tipo</th><th>Etapa</th><th>Vendedor</th><th>Gerente</th><th>Valor</th><th>Próximo contato</th></tr></thead><tbody>${leads.length?leads.map(l=>`<tr><td class="name-cell"><button data-lead="${esc(l.id||'row-'+l._row)}">${esc(l.nome)}</button></td><td>${cherries(l.qualidade)}</td><td>${esc(l.tipo)}</td><td><span class="status-tag ${l.status==='Fechado'?'won':''}">${esc(l.status)}</span></td><td>${esc(member(l.responsavel).nome)}</td><td>${esc(member(l.gerente).nome)}</td><td>${money(l.valor)}</td><td>${dateLabel(l.proximo_contato)}</td></tr>`).join(''):'<tr><td colspan="8" class="empty-state">Nenhum lead encontrado.</td></tr>'}</tbody></table></div>`;}
function monthControl(){return `<div class="toolbar"><label for="month" class="muted">Mês de referência</label><input class="month-picker" id="month" type="month" value="${esc(month)}" aria-label="Mês de referência"></div>`;}
function renderOverview(){
  const all=members().map(m=>statsFor(m)),closed=active().filter(l=>l.status==='Fechado'&&l.fechado_em.startsWith(month));const revenue=closed.reduce((s,l)=>s+Number(l.valor||0),0),count=closed.length,commission=all.reduce((s,m)=>s+m.commission,0),goals=data.Metas.filter(m=>m.mes===month),target=goals.reduce((s,m)=>s+Number(m.faturamento||0),0);
  const due=active().filter(l=>l.status!=='Fechado'&&l.proximo_contato).sort((a,b)=>a.proximo_contato.localeCompare(b.proximo_contato)).slice(0,8);
  return heading('Visão geral','O movimento da Cejera, em um só lugar.')+monthControl()+metrics([['FATURAMENTO NO MÊS',money(revenue),`${count} vendas fechadas`],['META DA EQUIPE',money(target),target?percent(revenue/target)+' alcançado':'Defina as metas dos membros'],['DISTRIBUIÇÃO ESTIMADA',money(commission),'Cejera + gerente + vendedor'],['LEADS CADASTRADOS',active().length,'Todos os períodos']])+`<div class="two-panels"><section class="panel"><div class="panel-heading"><h2>Distribuição no funil</h2>${icon('funnel')}</div><div class="trend-bars">${STATUSES.map(s=>{const n=active().filter(l=>l.status===s).length;return `<div class="trend-row"><span>${s}</span><div class="trend-track"><div style="width:${active().length?n/active().length*100:0}%"></div></div><strong>${n}</strong></div>`;}).join('')}</div><span class="handwritten">O próximo passo importa.</span></section><section class="panel"><div class="panel-heading"><h2>Próximos contatos</h2>${icon('calendar')}</div>${due.length?due.map(l=>`<div class="followup-row"><div><button data-lead="${esc(l.id||'row-'+l._row)}">${esc(l.nome)}</button><small>${esc(member(l.responsavel).nome)}</small></div><span class="date ${l.proximo_contato<today()?'error-text':''}">${l.proximo_contato===today()?'Hoje':dateLabel(l.proximo_contato)}</span></div>`).join(''):'<p class="note">Agende o próximo contato ao editar um lead.</p>'}</section></div>`;
}
function renderTeam(){return heading('Equipe e metas','Objetivos claros. Espaço para crescer.',repo.admin?'<div class="heading-actions"><button id="sync-permissions" class="small">Aplicar permissões</button><button class="primary" data-member="">+ Cadastrar membro</button></div>':'')+monthControl()+`<div class="team-grid">${members().map(m=>{const stats=statsFor(m),goal=data.Metas.find(g=>g.email===m.email&&g.mes===month),target=Number(goal?.faturamento||0),qty=Number(goal?.vendas||0);return `<article class="member-card"><div class="member-top"><span class="avatar">${esc(initials(m.nome))}</span><div><h3>${esc(m.nome)}</h3><p>${esc(m.email)}</p><small class="role-label">${esc(roleFor(m.email,data.Equipe))}</small></div><span class="level">Nível ${esc(m.nivel||1)}</span></div><div class="progress-label"><span>Faturamento</span><strong>${target?percent(stats.revenue/target):'Sem meta'}</strong></div><div class="progress" role="progressbar" aria-label="Meta de faturamento de ${esc(m.nome)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${target?Math.min(100,Math.round(stats.revenue/target*100)):0}"><div style="width:${target?Math.min(100,stats.revenue/target*100):0}%"></div></div><p class="note">${money(stats.revenue)} ${target?'de '+money(target):'no mês'}</p><div class="progress-label"><span>Vendas fechadas</span><strong>${stats.won}${qty?' / '+qty:''}</strong></div><div class="progress"><div style="width:${qty?Math.min(100,stats.won/qty*100):0}%"></div></div><div class="member-stats"><div><small>Comissão estimada</small><strong>${money(stats.commission)}</strong></div><div><small>Taxa por conversão</small><strong>${m.email===CONFIG.ownerEmail?'Saldo até 100%':percent(stats.rate)}</strong></div></div><div class="heading-actions">${repo.permissions.Metas?`<button class="small" data-goal="${esc(m.email)}">Definir meta</button>`:''}${repo.permissions.Equipe?`<button class="small" data-member="${esc(m.email)}">Editar perfil</button>`:''}</div></article>`;}).join('')}</div><p class="note">Cada venda é distribuída entre vendedor, gerente e Cejera. A participação de Cejera é o saldo para fechar 100%; quando ele também é gerente ou vendedor, essas parcelas são reunidas. Alterar as taxas na planilha recalcula as estimativas de todos os períodos. Pagamentos e bônus são gerenciados fora deste cálculo.</p>${repo.admin?'<p class="note">Compartilhe a planilha com o e-mail do membro para liberar o acesso. Ao editar um perfil aqui, a permissão é aplicada junto com o salvamento. Se mudar os cargos diretamente na planilha, clique em Aplicar permissões.</p>':''}`;}
function renderBadges(){
  const canManage=repo.permissions.Conquistas, selected=canManage?(badgeMember||user.email):user.email;
  const stats=achievementStats(data.Leads,data.Metas,selected), mine=data.Conquistas.filter(a=>a.email===selected);
  const eligible=data.Badges.filter(b=>badgeProgress(b,stats).eligible&&!mine.some(a=>a.badge_id===b.id)).length;
  return heading('Conquistas','As cartas do Clubinho, agora com uma história de vendas.')+
    `<div class="toolbar"><label for="badge-member" class="muted">Coleção de</label>${canManage?`<select id="badge-member">${members().map(m=>`<option value="${esc(m.email)}" ${m.email===selected?'selected':''}>${esc(m.nome)}</option>`).join('')}</select>`:`<strong>${esc(member(selected).nome)}</strong>`}<span class="note">${mine.length} conquistadas · ${eligible} prontas para reconhecimento</span></div><p class="note">O progresso acompanha a planilha. Ao atingir um objetivo, Admin ou Gerente pode conceder a carta. Vendas com valor positivo e data de fechamento válida contam para os desafios.</p><div class="badge-grid">${data.Badges.map(b=>{
      const own=mine.find(a=>a.badge_id===b.id), progress=badgeProgress(b,stats);
      return `<article class="badge-card ${own?'earned':progress.eligible?'eligible':'locked'}"><span class="rarity">${esc(b.raridade||'Conquista')}</span><img src="${badgeAsset(b.imagem)}" alt="${esc(b.nome)}" loading="lazy"><h3>${esc(b.nome)}</h3><p>${esc(b.descricao)}</p><small>${esc(METRICS[b.metrica]||'Critério não configurado')}</small><div class="progress" role="progressbar" aria-label="Progresso em ${esc(b.nome)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress.percentage}"><div style="width:${progress.percentage}%"></div></div><div class="badge-count">${metricValue(b.metrica,progress.current)} / ${metricValue(b.metrica,progress.target)}</div><p class="badge-state">${own?'Conquistada em '+dateLabel(own.concedido_em):progress.eligible?'Objetivo alcançado':'Em progresso'}</p>${own?.mensagem?`<p class="note">${esc(own.mensagem)}</p>`:''}<div class="badge-actions">${canManage&&!own?`<button class="small ${progress.eligible?'primary':''}" data-award="${esc(b.id)}">Conceder</button>`:''}${repo.permissions.Badges?`<button class="small quiet" data-badge="${esc(b.id)}">Editar</button>`:''}</div></article>`;
    }).join('')}</div>`;
}
function field(label,name,value='',type='text',extra=''){return `<label class="field">${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;}
function options(values,current){return values.map(v=>`<option value="${esc(v)}" ${String(v)===String(current)?'selected':''}>${esc(v)}</option>`).join('');}
function showDialog(title,body,onSubmit,readOnly=false){
  dialog.innerHTML=`<form id="edit-form" class="${readOnly?'read-only':''}"><div class="dialog-head"><h2 id="dialog-title">${title}</h2><button type="button" class="quiet" data-close aria-label="Fechar">×</button></div><div class="dialog-body">${body}<p id="form-error" class="error-text" role="alert"></p></div><div class="dialog-footer"><span></span><div><button type="button" data-close>${readOnly?'Fechar':'Cancelar'}</button>${!readOnly?'<button type="submit" class="primary">Salvar alterações</button>':''}</div></div></form>`;
  dialog.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>{if(!saving)dialog.close();});
  if(readOnly)dialog.querySelectorAll('input,select,textarea').forEach(el=>el.disabled=true);
  dialog.querySelector('form').onsubmit=async e=>{e.preventDefault();if(saving)return;const button=e.submitter;button.disabled=true;try{await onSubmit(new FormData(e.target));dialog.close();}catch(error){const err=dialog.querySelector('#form-error');if(err)err.textContent=error.message;}finally{button.disabled=false;}};
  dialog.showModal();
}
function splitPanel(lead){
  try{return `<div class="split-panel"><strong>Distribuição da venda · 100%</strong>${commissionSplit(lead,data.Equipe).map(p=>`<div><span>${esc(member(p.email).nome)} · ${p.papel}</span><b>${percent(p.rate)} · ${money(p.amount)}</b></div>`).join('')}<small>Percentuais atuais. Centavos fracionados ficam na parcela de Cejera.</small></div>`;}
  catch(error){return `<p class="notice">${esc(error.message)}</p>`;}
}
function leadEditor(base=null,stage='Lead novo'){
  const manager=repo.permissions.manageLeads;
  if(!base&&!manager)return;
  const seller=members().find(m=>roleFor(m.email,data.Equipe)==='Vendedor')?.email||user.email;
  const l=base?structuredClone(base):{id:crypto.randomUUID(),nome:'',telefone:'',email:'',descricao:'',qualidade:3,tipo:'Marca',status:stage,responsavel:seller,gerente:user.email,valor:0,fechado_em:'',proximo_contato:'',criado_em:new Date().toISOString(),ordem:rankBetween(orderedLeads(active().filter(l=>l.status===stage)).at(-1),null)};
  const canStage=base?repo.canStage(base):manager;
  const contacts=[l.telefone?`<a href="tel:${esc(String(l.telefone).replace(/[^+\d]/g,''))}">Ligar</a>`:'',l.telefone?`<a href="https://wa.me/${esc(String(l.telefone).replace(/\D/g,''))}" target="_blank" rel="noopener noreferrer">WhatsApp ↗</a>`:'',l.email?`<a href="mailto:${esc(l.email)}">Enviar e-mail</a>`:''].join('');
  const selectMember=(name,label,current,managers=false)=>`<label class="field">${label}<select name="${name}" required><option value="">Escolha um membro</option>${members().filter(m=>!managers||['Admin','Gerente'].includes(roleFor(m.email,data.Equipe))).map(m=>`<option value="${esc(m.email)}" ${m.email===current?'selected':''}>${esc(m.nome)}</option>`).join('')}</select></label>`;
  showDialog(base?'Detalhes do lead':'Novo lead',`${contacts?`<div class="contact-links">${contacts}</div>`:''}${!manager?'<p class="notice">Você pode alterar somente a fase dos leads atribuídos a você.</p>':''}<div class="form-grid">${field('Nome *','nome',l.nome,'text','required maxlength="200"')}${field('Telefone (com país e DDD)','telefone',l.telefone,'tel','maxlength="60"')}${field('E-mail','email',l.email,'email','maxlength="254"')}<label class="field">Tipo<select name="tipo">${options(TYPES,l.tipo)}</select></label><label class="field full">Descrição<textarea name="descricao" maxlength="10000">${esc(l.descricao)}</textarea></label><div class="field full"><span>Qualidade do lead</span><input type="hidden" name="qualidade" value="${Number(l.qualidade)||3}"><div class="rating-input" role="group" aria-label="Qualidade em cerejas">${[1,2,3,4,5].map(n=>`<button type="button" data-rating="${n}" aria-label="${n} cerejas" aria-checked="${n<=l.qualidade}" ${!manager?'disabled':''}><img src="./assets/cherry.svg" alt=""></button>`).join('')}</div></div><label class="field">Etapa<select name="status">${options(STATUSES,l.status)}</select></label>${selectMember('responsavel','Vendedor responsável *',l.responsavel)}${selectMember('gerente','Gerente responsável *',l.gerente,true)}${field('Valor da venda (R$)','valor',l.valor,'number','min="0" max="1000000000000" step="0.01"')}${field('Próximo contato','proximo_contato',l.proximo_contato,'date')}${field('Data de fechamento','fechado_em',l.fechado_em,'date')}</div><p class="note">Criação: ${esc(creationDateLabel(l.criado_em))} · ${esc(l.criado_por||'Autor não registrado')}</p><div id="commission-preview">${splitPanel(l)}</div>${base&&manager?'<button type="button" id="archive-lead" class="danger">Excluir lead → Lixeira</button>':''}`,async form=>{
    const record=manager?validateLead({...l,...Object.fromEntries(form),id:l.id||crypto.randomUUID(),criado_em:l.criado_em||new Date().toISOString(),atualizado_em:new Date().toISOString()}):stageChange(base,form.get('status'));
    await save('Leads',record,base);
  },!manager&&!canStage);
  if(!manager)dialog.querySelectorAll('input,select,textarea').forEach(el=>el.disabled=el.name!=='status'||!canStage);
  dialog.querySelectorAll('[data-rating]').forEach(b=>b.onclick=()=>{dialog.querySelector('[name=qualidade]').value=b.dataset.rating;dialog.querySelectorAll('[data-rating]').forEach(x=>x.setAttribute('aria-checked',Number(x.dataset.rating)<=Number(b.dataset.rating)));});
  const stageSelect=dialog.querySelector('[name=status]'),closed=dialog.querySelector('[name=fechado_em]');
  const updateDate=()=>{closed.disabled=!manager||stageSelect.value!=='Fechado';closed.required=manager&&stageSelect.value==='Fechado';if(stageSelect.value==='Fechado'&&!closed.value)closed.value=today();};stageSelect.addEventListener('change',updateDate);updateDate();
  for(const name of ['responsavel','gerente','valor'])dialog.querySelector('[name='+name+']').addEventListener('input',()=>{const record={...l,...Object.fromEntries(new FormData(dialog.querySelector('form')))};dialog.querySelector('#commission-preview').innerHTML=splitPanel(record);});
  const archive=dialog.querySelector('#archive-lead');if(archive)archive.onclick=()=>{dialog.close();archiveEditor(base);};
}
async function moveLead(base,statusName){
  if(!repo.canStage(base))return;
  if(!repo.permissions.manageLeads&&base.status===statusName)return;
  try{const record=stageChange(base,statusName);if(repo.permissions.manageLeads)record.ordem=rankBetween(orderedLeads(active().filter(l=>l.status===statusName&&l.id!==base.id)).at(-1),null);await save('Leads',record,base);}catch(e){toast(e.message);}
}
async function reorderLead(id,beforeId){
  if(!repo.permissions.manageLeads)return;
  const lead=data.Leads.find(l=>l.id===id),target=data.Leads.find(l=>l.id===beforeId);if(!lead||!target)return;
  const group=orderedLeads(active().filter(l=>l.status===target.status&&l.id!==id)),index=group.findIndex(l=>l.id===beforeId);
  try{await save('Leads',{...stageChange(lead,target.status),ordem:rankBetween(group[index-1],target)},lead);}catch(error){toast(error.message);}
}
async function shiftLead(id,direction){
  const lead=data.Leads.find(l=>l.id===id);if(!lead||!repo.permissions.manageLeads)return;
  const group=orderedLeads(active().filter(l=>l.status===lead.status)),index=group.findIndex(l=>l.id===id);
  if(direction<0&&index>0)return reorderLead(id,group[index-1].id);
  if(direction>0&&index<group.length-1){if(group[index+2])return reorderLead(id,group[index+2].id);return moveLead(lead,lead.status);}
}
function archiveEditor(lead){
  showDialog('Mover para a lixeira',`<p><strong>${esc(lead.nome)}</strong></p><p>O valor da venda será zerado e o lead sairá do funil, das metas e das comissões. Os dados ficarão guardados para restauração.</p>`,async()=>await save('Leads',archiveLead(lead),lead));
}
function renderTrash(){
  const rows=data.Leads.filter(l=>l.excluido_em||l.status==='Lixeira');
  return heading('Lixeira','Leads guardados para restaurar ou reutilizar em outra campanha.')+`<div class="table-wrap"><table><thead><tr><th>Lead</th><th>Vendedor / gerente</th><th>Valor anterior</th><th>Excluído em</th><th></th></tr></thead><tbody>${rows.length?rows.map(l=>`<tr><td>${esc(l.nome)}</td><td>${esc(member(l.responsavel).nome)} / ${esc(member(l.gerente).nome)}</td><td>${money(l.valor_anterior)}</td><td>${dateLabel(String(l.excluido_em).slice(0,10))}</td><td>${repo.permissions.manageLeads?`<button class="small" data-restore="${esc(l.id)}">Restaurar</button>`:''}</td></tr>`).join(''):'<tr><td colspan="5" class="empty-state">Nenhum lead na lixeira.</td></tr>'}</tbody></table></div><p class="note">Os registros desta área têm valor ativo zero. Não há exclusão definitiva pelo CRM.</p>`;
}
function restoreEditor(id){
  const lead=data.Leads.find(l=>l.id===id);if(!lead||!repo.permissions.manageLeads)return;
  showDialog('Restaurar lead',`<p><strong>${esc(lead.nome)}</strong></p><label class="field">Como restaurar<select name="modo"><option value="original">Recuperar etapa e valor anteriores</option><option value="campanha">Nova campanha: Lead novo e valor zero</option></select></label>`,async form=>await save('Leads',restoreLead(lead,form.get('modo')==='campanha'),lead));
}
function memberEditor(email){if(!repo.permissions.Equipe)return;const base=data.Equipe.find(m=>m.email===email),m=base||member(email);
  showDialog(email?'Editar perfil':'Cadastrar membro',`<div class="form-grid">${field('Nome','nome',email?m.nome:'','text','required maxlength="120"')}${field('E-mail Google','email',email,'email',`required ${base?'readonly':''}`)}${field('Comissão por conversão (%)','comissao',Number(m.comissao??.04)*100,'number','required min="0" max="100" step="0.01"')}${field('Nível do vendedor','nivel',m.nivel||1,'number','required min="1" max="999" step="1"')}<label class="field full">Permissão<select name="permissao" ${email===CONFIG.ownerEmail?'disabled':''}>${options(ROLES,roleFor(email,data.Equipe))}</select></label></div><p class="note">Admin gerencia tudo. Gerente define metas e concede cartas. Vendedor altera somente a fase dos seus leads e acompanha o progresso. A liberação de acesso é feita em Compartilhar na planilha; a taxa aplica-se às estimativas de todos os períodos.</p>`,async form=>{
    const input=Object.fromEntries(form);input.comissao=Number(input.comissao)/100;
    const record=validateMember(input);await save('Equipe',record,base);
  });
}
async function syncPermissions(){
  if(saving||!repo.admin)return;saving=true;clearTimeout(timer);status('Aplicando permissões…','busy');
  try{data=await repo.syncPermissions();render();toast('Permissões das abas atualizadas.');}
  catch(error){toast(error.message);status('Confira as permissões','error');}
  finally{saving=false;schedule();}
}
function goalEditor(email){if(!repo.permissions.Metas)return;const base=data.Metas.find(m=>m.email===email&&m.mes===month);showDialog('Definir meta mensal',`<p class="note">${esc(member(email).nome)} / ${esc(month)}</p><div class="form-grid">${field('Meta de faturamento (R$)','faturamento',base?.faturamento||0,'number','required min="0" max="1000000000000" step="0.01"')}${field('Meta de vendas','vendas',base?.vendas||0,'number','required min="0" max="1000000" step="1"')}</div>`,async form=>{const faturamento=Number(form.get('faturamento')),vendas=Number(form.get('vendas'));if(!Number.isFinite(faturamento)||faturamento<0||!Number.isInteger(vendas)||vendas<0)throw new Error('Confira as metas.');await save('Metas',{id:base?.id||month+':'+email,email,mes:month,faturamento,vendas},base);});}
function awardEditor(id){
  if(!repo.permissions.Conquistas)return;const badge=data.Badges.find(b=>b.id===id),email=badgeMember||user.email;
  const progress=badgeProgress(badge,achievementStats(data.Leads,data.Metas,email));
  showDialog('Conceder conquista',`<div style="text-align:center"><img src="${badgeAsset(badge.imagem)}" alt="" width="115"><h3>${esc(badge.nome)}</h3><p>${esc(member(email).nome)}</p></div><p class="notice">${progress.eligible?'Objetivo alcançado. Este reconhecimento ficará registrado na coleção.':'O objetivo ainda não foi alcançado. Para conceder por reconhecimento especial, registre o motivo.'}</p><label class="field">Mensagem${!progress.eligible?' / motivo obrigatório':''}<textarea name="mensagem" maxlength="1000" ${progress.eligible?'':'required'} placeholder="O que este reconhecimento celebra?"></textarea></label>`,async form=>{
    if(data.Conquistas.some(a=>a.email===email&&a.badge_id===id))throw new Error('Este membro já tem essa conquista.');
    const mensagem=String(form.get('mensagem')||'').trim();
    if(!progress.eligible&&!mensagem)throw new Error('Informe o motivo do reconhecimento especial.');
    await save('Conquistas',{id:email+':'+id,email,badge_id:id,concedido_em:today(),mensagem});
  });
}
function badgeEditor(id){
  if(!repo.permissions.Badges)return;const base=data.Badges.find(b=>b.id===id);
  showDialog('Editar conquista',`<div class="form-grid">${field('Nome','nome',base.nome,'text','required maxlength="100"')}<label class="field">Raridade<select name="raridade">${options(RARITIES,base.raridade)}</select></label><label class="field full">Descrição<textarea name="descricao" maxlength="500">${esc(base.descricao)}</textarea></label><label class="field">Estatística<select name="metrica">${Object.entries(METRICS).map(([key,label])=>`<option value="${key}" ${key===base.metrica?'selected':''}>${esc(label)}</option>`).join('')}</select></label>${field('Objetivo','objetivo',base.objetivo,'number','required min="0.01" max="1000000000000" step="any"')}</div><p class="note">Alterar o critério recalcula o progresso. Cartas já concedidas permanecem na coleção.</p>`,async form=>await save('Badges',validateBadge({...base,...Object.fromEntries(form)}),base));
}
async function save(name,record,base){
  if(saving)throw new Error('Aguarde o salvamento em andamento.');
  saving=true;clearTimeout(timer);status('Salvando na planilha…','busy');const current=session;
  try{const next=await repo.save(name,record,base);if(current!==session)return;data=next;renderContent();status(demo?'Modo de demonstração':'Salvo na planilha');toast(demo?'Alteração aplicada na demonstração.':'Alteração salva na planilha.');}
  catch(error){
    if(error.saved){
      if([401,403,404].includes(error.status)){lock('A alteração foi salva. '+error.message,error.status!==401);return;}
      const key=name==='Equipe'?'email':'id',index=data[name].findIndex(r=>r[key]===record[key]);
      if(index<0)data[name].push(record);else data[name][index]={...data[name][index],...record};
      renderContent();status('Salvo; atualização pendente','error');toast('Salvo na planilha. A atualização do painel será tentada novamente.');return;
    }
    status('Alteração não confirmada','error');if(error.status===401){lock(error.message);throw error;}throw error;
  }
  finally{saving=false;schedule();}
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&connected)refresh();});
window.addEventListener('online',()=>{if(connected)refresh();});
window.addEventListener('beforeunload',e=>{if(saving){e.preventDefault();e.returnValue='';}});
dialog.addEventListener('cancel',e=>{if(saving)e.preventDefault();});
if(demo){const {DemoRepository}=await import('./demo.mjs');repo=new DemoRepository();data=await repo.load();user=repo.user;connected=true;render();}
else{loginScreen();try{await initGoogle(()=>lock('Sua sessão expirou. Entre novamente para continuar.'));await authenticate(true);}catch(e){loginScreen(e.message);}}
