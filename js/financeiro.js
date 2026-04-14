import { db } from './firebase-config.js';
import { collection, getDocs, getDoc, doc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

const inMesRef = document.getElementById('inMesRef');
const btnBuscar = document.getElementById('btnBuscar');
const listaFin = document.getElementById('listaFin');

const hoje = new Date();
// Se hoje for dia 26 ou mais, já estamos no ciclo do mês seguinte
let m = hoje.getMonth() + 1;
let y = hoje.getFullYear();
if (hoje.getDate() >= 26) {
    m++;
    if (m > 12) { m = 1; y++; }
}
const mesStr = y + '-' + String(m).padStart(2, '0');
inMesRef.value = mesStr;

function fmt(n) {
  return parseFloat(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Verifica se uma data está dentro do ciclo do Mês/Ano selecionado (ex: 2026-04 = 26/03 a 25/04)
function isDataInCycle(timestampSeconds, mesAlvoRef) {
    const pts = mesAlvoRef.split('-');
    const year = parseInt(pts[0]);
    const month = parseInt(pts[1]); // 1 a 12
    
    // Início: Dia 26 do mês anterior (mês-2 no construtor de JS)
    const dtStart = new Date(year, month - 2, 26, 0, 0, 0);
    // Fim: Dia 25 do mês atual
    const dtEnd = new Date(year, month - 1, 25, 23, 59, 59);
    
    const dtTest = new Date(timestampSeconds * 1000);
    return dtTest >= dtStart && dtTest <= dtEnd;
}

async function carregarRelatorio() {
    listaFin.innerHTML = `<tr><td colspan="5" class="loading">Buscando informações do servidor...</td></tr>`;

    try {
        const dGlobal = await getDoc(doc(db, 'config_col', 'geral'));
        let configLmt = 500; 
        if (dGlobal.exists()) {
            configLmt = dGlobal.data().limiteMensal !== undefined ? Number(dGlobal.data().limiteMensal) : 500;
        }

        const mesAlvo = inMesRef.value || mesStr;
        const pts = mesAlvo.split('-');
        document.getElementById('subTitle').textContent = `Dados de ciclo referente a ${pts[1]}/${pts[0]} (26 do mês anterior até 25 deste mês)`;

        const cSnap = await getDocs(collection(db, 'colaboradores'));
        const colabs = [];
        cSnap.forEach(d => colabs.push({ id: d.id, ...d.data() }));

        const pSnap = await getDocs(collection(db, 'pedidos_col'));
        const pedidos = [];
        pSnap.forEach(d => pedidos.push({ id: d.id, ...d.data() }));

        let html = '';
        
        let somaLimites = 0;
        let somaGastos = 0;
        
        colabs.sort((a,b) => (a.nome||'').localeCompare(b.nome||''));

        for (const c of colabs) {
            const limite = c.limite !== undefined && c.limite !== null ? Number(c.limite) : configLmt;
            let totalGasto = 0;
            
            const meusP = pedidos.filter(p => p.colaboradorId === c.id);
            for (const p of meusP) {
                if (p.status !== 'cancelado' && p.status !== 'excluido') {
                    if (p.data && p.data.seconds) {
                        if (isDataInCycle(p.data.seconds, mesAlvo)) {
                            totalGasto += Number(p.total || 0);
                        }
                    } else if (p.data) {
                        const sec = new Date(p.data).getTime() / 1000;
                        if (isDataInCycle(sec, mesAlvo)) {
                            totalGasto += Number(p.total || 0);
                        }
                    }
                }
            }

            const saldo = limite - totalGasto;
            somaLimites += limite;
            somaGastos += totalGasto;
            
            html += `
                <tr>
                    <td class="col-user">${c.nome || '—'}</td>
                    <td class="col-cpf">${c.cpf || '—'}</td>
                    <td class="val limite">R$ ${fmt(limite)}</td>
                    <td class="val gasto">R$ ${fmt(totalGasto)}</td>
                    <td class="val saldo">R$ ${fmt(saldo)}</td>
                </tr>
            `;
        }
        
        // Row for column totals
        if (colabs.length > 0) {
            html += `
                <tr style="background: var(--elev); border-top: 2px solid var(--primary);">
                    <td colspan="2" style="text-align: right; font-family: 'Orbitron', sans-serif; font-size: 0.9rem; text-transform: uppercase;">Total Geral do Mês</td>
                    <td class="val limite">R$ ${fmt(somaLimites)}</td>
                    <td class="val gasto">R$ ${fmt(somaGastos)}</td>
                    <td class="val saldo">R$ ${fmt(somaLimites - somaGastos)}</td>
                </tr>
            `;
        }

        if (colabs.length === 0) {
            listaFin.innerHTML = `<tr><td colspan="5" class="loading" style="color:var(--text-s);">Nenhum colaborador encontrado.</td></tr>`;
        } else {
            listaFin.innerHTML = html;
        }

    } catch(err) {
        console.error(err);
        listaFin.innerHTML = `<tr><td colspan="5" class="loading" style="color:var(--danger);">Erro ao carregar cálculos financeiros verifique o console.</td></tr>`;
    }
}

btnBuscar.addEventListener('click', carregarRelatorio);
window.addEventListener('DOMContentLoaded', carregarRelatorio);
