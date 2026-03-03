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

// ─── Padrões globais — tudo desativado ────────────────────────────────────────
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
    dominios:        ''
};

// Padrões por aba (para reset individual)
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
            if (sec==='dashboard')      atualizarDashboard();
            else if (sec==='configuracoes') renderizarConfiguracoes();
            else if (sec==='pages')     renderizarPages();
            else if (sec==='produtos')  renderizarFiltrosCategorias();
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
    `;
    document.head.appendChild(s);
}

// ─── CONFIGURACOES ────────────────────────────────────────────────────────────
async function carregarConfiguracoes() {
    try {
        const snap = await getDoc(doc(db,'configuracoes','geral'));
        if (snap.exists()) configuracoes = { ...configuracoes, ...snap.data() };
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

// Botões de ação individuais por aba
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

// Reset individual por aba
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
    <!-- MINI-ABAS NAV -->
    <div class="config-tabs-nav">
        ${tabBtn('aparencia',       'Aparência',       '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>')}
        ${tabBtn('info',            'Informações',     '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>')}
        ${tabBtn('servicos',        'Serviços',        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>')}
        ${tabBtn('funcionalidades', 'Funcionalidades', '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>')}
        ${tabBtn('pagamento',       'Pagamento',       '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>')}
        ${tabBtn('qr',              'QR / Links',      '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>')}
    </div>

    <!-- ── ABA APARENCIA ── -->
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

    <!-- ── ABA INFORMACOES ── -->
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

    <!-- ── ABA SERVICOS ── -->
    ${panelOpen('servicos')}
        <div class="config-section">
            <h3 class="config-title">🏷️ Tipos de Atendimento</h3>
            <p style="font-size:.8rem;color:var(--text-muted);margin-bottom:18px;">Ative apenas os serviços que seu estabelecimento oferece. Todos desativados por padrão.</p>
            <div class="config-grid">
                <div class="config-field full-width">
                    <div class="toggle-row">
                        <div class="toggle-left">
                            <strong>🏠 No Local</strong>
                            <span>Cliente consome no estabelecimento</span>
                        </div>
                        <label class="config-switch">
                            <input type="checkbox" id="configServicoLocal" ${ck(cfg.servicoLocal)}>
                            <span class="slider"></span>
                        </label>
                    </div>
                </div>
                <div class="config-field full-width">
                    <div class="toggle-row">
                        <div class="toggle-left">
                            <strong>🚗 Retirada</strong>
                            <span>Cliente retira o pedido no local</span>
                        </div>
                        <label class="config-switch">
                            <input type="checkbox" id="configServicoRetirada" ${ck(cfg.servicoRetirada)}>
                            <span class="slider"></span>
                        </label>
                    </div>
                </div>
                <div class="config-field full-width">
                    <div class="toggle-row">
                        <div class="toggle-left">
                            <strong>🛵 Delivery</strong>
                            <span>Entrega no endereço do cliente</span>
                        </div>
                        <label class="config-switch">
                            <input type="checkbox" id="configServicoDelivery" ${ck(cfg.servicoDelivery)}>
                            <span class="slider"></span>
                        </label>
                    </div>
                </div>
            </div>
        </div>
        ${abaActions('servicos')}
    ${panelClose()}

    <!-- ── ABA FUNCIONALIDADES ── -->
    ${panelOpen('funcionalidades')}
        <div class="config-section">
            <h3 class="config-title">⚙️ Funcionalidades do Cardápio</h3>
            <p style="font-size:.8rem;color:var(--text-muted);margin-bottom:18px;">Controle o que fica visível para os clientes. Desativado por padrão.</p>
            <div class="config-grid">
                <div class="config-field full-width">
                    <div class="toggle-row">
                        <div class="toggle-left">
                            <strong>🛒 Carrinho de Compras</strong>
                            <span>Clientes podem adicionar itens e fazer pedidos. Desativado por padrão.</span>
                        </div>
                        <label class="config-switch">
                            <input type="checkbox" id="configCarrinho" ${ck(cfg.carrinhoAtivo)}>
                            <span class="slider"></span>
                        </label>
                    </div>
                </div>
            </div>
        </div>
        ${abaActions('funcionalidades')}
    ${panelClose()}

    <!-- ── ABA PAGAMENTO ── -->
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

    <!-- ── ABA QR / LINKS ── -->
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

    // Live previews
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
            dominios:        getValOr('configDominios',       configuracoes.dominios)
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

    dc.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card"><div class="stat-icon blue"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg></div><div class="stat-info"><span class="stat-label">Total Produtos</span><span class="stat-value">${total}</span></div></div>
            <div class="stat-card"><div class="stat-icon green"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></div><div class="stat-info"><span class="stat-label">Ativos</span><span class="stat-value">${ativos}</span></div></div>
            <div class="stat-card"><div class="stat-icon gray"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg></div><div class="stat-info"><span class="stat-label">Inativos</span><span class="stat-value">${total-ativos}</span></div></div>
            <div class="stat-card"><div class="stat-icon orange"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div><div class="stat-info"><span class="stat-label">Total Pedidos</span><span class="stat-value">${totPed}</span></div></div>
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

// ─── PRODUTOS ─────────────────────────────────────────────────────────────────
function renderizarFiltrosCategorias() {
    const fc = document.getElementById('categoryFilters');
    if (!fc) return;
    fc.innerHTML = `<button class="category-filter-btn ${filtroCategoriaProduto==='all'?'active':''}" onclick="window.filtrarPorCategoria('all')">Todos (${produtos.length})</button>`
        + categorias.map(c=>{const n=produtos.filter(p=>p.categoria===c.nome).length; return `<button class="category-filter-btn ${filtroCategoriaProduto===c.nome?'active':''}" onclick="window.filtrarPorCategoria('${c.nome}')">${c.nome} (${n})</button>`;}).join('');
}
window.filtrarPorCategoria = cat => { filtroCategoriaProduto=cat; renderizarFiltrosCategorias(); renderizarProdutos(); };

async function carregarProdutos() {
    try {
        onSnapshot(collection(db,'produtos'), snap => {
            produtos = [];
            snap.forEach(d => produtos.push({id:d.id,...d.data()}));
            renderizarFiltrosCategorias(); renderizarProdutos(); atualizarDashboard();
        });
    } catch { showToast('Erro ao carregar produtos','error'); }
}

function renderizarProdutos() {
    if (!productsGrid) return;
    const lista = filtroCategoriaProduto==='all' ? produtos : produtos.filter(p=>p.categoria===filtroCategoriaProduto);
    if (!lista.length) { productsGrid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--text-muted);">Nenhum produto</div>'; return; }
    productsGrid.innerHTML = lista.map(p => {
        const ativo = p.ativo!==false;
        const qtdAd = p.adicionais?.length||0;
        const imgH  = p.imagem
            ? `<img src="${p.imagem}" alt="${p.nome}" class="product-image-admin" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"><div class="placeholder-image" style="display:none;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><span>Sem imagem</span></div>`
            : `<div class="placeholder-image"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><span>Sem imagem</span></div>`;
        return `
            <div class="product-card-admin ${!ativo?'product-inactive':''}">
                <button class="btn-visibility ${ativo?'active':''}" onclick="window.toggleVisibilidadeProduto('${p.id}',${ativo})" title="${ativo?'Ocultar':'Mostrar'}">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${ativo?'<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>':'<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'}</svg>
                </button>
                ${imgH}
                <div class="product-info-admin">
                    <h3 class="product-name-admin">${p.nome}</h3>
                    <p class="product-category-admin">${p.categoria||'Sem categoria'}</p>
                    ${qtdAd>0?`<p style="font-size:.73rem;color:var(--accent);font-weight:600;margin:4px 0 0;">🔧 ${qtdAd} adicional(is)</p>`:''}
                    <div class="product-price-admin">R$ ${fmt(p.preco)}</div>
                    <div class="product-actions">
                        <button class="btn-icon" onclick="window.editarProduto('${p.id}')">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            Editar
                        </button>
                        <button class="btn-icon danger" onclick="window.excluirProduto('${p.id}')">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            Excluir
                        </button>
                    </div>
                </div>
            </div>`;
    }).join('');
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

console.log('X-Food Admin v2 inicializado!');