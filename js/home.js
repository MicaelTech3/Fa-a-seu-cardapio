// ================================================
// X-FOOD - PAGINA INICIAL
// JavaScript para navegacao e interacoes
// ================================================

import { carregarConfiguracoes } from './home-config.js';

document.addEventListener('DOMContentLoaded', async function() {

    const firebaseConfig = await carregarConfiguracoes();

    const CONFIG = {
        menuURL:       'menu.html',
        whatsappNumber: firebaseConfig.whatsApp      || '5554999999999',
        whatsAppAtivo:  firebaseConfig.whatsAppAtivo !== false,
        logoUrl:        firebaseConfig.logoUrl        || 'img/logo.jpg',
        logoLink:       firebaseConfig.logoLink       || '',
        loadingDelay:   1800
    };

    const nomeCardapio = firebaseConfig.nomeCardapio || 'X-Food';
    document.title = nomeCardapio;

    // ── LOGO: imagem + clicavel se logoLink configurado ──────────────────────
    const logoImg = document.querySelector('.logo');
    if (logoImg) {
        logoImg.src = CONFIG.logoUrl;
        logoImg.alt = nomeCardapio;
        logoImg.onerror = function() { this.src = 'img/logo.jpg'; };

        if (CONFIG.logoLink) {
            const logoContainer = logoImg.parentElement;
            if (logoContainer && !logoContainer.classList.contains('logo-link-wrapper')) {
                const link = document.createElement('a');
                link.href      = CONFIG.logoLink;
                link.target    = '_blank';
                link.rel       = 'noopener noreferrer';
                link.className = 'logo-link-wrapper';
                link.style.cssText = 'display:inline-block;cursor:pointer;';
                logoContainer.insertBefore(link, logoImg);
                link.appendChild(logoImg);
            }
        }
    }

    // ── WHATSAPP: ocultar tudo se desativado no admin ─────────────────────────
    const btnWhatsapp   = document.getElementById('btnWhatsapp');
    const whatsappFloat = document.querySelector('.whatsapp-float');
    const reportBtn     = document.querySelector('.report-btn');

    if (!CONFIG.whatsAppAtivo) {
        if (btnWhatsapp)   btnWhatsapp.style.display   = 'none';
        if (whatsappFloat) whatsappFloat.style.display = 'none';
        if (reportBtn)     reportBtn.style.display     = 'none';
    }

    // ── ELEMENTOS ─────────────────────────────────────────────────────────────
    const btnMenu  = document.getElementById('btnMenu');
    const btnPedir = document.querySelector('.btn-pedir');

    // ── LOADING ───────────────────────────────────────────────────────────────
    function createLoading(type) {
        const html = `
            <div id="loading-overlay" style="
                position:fixed;top:0;left:0;width:100%;height:100%;
                background:linear-gradient(135deg,#1e3a8a 0%,#3b82f6 50%,#60a5fa 100%);
                z-index:9999;display:flex;align-items:center;justify-content:center;
                animation:fadeIn .3s ease;">
              <div style="text-align:center;padding:40px;">
                <div style="width:120px;height:120px;background:white;border-radius:24px;
                    margin:0 auto 30px;display:flex;align-items:center;justify-content:center;
                    overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.3);
                    animation:pulse 2s infinite ease-in-out;">
                  <img src="${CONFIG.logoUrl}" alt="${nomeCardapio}"
                    style="width:100%;height:100%;object-fit:cover;"
                    onerror="this.outerHTML='<span style=font-size:3.5rem;font-weight:900;color:#3b82f6>X</span>'">
                </div>
                <div style="width:60px;height:60px;border:5px solid rgba(255,255,255,.2);
                    border-top-color:white;border-radius:50%;margin:0 auto 30px;
                    animation:spin 1s linear infinite;"></div>
                <h2 style="color:white;font-size:1.8rem;font-weight:700;margin-bottom:10px;
                    animation:fadeInOut 1.5s infinite;">
                    ${type === 'menu' ? 'Carregando Menu...' : 'Abrindo WhatsApp...'}
                </h2>
                <p style="color:rgba(255,255,255,.8);font-size:1rem;">
                    ${type === 'menu' ? 'Preparando cardapio delicioso' : 'Aguarde um momento'}
                </p>
                <div style="width:250px;height:6px;background:rgba(255,255,255,.2);
                    border-radius:10px;margin:30px auto 0;overflow:hidden;">
                  <div style="height:100%;background:white;border-radius:10px;
                    animation:progress 2s ease-in-out infinite;"></div>
                </div>
              </div>
              <style>
                @keyframes fadeIn    {from{opacity:0}to{opacity:1}}
                @keyframes pulse     {0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
                @keyframes spin      {to{transform:rotate(360deg)}}
                @keyframes fadeInOut {0%,100%{opacity:1}50%{opacity:.5}}
                @keyframes progress  {0%{width:0%}50%{width:70%}100%{width:100%}}
              </style>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
    }

    function removeLoading() {
        const el = document.getElementById('loading-overlay');
        if (el) { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }
    }

    // ── EVENTOS ───────────────────────────────────────────────────────────────
    if (btnMenu) {
        btnMenu.addEventListener('click', () => {
            createLoading('menu');
            setTimeout(() => { window.location.href = CONFIG.menuURL; }, CONFIG.loadingDelay);
        });
    }

    if (btnWhatsapp && CONFIG.whatsAppAtivo) {
        btnWhatsapp.addEventListener('click', () => {
            createLoading('whatsapp');
            setTimeout(() => {
                window.open('https://wa.me/' + CONFIG.whatsappNumber, '_blank');
                removeLoading();
            }, 1500);
        });
    }

    if (btnPedir) {
        btnPedir.addEventListener('click', () => {
            createLoading('menu');
            setTimeout(() => { window.location.href = CONFIG.menuURL; }, CONFIG.loadingDelay);
        });
    }

    if (reportBtn && CONFIG.whatsAppAtivo) {
        reportBtn.addEventListener('click', () => {
            const msg = encodeURIComponent('Ola! Gostaria de reportar algo sobre o cardapio digital.');
            window.open('https://wa.me/' + CONFIG.whatsappNumber + '?text=' + msg, '_blank');
        });
    }

    // ── ANIMACOES DE ENTRADA ──────────────────────────────────────────────────
    [document.querySelector('.logo'),
     document.querySelector('.title'),
     document.querySelector('.services'),
     document.querySelector('.address'),
     document.querySelector('.action-buttons')
    ].forEach((el, i) => {
        if (!el) return;
        el.style.opacity   = '0';
        el.style.transform = 'translateY(20px)';
        setTimeout(() => {
            el.style.transition = 'all .6s ease';
            el.style.opacity    = '1';
            el.style.transform  = 'translateY(0)';
        }, i * 100);
    });

    // Hover na logo (somente quando nao e link clicavel)
    const logoEl = document.querySelector('.logo');
    if (logoEl && !CONFIG.logoLink) {
        logoEl.addEventListener('mouseenter', () => { logoEl.style.transform = 'scale(1.05) rotate(5deg)'; });
        logoEl.addEventListener('mouseleave', () => { logoEl.style.transform = ''; });
    }

    window.addEventListener('offline', () => {
        const n = document.createElement('div');
        n.style.cssText = 'position:fixed;top:20px;right:20px;background:#3b82f6;color:white;padding:16px 24px;border-radius:12px;z-index:10000;font-size:.95rem;';
        n.textContent = 'Voce esta offline';
        document.body.appendChild(n);
        setTimeout(() => n.remove(), 3000);
    });

    console.log(nomeCardapio + ' - Pagina Inicial Carregada!');
});