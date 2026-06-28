// Painel de Entregas Pro v11.3 - Supabase Auth
const SUPABASE_URL = 'https://cnvjgaqqzxtedpehwujp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_c9p8rSe0sJLRCbmev0wE2A_es0Sj0sd';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let usuarioAtual = null;
let carregandoNuvem = false;
let modoRecuperacaoSenha = false;

function mostrarAuth(msg=''){
  if(typeof esconderSplash==='function')esconderSplash();
  const auth=document.getElementById('authScreen');
  const recovery=document.getElementById('recoveryScreen');
  const app=document.getElementById('app');
  if(auth)auth.style.display='flex';
  if(recovery)recovery.classList.add('hidden');
  if(app)app.classList.add('hidden');
  const box=document.getElementById('authMsg');
  if(box)box.textContent=msg;
}

function mostrarRecuperacao(msg=''){
  if(typeof esconderSplash==='function')esconderSplash();
  const auth=document.getElementById('authScreen');
  const recovery=document.getElementById('recoveryScreen');
  const app=document.getElementById('app');
  if(auth)auth.style.display='none';
  if(recovery)recovery.classList.remove('hidden');
  if(app)app.classList.add('hidden');
  const box=document.getElementById('recoveryMsg');
  if(box)box.textContent=msg;
}

function mostrarApp(){
  if(typeof esconderSplash==='function')esconderSplash();
  const first=document.getElementById('firstAccessScreen');
  if(first)first.classList.add('hidden');
  const auth=document.getElementById('authScreen');
  const recovery=document.getElementById('recoveryScreen');
  const app=document.getElementById('app');
  if(auth)auth.style.display='none';
  if(recovery)recovery.classList.add('hidden');
  if(app)app.classList.remove('hidden');
}

function traduzirErroAuth(msg){
  const m=(msg||'').toLowerCase();
  if(m.includes('invalid login credentials'))return 'E-mail ou senha incorretos.';
  if(m.includes('email not confirmed'))return 'Seu e-mail ainda não foi confirmado.';
  if(m.includes('user already registered'))return 'Este e-mail já possui cadastro.';
  if(m.includes('rate limit'))return 'Limite de envio atingido. Aguarde alguns minutos.';
  if(m.includes('password'))return 'Verifique a senha. Ela precisa ter pelo menos 6 caracteres.';
  return msg||'Ocorreu um erro.';
}

async function loginUsuario(){
  const email=document.getElementById('authEmail').value.trim();
  const password=document.getElementById('authPassword').value;
  const msg=document.getElementById('authMsg');
  if(!email||!password){if(msg)msg.textContent='Preencha e-mail e senha.';return;}
  if(msg)msg.textContent='Entrando...';
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if(error){if(msg)msg.textContent='Erro: '+traduzirErroAuth(error.message);return;}
  usuarioAtual=data.user;
  await iniciarAppNuvem();
}

async function criarUsuario(){
  const email=document.getElementById('authEmail').value.trim();
  const password=document.getElementById('authPassword').value;
  const msg=document.getElementById('authMsg');
  if(!email||!password){if(msg)msg.textContent='Preencha e-mail e senha.';return;}
  if(password.length<6){if(msg)msg.textContent='A senha precisa ter pelo menos 6 caracteres.';return;}
  if(msg)msg.textContent='Criando conta...';
  const redirectTo = window.location.origin + window.location.pathname;
  const { data, error } = await supabaseClient.auth.signUp({email,password,options:{emailRedirectTo:redirectTo}});
  if(error){if(msg)msg.textContent='Erro: '+traduzirErroAuth(error.message);return;}
  usuarioAtual=data.user;
  if(data.session){await iniciarAppNuvem();}else{if(msg)msg.textContent='Conta criada. Verifique seu e-mail para confirmar o cadastro.';}
}

async function reenviarConfirmacao(){
  const email=document.getElementById('authEmail').value.trim();
  const msg=document.getElementById('authMsg');
  if(!email){if(msg)msg.textContent='Digite seu e-mail primeiro.';return;}
  if(msg)msg.textContent='Reenviando confirmação...';
  const redirectTo = window.location.origin + window.location.pathname;
  const { error } = await supabaseClient.auth.resend({type:'signup',email,options:{emailRedirectTo:redirectTo}});
  if(error){if(msg)msg.textContent='Erro: '+traduzirErroAuth(error.message);return;}
  if(msg)msg.textContent='E-mail de confirmação reenviado.';
}

async function recuperarSenha(){
  const email=document.getElementById('authEmail').value.trim();
  const msg=document.getElementById('authMsg');
  if(!email){if(msg)msg.textContent='Digite seu e-mail primeiro.';return;}
  if(msg)msg.textContent='Enviando e-mail de recuperação...';
  const redirectTo = window.location.origin + window.location.pathname;
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email,{redirectTo});
  if(error){if(msg)msg.textContent='Erro: '+traduzirErroAuth(error.message);return;}
  if(msg)msg.textContent='Enviamos um link de recuperação para seu e-mail.';
}

async function salvarNovaSenha(){
  const senha=document.getElementById('novaSenha').value;
  const confirmar=document.getElementById('confirmarNovaSenha').value;
  const msg=document.getElementById('recoveryMsg');
  if(!senha||!confirmar){if(msg)msg.textContent='Preencha os dois campos.';return;}
  if(senha.length<6){if(msg)msg.textContent='A senha precisa ter pelo menos 6 caracteres.';return;}
  if(senha!==confirmar){if(msg)msg.textContent='As senhas não conferem.';return;}
  if(msg)msg.textContent='Salvando nova senha...';
  const { error } = await supabaseClient.auth.updateUser({password:senha});
  if(error){if(msg)msg.textContent='Erro: '+traduzirErroAuth(error.message);return;}
  modoRecuperacaoSenha=false;
  document.getElementById('novaSenha').value='';
  document.getElementById('confirmarNovaSenha').value='';
  if(history.replaceState)history.replaceState(null,'',window.location.pathname);
  const { data } = await supabaseClient.auth.getUser();
  usuarioAtual=data.user||usuarioAtual;
  await iniciarAppNuvem();
}

function voltarLogin(){mostrarAuth();}
async function alterarSenhaLogado(){mostrarRecuperacao('Digite uma nova senha para sua conta.');}

async function logoutUsuario(){
  await supabaseClient.auth.signOut();
  usuarioAtual=null;
  modoRecuperacaoSenha=false;
  mostrarAuth('Você saiu da conta.');
}

async function verificarSessao(){
  if(typeof mostrarSplash==='function')mostrarSplash();
  const hash=window.location.hash||'';
  const query=window.location.search||'';
  if(hash.includes('type=recovery')||query.includes('type=recovery'))modoRecuperacaoSenha=true;
  const { data } = await supabaseClient.auth.getSession();
  usuarioAtual=data.session?.user||null;
  if(modoRecuperacaoSenha&&usuarioAtual){mostrarRecuperacao('Crie sua nova senha.');return;}
  if(usuarioAtual){await iniciarAppNuvem();}else{mostrarAuth();}
}

supabaseClient.auth.onAuthStateChange(async (event, session)=>{
  if(event==='PASSWORD_RECOVERY'){
    modoRecuperacaoSenha=true;
    usuarioAtual=session?.user||null;
    mostrarRecuperacao('Crie sua nova senha.');
  }
  if(event==='SIGNED_IN'&&!modoRecuperacaoSenha){
    usuarioAtual=session?.user||null;
  }
  if(event==='SIGNED_OUT')usuarioAtual=null;
});

async function iniciarAppNuvem(){
  mostrarApp();

  const info=document.getElementById('usuarioLogadoInfo');
  if(info&&usuarioAtual)info.textContent='Logado como: '+usuarioAtual.email;

  await carregarDadosDaNuvem();

  if(!motoristas || motoristas.length===0){
    mostrarPrimeiroAcesso();
    return;
  }

  const padrao=obterMotoristaPadrao();
  localStorage.setItem('motorista_padrao_v11',padrao);

  if(typeof carregarMeses==='function'){
    carregarMeses();
    if(typeof definirWizard==='function')definirWizard(1);
    if(typeof definirDataHojeRota==='function')definirDataHojeRota();

    const filtro=document.getElementById('motoristaSelecionado');
    if(filtro&&[...filtro.options].some(o=>o.value===padrao))filtro.value=padrao;

    if(typeof atualizar==='function')atualizar();
    if(typeof carregarPreferenciasDashboard==='function')await carregarPreferenciasDashboard();
  }
}
