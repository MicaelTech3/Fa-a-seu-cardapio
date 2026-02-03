// pedidos.js
// JavaScript para a página pública de acompanhamento de pedidos

import { db } from './firebase-config.js';
import { 
    collection, 
    onSnapshot,
    query,
    where,
    orderBy 
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

let pedidos = [];
let pedidosAnteriores = [];

// Elementos do DOM
const ordersGrid = document.getElementById('ordersGrid');
const emptyState = document.getElementById('emptyState');
const notification = document.getElementById('notification');
const notificationText = document.getElementById('notificationText');

// Inicializar
window.addEventListener('DOMContentLoaded', () => {
    carregarPedidos();
    
    // Atualizar a cada 1 segundo para animações de tempo
    setInterval(() => {
        const pedidosAtivos = pedidos.filter(p => p.status !== 'entregue');
        if (pedidosAtivos.length > 0) {
            renderizarPedidos(pedidosAtivos);
        }
    }, 1000);
});

// Carregar pedidos em tempo real
function carregarPedidos() {
    try {
        const pedidosRef = collection(db, 'pedidos');
        const q = query(
            pedidosRef, 
            where('status', 'in', ['novo', 'preparando', 'pronto']),
            orderBy('data', 'desc')
        );
        
        onSnapshot(q, (snapshot) => {
            pedidosAnteriores = [...pedidos];
            pedidos = [];
            
            snapshot.forEach((doc) => {
                pedidos.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            // Verificar se algum pedido ficou pronto
            verificarPedidosProntos();
            
            renderizarPedidos(pedidos);
        });
    } catch (error) {
        console.error('Erro ao carregar pedidos:', error);
    }
}

// Verificar se algum pedido ficou pronto agora
function verificarPedidosProntos() {
    pedidos.forEach(pedidoAtual => {
        const pedidoAnterior = pedidosAnteriores.find(p => p.id === pedidoAtual.id);
        
        // Se o pedido existia antes e mudou para pronto agora
        if (pedidoAnterior && 
            pedidoAnterior.status !== 'pronto' && 
            pedidoAtual.status === 'pronto') {
            mostrarNotificacao(pedidoAtual);
        }
    });
}

// Mostrar notificação de pedido pronto
function mostrarNotificacao(pedido) {
    const numeroPedido = pedido.id.substring(0, 8).toUpperCase();
    notificationText.textContent = `Pedido #${numeroPedido} está pronto para retirada!`;
    
    notification.classList.add('active');
    
    // Tocar som de notificação (opcional)
    try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHW7A7+OZVA0NUrDn8bllHAU2jdXyzn0vBSd+zO/hlU0MC1ap5/KxYhwGN5DY88p5LAUmecvw45ZNDAZUpujyuGgcBzaQ2PL');
        audio.volume = 0.3;
        audio.play().catch(e => console.log('Não foi possível tocar o som'));
    } catch (e) {
        console.log('Som não disponível');
    }
    
    // Esconder após 10 segundos
    setTimeout(() => {
        notification.classList.remove('active');
    }, 10000);
}

// Renderizar pedidos
function renderizarPedidos(pedidosParaExibir) {
    if (!ordersGrid) return;
    
    if (pedidosParaExibir.length === 0) {
        ordersGrid.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }
    
    ordersGrid.style.display = 'grid';
    emptyState.style.display = 'none';
    
    ordersGrid.innerHTML = pedidosParaExibir.map(pedido => {
        const dataFormatada = pedido.data ? 
            new Date(pedido.data.seconds * 1000).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit'
            }) : 
            '--:--';
        
        const numeroPedido = pedido.id.substring(0, 8).toUpperCase();
        
        // Calcular tempo decorrido
        let tempoDecorrido = '';
        if (pedido.data) {
            const agora = new Date();
            const dataPedido = new Date(pedido.data.seconds * 1000);
            const diff = Math.floor((agora - dataPedido) / 60000); // minutos
            
            if (diff < 1) {
                tempoDecorrido = 'Agora mesmo';
            } else if (diff === 1) {
                tempoDecorrido = 'Há 1 minuto';
            } else if (diff < 60) {
                tempoDecorrido = `Há ${diff} minutos`;
            } else {
                const horas = Math.floor(diff / 60);
                tempoDecorrido = `Há ${horas}h`;
            }
        }
        
        // Log de processo
        const statusLog = [
            { status: 'novo', label: 'Novo', ativo: true },
            { status: 'preparando', label: 'Preparando', ativo: pedido.status === 'preparando' || pedido.status === 'pronto' },
            { status: 'pronto', label: 'Pronto', ativo: pedido.status === 'pronto' }
        ];
        
        return `
            <div class="order-card-public ${pedido.status}">
                <div class="order-header-public">
                    <div class="order-number-public">#${numeroPedido}</div>
                    <span class="order-status-badge ${pedido.status}">
                        ${getStatusLabel(pedido.status)}
                    </span>
                </div>
                
                <div class="order-time-public">
                    ${tempoDecorrido} • ${dataFormatada}
                </div>
                
                <!-- Log de Processo -->
                <div class="order-process-log">
                    ${statusLog.map((s, index) => `
                        <div class="process-step ${s.ativo ? 'active' : ''}">
                            <div class="process-dot"></div>
                            <span class="process-label">${s.label}</span>
                        </div>
                        ${index < statusLog.length - 1 ? '<div class="process-line"></div>' : ''}
                    `).join('')}
                </div>
                
                <div class="order-items-public">
                    ${pedido.itens.map(item => `
                        <div class="order-item-public">
                            <div>
                                <span class="order-item-name-public">${item.nome}</span>
                                <span class="order-item-qty-public">x${item.quantidade}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <div class="order-total-public">
                    <span>Total</span>
                    <span>R$ ${formatarPreco(pedido.total)}</span>
                </div>
            </div>
        `;
    }).join('');
}

// Obter label do status
function getStatusLabel(status) {
    const labels = {
        'novo': 'Novo',
        'preparando': 'Preparando',
        'pronto': 'Pronto! ✓'
    };
    return labels[status] || status;
}

// Formatar preço
function formatarPreco(valor) {
    return parseFloat(valor).toFixed(2).replace('.', ',');
}

console.log('Acompanhamento de pedidos inicializado!');