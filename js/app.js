// Painel de Entregas Pro v10.0
// Lógica principal do aplicativo.

if(location.protocol==='http:'||location.protocol==='https:'){
  if('serviceWorker' in navigator){navigator.serviceWorker.register('./service-worker.js').catch(()=>{});}
}

let rotas=[];
let categorias=[];
let motoristas=[];
try{rotas=JSON.parse(localStorage.getItem('rotas_v3')||'[]')||[];}catch(e){rotas=[];}
try{categorias=JSON.parse(localStorage.getItem('categorias_v8')||'[]')||[];}catch(e){categorias=[];}
try{motoristas=JSON.parse(localStorage.getItem('motoristas_v11')||localStorage.getItem('motoristas_v834')||localStorage.getItem('motoristas_v832')||localStorage.getItem('contas_v83')||'[]')||[];}catch(e){motoristas=[];}

let editando=null, editandoFin=null, editandoCategoria=null, editandoMotorista=null, historicoAberto=false;

if(!Array.isArray(motoristas)){motoristas=[];}
if(!Array.isArray(categorias) || categorias.length===0){
  categorias=[
    {nome:'Mercado Livre',usaPacotes:true,usaInsucessos:true,usaReclamacoes:true,participaIndicadores:true},
    {nome:'Shopee',usaPacotes:true,usaInsucessos:true,usaReclamacoes:true,participaIndicadores:true},
    {nome:'Uber/99',usaPacotes:false,usaInsucessos:false,usaReclamacoes:false,participaIndicadores:false}
  ];
}

function moeda(v){return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
function numero(v){return Number(v||0);}
function inteiro(v){return Number.isInteger(Number(v));}
function salvar(){localStorage.setItem('rotas_v3',JSON.stringify(rotas));}
function salvarCategorias(){localStorage.setItem('categorias_v8',JSON.stringify(categorias));if(usuarioAtual&&!carregandoNuvem)sincronizarCategoriasNuvem();}
function salvarMotoristas(){localStorage.setItem('motoristas_v11',JSON.stringify(motoristas));localStorage.removeItem('contas_v83');if(usuarioAtual&&!carregandoNuvem)sincronizarMotoristasNuvem();}
function hojeMes(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');}
function mesDaRota(r){return (r.data||'').substring(0,7);}
function formatarData(d){return new Date(d+'T00:00:00').toLocaleDateString('pt-BR');}
function nomeMes(m){const [a,n]=m.split('-');const nomes=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];return nomes[Number(n)-1]+'/'+a;}
function categoria(nome){const c=categorias.find(c=>c.nome===nome)||categorias[0]||{};if(c.participaIndicadores===undefined)c.participaIndicadores=true;return c;}


// ============================
// Supabase Cloud - v11 beta
// ============================
async function carregarDadosDaNuvem(){
  if(!usuarioAtual)return;
  carregandoNuvem=true;
  const [motRes, catRes, rotRes] = await Promise.all([
    supabaseClient.from('motoristas').select('*').order('created_at',{ascending:true}),
    supabaseClient.from('categorias').select('*').order('created_at',{ascending:true}),
    supabaseClient.from('rotas').select('*').order('data',{ascending:true})
  ]);
  if(motRes.error)console.error(motRes.error);
  if(catRes.error)console.error(catRes.error);
  if(rotRes.error)console.error(rotRes.error);

  motoristas=(motRes.data||[]).map(m=>m.nome);
  categorias=(catRes.data||[]).map(c=>({nome:c.nome,usaPacotes:c.usa_pacotes,usaInsucessos:c.usa_insucessos,usaReclamacoes:c.usa_reclamacoes,participaIndicadores:c.participa_indicadores!==false}));
  rotas=(rotRes.data||[]).map(r=>({id:r.id,data:r.data,categoria:r.categoria_nome,valor:numero(r.valor),km:numero(r.km),horas:numero(r.horas),consumo:numero(r.consumo),combustivel:numero(r.combustivel),motoristas:r.motoristas||[]}));

  if(!motoristas.length){motoristas=[];}
  if(!categorias.length){
    categorias=[
      {nome:'Mercado Livre',usaPacotes:true,usaInsucessos:true,usaReclamacoes:true,participaIndicadores:true},
      {nome:'Shopee',usaPacotes:true,usaInsucessos:true,usaReclamacoes:true,participaIndicadores:true},
      {nome:'Uber/99',usaPacotes:false,usaInsucessos:false,usaReclamacoes:false,participaIndicadores:false}
    ];
    await sincronizarCategoriasNuvem();
  }
  carregandoNuvem=false;
}

async function sincronizarMotoristasNuvem(){
  if(!usuarioAtual||carregandoNuvem)return;
  const { data: existentes } = await supabaseClient.from('motoristas').select('id,nome');
  const nomes=new Set((existentes||[]).map(x=>x.nome));
  const novos=motoristas.filter(n=>n&&!nomes.has(n)).map(nome=>({user_id:usuarioAtual.id,nome}));
  if(novos.length){
    const { error } = await supabaseClient.from('motoristas').insert(novos);
    if(error)console.error(error);
  }
}

async function sincronizarCategoriasNuvem(){
  if(!usuarioAtual||carregandoNuvem)return;
  const { data: existentes } = await supabaseClient.from('categorias').select('id,nome');
  const nomes=new Set((existentes||[]).map(x=>x.nome));
  const novas=categorias.filter(c=>c&&c.nome&&!nomes.has(c.nome)).map(c=>({user_id:usuarioAtual.id,nome:c.nome,usa_pacotes:!!c.usaPacotes,usa_insucessos:!!c.usaInsucessos,usa_reclamacoes:!!c.usaReclamacoes,participa_indicadores:c.participaIndicadores!==false}));
  if(novas.length){
    const { error } = await supabaseClient.from('categorias').insert(novas);
    if(error)console.error(error);
  }
}

async function salvarRotaNuvem(rota){
  if(!usuarioAtual)return null;
  const payload={user_id:usuarioAtual.id,data:rota.data,categoria_nome:rota.categoria,valor:numero(rota.valor),km:numero(rota.km),horas:numero(rota.horas),consumo:numero(rota.consumo),combustivel:numero(rota.combustivel),motoristas:rota.motoristas||[]};
  if(rota.id){
    const { data, error } = await supabaseClient.from('rotas').update(payload).eq('id',rota.id).select().single();
    if(error){console.error(error);return null;}
    return data;
  }else{
    const { data, error } = await supabaseClient.from('rotas').insert(payload).select().single();
    if(error){console.error(error);return null;}
    return data;
  }
}


async function excluirMotoristaNuvem(nome){
  if(!usuarioAtual || !nome)return true;
  try{
    const { error } = await supabaseClient.from('motoristas').delete().eq('nome', nome);
    if(error){
      console.error('Erro ao excluir motorista na nuvem:', error);
      alert('Não consegui excluir o motorista na nuvem. Veja o Console para detalhes.');
      return false;
    }
    return true;
  }catch(e){
    console.error('Erro inesperado ao excluir motorista na nuvem:', e);
    alert('Erro de conexão ao excluir motorista.');
    return false;
  }
}

async function renomearMotoristaNuvem(antigo,nome){
  if(!usuarioAtual || !antigo || !nome)return true;
  try{
    const { error } = await supabaseClient.from('motoristas').update({nome}).eq('nome', antigo);
    if(error){
      console.error('Erro ao renomear motorista na nuvem:', error);
      alert('Não consegui editar o motorista na nuvem. Veja o Console para detalhes.');
      return false;
    }
    return true;
  }catch(e){
    console.error('Erro inesperado ao renomear motorista na nuvem:', e);
    alert('Erro de conexão ao editar motorista.');
    return false;
  }
}

function assinaturaRotaParaBusca(r){
  return {
    data:r.data,
    categoria:r.categoria,
    valor:numero(r.valor),
    km:numero(r.km),
    consumo:numero(r.consumo),
    combustivel:numero(r.combustivel),
    motoristas:JSON.stringify(r.motoristas||[])
  };
}

function rotaCompativel(a,b){
  if(!a||!b)return false;
  if(a.data!==b.data)return false;
  if((a.categoria||a.categoria_nome)!==(b.categoria||b.categoria_nome))return false;
  for(const c of ['valor','km','horas','consumo','combustivel']){
    if(Math.abs(numero(a[c])-numero(b[c]))>0.01)return false;
  }
  return true;
}


async function excluirRotaNuvem(rota){
  if(!usuarioAtual||!rota)return false;

  try{
    if(rota.id){
      const { error } = await supabaseClient.from('rotas').delete().eq('id',rota.id);
      if(error){
        console.error('Erro ao excluir rota pelo ID:', error);
        alert('Não consegui excluir a rota na nuvem. Veja o Console para detalhes.');
        return false;
      }
      return true;
    }

    // Compatibilidade para rotas antigas que ficaram sem id local.
    const { data, error } = await supabaseClient
      .from('rotas')
      .select('id,data,categoria_nome,valor,km,horas,consumo,combustivel,motoristas')
      .eq('data', rota.data)
      .eq('categoria_nome', rota.categoria)
      .limit(50);

    if(error){
      console.error('Erro ao buscar rota na nuvem:', error);
      alert('Não consegui localizar a rota na nuvem para excluir.');
      return false;
    }

    const candidatos=(data||[]).map(r=>({
      id:r.id,
      data:r.data,
      categoria:r.categoria_nome,
      valor:r.valor,
      km:r.km,
      horas:r.horas,
      consumo:r.consumo,
      combustivel:r.combustivel,
      motoristas:r.motoristas||[]
    }));

    const alvo=candidatos.find(r=>rotaCompativel(rota,r)) || candidatos[0];

    if(!alvo||!alvo.id){
      alert('Não encontrei essa rota na nuvem para excluir.');
      return false;
    }

    const { error: delError } = await supabaseClient.from('rotas').delete().eq('id',alvo.id);
    if(delError){
      console.error('Erro ao excluir rota encontrada:', delError);
      alert('Não consegui excluir a rota na nuvem. Veja o Console para detalhes.');
      return false;
    }

    return true;
  }catch(e){
    console.error('Erro inesperado ao excluir rota na nuvem:', e);
    alert('Erro de conexão ao excluir rota.');
    return false;
  }
}

async function sincronizarTudoNuvem(){
  if(!usuarioAtual||carregandoNuvem)return;
  await sincronizarMotoristasNuvem();
  await sincronizarCategoriasNuvem();
  for(const r of rotas){
    if(!r.id){
      const salvo=await salvarRotaNuvem(r);
      if(salvo)r.id=salvo.id;
    }
  }
}


function normalizarRotas(){
  const padrao=(typeof obterMotoristaPadrao==='function'?obterMotoristaPadrao():motoristas[0])||'Motorista Principal';
  rotas=rotas.filter(r=>r&&r.data).map(r=>{
    const rota={id:r.id,data:r.data,categoria:r.categoria||'Mercado Livre',valor:numero(r.valor),km:numero(r.km),horas:numero(r.horas),consumo:numero(r.consumo),combustivel:numero(r.combustivel)};
    if(Array.isArray(r.motoristas)){
      rota.motoristas=r.motoristas.map(c=>({nome:c.nome||padrao,p:numero(c.p),i:numero(c.i),r:numero(c.r)}));
    }else if(Array.isArray(r.contas)){
      rota.motoristas=r.contas.map(c=>({nome:c.nome||padrao,p:numero(c.p),i:numero(c.i),r:numero(c.r)}));
    }else{
      rota.motoristas=[{nome:r.conta||padrao,p:numero(r.p),i:numero(r.i),r:numero(r.r)}];
    }
    rota.p=rota.motoristas.reduce((s,c)=>s+numero(c.p),0);rota.i=rota.motoristas.reduce((s,c)=>s+numero(c.i),0);rota.r=rota.motoristas.reduce((s,c)=>s+numero(c.r),0);
    return rota;
  });
}


function obterMotoristaPadrao(){
  const salvo=localStorage.getItem('motorista_padrao_v11');
  if(salvo && motoristas.includes(salvo))return salvo;
  return motoristas[0] || 'Todos';
}

function definirMotoristaPadrao(nome){
  if(!nome)return;
  localStorage.setItem('motorista_padrao_v11',nome);
  if(document.getElementById('motoristaSelecionado'))motoristaSelecionado.value=nome;
  atualizar();
}

function atualizarSelectMotoristaPadrao(){
  const sel=document.getElementById('motoristaPadraoSelecionado');
  if(!sel)return;
  sel.innerHTML='';
  motoristas.forEach(m=>{
    const op=document.createElement('option');
    op.value=m;
    op.textContent=m;
    sel.appendChild(op);
  });
  const padrao=obterMotoristaPadrao();
  if(motoristas.includes(padrao))sel.value=padrao;
}

function periodoDoDia(){
  const h=new Date().getHours();
  if(h>=5 && h<12)return 'Bom dia';
  if(h>=12 && h<18)return 'Boa tarde';
  return 'Boa noite';
}

function atualizarSaudacao(){
  const el=document.getElementById('saudacaoDashboard');
  const frase=document.getElementById('fraseDashboard');
  if(!el)return;

  const nome=obterMotoristaPadrao();
  el.textContent=`${periodoDoDia()}, ${nome} 👋`;

  const frases=[
    'Aqui está o resumo do seu mês.',
    'Que sua próxima rota seja excelente.',
    'Acompanhe seus resultados em tempo real.',
    'Seu painel está sincronizado na nuvem.'
  ];
  if(frase)frase.textContent=frases[new Date().getDate()%frases.length];
}

function mostrarSplash(){
  const s=document.getElementById('splashScreen');
  if(s)s.style.display='flex';
}

function esconderSplash(){
  const s=document.getElementById('splashScreen');
  if(s)s.style.display='none';
}

function mostrarPrimeiroAcesso(msg=''){
  esconderSplash();
  const auth=document.getElementById('authScreen');
  const rec=document.getElementById('recoveryScreen');
  const first=document.getElementById('firstAccessScreen');
  const app=document.getElementById('app');

  if(auth)auth.style.display='none';
  if(rec)rec.classList.add('hidden');
  if(first)first.classList.remove('hidden');
  if(app)app.classList.add('hidden');

  const box=document.getElementById('firstAccessMsg');
  if(box)box.textContent=msg;
}

async function criarPrimeiroMotorista(){
  const campo=document.getElementById('primeiroMotoristaNome');
  const msg=document.getElementById('firstAccessMsg');
  const nome=(campo?.value||'').trim();

  if(!nome){
    if(msg)msg.textContent='Digite seu nome para continuar.';
    return;
  }

  if(msg)msg.textContent='Preparando seu painel...';

  motoristas=[nome];
  categorias=[
    {nome:'Mercado Livre',usaPacotes:true,usaInsucessos:true,usaReclamacoes:true,participaIndicadores:true},
    {nome:'Shopee',usaPacotes:true,usaInsucessos:true,usaReclamacoes:true,participaIndicadores:true},
    {nome:'Uber/99',usaPacotes:false,usaInsucessos:false,usaReclamacoes:false,participaIndicadores:false}
  ];

  localStorage.setItem('motorista_padrao_v11',nome);

  await sincronizarMotoristasNuvem();
  await sincronizarCategoriasNuvem();

  await iniciarAppNuvem();
}


function carregarMeses(){
  normalizarRotas();
  const atual=hojeMes(), anterior=mesSelecionado.value||atual;
  let meses=[...new Set(rotas.map(mesDaRota))];if(!meses.includes(atual))meses.push(atual);
  meses.sort();mesSelecionado.innerHTML='';
  meses.forEach(m=>{const op=document.createElement('option');op.value=m;op.textContent=nomeMes(m);mesSelecionado.appendChild(op);});
  mesSelecionado.value=meses.includes(anterior)?anterior:atual;
}
function atualizarSelectMotoristas(){
  const filtroAtual=motoristaSelecionado.value||obterMotoristaPadrao();
  motoristaSelecionado.innerHTML='<option value="Todos">Todos os motoristas</option>';
  motoristas.forEach(c=>{
    const op=document.createElement('option');
    op.value=c;
    op.textContent=c;
    motoristaSelecionado.appendChild(op);
  });
  motoristaSelecionado.value=[...motoristaSelecionado.options].some(o=>o.value===filtroAtual)?filtroAtual:'Todos';

  const a=motoristaA.value;
  const b=motoristaB.value;
  const backupEl=document.getElementById('motoristaBackup');
  const mb=backupEl?backupEl.value:'';

  motoristaA.innerHTML='';
  motoristaB.innerHTML='<option value="">Sem segundo motorista</option>';
  if(backupEl)backupEl.innerHTML='';

  motoristas.forEach(c=>{
    let op1=document.createElement('option');
    op1.value=c;
    op1.textContent=c;
    motoristaA.appendChild(op1);

    let op2=document.createElement('option');
    op2.value=c;
    op2.textContent=c;
    motoristaB.appendChild(op2);

    if(backupEl){
      let op3=document.createElement('option');
      op3.value=c;
      op3.textContent='Importar para '+c;
      backupEl.appendChild(op3);
    }
  });

  if(motoristas.includes(a))motoristaA.value=a;
  if(motoristas.includes(b))motoristaB.value=b;
  if(backupEl&&motoristas.includes(mb))backupEl.value=mb;

  atualizarSelectMotoristaPadrao();
}
function rotasDoMes(){
  const inicio = localStorage.getItem('filtro_periodo_inicio');
  const fim = localStorage.getItem('filtro_periodo_fim');

  if(inicio && fim){
    return rotas
      .map((r,i)=>({...r,idx:i}))
      .filter(r=>r.data>=inicio && r.data<=fim);
  }

  return rotas
    .map((r,i)=>({...r,idx:i}))
    .filter(r=>mesDaRota(r)===mesSelecionado.value);
}
function litros(x){return numero(x.km)>0&&numero(x.consumo)>0?numero(x.km)/numero(x.consumo):0;}
function custo(x){return litros(x)*numero(x.combustivel);}
function lucro(x){return numero(x.valor)-custo(x);}
function stats(lista, filtro='Todos', usarFiltroIndicadores=true){
  let tp=0,ti=0,tr=0,bruto=0,gasto=0,luc=0,km=0,horas=0;
  lista.forEach(x=>{
    bruto+=numero(x.valor);
    gasto+=custo(x);
    luc+=lucro(x);
    km+=numero(x.km);
    horas+=numero(x.horas);

    const cat=categoria(x.categoria);
    const contaIndicadores=!usarFiltroIndicadores || cat.participaIndicadores!==false;

    if(contaIndicadores){
      (x.motoristas||[]).forEach(c=>{
        if(filtro==='Todos'||c.nome===filtro){
          tp+=numero(c.p);
          ti+=numero(c.i);
          tr+=numero(c.r);
        }
      });
    }
  });
  const dias=[...new Set(lista.map(x=>x.data))].length;
  return{tp,ti,tr,bruto,gasto,luc,km,horas,dias};
}
function definirDataHojeRota(){
  const campo=document.getElementById('data');
  if(campo && !campo.value){
    campo.value=new Date().toISOString().slice(0,10);
  }
}

function abrirAba(id){
  document.querySelectorAll('.aba').forEach(a=>a.classList.remove('active'));document.querySelectorAll('.menu button').forEach(b=>b.classList.remove('active'));
  document.getElementById(id).classList.add('active');document.getElementById('m'+id.charAt(0).toUpperCase()+id.slice(1)).classList.add('active');
  if(id==='dia')mesAnaliticoAtual=mesSelecionado.value;if(id==='rota')definirDataHojeRota();atualizar();
}
function classePercentual(v){if(v>=99)return'good';if(v>=98)return'warn';return'bad';}
function aplicarFiltroPeriodo(){
  const ini = filtroDataInicio.value;
  const fim = filtroDataFim.value;

  if(!ini || !fim){
    alert('Selecione a data inicial e final.');
    return;
  }

  if(ini > fim){
    alert('A data inicial não pode ser maior que a final.');
    return;
  }

  localStorage.setItem('filtro_periodo_inicio', ini);
  localStorage.setItem('filtro_periodo_fim', fim);

  atualizar();
}

function limparFiltroPeriodo(){
  localStorage.removeItem('filtro_periodo_inicio');
  localStorage.removeItem('filtro_periodo_fim');

  filtroDataInicio.value = '';
  filtroDataFim.value = '';

  atualizar();
}

function atualizarInfoPeriodo(){
  const info = document.getElementById('periodoDashboardInfo');
  if(!info)return;

  const ini = localStorage.getItem('filtro_periodo_inicio');
  const fim = localStorage.getItem('filtro_periodo_fim');

  if(ini && fim){
    filtroDataInicio.value = ini;
    filtroDataFim.value = fim;
    info.textContent = `Exibindo: ${formatarData(ini)} até ${formatarData(fim)}`;
  }else{
    info.textContent = `Exibindo: ${nomeMes(mesSelecionado.value)}`;
  }
}
function atualizar(){
  normalizarRotas();rotas.sort((a,b)=>new Date(a.data)-new Date(b.data));
  atualizarSelectCategorias();atualizarSelectMotoristas();atualizarCategoriasUI();atualizarMotoristasUI();
  const lista=rotasDoMes(),filtro=motoristaSelecionado.value||'Todos',s=stats(lista,filtro),financeiro=stats(lista,'Todos');
  const sucesso=s.tp?((s.tp-s.ti)/s.tp*100):100,recl=s.tp?((s.tp-s.tr)/s.tp*100):100;
  tp.textContent=s.tp;
  insucessosDash.textContent=s.ti;
  reclamacoesDash.textContent=s.tr;;ps.textContent=sucesso.toFixed(2)+'%';pr.textContent=recl.toFixed(2)+'%';ps.className='metric '+classePercentual(sucesso);pr.className='metric '+classePercentual(recl);
  kmTotal.textContent=financeiro.km.toFixed(1);gastoComb.textContent=moeda(financeiro.gasto);fatBruto.textContent=moeda(financeiro.bruto);lucroLiq.textContent=moeda(financeiro.luc);
  dias.textContent=financeiro.dias;mediaDia.textContent=(financeiro.dias?s.tp/financeiro.dias:0).toFixed(1);lucroKm.textContent=moeda(financeiro.km?financeiro.luc/financeiro.km:0);horasTotal.textContent=financeiro.horas.toFixed(1)+'h';mediaHorasDia.textContent=(financeiro.dias?financeiro.horas/financeiro.dias:0).toFixed(1)+'h';ganhoHora.textContent=moeda(financeiro.horas?financeiro.luc/financeiro.horas:0);
  finBruto.textContent=moeda(financeiro.bruto);finComb.textContent=moeda(financeiro.gasto);finLucro.textContent=moeda(financeiro.luc);finLucroPac.textContent=moeda(s.tp?financeiro.luc/s.tp:0);finLucroKm.textContent=moeda(financeiro.km?financeiro.luc/financeiro.km:0);finGanhoKm.textContent=moeda(financeiro.km?financeiro.bruto/financeiro.km:0);finHoras.textContent=financeiro.horas.toFixed(1)+'h';finGanhoHora.textContent=moeda(financeiro.horas?financeiro.luc/financeiro.horas:0);
  atualizarInfoPeriodo();atualizarSaudacao();renderHistorico(lista);renderFinanceiro(lista);renderResumoCategorias(lista);renderAnalitico();salvar();salvarMotoristas();salvarCategorias();
}
function atualizarSelectCategorias(){
  const atual=categoriaRota.value;categoriaRota.innerHTML='';
  categorias.forEach(c=>{const op=document.createElement('option');op.value=c.nome;op.textContent=c.nome;categoriaRota.appendChild(op);});
  if([...categoriaRota.options].some(o=>o.value===atual))categoriaRota.value=atual;atualizarCamposCategoria();
}
function atualizarCamposCategoria(){
  const c=categoria(categoriaRota.value), show=c.usaPacotes||c.usaInsucessos||c.usaReclamacoes;
  camposPacotes.style.display=show?'block':'none';
  [pacotes,pacotesB].forEach(e=>e.style.display=c.usaPacotes?'block':'none');
  [insucessos,insucessosB].forEach(e=>e.style.display=c.usaInsucessos?'block':'none');
  [reclamacoes,reclamacoesB].forEach(e=>e.style.display=c.usaReclamacoes?'block':'none');
}
function validarInteiros(c,p,i,r){if(c.usaPacotes&&!inteiro(p))return'Pacotes deve ser número inteiro.';if(c.usaInsucessos&&!inteiro(i))return'Insucessos deve ser número inteiro.';if(c.usaReclamacoes&&!inteiro(r))return'Reclamações deve ser número inteiro.';return'';}

let wizardEtapa=1;
let mesAnaliticoAtual=null;

function voltarInicio(){abrirAba('inicio');}

function definirWizard(n){
  wizardEtapa=n;
  for(let i=1;i<=4;i++){
    const w=document.getElementById('wizard'+i);
    const s=document.getElementById('step'+i);
    if(w)w.classList.toggle('active',i===n);
    if(s)s.classList.toggle('active',i===n);
  }
  atualizarMotoristaB();
  atualizarPreviewFinanceiro();
  if(n===4)montarResumoRota();
}

function proximoWizard(){
  if(validarWizard(wizardEtapa))definirWizard(Math.min(4,wizardEtapa+1));
}

function voltarWizard(){
  definirWizard(Math.max(1,wizardEtapa-1));
}

function atualizarMotoristaB(){
  const box=document.getElementById('boxMotoristaB');
  if(box)box.style.display=motoristaB.value?'block':'none';
}

function validarWizard(etapa){
  if(etapa===1){
    if(!data.value){alert('Preencha a data.');return false;}
    if(motoristaB.value&&motoristaA.value===motoristaB.value){alert('Motorista A e B não podem ser iguais.');return false;}
  }

  if(etapa===2){
    const cat=categoria(categoriaRota.value);
    const temB=!!motoristaB.value;
    const p=cat.usaPacotes?numero(pacotes.value):0;
    const i=cat.usaInsucessos?numero(insucessos.value):0;
    const rec=cat.usaReclamacoes?numero(reclamacoes.value):0;
    const p2=cat.usaPacotes?numero(pacotesB.value):0;
    const i2=cat.usaInsucessos?numero(insucessosB.value):0;
    const rec2=cat.usaReclamacoes?numero(reclamacoesB.value):0;

    let erro=validarInteiros(cat,p,i,rec);
    if(erro){alert('Motorista A: '+erro);return false;}

    if(temB){
      erro=validarInteiros(cat,p2,i2,rec2);
      if(erro){alert('Motorista B: '+erro);return false;}
    }

    if(cat.usaPacotes && (p + p2) <= 0){
  alert('Preencha pacotes em pelo menos um motorista.');
  return false;
}
  }

  if(etapa===3){
    if(numero(valor.value)<=0||numero(km.value)<=0||numero(horas.value)<=0||numero(consumo.value)<=0||numero(combustivel.value)<=0){
      alert('Faturamento, km, horas, consumo e preço do combustível são obrigatórios.');
      return false;
    }
  }

  return true;
}

function atualizarPreviewFinanceiro(){
  const box=document.getElementById('previewFinanceiro');
  if(!box)return;

  const v=numero(valor.value);
  const k=numero(km.value);
  const h=numero(horas.value);
  const c=numero(consumo.value);
  const comb=numero(combustivel.value);

  if(v<=0||k<=0||h<=0||c<=0||comb<=0){
    box.textContent='Preencha os dados financeiros para ver a prévia.';
    return;
  }

  const litros=k/c;
  const gasto=litros*comb;
  const lucroEstimado=v-gasto;

  box.innerHTML=`<b>Prévia financeira</b><br>Litros estimados: ${litros.toFixed(2)} L<br>Custo combustível: ${moeda(gasto)}<br>Lucro líquido estimado: ${moeda(lucroEstimado)}<br>Ganho por hora estimado: ${moeda(h?lucroEstimado/h:0)}`;
}

function montarResumoRota(){
  const cat=categoria(categoriaRota.value);
  const temB=!!motoristaB.value;
  const h=numero(horas.value);
  const gasto=(numero(km.value)/numero(consumo.value))*numero(combustivel.value);
  const lucroEstimado=numero(valor.value)-gasto;

  resumoRota.innerHTML=
    `<b>${formatarData(data.value)} — ${categoriaRota.value}</b><br>`+
    `<b>${motoristaA.value}</b>: `+
    `${cat.usaPacotes?numero(pacotes.value)+' pacotes, ':''}`+
    `${cat.usaInsucessos?numero(insucessos.value)+' insucesso(s), ':''}`+
    `${cat.usaReclamacoes?numero(reclamacoes.value)+' reclamação(ões)':''}<br>`+
    (temB?`<b>${motoristaB.value}</b>: ${cat.usaPacotes?numero(pacotesB.value)+' pacotes, ':''}${cat.usaInsucessos?numero(insucessosB.value)+' insucesso(s), ':''}${cat.usaReclamacoes?numero(reclamacoesB.value)+' reclamação(ões)':''}<br>`:'')+
    `<hr>Bruto: ${moeda(valor.value)}<br>Combustível: ${moeda(gasto)}<br>Lucro líquido: ${moeda(lucroEstimado)}<br>Km: ${numero(km.value).toFixed(1)}<br>Horas: ${h.toFixed(1)}<br>Ganho/hora: ${moeda(h?lucroEstimado/h:0)}`;
}

function limparWizardRota(){
  ['data','pacotes','pacotesB','valor','km','horas','consumo','combustivel'].forEach(id=>{
    const el=document.getElementById(id);
    if(el)el.value='';
  });
  insucessos.value=0;
  reclamacoes.value=0;
  insucessosB.value=0;
  reclamacoesB.value=0;
  definirWizard(1);
}

function dataISO(ano,mes,dia){
  return ano+'-'+String(mes).padStart(2,'0')+'-'+String(dia).padStart(2,'0');
}

function rotasDoDia(dataDia){
  return rotas.filter(r=>r.data===dataDia);
}

function renderAnalitico(){
  const cal=document.getElementById('analiticoCalendario');
  if(!cal)return;

  if(!mesAnaliticoAtual)mesAnaliticoAtual=mesSelecionado.value||hojeMes();

  const [ano,mes]=mesAnaliticoAtual.split('-').map(Number);
  analiticoTitulo.textContent=nomeMes(mesAnaliticoAtual);

  cal.innerHTML='';
  ['D','S','T','Q','Q','S','S'].forEach(d=>{
    cal.innerHTML+=`<div class="weekday">${d}</div>`;
  });

  const primeiro=new Date(ano,mes-1,1);
  const inicio=primeiro.getDay();
  const diasMes=new Date(ano,mes,0).getDate();
  const diasAnterior=new Date(ano,mes-1,0).getDate();
  const hoje=new Date().toISOString().slice(0,10);

  for(let i=0;i<42;i++){
    let dia, fora=false;
    if(i<inicio){dia=diasAnterior-inicio+i+1;fora=true;}
    else if(i>=inicio+diasMes){dia=i-inicio-diasMes+1;fora=true;}
    else{dia=i-inicio+1;}

    const iso=fora?'':dataISO(ano,mes,dia);
    const lista=iso?rotasDoDia(iso):[];
    const st=stats(lista,'Todos');
    const tem=lista.length>0;
    const nivel=st.luc<0?'bad':(st.luc<150?'warn':'good');
    const dinheiro=tem?`<div class="day-money ${st.luc<0?'neg':''}">${moeda(st.luc)}</div>`:'';
    const meta=tem?`<div class="day-meta">${lista.length} rota(s) • ${st.km.toFixed(0)} km</div>`:'';

    cal.innerHTML+=`
      <div class="day-card ${fora?'other':''} ${tem?'has':''} ${iso===hoje?'today':''}" ${tem?`onclick="abrirDetalheDia('${iso}')"`:''}>
        ${tem?`<span class="day-dot ${nivel}"></span>`:''}
        <div class="day-num">${dia}</div>
        ${dinheiro}
        ${meta}
      </div>`;
  }

  renderTopAnalitico();
}

function mudarMesAnalitico(delta){
  if(!mesAnaliticoAtual)mesAnaliticoAtual=mesSelecionado.value||hojeMes();
  const [ano,mes]=mesAnaliticoAtual.split('-').map(Number);
  const d=new Date(ano,mes-1+delta,1);
  mesAnaliticoAtual=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
  renderAnalitico();
}

function abrirDetalheDia(dataDia){
  const lista=rotasDoDia(dataDia);
  const s=stats(lista,motoristaSelecionado.value||'Todos');
  const fin=stats(lista,'Todos');

  diaDetalheTitulo.textContent=formatarData(dataDia);
  diaDetalheSub.textContent=`${lista.length} rota(s) lançada(s)`;

  let htmlRotas='';
  lista.forEach((r,idx)=>{
    htmlRotas+=`<div class="route-pill"><b>Rota ${idx+1} — ${r.categoria}</b><br>${motoristasResumo(r)}<br>Bruto: ${moeda(r.valor)} | Líquido: ${moeda(lucro(r))}</div>`;
  });

  diaDetalheConteudo.innerHTML=
    `<div class="detail-row"><span>Faturamento bruto</span><b>${moeda(fin.bruto)}</b></div>`+
    `<div class="detail-row"><span>Combustível</span><b>${moeda(fin.gasto)}</b></div>`+
    `<div class="detail-row"><span>Lucro líquido</span><b>${moeda(fin.luc)}</b></div>`+
    `<div class="detail-row"><span>Km rodados</span><b>${fin.km.toFixed(1)} km</b></div>`+
    `<div class="detail-row"><span>Pacotes</span><b>${s.tp}</b></div>`+
    `<div class="detail-row"><span>Insucessos</span><b>${s.ti}</b></div>`+
    `<div class="detail-row"><span>Reclamações</span><b>${s.tr}</b></div>`+
    `<div class="detail-row"><span>Lucro por km</span><b>${moeda(fin.km?fin.luc/fin.km:0)}</b></div>`+
    `<h3 style="margin-top:14px">Rotas do dia</h3>`+
    htmlRotas;

  diaDetalheBg.style.display='flex';
}

function fecharDetalheDia(){
  diaDetalheBg.style.display='none';
}

function renderTopAnalitico(){
  const box=document.getElementById('analiticoTopDias');
  if(!box)return;

  const mes=mesAnaliticoAtual||mesSelecionado.value;
  const lista=rotas.map((rota,idx)=>({...rota,idx})).filter(r=>mesDaRota(r)===mes);
  const grupos={};

  lista.forEach(r=>{
    if(!grupos[r.data])grupos[r.data]=[];
    grupos[r.data].push(r);
  });

  const ranking=Object.keys(grupos)
    .map(d=>({data:d,...stats(grupos[d],'Todos')}))
    .sort((a,b)=>b.luc-a.luc)
    .slice(0,5);

  box.innerHTML=ranking.length
    ? ranking.map((x,i)=>`<div class="resultado"><b>${i+1}º</b> ${formatarData(x.data)} — ${moeda(x.luc)} líquido • ${x.km.toFixed(0)} km</div>`).join('')
    : '<p>Nenhum dia com rota neste mês.</p>';
}


async function salvarRota(){
  if(!validarWizard(1)||!validarWizard(2)||!validarWizard(3))return;
  const cat=categoria(categoriaRota.value),d=data.value,m1=motoristaA.value,m2=motoristaB.value;
  const p=cat.usaPacotes?numero(pacotes.value):0,i=cat.usaInsucessos?numero(insucessos.value):0,rec=cat.usaReclamacoes?numero(reclamacoes.value):0;
  const p2=cat.usaPacotes?numero(pacotesB.value):0,i2=cat.usaInsucessos?numero(insucessosB.value):0,rec2=cat.usaReclamacoes?numero(reclamacoesB.value):0;
  const val=numero(valor.value),k=numero(km.value),h=numero(horas.value),cons=numero(consumo.value),comb=numero(combustivel.value);
  if(!d){alert('Preencha a data.');return;}
  let erro=validarInteiros(cat,p,i,rec);if(erro){alert('Motorista A: '+erro);return;}
  if(m2){erro=validarInteiros(cat,p2,i2,rec2);if(erro){alert('Motorista B: '+erro);return;}}
  if(cat.usaPacotes&&p<=0){alert('Preencha a quantidade de pacotes do Motorista A.');return;}
  if(m2&&cat.usaPacotes&&p2<=0){alert('Preencha os pacotes do Motorista B ou deixe sem segundo motorista.');return;}
  if(m2&&m1===m2){alert('Motorista A e B não podem ser iguais.');return;}
  if(val<=0||k<=0||h<=0||cons<=0||comb<=0){alert('Faturamento, km, horas, consumo e preço do combustível são obrigatórios.');return;}
  const motoristasRota=[{nome:m1,p,i,r:rec}];if(m2)motoristasRota.push({nome:m2,p:p2,i:i2,r:rec2});
  const novaRota={data:d,categoria:cat.nome,motoristas:motoristasRota,valor:val,km:k,horas:h,consumo:cons,combustivel:comb};
  const salva=await salvarRotaNuvem(novaRota);
  if(salva)novaRota.id=salva.id;
  rotas.push(novaRota);
  salvar();carregarMeses();mesSelecionado.value=mesDaRota({data:d});
  limparWizardRota();atualizar();abrirAba('inicio');
}
function motoristasResumo(x){return(x.motoristas||[]).map(c=>`${c.nome}: ${c.p||0}p / ${c.i||0}i / ${c.r||0}r`).join('<br>');}
function renderHistorico(lista){
  hist.innerHTML='';
  if(!lista.length){
    hist.innerHTML='<tr><td colspan="6">Nenhuma rota no mês.</td></tr>';
    return;
  }

  lista.forEach(x=>{
    if(editando===x.idx){
      const cat=categoria(x.categoria);
      const m1=(x.motoristas&&x.motoristas[0])?x.motoristas[0]:{nome:motoristas[0],p:0,i:0,r:0};
      const m2=(x.motoristas&&x.motoristas[1])?x.motoristas[1]:{nome:'',p:0,i:0,r:0};

      hist.innerHTML+=`
      <tr>
        <td colspan="6">
          <div class="cat-card" style="text-align:left">
            <b>Editar rota - ${formatarData(x.data)}</b>

            <label>Data</label>
            <input id="editData${x.idx}" type="date" value="${x.data}">

            <label>Categoria</label>
            <select id="editCategoria${x.idx}">
              ${categorias.map(c=>`<option value="${c.nome}" ${c.nome===x.categoria?'selected':''}>${c.nome}</option>`).join('')}
            </select>

            <h4>Motorista A</h4>
            <select id="editMotorista1${x.idx}">
              ${motoristas.map(m=>`<option value="${m}" ${m===m1.nome?'selected':''}>${m}</option>`).join('')}
            </select>
            ${cat.usaPacotes?`<input id="editP1${x.idx}" type="number" step="1" value="${m1.p}" placeholder="Pacotes Motorista A">`:''}
            ${cat.usaInsucessos?`<input id="editI1${x.idx}" type="number" step="1" value="${m1.i}" placeholder="Insucessos Motorista A">`:''}
            ${cat.usaReclamacoes?`<input id="editR1${x.idx}" type="number" step="1" value="${m1.r}" placeholder="Reclamações Motorista A">`:''}

            <h4>Motorista B (opcional)</h4>
            <select id="editMotorista2${x.idx}">
              <option value="">Sem segundo motorista</option>
              ${motoristas.map(m=>`<option value="${m}" ${m===m2.nome?'selected':''}>${m}</option>`).join('')}
            </select>
            ${cat.usaPacotes?`<input id="editP2${x.idx}" type="number" step="1" value="${m2.p}" placeholder="Pacotes Motorista B">`:''}
            ${cat.usaInsucessos?`<input id="editI2${x.idx}" type="number" step="1" value="${m2.i}" placeholder="Insucessos Motorista B">`:''}
            ${cat.usaReclamacoes?`<input id="editR2${x.idx}" type="number" step="1" value="${m2.r}" placeholder="Reclamações Motorista B">`:''}

            <div class="row-2">
              <button class="btn-success" onclick="salvarEdicaoRota(${x.idx})">💾 Salvar</button>
              <button class="btn-secondary" onclick="cancelarEdicaoRota()">❌ Cancelar</button>
            </div>
          </div>
        </td>
      </tr>`;
    }else{
      hist.innerHTML+=`
      <tr>
        <td>${formatarData(x.data)}</td>
        <td>${x.categoria}</td>
        <td colspan="3">${motoristasResumo(x)}</td>
        <td class="acao-inline">
          <button class="btn-warning" onclick="editarRota(${x.idx})">✏️</button>
          <button class="btn-danger" onclick="excluir(${x.idx})">🗑️</button>
        </td>
      </tr>`;
    }
  });
}

function editarRota(idx){
  editando=idx;
  atualizar();
}

function cancelarEdicaoRota(){
  editando=null;
  atualizar();
}

async function salvarEdicaoRota(idx){
  const novaData=document.getElementById('editData'+idx).value;
  const novaCategoria=document.getElementById('editCategoria'+idx).value;
  const cat=categoria(novaCategoria);

  const m1=document.getElementById('editMotorista1'+idx).value;
  const m2=document.getElementById('editMotorista2'+idx).value;

  const p1=cat.usaPacotes?numero(document.getElementById('editP1'+idx)?.value):0;
  const i1=cat.usaInsucessos?numero(document.getElementById('editI1'+idx)?.value):0;
  const r1=cat.usaReclamacoes?numero(document.getElementById('editR1'+idx)?.value):0;

  const p2=cat.usaPacotes?numero(document.getElementById('editP2'+idx)?.value):0;
  const i2=cat.usaInsucessos?numero(document.getElementById('editI2'+idx)?.value):0;
  const r2=cat.usaReclamacoes?numero(document.getElementById('editR2'+idx)?.value):0;

  if(!novaData){alert('Preencha a data.');return;}

  let erro=validarInteiros(cat,p1,i1,r1);
  if(erro){alert('Motorista A: '+erro);return;}

  if(m2){
    erro=validarInteiros(cat,p2,i2,r2);
    if(erro){alert('Motorista B: '+erro);return;}
  }

  if(cat.usaPacotes && (p1 + p2) <= 0){
  alert('Preencha pacotes em pelo menos um motorista.');
  return;
}
  if(m2&&m1===m2){alert('Motorista A e B não podem ser iguais.');return;}

  const motoristasRota=[{nome:m1,p:p1,i:i1,r:r1}];
  if(m2)motoristasRota.push({nome:m2,p:p2,i:i2,r:r2});

  rotas[idx].data=novaData;
  rotas[idx].categoria=novaCategoria;
  rotas[idx].motoristas=motoristasRota;
  delete rotas[idx].contas;

  rotas[idx].p=motoristasRota.reduce((s,c)=>s+numero(c.p),0);
  rotas[idx].i=motoristasRota.reduce((s,c)=>s+numero(c.i),0);
  rotas[idx].r=motoristasRota.reduce((s,c)=>s+numero(c.r),0);

  await salvarRotaNuvem(rotas[idx]);
  editando=null;
  salvar();
  carregarMeses();
  atualizar();
}


async function excluir(idx){
  if(confirm('Excluir rota?')){
    editando=null;
    editandoFin=null;
    const r=rotas[idx];

    const ok=await excluirRotaNuvem(r);
    if(!ok)return;

    rotas.splice(idx,1);
    salvar();

    if(usuarioAtual){
      await carregarDadosDaNuvem();
    }

    carregarMeses();
    atualizar();
  }
}
function renderFinanceiro(lista){
  histFin.innerHTML='';
  if(!lista.length){
    histFin.innerHTML='<tr><td colspan="8">Nenhuma rota no mês.</td></tr>';
    return;
  }

  lista.forEach(x=>{
    if(editandoFin===x.idx){
      histFin.innerHTML+=`
      <tr>
        <td colspan="8">
          <div class="cat-card" style="text-align:left">
            <b>Editar faturamento - ${formatarData(x.data)} | ${x.categoria}</b>

            <label>Valor recebido</label>
            <input id="finValor${x.idx}" type="number" step="0.01" value="${x.valor}">

            <label>Km rodados</label>
            <input id="finKm${x.idx}" type="number" step="0.1" value="${x.km}">

            <label>Horas trabalhadas</label>
            <input id="finHoras${x.idx}" type="number" step="0.1" value="${numero(x.horas)}">

            <label>Consumo km/L</label>
            <input id="finCons${x.idx}" type="number" step="0.1" value="${x.consumo}">

            <label>Preço combustível</label>
            <input id="finComb${x.idx}" type="number" step="0.01" value="${x.combustivel}">

            <div class="row-2">
              <button class="btn-success" onclick="salvarFinanceiro(${x.idx})">💾 Salvar</button>
              <button class="btn-secondary" onclick="cancelarFinanceiro()">❌ Cancelar</button>
            </div>
          </div>
        </td>
      </tr>`;
    }else{
      histFin.innerHTML+=`
      <tr>
        <td>${formatarData(x.data)}</td>
        <td>${x.categoria}</td>
        <td>${moeda(x.valor)}</td>
        <td>${numero(x.km).toFixed(1)}</td>
        <td>${moeda(custo(x))}</td>
        <td>${moeda(lucro(x))}</td>
        <td class="acao-inline"><button class="btn-warning" onclick="editarFinanceiro(${x.idx})">✏️</button><button class="btn-danger" onclick="excluirFinanceiro(${x.idx})">🗑️</button></td>
      </tr>`;
    }
  });
}


async function excluirFinanceiro(idx){
  if(confirm('Excluir esta rota financeira? Isso também removerá os indicadores da rota.')){
    editandoFin=null;
    editando=null;
    const r=rotas[idx];

    const ok=await excluirRotaNuvem(r);
    if(!ok)return;

    rotas.splice(idx,1);
    salvar();

    if(usuarioAtual){
      await carregarDadosDaNuvem();
    }

    carregarMeses();
    atualizar();
  }
}

function editarFinanceiro(idx){
  editando=null;
  editandoFin=idx;
  atualizar();
}

function cancelarFinanceiro(){
  editandoFin=null;
  atualizar();
}

async function salvarFinanceiro(idx){
  const val=numero(document.getElementById('finValor'+idx).value);
  const k=numero(document.getElementById('finKm'+idx).value);
  const h=numero(document.getElementById('finHoras'+idx).value);
  const cons=numero(document.getElementById('finCons'+idx).value);
  const comb=numero(document.getElementById('finComb'+idx).value);

  if(val<=0||k<=0||h<=0||cons<=0||comb<=0){
    alert('Faturamento, km, horas, consumo e preço do combustível são obrigatórios.');
    return;
  }

  rotas[idx].valor=val;
  rotas[idx].km=k;
  rotas[idx].horas=h;
  rotas[idx].consumo=cons;
  rotas[idx].combustivel=comb;

  await salvarRotaNuvem(rotas[idx]);
  editandoFin=null;
  salvar();
  atualizar();
}
function renderResumoCategorias(lista){resumoCategorias.innerHTML='';const grupos={};lista.forEach(x=>{if(!grupos[x.categoria])grupos[x.categoria]=[];grupos[x.categoria].push(x);});const nomes=Object.keys(grupos);if(!nomes.length){resumoCategorias.innerHTML='<p>Nenhuma rota neste mês.</p>';return;}nomes.forEach(k=>{const gs=stats(grupos[k],motoristaSelecionado.value||'Todos',false),gf=stats(grupos[k],'Todos',false);resumoCategorias.innerHTML+=`<div class="resultado"><b>${k}</b><br><span class="badge">Bruto: ${moeda(gf.bruto)}</span><span class="badge">Líquido: ${moeda(gf.luc)}</span><span class="badge">Km: ${gf.km.toFixed(1)}</span><span class="badge">Horas: ${gf.horas.toFixed(1)}</span><span class="badge">Pacotes: ${gs.tp}</span></div>`;});}
function simularInsucessos(){
  const add=numero(simIns.value);
  if(!inteiro(simIns.value)){
    simInsRes.textContent='Digite apenas número inteiro. Exemplo: 3';
    return;
  }
  const s=stats(rotasDoMes(),motoristaSelecionado.value||'Todos');
  if(!s.tp){
    simInsRes.textContent='Cadastre uma rota neste mês primeiro.';
    return;
  }
  const pct=(((s.tp-(s.ti+add))/s.tp)*100).toFixed(2);
  simInsRes.textContent=`O indicador ficará em ${pct}%.`;
}

function simularReclamacoes(){
  const add=numero(simRec.value);
  if(!inteiro(simRec.value)){
    simRecRes.textContent='Digite apenas número inteiro. Exemplo: 3';
    return;
  }
  const s=stats(rotasDoMes(),motoristaSelecionado.value||'Todos');
  if(!s.tp){
    simRecRes.textContent='Cadastre uma rota neste mês primeiro.';
    return;
  }
  const pct=(((s.tp-(s.tr+add))/s.tp)*100).toFixed(2);
  simRecRes.textContent=`O indicador ficará em ${pct}%.`;
}

function calcularMetaPacotes(){
  const alvo=numero(metaPercentual.value);
  const s=stats(rotasDoMes(),motoristaSelecionado.value||'Todos');

  if(alvo<=0||alvo>=100){
    metaRes.textContent='Digite uma meta entre 0 e 99,99%.';
    return;
  }

  if(!s.tp){
    metaRes.textContent='Cadastre uma rota neste mês primeiro.';
    return;
  }

  const atual=s.tp?((s.tp-s.tr)/s.tp*100):100;

  if(atual>=alvo){
    metaRes.textContent=`Você já está em ${atual.toFixed(2)}%.`;
    return;
  }

  const alvoDecimal=alvo/100;
  const faltam=Math.ceil((s.tr/(1-alvoDecimal))-s.tp);

  metaRes.textContent=`Faltam aproximadamente ${Math.max(0,faltam)} pacotes perfeitos.`;
}

function calcularMetaInsucessos(){
  const alvo=numero(metaSucessoPercentual.value);
  const s=stats(rotasDoMes(),motoristaSelecionado.value||'Todos');

  if(alvo<=0||alvo>=100){
    metaInsRes.textContent='Digite uma meta entre 0 e 99,99%.';
    return;
  }

  if(!s.tp){
    metaInsRes.textContent='Cadastre uma rota neste mês primeiro.';
    return;
  }

  const atual=s.tp?((s.tp-s.ti)/s.tp*100):100;

  if(atual>=alvo){
    metaInsRes.textContent=`Você já está em ${atual.toFixed(2)}%.`;
    return;
  }

  const alvoDecimal=alvo/100;
  const faltam=Math.ceil((s.ti/(1-alvoDecimal))-s.tp);

  metaInsRes.textContent=`Faltam aproximadamente ${Math.max(0,faltam)} entregas perfeitas.`;
}

function toggleHistorico(){historicoAberto=!historicoAberto;historicoContainer.classList.toggle('hidden',!historicoAberto);btnHistorico.textContent=historicoAberto?'📋 Ocultar Rotas do Mês':'📋 Mostrar Rotas do Mês';}
function atualizarAnaliticaDia(){const d=dataAnalitica.value;if(!d)return;const lista=rotas.filter(x=>x.data===d),s=stats(lista,motoristaSelecionado.value||'Todos'),fin=stats(lista,'Todos');diaBruto.textContent=moeda(fin.bruto);diaLucro.textContent=moeda(fin.luc);diaKm.textContent=fin.km.toFixed(1);diaComb.textContent=moeda(fin.gasto);diaPac.textContent=s.tp;diaRotas.textContent=lista.length;const grupos={};lista.forEach(x=>{if(!grupos[x.categoria])grupos[x.categoria]=[];grupos[x.categoria].push(x);});diaCategorias.innerHTML='';Object.keys(grupos).forEach(k=>{const gs=stats(grupos[k],motoristaSelecionado.value||'Todos'),gf=stats(grupos[k],'Todos');diaCategorias.innerHTML+=`<div class="resultado"><b>${k}</b><br>Bruto: ${moeda(gf.bruto)} | Líquido: ${moeda(gf.luc)} | Km: ${gf.km.toFixed(1)} | Pacotes: ${gs.tp}</div>`;});if(!lista.length)diaCategorias.innerHTML='<p>Nenhuma rota nesse dia.</p>';}
function criarMotorista(){const nome=novoMotorista.value.trim();if(!nome){alert('Informe o nome do motorista.');return;}if(motoristas.some(c=>c.toLowerCase()===nome.toLowerCase())){alert('Motorista já existe.');return;}motoristas.push(nome);if(motoristas.length===1)definirMotoristaPadrao(nome);novoMotorista.value='';salvarMotoristas();atualizar();}
function atualizarMotoristasUI(){listaMotoristas.innerHTML='';motoristas.forEach((nome,idx)=>{const emUso=rotas.some(r=>(r.motoristas||[]).some(c=>c.nome===nome));if(editandoMotorista===idx){listaMotoristas.innerHTML+=`<div class="cat-card"><input id="motoristaNome${idx}" value="${nome}"><div class="row-2"><button class="btn-success" onclick="salvarMotoristaEditado(${idx})">💾 Salvar</button><button class="btn-secondary" onclick="cancelarMotorista()">Cancelar</button></div></div>`;}else{listaMotoristas.innerHTML+=`<div class="cat-card"><b>${nome}</b><br><div class="row-2"><button class="btn-warning" onclick="editarMotorista(${idx})">✏️ Editar</button><button class="btn-danger" onclick="removerMotorista('${nome.replaceAll("'","\\'")}')" ${emUso?'disabled':''}>Excluir</button></div>${emUso?'<small>Motorista em uso: não pode excluir.</small>':''}</div>`;}});}
function editarMotorista(idx){editandoMotorista=idx;atualizarMotoristasUI();}
function cancelarMotorista(){editandoMotorista=null;atualizarMotoristasUI();}
async function salvarMotoristaEditado(idx){
  const antigo=motoristas[idx];
  const nome=document.getElementById('motoristaNome'+idx).value.trim();

  if(!nome){
    alert('Informe o nome.');
    return;
  }

  if(motoristas.some((c,i)=>i!==idx&&c.toLowerCase()===nome.toLowerCase())){
    alert('Já existe motorista com esse nome.');
    return;
  }

  const ok=await renomearMotoristaNuvem(antigo,nome);
  if(!ok)return;

  motoristas[idx]=nome;

  rotas.forEach(r=>(r.motoristas||[]).forEach(c=>{
    if(c.nome===antigo)c.nome=nome;
  }));

  if(localStorage.getItem('motorista_padrao_v11')===antigo){
    localStorage.setItem('motorista_padrao_v11',nome);
  }

  for(const r of rotas){
    if((r.motoristas||[]).some(c=>c.nome===nome)){
      await salvarRotaNuvem(r);
    }
  }

  editandoMotorista=null;
  salvarMotoristas();
  salvar();

  if(usuarioAtual){
    await carregarDadosDaNuvem();
  }

  atualizar();
}
async function removerMotorista(nome){
  if(rotas.some(r=>(r.motoristas||[]).some(c=>c.nome===nome))){
    alert('Existe rota usando esse motorista.');
    return;
  }

  if(motoristas.length<=1){
    alert('Mantenha pelo menos um motorista.');
    return;
  }

  const ok=await excluirMotoristaNuvem(nome);
  if(!ok)return;

  motoristas=motoristas.filter(c=>c!==nome);

  if(localStorage.getItem('motorista_padrao_v11')===nome){
    localStorage.setItem('motorista_padrao_v11',motoristas[0]||'');
  }

  salvarMotoristas();

  if(usuarioAtual){
    await carregarDadosDaNuvem();
  }

  atualizar();
}


async function excluirCategoriaNuvem(nome){
  if(!usuarioAtual || !nome)return true;

  try{
    const { error } = await supabaseClient
      .from('categorias')
      .delete()
      .eq('nome', nome);

    if(error){
      console.error('Erro ao excluir categoria na nuvem:', error);
      alert('Não consegui excluir a categoria na nuvem. Veja o Console para detalhes.');
      return false;
    }

    return true;
  }catch(e){
    console.error('Erro inesperado ao excluir categoria na nuvem:', e);
    alert('Erro de conexão ao excluir categoria.');
    return false;
  }
}


async function atualizarCategoriaNuvem(antigo,categoriaAtual){
  if(!usuarioAtual||!antigo||!categoriaAtual)return true;
  try{
    const { error } = await supabaseClient
      .from('categorias')
      .update({
        nome:categoriaAtual.nome,
        usa_pacotes:!!categoriaAtual.usaPacotes,
        usa_insucessos:!!categoriaAtual.usaInsucessos,
        usa_reclamacoes:!!categoriaAtual.usaReclamacoes,
        participa_indicadores:categoriaAtual.participaIndicadores!==false
      })
      .eq('nome', antigo);

    if(error){
      console.error('Erro ao atualizar categoria na nuvem:', error);
      alert('Não consegui atualizar a categoria na nuvem.');
      return false;
    }

    return true;
  }catch(e){
    console.error('Erro inesperado ao atualizar categoria:', e);
    alert('Erro de conexão ao atualizar categoria.');
    return false;
  }
}


function criarCategoria(){
  const nome=novaCategoria.value.trim();
  if(!nome){alert('Informe o nome da categoria.');return;}
  if(categorias.some(c=>c.nome.toLowerCase()===nome.toLowerCase())){alert('Categoria já existe.');return;}

  categorias.push({
    nome,
    usaPacotes:catPacotes.checked,
    usaInsucessos:catInsucessos.checked,
    usaReclamacoes:catReclamacoes.checked,
    participaIndicadores:catIndicadores.checked
  });

  novaCategoria.value='';
  catPacotes.checked=true;
  catInsucessos.checked=true;
  catReclamacoes.checked=true;
  catIndicadores.checked=true;

  salvarCategorias();
  atualizar();
}
function atualizarCategoriasUI(){
  listaCategorias.innerHTML='';
  categorias.forEach((c,idx)=>{
    if(c.participaIndicadores===undefined)c.participaIndicadores=true;
    const emUso=rotas.some(r=>r.categoria===c.nome);

    if(editandoCategoria===idx){
      listaCategorias.innerHTML+=`
        <div class="cat-card">
          <input id="catNome${idx}" value="${c.nome}">
          <label><input id="catP${idx}" type="checkbox" ${c.usaPacotes?'checked':''} style="width:auto"> Usa pacotes</label><br>
          <label><input id="catI${idx}" type="checkbox" ${c.usaInsucessos?'checked':''} style="width:auto"> Usa insucessos</label><br>
          <label><input id="catR${idx}" type="checkbox" ${c.usaReclamacoes?'checked':''} style="width:auto"> Usa reclamações</label><br>
          <label><input id="catInd${idx}" type="checkbox" ${c.participaIndicadores!==false?'checked':''} style="width:auto"> Participa dos indicadores</label>
          <div class="row-2">
            <button class="btn-success" onclick="salvarCategoriaEditada(${idx})">💾 Salvar</button>
            <button class="btn-secondary" onclick="cancelarCategoria()">Cancelar</button>
          </div>
        </div>`;
    }else{
      listaCategorias.innerHTML+=`
        <div class="cat-card">
          <b>${c.nome}</b><br>
          Pacotes: ${c.usaPacotes?'Sim':'Não'} | Insucessos: ${c.usaInsucessos?'Sim':'Não'} | Reclamações: ${c.usaReclamacoes?'Sim':'Não'}<br>
          Indicadores: ${c.participaIndicadores!==false?'Sim':'Não'}
          <div class="row-2">
            <button class="btn-warning" onclick="editarCategoria(${idx})">✏️ Editar</button>
            <button class="btn-danger" onclick="removerCategoria('${c.nome.replaceAll("'","\\'")}')" ${emUso?'disabled':''}>Excluir</button>
          </div>
          ${emUso?'<small>Categoria em uso: não pode excluir.</small>':''}
        </div>`;
    }
  });
}
function editarCategoria(idx){editandoCategoria=idx;atualizarCategoriasUI();}
function cancelarCategoria(){editandoCategoria=null;atualizarCategoriasUI();}
async function salvarCategoriaEditada(idx){
  const antigo=categorias[idx].nome;
  const nome=document.getElementById('catNome'+idx).value.trim();

  if(!nome){alert('Informe o nome.');return;}
  if(categorias.some((c,i)=>i!==idx&&c.nome.toLowerCase()===nome.toLowerCase())){alert('Já existe categoria com esse nome.');return;}

  const nova={
    nome,
    usaPacotes:document.getElementById('catP'+idx).checked,
    usaInsucessos:document.getElementById('catI'+idx).checked,
    usaReclamacoes:document.getElementById('catR'+idx).checked,
    participaIndicadores:document.getElementById('catInd'+idx).checked
  };

  const ok=await atualizarCategoriaNuvem(antigo,nova);
  if(!ok)return;

  categorias[idx]=nova;
  rotas.forEach(r=>{if(r.categoria===antigo)r.categoria=nome;});

  for(const r of rotas){
    if(r.categoria===nome){
      await salvarRotaNuvem(r);
    }
  }

  editandoCategoria=null;
  salvarCategorias();
  salvar();
  atualizar();
}
async function removerCategoria(nome){
  if(rotas.some(r=>r.categoria===nome)){
    alert('Existe rota usando essa categoria.');
    return;
  }

  const ok=await excluirCategoriaNuvem(nome);
  if(!ok)return;

  categorias=categorias.filter(c=>c.nome!==nome);
  salvarCategorias();

  if(usuarioAtual){
    await carregarDadosDaNuvem();
  }

  atualizar();
}
function exportar(){const blob=new Blob([JSON.stringify({rotas,categorias,motoristas},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='entregas_backup_v11_0_beta.json';a.click();}
function juntarUnicos(base, novos){
  const set=new Set(base);
  novos.forEach(x=>{
    if(x && !set.has(x)){
      base.push(x);
      set.add(x);
    }
  });
  return base;
}

function prepararRotasImportadas(dados, motoristaDestino){
  let importadas=[];

  if(Array.isArray(dados)){
    importadas=dados;
  }else{
    importadas=dados.rotas||[];
  }

  return importadas.map(x=>{
    if(Array.isArray(x.motoristas)){
      return x;
    }

    if(Array.isArray(x.contas)){
      return {...x,motoristas:x.contas};
    }

    return {
      ...x,
      motoristas:[{
        nome:motoristaDestino,
        p:numero(x.p),
        i:numero(x.i),
        r:numero(x.r)
      }]
    };
  });
}

function importar(e){
  const arq=e.target.files[0];
  if(!arq)return;

  const r=new FileReader();

  r.onload=async()=>{
    try{
      const dados=JSON.parse(r.result);
      const destino=motoristaBackup.value||motoristas[0]||'Motorista Principal';
      const modo=(document.getElementById('modoImportacao')||{}).value||'adicionar';

      const novasRotas=prepararRotasImportadas(dados,destino);

      let novasCategorias=[];
      let novosMotoristas=[];

      if(!Array.isArray(dados)){
        novasCategorias=dados.categorias||[];
        novosMotoristas=dados.motoristas||dados.contas||[];
      }

      novasRotas.forEach(rt=>{
        (rt.motoristas||[]).forEach(m=>{
          if(m.nome)novosMotoristas.push(m.nome);
        });
      });

      if(modo==='substituir'){
        rotas=novasRotas;
        if(novasCategorias.length)categorias=novasCategorias;
        if(novosMotoristas.length)motoristas=[...new Set(novosMotoristas)];
      }else{
        rotas=rotas.concat(novasRotas);
        if(novasCategorias.length){
          const nomesCat=new Set(categorias.map(c=>c.nome));
          novasCategorias.forEach(c=>{
            if(c && c.nome && !nomesCat.has(c.nome)){
              categorias.push(c);
              nomesCat.add(c.nome);
            }
          });
        }
        juntarUnicos(motoristas,novosMotoristas.length?novosMotoristas:[destino]);
      }

      normalizarRotas();
      await sincronizarTudoNuvem();
      salvar();
      salvarCategorias();
      salvarMotoristas();
      carregarMeses();
      atualizar();

      e.target.value='';
      alert(modo==='substituir'?'Backup substituído com sucesso.':'Backup adicionado ao histórico com sucesso.');
    }catch(err){
      console.error(err);
      alert('Arquivo inválido.');
    }
  };

  r.readAsText(arq);
}
function alternarTema(){document.body.classList.toggle('dark');localStorage.setItem('tema_entregas_pro',document.body.classList.contains('dark')?'dark':'light');}
if(localStorage.getItem('tema_entregas_pro')==='dark')document.body.classList.add('dark');


// ============================
// Preferências do Dashboard - v11.5
// ============================
const dashboardCardsConfig=[
  {id:'faturamentoBruto',label:'Faturamento Bruto'},
  {id:'lucroLiquido',label:'Lucro Líquido'},
  {id:'pacotes',label:'Pacotes'},
  {id:'insucessos',label:'Insucessos'},
  {id:'reclamacoes',label:'Reclamações'},
  {id:'sucesso',label:'% Sucesso'},
  {id:'semReclamacoes',label:'% Sem Reclamações'},
  {id:'kmRodados',label:'Km Rodados'},
  {id:'gastoCombustivel',label:'Gasto Combustível'},
  {id:'diasTrabalhados',label:'Dias Trabalhados'},
  {id:'mediaPacotesDia',label:'Média Pacotes/Dia'},
  {id:'lucroKm',label:'Lucro/Km'},
  {id:'horasTrabalhadas',label:'Horas Trabalhadas'},
  {id:'mediaHorasDia',label:'Média Horas/Dia'},
  {id:'ganhoHora',label:'Ganho/Hora'}
];

let preferenciasDashboard={};

function preferenciasPadraoDashboard(){
  const obj={};
  dashboardCardsConfig.forEach(c=>obj[c.id]=true);
  return obj;
}

function chaveLocalPreferencias(){
  return usuarioAtual ? 'dashboard_cards_'+usuarioAtual.id : 'dashboard_cards_local';
}

async function carregarPreferenciasDashboard(){
  preferenciasDashboard=preferenciasPadraoDashboard();

  try{
    const local=localStorage.getItem(chaveLocalPreferencias());
    if(local){
      preferenciasDashboard={...preferenciasDashboard,...JSON.parse(local)};
    }
  }catch(e){}

  if(usuarioAtual){
    try{
      const { data, error } = await supabaseClient
        .from('preferencias_usuario')
        .select('dashboard_cards')
        .eq('user_id',usuarioAtual.id)
        .maybeSingle();

      if(error){
        console.error('Erro ao carregar preferências:', error);
      }

      if(data&&data.dashboard_cards){
        preferenciasDashboard={...preferenciasDashboard,...data.dashboard_cards};
        localStorage.setItem(chaveLocalPreferencias(),JSON.stringify(preferenciasDashboard));
      }
    }catch(e){
      console.error('Erro inesperado ao carregar preferências:', e);
    }
  }

  renderPreferenciasDashboard();
  aplicarPreferenciasDashboard();
}

function renderPreferenciasDashboard(){
  const box=document.getElementById('dashboardPrefs');
  if(!box)return;

  box.innerHTML='';
  dashboardCardsConfig.forEach(c=>{
    const checked=preferenciasDashboard[c.id]!==false;
    box.innerHTML+=`
      <label class="pref-item">
        <input type="checkbox" data-card-pref="${c.id}" ${checked?'checked':''}>
        ${c.label}
      </label>`;
  });
}

function aplicarPreferenciasDashboard(){
  dashboardCardsConfig.forEach(c=>{
    const el=document.querySelector(`[data-card="${c.id}"]`);
    if(el)el.classList.toggle('hidden',preferenciasDashboard[c.id]===false);
  });
}

async function salvarPreferenciasDashboard(){
  const checks=document.querySelectorAll('[data-card-pref]');
  checks.forEach(ch=>{
    preferenciasDashboard[ch.dataset.cardPref]=ch.checked;
  });

  localStorage.setItem(chaveLocalPreferencias(),JSON.stringify(preferenciasDashboard));
  aplicarPreferenciasDashboard();

  if(usuarioAtual){
    try{
      const { error } = await supabaseClient
        .from('preferencias_usuario')
        .upsert({
          user_id:usuarioAtual.id,
          dashboard_cards:preferenciasDashboard,
          updated_at:new Date().toISOString()
        },{onConflict:'user_id'});

      if(error){
        console.error('Erro ao salvar preferências:', error);
        prefsMsg.textContent='Preferências salvas neste aparelho, mas não consegui salvar na nuvem.';
        return;
      }
    }catch(e){
      console.error('Erro inesperado ao salvar preferências:', e);
      prefsMsg.textContent='Preferências salvas neste aparelho, mas houve erro na nuvem.';
      return;
    }
  }

  prefsMsg.textContent='Preferências salvas com sucesso.';
}

async function restaurarDashboardPadrao(){
  preferenciasDashboard=preferenciasPadraoDashboard();
  renderPreferenciasDashboard();
  await salvarPreferenciasDashboard();
  prefsMsg.textContent='Dashboard restaurado para o padrão.';
}

function iniciarApp(){
  try{
    salvarMotoristas();salvarCategorias();
    carregarMeses();
    definirWizard(1);
    definirDataHojeRota();
    atualizar();
    if(typeof carregarPreferenciasDashboard==='function')carregarPreferenciasDashboard();
  }catch(e){
    console.error(e);
    alert('Erro ao carregar o app. Limpe os dados do site ou importe um backup.');
  }
}
verificarSessao();
