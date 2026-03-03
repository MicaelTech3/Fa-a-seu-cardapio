// home-config.js
import { db } from './firebase-config.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

const defaultConfig = {
    nomeCardapio: 'X-FOOD',
    logoUrl: 'img/logo.png',
    corPrimaria: '#3b82f6',
    corSecundaria: '#64748b',
    fonte: 'DM Sans',
    tituloBemVindo: '😋 Bem-vindos',
    endereco: 'Av. das Hortências, 4510 - Estrada Gramado, Gramado - RS, 95670-000, Brasil',
    whatsApp: '5554999999999',
    status: 'aberto',
    servicoLocal: true,
    servicoRetirada: true,
    servicoDelivery: true
};

async function carregarConfiguracoes() {
    try {
        const configDoc = await getDoc(doc(db, 'configuracoes', 'geral'));
        const config = configDoc.exists() ? { ...defaultConfig, ...configDoc.data() } : defaultConfig;
        aplicarConfiguracoes(config);
        return config;
    } catch (error) {
        console.error('Erro ao carregar configurações:', error);
        aplicarConfiguracoes(defaultConfig);
        return defaultConfig;
    }
}

function aplicarConfiguracoes(config) {
    document.title = `${config.nomeCardapio} - Bem-vindo`;

    const logo = document.querySelector('.logo');
    if (logo && config.logoUrl) {
        logo.src = config.logoUrl;
        logo.alt = `${config.nomeCardapio} Logo`;
    }

    const title = document.querySelector('.title');
    if (title) { title.innerHTML = config.tituloBemVindo; }

    const addressText = document.querySelector('.address p');
    if (addressText) { addressText.textContent = config.endereco; }

    const statusBadge = document.querySelector('.status-badge');
    if (statusBadge) {
        const isAberto = config.status === 'aberto';
        statusBadge.innerHTML = `
            <span class="status-dot" style="background: ${isAberto ? '#22c55e' : '#ef4444'}"></span>
            ${isAberto ? 'Aberto' : 'Fechado'}
        `;
        statusBadge.style.background = isAberto ? '#f0fdf4' : '#fef2f2';
        statusBadge.style.color = isAberto ? '#166534' : '#991b1b';
    }

    const servicesContainer = document.querySelector('.services');
    if (servicesContainer) {
        const servicos = [];
        if (config.servicoLocal) {
            servicos.push({ icon: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>', label: 'No local' });
        }
        if (config.servicoRetirada) {
            servicos.push({ icon: '<rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle>', label: 'Retirada' });
        }
        if (config.servicoDelivery) {
            servicos.push({ icon: '<rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle>', label: 'Delivery' });
        }
        servicesContainer.innerHTML = servicos.map(s => `
            <div class="service-badge">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${s.icon}</svg>
                <span>${s.label}</span>
            </div>
        `).join('');
    }

    const footerLink = document.querySelector('.footer-link span');
    if (footerLink) { footerLink.textContent = `Cardápio Digital de ${config.nomeCardapio}`; }

    const whatsappLinks = document.querySelectorAll('[href*="wa.me"]');
    whatsappLinks.forEach(link => { link.href = `https://wa.me/${config.whatsApp}`; });

    aplicarCoresPersonalizadas(config);
    aplicarFontePersonalizada(config.fonte);
    sessionStorage.setItem('xfoodConfig', JSON.stringify(config));
}

function aplicarCoresPersonalizadas(config) {
    const root = document.documentElement;
    if (config.corPrimaria) root.style.setProperty('--color-primary', config.corPrimaria);
    if (config.corSecundaria) root.style.setProperty('--color-secondary', config.corSecundaria);
}

function aplicarFontePersonalizada(fonte) {
    if (!fonte || fonte === 'DM Sans') return;
    const fonteFormatada = fonte.replace(/ /g, '+');
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${fonteFormatada}:wght@400;500;600;700;900&display=swap`;
    document.head.appendChild(link);
    document.body.style.fontFamily = `"${fonte}", -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
}

export { carregarConfiguracoes };