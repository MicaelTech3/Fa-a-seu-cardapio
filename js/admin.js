// admin.js
// JavaScript para a página de administração

import { db, auth, storage } from './firebase-config.js';
import { 
    signInWithEmailAndPassword, 
    signOut,
    onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';
import { 
    collection, 
    getDocs, 
    addDoc, 
    doc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    query,
    where,
    orderBy,
    serverTimestamp,
    setDoc,
    getDoc
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import {
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js';

// Estado da aplicação
let produtos = [];
let categorias = [];
let pedidos = [];
let editandoProduto = null;
let editandoCategoria = null;
let filtroStatusPedido = 'all';
let filtroCategoriaProduto = 'all'; // NOVO: filtro de categoria na aba produtos
let categoriaExpandida = null;
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
const loginScreen = document.getElementById('loginScreen');
const adminDashboard = document.getElementById('adminDashboard');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const btnLogout = document.getElementById('btnLogout');
const loading = document.getElementById('loading');
const toast = document.getElementById('toast');

// Seções
const navItems = document.querySelectorAll('.nav-item');
const contentSections = document.querySelectorAll('.content-section');

// Produtos
const productsGrid = document.getElementById('productsGrid');
const btnAddProduct = document.getElementById('btnAddProduct');
const productModal = document.getElementById('productModal');
const productForm = document.getElementById('productForm');
const closeProductModal = document.getElementById('closeProductModal');
const cancelProductModal = document.getElementById('cancelProductModal');
const modalTitle = document.getElementById('modalTitle');
const productImageInput = document.getElementById('productImage');
const imagePreview = document.getElementById('imagePreview');

// Categorias
const categoriesList = document.getElementById('categoriesList');
const btnAddCategory = document.getElementById('btnAddCategory');
const categoryModal = document.getElementById('categoryModal');
const categoryForm = document.getElementById('categoryForm');
const closeCategoryModal = document.getElementById('closeCategoryModal');
const cancelCategoryModal = document.getElementById('cancelCategoryModal');

// Pedidos
const ordersList = document.getElementById('ordersList');
const filterButtons = document.querySelectorAll('.filter-btn');

// Inicializar
window.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    // Verificar autenticação
    onAuthStateChanged(auth, (user) => {
        if (user) {
            mostrarDashboard();
            carregarDados();
        } else {
            mostrarLogin();
        }
    });
    
    setupEventListeners();
}

// Mostrar/ocultar telas
function mostrarLogin() {
    loginScreen.style.display = 'flex';
    adminDashboard.style.display = 'none';
}

function mostrarDashboard() {
    loginScreen.style.display = 'none';
    adminDashboard.style.display = 'flex';
}

// Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    try {
        showLoading();
        await signInWithEmailAndPassword(auth, email, password);
        loginError.classList.remove('active');
        hideLoading();
    } catch (error) {
        console.error('Erro no login:', error);
        loginError.textContent = 'E-mail ou senha incorretos';
        loginError.classList.add('active');
        hideLoading();
    }
});

// Logout
btnLogout.addEventListener('click', async () => {
    try {
        await signOut(auth);
        mostrarLogin();
        showToast('Logout realizado com sucesso', 'success');
    } catch (error) {
        console.error('Erro no logout:', error);
        showToast('Erro ao fazer logout', 'error');
    }
});

// Navegação entre seções
function setupEventListeners() {
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const section = item.dataset.section;
            
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            contentSections.forEach(sec => sec.classList.remove('active'));
            document.getElementById(`section${capitalize(section)}`).classList.add('active');
            
            // Atualizar seção específica
            if (section === 'dashboard') {
                atualizarDashboard();
            } else if (section === 'configuracoes') {
                renderizarConfiguracoes();
            } else if (section === 'pages') {
                renderizarPages();
            } else if (section === 'produtos') {
                renderizarFiltrosCategorias();
            }
        });
    });
    
    // Produtos
    btnAddProduct.addEventListener('click', () => abrirModalProduto());
    if (closeProductModal) closeProductModal.addEventListener('click', fecharModalProduto);
    cancelProductModal.addEventListener('click', fecharModalProduto);
    productForm.addEventListener('submit', salvarProduto);
    productImageInput.addEventListener('change', previewImagem);
    
    // Categorias
    btnAddCategory.addEventListener('click', () => abrirModalCategoria());
    if (closeCategoryModal) closeCategoryModal.addEventListener('click', fecharModalCategoria);
    cancelCategoryModal.addEventListener('click', fecharModalCategoria);
    categoryForm.addEventListener('submit', salvarCategoria);
    
    // Pedidos - filtros
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filtroStatusPedido = btn.dataset.status;
            filtrarPedidos();
        });
    });
    
    // Fechar modais ao clicar fora
    productModal.addEventListener('click', (e) => {
        if (e.target === productModal) fecharModalProduto();
    });
    
    categoryModal.addEventListener('click', (e) => {
        if (e.target === categoryModal) fecharModalCategoria();
    });
}

// Carregar todos os dados
async function carregarDados() {
    await carregarConfiguracoes();
    await carregarCategorias();
    await carregarProdutos();
    await carregarPedidos();
    atualizarDashboard();
}

// ===== CONFIGURAÇÕES =====

async function carregarConfiguracoes() {
    try {
        const configDoc = await getDoc(doc(db, 'configuracoes', 'geral'));
        if (configDoc.exists()) {
            configuracoes = { ...configuracoes, ...configDoc.data() };
        }
    } catch (error) {
        console.error('Erro ao carregar configurações:', error);
    }
}

function renderizarConfiguracoes() {
    const configContainer = document.getElementById('configContainer');
    if (!configContainer) return;
    
    configContainer.innerHTML = `
        <div class="config-section">
            <h3 class="config-title">🎨 Aparência do Cardápio</h3>
            <div class="config-grid">
                <div class="config-field">
                    <label>Nome do Cardápio</label>
                    <input type="text" id="configNome" value="${configuracoes.nomeCardapio || 'Xfood'}" class="config-input">
                </div>
                
                <div class="config-field">
                    <label>URL da Logo</label>
                    <input type="text" id="configLogo" value="${configuracoes.logoUrl || 'img/logo.jpg'}" class="config-input">
                    <small>Cole a URL da imagem da logo</small>
                </div>
                
                <div class="config-field">
                    <label>Cor Primária</label>
                    <input type="color" id="configCorPrimaria" value="${configuracoes.corPrimaria || '#3b82f6'}" class="config-input">
                </div>
                
                <div class="config-field">
                    <label>Cor Secundária</label>
                    <input type="color" id="configCorSecundaria" value="${configuracoes.corSecundaria || '#64748b'}" class="config-input">
                </div>
                
                <div class="config-field full-width">
                    <label>Fonte do Cardápio</label>
                    <select id="configFonte" class="config-input">
                        <option value="DM Sans" ${configuracoes.fonte === 'DM Sans' ? 'selected' : ''}>DM Sans</option>
                        <option value="Roboto" ${configuracoes.fonte === 'Roboto' ? 'selected' : ''}>Roboto</option>
                        <option value="Open Sans" ${configuracoes.fonte === 'Open Sans' ? 'selected' : ''}>Open Sans</option>
                        <option value="Montserrat" ${configuracoes.fonte === 'Montserrat' ? 'selected' : ''}>Montserrat</option>
                        <option value="Poppins" ${configuracoes.fonte === 'Poppins' ? 'selected' : ''}>Poppins</option>
                    </select>
                </div>
            </div>
        </div>
        
        <div class="config-section">
            <h3 class="config-title">🏠 Informações do Estabelecimento</h3>
            <div class="config-grid">
                <div class="config-field full-width">
                    <label>Título de Boas-Vindas</label>
                    <input type="text" id="configTituloBemVindo" value="${configuracoes.tituloBemVindo || '😋 Bemvindos'}" class="config-input" placeholder="😋 Bemvindos">
                    <small>Título exibido no topo da página</small>
                </div>
                
                <div class="config-field full-width">
                    <label>Endereço Completo</label>
                    <input type="text" id="configEndereco" value="${configuracoes.endereco || 'Av. das Hortências, 4510 - Estrada Gramado, Gramado - RS, 95670-000, Brasil'}" class="config-input" placeholder="Rua, Número - Bairro, Cidade - Estado, CEP">
                    <small>Endereço exibido na seção principal</small>
                </div>
                
                <div class="config-field">
                    <label>Número WhatsApp</label>
                    <input type="text" id="configWhatsApp" value="${configuracoes.whatsApp || '5554999999999'}" class="config-input" placeholder="5554999999999">
                    <small>Formato: DDI + DDD + Número (sem espaços)</small>
                </div>
                
                <div class="config-field">
                    <label>Status do Estabelecimento</label>
                    <select id="configStatus" class="config-input">
                        <option value="aberto" ${(configuracoes.status || 'aberto') === 'aberto' ? 'selected' : ''}>🟢 Aberto</option>
                        <option value="fechado" ${configuracoes.status === 'fechado' ? 'selected' : ''}>🔴 Fechado</option>
                    </select>
                </div>
            </div>
        </div>
        
        <div class="config-section">
            <h3 class="config-title">🏷️ Serviços Disponíveis</h3>
            <div class="config-grid">
                <div class="config-field">
                    <label class="config-switch">
                        <input type="checkbox" id="configServicoLocal" ${configuracoes.servicoLocal !== false ? 'checked' : ''}>
                        <span class="slider"></span>
                        <span class="switch-label">🏠 No local</span>
                    </label>
                </div>
                
                <div class="config-field">
                    <label class="config-switch">
                        <input type="checkbox" id="configServicoRetirada" ${configuracoes.servicoRetirada !== false ? 'checked' : ''}>
                        <span class="slider"></span>
                        <span class="switch-label">🚗 Retirada</span>
                    </label>
                </div>
                
                <div class="config-field">
                    <label class="config-switch">
                        <input type="checkbox" id="configServicoDelivery" ${configuracoes.servicoDelivery !== false ? 'checked' : ''}>
                        <span class="slider"></span>
                        <span class="switch-label">🛵 Delivery</span>
                    </label>
                </div>
            </div>
        </div>
        
        <div class="config-section">
            <h3 class="config-title">🛒 Funcionalidades</h3>
            <div class="config-grid">
                <div class="config-field full-width">
                    <label class="config-switch">
                        <input type="checkbox" id="configCarrinho" ${configuracoes.carrinhoAtivo !== false ? 'checked' : ''}>
                        <span class="slider"></span>
                        <span class="switch-label">Ativar Carrinho de Compras</span>
                    </label>
                    <small>Se desativado, clientes não poderão fazer pedidos pelo site</small>
                </div>
            </div>
        </div>
        
        <div class="config-section">
            <h3 class="config-title">💳 Pagamento PIX</h3>
            <div class="config-grid">
                <div class="config-field">
                    <label>Chave PIX</label>
                    <input type="text" id="configChavePix" value="${configuracoes.chavePix || ''}" class="config-input" placeholder="exemplo@email.com">
                    <small>Email, CPF, CNPJ ou chave aleatória</small>
                </div>
                
                <div class="config-field">
                    <label>URL do QR Code PIX</label>
                    <input type="text" id="configQrCodePix" value="${configuracoes.qrCodePix || ''}" class="config-input" placeholder="https://...">
                    <small>Link da imagem do QR Code</small>
                </div>
            </div>
        </div>
        
        <div class="config-actions">
            <button class="btn-primary" onclick="salvarConfiguracoes()">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                    <polyline points="17 21 17 13 7 13 7 21"></polyline>
                    <polyline points="7 3 7 8 15 8"></polyline>
                </svg>
                Salvar Configurações
            </button>
            <button class="btn-secondary" onclick="resetarConfiguracoes()">
                Restaurar Padrões
            </button>
        </div>
    `;
}

window.salvarConfiguracoes = async function() {
    try {
        showLoading();
        
        const novasConfigs = {
            // Aparência
            nomeCardapio: document.getElementById('configNome').value,
            logoUrl: document.getElementById('configLogo').value,
            corPrimaria: document.getElementById('configCorPrimaria').value,
            corSecundaria: document.getElementById('configCorSecundaria').value,
            fonte: document.getElementById('configFonte').value,
            
            // Informações do estabelecimento
            tituloBemVindo: document.getElementById('configTituloBemVindo').value,
            endereco: document.getElementById('configEndereco').value,
            whatsApp: document.getElementById('configWhatsApp').value,
            status: document.getElementById('configStatus').value,
            
            // Serviços
            servicoLocal: document.getElementById('configServicoLocal').checked,
            servicoRetirada: document.getElementById('configServicoRetirada').checked,
            servicoDelivery: document.getElementById('configServicoDelivery').checked,
            
            // Funcionalidades
            carrinhoAtivo: document.getElementById('configCarrinho').checked,
            
            // PIX
            chavePix: document.getElementById('configChavePix').value,
            qrCodePix: document.getElementById('configQrCodePix').value
        };
        
        await setDoc(doc(db, 'configuracoes', 'geral'), novasConfigs);
        configuracoes = novasConfigs;
        
        showToast('Configurações salvas com sucesso!', 'success');
        hideLoading();
    } catch (error) {
        console.error('Erro ao salvar configurações:', error);
        showToast('Erro ao salvar configurações', 'error');
        hideLoading();
    }
};

window.resetarConfiguracoes = function() {
    if (!confirm('Tem certeza que deseja restaurar as configurações padrão?')) return;
    
    configuracoes = {
        // Aparência
        nomeCardapio: 'Xfood',
        logoUrl: 'img/logo.jpg',
        corPrimaria: '#3b82f6',
        corSecundaria: '#64748b',
        fonte: 'DM Sans',
        
        // Informações
        tituloBemVindo: '😋 Bemvindos',
        endereco: 'Av. das Hortências, 4510 - Estrada Gramado, Gramado - RS, 95670-000, Brasil',
        whatsApp: '5554999999999',
        status: 'aberto',
        
        // Serviços
        servicoLocal: true,
        servicoRetirada: true,
        servicoDelivery: true,
        
        // Funcionalidades
        carrinhoAtivo: true,
        
        // PIX
        chavePix: '',
        qrCodePix: ''
    };
    
    renderizarConfiguracoes();
    showToast('Configurações restauradas! Clique em Salvar para aplicar.', 'info');
};

// ===== PAGES =====

function renderizarPages() {
    const pagesContainer = document.getElementById('pagesContainer');
    if (!pagesContainer) return;
    
    const baseUrl = window.location.origin + window.location.pathname.replace('admin.html', '');
    
    pagesContainer.innerHTML = `
        <div class="pages-intro">
            <h3>📄 Links das Páginas</h3>
            <p>Compartilhe estes links com seus clientes ou exiba em telões</p>
        </div>
        
        <div class="pages-grid">
            <div class="page-card">
                <div class="page-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="9" y1="3" x2="9" y2="21"></line>
                    </svg>
                </div>
                <h4>Cardápio Digital</h4>
                <p>Página principal onde clientes visualizam produtos e fazem pedidos</p>
                <div class="page-url">
                    <input type="text" value="${baseUrl}index.html" readonly class="url-input" id="urlCardapio">
                    <button class="btn-copy" onclick="copiarUrl('urlCardapio')">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        Copiar
                    </button>
                </div>
                <div class="page-actions">
                    <a href="${baseUrl}index.html" target="_blank" class="btn-page">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                            <polyline points="15 3 21 3 21 9"></polyline>
                            <line x1="10" y1="14" x2="21" y2="3"></line>
                        </svg>
                        Abrir Cardápio
                    </a>
                    <button class="btn-page secondary" onclick="gerarQRCode('${baseUrl}index.html')">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="3" width="7" height="7"></rect>
                            <rect x="14" y="3" width="7" height="7"></rect>
                            <rect x="14" y="14" width="7" height="7"></rect>
                            <rect x="3" y="14" width="7" height="7"></rect>
                        </svg>
                        Gerar QR Code
                    </button>
                </div>
            </div>
            
            <div class="page-card">
                <div class="page-icon orange">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                </div>
                <h4>Acompanhamento de Pedidos</h4>
                <p>Telão público mostrando todos os pedidos em tempo real</p>
                <div class="page-url">
                    <input type="text" value="${baseUrl}Pedidos.html" readonly class="url-input" id="urlPedidos">
                    <button class="btn-copy" onclick="copiarUrl('urlPedidos')">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        Copiar
                    </button>
                </div>
                <div class="page-actions">
                    <a href="${baseUrl}Pedidos.html" target="_blank" class="btn-page">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                            <polyline points="15 3 21 3 21 9"></polyline>
                            <line x1="10" y1="14" x2="21" y2="3"></line>
                        </svg>
                        Abrir Acompanhamento
                    </a>
                    <button class="btn-page secondary" onclick="gerarQRCode('${baseUrl}Pedidos.html')">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="3" width="7" height="7"></rect>
                            <rect x="14" y="3" width="7" height="7"></rect>
                            <rect x="14" y="14" width="7" height="7"></rect>
                            <rect x="3" y="14" width="7" height="7"></rect>
                        </svg>
                        Gerar QR Code
                    </button>
                </div>
            </div>
        </div>
        
        <div class="pages-tips">
            <h4>💡 Dicas de Uso</h4>
            <ul>
                <li><strong>Cardápio Digital:</strong> Compartilhe por WhatsApp, redes sociais ou imprima QR Code nas mesas</li>
                <li><strong>Acompanhamento:</strong> Exiba em TV/monitor para clientes acompanharem seus pedidos</li>
                <li><strong>QR Codes:</strong> Gere e imprima para facilitar o acesso dos clientes</li>
            </ul>
        </div>
        
        <!-- Modal QR Code -->
        <div class="modal" id="qrModal" style="display: none;">
            <div class="modal-overlay" onclick="fecharQRModal()"></div>
            <div class="modal-content qr-modal-content">
                <button class="modal-close" onclick="fecharQRModal()">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
                <h3>QR Code Gerado</h3>
                <div id="qrCodeContainer"></div>
                <p class="qr-instructions">Escaneie ou clique com botão direito para salvar</p>
            </div>
        </div>
    `;
}

window.copiarUrl = function(inputId) {
    const input = document.getElementById(inputId);
    input.select();
    document.execCommand('copy');
    showToast('Link copiado para a área de transferência!', 'success');
};

window.gerarQRCode = function(url) {
    const modal = document.getElementById('qrModal');
    const container = document.getElementById('qrCodeContainer');
    
    // Usar API do Google Charts para gerar QR Code
    const qrUrl = `https://chart.googleapis.com/chart?cht=qr&chs=300x300&chl=${encodeURIComponent(url)}`;
    
    container.innerHTML = `<img src="${qrUrl}" alt="QR Code" style="max-width: 100%; border-radius: 8px;">`;
    modal.style.display = 'flex';
};

window.fecharQRModal = function() {
    const modal = document.getElementById('qrModal');
    modal.style.display = 'none';
};

// ===== DASHBOARD =====

function calcularRankingProdutos() {
    // Contar quantas vezes cada produto foi pedido
    const contagemProdutos = {};
    
    pedidos.forEach(pedido => {
        pedido.itens.forEach(item => {
            if (!contagemProdutos[item.nome]) {
                // Buscar o produto original para pegar a categoria
                const produtoOriginal = produtos.find(p => p.nome === item.nome);
                contagemProdutos[item.nome] = {
                    nome: item.nome,
                    quantidade: 0,
                    categoria: produtoOriginal?.categoria || 'Sem categoria'
                };
            }
            contagemProdutos[item.nome].quantidade += item.quantidade;
        });
    });
    
    // Converter para array e ordenar
    return Object.values(contagemProdutos)
        .sort((a, b) => b.quantidade - a.quantidade)
        .slice(0, 10); // Top 10
}

function atualizarDashboard() {
    const dashboardContainer = document.getElementById('dashboardContainer');
    if (!dashboardContainer) return;
    
    // Calcular estatísticas
    const totalProdutos = produtos.length;
    const produtosAtivos = produtos.filter(p => p.ativo !== false).length;
    const produtosInativos = totalProdutos - produtosAtivos;
    
    const totalPedidos = pedidos.length;
    const pedidosNovos = pedidos.filter(p => p.status === 'novo').length;
    const pedidosPreparando = pedidos.filter(p => p.status === 'preparando').length;
    const pedidosProntos = pedidos.filter(p => p.status === 'pronto').length;
    
    // Produtos por categoria
    const produtosPorCategoria = {};
    produtos.forEach(p => {
        const cat = p.categoria || 'Sem categoria';
        produtosPorCategoria[cat] = (produtosPorCategoria[cat] || 0) + 1;
    });
    
    // Calcular ranking de produtos
    const rankingProdutos = calcularRankingProdutos();
    const carrinhoAtivo = configuracoes.carrinhoAtivo !== false;
    
    // Renderizar dashboard
    dashboardContainer.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon blue">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="9" y1="3" x2="9" y2="21"></line>
                    </svg>
                </div>
                <div class="stat-info">
                    <span class="stat-label">Total de Produtos</span>
                    <span class="stat-value">${totalProdutos}</span>
                </div>
            </div>
            
            <div class="stat-card">
                <div class="stat-icon green">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                </div>
                <div class="stat-info">
                    <span class="stat-label">Produtos Ativos</span>
                    <span class="stat-value">${produtosAtivos}</span>
                </div>
            </div>
            
            <div class="stat-card">
                <div class="stat-icon gray">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                </div>
                <div class="stat-info">
                    <span class="stat-label">Produtos Inativos</span>
                    <span class="stat-value">${produtosInativos}</span>
                </div>
            </div>
            
            <div class="stat-card">
                <div class="stat-icon orange">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                </div>
                <div class="stat-info">
                    <span class="stat-label">Total de Pedidos</span>
                    <span class="stat-value">${totalPedidos}</span>
                </div>
            </div>
        </div>
        
        <div class="charts-grid">
            <div class="chart-card">
                <h3 class="chart-title">Produtos por Categoria</h3>
                <div class="chart-bars">
                    ${Object.entries(produtosPorCategoria).map(([cat, count]) => {
                        const percentage = (count / totalProdutos) * 100;
                        return `
                            <div class="chart-bar-item">
                                <div class="chart-bar-label">
                                    <span>${cat}</span>
                                    <span>${count}</span>
                                </div>
                                <div class="chart-bar-track">
                                    <div class="chart-bar-fill" style="width: ${percentage}%"></div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
            
            <div class="chart-card">
                <h3 class="chart-title">Status dos Pedidos</h3>
                <div class="chart-bars">
                    <div class="chart-bar-item">
                        <div class="chart-bar-label">
                            <span>Novos</span>
                            <span>${pedidosNovos}</span>
                        </div>
                        <div class="chart-bar-track">
                            <div class="chart-bar-fill blue" style="width: ${totalPedidos > 0 ? (pedidosNovos / totalPedidos) * 100 : 0}%"></div>
                        </div>
                    </div>
                    <div class="chart-bar-item">
                        <div class="chart-bar-label">
                            <span>Preparando</span>
                            <span>${pedidosPreparando}</span>
                        </div>
                        <div class="chart-bar-track">
                            <div class="chart-bar-fill orange" style="width: ${totalPedidos > 0 ? (pedidosPreparando / totalPedidos) * 100 : 0}%"></div>
                        </div>
                    </div>
                    <div class="chart-bar-item">
                        <div class="chart-bar-label">
                            <span>Prontos</span>
                            <span>${pedidosProntos}</span>
                        </div>
                        <div class="chart-bar-track">
                            <div class="chart-bar-fill green" style="width: ${totalPedidos > 0 ? (pedidosProntos / totalPedidos) * 100 : 0}%"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- NOVO: Ranking de Produtos Mais Pedidos -->
        <div class="ranking-section">
            <h3 class="chart-title">
                🏆 Ranking de Produtos Mais Pedidos
                ${!carrinhoAtivo ? 
                    '<span class="ranking-status disabled">Ranking Indisponível</span>' : 
                    '<span class="ranking-status enabled">Ranking Ativado</span>'
                }
            </h3>
            
            ${!carrinhoAtivo ? `
                <div class="ranking-disabled-message">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <p>O carrinho de compras está desativado.</p>
                    <p>Ative o carrinho nas <a href="#" onclick="navegarParaConfiguracoes()">Configurações</a> para habilitar o ranking de produtos.</p>
                </div>
            ` : rankingProdutos.length === 0 ? `
                <div class="ranking-disabled-message">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                    <p>Nenhum pedido registrado ainda.</p>
                    <p>Os produtos mais pedidos aparecerão aqui assim que houver pedidos.</p>
                </div>
            ` : `
                <div class="ranking-list">
                    ${rankingProdutos.map((produto, index) => {
                        const maxQuantidade = rankingProdutos[0].quantidade;
                        const percentage = (produto.quantidade / maxQuantidade) * 100;
                        
                        // Definir cores dos medals
                        let medalColor = '#64748b';
                        if (index === 0) medalColor = '#fbbf24'; // Ouro
                        else if (index === 1) medalColor = '#9ca3af'; // Prata
                        else if (index === 2) medalColor = '#cd7f32'; // Bronze
                        
                        return `
                            <div class="ranking-item">
                                <div class="ranking-position" style="background-color: ${medalColor}">
                                    ${index + 1}
                                </div>
                                <div class="ranking-info">
                                    <div class="ranking-product-name">${produto.nome}</div>
                                    <div class="ranking-product-category">${produto.categoria}</div>
                                </div>
                                <div class="ranking-bar">
                                    <div class="ranking-bar-fill" style="width: ${percentage}%"></div>
                                </div>
                                <div class="ranking-quantity">
                                    ${produto.quantidade} ${produto.quantidade === 1 ? 'pedido' : 'pedidos'}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `}
        </div>
    `;
}

// Função para navegar até configurações
window.navegarParaConfiguracoes = function() {
    const configNav = document.querySelector('[data-section="configuracoes"]');
    if (configNav) {
        configNav.click();
    }
    return false;
};

// ===== CATEGORIAS =====

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
            atualizarSelectCategorias();
            renderizarFiltrosCategorias(); // Atualizar filtros quando categorias mudarem
        });
    } catch (error) {
        console.error('Erro ao carregar categorias:', error);
        showToast('Erro ao carregar categorias', 'error');
    }
}

function renderizarCategorias() {
    if (!categoriesList) return;
    
    if (categorias.length === 0) {
        categoriesList.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #666;">
                <p>Nenhuma categoria cadastrada</p>
            </div>
        `;
        return;
    }
    
    categoriesList.innerHTML = categorias.map(cat => {
        const produtosDaCategoria = produtos.filter(p => p.categoria === cat.nome);
        const isExpandida = categoriaExpandida === cat.id;
        
        return `
            <div class="category-item-wrapper">
                <div class="category-item" onclick="window.toggleCategoria('${cat.id}')">
                    <div class="category-info">
                        <span class="category-name">${cat.nome}</span>
                        <span class="category-count">${produtosDaCategoria.length} produto(s)</span>
                    </div>
                    <div class="category-actions" onclick="event.stopPropagation()">
                        <button class="btn-icon-sm" onclick="window.editarCategoria('${cat.id}')" title="Editar">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button class="btn-icon-sm danger" onclick="window.excluirCategoria('${cat.id}')" title="Excluir">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                        <button class="btn-icon-sm" title="${isExpandida ? 'Recolher' : 'Expandir'}">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="transform: ${isExpandida ? 'rotate(180deg)' : 'rotate(0)'}; transition: transform 0.3s;">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </button>
                    </div>
                </div>
                ${isExpandida ? `
                    <div class="category-products">
                        ${produtosDaCategoria.length > 0 ? 
                            produtosDaCategoria.map(p => `
                                <div class="category-product-item">
                                    <span>${p.nome}</span>
                                    <span class="category-product-price">R$ ${formatarPreco(p.preco)}</span>
                                    <span class="category-product-status ${p.ativo !== false ? 'active' : 'inactive'}">
                                        ${p.ativo !== false ? 'Ativo' : 'Inativo'}
                                    </span>
                                </div>
                            `).join('') :
                            '<p style="color: #666; padding: 16px; text-align: center;">Nenhum produto nesta categoria</p>'
                        }
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

window.toggleCategoria = function(categoriaId) {
    categoriaExpandida = categoriaExpandida === categoriaId ? null : categoriaId;
    renderizarCategorias();
};

function atualizarSelectCategorias() {
    const select = document.getElementById('productCategory');
    if (!select) return;
    
    select.innerHTML = `
        <option value="">Selecione uma categoria</option>
        ${categorias.map(cat => `
            <option value="${cat.nome}">${cat.nome}</option>
        `).join('')}
    `;
}

function abrirModalCategoria(categoriaId = null) {
    editandoCategoria = categoriaId;
    
    if (categoriaId) {
        const categoria = categorias.find(c => c.id === categoriaId);
        document.getElementById('categoryModalTitle').textContent = 'Editar Categoria';
        document.getElementById('categoryName').value = categoria.nome;
    } else {
        document.getElementById('categoryModalTitle').textContent = 'Nova Categoria';
        categoryForm.reset();
    }
    
    categoryModal.classList.add('active');
}

function fecharModalCategoria() {
    categoryModal.classList.remove('active');
    categoryForm.reset();
    editandoCategoria = null;
}

async function salvarCategoria(e) {
    e.preventDefault();
    
    const nome = document.getElementById('categoryName').value.trim();
    
    try {
        showLoading();
        
        if (editandoCategoria) {
            // Editar categoria existente
            await updateDoc(doc(db, 'categorias', editandoCategoria), { nome });
            showToast('Categoria atualizada com sucesso!', 'success');
        } else {
            // Criar nova categoria
            await addDoc(collection(db, 'categorias'), { nome });
            showToast('Categoria criada com sucesso!', 'success');
        }
        
        fecharModalCategoria();
        hideLoading();
    } catch (error) {
        console.error('Erro ao salvar categoria:', error);
        showToast('Erro ao salvar categoria', 'error');
        hideLoading();
    }
}

window.editarCategoria = function(categoriaId) {
    abrirModalCategoria(categoriaId);
};

window.excluirCategoria = async function(categoriaId) {
    if (!confirm('Tem certeza que deseja excluir esta categoria?')) return;
    
    try {
        showLoading();
        await deleteDoc(doc(db, 'categorias', categoriaId));
        showToast('Categoria excluída com sucesso!', 'success');
        hideLoading();
    } catch (error) {
        console.error('Erro ao excluir categoria:', error);
        showToast('Erro ao excluir categoria', 'error');
        hideLoading();
    }
};

// ===== PRODUTOS =====

// NOVO: Renderizar filtros de categorias na aba produtos
function renderizarFiltrosCategorias() {
    const filtrosContainer = document.getElementById('categoryFilters');
    if (!filtrosContainer) return;
    
    filtrosContainer.innerHTML = `
        <button class="category-filter-btn ${filtroCategoriaProduto === 'all' ? 'active' : ''}" onclick="window.filtrarPorCategoria('all')">
            Todos (${produtos.length})
        </button>
        ${categorias.map(cat => {
            const count = produtos.filter(p => p.categoria === cat.nome).length;
            return `
                <button class="category-filter-btn ${filtroCategoriaProduto === cat.nome ? 'active' : ''}" onclick="window.filtrarPorCategoria('${cat.nome}')">
                    ${cat.nome} (${count})
                </button>
            `;
        }).join('')}
    `;
}

// NOVO: Filtrar produtos por categoria
window.filtrarPorCategoria = function(categoria) {
    filtroCategoriaProduto = categoria;
    renderizarFiltrosCategorias();
    renderizarProdutos();
};

async function carregarProdutos() {
    try {
        const produtosRef = collection(db, 'produtos');
        
        onSnapshot(produtosRef, (snapshot) => {
            produtos = [];
            snapshot.forEach((doc) => {
                produtos.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            renderizarFiltrosCategorias();
            renderizarProdutos();
            atualizarDashboard();
        });
    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
        showToast('Erro ao carregar produtos', 'error');
    }
}

function renderizarProdutos() {
    if (!productsGrid) return;
    
    // Filtrar produtos pela categoria selecionada
    let produtosFiltrados = produtos;
    if (filtroCategoriaProduto !== 'all') {
        produtosFiltrados = produtos.filter(p => p.categoria === filtroCategoriaProduto);
    }
    
    if (produtosFiltrados.length === 0) {
        productsGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px; color: #666;">
                <p style="font-size: 1.1rem;">Nenhum produto encontrado${filtroCategoriaProduto !== 'all' ? ' nesta categoria' : ''}</p>
            </div>
        `;
        return;
    }
    
    productsGrid.innerHTML = produtosFiltrados.map(produto => {
        const isAtivo = produto.ativo !== false;
        
        // Criar HTML da imagem ou placeholder
        const imagemHTML = produto.imagem ? 
            `<img 
                src="${produto.imagem}" 
                alt="${produto.nome}"
                class="product-image-admin"
                onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
            >
            <div class="placeholder-image" style="display: none;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
                <span>Sem imagem</span>
            </div>` : 
            `<div class="placeholder-image">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
                <span>Sem imagem</span>
            </div>`;
        
        return `
            <div class="product-card-admin ${!isAtivo ? 'product-inactive' : ''}">
                <button 
                    class="btn-visibility ${isAtivo ? 'active' : ''}" 
                    onclick="window.toggleVisibilidadeProduto('${produto.id}', ${isAtivo})"
                    title="${isAtivo ? 'Ocultar do cardápio' : 'Mostrar no cardápio'}"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        ${isAtivo ? 
                            '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>' :
                            '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>'
                        }
                    </svg>
                </button>
                ${imagemHTML}
                <div class="product-info-admin">
                    <h3 class="product-name-admin">${produto.nome}</h3>
                    <p class="product-category-admin">${produto.categoria || 'Sem categoria'}</p>
                    <div class="product-price-admin">R$ ${formatarPreco(produto.preco)}</div>
                    <div class="product-actions">
                        <button class="btn-icon" onclick="window.editarProduto('${produto.id}')">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                            Editar
                        </button>
                        <button class="btn-icon danger" onclick="window.excluirProduto('${produto.id}')">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                            Excluir
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Toggle visibilidade do produto
window.toggleVisibilidadeProduto = async function(produtoId, ativoAtual) {
    try {
        await updateDoc(doc(db, 'produtos', produtoId), { ativo: !ativoAtual });
        showToast(`Produto ${!ativoAtual ? 'ativado' : 'desativado'} com sucesso!`, 'success');
    } catch (error) {
        console.error('Erro ao alterar visibilidade:', error);
        showToast('Erro ao alterar visibilidade do produto', 'error');
    }
};

function abrirModalProduto(produtoId = null) {
    editandoProduto = produtoId;

    // Novo produto
    if (!produtoId) {
        if (modalTitle) modalTitle.textContent = 'Novo Produto';
        productForm.reset();
        if (imagePreview) {
            imagePreview.innerHTML = '';
            imagePreview.classList.remove('active');
        }
        productModal.classList.add('active');
        return;
    }

    // Editar produto existente
    const produto = produtos.find(p => p.id === produtoId);

    if (!produto) {
        console.error('Produto não encontrado:', produtoId);
        showToast('Erro: produto não encontrado', 'error');
        return;
    }

    if (modalTitle) modalTitle.textContent = 'Editar Produto';
    document.getElementById('productName').value = produto.nome ?? '';
    document.getElementById('productPrice').value = produto.preco ?? '';
    document.getElementById('productCategory').value = produto.categoria ?? '';
    document.getElementById('productDescription').value = produto.descricao ?? '';
    document.getElementById('productActive').checked = produto.ativo !== false;

    if (imagePreview) {
        if (produto.imagem) {
            imagePreview.innerHTML = `<img src="${produto.imagem}" alt="Preview">`;
            imagePreview.classList.add('active');
        } else {
            imagePreview.innerHTML = '';
            imagePreview.classList.remove('active');
        }
    }

    productModal.classList.add('active');
}

function fecharModalProduto() {
    productModal.classList.remove('active');
    productForm.reset();
    if (imagePreview) {
        imagePreview.innerHTML = '';
        imagePreview.classList.remove('active');
    }
    editandoProduto = null;
}

function previewImagem(e) {
    const file = e.target.files[0];
    if (file && imagePreview) {
        const reader = new FileReader();
        reader.onload = function(event) {
            imagePreview.innerHTML = `<img src="${event.target.result}" alt="Preview">`;
            imagePreview.classList.add('active');
        };
        reader.readAsDataURL(file);
    }
}

async function salvarProduto(e) {
    e.preventDefault();
    
    const nome = document.getElementById('productName').value.trim();
    const preco = parseFloat(document.getElementById('productPrice').value);
    const categoria = document.getElementById('productCategory').value;
    const descricao = document.getElementById('productDescription').value.trim();
    const ativo = document.getElementById('productActive').checked;
    const imagemFile = productImageInput.files[0];
    
    try {
        showLoading();
        
        let imagemURL = null;
        
        // Se tiver arquivo para upload, tenta fazer o upload
        if (imagemFile) {
            try {
                const storageRef = ref(storage, `produtos/${Date.now()}_${imagemFile.name}`);
                await uploadBytes(storageRef, imagemFile);
                imagemURL = await getDownloadURL(storageRef);
            } catch (storageError) {
                console.warn('Erro ao fazer upload da imagem (Storage não configurado):', storageError);
                // Se der erro no upload, apenas ignora e continua sem imagem
                imagemURL = null;
                showToast('Produto salvo sem imagem (Storage não configurado)', 'success');
            }
        } else if (editandoProduto) {
            // Manter imagem antiga se estiver editando
            const produtoAntigo = produtos.find(p => p.id === editandoProduto);
            imagemURL = produtoAntigo?.imagem || null;
        }
        
        const dadosProduto = {
            nome,
            preco,
            categoria,
            descricao,
            ativo,
            imagem: imagemURL
        };
        
        if (editandoProduto) {
            // Editar produto existente
            await updateDoc(doc(db, 'produtos', editandoProduto), dadosProduto);
            if (!imagemFile) {
                showToast('Produto atualizado com sucesso!', 'success');
            }
        } else {
            // Criar novo produto
            await addDoc(collection(db, 'produtos'), dadosProduto);
            if (!imagemFile) {
                showToast('Produto criado com sucesso!', 'success');
            }
        }
        
        fecharModalProduto();
        hideLoading();
    } catch (error) {
        console.error('Erro ao salvar produto:', error);
        showToast('Erro ao salvar produto', 'error');
        hideLoading();
    }
}

window.editarProduto = function(produtoId) {
    abrirModalProduto(produtoId);
};

window.excluirProduto = async function(produtoId) {
    if (!confirm('Tem certeza que deseja excluir este produto?')) return;
    
    try {
        showLoading();
        await deleteDoc(doc(db, 'produtos', produtoId));
        showToast('Produto excluído com sucesso!', 'success');
        hideLoading();
    } catch (error) {
        console.error('Erro ao excluir produto:', error);
        showToast('Erro ao excluir produto', 'error');
        hideLoading();
    }
};

// ===== PEDIDOS =====

async function carregarPedidos() {
    try {
        const pedidosRef = collection(db, 'pedidos');
        const q = query(pedidosRef, orderBy('data', 'desc'));
        
        onSnapshot(q, (snapshot) => {
            pedidos = [];
            snapshot.forEach((doc) => {
                pedidos.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            filtrarPedidos();
            atualizarDashboard();
        });
    } catch (error) {
        console.error('Erro ao carregar pedidos:', error);
        showToast('Erro ao carregar pedidos', 'error');
    }
}

function filtrarPedidos() {
    let pedidosFiltrados = pedidos;
    
    if (filtroStatusPedido !== 'all') {
        pedidosFiltrados = pedidos.filter(p => p.status === filtroStatusPedido);
    }
    
    renderizarPedidos(pedidosFiltrados);
}

function renderizarPedidos(pedidosParaExibir) {
    if (!ordersList) return;
    
    if (pedidosParaExibir.length === 0) {
        ordersList.innerHTML = `
            <div style="text-align: center; padding: 60px; color: #666;">
                <p style="font-size: 1.1rem;">Nenhum pedido encontrado</p>
            </div>
        `;
        return;
    }
    
    ordersList.innerHTML = pedidosParaExibir.map(pedido => {
        const dataFormatada = pedido.data ? 
            new Date(pedido.data.seconds * 1000).toLocaleString('pt-BR') : 
            'Data não disponível';
        
        // Log de processo
        const statusLog = [
            { status: 'novo', label: 'Novo', ativo: true },
            { status: 'preparando', label: 'Preparando', ativo: pedido.status === 'preparando' || pedido.status === 'pronto' },
            { status: 'pronto', label: 'Pronto', ativo: pedido.status === 'pronto' }
        ];
        
        return `
            <div class="order-card">
                <div class="order-header">
                    <div>
                        <div class="order-number">Pedido #${pedido.id.substring(0, 8).toUpperCase()}</div>
                        <div class="order-time">${dataFormatada}</div>
                    </div>
                    <span class="order-status ${pedido.status}">${pedido.status}</span>
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
                
                <div class="order-items">
                    ${pedido.itens.map(item => `
                        <div class="order-item">
                            <div>
                                <span class="order-item-name">${item.nome}</span>
                                <span class="order-item-qty">x${item.quantidade}</span>
                            </div>
                            <span class="order-item-price">R$ ${formatarPreco(item.preco * item.quantidade)}</span>
                        </div>
                    `).join('')}
                </div>
                
                <div class="order-footer">
                    <div class="order-total">
                        Total: <span>R$ ${formatarPreco(pedido.total)}</span>
                    </div>
                    <div class="order-actions">
                        ${pedido.status === 'novo' ? `
                            <button class="btn-status preparando" onclick="window.atualizarStatusPedido('${pedido.id}', 'preparando')">
                                Iniciar Preparo
                            </button>
                        ` : ''}
                        ${pedido.status === 'preparando' ? `
                            <button class="btn-status pronto" onclick="window.atualizarStatusPedido('${pedido.id}', 'pronto')">
                                Marcar como Pronto
                            </button>
                        ` : ''}
                        <button class="btn-status danger" onclick="window.excluirPedido('${pedido.id}')">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                            Excluir
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

window.atualizarStatusPedido = async function(pedidoId, novoStatus) {
    try {
        await updateDoc(doc(db, 'pedidos', pedidoId), { 
            status: novoStatus,
            dataAtualizacao: serverTimestamp()
        });
        showToast(`Pedido marcado como ${novoStatus}!`, 'success');
    } catch (error) {
        console.error('Erro ao atualizar status:', error);
        showToast('Erro ao atualizar status do pedido', 'error');
    }
};

window.excluirPedido = async function(pedidoId) {
    if (!confirm('Tem certeza que deseja excluir este pedido? Ele será removido permanentemente.')) return;
    
    try {
        showLoading();
        await deleteDoc(doc(db, 'pedidos', pedidoId));
        showToast('Pedido excluído com sucesso!', 'success');
        hideLoading();
    } catch (error) {
        console.error('Erro ao excluir pedido:', error);
        showToast('Erro ao excluir pedido', 'error');
        hideLoading();
    }
};

// Limpar todos os pedidos
window.limparTodosPedidos = async function() {
    if (!confirm('⚠️ ATENÇÃO! Isso irá excluir TODOS os pedidos permanentemente. Tem certeza?')) return;
    if (!confirm('Confirme novamente: Deseja realmente excluir TODOS os pedidos?')) return;
    
    try {
        showLoading();
        
        const pedidosRef = collection(db, 'pedidos');
        const snapshot = await getDocs(pedidosRef);
        
        const promises = [];
        snapshot.forEach((docSnap) => {
            promises.push(deleteDoc(doc(db, 'pedidos', docSnap.id)));
        });
        
        await Promise.all(promises);
        
        showToast(`${promises.length} pedidos excluídos com sucesso!`, 'success');
        hideLoading();
    } catch (error) {
        console.error('Erro ao limpar pedidos:', error);
        showToast('Erro ao limpar pedidos', 'error');
        hideLoading();
    }
};

// ===== UTILITÁRIOS =====

function formatarPreco(valor) {
    return parseFloat(valor).toFixed(2).replace('.', ',');
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function showLoading() {
    loading.classList.add('active');
}

function hideLoading() {
    loading.classList.remove('active');
}

function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.className = `toast ${type} active`;
    
    setTimeout(() => {
        toast.classList.remove('active');
    }, 3000);
}

console.log('Admin app inicializado!');