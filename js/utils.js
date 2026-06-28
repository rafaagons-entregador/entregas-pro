// Utilidades globais do Painel de Entregas Pro
function moeda(v){return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
function numero(v){return Number(v||0);}
function inteiro(v){return Number.isInteger(Number(v));}
function hojeMes(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');}
function mesDaRota(r){return (r.data||'').substring(0,7);}
function formatarData(d){return new Date(d+'T00:00:00').toLocaleDateString('pt-BR');}
function nomeMes(m){const [a,n]=m.split('-');const nomes=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];return nomes[Number(n)-1]+'/'+a;}
