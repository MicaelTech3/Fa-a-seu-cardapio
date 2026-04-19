// admin.js — X-Food Admin v4
// Inclui: Colaboradores, Pratos Colaborador, Pedidos Col, Config Col

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
let produtos = [], categorias = [], pedidos = [], colaboradores = [], pratosCol = [], pedidosCols = [];
let editandoProduto = null, editandoCategoria = null, editandoColab = null, editandoPratoCol = null;
let filtroStatusPedido = 'all', filtroCategoriaProduto = 'all';
let categoriaExpandida = null, adicionaisTemp = [];
let abaConfigAtiva = 'aparencia';
let termoBusca = '';
let abaAtiva = 'dashboard'; // controle da aba principal ativa

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

// Config colaborador
let configColaborador = {
    desconto: 35,
    carrinhoAtivo: true,
    limiteDefault: 0,
    autoResetAtivo: false,
    autoResetData: '',
    autoResetUltimaExecucao: ''
};

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

            const executarNavegacao = () => {
                abaAtiva = sec;
                navItems.forEach(n => n.classList.remove('active'));
                document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
                item.classList.add('active');
                // Remove active de TODAS as seções, incluindo as criadas dinamicamente
                document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
                document.getElementById('section'+capitalize(sec))?.classList.add('active');
                if (sec==='dashboard')          atualizarDashboard();
                else if (sec==='configuracoes') renderizarConfiguracoes();
                else if (sec==='pages')         renderizarPages();
                else if (sec==='produtos')      renderizarFiltrosCategorias();
                else if (sec==='colaboradores') renderizarColaboradores();
                else if (sec==='pratosCols')    renderizarPratosCol();
                else if (sec==='pedidosCols')   renderizarPedidosCols();
                else if (sec==='configCols')    renderizarConfigCols();
            };

            // ── Senha obrigatória para Configurações ──────────────────────────
            if (sec === 'configuracoes') {
                pedirSenhaAdmin('Configurações', executarNavegacao);
            } else {
                executarNavegacao();
            }
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

// ─── Modal de Senha Administrativa (com olho) ────────────────────────────────
function garantirModalSenhaAdmin() {
    if (document.getElementById('adminPwModal')) return;
    const div = document.createElement('div');
    div.innerHTML = `
    <div id="adminPwModal" style="position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,8,.88);backdrop-filter:blur(10px);">
        <div style="background:linear-gradient(145deg,var(--bg-surface,#0e0b1a),var(--bg-elevated,#1a1e28));border:1px solid var(--border-strong,rgba(255,255,255,.15));border-radius:14px;padding:32px;max-width:380px;width:100%;box-shadow:0 24px 64px rgba(0,0,0,.8);animation:scaleIn .22s cubic-bezier(.34,1.56,.64,1);">
            <div style="font-family:'Orbitron',sans-serif;font-size:.8rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--primary,#00ffe0);margin-bottom:8px;">🔒 Senha Administrativa</div>
            <div id="adminPwTitulo" style="font-size:.82rem;color:var(--text-muted,#8892a4);margin-bottom:22px;line-height:1.5;"></div>
            <div style="position:relative;display:flex;align-items:center;">
                <input id="adminPwInput" type="password" autocomplete="off" placeholder="Digite a senha…"
                    style="width:100%;padding:11px 46px 11px 14px;background:var(--bg-base,#02000a);border:1px solid var(--border,rgba(255,255,255,.1));border-radius:8px;color:var(--text-primary,#f0f2f7);font-family:inherit;font-size:.92rem;outline:none;box-sizing:border-box;transition:border-color .18s;"
                    onfocus="this.style.borderColor='var(--primary,#00ffe0)'"
                    onblur="this.style.borderColor=document.getElementById('adminPwErro').style.display==='block'?'#f87171':'var(--border,rgba(255,255,255,.1))'">
                <button id="adminPwEyeBtn" type="button" title="Mostrar/ocultar senha"
                    style="position:absolute;right:10px;background:none;border:none;cursor:pointer;color:var(--text-muted,#505868);padding:4px;display:flex;align-items:center;transition:color .18s;"
                    onmouseover="this.style.color='var(--primary,#00ffe0)'"
                    onmouseout="this.style.color='var(--text-muted,#505868)'"
                    onclick="window._adminPwToggleEye()">
                    <svg id="adminPwEyeIcon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                    </svg>
                </button>
            </div>
            <div id="adminPwErro" style="display:none;font-size:.75rem;color:#f87171;margin-top:8px;padding:6px 10px;background:rgba(248,113,113,.08);border:1px solid rgba(248,113,113,.2);border-radius:6px;">❌ Senha incorreta. Tente novamente.</div>
            <div style="display:flex;gap:10px;margin-top:22px;">
                <button onclick="window._adminPwCancelar()"
                    style="flex:1;padding:10px 0;background:transparent;border:1px solid var(--border,rgba(255,255,255,.1));border-radius:8px;color:var(--text-muted,#8892a4);font-family:inherit;font-size:.85rem;cursor:pointer;transition:all .18s;"
                    onmouseover="this.style.background='rgba(255,255,255,.04)';this.style.color='var(--text-primary,#f0f2f7)'"
                    onmouseout="this.style.background='transparent';this.style.color='var(--text-muted,#8892a4)'">
                    Cancelar
                </button>
                <button onclick="window._adminPwConfirmar()"
                    style="flex:1;padding:10px 0;background:var(--primary,#00ffe0);border:none;border-radius:8px;color:#000;font-family:inherit;font-size:.85rem;font-weight:700;cursor:pointer;transition:opacity .18s;"
                    onmouseover="this.style.opacity='.82'"
                    onmouseout="this.style.opacity='1'">
                    Confirmar
                </button>
            </div>
        </div>
    </div>`;
    document.body.appendChild(div.firstElementChild);
    document.getElementById('adminPwInput').addEventListener('keydown', e => {
        if (e.key === 'Enter')  window._adminPwConfirmar();
        if (e.key === 'Escape') window._adminPwCancelar();
    });
}

let _adminPwCallback = null;

window._adminPwToggleEye = function() {
    const inp  = document.getElementById('adminPwInput');
    const icon = document.getElementById('adminPwEyeIcon');
    if (inp.type === 'password') {
        inp.type = 'text';
        icon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
    } else {
        inp.type = 'password';
        icon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
    }
    inp.focus();
};

window._adminPwConfirmar = function() {
    const val = document.getElementById('adminPwInput').value;
    if (val !== 'Sabactani1#') {
        const erro = document.getElementById('adminPwErro');
        const inp  = document.getElementById('adminPwInput');
        erro.style.display = 'block';
        inp.style.borderColor = '#f87171';
        inp.select();
        return;
    }
    _adminPwFechar();
    if (typeof _adminPwCallback === 'function') { const cb = _adminPwCallback; _adminPwCallback = null; cb(); }
};

window._adminPwCancelar = function() {
    _adminPwFechar();
    _adminPwCallback = null;
    if (typeof showToast === 'function') showToast('Operação cancelada', 'info');
};

function _adminPwFechar() {
    const modal = document.getElementById('adminPwModal');
    if (!modal) return;
    modal.style.display = 'none';
    const inp  = document.getElementById('adminPwInput');
    const icon = document.getElementById('adminPwEyeIcon');
    inp.value = '';
    inp.type  = 'password';
    inp.style.borderColor = 'var(--border,rgba(255,255,255,.1))';
    icon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
    document.getElementById('adminPwErro').style.display = 'none';
}

function pedirSenhaAdmin(titulo, callback) {
    garantirModalSenhaAdmin();
    _adminPwCallback = callback;
    document.getElementById('adminPwTitulo').textContent = `Acesso necessário para: ${titulo}`;
    _adminPwFechar();                                    // limpa estado anterior
    document.getElementById('adminPwModal').style.display = 'flex'; // reabre
    setTimeout(() => document.getElementById('adminPwInput')?.focus(), 60);
}

async function carregarDados() {
    await carregarConfiguracoes();
    await carregarConfigColaborador();
    await carregarCategorias();
    await carregarProdutos();
    await carregarPedidos();
    await carregarColaboradores();
    await carregarPratosCol();
    await carregarPedidosCols();
    atualizarDashboard();
    injetarNavColaboradores();
}

// ─── Injetar nav colaboradores ────────────────────────────────────────────────
function injetarNavColaboradores() {
    const nav = document.querySelector('.sidebar-nav');
    if (!nav || document.getElementById('navColabModulo')) return;

    const separator = document.createElement('div');
    separator.style.cssText = 'height:1px;background:var(--border);margin:8px 4px;opacity:.5;';

    const btn = document.createElement('button');
    btn.id = 'navColabModulo';
    btn.className = 'nav-item';
    btn.dataset.section = 'moduloColaborador';
    btn.innerHTML = `<span style="font-size:1.1rem">🏢</span> Colaborador`;
    btn.addEventListener('click', () => {
        abaAtiva = 'moduloColaborador';
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        btn.classList.add('active');
        // Remove active de TODAS as seções, incluindo as estáticas e dinâmicas
        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));

        let secId = 'sectionModuloColaborador';
        let sec = document.getElementById(secId);
        if (!sec) {
            sec = document.createElement('section');
            sec.className = 'content-section active';
            sec.id = secId;
            document.querySelector('.main-content').appendChild(sec);
        } else {
            sec.classList.add('active');
        }

        renderizarModuloColaborador();
    });

    nav.appendChild(separator);
    nav.appendChild(btn);
}

let abaColabAtiva = 'colaboradores';

window.renderizarModuloColaborador = function() {
    const sec = document.getElementById('sectionModuloColaborador');
    if(!sec) return;
    
    if(!document.getElementById('colabSubContent')) {
        sec.innerHTML = `
            <div class="section-header" style="margin-bottom:15px;">
                <h1>Módulo do Colaborador</h1>
            </div>
            <div class="config-tabs-nav">
                <button class="config-tab-btn ${abaColabAtiva==='colaboradores'?'active':''}" onclick="window.mudarAbaColab('colaboradores')">👥 Membros</button>
                <button class="config-tab-btn ${abaColabAtiva==='pratosCols'?'active':''}" onclick="window.mudarAbaColab('pratosCols')">🍽️ Pratos</button>
                <button class="config-tab-btn ${abaColabAtiva==='pedidosCols'?'active':''}" onclick="window.mudarAbaColab('pedidosCols')">📋 Pedidos</button>
                <button class="config-tab-btn ${abaColabAtiva==='relatorios'?'active':''}" onclick="window.mudarAbaColab('relatorios')">📊 Relatórios</button>
                <button class="config-tab-btn ${abaColabAtiva==='configCols'?'active':''}" onclick="window.mudarAbaColab('configCols')">⚙️ Configurações</button>
            </div>
            <div id="colabSubContent" style="margin-top:20px;"></div>
        `;
    }
    
    if (abaColabAtiva === 'colaboradores') renderizarColaboradores();
    else if (abaColabAtiva === 'pratosCols') renderizarPratosCol();
    else if (abaColabAtiva === 'pedidosCols') renderizarPedidosCols();
    else if (abaColabAtiva === 'relatorios') renderizarRelatorios();
    else if (abaColabAtiva === 'configCols') renderizarConfigCols();
};

window.mudarAbaColab = function(aba) {
    const _aplicar = () => {
        abaColabAtiva = aba;
        window.renderizarModuloColaborador();
        const btns = document.querySelectorAll('#sectionModuloColaborador .config-tab-btn');
        btns.forEach(b => {
            b.classList.remove('active');
            if(b.getAttribute('onclick').includes(aba)) b.classList.add('active');
        });
    };
    if (aba === 'configCols' || aba === 'relatorios') {
        const label = aba === 'relatorios' ? 'Relatórios do Colaborador' : 'Configurações do Colaborador';
        pedirSenhaAdmin(label, _aplicar);
    } else {
        _aplicar();
    }
};

// ─── ESTILOS EXTRAS ───────────────────────────────────────────────────────────
function injetarEstilosExtras() {
    if (document.getElementById('adminExtrasStyles')) return;
    const s = document.createElement('style');
    s.id = 'adminExtrasStyles';
    s.textContent = `
    .config-tabs-nav{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:24px;background:var(--bg-elevated,#1a1e28);border:1px solid var(--border);border-radius:10px;padding:6px;}
    .config-tab-btn{flex:1;min-width:90px;padding:9px 12px;background:transparent;border:none;border-radius:7px;font-size:.8rem;font-weight:600;font-family:inherit;color:var(--text-muted,#505868);cursor:pointer;transition:all .18s ease;display:flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap;}
    .config-tab-btn:hover{background:var(--bg-hover,rgba(255,255,255,.04));color:var(--text-primary,#f0f2f7);}
    .config-tab-btn.active{background:rgba(245,158,11,.12);color:var(--accent,#f59e0b);box-shadow:0 0 0 1px rgba(245,158,11,.25);}
    .config-tab-panel{display:none;}
    .config-tab-panel.active{display:block;animation:sectionFade .2s ease;}
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
    .qr-preview-box{margin-top:10px;text-align:center;}
    .qr-preview-box img{max-width:160px;border-radius:8px;border:1px solid var(--border);}
    .dominios-list{display:flex;flex-direction:column;gap:7px;margin-top:8px;}
    .dominio-item{display:flex;align-items:center;gap:8px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:7px;padding:10px 13px;font-size:.8rem;}
    .dominio-item a{color:var(--accent,#f59e0b);text-decoration:none;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .dominio-item a:hover{text-decoration:underline;}
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
    .config-actions-aba{display:flex;gap:10px;justify-content:flex-end;margin-top:20px;padding-top:16px;border-top:1px solid var(--border);flex-wrap:wrap;}
    .btn-reset-aba{background:transparent;color:var(--text-muted);border:1px solid var(--border);padding:8px 14px;border-radius:var(--radius-sm,6px);font-size:.8rem;font-weight:500;font-family:inherit;cursor:pointer;transition:all .18s;display:inline-flex;align-items:center;gap:6px;}
    .btn-reset-aba:hover{border-color:var(--warning,#f59e0b);color:var(--warning,#f59e0b);background:rgba(245,158,11,.06);}

    /* Search bar produtos */
    .produtos-search-bar{display:flex;align-items:center;gap:10px;padding:11px 16px;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius,4px);margin-bottom:14px;transition:border-color .18s,box-shadow .18s;}
    .produtos-search-bar:focus-within{border-color:var(--primary,#00ffe0);box-shadow:0 0 0 3px rgba(0,255,224,.1),0 0 12px rgba(0,255,224,.12);}
    .produtos-search-bar .search-icon-svg{flex-shrink:0;color:var(--text-muted);transition:color .18s;}
    .produtos-search-bar:focus-within .search-icon-svg{color:var(--primary,#00ffe0);}
    #searchProdutos{flex:1;background:transparent;border:none;outline:none;font-size:.88rem;font-family:'Rajdhani',sans-serif;letter-spacing:.04em;color:var(--text-primary);}
    #searchProdutos::placeholder{color:var(--text-muted);}
    .search-results-count{font-size:.72rem;font-family:'Rajdhani',sans-serif;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted);white-space:nowrap;flex-shrink:0;}
    .search-clear-btn{background:transparent;border:none;cursor:pointer;color:var(--text-muted);padding:3px 7px;border-radius:4px;font-size:.75rem;display:none;transition:all .18s;line-height:1;}
    .search-clear-btn:hover{color:var(--danger,#ff1744);background:var(--danger-dim,rgba(255,23,68,.1));}
    .search-clear-btn.visible{display:block;}

    /* Mais pedidos */
    .mais-pedidos-filter-btn{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border:1px solid rgba(255,230,0,.3);background:rgba(255,230,0,.05);border-radius:var(--radius-sm,3px);font-size:.72rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;font-family:'Rajdhani',sans-serif;color:rgba(255,230,0,.8);cursor:pointer;transition:all .18s;}
    .mais-pedidos-filter-btn:hover{background:rgba(255,230,0,.12);border-color:rgba(255,230,0,.5);box-shadow:0 0 8px rgba(255,230,0,.15);color:var(--accent-gold,#ffe600);}
    .mais-pedidos-filter-btn.active{background:rgba(255,230,0,.12);border-color:var(--accent-gold,#ffe600);color:var(--accent-gold,#ffe600);box-shadow:0 0 10px rgba(255,230,0,.2);}
    .mais-pedidos-badge{display:inline-flex;align-items:center;justify-content:center;background:var(--accent-gold,#ffe600);color:#02000a;font-size:.6rem;font-weight:900;width:17px;height:17px;border-radius:50%;line-height:1;}
    .mais-pedidos-star{position:absolute;top:10px;right:10px;z-index:11;background:rgba(2,0,10,.75);border:1px solid rgba(255,230,0,.2);width:30px;height:30px;border-radius:var(--radius-sm,3px);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .18s;font-size:.85rem;filter:grayscale(1);opacity:.5;}
    .mais-pedidos-star:hover{filter:grayscale(0);opacity:1;background:rgba(255,230,0,.12);border-color:rgba(255,230,0,.5);box-shadow:0 0 8px rgba(255,230,0,.2);}
    .mais-pedidos-star.ativo{filter:grayscale(0);opacity:1;background:rgba(255,230,0,.15);border-color:var(--accent-gold,#ffe600);box-shadow:0 0 10px rgba(255,230,0,.3);}
    .grid-section-header{grid-column:1/-1;display:flex;align-items:center;gap:10px;padding:9px 14px;border-radius:var(--radius,4px);margin-top:4px;margin-bottom:2px;}
    .grid-section-header.gold{background:linear-gradient(90deg,rgba(255,230,0,.08),transparent);border:1px solid rgba(255,230,0,.18);}
    .grid-section-header.teal{background:linear-gradient(90deg,rgba(0,255,224,.04),transparent);border:1px solid rgba(0,255,224,.1);}
    .grid-section-header span{font-family:'Orbitron',sans-serif;font-size:.65rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;}
    .grid-section-header.gold span{color:var(--accent-gold,#ffe600);text-shadow:0 0 8px rgba(255,230,0,.3);}
    .grid-section-header.teal span{color:var(--text-muted);}
    .tag-mais-pedidos{display:inline-flex;align-items:center;gap:4px;font-size:.62rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-family:'Rajdhani',sans-serif;color:var(--accent-gold,#ffe600);margin:4px 0 0;}
    .promo-inline-btn{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:var(--radius-sm,3px);background:rgba(2,0,10,.75);border:1px solid rgba(249,115,22,.25);cursor:pointer;transition:all .18s;font-size:.85rem;filter:grayscale(1);opacity:.5;flex-shrink:0;}
    .promo-inline-btn:hover{filter:grayscale(0);opacity:1;background:rgba(249,115,22,.12);border-color:rgba(249,115,22,.5);box-shadow:0 0 8px rgba(249,115,22,.2);}
    .promo-inline-btn.ativo{filter:grayscale(0);opacity:1;background:rgba(249,115,22,.18);border-color:#f97316;box-shadow:0 0 10px rgba(249,115,22,.35);animation:promoPulse 2s infinite;}
    @keyframes promoPulse{0%,100%{box-shadow:0 0 10px rgba(249,115,22,.35)}50%{box-shadow:0 0 18px rgba(249,115,22,.6)}}
    .preco-original-admin{text-decoration:line-through;color:var(--text-muted);font-size:.8rem;display:block;}
    .preco-promo-admin{color:#f97316;font-weight:800;font-size:1rem;display:block;}
    .no-results-msg{grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text-muted);font-family:'Rajdhani',sans-serif;font-size:.88rem;letter-spacing:.1em;text-transform:uppercase;line-height:1.8;}
    .no-results-msg strong{color:var(--text-primary);}

    /* ── Colaboradores ── */
    .colab-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;}
    .colab-card{background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius);padding:18px;transition:all .2s;position:relative;}
    .colab-card:hover{border-color:rgba(0,255,224,.25);transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.5);}
    .colab-name{font-family:'Orbitron',sans-serif;font-size:.85rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text-primary);margin-bottom:4px;}
    .colab-meta{font-size:.75rem;color:var(--text-muted);margin-bottom:10px;line-height:1.6;}
    .colab-meta span{display:block;}
    .colab-limit-bar{height:4px;background:rgba(0,255,224,.08);border-radius:2px;overflow:hidden;margin-bottom:10px;}
    .colab-limit-fill{height:100%;border-radius:2px;background:linear-gradient(90deg,var(--primary),var(--secondary));transition:width .5s ease;}
    .colab-limit-fill.warn{background:linear-gradient(90deg,var(--accent-gold,#ffe600),#f97316);}
    .colab-limit-fill.over{background:linear-gradient(90deg,var(--danger),#ff006a);}
    .colab-actions{display:flex;gap:8px;margin-top:12px;}
    .colab-reset-btn{background:rgba(0,255,224,.06);color:var(--primary);border:1px solid rgba(0,255,224,.2);padding:6px 12px;border-radius:var(--radius-sm);font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-family:'Rajdhani',sans-serif;cursor:pointer;transition:all .18s;}
    .colab-reset-btn:hover{background:rgba(0,255,224,.14);box-shadow:0 0 8px rgba(0,255,224,.2);}

    /* ── Pratos Colaborador ── */
    .prato-col-card{background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;transition:all .2s;position:relative;}
    .prato-col-card:hover{border-color:rgba(112,0,255,.3);transform:translateY(-2px);}
    .prato-col-badge{position:absolute;top:10px;left:10px;z-index:5;background:rgba(112,0,255,.85);color:#fff;font-size:.6rem;font-weight:800;padding:3px 9px;border-radius:20px;letter-spacing:.06em;text-transform:uppercase;}
    .prato-col-img{width:100%;height:140px;object-fit:cover;background:var(--bg-elevated);display:block;}
    .prato-col-body{padding:14px;}
    .prato-col-name{font-family:'Orbitron',sans-serif;font-size:.75rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text-primary);margin-bottom:4px;}
    .prato-col-cat{font-size:.68rem;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.08em;}
    .prato-col-preco{font-family:'IBM Plex Mono',monospace;color:var(--secondary,#7000ff);font-size:1rem;font-weight:700;margin-bottom:12px;}
    .prato-col-desc-tag{font-size:.7rem;color:rgba(112,0,255,.8);background:rgba(112,0,255,.08);border:1px solid rgba(112,0,255,.2);padding:2px 8px;border-radius:20px;margin-bottom:10px;display:inline-block;}

    /* ── Pedidos Col ── */
    .pedcol-card{background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius);padding:18px;margin-bottom:12px;transition:all .2s;}
    .pedcol-card:hover{border-color:rgba(112,0,255,.2);}
    .pedcol-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;flex-wrap:wrap;gap:8px;}
    .pedcol-num{font-family:'IBM Plex Mono',monospace;font-size:.85rem;color:var(--text-primary);}
    .pedcol-colab{font-size:.72rem;color:var(--text-muted);margin-top:2px;}
    .pedcol-status{padding:3px 10px;border-radius:2px;font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;font-family:'Rajdhani',sans-serif;}
    .pedcol-status.novo{background:rgba(0,255,224,.08);color:var(--primary);border:1px solid rgba(0,255,224,.2);}
    .pedcol-status.preparando{background:rgba(255,230,0,.08);color:var(--accent-gold,#ffe600);border:1px solid rgba(255,230,0,.2);}
    .pedcol-status.pronto{background:rgba(0,255,136,.08);color:var(--success);border:1px solid rgba(0,255,136,.2);}
    .pedcol-status.aceito{background:rgba(59,130,246,.08);color:#60a5fa;border:1px solid rgba(59,130,246,.2);}
    .pedcol-items{margin-bottom:10px;}
    .pedcol-item-row{display:flex;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:.85rem;}
    .pedcol-item-row:last-child{border-bottom:none;}
    .pedcol-desconto-tag{font-size:.7rem;color:#f97316;background:rgba(249,115,22,.08);border:1px solid rgba(249,115,22,.2);padding:2px 8px;border-radius:20px;margin-bottom:8px;display:inline-block;}
    .pedcol-pendente-tag{font-size:.7rem;color:#facc15;background:rgba(250,204,21,.08);border:1px solid rgba(250,204,21,.2);padding:2px 8px;border-radius:20px;margin-bottom:8px;display:inline-block;}
    .pedcol-footer{display:flex;justify-content:space-between;align-items:center;padding-top:10px;border-top:1px solid var(--border);flex-wrap:wrap;gap:8px;}
    .pedcol-total{font-family:'IBM Plex Mono',monospace;color:var(--primary);font-size:1rem;}

    /* Config Col */
    .config-col-section{background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius);padding:22px;margin-bottom:18px;}
    .config-col-title{font-family:'Orbitron',sans-serif;font-size:.72rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--text-muted);margin-bottom:18px;padding-bottom:12px;border-bottom:1px solid var(--border);}

    /* Modal genérico extra */
    .modal-extra{position:fixed;inset:0;z-index:2000;display:none;align-items:center;justify-content:center;padding:20px;}
    .modal-extra.active{display:flex;}
    .modal-extra-overlay{position:absolute;inset:0;background:rgba(0,0,8,.8);backdrop-filter:blur(6px);}
    .modal-extra-content{position:relative;background:linear-gradient(145deg,var(--bg-surface),var(--bg-elevated));border:1px solid var(--border-strong);border-radius:var(--radius-lg);padding:32px;max-width:580px;width:100%;max-height:90vh;overflow-y:auto;animation:scaleIn .25s cubic-bezier(.34,1.56,.64,1);box-shadow:var(--shadow-lg);}
    .modal-extra-content h2{font-family:'Orbitron',sans-serif;font-size:1rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--primary);margin-bottom:24px;padding-bottom:14px;border-bottom:1px solid var(--border);}
    .modal-extra-close{position:absolute;top:16px;right:16px;background:rgba(255,0,106,.08);border:1px solid rgba(255,0,106,.2);cursor:pointer;padding:7px;border-radius:var(--radius-sm);transition:all .2s;color:rgba(255,0,106,.7);display:flex;align-items:center;justify-content:center;width:32px;height:32px;}
    .modal-extra-close:hover{background:rgba(255,0,106,.2);color:#ff006a;transform:rotate(90deg);}

    /* ── Histórico por Mês ── */
    .mes-modal-wrap{position:fixed;inset:0;z-index:3000;display:none;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;}
    .mes-modal-wrap.active{display:flex;}
    .mes-modal-overlay{position:fixed;inset:0;background:rgba(0,0,8,.85);backdrop-filter:blur(8px);z-index:0;}
    .mes-modal-box{position:relative;z-index:1;background:linear-gradient(145deg,var(--bg-surface,#07041a),var(--bg-elevated,#0e0926));border:1px solid rgba(0,255,224,.2);border-radius:10px;padding:28px;width:100%;max-width:780px;margin:auto;box-shadow:0 20px 60px rgba(0,0,0,.8);}
    .mes-modal-box::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--primary,#00ffe0),var(--secondary,#7000ff),transparent);border-radius:10px 10px 0 0;}
    .mes-modal-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:22px;padding-bottom:16px;border-bottom:1px solid var(--border);}
    .mes-modal-title{font-family:'Orbitron',sans-serif;font-size:.95rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--primary,#00ffe0);}
    .mes-modal-close{background:rgba(255,0,106,.08);border:1px solid rgba(255,0,106,.2);cursor:pointer;width:34px;height:34px;border-radius:6px;display:flex;align-items:center;justify-content:center;color:rgba(255,0,106,.7);font-size:1rem;transition:all .2s;}
    .mes-modal-close:hover{background:rgba(255,0,106,.2);color:#ff006a;transform:rotate(90deg);}
    .mes-tabs-nav{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:20px;}
    .mes-tab-btn{padding:7px 16px;background:var(--bg-base,#02000a);border:1px solid var(--border);border-radius:6px;font-family:'Rajdhani',sans-serif;font-size:.75rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text-muted,#505868);cursor:pointer;transition:all .18s;}
    .mes-tab-btn:hover{border-color:rgba(0,255,224,.3);color:var(--text-primary);}
    .mes-tab-btn.active{background:rgba(0,255,224,.08);border-color:rgba(0,255,224,.4);color:var(--primary,#00ffe0);}
    .mes-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px;}
    .mes-summary-card{background:var(--bg-base,#02000a);border:1px solid var(--border);border-radius:8px;padding:14px 16px;text-align:center;}
    .mes-summary-label{font-size:.62rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--text-muted);margin-bottom:5px;}
    .mes-summary-val{font-family:'IBM Plex Mono',monospace;font-size:1.1rem;font-weight:700;color:var(--text-primary);}
    .mes-summary-val.teal{color:var(--primary,#00ffe0);}
    .mes-summary-val.gold{color:#ffe600;}
    .mes-ped-card{background:var(--bg-base,#02000a);border:1px solid var(--border);border-radius:8px;padding:14px 16px;margin-bottom:10px;transition:border-color .18s;}
    .mes-ped-card:hover{border-color:rgba(0,255,224,.2);}
    .mes-ped-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:6px;}
    .mes-ped-num{font-family:'IBM Plex Mono',monospace;font-size:.8rem;color:var(--text-primary);}
    .mes-ped-colab{font-size:.7rem;color:var(--text-muted);}
    .mes-ped-items{font-size:.8rem;color:var(--text-secondary,rgba(224,255,248,.6));margin-bottom:6px;line-height:1.7;}
    .mes-ped-footer{display:flex;justify-content:space-between;align-items:center;font-size:.8rem;}
    .mes-ped-total{font-family:'IBM Plex Mono',monospace;color:var(--primary,#00ffe0);font-weight:700;}
    .mes-empty{text-align:center;padding:40px;color:var(--text-muted);font-size:.82rem;letter-spacing:.08em;text-transform:uppercase;}
    `;
    document.head.appendChild(s);
}

// ─── CONFIGURAÇÕES (cardápio principal) ───────────────────────────────────────
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
                            <span>Exibe ou oculta o botão para os clientes.</span>
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
            <div class="config-grid">
                <div class="config-field full-width"><div class="toggle-row"><div class="toggle-left"><strong>🏠 No Local</strong><span>Cliente consome no estabelecimento</span></div><label class="config-switch"><input type="checkbox" id="configServicoLocal" ${ck(cfg.servicoLocal)}><span class="slider"></span></label></div></div>
                <div class="config-field full-width"><div class="toggle-row"><div class="toggle-left"><strong>🚗 Retirada</strong><span>Cliente retira o pedido no local</span></div><label class="config-switch"><input type="checkbox" id="configServicoRetirada" ${ck(cfg.servicoRetirada)}><span class="slider"></span></label></div></div>
                <div class="config-field full-width"><div class="toggle-row"><div class="toggle-left"><strong>🛵 Delivery</strong><span>Entrega no endereço do cliente</span></div><label class="config-switch"><input type="checkbox" id="configServicoDelivery" ${ck(cfg.servicoDelivery)}><span class="slider"></span></label></div></div>
            </div>
        </div>
        ${abaActions('servicos')}
    ${panelClose()}

    ${panelOpen('funcionalidades')}
        <div class="config-section">
            <h3 class="config-title">⚙️ Funcionalidades do Cardápio</h3>
            <div class="config-grid">
                <div class="config-field full-width"><div class="toggle-row"><div class="toggle-left"><strong>🛒 Carrinho de Compras</strong><span>Clientes podem adicionar itens e fazer pedidos.</span></div><label class="config-switch"><input type="checkbox" id="configCarrinho" ${ck(cfg.carrinhoAtivo)}><span class="slider"></span></label></div></div>
            </div>
        </div>
        ${abaActions('funcionalidades')}
    ${panelClose()}

    ${panelOpen('pagamento')}
        <div class="config-section">
            <h3 class="config-title">💳 Pagamento PIX</h3>
            <div class="config-grid">
                <div class="config-field"><label>Chave PIX</label><input type="text" id="configChavePix" value="${cfg.chavePix||''}" class="config-input" placeholder="email, CPF, telefone..."></div>
                <div class="config-field full-width">
                    <label>QR Code PIX — URL da imagem</label>
                    <input type="url" id="configQrCodePix" value="${cfg.qrCodePix||''}" class="config-input">
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
                    <label>QR Code do Menu — URL da imagem</label>
                    <input type="url" id="configQrCodeMenu" value="${cfg.qrCodeMenu||''}" class="config-input" placeholder="https://..." oninput="window.previewQrMenu(this.value)">
                    <div id="qrMenuPreviewContainer" class="qr-preview-box">${cfg.qrCodeMenu?`<img src="${cfg.qrCodeMenu}" alt="QR Menu">`:`<span style="font-size:.75rem;color:var(--text-muted);">Nenhuma imagem</span>`}</div>
                </div>
                <div class="config-field full-width">
                    <label>Links <span style="color:var(--text-muted);font-weight:400;">(um por linha)</span></label>
                    <textarea id="configDominios" rows="4" class="config-input" style="resize:vertical;">${cfg.dominios||''}</textarea>
                    <div id="dominiosListContainer">${renderizarListaDominios(cfg.dominios||'')}</div>
                </div>
            </div>
        </div>
        ${abaActions('qr')}
    ${panelClose()}`;

    document.getElementById('configLogoUrl')?.addEventListener('input', e => {
        const c = document.getElementById('logoPreviewContainer');
        if (!c) return;
        c.innerHTML = e.target.value ? `<div class="image-preview-uploaded"><img src="${e.target.value}" style="max-height:72px;border-radius:8px;"></div>` : '';
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
            <button onclick="navigator.clipboard.writeText('${lk}').then(()=>showToast('Copiado!','success'))" style="background:transparent;border:none;cursor:pointer;color:var(--text-muted);padding:2px 6px;border-radius:4px;" title="Copiar">📋</button>
        </div>`).join('')}</div>`;
}

window.previewQrMenu = function(url) {
    const c = document.getElementById('qrMenuPreviewContainer');
    if (!c) return;
    c.innerHTML = url ? `<img src="${url}" alt="QR Menu" onerror="this.parentElement.innerHTML='<span style=font-size:.75rem;color:#ef4444>URL inválida</span>'">` : `<span style="font-size:.75rem;color:var(--text-muted);">Nenhuma imagem</span>`;
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
    if (!confirm('Restaurar TODOS os padrões globais?')) return;
    configuracoes = { ...DEFAULTS_GLOBAIS };
    renderizarConfiguracoes();
    showToast('Padrões restaurados! Clique em Salvar para aplicar.','info');
};

// ─── CONFIG COLABORADOR ────────────────────────────────────────────────────────
async function carregarConfigColaborador() {
    try {
        const snap = await getDoc(doc(db,'config_col','geral'));
        if (snap.exists()) configColaborador = { ...configColaborador, ...snap.data() };
        iniciarAgendadorAutoReset();
    } catch(e) { console.error(e); }
}

function renderizarConfigCols() {
    const sec = document.getElementById('colabSubContent');
    if (!sec) return;
    const cfg = configColaborador;

    sec.innerHTML = `
    <div class="section-header">
        <h1>Config Colaboradores</h1>
        <button class="btn-primary" onclick="salvarConfigColaborador()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>
            Salvar
        </button>
    </div>

    <div class="config-col-section">
        <h3 class="config-col-title">💸 Desconto & Limites</h3>
        <div class="config-grid">
            <div class="config-field">
                <label>Desconto fixo nos pratos do cardápio (%)</label>
                <input type="number" id="ccDesconto" value="${cfg.desconto||35}" min="0" max="100" step="1" class="config-input">
                <small>Aplicado automaticamente em todos os pratos do cardápio principal para colaboradores.</small>
            </div>
            <div class="config-field">
                <label>Limite padrão (R$) para novos colaboradores</label>
                <input type="number" id="ccLimiteDefault" value="${cfg.limiteDefault||0}" min="0" step="10" class="config-input">
                <small>Valor sugerido ao cadastrar um novo colaborador. Pode ser alterado individualmente.</small>
            </div>
        </div>
    </div>

    <div class="config-col-section">
        <h3 class="config-col-title">⚙️ Funcionalidades</h3>
        <div class="config-grid">
            <div class="config-field full-width">
                <div class="toggle-row">
                    <div class="toggle-left">
                        <strong>🛒 Carrinho na página do colaborador</strong>
                        <span>Colaboradores podem fazer pedidos. Desativado suspende todos os pedidos.</span>
                    </div>
                    <label class="config-switch">
                        <input type="checkbox" id="ccCarrinho" ${ck(cfg.carrinhoAtivo!==false)}>
                        <span class="slider"></span>
                    </label>
                </div>
            </div>
        </div>
    </div>

    <div class="config-col-section">
        <h3 class="config-col-title">🗓️ Reset Automático de Gastos</h3>
        <div class="config-grid">
            <div class="config-field full-width">
                <div class="toggle-row">
                    <div class="toggle-left">
                        <strong>⏰ Zerar gastos automaticamente em uma data/hora</strong>
                        <span>Quando ativado e a data/hora chegar, todos os gastos dos colaboradores serão zerados automaticamente.</span>
                    </div>
                    <label class="config-switch">
                        <input type="checkbox" id="ccAutoResetAtivo" ${ck(cfg.autoResetAtivo===true)} onchange="toggleAutoResetField()">
                        <span class="slider"></span>
                    </label>
                </div>
            </div>
            <div class="config-field full-width" id="autoResetDateField" style="display:${cfg.autoResetAtivo ? 'block' : 'none'};">
                <label>📅 Data e horário do reset</label>
                <input type="datetime-local" id="ccAutoResetData" value="${cfg.autoResetData||''}" class="config-input" style="max-width:280px;">
                <small>O reset será executado automaticamente assim que este painel estiver aberto e a data/hora for atingida.</small>
                ${cfg.autoResetUltimaExecucao ? `<div style="margin-top:8px;padding:8px 12px;background:rgba(0,255,136,.07);border:1px solid rgba(0,255,136,.2);border-radius:6px;font-size:.78rem;color:#22c55e;">✅ Último reset executado em: <strong>${new Date(cfg.autoResetUltimaExecucao).toLocaleString('pt-BR')}</strong></div>` : ''}
            </div>
        </div>
    </div>

    <div class="config-col-section">
        <h3 class="config-col-title">📊 Resumo dos Colaboradores</h3>
        ${renderizarResumoColaboradores()}
    </div>`;
}

function renderizarResumoColaboradores() {
    if (!colaboradores.length) return `<p style="color:var(--text-muted);font-size:.85rem;">Nenhum colaborador cadastrado.</p>`;
    const total = colaboradores.length;
    const totalGasto = colaboradores.reduce((s,c) => s+(c.gasto||0), 0);
    const totalLimite = colaboradores.reduce((s,c) => s+(c.limite||0), 0);
    return `
    <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);">
        <div class="stat-card"><div class="stat-icon blue"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div><div class="stat-info"><span class="stat-label">Colaboradores</span><span class="stat-value">${total}</span></div></div>
        <div class="stat-card"><div class="stat-icon orange"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><line x1="12" y1="6" x2="12" y2="8"/><line x1="12" y1="16" x2="12" y2="18"/></svg></div><div class="stat-info"><span class="stat-label">Gasto Total</span><span class="stat-value" style="font-size:1.1rem;">R$ ${fmt(totalGasto)}</span></div></div>
        <div class="stat-card"><div class="stat-icon green"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></div><div class="stat-info"><span class="stat-label">Limite Total</span><span class="stat-value" style="font-size:1.1rem;">R$ ${fmt(totalLimite)}</span></div></div>
    </div>`;
}

window.salvarConfigColaborador = async function() {
    try {
        showLoading();
        const n = {
            desconto:              parseFloat(document.getElementById('ccDesconto')?.value || 35),
            limiteDefault:         parseFloat(document.getElementById('ccLimiteDefault')?.value || 0),
            carrinhoAtivo:         document.getElementById('ccCarrinho')?.checked ?? true,
            autoResetAtivo:        document.getElementById('ccAutoResetAtivo')?.checked ?? false,
            autoResetData:         document.getElementById('ccAutoResetData')?.value || '',
            autoResetUltimaExecucao: configColaborador.autoResetUltimaExecucao || ''
        };
        await setDoc(doc(db,'config_col','geral'), n);
        configColaborador = n;
        iniciarAgendadorAutoReset();
        showToast('Config salva!', 'success');
        hideLoading();
    } catch { showToast('Erro ao salvar','error'); hideLoading(); }
};

// ─── AUTO RESET AGENDADOR ─────────────────────────────────────────────────────
let autoResetInterval = null;

window.toggleAutoResetField = function() {
    const ativo = document.getElementById('ccAutoResetAtivo')?.checked;
    const field = document.getElementById('autoResetDateField');
    if (field) field.style.display = ativo ? 'block' : 'none';
};

function iniciarAgendadorAutoReset() {
    if (autoResetInterval) clearInterval(autoResetInterval);
    autoResetInterval = setInterval(verificarAutoReset, 30000); // checa a cada 30s
    verificarAutoReset(); // checa imediatamente ao iniciar/salvar
}

async function verificarAutoReset() {
    const cfg = configColaborador;
    if (!cfg.autoResetAtivo || !cfg.autoResetData) return;

    const agora = new Date();
    const dataReset = new Date(cfg.autoResetData);
    if (isNaN(dataReset.getTime())) return;

    // Já executou para esta data/hora?
    if (cfg.autoResetUltimaExecucao) {
        const ultimaExec = new Date(cfg.autoResetUltimaExecucao);
        if (ultimaExec >= dataReset) return; // já executou para esta configuração
    }

    // Hora chegou?
    if (agora < dataReset) return;

    try {
        // Executa o reset
        if (colaboradores.length) {
            await Promise.all(colaboradores.map(c => updateDoc(doc(db,'colaboradores',c.id), { gasto: 0 })));
        }

        // Registra a execução e desativa o agendamento
        const execTime = agora.toISOString();
        const novaConfig = { ...cfg, autoResetAtivo: false, autoResetUltimaExecucao: execTime };
        await setDoc(doc(db,'config_col','geral'), novaConfig);
        configColaborador = novaConfig;

        showToast(`⏰ Reset automático executado! ${colaboradores.length} colaborador(es) zerado(s).`, 'success');

        // Atualiza UI se a aba estiver aberta
        if (abaAtiva === 'moduloColaborador' && abaColabAtiva === 'configCols') renderizarConfigCols();
        if (abaAtiva === 'moduloColaborador' && abaColabAtiva === 'colaboradores') renderizarColaboradores();

        clearInterval(autoResetInterval);
        autoResetInterval = null;
    } catch(e) {
        console.error('Erro no auto reset:', e);
    }
}

// ─── COLABORADORES ────────────────────────────────────────────────────────────
async function carregarColaboradores() {
    try {
        onSnapshot(collection(db,'colaboradores'), snap => {
            colaboradores = snap.docs.map(d => ({id:d.id,...d.data()}));
            if (abaAtiva==='moduloColaborador' && abaColabAtiva==='colaboradores') renderizarColaboradores();
            if (abaAtiva==='moduloColaborador' && abaColabAtiva==='configCols')    renderizarConfigCols();
        });
    } catch(e) { console.error(e); }
}

function renderizarColaboradores() {
    const sec = document.getElementById('colabSubContent');
    if (!sec) return;

    sec.innerHTML = `
    <div class="section-header">
        <h1>Colaboradores</h1>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <button class="btn-danger" onclick="zerarTodosGastos()" style="display:inline-flex;align-items:center;gap:6px;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.17"/></svg>
                Zerar Todos
            </button>
            <button class="btn-primary" onclick="abrirModalColab()">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Novo Colaborador
            </button>
        </div>
    </div>
    ${!colaboradores.length
        ? `<div style="text-align:center;padding:60px;color:var(--text-muted);">Nenhum colaborador cadastrado.</div>`
        : `<div class="colab-grid">${colaboradores.map(renderColabCard).join('')}</div>`
    }`;

    garantirModalColab();
}

window.zerarTodosGastos = async function() {
    if (!colaboradores.length) { showToast('Nenhum colaborador cadastrado.', 'error'); return; }
    if (!confirm(`Zerar o gasto de TODOS os ${colaboradores.length} colaboradores?`)) return;
    pedirSenhaAdmin('Zerar Todos os Gastos', async () => {
        try {
            showLoading();
            await Promise.all(colaboradores.map(c => updateDoc(doc(db, 'colaboradores', c.id), { gasto: 0 })));
            showToast(`Gasto de ${colaboradores.length} colaborador(es) zerado!`, 'success');
            hideLoading();
        } catch { showToast('Erro ao zerar gastos.', 'error'); hideLoading(); }
    });
};

function renderColabCard(c) {
    const lim  = c.limite || 0;
    const gasto= c.gasto  || 0;
    const disp = Math.max(0, lim - gasto);
    const pct  = lim > 0 ? Math.min(100, (gasto/lim)*100) : 0;
    const fillClass = pct >= 100 ? 'over' : pct >= 80 ? 'warn' : '';
    return `
    <div class="colab-card">
        <div class="colab-name">${c.nome}</div>
        <div class="colab-meta">
            <span>🔑 Senha: ${c.senha ? '••••••' : '<em style="color:var(--danger)">não definida</em>'}</span>
            <span>💰 Limite: R$ ${fmt(lim)}</span>
            <span>📊 Gasto: R$ ${fmt(gasto)}</span>
            <span style="color:${disp<=0?'var(--danger)':'var(--success)'}">✅ Disponível: R$ ${fmt(disp)}</span>
        </div>
        <div class="colab-limit-bar"><div class="colab-limit-fill ${fillClass}" style="width:${pct}%"></div></div>
        <div class="colab-actions">
            <button class="btn-icon" onclick="editarColab('${c.id}')">✏️ Editar</button>
            <button class="colab-reset-btn" onclick="resetarGastoColab('${c.id}','${c.nome}')">🔄 Zerar Gasto</button>
            <button class="btn-icon danger" onclick="excluirColab('${c.id}')">🗑️</button>
        </div>
    </div>`;
}

function garantirModalColab() {
    if (document.getElementById('colabModal')) return;
    const div = document.createElement('div');
    div.innerHTML = `
    <div class="modal-extra" id="colabModal">
        <div class="modal-extra-overlay" id="colabModalOverlay"></div>
        <div class="modal-extra-content">
            <button class="modal-extra-close" onclick="fecharModalColab()">✕</button>
            <h2 id="colabModalTitle">Novo Colaborador</h2>
            <div class="config-grid">
                <div class="config-field full-width"><label>Nome *</label><input type="text" id="colabNome" class="config-input" placeholder="Nome completo"></div>
                <div class="config-field"><label>Senha (exatos 5 caracteres) *</label><input type="text" id="colabSenha" class="config-input" placeholder="Ex: 1a2b3"></div>
                <div class="config-field"><label>CPF</label><input type="text" id="colabCpf" class="config-input" placeholder="Apenas números"></div>
                <div class="config-field"><label>Desconto Personalizado (%)</label><input type="number" id="colabDesconto" class="config-input" min="0" max="100" placeholder="Vazio = padrão global"></div>
                <div class="config-field"><label>Limite Mensal (R$)</label><input type="number" id="colabLimite" class="config-input" step="10" min="0" placeholder="0"></div>
            </div>
            <div class="config-actions-aba">
                <button class="btn-secondary" onclick="fecharModalColab()">Cancelar</button>
                <button class="btn-primary" onclick="salvarColab()">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>
                    Salvar
                </button>
            </div>
        </div>
    </div>`;
    document.body.appendChild(div.firstElementChild);
    document.getElementById('colabModalOverlay').addEventListener('click', fecharModalColab);
}

window.abrirModalColab = function() {
    pedirSenhaAdmin('Novo Colaborador', () => {
        garantirModalColab();
        editandoColab = null;
        document.getElementById('colabModalTitle').textContent = 'Novo Colaborador';
        document.getElementById('colabNome').value   = '';
        document.getElementById('colabSenha').value  = '';
        if(document.getElementById('colabCpf')) document.getElementById('colabCpf').value = '';
        if(document.getElementById('colabDesconto')) document.getElementById('colabDesconto').value = '';
        document.getElementById('colabLimite').value = configColaborador.limiteDefault || 0;
        document.getElementById('colabModal').classList.add('active');
    });
};

window.editarColab = function(id) {
    pedirSenhaAdmin('Editar Colaborador', () => {
        garantirModalColab();
        const c = colaboradores.find(x => x.id===id);
        if (!c) return;
        editandoColab = id;
        document.getElementById('colabModalTitle').textContent = 'Editar Colaborador';
        document.getElementById('colabNome').value   = c.nome   || '';
        document.getElementById('colabSenha').value  = c.senha  || '';
        if(document.getElementById('colabCpf')) document.getElementById('colabCpf').value = c.cpf || '';
        if(document.getElementById('colabDesconto')) document.getElementById('colabDesconto').value = c.desconto || '';
        document.getElementById('colabLimite').value = c.limite || 0;
        document.getElementById('colabModal').classList.add('active');
    });
};

window.fecharModalColab = function() {
    document.getElementById('colabModal')?.classList.remove('active');
    editandoColab = null;
};

window.salvarColab = async function() {
    const nome   = document.getElementById('colabNome').value.trim();
    const senha  = document.getElementById('colabSenha').value.trim();
    const limite = parseFloat(document.getElementById('colabLimite').value || 0);
    const cpf    = document.getElementById('colabCpf')?.value.trim() || '';
    const descV  = document.getElementById('colabDesconto')?.value;
    const desconto = descV === '' ? null : parseFloat(descV);

    if (!nome || !senha) { showToast('Nome e senha são obrigatórios!','error'); return; }
    if (senha.length !== 5) { showToast('A senha deve ter exatamente 5 caracteres!','error'); return; }

    try {
        showLoading();
        const dados = { nome, senha, limite };
        if (cpf) dados.cpf = cpf;
        if (desconto !== null) dados.desconto = desconto; else dados.desconto = null;

        if (editandoColab) {
            await updateDoc(doc(db,'colaboradores',editandoColab), dados);
        } else {
            dados.gasto = 0;
            await addDoc(collection(db,'colaboradores'), dados);
        }
        showToast(editandoColab ? 'Colaborador atualizado!' : 'Colaborador criado!', 'success');
        fecharModalColab();
        hideLoading();
    } catch { showToast('Erro ao salvar','error'); hideLoading(); }
};

window.resetarGastoColab = async function(id, nome) {
    if (!confirm(`Zerar o gasto de ${nome}?`)) return;
    pedirSenhaAdmin('Zerar Gasto', async () => {
        try {
            showLoading();
            await updateDoc(doc(db,'colaboradores',id), { gasto: 0 });
            showToast('Gasto zerado!','success');
            hideLoading();
        } catch { showToast('Erro','error'); hideLoading(); }
    });
};

window.excluirColab = async function(id) {
    if (!confirm('Excluir colaborador?')) return;
    pedirSenhaAdmin('Excluir Colaborador', async () => {
        try { showLoading(); await deleteDoc(doc(db,'colaboradores',id)); showToast('Excluído!','success'); hideLoading(); }
        catch { showToast('Erro','error'); hideLoading(); }
    });
};

// ─── PRATOS COLABORADOR ───────────────────────────────────────────────────────
async function carregarPratosCol() {
    try {
        onSnapshot(collection(db,'pratos_col'), snap => {
            pratosCol = snap.docs.map(d => ({id:d.id,...d.data()}));
            if (abaAtiva==='moduloColaborador' && abaColabAtiva==='pratosCols') renderizarPratosCol();
        });
    } catch(e) { console.error(e); }
}

function renderizarPratosCol() {
    const sec = document.getElementById('colabSubContent');
    if (!sec) return;

    sec.innerHTML = `
    <div class="section-header">
        <h1>Pratos Colaborador</h1>
        <button class="btn-primary" onclick="abrirModalPratoCol()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Novo Prato
        </button>
    </div>
    <p style="font-size:.82rem;color:var(--text-muted);margin-bottom:20px;">
        Pratos exclusivos para colaboradores. Podem ter desconto personalizado ou preço fixo.
        Os pratos do cardápio principal já aparecem com <strong style="color:var(--primary)">${configColaborador.desconto||35}% de desconto</strong>.
    </p>
    ${!pratosCol.length
        ? `<div style="text-align:center;padding:60px;color:var(--text-muted);">Nenhum prato colaborador cadastrado.</div>`
        : `<div class="products-grid">${pratosCol.map(renderPratoColCard).join('')}</div>`
    }`;

    garantirModalPratoCol();
}

function renderPratoColCard(p) {
    const ativo = p.ativo !== false;
    const temDesc = p.temDesconto === true && p.desconto > 0;
    const precoFinal = temDesc ? p.preco * (1 - p.desconto/100) : p.preco;
    return `
    <div class="prato-col-card ${!ativo?'product-inactive':''}">
        <div class="prato-col-badge">Colaborador</div>
        <button class="btn-visibility ${ativo?'active':''}" onclick="toggleVisibilidadePratoCol('${p.id}',${ativo})" title="${ativo?'Ocultar':'Mostrar'}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${ativo?'<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>':'<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'}</svg>
        </button>
        ${p.imagem ? `<img src="${p.imagem}" class="prato-col-img" alt="${p.nome}" onerror="this.style.display='none'">` : `<div class="prato-col-img" style="display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:.75rem;text-transform:uppercase;letter-spacing:.1em;">Sem imagem</div>`}
        <div class="prato-col-body">
            <div class="prato-col-name">${p.nome}</div>
            <div class="prato-col-cat">${p.categoria||'Colaborador'}</div>
            ${temDesc ? `<span class="prato-col-desc-tag">Desconto: ${p.desconto}%</span>` : `<span class="prato-col-desc-tag" style="color:var(--text-muted);border-color:var(--border);">Sem desconto</span>`}
            <div class="prato-col-preco">
                ${temDesc ? `<span style="text-decoration:line-through;color:var(--text-muted);font-size:.8rem;">R$ ${fmt(p.preco)}</span><br>` : ''}
                R$ ${fmt(precoFinal)}
            </div>
            <div class="product-actions">
                <button class="btn-icon" onclick="editarPratoCol('${p.id}')">✏️ Editar</button>
                <button class="btn-icon danger" onclick="excluirPratoCol('${p.id}')">🗑️</button>
            </div>
        </div>
    </div>`;
}

function garantirModalPratoCol() {
    if (document.getElementById('pratoColModal')) return;
    const div = document.createElement('div');
    div.innerHTML = `
    <div class="modal-extra" id="pratoColModal">
        <div class="modal-extra-overlay" id="pratoColModalOverlay"></div>
        <div class="modal-extra-content" style="max-width:640px;">
            <button class="modal-extra-close" onclick="fecharModalPratoCol()">✕</button>
            <h2 id="pratoColModalTitle">Novo Prato Colaborador</h2>
            <div class="config-grid">
                <div class="config-field full-width"><label>Nome *</label><input type="text" id="pcNome" class="config-input" placeholder="Nome do prato"></div>
                <div class="config-field"><label>Preço Base (R$) *</label><input type="number" id="pcPreco" class="config-input" step="0.01" min="0" placeholder="0.00"></div>
                <div class="config-field"><label>Categoria</label><input type="text" id="pcCategoria" class="config-input" placeholder="Ex: Lanches, Refeições..."></div>
                <div class="config-field full-width"><label>Descrição</label><textarea id="pcDesc" class="config-input" rows="2" placeholder="Descrição do prato..."></textarea></div>
                <div class="config-field full-width"><label>URL da Imagem</label><input type="url" id="pcImagem" class="config-input" placeholder="https://..."></div>
                <div class="config-field full-width">
                    <div class="toggle-row">
                        <div class="toggle-left"><strong>Tem Desconto?</strong><span>Ativar desconto percentual neste prato</span></div>
                        <label class="config-switch"><input type="checkbox" id="pcTemDesconto" onchange="toggleDescontoPc(this.checked)"><span class="slider"></span></label>
                    </div>
                </div>
                <div class="config-field" id="pcDescontoField" style="display:none;">
                    <label>Desconto (%)</label>
                    <input type="number" id="pcDesconto" class="config-input" min="0" max="100" step="1" placeholder="0" value="0">
                </div>
                <div class="config-field full-width">
                    <div class="toggle-row">
                        <div class="toggle-left"><strong>Ativo</strong><span>Visível para colaboradores</span></div>
                        <label class="config-switch"><input type="checkbox" id="pcAtivo" checked><span class="slider"></span></label>
                    </div>
                </div>
            </div>
            <div style="margin-top:10px;padding:12px;background:rgba(112,0,255,.06);border:1px solid rgba(112,0,255,.2);border-radius:var(--radius-sm);font-size:.82rem;color:var(--text-muted);">
                💡 Os pratos do cardápio principal já aparecem para colaboradores com <strong style="color:var(--primary)">${configColaborador.desconto||35}% de desconto</strong>. Use esta seção para pratos exclusivos do colaborador.
            </div>
            <div class="config-actions-aba">
                <button class="btn-secondary" onclick="fecharModalPratoCol()">Cancelar</button>
                <button class="btn-primary" onclick="salvarPratoCol()">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>
                    Salvar Prato
                </button>
            </div>
        </div>
    </div>`;
    document.body.appendChild(div.firstElementChild);
    document.getElementById('pratoColModalOverlay').addEventListener('click', fecharModalPratoCol);
}

window.toggleDescontoPc = function(on) {
    document.getElementById('pcDescontoField').style.display = on ? 'flex' : 'none';
};

window.abrirModalPratoCol = function() {
    garantirModalPratoCol();
    editandoPratoCol = null;
    document.getElementById('pratoColModalTitle').textContent = 'Novo Prato Colaborador';
    ['pcNome','pcPreco','pcDesc','pcImagem'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
    document.getElementById('pcCategoria').value = '';
    document.getElementById('pcTemDesconto').checked = false;
    document.getElementById('pcDesconto').value = 0;
    document.getElementById('pcAtivo').checked = true;
    document.getElementById('pcDescontoField').style.display = 'none';
    document.getElementById('pratoColModal').classList.add('active');
};

window.editarPratoCol = function(id) {
    pedirSenhaAdmin('Editar Prato do Colaborador', () => {
        garantirModalPratoCol();
        const p = pratosCol.find(x=>x.id===id);
        if (!p) return;
        editandoPratoCol = id;
        document.getElementById('pratoColModalTitle').textContent = 'Editar Prato Colaborador';
        document.getElementById('pcNome').value       = p.nome||'';
        document.getElementById('pcPreco').value      = p.preco||0;
        document.getElementById('pcCategoria').value  = p.categoria||'';
        document.getElementById('pcDesc').value       = p.descricao||'';
        document.getElementById('pcImagem').value     = p.imagem||'';
        document.getElementById('pcTemDesconto').checked = p.temDesconto===true;
        document.getElementById('pcDesconto').value   = p.desconto||0;
        document.getElementById('pcAtivo').checked    = p.ativo!==false;
        document.getElementById('pcDescontoField').style.display = p.temDesconto===true ? 'flex' : 'none';
        document.getElementById('pratoColModal').classList.add('active');
    });
};

window.fecharModalPratoCol = function() {
    document.getElementById('pratoColModal')?.classList.remove('active');
    editandoPratoCol = null;
};

window.salvarPratoCol = async function() {
    const nome      = document.getElementById('pcNome').value.trim();
    const preco     = parseFloat(document.getElementById('pcPreco').value || 0);
    const categoria = document.getElementById('pcCategoria').value.trim() || 'Colaborador';
    const descricao = document.getElementById('pcDesc').value.trim();
    const imagem    = document.getElementById('pcImagem').value.trim();
    const temDesconto = document.getElementById('pcTemDesconto').checked;
    const desconto  = parseFloat(document.getElementById('pcDesconto').value || 0);
    const ativo     = document.getElementById('pcAtivo').checked;

    if (!nome || !preco) { showToast('Nome e preço são obrigatórios!','error'); return; }

    const dados = { nome, preco, categoria, descricao, imagem, temDesconto, desconto: temDesconto ? desconto : 0, ativo };

    try {
        showLoading();
        if (editandoPratoCol) {
            await updateDoc(doc(db,'pratos_col',editandoPratoCol), dados);
            showToast('Prato atualizado!','success');
        } else {
            await addDoc(collection(db,'pratos_col'), dados);
            showToast('Prato criado!','success');
        }
        fecharModalPratoCol();
        hideLoading();
    } catch { showToast('Erro ao salvar','error'); hideLoading(); }
};

window.toggleVisibilidadePratoCol = function(id, ativo) {
    pedirSenhaAdmin(ativo ? 'Desativar Prato' : 'Ativar Prato', async () => {
        try { await updateDoc(doc(db,'pratos_col',id), {ativo:!ativo}); showToast(!ativo?'Prato ativado!':'Prato desativado!','success'); }
        catch { showToast('Erro','error'); }
    });
};

window.excluirPratoCol = async function(id) {
    if (!confirm('Excluir prato do colaborador?')) return;
    pedirSenhaAdmin('Excluir Prato do Colaborador', async () => {
        try { showLoading(); await deleteDoc(doc(db,'pratos_col',id)); showToast('Prato excluído!','success'); hideLoading(); }
        catch { showToast('Erro','error'); hideLoading(); }
    });
};

// ─── PEDIDOS COLABORADOR ──────────────────────────────────────────────────────
async function carregarPedidosCols() {
    try {
        onSnapshot(query(collection(db,'pedidos_col'), orderBy('data','desc')), snap => {
            pedidosCols = snap.docs.map(d => ({id:d.id,...d.data()}));
            if (abaAtiva==='moduloColaborador' && abaColabAtiva==='pedidosCols') renderizarPedidosCols();
            if (abaAtiva==='pedidos' && filtroStatusPedido==='colaborador') filtrarPedidos();
            atualizarDashboard();
        });
    } catch(e) { console.error(e); }
}

function renderizarPedidosCols() {
    const sec = document.getElementById('colabSubContent');
    if (!sec) return;

    sec.innerHTML = `
    <div class="section-header">
        <h1>Pedidos Colaboradores</h1>
        <!-- ✅ MUDANÇA 3: Botão "Todos os Meses" no lugar do "Limpar Todos" -->
        <button class="btn-secondary" onclick="abrirHistoricoMeses()" style="display:inline-flex;align-items:center;gap:6px;">
            📅 Todos os Meses
        </button>
    </div>
    <div class="orders-filter" id="pedColFilters">
        ${['all','novo','aceito','preparando','pronto'].map(s=>`
            <button class="filter-btn ${s==='all'?'active':''}" data-pedcol="${s}" onclick="filtrarPedidosCols('${s}')">
                ${s==='all'?'Todos':capitalize(s)}
            </button>`).join('')}
    </div>
    <div id="pedColList"></div>`;

    filtrarPedidosCols('all');
}

window.filtrarPedidosCols = function(status) {
    document.querySelectorAll('[data-pedcol]').forEach(b => b.classList.toggle('active', b.dataset.pedcol===status));
    const lista = status==='all' ? pedidosCols : pedidosCols.filter(p=>p.status===status);
    const el = document.getElementById('pedColList');
    if (!el) return;
    if (!lista.length) { el.innerHTML=`<div style="text-align:center;padding:60px;color:var(--text-muted);">Nenhum pedido.</div>`; return; }

    el.innerHTML = lista.map(pd => {
        const data = pd.data ? new Date(pd.data.seconds*1000).toLocaleString('pt-BR') : '—';
        const st   = pd.status || 'novo';
        // ✅ MUDANÇA 1: tag "aguardando débito" quando pedido ainda não foi aceito
        const pendente = (st === 'novo');
        return `
        <div class="pedcol-card">
            <div class="pedcol-header">
                <div>
                    <div class="pedcol-num">#${pd.id.substring(0,8).toUpperCase()}</div>
                    <div class="pedcol-colab">👤 ${pd.colaboradorNome||'—'} · ${data}</div>
                </div>
                <span class="pedcol-status ${st}">${st}</span>
            </div>
            ${pd.desconto>0 ? `<span class="pedcol-desconto-tag">🏷️ Desconto de ${pd.desconto}% aplicado</span>` : ''}
            ${pendente ? `<span class="pedcol-pendente-tag">⏳ Aguardando confirmação — valor ainda não debitado</span>` : ''}
            <div class="pedcol-items">
                ${(pd.itens||[]).map(it=>`
                    <div class="pedcol-item-row">
                        <span style="background:rgba(0,255,224,.08);border:1px solid rgba(0,255,224,.12);color:var(--primary);padding:2px 7px;border-radius:2px;font-size:.72rem;font-family:'IBM Plex Mono',monospace;">${it.quantidade}x</span>
                        <span style="flex:1;color:var(--text-secondary);">${it.nome}</span>
                        <span style="font-family:'IBM Plex Mono',monospace;font-size:.8rem;color:var(--text-muted);">R$ ${fmt(it.preco*it.quantidade)}</span>
                    </div>`).join('')}
            </div>
            ${pd.observacao ? `<div style="font-size:.8rem;color:var(--text-muted);font-style:italic;padding:6px 0;">📝 ${pd.observacao}</div>` : ''}
            <div class="pedcol-footer">
                <span class="pedcol-total">Total: R$ ${fmt(pd.total)}</span>
                <div style="display:flex;gap:8px;">
                    ${st==='novo'       ? `<button class="btn-status info"       onclick="atualizarStatusPedCol('${pd.id}','aceito')">Aceitar</button>` : ''}
                    ${st==='aceito'     ? `<button class="btn-status preparando" onclick="atualizarStatusPedCol('${pd.id}','preparando')">Iniciar Preparo</button>` : ''}
                    ${st==='preparando' ? `<button class="btn-status pronto"     onclick="atualizarStatusPedCol('${pd.id}','pronto')">Marcar Pronto</button>` : ''}
                    ${st==='novo'       ? `<button class="btn-status danger"     onclick="cancelarPedidoCol('${pd.id}')">Cancelar</button>` : ''}
                </div>
            </div>
        </div>`;
    }).join('');
}

// ✅ MUDANÇA 1: ao aceitar → debita o gasto do colaborador
window.atualizarStatusPedCol = async function(id, s) {
    try {
        const pedido = pedidosCols.find(p => p.id === id);
        await updateDoc(doc(db,'pedidos_col',id), {status:s, dataAtualizacao:serverTimestamp()});

        // Débito acontece apenas ao ACEITAR
        if (s === 'aceito' && pedido && pedido.colaboradorId) {
            const colabRef = doc(db,'colaboradores', pedido.colaboradorId);
            const colabSnap = await getDoc(colabRef);
            if (colabSnap.exists()) {
                const gastoAtual = colabSnap.data().gasto || 0;
                await updateDoc(colabRef, { gasto: gastoAtual + (pedido.total || 0) });
            }
        }

        showToast(`Pedido ${s}!`,'success');
    } catch { showToast('Erro','error'); }
};

// ✅ MUDANÇA 1: cancelar pedido NÃO reverte gasto (pois nunca foi debitado)
window.cancelarPedidoCol = async function(id) {
    if (!confirm('Cancelar este pedido? O valor não será debitado do colaborador.')) return;
    try {
        showLoading();
        await deleteDoc(doc(db,'pedidos_col',id));
        showToast('Pedido cancelado!','info');
        hideLoading();
    } catch { showToast('Erro','error'); hideLoading(); }
};

// ─── HISTÓRICO POR MÊS ────────────────────────────────────────────────────────
// ✅ MUDANÇA 3: modal de histórico agrupado por mês
let mesSelecionado = null;

window.abrirHistoricoMeses = function() {
    garantirModalHistoricoMeses();
    const modal = document.getElementById('mesModal');
    modal.classList.add('active');
    renderizarMesTabs();
};

function garantirModalHistoricoMeses() {
    if (document.getElementById('mesModal')) return;
    const div = document.createElement('div');
    div.innerHTML = `
    <div class="mes-modal-wrap" id="mesModal">
        <div class="mes-modal-overlay" id="mesModalOverlay"></div>
        <div class="mes-modal-box">
            <div class="mes-modal-header">
                <span class="mes-modal-title">📅 Histórico por Mês</span>
                <button class="mes-modal-close" onclick="fecharHistoricoMeses()">✕</button>
            </div>
            <div class="mes-tabs-nav" id="mesTabs"></div>
            <div id="mesConteudo"></div>
        </div>
    </div>`;
    document.body.appendChild(div.firstElementChild);
    document.getElementById('mesModalOverlay').addEventListener('click', fecharHistoricoMeses);
}

window.fecharHistoricoMeses = function() {
    document.getElementById('mesModal')?.classList.remove('active');
};

function getMesKey(pedido) {
    if (!pedido.data) return 'Sem data';
    const d = new Date(pedido.data.seconds * 1000);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

function getMesLabel(key) {
    if (key === 'Sem data') return 'Sem data';
    const [ano, mes] = key.split('-');
    const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    return `${meses[parseInt(mes)-1]} ${ano}`;
}

function renderizarMesTabs() {
    // Agrupa todos os pedidos por mês (apenas aceitos/preparando/pronto, ou seja, confirmados)
    const todosPedidos = [...pedidosCols]; // inclui todos os status para o histórico
    const meses = {};
    todosPedidos.forEach(p => {
        const k = getMesKey(p);
        if (!meses[k]) meses[k] = [];
        meses[k].push(p);
    });

    const chaves = Object.keys(meses).sort().reverse(); // mais recente primeiro

    if (!chaves.length) {
        document.getElementById('mesTabs').innerHTML = '';
        document.getElementById('mesConteudo').innerHTML = `<div class="mes-empty">Nenhum pedido encontrado.</div>`;
        return;
    }

    // Se não há mês selecionado, usa o mais recente
    if (!mesSelecionado || !meses[mesSelecionado]) {
        mesSelecionado = chaves[0];
    }

    document.getElementById('mesTabs').innerHTML = chaves.map(k => `
        <button class="mes-tab-btn ${mesSelecionado===k?'active':''}" onclick="window.selecionarMes('${k}')">
            ${getMesLabel(k)}
            <span style="background:rgba(0,255,224,.1);color:var(--primary,#00ffe0);border-radius:10px;padding:1px 7px;font-size:.62rem;margin-left:4px;">${meses[k].length}</span>
        </button>`).join('');

    renderizarConteudoMes(meses[mesSelecionado] || []);
}

window.selecionarMes = function(key) {
    mesSelecionado = key;
    renderizarMesTabs();
};

function renderizarConteudoMes(lista) {
    const el = document.getElementById('mesConteudo');
    if (!lista.length) {
        el.innerHTML = `<div class="mes-empty">Nenhum pedido neste mês.</div>`;
        return;
    }

    // Apenas pedidos confirmados (aceitos, preparando ou prontos) contam no total financeiro
    const confirmados = lista.filter(p => ['aceito','preparando','pronto'].includes(p.status));
    const totalPedidos = lista.length;
    const totalConfirmados = confirmados.length;
    const totalValor = confirmados.reduce((s,p) => s+(p.total||0), 0);

    el.innerHTML = `
    <div class="mes-summary">
        <div class="mes-summary-card">
            <div class="mes-summary-label">Total Pedidos</div>
            <div class="mes-summary-val">${totalPedidos}</div>
        </div>
        <div class="mes-summary-card">
            <div class="mes-summary-label">Confirmados</div>
            <div class="mes-summary-val teal">${totalConfirmados}</div>
        </div>
        <div class="mes-summary-card">
            <div class="mes-summary-label">Valor Debitado</div>
            <div class="mes-summary-val gold">R$ ${fmt(totalValor)}</div>
        </div>
    </div>
    ${lista.map(pd => {
        const data = pd.data ? new Date(pd.data.seconds*1000).toLocaleString('pt-BR') : '—';
        const st = pd.status || 'novo';
        const confirmado = ['aceito','preparando','pronto'].includes(st);
        return `
        <div class="mes-ped-card">
            <div class="mes-ped-header">
                <div>
                    <div class="mes-ped-num">#${pd.id.substring(0,8).toUpperCase()}</div>
                    <div class="mes-ped-colab">👤 ${pd.colaboradorNome||'—'} · ${data}</div>
                </div>
                <div style="display:flex;align-items:center;gap:8px;">
                    <span class="pedcol-status ${st}" style="font-size:.6rem;">${st}</span>
                    ${!confirmado ? `<span style="font-size:.6rem;color:#facc15;background:rgba(250,204,21,.08);border:1px solid rgba(250,204,21,.2);padding:2px 7px;border-radius:4px;">não debitado</span>` : ''}
                </div>
            </div>
            <div class="mes-ped-items">
                ${(pd.itens||[]).map(it=>`${it.quantidade}x ${it.nome}`).join(' · ')}
            </div>
            <div class="mes-ped-footer">
                <span class="mes-ped-total">R$ ${fmt(pd.total||0)}</span>
                ${pd.observacao ? `<span style="font-size:.72rem;color:var(--text-muted);font-style:italic;">📝 ${pd.observacao}</span>` : ''}
            </div>
        </div>`;
    }).join('')}`;
}

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
            <div class="page-card">
                <div class="page-icon" style="background:rgba(112,0,255,.1);color:#a855f7;"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg></div>
                <h4>Portal Colaborador</h4><p>Acesso restrito para colaboradores fazerem pedidos</p>
                <div class="page-url"><input type="text" value="${base}colaborador.html" readonly class="url-input" id="urlColab"><button class="btn-copy" onclick="copiarUrl('urlColab')">Copiar</button></div>
                <div class="page-actions"><a href="${base}colaborador.html" target="_blank" class="btn-page">Abrir</a><button class="btn-page secondary" onclick="gerarQRCode('${base}colaborador.html')">QR Code</button></div>
            </div>
        </div>
        <div class="modal" id="qrModal" style="display:none;"><div class="modal-overlay" onclick="fecharQRModal()"></div><div class="modal-content qr-modal-content"><button class="modal-close" onclick="fecharQRModal()"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button><h3>QR Code Gerado</h3><div id="qrCodeContainer"></div><p class="qr-instructions">Clique com botão direito para salvar</p></div></div>`;
}
window.copiarUrl = id => { const e=document.getElementById(id); if(!e) return; e.select(); document.execCommand('copy'); showToast('Link copiado!','success'); };
window.gerarQRCode = url => {
    const m=document.getElementById('qrModal'), c=document.getElementById('qrCodeContainer');
    if (!m||!c) return;
    c.innerHTML=`<img src="https://chart.googleapis.com/chart?cht=qr&chs=300x300&chl=${encodeURIComponent(url)}" style="max-width:100%;border-radius:8px;">`;
    m.style.display='flex';
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
    const totColabs = colaboradores.length;
    const totPedCol = pedidosCols.length;
    const novosCol  = pedidosCols.filter(p=>p.status==='novo').length;

    dc.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card"><div class="stat-icon blue"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg></div><div class="stat-info"><span class="stat-label">Total Produtos</span><span class="stat-value">${total}</span></div></div>
            <div class="stat-card"><div class="stat-icon green"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></div><div class="stat-info"><span class="stat-label">Ativos</span><span class="stat-value">${ativos}</span></div></div>
            <div class="stat-card"><div class="stat-icon orange"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div><div class="stat-info"><span class="stat-label">Pedidos</span><span class="stat-value">${totPed}</span></div></div>
            <div class="stat-card" style="border-color:rgba(112,0,255,.2);">
                <div class="stat-icon" style="background:rgba(112,0,255,.08);color:#a855f7;"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
                <div class="stat-info"><span class="stat-label">Colaboradores</span><span class="stat-value">${totColabs}</span></div>
            </div>
            <div class="stat-card" style="border-color:rgba(112,0,255,.2);">
                <div class="stat-icon" style="background:rgba(112,0,255,.08);color:#a855f7;"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
                <div class="stat-info"><span class="stat-label">Pedidos Col.</span><span class="stat-value">${totPedCol}</span></div>
            </div>
            <div class="stat-card" style="border-color:rgba(255,23,68,.15);">
                <div class="stat-icon" style="background:rgba(255,23,68,.08);color:var(--danger);"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
                <div class="stat-info"><span class="stat-label">Col. Novos</span><span class="stat-value" style="color:var(--danger);">${novosCol}</span></div>
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
            ${exp?`<div class="category-products">${prods.length?prods.map(p=>`<div class="category-product-item"><span>${p.nome}</span><span class="category-product-price">R$ ${fmt(p.preco)}</span><span class="category-product-status ${p.ativo!==false?'active':'inactive'}">${p.ativo!==false?'Ativo':'Inativo'}</span></div>`).join(''):'<p style="color:var(--text-muted);padding:16px;text-align:center;">Nenhum produto</p>'}</div>`:''}</div>`;
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
    if (idx === -1) { configuracoes.maisPedidosIds.push(produtoId); showToast('⭐ Adicionado a Mais Pedidos!','success'); }
    else            { configuracoes.maisPedidosIds.splice(idx,1);   showToast('Removido de Mais Pedidos','info'); }
    try { await setDoc(doc(db,'configuracoes','geral'),{maisPedidosIds:configuracoes.maisPedidosIds},{merge:true}); }
    catch { showToast('Erro ao salvar Mais Pedidos','error'); }
    renderizarFiltrosCategorias();
    renderizarProdutos();
};

// ─── PRODUTOS ─────────────────────────────────────────────────────────────────
function renderizarFiltrosCategorias() {
    const fc = document.getElementById('categoryFilters');
    if (!fc) return;
    const maisPedidosIds = configuracoes.maisPedidosIds || [];
    const qtdDestaque    = maisPedidosIds.length;

    if (!document.getElementById('produtosSearchWrap')) {
        const wrap = document.createElement('div');
        wrap.id = 'produtosSearchWrap';
        wrap.className = 'produtos-search-bar';
        wrap.innerHTML = `
            <svg class="search-icon-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" id="searchProdutos" placeholder="Buscar produto por nome, categoria ou descrição…" autocomplete="off" spellcheck="false" value="${termoBusca}">
            <span class="search-results-count" id="searchResultsCount"></span>
            <button class="search-clear-btn ${termoBusca?'visible':''}" id="searchClearBtn" onclick="window.limparBuscaProdutos()" title="Limpar busca">✕</button>`;
        fc.parentElement.insertBefore(wrap, fc);

        document.getElementById('searchProdutos').addEventListener('input', e => {
            termoBusca = e.target.value;
            document.getElementById('searchClearBtn')?.classList.toggle('visible', !!termoBusca);
            renderizarProdutos();
        });
        document.getElementById('searchProdutos').addEventListener('keydown', e => { if(e.key==='Escape') window.limparBuscaProdutos(); });
    }

    fc.innerHTML =
        `<button class="mais-pedidos-filter-btn ${filtroCategoriaProduto==='__mais_pedidos__'?'active':''}" onclick="window.filtrarPorCategoria('__mais_pedidos__')">⭐ Mais Pedidos${qtdDestaque>0?`<span class="mais-pedidos-badge">${qtdDestaque}</span>`:''}</button>`
        +`<button class="category-filter-btn ${filtroCategoriaProduto==='all'?'active':''}" onclick="window.filtrarPorCategoria('all')">Todos (${produtos.length})</button>`
        + categorias.map(c => { const n=produtos.filter(p=>p.categoria===c.nome).length; return `<button class="category-filter-btn ${filtroCategoriaProduto===c.nome?'active':''}" onclick="window.filtrarPorCategoria('${c.nome}')">${c.nome} (${n})</button>`; }).join('');
}

window.limparBuscaProdutos = function() {
    termoBusca='';
    const inp=document.getElementById('searchProdutos');
    const btn=document.getElementById('searchClearBtn');
    const cnt=document.getElementById('searchResultsCount');
    if(inp) inp.value='';
    if(btn) btn.classList.remove('visible');
    if(cnt) cnt.textContent='';
    renderizarProdutos();
};

window.filtrarPorCategoria = cat => { filtroCategoriaProduto=cat; renderizarFiltrosCategorias(); renderizarProdutos(); };

async function carregarProdutos() {
    try {
        onSnapshot(collection(db,'produtos'), snap => {
            produtos = snap.docs.map(d => ({id:d.id,...d.data()}));
            renderizarFiltrosCategorias();
            renderizarProdutos();
            atualizarDashboard();
        });
    } catch { showToast('Erro ao carregar produtos','error'); }
}

function renderizarProdutos() {
    if (!productsGrid) return;
    const maisPedidosIds = configuracoes.maisPedidosIds || [];
    let lista;
    if (filtroCategoriaProduto==='__mais_pedidos__') lista=produtos.filter(p=>maisPedidosIds.includes(p.id));
    else if (filtroCategoriaProduto==='all')         lista=[...produtos];
    else                                             lista=produtos.filter(p=>p.categoria===filtroCategoriaProduto);

    const termo = termoBusca.trim().toLowerCase();
    if (termo) lista=lista.filter(p=>(p.nome||'').toLowerCase().includes(termo)||(p.categoria||'').toLowerCase().includes(termo)||(p.descricao||'').toLowerCase().includes(termo));

    const cnt = document.getElementById('searchResultsCount');
    if (cnt) cnt.textContent = termo ? `${lista.length} resultado${lista.length!==1?'s':''}` : '';

    if (!lista.length) {
        productsGrid.innerHTML=`<div class="no-results-msg">${termo?`🔍 Nenhum resultado para "<strong>${termoBusca}</strong>"`:filtroCategoriaProduto==='__mais_pedidos__'?`⭐ Nenhum produto em Mais Pedidos.`:'Nenhum produto nesta categoria.'}</div>`;
        return;
    }

    const comSeparador = filtroCategoriaProduto==='all' && !termo && maisPedidosIds.length>0;
    if (comSeparador) lista.sort((a,b)=>(maisPedidosIds.includes(a.id)?0:1)-(maisPedidosIds.includes(b.id)?0:1));

    function renderCard(p) {
        const ativo=p.ativo!==false, qtdAd=p.adicionais?.length||0, ehDestaque=maisPedidosIds.includes(p.id);
        const imgH = p.imagem
            ? `<img src="${p.imagem}" alt="${p.nome}" class="product-image-admin" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"><div class="placeholder-image" style="display:none;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><span>Sem imagem</span></div>`
            : `<div class="placeholder-image"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><span>Sem imagem</span></div>`;
        return `
        <div class="product-card-admin ${!ativo?'product-inactive':''}">
            <button class="btn-visibility ${ativo?'active':''}" onclick="window.toggleVisibilidadeProduto('${p.id}',${ativo})" title="${ativo?'Ocultar':'Mostrar'}">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${ativo?'<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>':'<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'}</svg>
            </button>
            <button class="mais-pedidos-star ${ehDestaque?'ativo':''}" onclick="window.toggleMaisPedidos('${p.id}')" title="${ehDestaque?'Remover de Mais Pedidos':'Adicionar a Mais Pedidos'}">⭐</button>
            ${imgH}
            <div class="product-info-admin">
                <h3 class="product-name-admin">${p.nome}</h3>
                <p class="product-category-admin">${p.categoria||'Sem categoria'}</p>
                ${ehDestaque?`<p class="tag-mais-pedidos">⭐ Mais Pedidos</p>`:''}
                ${qtdAd>0?`<p style="font-size:.73rem;color:var(--accent);font-weight:600;margin:4px 0 0;">🔧 ${qtdAd} adicional(is)</p>`:''}
                <div class="product-price-admin" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                    <div style="display:flex;flex-direction:column;">
                        ${p.precoPromocional?`<span class="preco-original-admin">R$ ${fmt(p.preco)}</span><span class="preco-promo-admin">🏷️ R$ ${fmt(p.precoPromocional)}</span>`:`<span>R$ ${fmt(p.preco)}</span>`}
                    </div>
                    <button class="promo-inline-btn ${p.precoPromocional?'ativo':''}" onclick="window.abrirModalPromocao('${p.id}')" title="${p.precoPromocional?'Editar promoção':'Criar promoção'}">🏷️</button>
                </div>
                <div class="product-actions">
                    <button class="btn-icon" onclick="window.editarProduto('${p.id}')"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Editar</button>
                    <button class="btn-icon danger" onclick="window.excluirProduto('${p.id}')"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Excluir</button>
                </div>
            </div>
        </div>`;
    }

    let html = '';
    if (comSeparador) {
        const dest=lista.filter(p=>maisPedidosIds.includes(p.id)), rest=lista.filter(p=>!maisPedidosIds.includes(p.id));
        if (dest.length) html+=`<div class="grid-section-header gold"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg><span>Mais Pedidos (${dest.length})</span></div>`+dest.map(renderCard).join('');
        if (rest.length) html+=`<div class="grid-section-header teal"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg><span>Outros Produtos (${rest.length})</span></div>`+rest.map(renderCard).join('');
    } else { html=lista.map(renderCard).join(''); }

    productsGrid.innerHTML = html;
}

window.toggleVisibilidadeProduto = async (id,ativo) => {
    try { await updateDoc(doc(db,'produtos',id),{ativo:!ativo}); showToast(!ativo?'Ativado!':'Desativado!','success'); }
    catch { showToast('Erro','error'); }
};

// ─── MODAL PRODUTO ────────────────────────────────────────────────────────────
function abrirModalProduto(id=null) {
    editandoProduto=id;
    injetarCampoImagemUrl();
    injetarSecaoAdicionais();
    if (!id) { if(modalTitle) modalTitle.textContent='Novo Produto'; productForm.reset(); limparPreviewImagem(); adicionaisTemp=[]; renderizarAdicionaisAdmin(); productModal.classList.add('active'); return; }
    const p=produtos.find(x=>x.id===id);
    if (!p) { showToast('Produto não encontrado','error'); return; }
    if(modalTitle) modalTitle.textContent='Editar Produto';
    document.getElementById('productName').value        = p.nome??'';
    document.getElementById('productPrice').value       = p.preco??'';
    document.getElementById('productCategory').value    = p.categoria??'';
    document.getElementById('productDescription').value = p.descricao??'';
    document.getElementById('productActive').checked    = p.ativo!==false;
    const u=document.getElementById('productImageUrl'); if(u) u.value=(p.imagem?.startsWith('http')?p.imagem:'');
    if(imagePreview){ if(p.imagem){imagePreview.innerHTML=`<img src="${p.imagem}" alt="Preview">`;imagePreview.classList.add('active');}else limparPreviewImagem(); }
    adicionaisTemp=p.adicionais?JSON.parse(JSON.stringify(p.adicionais)):[];
    renderizarAdicionaisAdmin();
    productModal.classList.add('active');
}

function injetarCampoImagemUrl() {
    if(document.getElementById('productImageUrl')) return;
    const fg=productImageInput?.closest('.form-group'); if(!fg) return;
    const lbl=fg.querySelector('label'); if(lbl) lbl.textContent='Imagem — Upload de Arquivo';
    const ng=document.createElement('div'); ng.className='form-group'; ng.id='formGroupImageUrl';
    ng.innerHTML=`<label>Imagem — URL Externa</label><input type="url" id="productImageUrl" placeholder="https://exemplo.com/imagem.png" style="width:100%"><small style="color:var(--text-muted)">Link direto para a imagem. Upload tem prioridade.</small>`;
    fg.insertAdjacentElement('afterend',ng);
}

function injetarSecaoAdicionais() {
    if(document.getElementById('adminExtrasContainer')) return;
    const ag=document.getElementById('productActive')?.closest('.form-group'); if(!ag) return;
    const eg=document.createElement('div'); eg.className='form-group'; eg.id='adminExtrasContainer';
    eg.innerHTML=`<label>Adicionais</label>
        <div class="extras-admin-section">
            <div class="extras-admin-header"><span id="extrasCountLabel">Nenhum adicional</span><button type="button" class="btn-add-extra" onclick="window.adicionarNovoAdicional()"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Adicionar</button></div>
            <div class="extras-admin-list" id="extrasAdminList"><p class="extras-empty-msg">Nenhum adicional.</p></div>
        </div>
        <small style="color:var(--text-muted)">Adicionais aparecem no cardápio.</small>`;
    ag.insertAdjacentElement('afterend',eg);
}

function renderizarAdicionaisAdmin() {
    const list=document.getElementById('extrasAdminList'), cnt=document.getElementById('extrasCountLabel');
    if(!list) return;
    if(cnt) cnt.textContent=adicionaisTemp.length?`${adicionaisTemp.length} adicional(is)`:'Nenhum adicional';
    if(!adicionaisTemp.length){list.innerHTML='<p class="extras-empty-msg">Nenhum adicional.</p>';return;}
    list.innerHTML=adicionaisTemp.map((ad,i)=>`
        <div class="extra-admin-item" data-index="${i}">
            <input type="text" class="extra-nome-input" placeholder="Nome" value="${ad.nome||''}" oninput="window.atualizarAdicionalTemp(${i},'nome',this.value)">
            <div class="extra-preco-wrapper"><span>R$</span><input type="number" class="extra-preco-input" placeholder="0,00" step="0.01" min="0" value="${ad.preco||0}" oninput="window.atualizarAdicionalTemp(${i},'preco',this.value)"></div>
            <button type="button" class="btn-remove-extra" onclick="window.removerAdicionalTemp(${i})"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
        </div>`).join('');
}

window.adicionarNovoAdicional = () => { adicionaisTemp.push({nome:'',preco:0}); renderizarAdicionaisAdmin(); setTimeout(()=>{const inp=document.querySelectorAll('.extra-nome-input');if(inp.length) inp[inp.length-1].focus();},50); };
window.atualizarAdicionalTemp = (i,c,v) => { if(adicionaisTemp[i]) adicionaisTemp[i][c]=c==='preco'?(parseFloat(v)||0):v; };
window.removerAdicionalTemp   = i => { adicionaisTemp.splice(i,1); renderizarAdicionaisAdmin(); };

function fecharModalProduto() { productModal.classList.remove('active'); productForm.reset(); limparPreviewImagem(); const u=document.getElementById('productImageUrl'); if(u) u.value=''; adicionaisTemp=[]; editandoProduto=null; }
function limparPreviewImagem() { if(imagePreview){imagePreview.innerHTML='';imagePreview.classList.remove('active');} }
function previewImagem(e) { const f=e.target.files[0]; if(f&&imagePreview){const r=new FileReader();r.onload=ev=>{imagePreview.innerHTML=`<img src="${ev.target.result}">`;imagePreview.classList.add('active');};r.readAsDataURL(f);} }
function previewImagemUrl(url) { if(!imagePreview) return; if(!url){if(!productImageInput?.files?.length) limparPreviewImagem();return;} imagePreview.innerHTML=`<img src="${url}" onerror="this.parentElement.innerHTML='<span style=color:#ef4444;font-size:.8rem>URL inválida</span>'">`;imagePreview.classList.add('active'); }

async function salvarProduto(e) {
    e.preventDefault();
    const nome=document.getElementById('productName').value.trim(), preco=parseFloat(document.getElementById('productPrice').value);
    const categoria=document.getElementById('productCategory').value, descricao=document.getElementById('productDescription').value.trim();
    const ativo=document.getElementById('productActive').checked, imgFile=productImageInput.files[0];
    const imgUrl=(document.getElementById('productImageUrl')?.value||'').trim(), adVal=adicionaisTemp.filter(a=>a.nome?.trim());
    try {
        showLoading();
        let imagem=null;
        if(imgFile){ try{const sr=ref(storage,`produtos/${Date.now()}_${imgFile.name}`);await uploadBytes(sr,imgFile);imagem=await getDownloadURL(sr);}catch{imagem=null;} }
        else if(imgUrl) imagem=imgUrl;
        else if(editandoProduto) imagem=produtos.find(p=>p.id===editandoProduto)?.imagem||null;
        const dados={nome,preco,categoria,descricao,ativo,imagem,adicionais:adVal};
        if(editandoProduto){await updateDoc(doc(db,'produtos',editandoProduto),dados);showToast('Produto atualizado!','success');}
        else{await addDoc(collection(db,'produtos'),dados);showToast('Produto criado!','success');}
        fecharModalProduto(); hideLoading();
    } catch { showToast('Erro ao salvar produto','error'); hideLoading(); }
}

window.editarProduto  = id => abrirModalProduto(id);
window.excluirProduto = async id => {
    if(!confirm('Excluir este produto?')) return;
    try{showLoading();await deleteDoc(doc(db,'produtos',id));showToast('Excluído!','success');hideLoading();}
    catch{showToast('Erro','error');hideLoading();}
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
    if (filtroStatusPedido === 'colaborador') {
        window.renderizarPedidosColNaAbaPrincipal();
        return;
    }
    renderizarPedidos(filtroStatusPedido==='all'?pedidos:pedidos.filter(p=>p.status===filtroStatusPedido)); 
}

window.renderizarPedidosColNaAbaPrincipal = function() {
    const el = document.getElementById('ordersList');
    if (!el) return;
    const lista = pedidosCols;
    if (!lista.length) { el.innerHTML=`<div style="text-align:center;padding:60px;color:var(--text-muted);">Nenhum pedido de colaborador.</div>`; return; }

    el.innerHTML = lista.map(pd => {
        const data = pd.data ? new Date(pd.data.seconds*1000).toLocaleString('pt-BR') : '—';
        const st   = pd.status || 'novo';
        const pendente = (st === 'novo');
        return `
        <div class="pedcol-card">
            <div class="pedcol-header">
                <div>
                    <div class="pedcol-num">#${pd.id.substring(0,8).toUpperCase()} (Colaborador)</div>
                    <div class="pedcol-colab">👤 ${pd.colaboradorNome||'—'} · ${data}</div>
                </div>
                <span class="pedcol-status ${st}">${st}</span>
            </div>
            ${pd.desconto>0 ? `<span class="pedcol-desconto-tag">🏷️ Desconto de ${pd.desconto}% aplicado</span>` : ''}
            ${pendente ? `<span class="pedcol-pendente-tag">⏳ Aguardando confirmação — valor ainda não debitado</span>` : ''}
            <div class="pedcol-items">
                ${(pd.itens||[]).map(it=>`
                    <div class="pedcol-item-row">
                        <span style="background:rgba(0,255,224,.08);border:1px solid rgba(0,255,224,.12);color:var(--primary);padding:2px 7px;border-radius:2px;font-size:.72rem;font-family:'IBM Plex Mono',monospace;">${it.quantidade}x</span>
                        <span style="flex:1;color:var(--text-secondary);">${it.nome}</span>
                        <span style="font-family:'IBM Plex Mono',monospace;font-size:.8rem;color:var(--text-muted);">R$ ${fmt(it.preco*it.quantidade)}</span>
                    </div>`).join('')}
            </div>
            ${pd.observacao ? `<div style="font-size:.8rem;color:var(--text-muted);font-style:italic;padding:6px 0;">📝 ${pd.observacao}</div>` : ''}
            <div class="pedcol-footer">
                <span class="pedcol-total">Total: R$ ${fmt(pd.total)}</span>
                <div style="display:flex;gap:8px;">
                    ${st==='novo'       ? `<button class="btn-status info"       onclick="atualizarStatusPedCol('${pd.id}','aceito')">Aceitar</button>` : ''}
                    ${st==='aceito'     ? `<button class="btn-status preparando" onclick="atualizarStatusPedCol('${pd.id}','preparando')">Iniciar Preparo</button>` : ''}
                    ${st==='preparando' ? `<button class="btn-status pronto"     onclick="atualizarStatusPedCol('${pd.id}','pronto')">Marcar Pronto</button>` : ''}
                    ${st==='novo'       ? `<button class="btn-status danger"     onclick="cancelarPedidoCol('${pd.id}')">Cancelar</button>` : ''}
                </div>
            </div>
        </div>`;
    }).join('');
};

function renderizarPedidos(lista) {
    if(!ordersList) return;
    if(!lista.length){ordersList.innerHTML='<div style="text-align:center;padding:60px;color:var(--text-muted);">Nenhum pedido</div>';return;}
    ordersList.innerHTML=lista.map(pd=>{
        const data=pd.data?new Date(pd.data.seconds*1000).toLocaleString('pt-BR'):'—';
        const log=[{s:'novo',l:'Novo',a:true},{s:'aceito',l:'Aceito',a:pd.status==='aceito'||pd.status==='preparando'||pd.status==='pronto'},{s:'preparando',l:'Preparando',a:pd.status==='preparando'||pd.status==='pronto'},{s:'pronto',l:'Pronto',a:pd.status==='pronto'}];
        return `<div class="order-card">
            <div class="order-header"><div><div class="order-number">Pedido #${pd.id.substring(0,8).toUpperCase()}</div><div class="order-time">${data}</div></div><span class="order-status ${pd.status}">${pd.status}</span></div>
            <div class="order-process-log">${log.map((s,i)=>`<div class="process-step ${s.a?'active':''}"><div class="process-dot"></div><span class="process-label">${s.l}</span></div>${i<log.length-1?'<div class="process-line"></div>':''}`).join('')}</div>
            <div class="order-items">${(pd.itens||[]).map(it=>`<div class="order-item"><div><span class="order-item-name">${it.nome}</span><span class="order-item-qty"> x${it.quantidade}</span></div><span class="order-item-price">R$ ${fmt(it.preco*it.quantidade)}</span></div>`).join('')}</div>
            <div class="order-footer"><div class="order-total">Total: <span>R$ ${fmt(pd.total)}</span></div><div class="order-actions">${pd.status==='novo'?`<button class="btn-status info" onclick="window.atualizarStatusPedido('${pd.id}','aceito')">Aceitar</button>`:''}${pd.status==='aceito'?`<button class="btn-status preparando" onclick="window.atualizarStatusPedido('${pd.id}','preparando')">Iniciar Preparo</button>`:''}${pd.status==='preparando'?`<button class="btn-status pronto" onclick="window.atualizarStatusPedido('${pd.id}','pronto')">Marcar Pronto</button>`:''}${pd.status==='novo'?`<button class="btn-status danger" onclick="window.excluirPedido('${pd.id}')">Excluir</button>`:''}</div></div>
        </div>`;
    }).join('');
}

window.atualizarStatusPedido = async (id,s) => {
    try{await updateDoc(doc(db,'pedidos',id),{status:s,dataAtualizacao:serverTimestamp()});showToast(`Pedido ${s}!`,'success');}
    catch{showToast('Erro','error');}
};
window.excluirPedido = async id => {
    if(!confirm('Excluir?')) return;
    try{showLoading();await deleteDoc(doc(db,'pedidos',id));showToast('Excluído!','success');hideLoading();}
    catch{showToast('Erro','error');hideLoading();}
};
window.limparTodosPedidos = async () => {
    if(!confirm('Excluir TODOS os pedidos?')) return;
    if(!confirm('Confirme novamente.')) return;
    try{
        showLoading();
        const snap=await getDocs(collection(db,'pedidos'));
        await Promise.all(snap.docs.map(d=>deleteDoc(doc(db,'pedidos',d.id))));
        showToast(`${snap.size} pedidos excluídos!`,'success');
        hideLoading();
    }catch{showToast('Erro','error');hideLoading();}
};

// ─── PROMOÇÕES ────────────────────────────────────────────────────────────────
function injetarModalPromocao() {
    if(document.getElementById('promoModal')) return;
    const div=document.createElement('div');
    div.innerHTML=`
    <div class="modal" id="promoModal">
        <div class="modal-overlay" id="promoModalOverlay"></div>
        <div class="modal-content" style="max-width:420px;">
            <button class="modal-close" id="closePromoModal"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            <div style="text-align:center;margin-bottom:20px;"><span style="font-size:2.5rem;">🏷️</span><h2 style="margin:10px 0 4px;font-size:1.3rem;" id="promoModalTitle">Criar Promoção</h2><p style="font-size:.82rem;color:var(--text-muted);">Defina um preço promocional para este produto.</p></div>
            <div class="form-group" style="margin-bottom:8px;"><label>Produto</label><input type="text" id="promoNomeProduto" readonly class="config-input" style="opacity:.6;cursor:default;"></div>
            <div class="form-group" style="margin-bottom:8px;"><label>Preço Original</label><input type="text" id="promoPrecoOriginal" readonly class="config-input" style="opacity:.6;cursor:default;"></div>
            <div class="form-group" style="margin-bottom:20px;"><label>💸 Preço Promocional *</label><input type="number" id="promoPrecoNovo" step="0.01" min="0.01" placeholder="0,00" class="config-input" style="font-size:1.1rem;font-weight:700;"><small style="color:var(--text-muted)">Deixe vazio ou zero para remover.</small></div>
            <div id="promoDesconto" style="display:none;margin-bottom:18px;padding:12px 16px;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.3);border-radius:8px;text-align:center;"><span style="font-size:.9rem;font-weight:700;color:#22c55e;" id="promoDescontoTexto"></span></div>
            <div class="modal-actions" style="gap:10px;">
                <button class="btn-primary" id="btnSalvarPromo" style="flex:1;"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Salvar Promoção</button>
                <button class="btn-danger" id="btnRemoverPromo" style="display:none;"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg> Remover</button>
                <button class="btn-secondary" id="cancelPromoModal">Cancelar</button>
            </div>
        </div>
    </div>`;
    document.body.appendChild(div.firstElementChild);
    document.getElementById('closePromoModal').addEventListener('click', fecharModalPromocao);
    document.getElementById('cancelPromoModal').addEventListener('click', fecharModalPromocao);
    document.getElementById('promoModalOverlay').addEventListener('click', fecharModalPromocao);
    document.getElementById('btnSalvarPromo').addEventListener('click', salvarPromocao);
    document.getElementById('btnRemoverPromo').addEventListener('click', removerPromocao);
    document.getElementById('promoPrecoNovo').addEventListener('input', calcularDesconto);
}

let promoEditandoId=null;

window.abrirModalPromocao = function(id) {
    injetarModalPromocao();
    const p=produtos.find(x=>x.id===id); if(!p) return;
    promoEditandoId=id;
    document.getElementById('promoNomeProduto').value   = p.nome;
    document.getElementById('promoPrecoOriginal').value = 'R$ '+fmt(p.preco);
    document.getElementById('promoPrecoNovo').value     = p.precoPromocional?fmt(p.precoPromocional).replace(',','.'):''
    document.getElementById('promoModalTitle').textContent = p.precoPromocional?'Editar Promoção':'Criar Promoção';
    document.getElementById('btnRemoverPromo').style.display = p.precoPromocional?'inline-flex':'none';
    calcularDesconto();
    document.getElementById('promoModal').classList.add('active');
    setTimeout(()=>document.getElementById('promoPrecoNovo').focus(),100);
};

function fecharModalPromocao() { document.getElementById('promoModal')?.classList.remove('active'); promoEditandoId=null; }

function calcularDesconto() {
    const p=produtos.find(x=>x.id===promoEditandoId); if(!p) return;
    const novo=parseFloat(document.getElementById('promoPrecoNovo')?.value||0);
    const box=document.getElementById('promoDesconto'), txt=document.getElementById('promoDescontoTexto');
    if(!box||!txt) return;
    if(novo>0&&novo<p.preco){const pct=Math.round((1-novo/p.preco)*100);box.style.display='block';txt.textContent=`🎉 Desconto de ${pct}% — economia de R$ ${fmt(p.preco-novo)}`;}
    else box.style.display='none';
}

async function salvarPromocao() {
    if(!promoEditandoId) return;
    const p=produtos.find(x=>x.id===promoEditandoId);
    const novo=parseFloat(document.getElementById('promoPrecoNovo')?.value||0);
    if(!novo||novo<=0){await removerPromocao();return;}
    if(novo>=p.preco){showToast('Preço promocional deve ser menor que o original!','error');return;}
    try{showLoading();await updateDoc(doc(db,'produtos',promoEditandoId),{precoPromocional:novo});showToast('Promoção salva! 🏷️','success');fecharModalPromocao();hideLoading();}
    catch{showToast('Erro ao salvar promoção','error');hideLoading();}
}

async function removerPromocao() {
    if(!promoEditandoId) return;
    if(!confirm('Remover a promoção deste produto?')) return;
    try{showLoading();await updateDoc(doc(db,'produtos',promoEditandoId),{precoPromocional:null});showToast('Promoção removida!','info');fecharModalPromocao();hideLoading();}
    catch{showToast('Erro ao remover promoção','error');hideLoading();}
}

// ─── UTILITÁRIOS ──────────────────────────────────────────────────────────────
function fmt(val)      { return parseFloat(val).toFixed(2).replace('.',','); }
function capitalize(s) { return s.charAt(0).toUpperCase()+s.slice(1); }
function showLoading() { loading?.classList.add('active'); }
function hideLoading() { loading?.classList.remove('active'); }
function showToast(msg,type='success') {
    if(!toast) return;
    toast.textContent=msg; toast.className=`toast ${type} active`;
    setTimeout(()=>toast.classList.remove('active'),3000);
}

// ─── RELATÓRIOS DE COLABORADORES ─────────────────────────────────────────────

// ── Estado do filtro de relatórios ────────────────────────────────────────────
let relFiltros    = { dataInicio: null, dataFim: null, colaboradorId: 'all' };
let _relCal       = { ano: new Date().getFullYear(), mes: new Date().getMonth(), fase: 'primeiro' };
let _relCalAberto = false; // controla se o dropdown do calendário está visível
// fase 'primeiro': próximo clique define o início; 'segundo': próximo clique define o fim

// Filtra lista de pedidos conforme o período selecionado no calendário
function _relFiltrarPorPeriodo(lista) {
    if (!relFiltros.dataInicio) return lista.filter(p => p.data);
    return lista.filter(p => {
        if (!p.data) return false;
        const d = p.data.seconds ? new Date(p.data.seconds * 1000) : (p.data.toDate ? p.data.toDate() : new Date(p.data));
        return d >= relFiltros.dataInicio && d <= relFiltros.dataFim;
    });
}

// Texto descritivo do período selecionado
function _relPeriodoLabel() {
    if (!relFiltros.dataInicio) return 'Todos os registros';
    const di = relFiltros.dataInicio.toLocaleDateString('pt-BR');
    const df = relFiltros.dataFim.toLocaleDateString('pt-BR');
    return di === df ? di : `${di} → ${df}`;
}

// Renderiza widget de calendário para seleção de período
function _renderCalendario() {
    const { ano, mes } = _relCal;
    const hoje        = new Date();
    const diasNoMes   = new Date(ano, mes + 1, 0).getDate();
    const offsetSem   = new Date(ano, mes, 1).getDay(); // 0=Dom
    const nomeMes     = new Date(ano, mes, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    const di  = relFiltros.dataInicio;
    const df  = relFiltros.dataFim;
    const diD = di ? new Date(di.getFullYear(), di.getMonth(), di.getDate()) : null;
    const dfD = df ? new Date(df.getFullYear(), df.getMonth(), df.getDate()) : null;

    const cabecalho = ['D','S','T','Q','Q','S','S'].map(l =>
        `<div style="text-align:center;font-size:.6rem;font-weight:700;color:var(--text-muted,#505868);padding:4px 0;">${l}</div>`
    ).join('');

    const vazios = Array(offsetSem).fill('<div></div>').join('');

    const dias = Array.from({ length: diasNoMes }, (_, i) => {
        const d     = i + 1;
        const dataD = new Date(ano, mes, d);

        const isInicio = diD && dataD.getTime() === diD.getTime();
        const isFim    = dfD && dataD.getTime() === dfD.getTime();
        const inRange  = diD && dfD && dataD > diD && dataD < dfD;
        const isHoje   = dataD.toDateString() === hoje.toDateString();

        let bg = 'transparent', cor = 'var(--text-primary,#f0f2f7)', borda = '1px solid transparent', fw = '400', br = '6px';

        if (isInicio && isFim) {
            // Dia único selecionado
            bg = '#a855f7'; cor = '#fff'; borda = '1px solid #9333ea'; fw = '700';
        } else if (isInicio) {
            bg = '#a855f7'; cor = '#fff'; borda = '1px solid #9333ea'; fw = '700'; br = '6px 0 0 6px';
        } else if (isFim) {
            bg = '#a855f7'; cor = '#fff'; borda = '1px solid #9333ea'; fw = '700'; br = '0 6px 6px 0';
        } else if (inRange) {
            bg = 'rgba(168,85,247,.18)'; borda = '1px solid rgba(168,85,247,.12)'; br = '0';
        } else if (isHoje) {
            borda = '1px solid rgba(168,85,247,.55)'; cor = '#c084fc'; fw = '600';
        }

        const fixo     = isInicio || isFim || inRange;
        const hoverIn  = fixo ? '' : `this.style.background='rgba(168,85,247,.14)';this.style.borderColor='rgba(168,85,247,.3)'`;
        const hoverOut = fixo ? '' : `this.style.background='${bg}';this.style.borderColor='transparent'`;

        return `<div onclick="window.relCalClicarDia(${ano},${mes},${d})"
            style="text-align:center;padding:5px 1px;border-radius:${br};cursor:pointer;font-size:.8rem;font-weight:${fw};background:${bg};color:${cor};border:${borda};transition:background .1s;user-select:none;"
            onmouseover="${hoverIn}" onmouseout="${hoverOut}">${d}</div>`;
    }).join('');

    const labelSel   = _relPeriodoLabel();
    const isSelAtivo = !!di;

    return `<div style="background:var(--bg-elevated,#1a1e28);border:1px solid var(--border);border-radius:10px;padding:10px 12px;width:232px;">
        <!-- Navegação de mês -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:4px;">
            <button onclick="window.relCalNavegar(-1)" title="Mês anterior"
                style="background:none;border:1px solid var(--border);color:var(--text-muted,#505868);cursor:pointer;font-size:1rem;width:28px;height:28px;border-radius:6px;padding:0;display:flex;align-items:center;justify-content:center;flex-shrink:0;"
                onmouseover="this.style.background='rgba(255,255,255,.06)';this.style.color='var(--text-primary,#f0f2f7)'"
                onmouseout="this.style.background='none';this.style.color='var(--text-muted,#505868)'">‹</button>
            <span style="font-size:.78rem;font-weight:700;color:var(--text-primary,#f0f2f7);text-transform:capitalize;text-align:center;flex:1;">${nomeMes}</span>
            <button onclick="window.relCalNavegar(1)" title="Próximo mês"
                style="background:none;border:1px solid var(--border);color:var(--text-muted,#505868);cursor:pointer;font-size:1rem;width:28px;height:28px;border-radius:6px;padding:0;display:flex;align-items:center;justify-content:center;flex-shrink:0;"
                onmouseover="this.style.background='rgba(255,255,255,.06)';this.style.color='var(--text-primary,#f0f2f7)'"
                onmouseout="this.style.background='none';this.style.color='var(--text-muted,#505868)'">›</button>
        </div>
        <!-- Grade de dias -->
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:8px;">
            ${cabecalho}${vazios}${dias}
        </div>
        <!-- Rodapé: seleção atual + limpar -->
        <div style="border-top:1px solid var(--border);padding-top:8px;display:flex;justify-content:space-between;align-items:center;gap:6px;min-height:28px;">
            <span style="font-size:.7rem;color:${isSelAtivo ? '#c084fc' : 'var(--text-muted,#505868)'};font-weight:${isSelAtivo ? '700' : '400'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;" title="${labelSel}">
                ${isSelAtivo ? '📅 ' : '📋 '}${labelSel}
            </span>
            ${isSelAtivo
                ? `<button onclick="window.relCalLimpar()"
                    style="font-size:.68rem;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);color:#f87171;border-radius:5px;padding:3px 8px;cursor:pointer;font-family:inherit;white-space:nowrap;flex-shrink:0;"
                    onmouseover="this.style.background='rgba(239,68,68,.2)'"
                    onmouseout="this.style.background='rgba(239,68,68,.1)'">✕ Limpar</button>`
                : `<span style="font-size:.68rem;color:var(--text-muted,#505868);font-style:italic;">Clique para filtrar</span>`
            }
        </div>
    </div>`;
}

// ── Handlers do calendário ────────────────────────────────────────────────────
window.relCalNavegar = function(delta) {
    _relCal.mes += delta;
    if (_relCal.mes < 0)  { _relCal.mes = 11; _relCal.ano--; }
    if (_relCal.mes > 11) { _relCal.mes = 0;  _relCal.ano++; }
    window.renderizarRelatorios();
};

window.relCalToggle = function() {
    _relCalAberto = !_relCalAberto;
    window.renderizarRelatorios();
};

window.relCalClicarDia = function(ano, mes, dia) {
    const clicado = new Date(ano, mes, dia);

    if (_relCal.fase === 'primeiro' || !relFiltros.dataInicio) {
        // 1º clique: dia único selecionado
        relFiltros.dataInicio = new Date(ano, mes, dia, 0, 0, 0, 0);
        relFiltros.dataFim    = new Date(ano, mes, dia, 23, 59, 59, 999);
        _relCal.fase          = 'segundo';
    } else {
        // 2º clique
        const iniD = new Date(relFiltros.dataInicio.getFullYear(), relFiltros.dataInicio.getMonth(), relFiltros.dataInicio.getDate());
        if (clicado.getTime() === iniD.getTime()) {
            // Clicou no mesmo dia → deseleciona
            relFiltros.dataInicio = null;
            relFiltros.dataFim    = null;
        } else if (clicado < iniD) {
            // Clicou antes → o início vira o fim, novo dia vira o início
            const novoFim = new Date(iniD.getFullYear(), iniD.getMonth(), iniD.getDate(), 23, 59, 59, 999);
            relFiltros.dataInicio = new Date(ano, mes, dia, 0, 0, 0, 0);
            relFiltros.dataFim    = novoFim;
        } else {
            // Clicou depois → estende o intervalo
            relFiltros.dataFim = new Date(ano, mes, dia, 23, 59, 59, 999);
        }
        _relCal.fase = 'primeiro';
        // fecha o dropdown ao completar a seleção de intervalo
        if (relFiltros.dataInicio) _relCalAberto = false;
    }
    window.renderizarRelatorios();
};

window.relCalLimpar = function() {
    relFiltros.dataInicio = null;
    relFiltros.dataFim    = null;
    _relCal.fase          = 'primeiro';
    _relCalAberto         = false;
    window.renderizarRelatorios();
};

function _selStyle() {
    return 'padding:8px 13px;background:var(--bg-elevated,#1a1e28);border:1px solid var(--border);border-radius:8px;color:var(--text-primary,#f0f2f7);font-family:inherit;font-size:.82rem;cursor:pointer;outline:none;min-width:200px;';
}

function _thSt(align) {
    return `padding:9px 14px;text-align:${align};font-size:.68rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--text-muted,#505868);white-space:nowrap;`;
}

function _tdSt(align) {
    return `padding:10px 14px;text-align:${align};vertical-align:middle;`;
}

function _relStatCard(icon, label, valor, bg, cor) {
    return `<div style="background:${bg};border:1px solid ${cor}44;border-radius:10px;padding:14px 16px;display:flex;align-items:center;gap:10px;">
        <span style="font-size:1.35rem;">${icon}</span>
        <div>
            <div style="font-size:.63rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${cor};opacity:.85;">${label}</div>
            <div style="font-size:.98rem;font-weight:700;color:${cor};">${valor}</div>
        </div>
    </div>`;
}

function _renderColabBloco(g) {
    const total  = g.pedidos.reduce((s, p) => s + (p.total || 0), 0);
    const sorted = [...g.pedidos].sort((a, b) => (b.data?.seconds || 0) - (a.data?.seconds || 0));

    const stColor = s => s==='pronto'?'#22c55e':s==='preparando'?'#f59e0b':s==='cancelado'?'#ef4444':'#3b82f6';
    const stBg    = s => s==='pronto'?'rgba(34,197,94,.1)':s==='preparando'?'rgba(245,158,11,.1)':s==='cancelado'?'rgba(239,68,68,.1)':'rgba(59,130,246,.1)';

    return `
    <div style="background:var(--bg-elevated,#1a1e28);border:1px solid var(--border);border-radius:12px;margin-bottom:16px;overflow:hidden;">
        <!-- Cabeçalho do colaborador -->
        <div style="padding:14px 18px;background:rgba(168,85,247,.06);border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
            <div style="display:flex;align-items:center;gap:10px;">
                <div style="width:36px;height:36px;border-radius:50%;background:rgba(168,85,247,.15);border:1px solid rgba(168,85,247,.35);display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0;">👤</div>
                <div>
                    <div style="font-weight:700;font-size:.95rem;">${g.nome}</div>
                    <div style="font-size:.72rem;color:var(--text-muted,#505868);">${sorted.length} pedido(s) no período</div>
                </div>
            </div>
            <div style="text-align:right;">
                <div style="font-size:.63rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted,#505868);">Total do período</div>
                <div style="font-size:1.2rem;font-weight:700;color:#a855f7;">R$ ${fmt(total)}</div>
            </div>
        </div>

        ${sorted.length === 0
            ? `<div style="padding:24px;text-align:center;color:var(--text-muted,#505868);font-size:.85rem;">— Sem pedidos neste período —</div>`
            : `<div style="overflow-x:auto;">
                <table style="width:100%;border-collapse:collapse;font-size:.82rem;">
                    <thead>
                        <tr style="border-bottom:1px solid var(--border);background:rgba(0,0,0,.18);">
                            <th style="${_thSt('left')}">Data</th>
                            <th style="${_thSt('left')}">Hora</th>
                            <th style="${_thSt('left')}">Itens</th>
                            <th style="${_thSt('right')}">Total</th>
                            <th style="${_thSt('center')}">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sorted.map(p => {
                            const d    = p.data?.seconds ? new Date(p.data.seconds * 1000) : (p.data?.toDate ? p.data.toDate() : new Date());
                            const data = d.toLocaleDateString('pt-BR');
                            const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                            const itens = (p.itens || []).map(it =>
                                `<span style="display:inline-block;background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.2);border-radius:4px;padding:1px 7px;margin:1px 2px;font-size:.74rem;white-space:nowrap;">${it.quantidade}× ${it.nome}</span>`
                            ).join('');
                            return `<tr style="border-bottom:1px solid rgba(255,255,255,.04);transition:background .15s;" onmouseover="this.style.background='rgba(255,255,255,.025)'" onmouseout="this.style.background=''">
                                <td style="${_tdSt('left')};white-space:nowrap;font-weight:600;">${data}</td>
                                <td style="${_tdSt('left')};color:var(--text-muted,#505868);white-space:nowrap;">${hora}</td>
                                <td style="${_tdSt('left')};">
                                    <div style="display:flex;flex-wrap:wrap;gap:2px;">${itens}</div>
                                    ${p.observacao ? `<div style="font-size:.7rem;color:var(--text-muted,#505868);margin-top:4px;">📝 ${p.observacao}</div>` : ''}
                                </td>
                                <td style="${_tdSt('right')};font-weight:700;white-space:nowrap;">R$ ${fmt(p.total)}</td>
                                <td style="${_tdSt('center')};">
                                    <span style="background:${stBg(p.status)};color:${stColor(p.status)};border:1px solid ${stColor(p.status)}44;border-radius:20px;padding:2px 10px;font-size:.7rem;font-weight:600;white-space:nowrap;">${p.status}</span>
                                </td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                    <tfoot>
                        <tr style="border-top:2px solid var(--border);background:rgba(168,85,247,.05);">
                            <td colspan="3" style="${_tdSt('right')};font-size:.8rem;font-weight:600;color:var(--text-muted,#505868);">Total do período:</td>
                            <td style="${_tdSt('right')};font-weight:700;font-size:.98rem;color:#a855f7;">R$ ${fmt(total)}</td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>`
        }
    </div>`;
}

window.renderizarRelatorios = function() {
    const sec = document.getElementById('colabSubContent');
    if (!sec) return;

    const todosPeriodos = !relFiltros.dataInicio;

    // Colaboradores em ordem alfabética
    const colabsOrdenados = [...colaboradores].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    // Filtra pedidos pelo período selecionado no calendário (ou todos)
    const noPeriodo = _relFiltrarPorPeriodo(pedidosCols);

    // Filtra por colaborador se não for "Todos"
    const filtrados = relFiltros.colaboradorId === 'all'
        ? noPeriodo
        : noPeriodo.filter(p => p.colaboradorId === relFiltros.colaboradorId);

    // Monta grupos em ordem alfabética
    const grupos = {};
    const listaBase = relFiltros.colaboradorId === 'all'
        ? colabsOrdenados
        : colabsOrdenados.filter(c => c.id === relFiltros.colaboradorId);

    listaBase.forEach(c => { grupos[c.id] = { nome: c.nome, pedidos: [] }; });
    filtrados.forEach(p => {
        const cid = p.colaboradorId;
        if (!grupos[cid]) grupos[cid] = { nome: p.colaboradorNome || cid, pedidos: [] };
        grupos[cid].pedidos.push(p);
    });

    // Ordena entradas do objeto por nome
    const gruposOrdenados = Object.entries(grupos).sort(([, a], [, b]) => a.nome.localeCompare(b.nome, 'pt-BR'));

    const totalGeral   = filtrados.reduce((s, p) => s + (p.total || 0), 0);
    const colabAtivos  = Object.values(grupos).filter(g => g.pedidos.length > 0).length;

    const colabSelecionadoNome = relFiltros.colaboradorId !== 'all'
        ? (colaboradores.find(c => c.id === relFiltros.colaboradorId)?.nome || 'Selecionado')
        : null;

    const encerramento = todosPeriodos ? 'Todo o histórico' : relFiltros.dataFim.toLocaleDateString('pt-BR');

    const btnImpBase  = 'padding:8px 13px;border-radius:8px;font-family:inherit;font-size:.8rem;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:5px;white-space:nowrap;border:1px solid';
    const btnDisabled = 'padding:8px 13px;background:rgba(255,255,255,.03);border:1px solid var(--border);color:var(--text-muted,#505868);border-radius:8px;font-family:inherit;font-size:.8rem;font-weight:600;cursor:not-allowed;display:flex;align-items:center;gap:5px;white-space:nowrap;opacity:.45;';

    sec.innerHTML = `
    <div>
        <!-- Filtros -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:20px;">
            <h2 style="margin:0;font-size:1.1rem;font-weight:700;display:flex;align-items:center;gap:7px;">📊 Relatório de Gastos</h2>
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;">

                <!-- Calendário de período (dropdown) -->
                <div style="position:relative;">
                    <div style="font-size:.65rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--text-muted,#505868);margin-bottom:5px;">Período</div>
                    <!-- Botão "Todos os registros" / período selecionado + seta -->
                    <div onclick="window.relCalToggle()" style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 13px;background:var(--bg-elevated,#1a1e28);border:1px solid ${relFiltros.dataInicio ? 'rgba(168,85,247,.55)' : 'var(--border)'};border-radius:8px;min-width:220px;cursor:pointer;user-select:none;transition:border-color .18s;" onmouseover="this.style.borderColor='rgba(168,85,247,.55)'" onmouseout="this.style.borderColor='${relFiltros.dataInicio ? 'rgba(168,85,247,.55)' : 'var(--border)'}'">
                        <span style="font-size:.82rem;color:${relFiltros.dataInicio ? '#c084fc' : 'var(--text-primary,#f0f2f7)'};font-weight:${relFiltros.dataInicio ? '700' : '400'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:170px;" title="${_relPeriodoLabel()}">
                            ${relFiltros.dataInicio ? '📅 ' : '📋 '}${_relPeriodoLabel()}
                        </span>
                        <span style="font-size:.85rem;color:var(--text-muted,#505868);transition:transform .2s;display:inline-block;transform:${_relCalAberto ? 'rotate(180deg)' : 'rotate(0deg)'};flex-shrink:0;">▾</span>
                    </div>
                    <!-- Calendário (dropdown) -->
                    ${_relCalAberto ? `<div style="position:absolute;top:calc(100% + 6px);left:0;z-index:200;">${_renderCalendario()}</div>` : ''}
                </div>

                <!-- Seletor de colaborador (ordem alfabética) -->
                <div>
                    <div style="font-size:.65rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--text-muted,#505868);margin-bottom:5px;">Colaborador</div>
                    <select onchange="window.filtrarRelatorio('colab',this.value)" style="${_selStyle()}">
                        <option value="all" ${relFiltros.colaboradorId === 'all' ? 'selected' : ''}>👥 Todos os colaboradores</option>
                        ${colabsOrdenados.map(c => `<option value="${c.id}" ${c.id === relFiltros.colaboradorId ? 'selected' : ''}>${c.nome}</option>`).join('')}
                    </select>
                </div>

                <!-- Botões Imprimir -->
                <div style="display:flex;flex-direction:column;gap:5px;">
                    <div style="font-size:.65rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--text-muted,#505868);">🖨️ Imprimir</div>
                    <div style="display:flex;gap:6px;flex-wrap:wrap;">
                        <button onclick="window.imprimirRelatorio('all')"
                            style="${btnImpBase} rgba(59,130,246,.35);background:rgba(59,130,246,.12);color:#3b82f6;"
                            onmouseover="this.style.background='rgba(59,130,246,.22)'" onmouseout="this.style.background='rgba(59,130,246,.12)'">
                            🖨️ Todos
                        </button>
                        ${colabSelecionadoNome
                            ? `<button onclick="window.imprimirRelatorio('${relFiltros.colaboradorId}')"
                                style="${btnImpBase} rgba(168,85,247,.35);background:rgba(168,85,247,.12);color:#a855f7;max-width:160px;overflow:hidden;text-overflow:ellipsis;"
                                title="Imprimir apenas: ${colabSelecionadoNome}"
                                onmouseover="this.style.background='rgba(168,85,247,.22)'" onmouseout="this.style.background='rgba(168,85,247,.12)'">
                                🖨️ ${colabSelecionadoNome}
                              </button>`
                            : `<button disabled style="${btnDisabled}" title="Selecione um colaborador específico">🖨️ Selecionado</button>`
                        }
                    </div>
                </div>

                <!-- Botões Excel -->
                <div style="display:flex;flex-direction:column;gap:5px;">
                    <div style="font-size:.65rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--text-muted,#505868);">📊 Excel</div>
                    <div style="display:flex;gap:6px;flex-wrap:wrap;">
                        <button onclick="window.exportarRelatorioExcel('all')"
                            style="${btnImpBase} rgba(34,197,94,.35);background:rgba(34,197,94,.12);color:#22c55e;"
                            onmouseover="this.style.background='rgba(34,197,94,.22)'" onmouseout="this.style.background='rgba(34,197,94,.12)'">
                            📊 Todos
                        </button>
                        ${colabSelecionadoNome
                            ? `<button onclick="window.exportarRelatorioExcel('${relFiltros.colaboradorId}')"
                                style="${btnImpBase} rgba(245,158,11,.35);background:rgba(245,158,11,.12);color:#f59e0b;max-width:160px;overflow:hidden;text-overflow:ellipsis;"
                                title="Excel apenas: ${colabSelecionadoNome}"
                                onmouseover="this.style.background='rgba(245,158,11,.22)'" onmouseout="this.style.background='rgba(245,158,11,.12)'">
                                📊 ${colabSelecionadoNome}
                              </button>`
                            : `<button disabled style="${btnDisabled}" title="Selecione um colaborador específico">📊 Selecionado</button>`
                        }
                    </div>
                </div>

            </div>
        </div>

        <!-- Cards de resumo -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:22px;">
            ${_relStatCard('💳', 'Total Gasto', 'R$ ' + fmt(totalGeral), 'rgba(168,85,247,.1)', '#a855f7')}
            ${_relStatCard('📦', 'Pedidos',     filtrados.length,         'rgba(59,130,246,.1)', '#3b82f6')}
            ${_relStatCard('👥', 'Com pedidos', colabAtivos,              'rgba(34,197,94,.1)',  '#22c55e')}
            ${_relStatCard('📅', todosPeriodos ? 'Período' : 'Encerramento', encerramento, 'rgba(245,158,11,.1)', '#f59e0b')}
        </div>

        <!-- Blocos por colaborador (ordem alfabética) -->
        ${gruposOrdenados.length === 0
            ? `<div style="text-align:center;padding:60px 20px;color:var(--text-muted,#505868);">Nenhum colaborador cadastrado.</div>`
            : gruposOrdenados.map(([, g]) => _renderColabBloco(g)).join('')
        }
    </div>`;
};

window.imprimirRelatorio = function(colabId) {
    const nomeEmpresa   = (configuracoes && configuracoes.nomeCardapio) ? configuracoes.nomeCardapio : 'X-Food';
    const emitidoEm     = new Date().toLocaleString('pt-BR');
    const periodoLabel  = _relPeriodoLabel();

    // Monta dados filtrados
    const noPeriodo = _relFiltrarPorPeriodo(pedidosCols);
    const filtrados = colabId === 'all' ? noPeriodo : noPeriodo.filter(p => p.colaboradorId === colabId);

    // Colaboradores em ordem alfabética
    const colabsOrdenados = [...colaboradores].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    const listaBase = colabId === 'all' ? colabsOrdenados : colabsOrdenados.filter(c => c.id === colabId);

    const grupos = {};
    listaBase.forEach(c => { grupos[c.id] = { nome: c.nome, pedidos: [] }; });
    filtrados.forEach(p => {
        const cid = p.colaboradorId;
        if (!grupos[cid]) grupos[cid] = { nome: p.colaboradorNome || cid, pedidos: [] };
        grupos[cid].pedidos.push(p);
    });

    // Ordena grupos por nome
    const gruposOrdenados = Object.entries(grupos).sort(([, a], [, b]) => a.nome.localeCompare(b.nome, 'pt-BR'));

    const totalGeral  = filtrados.reduce((s, p) => s + (p.total || 0), 0);
    const tituloScope = colabId === 'all' ? 'Todos os Colaboradores' : (grupos[colabId]?.nome || '');

    // Gera HTML de cada bloco de colaborador (ordem alfabética)
    const gruposHtml = gruposOrdenados.map(([, g]) => {
        const total  = g.pedidos.reduce((s, p) => s + (p.total || 0), 0);
        const sorted = [...g.pedidos].sort((a, b) => (b.data?.seconds || 0) - (a.data?.seconds || 0));

        const linhas = sorted.map(p => {
            const d    = p.data?.seconds ? new Date(p.data.seconds * 1000) : (p.data?.toDate ? p.data.toDate() : new Date());
            const data = d.toLocaleDateString('pt-BR');
            const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const itens = (p.itens || []).map(it => `${it.quantidade}× ${it.nome}`).join(', ');
            return `<tr>
                <td>${data}</td>
                <td>${hora}</td>
                <td>${itens}${p.observacao ? `<br><small style="color:#666;">📝 ${p.observacao}</small>` : ''}</td>
                <td style="text-align:right;white-space:nowrap;">R$ ${fmt(p.total)}</td>
                <td style="text-align:center;">${p.status}</td>
            </tr>`;
        }).join('');

        return `
        <div class="colab-block">
            <div class="colab-header">
                <div>
                    <div class="colab-nome">${g.nome}</div>
                    <div class="colab-sub">${sorted.length} pedido(s) no período</div>
                </div>
                <div class="colab-total">R$ ${fmt(total)}</div>
            </div>
            ${sorted.length === 0
                ? `<p class="empty">Sem pedidos neste período.</p>`
                : `<table>
                    <thead>
                        <tr><th>Data</th><th>Hora</th><th>Itens</th><th style="text-align:right;">Total</th><th style="text-align:center;">Status</th></tr>
                    </thead>
                    <tbody>${linhas}</tbody>
                    <tfoot>
                        <tr>
                            <td colspan="3" style="text-align:right;"><strong>Total do período</strong></td>
                            <td style="text-align:right;"><strong>R$ ${fmt(total)}</strong></td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>`
            }
        </div>`;
    }).join('');

    const reportBody = `
<div class="rpt-header">
  <div>
    <div class="rpt-title">${nomeEmpresa} — Relatório de Gastos</div>
    <div class="rpt-sub">
      Período: <strong>${periodoLabel}</strong><br>
      Escopo: <strong>${tituloScope}</strong>
    </div>
  </div>
  <div class="rpt-meta">
    Emitido em:<br><strong>${emitidoEm}</strong>
  </div>
</div>
<div class="summary">
  <div class="sc"><div class="sc-lbl">Total Gasto</div><div class="sc-val">R$ ${fmt(totalGeral)}</div></div>
  <div class="sc"><div class="sc-lbl">Pedidos</div><div class="sc-val">${filtrados.length}</div></div>
  <div class="sc"><div class="sc-lbl">Colaboradores</div><div class="sc-val">${Object.values(grupos).filter(g => g.pedidos.length > 0).length}</div></div>
</div>
${gruposHtml}
<div class="rpt-footer">
  <span>${nomeEmpresa} — Sistema de Gestão de Colaboradores</span>
  <span>Gerado em ${emitidoEm}</span>
</div>`;

    const rptStyles = `
  *{margin:0;padding:0;box-sizing:border-box;}
  body,#rptBody{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#111;background:#fff;}
  .rpt-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:18px;}
  .rpt-title{font-size:18px;font-weight:700;margin-bottom:4px;}
  .rpt-sub{font-size:11px;color:#444;line-height:1.7;}
  .rpt-meta{text-align:right;font-size:10px;color:#666;line-height:1.7;}
  .summary{display:flex;gap:12px;margin-bottom:22px;flex-wrap:wrap;}
  .sc{flex:1;min-width:110px;border:1px solid #ddd;border-radius:6px;padding:10px 13px;background:#f9f9f9;}
  .sc-lbl{font-size:9px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#777;}
  .sc-val{font-size:16px;font-weight:700;color:#111;margin-top:3px;}
  .colab-block{margin-bottom:26px;page-break-inside:avoid;}
  .colab-block + .colab-block{border-top:1px dashed #bbb;padding-top:22px;}
  .colab-header{display:flex;justify-content:space-between;align-items:center;background:#f0f0f0;border:1px solid #ccc;border-radius:6px;padding:10px 14px;margin-bottom:10px;}
  .colab-nome{font-size:13px;font-weight:700;}
  .colab-sub{font-size:10px;color:#666;margin-top:2px;}
  .colab-total{font-size:17px;font-weight:700;color:#333;}
  .empty{color:#999;font-style:italic;padding:10px 0;font-size:11px;}
  table{width:100%;border-collapse:collapse;font-size:11px;}
  thead tr{background:#222;color:#fff;}
  thead th{padding:7px 10px;text-align:left;font-size:10px;letter-spacing:.04em;text-transform:uppercase;font-weight:600;}
  tbody tr:nth-child(even){background:#f7f7f7;}
  tbody td{padding:7px 10px;border-bottom:1px solid #eee;vertical-align:top;line-height:1.5;}
  tfoot tr{background:#ececec;border-top:2px solid #222;}
  tfoot td{padding:8px 10px;}
  .rpt-footer{margin-top:28px;border-top:1px solid #ccc;padding-top:10px;font-size:9px;color:#999;display:flex;justify-content:space-between;}
  @media print{#rptPrintToolbar{display:none!important;}.colab-block{page-break-inside:avoid;}}`;

    // Salva HTML completo para uso na impressão real
    window._relPrintFullHtml = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8">
<title>Relatório — ${periodoLabel}</title>
<style>${rptStyles}</style>
</head><body style="padding:28px 32px;">${reportBody}
<script>window.onload=function(){window.print();}<\/script>
</body></html>`;

    // Cria/atualiza overlay bloqueante
    let overlay = document.getElementById('relPrintOverlay');
    if (overlay) overlay.remove();

    overlay = document.createElement('div');
    overlay.id = 'relPrintOverlay';
    overlay.style.cssText = [
        'position:fixed','top:0','left:0','width:100%','height:100%',
        'z-index:99999','background:rgba(0,0,0,.78)',
        'backdrop-filter:blur(5px)','-webkit-backdrop-filter:blur(5px)',
        'display:flex','align-items:flex-start','justify-content:center',
        'overflow-y:auto','padding:20px','box-sizing:border-box'
    ].join(';');

    overlay.innerHTML = `
    <div style="background:#fff;color:#111;width:100%;max-width:980px;border-radius:12px;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,.6);margin:auto;flex-shrink:0;">
        <!-- Barra de ferramentas -->
        <div id="rptPrintToolbar" style="background:#1a1e28;color:#f0f2f7;padding:13px 22px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;border-bottom:2px solid #111;">
            <div style="display:flex;align-items:center;gap:10px;">
                <span style="font-size:1.1rem;">🖨️</span>
                <div>
                    <div style="font-weight:700;font-size:.95rem;">Pré-visualização do Relatório</div>
                    <div style="font-size:.72rem;color:#7c8799;margin-top:1px;">${periodoLabel} · ${tituloScope}</div>
                </div>
            </div>
            <div style="display:flex;gap:8px;">
                <button onclick="window.executarImpressao()"
                    style="padding:9px 20px;background:#3b82f6;color:#fff;border:none;border-radius:8px;font-family:inherit;font-size:.85rem;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px;"
                    onmouseover="this.style.background='#2563eb'" onmouseout="this.style.background='#3b82f6'">
                    🖨️ Imprimir / Salvar PDF
                </button>
                <button onclick="window.fecharModalImpressao()"
                    style="padding:9px 20px;background:#ef4444;color:#fff;border:none;border-radius:8px;font-family:inherit;font-size:.85rem;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px;"
                    onmouseover="this.style.background='#dc2626'" onmouseout="this.style.background='#ef4444'">
                    ✕ Fechar
                </button>
            </div>
        </div>
        <!-- Conteúdo do relatório -->
        <div id="rptBody" style="padding:28px 32px;">
            <style>${rptStyles}</style>
            ${reportBody}
        </div>
    </div>`;

    document.body.appendChild(overlay);
};

window.executarImpressao = function() {
    if (!window._relPrintFullHtml) return;
    const win = window.open('', '_blank', 'width=980,height=750');
    if (!win) { showToast('Permita popups para imprimir.', 'error'); return; }
    win.document.write(window._relPrintFullHtml);
    win.document.close();
};

window.fecharModalImpressao = function() {
    const overlay = document.getElementById('relPrintOverlay');
    if (overlay) overlay.remove();
};

// ─── EXPORTAR EXCEL (ExcelJS — planilha estilizada) ──────────────────────────
window.exportarRelatorioExcel = function(colabId) {
    const nomeEmpresa  = (configuracoes && configuracoes.nomeCardapio) ? configuracoes.nomeCardapio : 'X-Food';
    const periodoLabel = _relPeriodoLabel();
    const noPeriodo    = _relFiltrarPorPeriodo(pedidosCols);
    const filtrados    = colabId === 'all' ? noPeriodo : noPeriodo.filter(p => p.colaboradorId === colabId);

    const colabsOrdenados = [...colaboradores].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    const listaBase = colabId === 'all' ? colabsOrdenados : colabsOrdenados.filter(c => c.id === colabId);

    const grupos = {};
    listaBase.forEach(c => { grupos[c.id] = { nome: c.nome, pedidos: [] }; });
    filtrados.forEach(p => {
        const cid = p.colaboradorId;
        if (!grupos[cid]) grupos[cid] = { nome: p.colaboradorNome || cid, pedidos: [] };
        grupos[cid].pedidos.push(p);
    });
    const gruposOrdenados = Object.entries(grupos).sort(([, a], [, b]) => a.nome.localeCompare(b.nome, 'pt-BR'));

    // Carrega ExcelJS sob demanda
    const _carregarExcelJS = () => new Promise((resolve, reject) => {
        if (window.ExcelJS) { resolve(window.ExcelJS); return; }
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.3.0/exceljs.min.js';
        s.onload  = () => resolve(window.ExcelJS);
        s.onerror = () => reject(new Error('Falha ao carregar ExcelJS'));
        document.head.appendChild(s);
    });

    showToast('Gerando planilha Excel…', 'info');

    _carregarExcelJS().then(async ExcelJS => {
        const wb = new ExcelJS.Workbook();
        wb.creator  = nomeEmpresa;
        wb.created  = new Date();

        const ws = wb.addWorksheet('Relatório', {
            views: [{ state: 'frozen', ySplit: 6 }],
            pageSetup: { orientation: 'landscape', fitToPage: true }
        });

        ws.columns = [
            { width: 32 }, // Colaborador
            { width: 13 }, // Data
            { width:  9 }, // Hora
            { width: 50 }, // Itens
            { width: 30 }, // Observação
            { width: 16 }, // Total
            { width: 14 }, // Status
        ];

        const COLS = 7;

        // ── Paleta (profissional com acentos sutis) ──────────────────────────
        const C = {
            bg0      : 'FFFFFFFF', // fundo base branco
            bg1      : 'FF1e2535', // fundo título/meta (azul petróleo escuro)
            bgHeader : 'FF2c3e55', // cabeçalho das colunas (azul acinzentado)
            bgColab  : 'FFe8edf3', // cabeçalho por colaborador (azul muito claro)
            bgRowA   : 'FFFFFFFF', // linha par (branco)
            bgRowB   : 'FFf4f6f9', // linha ímpar (cinza azulado suave)
            bgSub    : 'FFdce4ef', // subtotal (azul claro)
            bgTotal  : 'FF1e2535', // total geral (mesmo do título)
            txPrimary: 'FF1a1a2e',
            txMuted  : 'FF64748b',
            txTeal   : 'FFFFFFFF', // branco (título/total)
            txBlue   : 'FF1e3a5f', // azul escuro (subtotal)
            txGreen  : 'FFFFFFFF', // branco (total geral)
            txGreenL : 'FF1a1a2e', // quase preto (valores linhas)
            txColab  : 'FF1e2535', // azul muito escuro (nome colaborador)
            white    : 'FFFFFFFF',
            bdrDark  : 'FFc9d3de',
            bdrTeal  : 'FF2c3e55',
            bdrBlue  : 'FF7ea8cc',
            bdrGreen : 'FF1e2535',
        };

        const thin   = color => ({ style: 'thin',   color: { argb: color } });
        const medium = color => ({ style: 'medium',  color: { argb: color } });
        const borderBox  = (c) => ({ top: thin(c),   bottom: thin(c),   left: thin(c),   right: thin(c)   });
        const borderMid  = (c) => ({ top: medium(c), bottom: medium(c), left: medium(c), right: medium(c) });
        const borderHBar = (c, side) => {
            const b = { top: thin(C.bdrDark), bottom: thin(C.bdrDark), left: thin(C.bdrDark), right: thin(C.bdrDark) };
            b[side] = medium(c);
            return b;
        };

        const fill = argb => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });

        const applyCell = (cell, opts = {}) => {
            if (opts.bg)       cell.fill      = fill(opts.bg);
            if (opts.color)    cell.font       = { ...(cell.font||{}), color: { argb: opts.color } };
            if (opts.bold)     cell.font       = { ...(cell.font||{}), bold: true };
            if (opts.italic)   cell.font       = { ...(cell.font||{}), italic: true };
            if (opts.size)     cell.font       = { ...(cell.font||{}), size: opts.size };
            if (opts.numFmt)   cell.numFmt     = opts.numFmt;
            if (opts.border)   cell.border     = opts.border;
            if (opts.align)    cell.alignment  = { vertical: 'middle', ...opts.align };
        };

        // ── Linha de título ──────────────────────────────────────────────────
        const rowTit = ws.addRow([`${nomeEmpresa} — Relatório de Gastos`]);
        ws.mergeCells(rowTit.number, 1, rowTit.number, COLS);
        rowTit.height = 40;
        applyCell(rowTit.getCell(1), {
            bg: C.bg1, color: C.txTeal, bold: true, size: 16,
            align: { horizontal: 'center' },
            border: borderMid(C.bdrTeal)
        });

        // ── Metadados ────────────────────────────────────────────────────────
        const addMeta = (label, value) => {
            const r = ws.addRow([`${label}:  ${value}`]);
            r.height = 17;
            ws.mergeCells(r.number, 1, r.number, COLS);
            applyCell(r.getCell(1), {
                bg: C.bg1, color: C.txMuted, italic: true, size: 9,
                align: { horizontal: 'left', indent: 2 },
                border: { left: medium(C.bdrTeal), right: medium(C.bdrTeal), top: thin(C.bdrDark), bottom: thin(C.bdrDark) }
            });
        };
        addMeta('Período',    periodoLabel);
        addMeta('Escopo',     colabId === 'all' ? 'Todos os Colaboradores' : (grupos[colabId]?.nome || ''));
        addMeta('Emitido em', new Date().toLocaleString('pt-BR'));

        // Separador
        const rowSep = ws.addRow([]);
        ws.mergeCells(rowSep.number, 1, rowSep.number, COLS);
        rowSep.height = 5;
        rowSep.getCell(1).fill = fill(C.bg0);

        // ── Cabeçalho das colunas ────────────────────────────────────────────
        const HDR = ['Colaborador', 'Data', 'Hora', 'Itens', 'Observação', 'Total (R$)', 'Status'];
        const rowHdr = ws.addRow(HDR);
        rowHdr.height = 24;
        rowHdr.eachCell({ includeEmpty: true }, (cell, col) => {
            cell.fill      = fill(C.bgHeader);
            cell.font      = { bold: true, color: { argb: C.white }, size: 10 };
            cell.alignment = { vertical: 'middle', horizontal: col === 6 ? 'right' : 'center' };
            cell.border    = {
                top:    medium(C.bdrTeal),
                bottom: medium(C.bdrTeal),
                left:   col === 1    ? medium(C.bdrTeal) : thin(C.bdrDark),
                right:  col === COLS ? medium(C.bdrTeal) : thin(C.bdrDark),
            };
        });

        // ── Dados por colaborador ────────────────────────────────────────────
        gruposOrdenados.forEach(([, g]) => {
            const sorted     = [...g.pedidos].sort((a, b) => (a.data?.seconds||0) - (b.data?.seconds||0));
            const totalColab = g.pedidos.reduce((s, p) => s + (p.total||0), 0);

            // Linha cabeçalho do colaborador — mesclada em todas as colunas, sem total
            const rColab = ws.addRow([`  ${g.nome}`, '', '', '', '', '', '']);
            ws.mergeCells(rColab.number, 1, rColab.number, COLS);
            rColab.height = 24;
            rColab.eachCell({ includeEmpty: true }, (cell) => {
                cell.fill   = fill(C.bg1);
                cell.border = {
                    top:    medium(C.bdrTeal),
                    bottom: thin(C.bdrDark),
                    left:   medium(C.bdrTeal),
                    right:  medium(C.bdrTeal),
                };
            });
            rColab.getCell(1).value     = `  ${g.nome}`;
            rColab.getCell(1).font      = { bold: true, color: { argb: C.white }, size: 10.5 };
            rColab.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

            if (sorted.length === 0) {
                const r = ws.addRow(['', '—', '—', 'Sem pedidos no período', '—', '', '—']);
                r.height = 19;
                r.eachCell({ includeEmpty: true }, (cell, col) => {
                    cell.fill      = fill(C.bgRowA);
                    cell.font      = { italic: true, color: { argb: C.txMuted }, size: 9 };
                    cell.alignment = { vertical: 'middle', horizontal: col === 4 ? 'left' : 'center' };
                    cell.border    = {
                        top: thin(C.bdrDark), bottom: thin(C.bdrDark),
                        left:  col === 1    ? medium(C.bdrTeal) : thin(C.bdrDark),
                        right: col === COLS ? medium(C.bdrTeal) : thin(C.bdrDark),
                    };
                });
            } else {
                sorted.forEach((p, i) => {
                    const d    = p.data?.seconds ? new Date(p.data.seconds*1000) : (p.data?.toDate ? p.data.toDate() : new Date());
                    const data = d.toLocaleDateString('pt-BR');
                    const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    const itens = (p.itens||[]).map(it => `${it.quantidade}x ${it.nome}`).join(', ');
                    const bgRow = i % 2 === 0 ? C.bgRowA : C.bgRowB;

                    const r = ws.addRow([g.nome, data, hora, itens, p.observacao||'', p.total||0, p.status||'']);
                    r.height = 20;
                    r.eachCell({ includeEmpty: true }, (cell, col) => {
                        cell.fill   = fill(bgRow);
                        cell.border = {
                            top: thin(C.bdrDark), bottom: thin(C.bdrDark),
                            left:  col === 1    ? medium(C.bdrTeal) : thin(C.bdrDark),
                            right: col === COLS ? medium(C.bdrTeal) : thin(C.bdrDark),
                        };
                        cell.font   = { color: { argb: C.txPrimary }, size: 9 };

                        if (col === 1) {
                            cell.font      = { color: { argb: C.txMuted }, size: 8.5, italic: true };
                            cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 2 };
                        } else if (col === 2 || col === 3) {
                            cell.alignment = { vertical: 'middle', horizontal: 'center' };
                        } else if (col === 4) {
                            cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
                        } else if (col === 5) {
                            cell.font      = { color: { argb: C.txMuted }, size: 8.5, italic: true };
                            cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
                        } else if (col === 6) {
                            cell.value     = p.total || 0;
                            cell.numFmt    = '"R$ "#,##0.00';
                            cell.font      = { bold: true, color: { argb: C.txGreenL }, size: 9 };
                            cell.alignment = { vertical: 'middle', horizontal: 'right' };
                        } else if (col === 7) {
                            cell.alignment = { vertical: 'middle', horizontal: 'center' };
                            cell.font      = { color: { argb: C.txMuted }, size: 8.5 };
                        }
                    });
                });
            }

            // Linha subtotal do colaborador
            const rSub = ws.addRow([`Subtotal — ${g.nome}`, '', '', '', '', totalColab, '']);
            ws.mergeCells(rSub.number, 1, rSub.number, 5);
            rSub.height = 21;
            rSub.eachCell({ includeEmpty: true }, (cell, col) => {
                cell.fill   = fill(C.bgSub);
                cell.border = {
                    top:    medium(C.bdrBlue),
                    bottom: medium(C.bdrTeal),
                    left:   col === 1    ? medium(C.bdrTeal) : thin(C.bdrDark),
                    right:  col === COLS ? medium(C.bdrTeal) : thin(C.bdrDark),
                };
                if (col === 1) {
                    cell.font      = { bold: true, color: { argb: C.txBlue }, size: 9.5 };
                    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 2 };
                }
                if (col === 6) {
                    cell.value     = totalColab;
                    cell.numFmt    = '"R$ "#,##0.00';
                    cell.font      = { bold: true, color: { argb: C.txBlue }, size: 10 };
                    cell.alignment = { vertical: 'middle', horizontal: 'right' };
                }
            });

            // Separador entre colaboradores
            const rBlank = ws.addRow([]);
            ws.mergeCells(rBlank.number, 1, rBlank.number, COLS);
            rBlank.height = 5;
            rBlank.getCell(1).fill = fill(C.bg0);
        });

        // ── Total Geral ───────────────────────────────────────────────────────
        const totalGeral = filtrados.reduce((s, p) => s + (p.total||0), 0);
        const rTotal = ws.addRow(['TOTAL GERAL', '', '', '', '', totalGeral, '']);
        ws.mergeCells(rTotal.number, 1, rTotal.number, 5);
        rTotal.height = 30;
        rTotal.eachCell({ includeEmpty: true }, (cell, col) => {
            cell.fill   = fill(C.bgTotal);
            cell.border = borderMid(C.bdrGreen);
            if (col === 1) {
                cell.font      = { bold: true, size: 13, color: { argb: C.txGreen } };
                cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 2 };
            }
            if (col === 6) {
                cell.value     = totalGeral;
                cell.numFmt    = '"R$ "#,##0.00';
                cell.font      = { bold: true, size: 13, color: { argb: C.txGreen } };
                cell.alignment = { vertical: 'middle', horizontal: 'right' };
            }
        });

        // ── Gerar buffer e baixar ─────────────────────────────────────────────
        const buffer = await wb.xlsx.writeBuffer();
        const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url    = URL.createObjectURL(blob);
        const a      = document.createElement('a');
        const colabNome  = colabId === 'all' ? 'Todos' : (colaboradores.find(c => c.id === colabId)?.nome || colabId);
        const safePeriod = periodoLabel.replace(/[\/\\?%*:|"<>]/g, '-');
        a.href     = url;
        a.download = `${nomeEmpresa} - Relatório - ${colabNome} - ${safePeriod}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('✅ Excel gerado com sucesso!', 'success');

    }).catch(err => {
        console.error(err);
        showToast('Erro ao gerar Excel. Verifique sua conexão.', 'error');
    });
};

window.filtrarRelatorio = function(tipo, valor) {
    if (tipo === 'colab') relFiltros.colaboradorId = valor;
    window.renderizarRelatorios();
};

console.log('X-Food Admin v4 — Colaboradores + Pratos Col + Pedidos Col inicializado!');