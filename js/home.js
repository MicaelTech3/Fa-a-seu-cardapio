// ================================================
// X-FOOD - PÁGINA INICIAL
// JavaScript para navegação e interações
// ================================================

document.addEventListener('DOMContentLoaded', function() {
    
    // ============================================
    // CONFIGURAÇÕES
    // ============================================
    const CONFIG = {
        menuURL: 'menu.html',
        whatsappNumber: '5554999999999',
        loadingDelay: 1800 // milissegundos
    };

    // ============================================
    // ELEMENTOS
    // ============================================
    const btnMenu = document.getElementById('btnMenu');
    const btnWhatsapp = document.getElementById('btnWhatsapp');
    const btnPedir = document.querySelector('.btn-pedir');
    const reportBtn = document.querySelector('.report-btn');

    // ============================================
    // FUNÇÃO: CRIAR LOADING
    // ============================================
    function createLoading(type = 'menu') {
        const loadingHTML = `
            <div id="loading-overlay" style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #60a5fa 100%);
                z-index: 9999;
                display: flex;
                align-items: center;
                justify-content: center;
                animation: fadeIn 0.3s ease;
            ">
                <div style="text-align: center; padding: 40px;">
                    <!-- Logo animado -->
                    <div style="
                        width: 120px;
                        height: 120px;
                        background: white;
                        border-radius: 24px;
                        margin: 0 auto 30px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 3.5rem;
                        font-weight: 900;
                        color: #3b82f6;
                        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                        animation: pulse 2s infinite ease-in-out;
                    ">X</div>
                    
                    <!-- Spinner -->
                    <div style="
                        width: 60px;
                        height: 60px;
                        border: 5px solid rgba(255,255,255,0.2);
                        border-top-color: white;
                        border-radius: 50%;
                        margin: 0 auto 30px;
                        animation: spin 1s linear infinite;
                    "></div>
                    
                    <!-- Texto -->
                    <h2 style="
                        color: white;
                        font-size: 1.8rem;
                        font-weight: 700;
                        margin-bottom: 10px;
                        animation: fadeInOut 1.5s infinite;
                    ">
                        ${type === 'menu' ? 'Carregando Menu...' : 'Abrindo WhatsApp...'}
                    </h2>
                    
                    <p style="
                        color: rgba(255,255,255,0.8);
                        font-size: 1rem;
                    ">
                        ${type === 'menu' ? 'Preparando cardápio delicioso 🍔' : 'Aguarde um momento 💬'}
                    </p>
                    
                    <!-- Barra de progresso -->
                    <div style="
                        width: 250px;
                        height: 6px;
                        background: rgba(255,255,255,0.2);
                        border-radius: 10px;
                        margin: 30px auto 0;
                        overflow: hidden;
                    ">
                        <div style="
                            height: 100%;
                            background: white;
                            border-radius: 10px;
                            animation: progress 2s ease-in-out infinite;
                        "></div>
                    </div>
                </div>

                <style>
                    @keyframes fadeIn {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }
                    
                    @keyframes pulse {
                        0%, 100% {
                            transform: scale(1);
                            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                        }
                        50% {
                            transform: scale(1.05);
                            box-shadow: 0 25px 70px rgba(59,130,246,0.5);
                        }
                    }
                    
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                    
                    @keyframes fadeInOut {
                        0%, 100% { opacity: 1; }
                        50% { opacity: 0.5; }
                    }
                    
                    @keyframes progress {
                        0% { width: 0%; }
                        50% { width: 70%; }
                        100% { width: 100%; }
                    }
                </style>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', loadingHTML);
    }

    // ============================================
    // FUNÇÃO: REMOVER LOADING
    // ============================================
    function removeLoading() {
        const loading = document.getElementById('loading-overlay');
        if (loading) {
            loading.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => loading.remove(), 300);
        }
    }

    // ============================================
    // EVENTO: BOTÃO MENU
    // ============================================
    if (btnMenu) {
        btnMenu.addEventListener('click', function() {
            // Criar loading
            createLoading('menu');

            // Redirecionar após delay
            setTimeout(() => {
                window.location.href = CONFIG.menuURL;
            }, CONFIG.loadingDelay);
        });
    }

    // ============================================
    // EVENTO: BOTÃO WHATSAPP
    // ============================================
    if (btnWhatsapp) {
        btnWhatsapp.addEventListener('click', function() {
            // Criar loading
            createLoading('whatsapp');

            // Abrir WhatsApp após delay
            setTimeout(() => {
                const whatsappURL = `https://wa.me/${CONFIG.whatsappNumber}`;
                window.open(whatsappURL, '_blank');
                
                // Remover loading após abrir
                removeLoading();
            }, 1500);
        });
    }

    // ============================================
    // EVENTO: BOTÃO PEDIR (Header)
    // ============================================
    if (btnPedir) {
        btnPedir.addEventListener('click', function() {
            createLoading('menu');
            setTimeout(() => {
                window.location.href = CONFIG.menuURL;
            }, CONFIG.loadingDelay);
        });
    }

    // ============================================
    // EVENTO: REPORTAR ALGO
    // ============================================
    if (reportBtn) {
        reportBtn.addEventListener('click', function() {
            const message = encodeURIComponent('Olá! Gostaria de reportar algo sobre o cardápio digital.');
            const whatsappURL = `https://wa.me/${CONFIG.whatsappNumber}?text=${message}`;
            window.open(whatsappURL, '_blank');
        });
    }

    // ============================================
    // ANIMAÇÕES DE ENTRADA
    // ============================================
    const logo = document.querySelector('.logo');
    const title = document.querySelector('.title');
    const services = document.querySelector('.services');
    const address = document.querySelector('.address');
    const actionButtons = document.querySelector('.action-buttons');

    // Animar elementos na entrada
    const elements = [logo, title, services, address, actionButtons];
    elements.forEach((el, index) => {
        if (el) {
            el.style.opacity = '0';
            el.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                el.style.transition = 'all 0.6s ease';
                el.style.opacity = '1';
                el.style.transform = 'translateY(0)';
            }, index * 100);
        }
    });

    // ============================================
    // EFEITO HOVER NO LOGO
    // ============================================
    if (logo) {
        logo.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.05) rotate(5deg)';
        });

        logo.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1) rotate(0deg)';
        });
    }

    // ============================================
    // SISTEMA DE NOTIFICAÇÃO (OPCIONAL)
    // ============================================
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#22c55e' : '#3b82f6'};
            color: white;
            padding: 16px 24px;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            z-index: 10000;
            animation: slideIn 0.3s ease;
            max-width: 300px;
        `;
        notification.textContent = message;

        // Adicionar animação
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(400px);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(notification);

        // Remover após 3 segundos
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            notification.style.transform = 'translateX(400px)';
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // ============================================
    // DETECÇÃO DE CONECTIVIDADE
    // ============================================
    window.addEventListener('online', () => {
        console.log('✅ Conectado à internet');
    });

    window.addEventListener('offline', () => {
        showNotification('⚠️ Você está offline', 'warning');
    });

    // ============================================
    // LOG DE INICIALIZAÇÃO
    // ============================================
    console.log('🍔 X-Food - Página Inicial Carregada!');
    console.log('📱 Desenvolvido com ❤️');
    
});