// admin.js
// JavaScript para a pagina de administracao — X-Food

import { db, auth, storage } from './firebase-config.js';
import {
    signInWithEmailAndPassword, signOut, onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';
import {
    collection, getDocs, addDoc, doc, updateDoc, deleteDoc,
    onSnapshot, query, orderBy, serverTimestamp, setDoc, getDoc
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import {
    ref, uploadBytes, getDownloadURL
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js';

// ─── Estado ───────────────────────────────────────────────────────────────────
let produtos = [], categorias = [], pedidos = [];
let editandoProduto = null, editandoCategoria = null;
let filtroStatusPedido = 'all', filtroCategoriaProduto = 'all';
let categoriaExpandida = null, adicionaisTemp = [];
let abaConfigAtiva = 'aparencia';
let termoBusca = '';

// ─── Padrões globais ──────────────────────────────────────────────────────────
const DEFAULTS_GLOBAIS = {
    nomeCardapio:    'X-Food',
    logoUrl:         'img/logo.jpg',
    logoLink:        '',
    corPrimaria:     '#3b82f6',
    corSecundaria:   '#64748b',
    fonte:           'DM Sans',
    tituloBemVindo:  'Bem-vindos',
    endereco:        '',
    whatsApp:        '',
    whatsAppAtivo:   false,
    status:          'fechado',
    servicoLocal:    false,
    servicoRetirada: false,
    servicoDelivery: false,
    carrinhoAtivo:   false,
    chavePix:        '',
    qrCodePix:       '',
    qrCodeMenu:      '',
    dominios:        '',
    maisPedidosIds:  []
};

const DEFAULTS_ABA = {
    aparencia:       { nomeCardapio:'X-Food', logoUrl:'img/logo.jpg', logoLink:'', corPrimaria:'#3b82f6', corSecundaria:'#64748b', fonte:'DM Sans' },
    info:            { tituloBemVindo:'Bem-vindos', endereco:'', whatsApp:'', whatsAppAtivo:false, status:'fechado' },
    servicos:        { servicoLocal:false, servicoRetirada:false, servicoDelivery:false },
    funcionalidades: { carrinhoAtivo:false },
    pagamento:       { chavePix:'', qrCodePix:'' },
    qr:              { qrCodeMenu:'', dominios:'' }
};

let configuracoes = { ...DEFAULTS_GLOBAIS };

// ─── DOM ──────────────────────────────────────────────────────────────────────
const loginScreen    = document.getElementById('loginScreen');
const adminDashboard = document.getElementById('adminDashboard');
const loginForm      = document.getElementById('loginForm');
const loginError     = document.getElementById('loginError');
const btnLogout      = document.getElementById('btnLogout');
const loading        = document.getElementById('loading');
const toast          = document.getElementById('toast');
const navItems       = document.querySelectorAll('.nav-item');
const contentSections= document.querySelectorAll('.content-section');
const productsGrid   = document.getElementById('productsGrid');
const btnAddProduct  = document.getElementById('btnAddProduct');
const productModal   = document.getElementById('productModal');
const productForm    = document.getElementById('productForm');
const closeProductModal  = document.getElementById('closeProductModal');
const cancelProductModal = document.getElementById('cancelProductModal');
const modalTitle     = document.getElementById('modalTitle');
const productImageInput = document.getElementById('productImage');
const imagePreview   = document.getElementById('imagePreview');
const categoriesList = document.getElementById('categoriesList');
const btnAddCategory = document.getElementById('btnAddCategory');
const categoryModal  = document.getElementById('categoryModal');
const categoryForm   = document.getElementById('categoryForm');
const closeCategoryModal  = document.getElementById('closeCategoryModal');
const cancelCategoryModal = document.getElementById('cancelCategoryModal');
const ordersList    = document.getElementById('ordersList');
const filterButtons = document.querySelectorAll('.filter-btn');

// ─── Init ─────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => { initApp(); injetarEstilosExtras(); });

function initApp() {
    onAuthStateChanged(auth, u => { if (u) { mostrarDashboard(); carregarDados(); } else mostrarLogin(); });
    setupEventListeners();
}
function mostrarLogin()     { loginScreen.style.display='flex'; adminDashboard.style.display='none'; }
function mostrarDashboard() { loginScreen.style.display='none'; adminDashboard.style.display='flex'; }

loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    try {
        showLoading();
        await signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value);
        loginError.classList.remove('active');
        hideLoading();
    } catch {
        loginError.textContent = 'E-mail ou senha incorretos';
        loginError.classList.add('active');
        hideLoading();
    }
});

btnLogout.addEventListener('click', async () => {
    try { await signOut(auth); mostrarLogin(); showToast('Logout realizado!','success'); }
    catch { showToast('Erro ao sair','error'); }
});

function setupEventListeners() {
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const sec = item.dataset.section;
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            contentSections.forEach(s => s.classList.remove('active'));
            document.getElementById('section'+capitalize(sec))?.classList.add('active');
            if (sec==='dashboard')          atualizarDashboard();
            else if (sec==='configuracoes') renderizarConfiguracoes();
            else if (sec==='pages')         renderizarPages();
            else if (sec==='produtos')      renderizarFiltrosCategorias();
        });
    });
    btnAddProduct.addEventListener('click', () => abrirModalProduto());
    if (closeProductModal)  closeProductModal.addEventListener('click', fecharModalProduto);
    cancelProductModal.addEventListener('click', fecharModalProduto);
    productForm.addEventListener('submit', salvarProduto);
    productImageInput.addEventListener('change', previewImagem);
    document.addEventListener('input', e => { if (e.target?.id==='productImageUrl') previewImagemUrl(e.target.value.trim()); });
    btnAddCategory.addEventListener('click', () => abrirModalCategoria());
    if (closeCategoryModal)  closeCategoryModal.addEventListener('click', fecharModalCategoria);
    cancelCategoryModal.addEventListener('click', fecharModalCategoria);
    categoryForm.addEventListener('submit', salvarCategoria);
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filtroStatusPedido = btn.dataset.status;
            filtrarPedidos();
        });
    });
    productModal.addEventListener('click',  e => { if (e.target===productModal)  fecharModalProduto(); });
    categoryModal.addEventListener('click', e => { if (e.target===categoryModal) fecharModalCategoria(); });
}

async function carregarDados() {
    await carregarConfiguracoes();
    await carregarCategorias();
    await carregarProdutos();
    await carregarPedidos();
    atualizarDashboard();
}

// ─── ESTILOS EXTRAS ───────────────────────────────────────────────────────────
function injetarEstilosExtras() {
    if (document.getElementById('adminExtrasStyles')) return;
    const s = document.createElement('style');
    s.id = 'adminExtrasStyles';
    s.textContent = `
    /* ── Config tabs ── */
    .config-tabs-nav{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:24px;background:var(--bg-elevated,#1a1e28);border:1px solid var(--border);border-radius:10px;padding:6px;}
    .config-tab-btn{flex:1;min-width:90px;padding:9px 12px;background:transparent;border:none;border-radius:7px;font-size:.8rem;font-weight:600;font-family:inherit;color:var(--text-muted,#505868);cursor:pointer;transition:all .18s ease;display:flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap;}
    .config-tab-btn:hover{background:var(--bg-hover,rgba(255,255,255,.04));color:var(--text-primary,#f0f2f7);}
    .config-tab-btn.active{background:rgba(245,158,11,.12);color:var(--accent,#f59e0b);box-shadow:0 0 0 1px rgba(245,158,11,.25);}
    .config-tab-panel{display:none;}
    .config-tab-panel.active{display:block;animation:sectionFade .2s ease;}
    /* ── Toggle switch ── */
    .config-switch{display:inline-flex;align-items:center;gap:10px;cursor:pointer;user-select:none;}
    .config-switch input[type="checkbox"]{position:absolute;opacity:0;width:0;height:0;}
    .config-switch .slider{position:relative;width:44px;height:24px;background:var(--bg-base,#0d0f14);border:1px solid var(--border);border-radius:12px;transition:all .2s;flex-shrink:0;}
    .config-switch .slider:before{content:'';position:absolute;height:18px;width:18px;left:2px;top:2px;background:var(--text-muted,#505868);border-radius:50%;transition:all .2s;}
    .config-switch input:checked + .slider{background:rgba(16,185,129,.15);border-color:#10b981;}
    .config-switch input:checked + .slider:before{transform:translateX(20px);background:#10b981;}
    .switch-label{font-size:.875rem;font-weight:500;color:var(--text-primary);}
    .toggle-row{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;transition:border-color .18s;}
    .toggle-row:hover{border-color:var(--border-strong);}
    .toggle-left{display:flex;flex-direction:column;gap:3px;}
    .toggle-left strong{font-size:.875rem;font-weight:600;color:var(--text-primary);}
    .toggle-left span{font-size:.75rem;color:var(--text-muted);}
    /* ── QR / domínios ── */
    .qr-preview-box{margin-top:10px;text-align:center;}
    .qr-preview-box img{max-width:160px;border-radius:8px;border:1px solid var(--border);}
    .dominios-list{display:flex;flex-direction:column;gap:7px;margin-top:8px;}
    .dominio-item{display:flex;align-items:center;gap:8px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:7px;padding:10px 13px;font-size:.8rem;}
    .dominio-item a{color:var(--accent,#f59e0b);text-decoration:none;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .dominio-item a:hover{text-decoration:underline;}
    /* ── Adicionais ── */
    .extras-admin-section{border:1px dashed var(--border-strong,rgba(255,255,255,.14));border-radius:10px;padding:14px;background:var(--bg-elevated);}
    .extras-admin-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;}
    .extras-admin-header span{font-size:.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;}
    .extras-admin-list{display:flex;flex-direction:column;gap:8px;}
    .extra-admin-item{display:flex;align-items:center;gap:8px;background:var(--bg-surface);border:1px solid var(--border);border-radius:7px;padding:9px 12px;animation:fadeSlideIn .15s ease;}
    @keyframes fadeSlideIn{from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:translateY(0)}}
    .extra-admin-item input[type="text"],.extra-admin-item input[type="number"]{background:var(--bg-elevated);border:1px solid var(--border);border-radius:6px;padding:6px 10px;font-size:.85rem;color:var(--text-primary);font-family:inherit;outline:none;transition:border-color .18s;}
    .extra-admin-item input:focus{border-color:var(--accent);}
    .extra-nome-input{flex:1;min-width:0;}
    .extra-preco-input{width:90px;flex-shrink:0;font-family:'IBM Plex Mono',monospace;}
    .extra-preco-wrapper{display:flex;align-items:center;gap:4px;flex-shrink:0;}
    .extra-preco-wrapper span{font-size:.8rem;color:var(--text-muted);}
    .btn-add-extra{display:inline-flex;align-items:center;gap:5px;background:rgba(245,158,11,.12);color:var(--accent,#f59e0b);border:1px solid rgba(245,158,11,.25);padding:6px 12px;border-radius:6px;font-size:.8rem;font-weight:600;font-family:inherit;cursor:pointer;transition:all .18s;}
    .btn-add-extra:hover{background:var(--accent);color:#0d0f14;}
    .btn-remove-extra{background:transparent;border:none;color:var(--text-muted);cursor:pointer;padding:4px;border-radius:6px;display:flex;align-items:center;flex-shrink:0;transition:all .18s;}
    .btn-remove-extra:hover{background:var(--danger-dim,rgba(239,68,68,.12));color:var(--danger,#ef4444);}
    .extras-empty-msg{text-align:center;color:var(--text-muted);font-size:.78rem;padding:12px 0 4px;}
    /* ── Aba actions ── */
    .config-actions-aba{display:flex;gap:10px;justify-content:flex-end;margin-top:20px;padding-top:16px;border-top:1px solid var(--border);flex-wrap:wrap;}
    .btn-reset-aba{background:transparent;color:var(--text-muted);border:1px solid var(--border);padding:8px 14px;border-radius:var(--radius-sm,6px);font-size:.8rem;font-weight:500;font-family:inherit;cursor:pointer;transition:all .18s;display:inline-flex;align-items:center;gap:6px;}
    .btn-reset-aba:hover{border-color:var(--warning,#f59e0b);color:var(--warning,#f59e0b);background:rgba(245,158,11,.06);}

    /* ══════════════════════════════════════
       BARRA DE BUSCA DE PRODUTOS
    ══════════════════════════════════════ */
    .produtos-search-bar{
        display:flex;align-items:center;gap:10px;
        padding:11px 16px;
        background:var(--bg-surface);
        border:1px solid var(--border);
        border-radius:var(--radius,4px);
        margin-bottom:14px;
        transition:border-color .18s,box-shadow .18s;
    }
    .produtos-search-bar:focus-within{
        border-color:var(--primary,#00ffe0);
        box-shadow:0 0 0 3px rgba(0,255,224,.1),0 0 12px rgba(0,255,224,.12);
    }
    .produtos-search-bar .search-icon-svg{
        flex-shrink:0;color:var(--text-muted);transition:color .18s;
    }
    .produtos-search-bar:focus-within .search-icon-svg{
        color:var(--primary,#00ffe0);
    }
    #searchProdutos{
        flex:1;background:transparent;border:none;outline:none;
        font-size:.88rem;font-family:'Rajdhani',sans-serif;letter-spacing:.04em;
        color:var(--text-primary);
    }
    #searchProdutos::placeholder{color:var(--text-muted);}
    .search-results-count{
        font-size:.72rem;font-family:'Rajdhani',sans-serif;
        letter-spacing:.06em;text-transform:uppercase;
        color:var(--text-muted);white-space:nowrap;flex-shrink:0;
    }
    .search-clear-btn{
        background:transparent;border:none;cursor:pointer;
        color:var(--text-muted);padding:3px 7px;border-radius:4px;
        font-size:.75rem;display:none;transition:all .18s;line-height:1;
    }
    .search-clear-btn:hover{color:var(--danger,#ff1744);background:var(--danger-dim,rgba(255,23,68,.1));}
    .search-clear-btn.visible{display:block;}

    /* ══════════════════════════════════════
       ABA MAIS PEDIDOS
    ══════════════════════════════════════ */
    .mais-pedidos-filter-btn{
        display:inline-flex;align-items:center;gap:6px;
        padding:6px 14px;
        border:1px solid rgba(255,230,0,.3);
        background:rgba(255,230,0,.05);
        border-radius:var(--radius-sm,3px);
        font-size:.72rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;
        font-family:'Rajdhani',sans-serif;
        color:rgba(255,230,0,.8);
        cursor:pointer;transition:all .18s;
    }
    .mais-pedidos-filter-btn:hover{
        background:rgba(255,230,0,.12);border-color:rgba(255,230,0,.5);
        box-shadow:0 0 8px rgba(255,230,0,.15);color:var(--accent-gold,#ffe600);
    }
    .mais-pedidos-filter-btn.active{
        background:rgba(255,230,0,.12);border-color:var(--accent-gold,#ffe600);
        color:var(--accent-gold,#ffe600);box-shadow:0 0 10px rgba(255,230,0,.2);
    }
    .mais-pedidos-badge{
        display:inline-flex;align-items:center;justify-content:center;
        background:var(--accent-gold,#ffe600);color:#02000a;
        font-size:.6rem;font-weight:900;
        width:17px;height:17px;border-radius:50%;line-height:1;
    }

    /* Botão estrela no card */
    .mais-pedidos-star{
        position:absolute;top:10px;right:10px;z-index:11;
        background:rgba(2,0,10,.75);
        border:1px solid rgba(255,230,0,.2);
        width:30px;height:30px;border-radius:var(--radius-sm,3px);
        display:flex;align-items:center;justify-content:center;
        cursor:pointer;transition:all .18s;font-size:.85rem;
        filter:grayscale(1);opacity:.5;
    }
    .mais-pedidos-star:hover{
        filter:grayscale(0);opacity:1;
        background:rgba(255,230,0,.12);border-color:rgba(255,230,0,.5);
        box-shadow:0 0 8px rgba(255,230,0,.2);
    }
    .mais-pedidos-star.ativo{
        filter:grayscale(0);opacity:1;
        background:rgba(255,230,0,.15);border-color:var(--accent-gold,#ffe600);
        box-shadow:0 0 10px rgba(255,230,0,.3);
    }

    /* Separador de seção no grid */
    .grid-section-header{
        grid-column:1/-1;
        display:flex;align-items:center;gap:10px;
        padding:9px 14px;
        border-radius:var(--radius,4px);
        margin-top:4px;margin-bottom:2px;
    }
    .grid-section-header.gold{
        background:linear-gradient(90deg,rgba(255,230,0,.08),transparent);
        border:1px solid rgba(255,230,0,.18);
    }
    .grid-section-header.teal{
        background:linear-gradient(90deg,rgba(0,255,224,.04),transparent);
        border:1px solid rgba(0,255,224,.1);
    }
    .grid-section-header span{
        font-family:'Orbitron',sans-serif;
        font-size:.65rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;
    }
    .grid-section-header.gold span{color:var(--accent-gold,#ffe600);text-shadow:0 0 8px rgba(255,230,0,.3);}
    .grid-section-header.teal span{color:var(--text-muted);}

    /* Tag no card */
    .tag-mais-pedidos{
        display:inline-flex;align-items:center;gap:4px;
        font-size:.62rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
        font-family:'Rajdhani',sans-serif;
        color:var(--accent-gold,#ffe600);
        margin:4px 0 0;
    }

    /* ══════════════════════════════════════
       BOTÃO E ESTILOS DE PROMOÇÃO (ADMIN)
    ══════════════════════════════════════ */
    /* ── Botão promoção inline (ao lado do preço) ── */
    .promo-inline-btn{
        display:inline-flex;align-items:center;justify-content:center;
        width:30px;height:30px;border-radius:var(--radius-sm,3px);
        background:rgba(2,0,10,.75);
        border:1px solid rgba(249,115,22,.25);
        cursor:pointer;transition:all .18s;font-size:.85rem;
        filter:grayscale(1);opacity:.5;flex-shrink:0;
    }
    .promo-inline-btn:hover{
        filter:grayscale(0);opacity:1;
        background:rgba(249,115,22,.12);border-color:rgba(249,115,22,.5);
        box-shadow:0 0 8px rgba(249,115,22,.2);
    }
    .promo-inline-btn.ativo{
        filter:grayscale(0);opacity:1;
        background:rgba(249,115,22,.18);border-color:#f97316;
        box-shadow:0 0 10px rgba(249,115,22,.35);
        animation:promoPulse 2s infinite;
    }
    @keyframes promoPulse{0%,100%{box-shadow:0 0 10px rgba(249,115,22,.35)}50%{box-shadow:0 0 18px rgba(249,115,22,.6)}}
    .preco-original-admin{
        text-decoration:line-through;color:var(--text-muted);font-size:.8rem;display:block;
    }
    .preco-promo-admin{
        color:#f97316;font-weight:800;font-size:1rem;display:block;
    }
    
    .no-results-msg{
        grid-column:1/-1;text-align:center;padding:60px 20px;
        color:var(--text-muted);font-family:'Rajdhani',sans-serif;
        font-size:.88rem;letter-spacing:.1em;text-transform:uppercase;
        line-height:1.8;
    }
    .no-results-msg strong{color:var(--text-primary);}
    `;
    document.head.appendChild(s);
}

// ─── CONFIGURAÇÕES ────────────────────────────────────────────────────────────
async function carregarConfiguracoes() {
    try {
        const snap = await getDoc(doc(db,'configuracoes','geral'));
        if (snap.exists()) configuracoes = { ...configuracoes, ...snap.data() };
        if (!Array.isArray(configuracoes.maisPedidosIds)) configuracoes.maisPedidosIds = [];
    } catch(e) { console.error(e); }
}

window.mudarAbaConfig = function(aba) {
    abaConfigAtiva = aba;
    document.querySelectorAll('.config-tab-btn').forEach(b  => b.classList.toggle('active',  b.dataset.aba===aba));
    document.querySelectorAll('.config-tab-panel').forEach(p => p.classList.toggle('active', p.dataset.aba===aba));
};

function ck(v) { return v===true ? 'checked' : ''; }
function tabBtn(id, label, icon) {
    return `<button class="config-tab-btn ${abaConfigAtiva===id?'active':''}" data-aba="${id}" onclick="mudarAbaConfig('${id}')">${icon}${label}</button>`;
}
function panelOpen(id)  { return `<div class="config-tab-panel ${abaConfigAtiva===id?'active':''}" data-aba="${id}">`; }
function panelClose()   { return `</div>`; }

function abaActions(aba) {
    return `
    <div class="config-actions-aba">
        <button class="btn-reset-aba" onclick="resetarAba('${aba}')">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.46"/></svg>
            Restaurar padrão desta aba
        </button>
        <button class="btn-primary" onclick="salvarConfiguracoes()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            Salvar
        </button>
    </div>`;
}

window.resetarAba = function(aba) {
    if (!DEFAULTS_ABA[aba]) return;
    if (!confirm('Restaurar os padrões apenas desta aba?\n\nIsso não salva automaticamente — clique em "Salvar" para confirmar.')) return;
    configuracoes = { ...configuracoes, ...DEFAULTS_ABA[aba] };
    abaConfigAtiva = aba;
    renderizarConfiguracoes();
    showToast('Padrão restaurado! Clique em Salvar para aplicar.', 'info');
};

function renderizarConfiguracoes() {
    const cc = document.getElementById('configContainer');
    if (!cc) return;
    const cfg = configuracoes;

    cc.innerHTML = `
    <div class="config-tabs-nav">
        ${tabBtn('aparencia',       'Aparência',       '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>')}
        ${tabBtn('info',            'Informações',     '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>')}
        ${tabBtn('servicos',        'Serviços',        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>')}
        ${tabBtn('funcionalidades', 'Funcionalidades', '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>')}
        ${tabBtn('pagamento',       'Pagamento',       '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>')}
        ${tabBtn('qr',              'QR / Links',      '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>')}
    </div>

    ${panelOpen('aparencia')}
        <div class="config-section">
            <h3 class="config-title">🎨 Identidade Visual</h3>
            <div class="config-grid">
                <div class="config-field">
                    <label>Nome do Cardápio</label>
                    <input type="text" id="configNome" value="${cfg.nomeCardapio||'X-Food'}" class="config-input">
                </div>
                <div class="config-field">
                    <label>Cor Primária</label>
                    <input type="color" id="configCorPrimaria" value="${cfg.corPrimaria||'#3b82f6'}" class="config-input">
                </div>
                <div class="config-field">
                    <label>Cor Secundária</label>
                    <input type="color" id="configCorSecundaria" value="${cfg.corSecundaria||'#64748b'}" class="config-input">
                </div>
                <div class="config-field">
                    <label>Fonte</label>
                    <select id="configFonte" class="config-input">
                        <option value="DM Sans"    ${cfg.fonte==='DM Sans'?'selected':''}>DM Sans</option>
                        <option value="Roboto"     ${cfg.fonte==='Roboto'?'selected':''}>Roboto</option>
                        <option value="Open Sans"  ${cfg.fonte==='Open Sans'?'selected':''}>Open Sans</option>
                        <option value="Montserrat" ${cfg.fonte==='Montserrat'?'selected':''}>Montserrat</option>
                        <option value="Poppins"    ${cfg.fonte==='Poppins'?'selected':''}>Poppins</option>
                    </select>
                </div>
                <div class="config-field full-width">
                    <label>🖼️ Logo — URL da Imagem</label>
                    <input type="url" id="configLogoUrl" value="${cfg.logoUrl||'img/logo.jpg'}" class="config-input" placeholder="https://... ou img/logo.jpg">
                    <small>Use <strong>img/logo.jpg</strong> para a pasta local, ou cole uma URL externa.</small>
                    <div id="logoPreviewContainer" style="margin-top:8px;">
                        ${cfg.logoUrl ? `<div class="image-preview-uploaded"><img src="${cfg.logoUrl}" style="max-height:72px;border-radius:8px;"></div>` : ''}
                    </div>
                </div>
                <div class="config-field full-width">
                    <label>🔗 Logo — Link ao Clicar <span style="color:var(--text-muted);font-weight:400">(opcional)</span></label>
                    <input type="url" id="configLogoLink" value="${cfg.logoLink||''}" class="config-input" placeholder="https://seusite.com.br">
                    <small>Quando preenchido, a logo vira um link clicável.</small>
                </div>
            </div>
        </div>
        ${abaActions('aparencia')}
    ${panelClose()}

    ${panelOpen('info')}
        <div class="config-section">
            <h3 class="config-title">🏠 Estabelecimento</h3>
            <div class="config-grid">
                <div class="config-field full-width">
                    <label>Título de Boas-Vindas</label>
                    <input type="text" id="configTituloBemVindo" value="${cfg.tituloBemVindo||'Bem-vindos'}" class="config-input">
                </div>
                <div class="config-field full-width">
                    <label>Endereço Completo</label>
                    <input type="text" id="configEndereco" value="${cfg.endereco||''}" class="config-input" placeholder="Rua Exemplo, 123 - Cidade - UF">
                </div>
                <div class="config-field">
                    <label>Status</label>
                    <select id="configStatus" class="config-input">
                        <option value="aberto"  ${cfg.status==='aberto'?'selected':''}>🟢 Aberto</option>
                        <option value="fechado" ${cfg.status!=='aberto'?'selected':''}>🔴 Fechado</option>
                    </select>
                </div>
            </div>
        </div>
        <div class="config-section">
            <h3 class="config-title">💬 WhatsApp</h3>
            <div class="config-grid">
                <div class="config-field full-width">
                    <div class="toggle-row">
                        <div class="toggle-left">
                            <strong>Botão WhatsApp no site</strong>
                            <span>Exibe ou oculta o botão para os clientes. Desativado por padrão.</span>
                        </div>
                        <label class="config-switch">
                            <input type="checkbox" id="configWhatsAppAtivo" ${ck(cfg.whatsAppAtivo)}>
                            <span class="slider"></span>
                        </label>
                    </div>
                </div>
                <div class="config-field">
                    <label>Número WhatsApp</label>
                    <input type="text" id="configWhatsApp" value="${cfg.whatsApp||''}" class="config-input" placeholder="5554999999999">
                    <small>DDI + DDD + Número, sem espaços</small>
                </div>
            </div>
        </div>
        ${abaActions('info')}
    ${panelClose()}

    ${panelOpen('servicos')}
        <div class="config-section">
            <h3 class="config-title">🏷️ Tipos de Atendimento</h3>
            <p style="font-size:.8rem;color:var(--text-muted);margin-bottom:18px;">Ative apenas os serviços que seu estabelecimento oferece. Todos desativados por padrão.</p>
            <div class="config-grid">
                <div class="config-field full-width">
                    <div class="toggle-row">
                        <div class="toggle-left"><strong>🏠 No Local</strong><span>Cliente consome no estabelecimento</span></div>
                        <label class="config-switch"><input type="checkbox" id="configServicoLocal" ${ck(cfg.servicoLocal)}><span class="slider"></span></label>
                    </div>
                </div>
                <div class="config-field full-width">
                    <div class="toggle-row">
                        <div class="toggle-left"><strong>🚗 Retirada</strong><span>Cliente retira o pedido no local</span></div>
                        <label class="config-switch"><input type="checkbox" id="configServicoRetirada" ${ck(cfg.servicoRetirada)}><span class="slider"></span></label>
                    </div>
                </div>
                <div class="config-field full-width">
                    <div class="toggle-row">
                        <div class="toggle-left"><strong>🛵 Delivery</strong><span>Entrega no endereço do cliente</span></div>
                        <label class="config-switch"><input type="checkbox" id="configServicoDelivery" ${ck(cfg.servicoDelivery)}><span class="slider"></span></label>
                    </div>
                </div>
            </div>
        </div>
        ${abaActions('servicos')}
    ${panelClose()}

    ${panelOpen('funcionalidades')}
        <div class="config-section">
            <h3 class="config-title">⚙️ Funcionalidades do Cardápio</h3>
            <p style="font-size:.8rem;color:var(--text-muted);margin-bottom:18px;">Controle o que fica visível para os clientes. Desativado por padrão.</p>
            <div class="config-grid">
                <div class="config-field full-width">
                    <div class="toggle-row">
                        <div class="toggle-left"><strong>🛒 Carrinho de Compras</strong><span>Clientes podem adicionar itens e fazer pedidos. Desativado por padrão.</span></div>
                        <label class="config-switch"><input type="checkbox" id="configCarrinho" ${ck(cfg.carrinhoAtivo)}><span class="slider"></span></label>
                    </div>
                </div>
            </div>
        </div>
        ${abaActions('funcionalidades')}
    ${panelClose()}

    ${panelOpen('pagamento')}
        <div class="config-section">
            <h3 class="config-title">💳 Pagamento PIX</h3>
            <div class="config-grid">
                <div class="config-field">
                    <label>Chave PIX</label>
                    <input type="text" id="configChavePix" value="${cfg.chavePix||''}" class="config-input" placeholder="email, CPF, telefone...">
                </div>
                <div class="config-field full-width">
                    <label>QR Code PIX — URL da imagem</label>
                    <input type="url" id="configQrCodePix" value="${cfg.qrCodePix||''}" class="config-input" placeholder="https://... URL da imagem do QR Code">
                    ${cfg.qrCodePix ? `<div class="qr-preview-box"><img src="${cfg.qrCodePix}" alt="QR PIX"></div>` : ''}
                </div>
            </div>
        </div>
        ${abaActions('pagamento')}
    ${panelClose()}

    ${panelOpen('qr')}
        <div class="config-section">
            <h3 class="config-title">📱 QR Code do Menu</h3>
            <div class="config-grid">
                <div class="config-field full-width">
                    <label>URL do Menu Digital</label>
                    <input type="url" id="configMenuUrl" value="https://exceedparkcardapio.vercel.app/menu.html" class="config-input" readonly style="opacity:.55;cursor:default;">
                    <small>Link do cardápio para compartilhar com clientes.</small>
                </div>
                <div class="config-field full-width">
                    <label>QR Code do Menu — URL da imagem</label>
                    <input type="url" id="configQrCodeMenu" value="${cfg.qrCodeMenu||''}" class="config-input" placeholder="https://... URL da imagem do QR Code" oninput="window.previewQrMenu(this.value)">
                    <small>Cole a URL de um QR Code gerado externamente.</small>
                    <div id="qrMenuPreviewContainer" class="qr-preview-box">
                        ${cfg.qrCodeMenu
                            ? `<img src="${cfg.qrCodeMenu}" alt="QR Menu">`
                            : `<span style="font-size:.75rem;color:var(--text-muted);">Nenhuma imagem configurada</span>`}
                    </div>
                    <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
                        <a href="https://exceedparkcardapio.vercel.app/menu.html" target="_blank" class="btn-secondary" style="font-size:.8rem;padding:7px 14px;text-decoration:none;">🔗 Abrir Menu</a>
                        <button type="button" class="btn-secondary" style="font-size:.8rem;padding:7px 14px;" onclick="window.gerarQrMenuExterno()">⚙️ Gerar QR Code</button>
                    </div>
                </div>
            </div>
        </div>
        <div class="config-section">
            <h3 class="config-title">🌐 Domínios e Links do Projeto</h3>
            <div class="config-grid">
                <div class="config-field full-width">
                    <label>Links <span style="color:var(--text-muted);font-weight:400;">(um por linha)</span></label>
                    <textarea id="configDominios" rows="4" class="config-input" placeholder="https://exceedparkcardapio.vercel.app" style="resize:vertical;">${cfg.dominios||''}</textarea>
                    <small>Atalhos para acessar rapidamente os links do projeto.</small>
                </div>
                <div class="config-field full-width" id="dominiosListContainer">
                    ${renderizarListaDominios(cfg.dominios||'')}
                </div>
            </div>
        </div>
        ${abaActions('qr')}
    ${panelClose()}`;

    document.getElementById('configLogoUrl')?.addEventListener('input', e => {
        const c = document.getElementById('logoPreviewContainer');
        if (!c) return;
        c.innerHTML = e.target.value
            ? `<div class="image-preview-uploaded"><img src="${e.target.value}" style="max-height:72px;border-radius:8px;" onerror="this.parentElement.innerHTML='<span style=color:#ef4444;font-size:.8rem>URL inválida</span>'"></div>`
            : '';
    });
    document.getElementById('configDominios')?.addEventListener('input', e => {
        const c = document.getElementById('dominiosListContainer');
        if (c) c.innerHTML = renderizarListaDominios(e.target.value);
    });
}

function renderizarListaDominios(texto) {
    if (!texto?.trim()) return '';
    const links = texto.split('\n').map(l=>l.trim()).filter(Boolean);
    if (!links.length) return '';
    return `<div class="dominios-list">${links.map(lk=>`
        <div class="dominio-item">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            <a href="${lk}" target="_blank">${lk}</a>
            <button onclick="navigator.clipboard.writeText('${lk}').then(()=>showToast('Copiado!','success'))"
                style="background:transparent;border:none;cursor:pointer;color:var(--text-muted);padding:2px 6px;border-radius:4px;" title="Copiar">📋</button>
        </div>`).join('')}</div>`;
}

window.previewQrMenu = function(url) {
    const c = document.getElementById('qrMenuPreviewContainer');
    if (!c) return;
    c.innerHTML = url
        ? `<img src="${url}" alt="QR Menu" onerror="this.parentElement.innerHTML='<span style=font-size:.75rem;color:#ef4444>URL inválida</span>'">`
        : `<span style="font-size:.75rem;color:var(--text-muted);">Nenhuma imagem configurada</span>`;
};
window.gerarQrMenuExterno = function() {
    window.open('https://www.qr-code-generator.com/?url='+encodeURIComponent('https://exceedparkcardapio.vercel.app/menu.html'),'_blank');
};

function getValOr(id, fallback) {
    const el = document.getElementById(id);
    if (!el) return fallback;
    return el.type==='checkbox' ? el.checked : (el.value ?? fallback);
}

window.salvarConfiguracoes = async function() {
    try {
        showLoading();
        const n = {
            nomeCardapio:    getValOr('configNome',           configuracoes.nomeCardapio),
            logoUrl:         getValOr('configLogoUrl',        configuracoes.logoUrl) || 'img/logo.jpg',
            logoLink:        getValOr('configLogoLink',       configuracoes.logoLink),
            corPrimaria:     getValOr('configCorPrimaria',    configuracoes.corPrimaria),
            corSecundaria:   getValOr('configCorSecundaria',  configuracoes.corSecundaria),
            fonte:           getValOr('configFonte',          configuracoes.fonte),
            tituloBemVindo:  getValOr('configTituloBemVindo', configuracoes.tituloBemVindo),
            endereco:        getValOr('configEndereco',       configuracoes.endereco),
            whatsApp:        getValOr('configWhatsApp',       configuracoes.whatsApp),
            whatsAppAtivo:   getValOr('configWhatsAppAtivo',  configuracoes.whatsAppAtivo),
            status:          getValOr('configStatus',         configuracoes.status),
            servicoLocal:    getValOr('configServicoLocal',   configuracoes.servicoLocal),
            servicoRetirada: getValOr('configServicoRetirada',configuracoes.servicoRetirada),
            servicoDelivery: getValOr('configServicoDelivery',configuracoes.servicoDelivery),
            carrinhoAtivo:   getValOr('configCarrinho',       configuracoes.carrinhoAtivo),
            chavePix:        getValOr('configChavePix',       configuracoes.chavePix),
            qrCodePix:       getValOr('configQrCodePix',      configuracoes.qrCodePix),
            qrCodeMenu:      getValOr('configQrCodeMenu',     configuracoes.qrCodeMenu),
            dominios:        getValOr('configDominios',       configuracoes.dominios),
            maisPedidosIds:  configuracoes.maisPedidosIds || []
        };
        await setDoc(doc(db,'configuracoes','geral'), n);
        configuracoes = n;
        showToast('Configurações salvas!','success');
        hideLoading();
    } catch { showToast('Erro ao salvar','error'); hideLoading(); }
};

window.resetarConfiguracoes = function() {
    if (!confirm('Restaurar TODOS os padrões globais? (tudo será desativado)')) return;
    configuracoes = { ...DEFAULTS_GLOBAIS };
    renderizarConfiguracoes();
    showToast('Padrões restaurados! Clique em Salvar para aplicar.','info');
};

// ─── PAGES ────────────────────────────────────────────────────────────────────
function renderizarPages() {
    const pc = document.getElementById('pagesContainer');
    if (!pc) return;
    const base = window.location.origin + window.location.pathname.replace('admin.html','');
    pc.innerHTML = `
        <div class="pages-intro"><h3>📄 Links das Páginas</h3><p>Compartilhe estes links ou exiba em telões</p></div>
        <div class="pages-grid">
            <div class="page-card">
                <div class="page-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg></div>
                <h4>Cardápio Digital</h4><p>Página principal com produtos e pedidos</p>
                <div class="page-url"><input type="text" value="${base}index.html" readonly class="url-input" id="urlCardapio"><button class="btn-copy" onclick="copiarUrl('urlCardapio')">Copiar</button></div>
                <div class="page-actions"><a href="${base}index.html" target="_blank" class="btn-page">Abrir</a><button class="btn-page secondary" onclick="gerarQRCode('${base}index.html')">QR Code</button></div>
            </div>
            <div class="page-card">
                <div class="page-icon orange"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
                <h4>Acompanhamento de Pedidos</h4><p>Telão público em tempo real</p>
                <div class="page-url"><input type="text" value="${base}Pedidos.html" readonly class="url-input" id="urlPedidos"><button class="btn-copy" onclick="copiarUrl('urlPedidos')">Copiar</button></div>
                <div class="page-actions"><a href="${base}Pedidos.html" target="_blank" class="btn-page">Abrir</a><button class="btn-page secondary" onclick="gerarQRCode('${base}Pedidos.html')">QR Code</button></div>
            </div>
        </div>
        <div class="modal" id="qrModal" style="display:none;"><div class="modal-overlay" onclick="fecharQRModal()"></div><div class="modal-content qr-modal-content"><button class="modal-close" onclick="fecharQRModal()"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button><h3>QR Code Gerado</h3><div id="qrCodeContainer"></div><p class="qr-instructions">Clique com botão direito para salvar</p></div></div>`;
}
window.copiarUrl = id => { const e = document.getElementById(id); if (!e) return; e.select(); document.execCommand('copy'); showToast('Link copiado!','success'); };
window.gerarQRCode = url => {
    const m = document.getElementById('qrModal'), c = document.getElementById('qrCodeContainer');
    if (!m||!c) return;
    c.innerHTML = `<img src="https://chart.googleapis.com/chart?cht=qr&chs=300x300&chl=${encodeURIComponent(url)}" style="max-width:100%;border-radius:8px;">`;
    m.style.display = 'flex';
};
window.fecharQRModal = () => { const m=document.getElementById('qrModal'); if(m) m.style.display='none'; };

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function atualizarDashboard() {
    const dc = document.getElementById('dashboardContainer');
    if (!dc) return;
    const total  = produtos.length;
    const ativos = produtos.filter(p=>p.ativo!==false).length;
    const totPed = pedidos.length;
    const novos  = pedidos.filter(p=>p.status==='novo').length;
    const prep   = pedidos.filter(p=>p.status==='preparando').length;
    const prontos= pedidos.filter(p=>p.status==='pronto').length;
    const porCat = {};
    produtos.forEach(p => { const c=p.categoria||'Sem categoria'; porCat[c]=(porCat[c]||0)+1; });
    const ranking = calcularRanking();
    const carrinhoOk = configuracoes.carrinhoAtivo===true;
    const qtdDestaque = (configuracoes.maisPedidosIds||[]).length;

    dc.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card"><div class="stat-icon blue"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg></div><div class="stat-info"><span class="stat-label">Total Produtos</span><span class="stat-value">${total}</span></div></div>
            <div class="stat-card"><div class="stat-icon green"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></div><div class="stat-info"><span class="stat-label">Ativos</span><span class="stat-value">${ativos}</span></div></div>
            <div class="stat-card"><div class="stat-icon gray"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg></div><div class="stat-info"><span class="stat-label">Inativos</span><span class="stat-value">${total-ativos}</span></div></div>
            <div class="stat-card"><div class="stat-icon orange"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div><div class="stat-info"><span class="stat-label">Total Pedidos</span><span class="stat-value">${totPed}</span></div></div>
            <div class="stat-card" style="border-color:rgba(255,230,0,.2);">
                <div class="stat-icon" style="background:rgba(255,230,0,.08);color:#ffe600;">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                </div>
                <div class="stat-info"><span class="stat-label">Mais Pedidos</span><span class="stat-value" style="color:#ffe600;">${qtdDestaque}</span></div>
            </div>
        </div>
        <div class="charts-grid">
            <div class="chart-card">
                <h3 class="chart-title">Produtos por Categoria</h3>
                <div class="chart-bars">${Object.entries(porCat).map(([c,n])=>`<div class="chart-bar-item"><div class="chart-bar-label"><span>${c}</span><span>${n}</span></div><div class="chart-bar-track"><div class="chart-bar-fill" style="width:${total>0?(n/total)*100:0}%"></div></div></div>`).join('')}</div>
            </div>
            <div class="chart-card">
                <h3 class="chart-title">Status dos Pedidos</h3>
                <div class="chart-bars">
                    <div class="chart-bar-item"><div class="chart-bar-label"><span>Novos</span><span>${novos}</span></div><div class="chart-bar-track"><div class="chart-bar-fill blue" style="width:${totPed>0?(novos/totPed)*100:0}%"></div></div></div>
                    <div class="chart-bar-item"><div class="chart-bar-label"><span>Preparando</span><span>${prep}</span></div><div class="chart-bar-track"><div class="chart-bar-fill orange" style="width:${totPed>0?(prep/totPed)*100:0}%"></div></div></div>
                    <div class="chart-bar-item"><div class="chart-bar-label"><span>Prontos</span><span>${prontos}</span></div><div class="chart-bar-track"><div class="chart-bar-fill green" style="width:${totPed>0?(prontos/totPed)*100:0}%"></div></div></div>
                </div>
            </div>
        </div>
        <div class="ranking-section">
            <h3 class="chart-title">🏆 Ranking de Produtos <span class="ranking-status ${carrinhoOk?'enabled':'disabled'}">${carrinhoOk?'Ativo':'Carrinho desativado'}</span></h3>
            ${!carrinhoOk||!ranking.length
                ? `<div class="ranking-disabled-message"><p>${!carrinhoOk?'Carrinho desativado.':'Nenhum pedido registrado.'}</p></div>`
                : `<div class="ranking-list">${ranking.map((p,i)=>{
                    const cores=['#fbbf24','#9ca3af','#cd7f32'];
                    return `<div class="ranking-item"><div class="ranking-position" style="background:${cores[i]||'#64748b'}">${i+1}</div><div class="ranking-info"><div class="ranking-product-name">${p.nome}</div><div class="ranking-product-category">${p.categoria}</div></div><div class="ranking-bar"><div class="ranking-bar-fill" style="width:${(p.quantidade/ranking[0].quantidade)*100}%"></div></div><div class="ranking-quantity">${p.quantidade} pedido(s)</div></div>`;
                }).join('')}</div>`}
        </div>`;
}

function calcularRanking() {
    const map = {};
    pedidos.forEach(pd => {
        (pd.itens||[]).forEach(it => {
            if (!map[it.nome]) { const o=produtos.find(p=>p.nome===it.nome); map[it.nome]={nome:it.nome,quantidade:0,categoria:o?.categoria||''}; }
            map[it.nome].quantidade += it.quantidade;
        });
    });
    return Object.values(map).sort((a,b)=>b.quantidade-a.quantidade).slice(0,10);
}

// ─── CATEGORIAS ───────────────────────────────────────────────────────────────
async function carregarCategorias() {
    try {
        onSnapshot(collection(db,'categorias'), snap => {
            categorias = [];
            snap.forEach(d => categorias.push({id:d.id,...d.data()}));
            renderizarCategorias(); atualizarSelectCategorias(); renderizarFiltrosCategorias();
        });
    } catch { showToast('Erro ao carregar categorias','error'); }
}

function renderizarCategorias() {
    if (!categoriesList) return;
    if (!categorias.length) { categoriesList.innerHTML='<div style="text-align:center;padding:40px;color:var(--text-muted);">Nenhuma categoria</div>'; return; }
    categoriesList.innerHTML = categorias.map(cat => {
        const prods = produtos.filter(p=>p.categoria===cat.nome);
        const exp   = categoriaExpandida===cat.id;
        return `<div class="category-item-wrapper">
            <div class="category-item" onclick="window.toggleCategoria('${cat.id}')">
                <div class="category-info"><span class="category-name">${cat.nome}</span><span class="category-count">${prods.length} produto(s)</span></div>
                <div class="category-actions" onclick="event.stopPropagation()">
                    <button class="btn-icon-sm" onclick="window.editarCategoria('${cat.id}')">✏️</button>
                    <button class="btn-icon-sm danger" onclick="window.excluirCategoria('${cat.id}')">🗑️</button>
                </div>
            </div>
            ${exp?`<div class="category-products">${prods.length
                ?prods.map(p=>`<div class="category-product-item"><span>${p.nome}</span><span class="category-product-price">R$ ${fmt(p.preco)}</span><span class="category-product-status ${p.ativo!==false?'active':'inactive'}">${p.ativo!==false?'Ativo':'Inativo'}</span></div>`).join('')
                :'<p style="color:var(--text-muted);padding:16px;text-align:center;">Nenhum produto</p>'
            }</div>`:''}</div>`;
    }).join('');
}

window.toggleCategoria  = id => { categoriaExpandida = categoriaExpandida===id?null:id; renderizarCategorias(); };
window.editarCategoria  = id => abrirModalCategoria(id);
window.excluirCategoria = async id => {
    if (!confirm('Excluir esta categoria?')) return;
    try { showLoading(); await deleteDoc(doc(db,'categorias',id)); showToast('Excluída!','success'); hideLoading(); }
    catch { showToast('Erro','error'); hideLoading(); }
};

function atualizarSelectCategorias() {
    const s = document.getElementById('productCategory');
    if (!s) return;
    s.innerHTML = '<option value="">Selecione</option>' + categorias.map(c=>`<option value="${c.nome}">${c.nome}</option>`).join('');
}

function abrirModalCategoria(id=null) {
    editandoCategoria = id;
    if (id) { document.getElementById('categoryModalTitle').textContent='Editar Categoria'; document.getElementById('categoryName').value=categorias.find(x=>x.id===id)?.nome||''; }
    else    { document.getElementById('categoryModalTitle').textContent='Nova Categoria'; categoryForm.reset(); }
    categoryModal.classList.add('active');
}
function fecharModalCategoria() { categoryModal.classList.remove('active'); categoryForm.reset(); editandoCategoria=null; }

async function salvarCategoria(e) {
    e.preventDefault();
    const nome = document.getElementById('categoryName').value.trim();
    try {
        showLoading();
        if (editandoCategoria) await updateDoc(doc(db,'categorias',editandoCategoria),{nome});
        else await addDoc(collection(db,'categorias'),{nome});
        showToast(editandoCategoria?'Atualizada!':'Criada!','success');
        fecharModalCategoria(); hideLoading();
    } catch { showToast('Erro','error'); hideLoading(); }
}

// ─── MAIS PEDIDOS ─────────────────────────────────────────────────────────────
window.toggleMaisPedidos = async function(produtoId) {
    if (!Array.isArray(configuracoes.maisPedidosIds)) configuracoes.maisPedidosIds = [];
    const idx = configuracoes.maisPedidosIds.indexOf(produtoId);
    if (idx === -1) {
        configuracoes.maisPedidosIds.push(produtoId);
        showToast('⭐ Adicionado a Mais Pedidos!', 'success');
    } else {
        configuracoes.maisPedidosIds.splice(idx, 1);
        showToast('Removido de Mais Pedidos', 'info');
    }
    try {
        await setDoc(doc(db,'configuracoes','geral'), { maisPedidosIds: configuracoes.maisPedidosIds }, { merge: true });
    } catch { showToast('Erro ao salvar Mais Pedidos','error'); }
    renderizarFiltrosCategorias();
    renderizarProdutos();
};

// ─── PRODUTOS ─────────────────────────────────────────────────────────────────

function renderizarFiltrosCategorias() {
    const fc = document.getElementById('categoryFilters');
    if (!fc) return;

    const maisPedidosIds = configuracoes.maisPedidosIds || [];
    const qtdDestaque    = maisPedidosIds.length;

    // ── Barra de busca (criada uma única vez) ──────────────────────────────
    if (!document.getElementById('produtosSearchWrap')) {
        const wrap = document.createElement('div');
        wrap.id = 'produtosSearchWrap';
        wrap.className = 'produtos-search-bar';
        wrap.innerHTML = `
            <svg class="search-icon-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
                type="text"
                id="searchProdutos"
                placeholder="Buscar produto por nome, categoria ou descrição…"
                autocomplete="off"
                spellcheck="false"
                value="${termoBusca}"
            >
            <span class="search-results-count" id="searchResultsCount"></span>
            <button class="search-clear-btn ${termoBusca?'visible':''}" id="searchClearBtn"
                onclick="window.limparBuscaProdutos()" title="Limpar busca">✕</button>
        `;
        fc.parentElement.insertBefore(wrap, fc);

        document.getElementById('searchProdutos').addEventListener('input', e => {
            termoBusca = e.target.value;
            const btn = document.getElementById('searchClearBtn');
            if (btn) btn.classList.toggle('visible', !!termoBusca);
            renderizarProdutos();
        });

        document.getElementById('searchProdutos').addEventListener('keydown', e => {
            if (e.key === 'Escape') window.limparBuscaProdutos();
        });
    }

    // ── Filtros de categoria ────────────────────────────────────────────────
    fc.innerHTML =
        // 1º sempre: Mais Pedidos
        `<button class="mais-pedidos-filter-btn ${filtroCategoriaProduto==='__mais_pedidos__'?'active':''}"
            onclick="window.filtrarPorCategoria('__mais_pedidos__')">
            ⭐ Mais Pedidos
            ${qtdDestaque > 0 ? `<span class="mais-pedidos-badge">${qtdDestaque}</span>` : ''}
        </button>`
        // 2º: Todos
        + `<button class="category-filter-btn ${filtroCategoriaProduto==='all'?'active':''}"
            onclick="window.filtrarPorCategoria('all')">Todos (${produtos.length})</button>`
        // Demais categorias
        + categorias.map(c => {
            const n = produtos.filter(p=>p.categoria===c.nome).length;
            return `<button class="category-filter-btn ${filtroCategoriaProduto===c.nome?'active':''}"
                onclick="window.filtrarPorCategoria('${c.nome}')">${c.nome} (${n})</button>`;
        }).join('');
}

window.limparBuscaProdutos = function() {
    termoBusca = '';
    const inp = document.getElementById('searchProdutos');
    const btn = document.getElementById('searchClearBtn');
    const cnt = document.getElementById('searchResultsCount');
    if (inp) inp.value = '';
    if (btn) btn.classList.remove('visible');
    if (cnt) cnt.textContent = '';
    renderizarProdutos();
};

window.filtrarPorCategoria = cat => {
    filtroCategoriaProduto = cat;
    renderizarFiltrosCategorias();
    renderizarProdutos();
};

async function carregarProdutos() {
    try {
        onSnapshot(collection(db,'produtos'), snap => {
            produtos = [];
            snap.forEach(d => produtos.push({id:d.id,...d.data()}));
            renderizarFiltrosCategorias();
            renderizarProdutos();
            atualizarDashboard();
        });
    } catch { showToast('Erro ao carregar produtos','error'); }
}

function renderizarProdutos() {
    if (!productsGrid) return;

    const maisPedidosIds = configuracoes.maisPedidosIds || [];

    // ── 1. Filtra por aba/categoria ──────────────────────────────────────────
    let lista;
    if (filtroCategoriaProduto === '__mais_pedidos__') {
        lista = produtos.filter(p => maisPedidosIds.includes(p.id));
    } else if (filtroCategoriaProduto === 'all') {
        lista = [...produtos];
    } else {
        lista = produtos.filter(p => p.categoria === filtroCategoriaProduto);
    }

    // ── 2. Filtra por termo de busca ─────────────────────────────────────────
    const termo = termoBusca.trim().toLowerCase();
    if (termo) {
        lista = lista.filter(p =>
            (p.nome||'').toLowerCase().includes(termo) ||
            (p.categoria||'').toLowerCase().includes(termo) ||
            (p.descricao||'').toLowerCase().includes(termo)
        );
    }

    // Atualiza contador de resultados
    const cnt = document.getElementById('searchResultsCount');
    if (cnt) {
        cnt.textContent = termo ? `${lista.length} resultado${lista.length!==1?'s':''}` : '';
    }

    // ── 3. Sem resultados ────────────────────────────────────────────────────
    if (!lista.length) {
        productsGrid.innerHTML = `<div class="no-results-msg">${
            termo
                ? `🔍 Nenhum resultado para "<strong>${termoBusca}</strong>"`
                : filtroCategoriaProduto === '__mais_pedidos__'
                    ? `⭐ Nenhum produto em Mais Pedidos.<br>
                       <small style="font-size:.72rem;display:block;margin-top:8px;letter-spacing:normal;text-transform:none;">
                         Clique na ⭐ de qualquer produto para adicioná-lo a esta aba.
                       </small>`
                    : 'Nenhum produto nesta categoria.'
        }</div>`;
        return;
    }

    // ── 4. Ordena: destaques primeiro (apenas na aba "all" sem busca) ────────
    const comSeparador = filtroCategoriaProduto === 'all' && !termo && maisPedidosIds.length > 0;
    if (comSeparador) {
        lista.sort((a, b) => {
            const aH = maisPedidosIds.includes(a.id) ? 0 : 1;
            const bH = maisPedidosIds.includes(b.id) ? 0 : 1;
            return aH - bH;
        });
    }

    // ── 5. Monta HTML ────────────────────────────────────────────────────────
    function renderCard(p) {
        const ativo = p.ativo !== false;
        const qtdAd = p.adicionais?.length || 0;
        const ehDestaque = maisPedidosIds.includes(p.id);

        const imgH = p.imagem
            ? `<img src="${p.imagem}" alt="${p.nome}" class="product-image-admin"
                onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
               <div class="placeholder-image" style="display:none;">
                 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                   <rect x="3" y="3" width="18" height="18" rx="2"/>
                   <circle cx="8.5" cy="8.5" r="1.5"/>
                   <polyline points="21 15 16 10 5 21"/>
                 </svg>
                 <span>Sem imagem</span>
               </div>`
            : `<div class="placeholder-image">
                 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                   <rect x="3" y="3" width="18" height="18" rx="2"/>
                   <circle cx="8.5" cy="8.5" r="1.5"/>
                   <polyline points="21 15 16 10 5 21"/>
                 </svg>
                 <span>Sem imagem</span>
               </div>`;

        return `
            <div class="product-card-admin ${!ativo?'product-inactive':''}">
                <!-- Visibilidade -->
                <button class="btn-visibility ${ativo?'active':''}"
                    onclick="window.toggleVisibilidadeProduto('${p.id}',${ativo})"
                    title="${ativo?'Ocultar produto':'Mostrar produto'}">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        ${ativo
                            ?'<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'
                            :'<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'}
                    </svg>
                </button>
                <!-- Estrela Mais Pedidos -->
                <button
                    class="mais-pedidos-star ${ehDestaque?'ativo':''}"
                    onclick="window.toggleMaisPedidos('${p.id}')"
                    title="${ehDestaque?'Remover de Mais Pedidos':'Adicionar a Mais Pedidos'}"
                >⭐</button>
                ${imgH}
                <div class="product-info-admin">
                    <h3 class="product-name-admin">${p.nome}</h3>
                    <p class="product-category-admin">${p.categoria||'Sem categoria'}</p>
                    ${ehDestaque ? `<p class="tag-mais-pedidos">⭐ Mais Pedidos</p>` : ''}
                    ${qtdAd>0 ? `<p style="font-size:.73rem;color:var(--accent);font-weight:600;margin:4px 0 0;">🔧 ${qtdAd} adicional(is)</p>` : ''}
                    <div class="product-price-admin" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                        <div style="display:flex;flex-direction:column;">
                            ${p.precoPromocional
                                ? `<span class="preco-original-admin">R$ ${fmt(p.preco)}</span>
                                   <span class="preco-promo-admin">🏷️ R$ ${fmt(p.precoPromocional)}</span>`
                                : `<span>R$ ${fmt(p.preco)}</span>`}
                        </div>
                        <button
                            class="promo-inline-btn ${p.precoPromocional ? 'ativo' : ''}"
                            onclick="window.abrirModalPromocao('${p.id}')"
                            title="${p.precoPromocional ? 'Editar promoção' : 'Criar promoção'}"
                        >🏷️</button>
                    </div>
                    <div class="product-actions">
                        <button class="btn-icon" onclick="window.editarProduto('${p.id}')">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                            Editar
                        </button>
                        <button class="btn-icon danger" onclick="window.excluirProduto('${p.id}')">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                            Excluir
                        </button>
                    </div>
                </div>
            </div>`;
    }

    let html = '';

    if (comSeparador) {
        const listaDestaque = lista.filter(p =>  maisPedidosIds.includes(p.id));
        const listaResto    = lista.filter(p => !maisPedidosIds.includes(p.id));

        if (listaDestaque.length > 0) {
            html += `
            <div class="grid-section-header gold">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                <span>Mais Pedidos (${listaDestaque.length})</span>
            </div>`;
            html += listaDestaque.map(renderCard).join('');
        }

        if (listaResto.length > 0) {
            html += `
            <div class="grid-section-header teal">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/>
                </svg>
                <span>Outros Produtos (${listaResto.length})</span>
            </div>`;
            html += listaResto.map(renderCard).join('');
        }
    } else {
        html = lista.map(renderCard).join('');
    }

    productsGrid.innerHTML = html;
}

window.toggleVisibilidadeProduto = async (id, ativo) => {
    try { await updateDoc(doc(db,'produtos',id),{ativo:!ativo}); showToast(!ativo?'Ativado!':'Desativado!','success'); }
    catch { showToast('Erro','error'); }
};

// ─── MODAL PRODUTO ────────────────────────────────────────────────────────────
function abrirModalProduto(id=null) {
    editandoProduto = id;
    injetarCampoImagemUrl();
    injetarSecaoAdicionais();
    if (!id) {
        if (modalTitle) modalTitle.textContent='Novo Produto';
        productForm.reset(); limparPreviewImagem();
        adicionaisTemp=[]; renderizarAdicionaisAdmin();
        productModal.classList.add('active'); return;
    }
    const p = produtos.find(x=>x.id===id);
    if (!p) { showToast('Produto não encontrado','error'); return; }
    if (modalTitle) modalTitle.textContent='Editar Produto';
    document.getElementById('productName').value        = p.nome??'';
    document.getElementById('productPrice').value       = p.preco??'';
    document.getElementById('productCategory').value    = p.categoria??'';
    document.getElementById('productDescription').value = p.descricao??'';
    document.getElementById('productActive').checked    = p.ativo!==false;
    const u = document.getElementById('productImageUrl');
    if (u) u.value = (p.imagem?.startsWith('http')?p.imagem:'');
    if (imagePreview) {
        if (p.imagem) { imagePreview.innerHTML=`<img src="${p.imagem}" alt="Preview">`; imagePreview.classList.add('active'); }
        else limparPreviewImagem();
    }
    adicionaisTemp = p.adicionais ? JSON.parse(JSON.stringify(p.adicionais)) : [];
    renderizarAdicionaisAdmin();
    productModal.classList.add('active');
}

function injetarCampoImagemUrl() {
    if (document.getElementById('productImageUrl')) return;
    const fg = productImageInput?.closest('.form-group');
    if (!fg) return;
    const lbl = fg.querySelector('label');
    if (lbl) lbl.textContent='Imagem — Upload de Arquivo';
    const ng = document.createElement('div');
    ng.className='form-group'; ng.id='formGroupImageUrl';
    ng.innerHTML=`<label>Imagem — URL Externa</label><input type="url" id="productImageUrl" placeholder="https://exemplo.com/imagem.png" style="width:100%"><small style="color:var(--text-muted)">Link direto para a imagem. Upload tem prioridade.</small>`;
    fg.insertAdjacentElement('afterend', ng);
}

function injetarSecaoAdicionais() {
    if (document.getElementById('adminExtrasContainer')) return;
    const ag = document.getElementById('productActive')?.closest('.form-group');
    if (!ag) return;
    const eg = document.createElement('div');
    eg.className='form-group'; eg.id='adminExtrasContainer';
    eg.innerHTML=`<label>Adicionais</label>
        <div class="extras-admin-section">
            <div class="extras-admin-header">
                <span id="extrasCountLabel">Nenhum adicional</span>
                <button type="button" class="btn-add-extra" onclick="window.adicionarNovoAdicional()">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Adicionar
                </button>
            </div>
            <div class="extras-admin-list" id="extrasAdminList"><p class="extras-empty-msg">Nenhum adicional.</p></div>
        </div>
        <small style="color:var(--text-muted)">Adicionais aparecem no cardápio.</small>`;
    ag.insertAdjacentElement('afterend', eg);
}

function renderizarAdicionaisAdmin() {
    const list=document.getElementById('extrasAdminList'), cnt=document.getElementById('extrasCountLabel');
    if (!list) return;
    if (cnt) cnt.textContent = adicionaisTemp.length?`${adicionaisTemp.length} adicional(is)`:'Nenhum adicional';
    if (!adicionaisTemp.length) { list.innerHTML='<p class="extras-empty-msg">Nenhum adicional.</p>'; return; }
    list.innerHTML = adicionaisTemp.map((ad,i)=>`
        <div class="extra-admin-item" data-index="${i}">
            <input type="text" class="extra-nome-input" placeholder="Nome" value="${ad.nome||''}" oninput="window.atualizarAdicionalTemp(${i},'nome',this.value)">
            <div class="extra-preco-wrapper"><span>R$</span>
                <input type="number" class="extra-preco-input" placeholder="0,00" step="0.01" min="0" value="${ad.preco||0}" oninput="window.atualizarAdicionalTemp(${i},'preco',this.value)">
            </div>
            <button type="button" class="btn-remove-extra" onclick="window.removerAdicionalTemp(${i})">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
        </div>`).join('');
}

window.adicionarNovoAdicional = () => {
    adicionaisTemp.push({nome:'',preco:0}); renderizarAdicionaisAdmin();
    setTimeout(()=>{ const inp=document.querySelectorAll('.extra-nome-input'); if(inp.length) inp[inp.length-1].focus(); },50);
};
window.atualizarAdicionalTemp = (i,c,v) => { if(adicionaisTemp[i]) adicionaisTemp[i][c]=c==='preco'?(parseFloat(v)||0):v; };
window.removerAdicionalTemp   = i => { adicionaisTemp.splice(i,1); renderizarAdicionaisAdmin(); };

function fecharModalProduto() {
    productModal.classList.remove('active'); productForm.reset(); limparPreviewImagem();
    const u=document.getElementById('productImageUrl'); if(u) u.value='';
    adicionaisTemp=[]; editandoProduto=null;
}
function limparPreviewImagem() { if(imagePreview){ imagePreview.innerHTML=''; imagePreview.classList.remove('active'); } }
function previewImagem(e) {
    const f=e.target.files[0];
    if (f&&imagePreview) { const r=new FileReader(); r.onload=ev=>{ imagePreview.innerHTML=`<img src="${ev.target.result}">`; imagePreview.classList.add('active'); }; r.readAsDataURL(f); }
}
function previewImagemUrl(url) {
    if (!imagePreview) return;
    if (!url) { if(!productImageInput?.files?.length) limparPreviewImagem(); return; }
    imagePreview.innerHTML=`<img src="${url}" onerror="this.parentElement.innerHTML='<span style=color:#ef4444;font-size:.8rem>URL inválida</span>'">`;
    imagePreview.classList.add('active');
}

async function salvarProduto(e) {
    e.preventDefault();
    const nome     = document.getElementById('productName').value.trim();
    const preco    = parseFloat(document.getElementById('productPrice').value);
    const categoria= document.getElementById('productCategory').value;
    const descricao= document.getElementById('productDescription').value.trim();
    const ativo    = document.getElementById('productActive').checked;
    const imgFile  = productImageInput.files[0];
    const imgUrl   = (document.getElementById('productImageUrl')?.value||'').trim();
    const adVal    = adicionaisTemp.filter(a=>a.nome?.trim());
    try {
        showLoading();
        let imagem = null;
        if (imgFile) {
            try { const sr=ref(storage,`produtos/${Date.now()}_${imgFile.name}`); await uploadBytes(sr,imgFile); imagem=await getDownloadURL(sr); }
            catch { imagem=null; }
        } else if (imgUrl) { imagem=imgUrl; }
        else if (editandoProduto) { imagem=produtos.find(p=>p.id===editandoProduto)?.imagem||null; }
        const dados={nome,preco,categoria,descricao,ativo,imagem,adicionais:adVal};
        if (editandoProduto) { await updateDoc(doc(db,'produtos',editandoProduto),dados); showToast('Produto atualizado!','success'); }
        else { await addDoc(collection(db,'produtos'),dados); showToast('Produto criado!','success'); }
        fecharModalProduto(); hideLoading();
    } catch { showToast('Erro ao salvar produto','error'); hideLoading(); }
}

window.editarProduto  = id => abrirModalProduto(id);
window.excluirProduto = async id => {
    if (!confirm('Excluir este produto?')) return;
    try { showLoading(); await deleteDoc(doc(db,'produtos',id)); showToast('Excluído!','success'); hideLoading(); }
    catch { showToast('Erro','error'); hideLoading(); }
};

// ─── PEDIDOS ──────────────────────────────────────────────────────────────────
async function carregarPedidos() {
    try {
        onSnapshot(query(collection(db,'pedidos'),orderBy('data','desc')), snap => {
            pedidos=[]; snap.forEach(d=>pedidos.push({id:d.id,...d.data()}));
            filtrarPedidos(); atualizarDashboard();
        });
    } catch { showToast('Erro ao carregar pedidos','error'); }
}

function filtrarPedidos() {
    renderizarPedidos(filtroStatusPedido==='all' ? pedidos : pedidos.filter(p=>p.status===filtroStatusPedido));
}

function renderizarPedidos(lista) {
    if (!ordersList) return;
    if (!lista.length) { ordersList.innerHTML='<div style="text-align:center;padding:60px;color:var(--text-muted);">Nenhum pedido</div>'; return; }
    ordersList.innerHTML = lista.map(pd => {
        const data = pd.data ? new Date(pd.data.seconds*1000).toLocaleString('pt-BR') : '—';
        const log  = [{s:'novo',l:'Novo',a:true},{s:'preparando',l:'Preparando',a:pd.status==='preparando'||pd.status==='pronto'},{s:'pronto',l:'Pronto',a:pd.status==='pronto'}];
        return `<div class="order-card">
            <div class="order-header">
                <div><div class="order-number">Pedido #${pd.id.substring(0,8).toUpperCase()}</div><div class="order-time">${data}</div></div>
                <span class="order-status ${pd.status}">${pd.status}</span>
            </div>
            <div class="order-process-log">${log.map((s,i)=>`<div class="process-step ${s.a?'active':''}"><div class="process-dot"></div><span class="process-label">${s.l}</span></div>${i<log.length-1?'<div class="process-line"></div>':''}`).join('')}</div>
            <div class="order-items">${(pd.itens||[]).map(it=>`<div class="order-item"><div><span class="order-item-name">${it.nome}</span><span class="order-item-qty"> x${it.quantidade}</span></div><span class="order-item-price">R$ ${fmt(it.preco*it.quantidade)}</span></div>`).join('')}</div>
            <div class="order-footer">
                <div class="order-total">Total: <span>R$ ${fmt(pd.total)}</span></div>
                <div class="order-actions">
                    ${pd.status==='novo'       ?`<button class="btn-status preparando" onclick="window.atualizarStatusPedido('${pd.id}','preparando')">Iniciar Preparo</button>`:''}
                    ${pd.status==='preparando' ?`<button class="btn-status pronto"     onclick="window.atualizarStatusPedido('${pd.id}','pronto')">Marcar Pronto</button>`:''}
                    <button class="btn-status danger" onclick="window.excluirPedido('${pd.id}')">Excluir</button>
                </div>
            </div>
        </div>`;
    }).join('');
}

window.atualizarStatusPedido = async (id, s) => {
    try { await updateDoc(doc(db,'pedidos',id),{status:s,dataAtualizacao:serverTimestamp()}); showToast(`Pedido ${s}!`,'success'); }
    catch { showToast('Erro','error'); }
};
window.excluirPedido = async id => {
    if (!confirm('Excluir?')) return;
    try { showLoading(); await deleteDoc(doc(db,'pedidos',id)); showToast('Excluído!','success'); hideLoading(); }
    catch { showToast('Erro','error'); hideLoading(); }
};
window.limparTodosPedidos = async () => {
    if (!confirm('Excluir TODOS os pedidos?')) return;
    if (!confirm('Confirme novamente.')) return;
    try {
        showLoading();
        const snap=await getDocs(collection(db,'pedidos'));
        await Promise.all(snap.docs.map(d=>deleteDoc(doc(db,'pedidos',d.id))));
        showToast(`${snap.size} pedidos excluídos!`,'success');
        hideLoading();
    } catch { showToast('Erro','error'); hideLoading(); }
};

// ─── UTILITÁRIOS ──────────────────────────────────────────────────────────────
function fmt(val)      { return parseFloat(val).toFixed(2).replace('.',','); }
function capitalize(s) { return s.charAt(0).toUpperCase()+s.slice(1); }
function showLoading() { loading?.classList.add('active'); }
function hideLoading() { loading?.classList.remove('active'); }
function showToast(msg, type='success') {
    if (!toast) return;
    toast.textContent = msg;
    toast.className   = `toast ${type} active`;
    setTimeout(()=>toast.classList.remove('active'), 3000);
}

// ─── PROMOÇÕES ────────────────────────────────────────────────────────────────

function injetarModalPromocao() {
    if (document.getElementById('promoModal')) return;
    const div = document.createElement('div');
    div.innerHTML = `
    <div class="modal" id="promoModal">
        <div class="modal-overlay" id="promoModalOverlay"></div>
        <div class="modal-content" style="max-width:420px;">
            <button class="modal-close" id="closePromoModal">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
            <div style="text-align:center;margin-bottom:20px;">
                <span style="font-size:2.5rem;">🏷️</span>
                <h2 style="margin:10px 0 4px;font-size:1.3rem;" id="promoModalTitle">Criar Promoção</h2>
                <p style="font-size:.82rem;color:var(--text-muted);" id="promoModalSub">Defina um preço promocional para este produto.</p>
            </div>
            <div class="form-group" style="margin-bottom:8px;">
                <label>Produto</label>
                <input type="text" id="promoNomeProduto" readonly class="config-input" style="opacity:.6;cursor:default;">
            </div>
            <div class="form-group" style="margin-bottom:8px;">
                <label>Preço Original</label>
                <input type="text" id="promoPrecoOriginal" readonly class="config-input" style="opacity:.6;cursor:default;">
            </div>
            <div class="form-group" style="margin-bottom:20px;">
                <label>💸 Preço Promocional *</label>
                <input type="number" id="promoPrecoNovo" step="0.01" min="0.01" placeholder="0,00" class="config-input" style="font-size:1.1rem;font-weight:700;">
                <small style="color:var(--text-muted)">Deixe vazio ou zero para remover a promoção.</small>
            </div>
            <div id="promoDesconto" style="display:none;margin-bottom:18px;padding:12px 16px;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.3);border-radius:8px;text-align:center;">
                <span style="font-size:.9rem;font-weight:700;color:#22c55e;" id="promoDescontoTexto"></span>
            </div>
            <div class="modal-actions" style="gap:10px;">
                <button class="btn-primary" id="btnSalvarPromo" style="flex:1;">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                        <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
                    </svg>
                    Salvar Promoção
                </button>
                <button class="btn-danger" id="btnRemoverPromo" style="display:none;">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                    </svg>
                    Remover
                </button>
                <button class="btn-secondary" id="cancelPromoModal">Cancelar</button>
            </div>
        </div>
    </div>`;
    document.body.appendChild(div.firstElementChild);

    // Eventos
    document.getElementById('closePromoModal').addEventListener('click', fecharModalPromocao);
    document.getElementById('cancelPromoModal').addEventListener('click', fecharModalPromocao);
    document.getElementById('promoModalOverlay').addEventListener('click', fecharModalPromocao);
    document.getElementById('btnSalvarPromo').addEventListener('click', salvarPromocao);
    document.getElementById('btnRemoverPromo').addEventListener('click', removerPromocao);
    document.getElementById('promoPrecoNovo').addEventListener('input', calcularDesconto);
}

let promoEditandoId = null;

window.abrirModalPromocao = function(id) {
    injetarModalPromocao();
    const p = produtos.find(x => x.id === id);
    if (!p) return;
    promoEditandoId = id;

    document.getElementById('promoNomeProduto').value   = p.nome;
    document.getElementById('promoPrecoOriginal').value = 'R$ ' + fmt(p.preco);
    document.getElementById('promoPrecoNovo').value     = p.precoPromocional ? fmt(p.precoPromocional).replace(',','.') : '';
    document.getElementById('promoModalTitle').textContent = p.precoPromocional ? 'Editar Promoção' : 'Criar Promoção';
    document.getElementById('btnRemoverPromo').style.display = p.precoPromocional ? 'inline-flex' : 'none';

    calcularDesconto();
    document.getElementById('promoModal').classList.add('active');
    setTimeout(() => document.getElementById('promoPrecoNovo').focus(), 100);
};

function fecharModalPromocao() {
    const m = document.getElementById('promoModal');
    if (m) m.classList.remove('active');
    promoEditandoId = null;
}

function calcularDesconto() {
    const p   = produtos.find(x => x.id === promoEditandoId);
    if (!p) return;
    const novo = parseFloat(document.getElementById('promoPrecoNovo')?.value || 0);
    const box  = document.getElementById('promoDesconto');
    const txt  = document.getElementById('promoDescontoTexto');
    if (!box || !txt) return;
    if (novo > 0 && novo < p.preco) {
        const pct = Math.round((1 - novo / p.preco) * 100);
        box.style.display   = 'block';
        txt.textContent     = `🎉 Desconto de ${pct}% — economia de R$ ${fmt(p.preco - novo)}`;
    } else {
        box.style.display = 'none';
    }
}

async function salvarPromocao() {
    if (!promoEditandoId) return;
    const p   = produtos.find(x => x.id === promoEditandoId);
    const novo = parseFloat(document.getElementById('promoPrecoNovo')?.value || 0);
    if (!novo || novo <= 0) { await removerPromocao(); return; }
    if (novo >= p.preco) { showToast('Preço promocional deve ser menor que o original!', 'error'); return; }
    try {
        showLoading();
        await updateDoc(doc(db, 'produtos', promoEditandoId), { precoPromocional: novo });
        showToast('Promoção salva! 🏷️', 'success');
        fecharModalPromocao();
        hideLoading();
    } catch { showToast('Erro ao salvar promoção', 'error'); hideLoading(); }
}

async function removerPromocao() {
    if (!promoEditandoId) return;
    if (!confirm('Remover a promoção deste produto?')) return;
    try {
        showLoading();
        await updateDoc(doc(db, 'produtos', promoEditandoId), { precoPromocional: null });
        showToast('Promoção removida!', 'info');
        fecharModalPromocao();
        hideLoading();
    } catch { showToast('Erro ao remover promoção', 'error'); hideLoading(); }
}

console.log('X-Food Admin v3 — Busca + Mais Pedidos + Promoções inicializado!');