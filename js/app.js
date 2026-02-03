// app.js
// JavaScript para a página do cliente

import { db } from './firebase-config.js';
import { 
    collection, 
    getDocs, 
    addDoc, 
    query, 
    where, 
    orderBy,
    onSnapshot,
    serverTimestamp,
    doc,
    getDoc
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

// Estado da aplicação
let produtos = [];
let categorias = [];
let carrinho = [];
let categoriaAtiva = 'todas';
let pedidoAtualId = null;
let configuracoes = {
    nomeCardapio: 'Xfood',
    logoUrl: 'img/logo.jpg',
    corPrimaria: '#3b82f6',
    corSecundaria: '#64748b',
    fonte: 'DM Sans',
    tituloBemVindo: '😋 Bemvindos',
    endereco: 'Av. das Hortências, 4510 - Estrada Gramado, Gramado - RS, 95670-000, Brasil',
    whatsApp: '5554999999999',
    status: 'aberto',
    servicoLocal: true,
    servicoRetirada: true,
    servicoDelivery: true,
    carrinhoAtivo: true,
    chavePix: '',
    qrCodePix: ''
};

// Elementos do DOM
const productsContainer = document.getElementById('productsContainer');
const categoriesContainer = document.querySelector('.categories-scroll');
const cartDrawer = document.getElementById('cartDrawer');
const cartToggle = document.getElementById('cartToggle');
const cartClose = document.getElementById('cartClose');
const cartOverlay = document.getElementById('cartOverlay');
const cartItems = document.getElementById('cartItems');
const cartEmpty = document.getElementById('cartEmpty');
const cartFooter = document.getElementById('cartFooter');
const cartTotal = document.getElementById('cartTotal');
const cartCount = document.getElementById('cartCount');
const btnCheckout = document.getElementById('btnCheckout');
const confirmModal = document.getElementById('confirmModal');
const btnCloseModal = document.getElementById('btnCloseModal');
const orderNumber = document.getElementById('orderNumber');
const loading = document.getElementById('loading');

// Inicializar aplicação
window.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    try {
        showLoading();
        await carregarConfiguracoes();
        await carregarCategorias();
        await carregarProdutos();
        setupEventListeners();
        hideLoading();
    } catch (error) {
        console.error('Erro ao inicializar:', error);
        hideLoading();
    }
}

// Carregar configurações do Firestore em tempo real
async function carregarConfiguracoes() {
    try {
        const configRef = doc(db, 'configuracoes', 'geral');

        // Usar onSnapshot para atualizações em tempo real
        onSnapshot(configRef, (docSnap) => {
            if (docSnap.exists()) {
                const config = docSnap.data();
                configuracoes = { ...configuracoes, ...config }; // Mesclar com valores padrão
                console.log('🔄 Configurações carregadas/atualizadas:', configuracoes);
                aplicarConfiguracoes(configuracoes);
            } else {
                console.log('⚠️ Documento de configurações não encontrado, usando padrões');
                aplicarConfiguracoes(configuracoes);
            }
        }, (error) => {
            console.error('❌ Erro ao carregar configurações:', error);
            aplicarConfiguracoes(configuracoes); // Usar padrões em caso de erro
        });
    } catch (error) {
        console.error('❌ Erro ao configurar listener:', error);
        aplicarConfiguracoes(configuracoes); // Usar padrões em caso de erro
    }
}

// Aplicar configurações ao cardápio
function aplicarConfiguracoes(config) {
    console.log('🎨 Aplicando configurações:', config);
    
    // Aplicar nome do cardápio
    if (config.nomeCardapio) {
        document.title = config.nomeCardapio;
        const logoText = document.querySelector('.logo-text');
        if (logoText) {
            logoText.textContent = config.nomeCardapio;
        }
    }
    
    // Aplicar logo
    if (config.logoUrl) {
        // Logo no header
        const logoImgHeader = document.querySelector('.header .logo-img');
        if (logoImgHeader) {
            logoImgHeader.src = config.logoUrl;
            logoImgHeader.style.display = 'inline-block';
            logoImgHeader.onerror = function() {
                this.src = 'img/logo.jpg';
            };
        }
        
        // Logo no hero
        const logoIcon = document.querySelector('.logo-icon');
        if (logoIcon) {
            logoIcon.src = config.logoUrl;
            logoIcon.onerror = function() {
                this.src = 'img/logo.jpg';
            };
        }
    }
    
    // Aplicar cores CSS Variables
    if (config.corPrimaria) {
        document.documentElement.style.setProperty('--primary-color', config.corPrimaria);
        console.log('✅ Cor primária aplicada:', config.corPrimaria);
    }
    
    if (config.corSecundaria) {
        document.documentElement.style.setProperty('--secondary-color', config.corSecundaria);
        console.log('✅ Cor secundária aplicada:', config.corSecundaria);
    }
    
    // Aplicar fonte
    if (config.fonte && config.fonte !== 'DM Sans') {
        // Carregar nova fonte do Google Fonts
        const fontLink = document.createElement('link');
        fontLink.rel = 'stylesheet';
        fontLink.href = `https://fonts.googleapis.com/css2?family=${config.fonte.replace(' ', '+')}:wght@300;400;500;600;700&display=swap`;
        document.head.appendChild(fontLink);
        
        // Aplicar fonte ao body
        document.body.style.fontFamily = `'${config.fonte}', sans-serif`;
        console.log('✅ Fonte aplicada:', config.fonte);
    }
    
    // ===== CONFIGURAÇÕES DO HERO SECTION =====
    
    // Aplicar título de boas-vindas
    if (config.tituloBemVindo) {
        const heroTitle = document.querySelector('.hero-title');
        if (heroTitle) {
            heroTitle.textContent = config.tituloBemVindo;
            console.log('✅ Título atualizado:', config.tituloBemVindo);
        }
    }
    
    // Aplicar endereço
    if (config.endereco) {
        const heroAddress = document.querySelector('.hero-address span');
        if (heroAddress) {
            heroAddress.textContent = config.endereco;
            console.log('✅ Endereço atualizado:', config.endereco);
        }
    }
    
    // Aplicar WhatsApp
    if (config.whatsApp) {
        const whatsappBtn = document.querySelector('.btn-hero-secondary[href*="wa.me"]');
        if (whatsappBtn) {
            whatsappBtn.href = `https://wa.me/${config.whatsApp}`;
            console.log('✅ WhatsApp atualizado:', config.whatsApp);
        }
    }
    
    // Aplicar status (aberto/fechado)
    const statusBadge = document.querySelector('.status-badge');
    if (statusBadge && config.status) {
        statusBadge.classList.remove('open', 'closed');
        
        if (config.status === 'aberto') {
            statusBadge.classList.add('open');
            statusBadge.innerHTML = `
                <span class="status-dot"></span>
                Aberto
            `;
        } else {
            statusBadge.classList.add('closed');
            statusBadge.innerHTML = `
                <span class="status-dot"></span>
                Fechado
            `;
        }
        console.log('✅ Status atualizado:', config.status);
    }
    
    // Aplicar badges de serviço
    const heroFeatures = document.querySelector('.hero-features');
    if (heroFeatures) {
        const badges = [];
        
        if (config.servicoLocal !== false) {
            badges.push(`
                <span class="hero-badge">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                    </svg>
                    No local
                </span>
            `);
        }
        
        if (config.servicoRetirada !== false) {
            badges.push(`
                <span class="hero-badge">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="1" y="3" width="15" height="13"></rect>
                        <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                        <circle cx="5.5" cy="18.5" r="2.5"></circle>
                        <circle cx="18.5" cy="18.5" r="2.5"></circle>
                    </svg>
                    Retirada
                </span>
            `);
        }
        
        if (config.servicoDelivery !== false) {
            badges.push(`
                <span class="hero-badge">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    Delivery
                </span>
            `);
        }
        
        heroFeatures.innerHTML = badges.join('');
        console.log('✅ Badges de serviço atualizados');
    }
    
    // Controlar visibilidade do carrinho
    const cartToggleBtn = document.getElementById('cartToggle');
    if (cartToggleBtn) {
        if (config.carrinhoAtivo === false) {
            cartToggleBtn.style.display = 'none';
            console.log('✅ Carrinho desativado');
        } else {
            cartToggleBtn.style.display = 'flex';
            console.log('✅ Carrinho ativado');
        }
    }
    
    // Atualizar produtos se já carregados
    if (produtos.length > 0) {
        filtrarProdutos();
    }
    
    console.log('✅ Configurações aplicadas com sucesso!');
}

// Carregar categorias do Firestore em tempo real
async function carregarCategorias() {
    try {
        const categoriasRef = collection(db, 'categorias');
        
        onSnapshot(categoriasRef, (snapshot) => {
            categorias = [];
            snapshot.forEach((doc) => {
                categorias.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            renderizarCategorias();
        });
    } catch (error) {
        console.error('Erro ao carregar categorias:', error);
    }
}

// Renderizar categorias
function renderizarCategorias() {
    if (!categoriesContainer) return;
    
    categoriesContainer.innerHTML = `
        <button class="category-btn active" data-category="todas">
            Todas
        </button>
        ${categorias.map(cat => `
            <button class="category-btn" data-category="${cat.nome}">
                ${cat.nome}
            </button>
        `).join('')}
    `;
    
    // Event listeners para os botões de categoria
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            categoriaAtiva = btn.dataset.category;
            filtrarProdutos();
        });
    });
}

// Carregar produtos do Firestore em tempo real
async function carregarProdutos() {
    try {
        const produtosRef = collection(db, 'produtos');
        
        onSnapshot(produtosRef, (snapshot) => {
            produtos = [];
            snapshot.forEach((doc) => {
                const produto = {
                    id: doc.id,
                    ...doc.data()
                };
                // Apenas produtos ativos são exibidos
                if (produto.ativo !== false) {
                    produtos.push(produto);
                }
            });
            
            filtrarProdutos();
        });
    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
    }
}

// Filtrar produtos por categoria
function filtrarProdutos() {
    let produtosFiltrados = produtos;
    
    if (categoriaAtiva !== 'todas') {
        produtosFiltrados = produtos.filter(p => p.categoria === categoriaAtiva);
    }
    
    renderizarProdutos(produtosFiltrados);
}

// Renderizar produtos
function renderizarProdutos(produtosParaExibir) {
    if (!productsContainer) return;
    
    if (produtosParaExibir.length === 0) {
        productsContainer.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: #666;">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin: 0 auto 16px; opacity: 0.3;">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <p style="font-size: 1.1rem;">Nenhum produto encontrado nesta categoria</p>
            </div>
        `;
        return;
    }
    
    // Agrupar por categoria
    const produtosPorCategoria = {};
    produtosParaExibir.forEach(produto => {
        const cat = produto.categoria || 'Outros';
        if (!produtosPorCategoria[cat]) {
            produtosPorCategoria[cat] = [];
        }
        produtosPorCategoria[cat].push(produto);
    });
    
    // Renderizar seções por categoria
    productsContainer.innerHTML = Object.keys(produtosPorCategoria).map(categoria => `
        <div class="category-section">
            <h2 class="category-title">${categoria}</h2>
            <div class="products-grid">
                ${produtosPorCategoria[categoria].map(produto => `
                    <div class="product-card" data-id="${produto.id}">
                        <img 
                            src="${produto.imagem || 'https://via.placeholder.com/400x300?text=Sem+Imagem'}" 
                            alt="${produto.nome}"
                            class="product-image"
                            onerror="this.src='https://via.placeholder.com/400x300?text=Sem+Imagem'"
                        >
                        <div class="product-info">
                            <h3 class="product-name">${produto.nome}</h3>
                            ${produto.descricao ? `<p class="product-description">${produto.descricao}</p>` : ''}
                            <div class="product-footer">
                                <span class="product-price">R$ ${formatarPreco(produto.preco)}</span>
                                ${configuracoes.carrinhoAtivo !== false ? `
                                    <button class="btn-add" onclick="adicionarAoCarrinho('${produto.id}')">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <line x1="12" y1="5" x2="12" y2="19"></line>
                                            <line x1="5" y1="12" x2="19" y2="12"></line>
                                        </svg>
                                        Adicionar
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

// Adicionar produto ao carrinho
window.adicionarAoCarrinho = function(produtoId) {
    const produto = produtos.find(p => p.id === produtoId);
    if (!produto) return;
    
    const itemExistente = carrinho.find(item => item.id === produtoId);
    
    if (itemExistente) {
        itemExistente.quantidade++;
    } else {
        carrinho.push({
            id: produto.id,
            nome: produto.nome,
            preco: produto.preco,
            imagem: produto.imagem,
            quantidade: 1
        });
    }
    
    atualizarCarrinho();
    
    // Feedback visual
    const productCard = document.querySelector(`[data-id="${produtoId}"]`);
    if (productCard) {
        productCard.style.transform = 'scale(0.95)';
        setTimeout(() => {
            productCard.style.transform = '';
        }, 200);
    }
};

// Atualizar carrinho
function atualizarCarrinho() {
    const totalItens = carrinho.reduce((sum, item) => sum + item.quantidade, 0);
    const totalPreco = carrinho.reduce((sum, item) => sum + (item.preco * item.quantidade), 0);
    
    cartCount.textContent = totalItens;
    cartTotal.textContent = `R$ ${formatarPreco(totalPreco)}`;
    
    if (carrinho.length === 0) {
        cartItems.style.display = 'none';
        cartEmpty.style.display = 'flex';
        cartFooter.style.display = 'none';
    } else {
        cartItems.style.display = 'block';
        cartEmpty.style.display = 'none';
        cartFooter.style.display = 'block';
        
        cartItems.innerHTML = carrinho.map(item => `
            <div class="cart-item" data-id="${item.id}">
                <img 
                    src="${item.imagem || 'https://via.placeholder.com/100?text=Sem+Imagem'}" 
                    alt="${item.nome}"
                    class="cart-item-image"
                    onerror="this.src='https://via.placeholder.com/100?text=Sem+Imagem'"
                >
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.nome}</div>
                    <div class="cart-item-price">R$ ${formatarPreco(item.preco)}</div>
                    <div class="cart-item-controls">
                        <button class="quantity-btn" onclick="diminuirQuantidade('${item.id}')">−</button>
                        <span class="quantity-value">${item.quantidade}</span>
                        <button class="quantity-btn" onclick="aumentarQuantidade('${item.id}')">+</button>
                    </div>
                </div>
                <button class="btn-remove" onclick="removerDoCarrinho('${item.id}')">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
        `).join('');
    }
}

// Aumentar quantidade
window.aumentarQuantidade = function(produtoId) {
    const item = carrinho.find(i => i.id === produtoId);
    if (item) {
        item.quantidade++;
        atualizarCarrinho();
    }
};

// Diminuir quantidade
window.diminuirQuantidade = function(produtoId) {
    const item = carrinho.find(i => i.id === produtoId);
    if (item) {
        if (item.quantidade > 1) {
            item.quantidade--;
        } else {
            carrinho = carrinho.filter(i => i.id !== produtoId);
        }
        atualizarCarrinho();
    }
};

// Remover do carrinho
window.removerDoCarrinho = function(produtoId) {
    carrinho = carrinho.filter(item => item.id !== produtoId);
    atualizarCarrinho();
};

// Finalizar pedido
async function finalizarPedido() {
    if (carrinho.length === 0) return;
    
    try {
        showLoading();
        
        const totalPreco = carrinho.reduce((sum, item) => sum + (item.preco * item.quantidade), 0);
        
        const pedido = {
            itens: carrinho.map(item => ({
                id: item.id,
                nome: item.nome,
                preco: item.preco,
                quantidade: item.quantidade
            })),
            total: totalPreco,
            data: serverTimestamp(),
            status: 'novo'
        };
        
        const docRef = await addDoc(collection(db, 'pedidos'), pedido);
        pedidoAtualId = docRef.id;
        
        // Mostrar modal de confirmação com log de processo
        const numeroPedido = docRef.id.substring(0, 8).toUpperCase();
        orderNumber.textContent = `#${numeroPedido}`;
        
        // Adicionar log de processo ao modal
        atualizarModalComProcesso('novo');
        
        confirmModal.classList.add('active');
        
        // Monitorar status do pedido
        monitorarPedido(docRef.id);
        
        // Limpar carrinho
        carrinho = [];
        atualizarCarrinho();
        fecharCarrinho();
        
        hideLoading();
    } catch (error) {
        console.error('Erro ao finalizar pedido:', error);
        alert('Erro ao enviar pedido. Tente novamente.');
        hideLoading();
    }
}

// Atualizar modal com log de processo
function atualizarModalComProcesso(status) {
    const modalContent = confirmModal.querySelector('.modal-content');
    
    // Verificar se já existe o log de processo
    let processLog = modalContent.querySelector('.order-process-log');
    
    if (!processLog) {
        // Criar log de processo
        processLog = document.createElement('div');
        processLog.className = 'order-process-log';
        
        // Inserir antes do botão
        const btnClose = modalContent.querySelector('.btn-primary');
        modalContent.insertBefore(processLog, btnClose);
    }
    
    // Atualizar conteúdo do log
    const statusLog = [
        { status: 'novo', label: 'Novo', ativo: true },
        { status: 'preparando', label: 'Preparando', ativo: status === 'preparando' || status === 'pronto' },
        { status: 'pronto', label: 'Pronto', ativo: status === 'pronto' }
    ];
    
    processLog.innerHTML = statusLog.map((s, index) => `
        <div class="process-step ${s.ativo ? 'active' : ''}">
            <div class="process-dot"></div>
            <span class="process-label">${s.label}</span>
        </div>
        ${index < statusLog.length - 1 ? '<div class="process-line"></div>' : ''}
    `).join('');
}

// Monitorar status do pedido do cliente
function monitorarPedido(pedidoId) {
    const pedidoRef = doc(db, 'pedidos', pedidoId);
    
    onSnapshot(pedidoRef, (docSnapshot) => {
        if (docSnapshot.exists()) {
            const pedido = docSnapshot.data();
            const numeroPedido = pedidoId.substring(0, 8).toUpperCase();
            
            // Atualizar log de processo no modal se estiver aberto
            if (confirmModal.classList.contains('active')) {
                atualizarModalComProcesso(pedido.status);
            }
            
            // Notificar quando o pedido ficar pronto
            if (pedido.status === 'pronto') {
                mostrarNotificacaoPedidoPronto(numeroPedido);
            }
        }
    });
}

// Mostrar notificação quando pedido ficar pronto
function mostrarNotificacaoPedidoPronto(numeroPedido) {
    let notificacao = document.getElementById('pedidoProntoNotificacao');

    // Criar notificação apenas uma vez
    if (!notificacao) {
        notificacao = document.createElement('div');
        notificacao.id = 'pedidoProntoNotificacao';
        notificacao.className = 'pedido-pronto-notification';

        notificacao.innerHTML = `
            <div class="notification-icon">✅</div>

            <div class="notification-content">
                <strong>Seu pedido está pronto!</strong>
                <p>
                    Pedido #<span class="numero-pedido"></span>
                    está pronto para retirada!
                </p>
            </div>

            <button class="notification-close" aria-label="Fechar">
                ✖
            </button>
        `;

        document.body.appendChild(notificacao);

        // Botão fechar
        notificacao
            .querySelector('.notification-close')
            .addEventListener('click', fecharNotificacaoPedido);
    }

    // Atualizar número do pedido
    const numeroEl = notificacao.querySelector('.numero-pedido');
    if (numeroEl) {
        numeroEl.textContent = numeroPedido;
    }

    // Mostrar notificação
    notificacao.classList.add('active');

    // Tocar som
    tocarSomNotificacao();
}

// Fechar notificação
function fecharNotificacaoPedido() {
    const notificacao = document.getElementById('pedidoProntoNotificacao');
    if (notificacao) {
        notificacao.classList.remove('active');
    }
}

// Som de notificação
function tocarSomNotificacao() {
    try {
        const audio = new Audio(
            'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHW7A7+OZVA0NUrDn8bllHAU2jdXyzn0vBSd+zO/hlU0MC1ap5/KxYhwGN5DY88p5LAUmecvw45ZNDAZUpujyuGgcBzaQ2PL'
        );
        audio.volume = 0.5;
        audio.play().catch(() => {});
    } catch (e) {
        console.log('Som não disponível');
    }
}

// Setup event listeners
function setupEventListeners() {
    // Carrinho
    if (cartToggle) cartToggle.addEventListener('click', abrirCarrinho);
    if (cartClose) cartClose.addEventListener('click', fecharCarrinho);
    if (cartOverlay) cartOverlay.addEventListener('click', fecharCarrinho);
    if (btnCheckout) btnCheckout.addEventListener('click', finalizarPedido);
    
    // Modal
    if (btnCloseModal) {
        btnCloseModal.addEventListener('click', () => {
            confirmModal.classList.remove('active');
        });
    }
    
    // Fechar modal ao clicar fora
    if (confirmModal) {
        confirmModal.addEventListener('click', (e) => {
            if (e.target === confirmModal) {
                confirmModal.classList.remove('active');
            }
        });
    }
}

// Abrir carrinho
function abrirCarrinho() {
    if (cartDrawer) {
        cartDrawer.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

// Fechar carrinho
function fecharCarrinho() {
    if (cartDrawer) {
        cartDrawer.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Formatar preço
function formatarPreco(valor) {
    return parseFloat(valor).toFixed(2).replace('.', ',');
}

// Loading
function showLoading() {
    if (loading) loading.classList.add('active');
}

function hideLoading() {
    if (loading) loading.classList.remove('active');
}

console.log('✅ App do cliente inicializado!');