// app.js
// JavaScript para a pagina do cliente

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

// Estado da aplicacao
let produtos = [];
let categorias = [];
let carrinho = [];
let categoriaAtiva = 'todas';
let pedidoAtualId = null;
let configuracoes = {
    nomeCardapio:   'X-Food',
    // Logo usa pasta local por padrao — sem depender do Firebase Storage
    logoUrl:        'img/logo.jpg',
    logoLink:       '',
    corPrimaria:    '#3b82f6',
    corSecundaria:  '#64748b',
    fonte:          'DM Sans',
    tituloBemVindo: 'Bem-vindos',
    endereco:       'Av. das Hortencias, 4510 - Estrada Gramado, Gramado - RS, 95670-000, Brasil',
    whatsApp:       '5554999999999',
    whatsAppAtivo:  true,
    status:         'aberto',
    servicoLocal:   true,
    servicoRetirada:true,
    servicoDelivery:true,
    carrinhoAtivo:  true,
    chavePix:       '',
    qrCodePix:      ''
};

// Elementos do DOM
const productsContainer = document.getElementById('productsContainer');
const categoriesContainer = document.querySelector('.categories-scroll');
const cartDrawer   = document.getElementById('cartDrawer');
const cartToggle   = document.getElementById('cartToggle');
const cartClose    = document.getElementById('cartClose');
const cartOverlay  = document.getElementById('cartOverlay');
const cartItems    = document.getElementById('cartItems');
const cartEmpty    = document.getElementById('cartEmpty');
const cartFooter   = document.getElementById('cartFooter');
const cartTotal    = document.getElementById('cartTotal');
const cartCount    = document.getElementById('cartCount');
const btnCheckout  = document.getElementById('btnCheckout');
const confirmModal = document.getElementById('confirmModal');
const btnCloseModal= document.getElementById('btnCloseModal');
const orderNumber  = document.getElementById('orderNumber');
const loading      = document.getElementById('loading');

window.addEventListener('DOMContentLoaded', () => {
    initApp();
    criarModalProduto();
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

// ========================================================
// CONFIGURACOES
// ========================================================

async function carregarConfiguracoes() {
    try {
        const configRef = doc(db, 'configuracoes', 'geral');
        onSnapshot(configRef, (docSnap) => {
            if (docSnap.exists()) {
                const config = docSnap.data();
                configuracoes = { ...configuracoes, ...config };
                aplicarConfiguracoes(configuracoes);
            } else {
                aplicarConfiguracoes(configuracoes);
            }
        }, (error) => {
            console.error('Erro ao carregar configuracoes:', error);
            aplicarConfiguracoes(configuracoes);
        });
    } catch (error) {
        console.error('Erro ao configurar listener:', error);
        aplicarConfiguracoes(configuracoes);
    }
}

function aplicarConfiguracoes(config) {

    // Nome e titulo
    if (config.nomeCardapio) {
        document.title = config.nomeCardapio;
        const logoText = document.querySelector('.logo-text');
        if (logoText) logoText.textContent = config.nomeCardapio;
    }

    // ── LOGO: imagem + link clicavel ─────────────────────────────────────────
    // Usa img/logo.jpg como fallback — nunca depende do Firebase Storage
    const logoSrc = (config.logoUrl && config.logoUrl !== '#') ? config.logoUrl : 'img/logo.jpg';

    // Logo no header
    const logoImgHeader = document.querySelector('.header .logo-img');
    if (logoImgHeader) {
        logoImgHeader.src = logoSrc;
        logoImgHeader.style.display = 'inline-block';
        logoImgHeader.onerror = function() { this.src = 'img/logo.jpg'; };
    }

    // Logo icon (hero / outros lugares)
    const logoIcon = document.querySelector('.logo-icon');
    if (logoIcon) {
        logoIcon.src = logoSrc;
        logoIcon.onerror = function() { this.src = 'img/logo.jpg'; };
    }

    // Torna logo clicavel se logoLink preenchido
    if (config.logoLink) {
        [logoImgHeader, logoIcon].forEach(img => {
            if (!img) return;
            const parent = img.parentElement;
            if (parent && parent.tagName !== 'A') {
                const a = document.createElement('a');
                a.href   = config.logoLink;
                a.target = '_blank';
                a.rel    = 'noopener noreferrer';
                a.style.cssText = 'display:inline-block;cursor:pointer;';
                parent.insertBefore(a, img);
                a.appendChild(img);
            } else if (parent && parent.tagName === 'A') {
                parent.href = config.logoLink;
            }
        });
    }

    // Cores
    if (config.corPrimaria)   document.documentElement.style.setProperty('--primary-color',   config.corPrimaria);
    if (config.corSecundaria) document.documentElement.style.setProperty('--secondary-color', config.corSecundaria);

    // Fonte
    if (config.fonte && config.fonte !== 'DM Sans') {
        const fontLink = document.createElement('link');
        fontLink.rel  = 'stylesheet';
        fontLink.href = 'https://fonts.googleapis.com/css2?family=' + config.fonte.replace(' ', '+') + ':wght@300;400;500;600;700&display=swap';
        document.head.appendChild(fontLink);
        document.body.style.fontFamily = "'" + config.fonte + "', sans-serif";
    }

    // Titulo boas-vindas
    if (config.tituloBemVindo) {
        const heroTitle = document.querySelector('.hero-title');
        if (heroTitle) heroTitle.textContent = config.tituloBemVindo;
    }

    // Endereco
    if (config.endereco) {
        const heroAddress = document.querySelector('.hero-address span');
        if (heroAddress) heroAddress.textContent = config.endereco;
    }

    // WhatsApp link
    if (config.whatsApp) {
        const whatsappBtn = document.querySelector('.btn-hero-secondary[href*="wa.me"]');
        if (whatsappBtn) whatsappBtn.href = 'https://wa.me/' + config.whatsApp;
    }

    // ── WHATSAPP TOGGLE ──────────────────────────────────────────────────────
    // Oculta todos os elementos de WhatsApp se desativado no admin
    const whatsAppAtivo = config.whatsAppAtivo !== false;

    // Botao flutuante WhatsApp
    const whatsappFloat = document.querySelector('.whatsapp-float');
    if (whatsappFloat) whatsappFloat.style.display = whatsAppAtivo ? '' : 'none';

    // Botao hero WhatsApp
    const heroWhatsapp = document.querySelector('.btn-hero-secondary[href*="wa.me"]');
    if (heroWhatsapp) heroWhatsapp.style.display = whatsAppAtivo ? '' : 'none';

    // Qualquer elemento com data-whatsapp
    document.querySelectorAll('[data-whatsapp]').forEach(el => {
        el.style.display = whatsAppAtivo ? '' : 'none';
    });

    // Status
    const statusBadge = document.querySelector('.status-badge');
    if (statusBadge && config.status) {
        statusBadge.classList.remove('open', 'closed');
        if (config.status === 'aberto') {
            statusBadge.classList.add('open');
            statusBadge.innerHTML = '<span class="status-dot"></span>Aberto';
        } else {
            statusBadge.classList.add('closed');
            statusBadge.innerHTML = '<span class="status-dot"></span>Fechado';
        }
    }

    // Servicos disponiveis
    const heroFeatures = document.querySelector('.hero-features');
    if (heroFeatures) {
        const badges = [];
        if (config.servicoLocal    !== false) badges.push('<span class="hero-badge"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>No local</span>');
        if (config.servicoRetirada !== false) badges.push('<span class="hero-badge"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>Retirada</span>');
        if (config.servicoDelivery !== false) badges.push('<span class="hero-badge"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>Delivery</span>');
        heroFeatures.innerHTML = badges.join('');
    }

    // Carrinho
    const cartToggleBtn = document.getElementById('cartToggle');
    if (cartToggleBtn) {
        cartToggleBtn.style.display = config.carrinhoAtivo === false ? 'none' : 'flex';
    }

    if (produtos.length > 0) filtrarProdutos();
}

// ========================================================
// MODAL DE PRODUTO COM ADICIONAIS
// ========================================================

function criarModalProduto() {
    if (document.getElementById('productDetailModal')) return;

    const modal = document.createElement('div');
    modal.id = 'productDetailModal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-overlay" id="productModalOverlay"></div>
        <div class="modal-content product-detail-modal" id="productDetailContent">
            <button class="product-modal-close" id="productModalClose">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
            <img id="detailImage" class="detail-image" src="" alt="">
            <div class="detail-body">
                <div class="detail-header">
                    <h2 id="detailName"></h2>
                    <p id="detailDescription"></p>
                </div>
                <div id="detailExtrasSection" class="detail-extras-section" style="display:none;">
                    <h4 class="extras-title">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        Adicionais
                    </h4>
                    <div id="detailExtrasList" class="detail-extras-list"></div>
                </div>
                <div class="detail-price-section">
                    <div class="detail-price-row">
                        <span class="detail-price-label">Preco base</span>
                        <span id="detailBasePrice" class="detail-price-value"></span>
                    </div>
                    <div id="detailExtrasPrice" class="detail-price-row extras-price-row" style="display:none;">
                        <span class="detail-price-label">Adicionais</span>
                        <span id="detailExtrasPriceValue" class="detail-price-value extras-value">+ R$ 0,00</span>
                    </div>
                    <div class="detail-price-total">
                        <span>Total</span>
                        <span id="detailTotalPrice" class="detail-total-value"></span>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const style = document.createElement('style');
    style.textContent = `
        .product-detail-modal { padding:0; max-width:520px; width:100%; overflow:hidden; text-align:left; border-radius:20px; }
        .product-modal-close { position:absolute; top:14px; right:14px; background:rgba(0,0,0,.45); border:none; color:white; width:38px; height:38px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; z-index:10; transition:background .2s; }
        .product-modal-close:hover { background:rgba(0,0,0,.65); }
        .detail-image { width:100%; height:240px; object-fit:cover; display:block; background:#f1f5f9; }
        .detail-body { padding:24px; display:flex; flex-direction:column; gap:20px; }
        .detail-header h2 { font-size:1.5rem; font-weight:700; color:var(--color-secondary-dark,#1e293b); margin-bottom:8px; }
        .detail-header p { font-size:.95rem; color:var(--color-text-light,#64748b); line-height:1.6; margin:0; }
        .detail-extras-section { border-top:1px solid var(--color-border,#e2e8f0); padding-top:16px; }
        .extras-title { display:flex; align-items:center; gap:8px; font-size:1rem; font-weight:700; color:var(--color-secondary-dark,#1e293b); margin-bottom:14px; }
        .extras-title svg { color:var(--primary-color,#3b82f6); }
        .detail-extras-list { display:flex; flex-direction:column; gap:10px; }
        .extra-item { display:flex; align-items:center; justify-content:space-between; padding:12px 16px; background:var(--color-background,#f8fafc); border-radius:10px; border:2px solid transparent; cursor:pointer; transition:all .2s ease; user-select:none; }
        .extra-item:hover { border-color:var(--primary-color,#3b82f6); background:rgba(59,130,246,.05); }
        .extra-item.selected { border-color:var(--primary-color,#3b82f6); background:rgba(59,130,246,.08); }
        .extra-item-left { display:flex; align-items:center; gap:12px; }
        .extra-checkbox { width:20px; height:20px; border-radius:6px; border:2px solid var(--color-border,#e2e8f0); display:flex; align-items:center; justify-content:center; transition:all .2s; flex-shrink:0; background:white; }
        .extra-item.selected .extra-checkbox { background:var(--primary-color,#3b82f6); border-color:var(--primary-color,#3b82f6); }
        .extra-item.selected .extra-checkbox::after { content:''; display:block; width:5px; height:9px; border:2px solid white; border-top:none; border-left:none; transform:rotate(45deg) translateY(-1px); }
        .extra-name { font-size:.95rem; font-weight:500; color:var(--color-text,#1e293b); }
        .extra-price { font-size:.9rem; font-weight:600; color:var(--primary-color,#3b82f6); white-space:nowrap; }
        .extra-price.free { color:var(--color-success,#22c55e); }
        .detail-price-section { border-top:1px solid var(--color-border,#e2e8f0); padding-top:16px; display:flex; flex-direction:column; gap:8px; }
        .detail-price-row { display:flex; justify-content:space-between; align-items:center; }
        .detail-price-label { font-size:.9rem; color:var(--color-text-light,#64748b); }
        .detail-price-value { font-size:.9rem; font-weight:600; color:var(--color-text,#1e293b); }
        .extras-value { color:var(--primary-color,#3b82f6); }
        .detail-price-total { display:flex; justify-content:space-between; align-items:center; padding-top:8px; border-top:2px solid var(--color-border,#e2e8f0); margin-top:4px; }
        .detail-price-total span:first-child { font-size:1rem; font-weight:700; color:var(--color-secondary-dark,#1e293b); }
        .detail-total-value { font-size:1.6rem; font-weight:700; color:var(--primary-color,#3b82f6); }
        @media(max-width:560px){ .product-detail-modal{border-radius:16px 16px 0 0;} #productDetailModal{align-items:flex-end;} .detail-image{height:200px;} }
    `;
    document.head.appendChild(style);

    document.getElementById('productModalClose').addEventListener('click', fecharModalProduto);
    document.getElementById('productModalOverlay').addEventListener('click', fecharModalProduto);
}

function abrirModalProduto(produtoId) {
    const produto = produtos.find(p => p.id === produtoId);
    if (!produto) return;

    const modal = document.getElementById('productDetailModal');
    const imgSrc = produto.imagem || 'img/logo.jpg';

    const img = document.getElementById('detailImage');
    img.src  = imgSrc;
    img.alt  = produto.nome;
    img.onerror = () => { img.src = 'img/logo.jpg'; };

    document.getElementById('detailName').textContent        = produto.nome;
    document.getElementById('detailDescription').textContent = produto.descricao || '';
    document.getElementById('detailBasePrice').textContent   = 'R$ ' + formatarPreco(produto.preco);

    const adicionais     = produto.adicionais || [];
    const extrasSection  = document.getElementById('detailExtrasSection');
    const extrasList     = document.getElementById('detailExtrasList');

    if (adicionais.length > 0) {
        extrasSection.style.display = 'block';
        extrasList.innerHTML = adicionais.map((ad, index) => `
            <div class="extra-item" data-index="${index}" data-price="${ad.preco || 0}" onclick="toggleExtra(this)">
                <div class="extra-item-left">
                    <div class="extra-checkbox"></div>
                    <span class="extra-name">${ad.nome}</span>
                </div>
                <span class="extra-price ${!ad.preco || ad.preco == 0 ? 'free' : ''}">
                    ${!ad.preco || ad.preco == 0 ? 'Gratis' : '+ R$ ' + formatarPreco(ad.preco)}
                </span>
            </div>
        `).join('');
    } else {
        extrasSection.style.display = 'none';
        extrasList.innerHTML = '';
    }

    atualizarPrecoModal(produto.preco);
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

window.toggleExtra = function(el) {
    el.classList.toggle('selected');
    const basePriceText = document.getElementById('detailBasePrice').textContent;
    const basePrice = parseFloat(basePriceText.replace('R$ ', '').replace(',', '.'));
    let extrasTotal = 0;
    document.getElementById('productDetailModal').querySelectorAll('.extra-item.selected').forEach(item => {
        extrasTotal += parseFloat(item.dataset.price || 0);
    });
    atualizarPrecoModal(basePrice, extrasTotal);
};

function atualizarPrecoModal(basePrice, extrasTotal = 0) {
    const extrasRow       = document.getElementById('detailExtrasPrice');
    const extrasPriceValue= document.getElementById('detailExtrasPriceValue');
    const totalEl         = document.getElementById('detailTotalPrice');
    if (extrasTotal > 0) {
        extrasRow.style.display = 'flex';
        extrasPriceValue.textContent = '+ R$ ' + formatarPreco(extrasTotal);
    } else {
        extrasRow.style.display = 'none';
    }
    totalEl.textContent = 'R$ ' + formatarPreco(basePrice + extrasTotal);
}

function fecharModalProduto() {
    const modal = document.getElementById('productDetailModal');
    if (modal) { modal.classList.remove('active'); document.body.style.overflow = ''; }
}

window.abrirModalProduto = abrirModalProduto;

// ========================================================
// CATEGORIAS
// ========================================================

async function carregarCategorias() {
    try {
        const categoriasRef = collection(db, 'categorias');
        onSnapshot(categoriasRef, (snapshot) => {
            categorias = [];
            snapshot.forEach((doc) => { categorias.push({ id: doc.id, ...doc.data() }); });
            renderizarCategorias();
        });
    } catch (error) { console.error('Erro ao carregar categorias:', error); }
}

function renderizarCategorias() {
    if (!categoriesContainer) return;
    categoriesContainer.innerHTML =
        '<button class="category-btn active" data-category="todas">Todas</button>' +
        categorias.map(cat => '<button class="category-btn" data-category="' + cat.nome + '">' + cat.nome + '</button>').join('');

    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            categoriaAtiva = btn.dataset.category;
            filtrarProdutos();
        });
    });
}

// ========================================================
// PRODUTOS
// ========================================================

async function carregarProdutos() {
    try {
        const produtosRef = collection(db, 'produtos');
        onSnapshot(produtosRef, (snapshot) => {
            produtos = [];
            snapshot.forEach((doc) => {
                const produto = { id: doc.id, ...doc.data() };
                if (produto.ativo !== false) produtos.push(produto);
            });
            filtrarProdutos();
        });
    } catch (error) { console.error('Erro ao carregar produtos:', error); }
}

function filtrarProdutos() {
    const filtrados = categoriaAtiva === 'todas'
        ? produtos
        : produtos.filter(p => p.categoria === categoriaAtiva);
    renderizarProdutos(filtrados);
}

function renderizarProdutos(produtosParaExibir) {
    if (!productsContainer) return;

    if (produtosParaExibir.length === 0) {
        productsContainer.innerHTML = `
            <div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:#666;">
                <p style="font-size:1.1rem;">Nenhum produto encontrado nesta categoria</p>
            </div>`;
        return;
    }

    const porCategoria = {};
    produtosParaExibir.forEach(p => {
        const cat = p.categoria || 'Outros';
        if (!porCategoria[cat]) porCategoria[cat] = [];
        porCategoria[cat].push(p);
    });

    productsContainer.innerHTML = Object.keys(porCategoria).map(categoria => `
        <div class="category-section">
            <h2 class="category-title">${categoria}</h2>
            <div class="products-grid">
                ${porCategoria[categoria].map(produto => {
                    const temAdicionais = produto.adicionais && produto.adicionais.length > 0;
                    const imgSrc = produto.imagem || 'img/logo.jpg';
                    return `
                        <div class="product-card" data-id="${produto.id}" onclick="abrirModalProduto('${produto.id}')">
                            <img src="${imgSrc}" alt="${produto.nome}" class="product-image"
                                onerror="this.src='img/logo.jpg'">
                            <div class="product-info">
                                <h3 class="product-name">${produto.nome}</h3>
                                ${produto.descricao ? '<p class="product-description">' + produto.descricao + '</p>' : ''}
                                <div class="product-footer">
                                    <span class="product-price">R$ ${formatarPreco(produto.preco)}</span>
                                    <button class="btn-add" onclick="event.stopPropagation(); abrirModalProduto('${produto.id}')">
                                        ${temAdicionais
                                            ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg> Montar'
                                            : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg> Ver'}
                                    </button>
                                </div>
                                ${temAdicionais ? '<div class="product-extras-badge">+ ' + produto.adicionais.length + ' adicional(is)</div>' : ''}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `).join('');

    if (!document.getElementById('extrasBadgeStyle')) {
        const s = document.createElement('style');
        s.id = 'extrasBadgeStyle';
        s.textContent = '.product-extras-badge{margin-top:8px;display:inline-flex;align-items:center;gap:4px;font-size:.78rem;font-weight:600;color:var(--primary-color,#3b82f6);background:rgba(59,130,246,.08);padding:4px 10px;border-radius:20px;}';
        document.head.appendChild(s);
    }
}

// ========================================================
// CARRINHO
// ========================================================

window.adicionarAoCarrinho = function(produtoId) {
    const produto = produtos.find(p => p.id === produtoId);
    if (!produto) return;
    const item = carrinho.find(i => i.id === produtoId);
    if (item) { item.quantidade++; }
    else { carrinho.push({ id: produto.id, nome: produto.nome, preco: produto.preco, imagem: produto.imagem, quantidade: 1 }); }
    atualizarCarrinho();
};

function atualizarCarrinho() {
    const totalItens = carrinho.reduce((s, i) => s + i.quantidade, 0);
    const totalPreco = carrinho.reduce((s, i) => s + i.preco * i.quantidade, 0);
    cartCount.textContent = totalItens;
    cartTotal.textContent = 'R$ ' + formatarPreco(totalPreco);

    if (carrinho.length === 0) {
        cartItems.style.display  = 'none';
        cartEmpty.style.display  = 'flex';
        cartFooter.style.display = 'none';
    } else {
        cartItems.style.display  = 'block';
        cartEmpty.style.display  = 'none';
        cartFooter.style.display = 'block';
        cartItems.innerHTML = carrinho.map(item => `
            <div class="cart-item" data-id="${item.id}">
                <img src="${item.imagem || 'img/logo.jpg'}" alt="${item.nome}" class="cart-item-image" onerror="this.src='img/logo.jpg'">
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.nome}</div>
                    <div class="cart-item-price">R$ ${formatarPreco(item.preco)}</div>
                    <div class="cart-item-controls">
                        <button class="quantity-btn" onclick="diminuirQuantidade('${item.id}')">-</button>
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

window.aumentarQuantidade = function(id) {
    const item = carrinho.find(i => i.id === id);
    if (item) { item.quantidade++; atualizarCarrinho(); }
};

window.diminuirQuantidade = function(id) {
    const item = carrinho.find(i => i.id === id);
    if (item) {
        if (item.quantidade > 1) item.quantidade--;
        else carrinho = carrinho.filter(i => i.id !== id);
        atualizarCarrinho();
    }
};

window.removerDoCarrinho = function(id) {
    carrinho = carrinho.filter(i => i.id !== id);
    atualizarCarrinho();
};

// ========================================================
// PEDIDO
// ========================================================

async function finalizarPedido() {
    if (carrinho.length === 0) return;
    try {
        showLoading();
        const totalPreco = carrinho.reduce((s, i) => s + i.preco * i.quantidade, 0);
        const pedido = {
            itens:  carrinho.map(i => ({ id: i.id, nome: i.nome, preco: i.preco, quantidade: i.quantidade })),
            total:  totalPreco,
            data:   serverTimestamp(),
            status: 'novo'
        };
        const docRef = await addDoc(collection(db, 'pedidos'), pedido);
        pedidoAtualId = docRef.id;
        orderNumber.textContent = '#' + docRef.id.substring(0, 8).toUpperCase();
        atualizarModalComProcesso('novo');
        confirmModal.classList.add('active');
        monitorarPedido(docRef.id);
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

function atualizarModalComProcesso(status) {
    const modalContent = confirmModal.querySelector('.modal-content');
    let processLog = modalContent.querySelector('.order-process-log');
    if (!processLog) {
        processLog = document.createElement('div');
        processLog.className = 'order-process-log';
        const btnClose = modalContent.querySelector('.btn-primary');
        modalContent.insertBefore(processLog, btnClose);
    }
    const statusLog = [
        { status: 'novo',       label: 'Novo',       ativo: true },
        { status: 'preparando', label: 'Preparando', ativo: status === 'preparando' || status === 'pronto' },
        { status: 'pronto',     label: 'Pronto',     ativo: status === 'pronto' }
    ];
    processLog.innerHTML = statusLog.map((s, i) =>
        '<div class="process-step ' + (s.ativo ? 'active' : '') + '"><div class="process-dot"></div><span class="process-label">' + s.label + '</span></div>' +
        (i < statusLog.length - 1 ? '<div class="process-line"></div>' : '')
    ).join('');
}

function monitorarPedido(pedidoId) {
    const pedidoRef = doc(db, 'pedidos', pedidoId);
    onSnapshot(pedidoRef, (docSnapshot) => {
        if (docSnapshot.exists()) {
            const pedido = docSnapshot.data();
            const numeroPedido = pedidoId.substring(0, 8).toUpperCase();
            if (confirmModal.classList.contains('active')) atualizarModalComProcesso(pedido.status);
            if (pedido.status === 'pronto') mostrarNotificacaoPedidoPronto(numeroPedido);
        }
    });
}

function mostrarNotificacaoPedidoPronto(numeroPedido) {
    let notificacao = document.getElementById('pedidoProntoNotificacao');
    if (!notificacao) {
        notificacao = document.createElement('div');
        notificacao.id = 'pedidoProntoNotificacao';
        notificacao.className = 'pedido-pronto-notification';
        notificacao.innerHTML = `
            <div class="notification-icon">checkmark</div>
            <div class="notification-content">
                <strong>Seu pedido esta pronto!</strong>
                <p>Pedido #<span class="numero-pedido"></span> pronto para retirada!</p>
            </div>
            <button class="notification-close" aria-label="Fechar" onclick="document.getElementById('pedidoProntoNotificacao').classList.remove('active')">x</button>
        `;
        document.body.appendChild(notificacao);
    }
    const numeroEl = notificacao.querySelector('.numero-pedido');
    if (numeroEl) numeroEl.textContent = numeroPedido;
    notificacao.classList.add('active');
}

// ========================================================
// EVENTOS
// ========================================================

function setupEventListeners() {
    if (cartToggle)   cartToggle.addEventListener('click',   abrirCarrinho);
    if (cartClose)    cartClose.addEventListener('click',    fecharCarrinho);
    if (cartOverlay)  cartOverlay.addEventListener('click',  fecharCarrinho);
    if (btnCheckout)  btnCheckout.addEventListener('click',  finalizarPedido);
    if (btnCloseModal)btnCloseModal.addEventListener('click',() => confirmModal.classList.remove('active'));
    if (confirmModal) confirmModal.addEventListener('click', (e) => { if (e.target === confirmModal) confirmModal.classList.remove('active'); });
}

function abrirCarrinho()  { if (cartDrawer) { cartDrawer.classList.add('active');    document.body.style.overflow = 'hidden'; } }
function fecharCarrinho() { if (cartDrawer) { cartDrawer.classList.remove('active'); document.body.style.overflow = ''; } }

// ========================================================
// UTILITARIOS
// ========================================================

function formatarPreco(valor) { return parseFloat(valor).toFixed(2).replace('.', ','); }
function showLoading() { if (loading) loading.classList.add('active'); }
function hideLoading() { if (loading) loading.classList.remove('active'); }

console.log('X-Food App inicializado!');