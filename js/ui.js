// UI Utilities

const UI = {
    showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast';
        
        let icon = type === 'success' ? 'check-circle' : (type === 'error' ? 'alert-circle' : 'info');
        
        toast.innerHTML = `
            <i data-lucide="${icon}" style="color: ${type === 'success' ? 'var(--success)' : 'var(--danger)'}"></i>
            <span>${message}</span>
        `;
        
        container.appendChild(toast);
        lucide.createIcons({ root: toast });
        
        // Trigger reflow for animation
        toast.offsetHeight;
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    openModal(title, contentHtml, onInit = null) {
        const container = document.getElementById('modals-container');
        
        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop';
        
        const content = document.createElement('div');
        content.className = 'modal-content';
        
        content.innerHTML = `
            <div class="modal-header">
                <h3>${title}</h3>
                <button class="close-btn" aria-label="Close">
                    <i data-lucide="x"></i>
                </button>
            </div>
            <div class="modal-body">
                ${contentHtml}
            </div>
        `;
        
        backdrop.appendChild(content);
        container.appendChild(backdrop);
        lucide.createIcons({ root: backdrop });
        
        const closeBtn = content.querySelector('.close-btn');
        const close = () => {
            content.style.animation = 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) reverse forwards';
            backdrop.style.animation = 'fadeIn 0.2s reverse forwards';
            setTimeout(() => backdrop.remove(), 300);
        };
        
        closeBtn.addEventListener('click', close);
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) close();
        });
        
        if (onInit) onInit(content, close);
    },
    
    // Bottom Navigation Logic
    initNavigation() {
        const navButtons = document.querySelectorAll('.nav-item');
        navButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                navButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                const target = btn.dataset.target;
                App.renderPage(target);
            });
        });
    }
};
