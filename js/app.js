const App = {
    async init() {
        // Run monthly task
        await db.open();
        await generateMonthlyRecords();
        
        UI.initNavigation();
        
        // Theme initialization
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            document.documentElement.setAttribute('data-theme', savedTheme);
            this.updateThemeIcon(savedTheme);
        } else {
            const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            this.updateThemeIcon(isDark ? 'dark' : 'light');
        }
        
        // Initial render
        this.renderPage('dashboard');
    },

    async renderPage(page) {
        const main = document.getElementById('main-content');
        main.innerHTML = '<div class="text-center mt-4"><i data-lucide="loader-2" class="spin"></i> Loading...</div>';
        lucide.createIcons();
        
        try {
            switch(page) {
                case 'dashboard': await this.renderDashboard(main); break;
                case 'classes': await this.renderClasses(main); break;
                case 'payments': await this.renderPayments(main); break;
                case 'settings': await this.renderSettings(main); break;
            }
            lucide.createIcons();
        } catch (err) {
            console.error(err);
            UI.showToast('Error loading page', 'error');
        }
    },
    
    toggleTheme() {
        const root = document.documentElement;
        let newTheme = 'light';
        if (root.getAttribute('data-theme') === 'light' || (!root.hasAttribute('data-theme') && !window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            newTheme = 'dark';
        }
        root.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        this.updateThemeIcon(newTheme);
    },
    
    updateThemeIcon(theme) {
        const settingsIconContainer = document.getElementById('theme-toggle-container');
        if (settingsIconContainer) {
            settingsIconContainer.innerHTML = `<i data-lucide="${theme === 'dark' ? 'sun' : 'moon'}" id="theme-icon-settings"></i>`;
            lucide.createIcons({ root: settingsIconContainer });
        }
    },

    // --- DASHBOARD ---
    async renderDashboard(container) {
        const currentMonth = getActiveMonth();
        const classesCount = await db.classes.count();
        const parentsCount = await db.parents.count();
        
        const paymentsThisMonth = await db.payments.where('month').equals(currentMonth).toArray();
        const paid = paymentsThisMonth.filter(p => p.status === 'Paid');
        const pending = paymentsThisMonth.filter(p => p.status === 'Pending');
        
        const unsentMessages = paid.filter(p => !p.textSent || !p.receiptSent);
        
        let collectedBase = 0;
        let collectedAdvance = 0;
        for (let p of paid) {
            const parent = await db.parents.get(p.parentId);
            const fee = parent ? Number(parent.monthlyFee) : 0;
            const amt = Number(p.amount);
            if (amt > fee && fee > 0) {
                collectedBase += fee;
                collectedAdvance += (amt - fee);
            } else {
                collectedBase += amt;
            }
        }
        
        // We need parent info to calculate pending amount accurately (monthlyFee)
        let pendingAmount = 0;
        for (let p of pending) {
            const parent = await db.parents.get(p.parentId);
            if(parent) pendingAmount += Number(parent.monthlyFee);
        }

        const [currentYear, currentMonthStr] = currentMonth.split('-');
        
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        let monthOptions = '';
        months.forEach((m, i) => {
            const val = String(i + 1).padStart(2, '0');
            const selected = val === currentMonthStr ? 'selected' : '';
            monthOptions += `<option value="${val}" ${selected}>${m}</option>`;
        });
        
        const realYear = new Date().getFullYear();
        let yearOptions = '';
        for(let y = realYear - 5; y <= realYear + 5; y++) {
            const selected = y === parseInt(currentYear) ? 'selected' : '';
            yearOptions += `<option value="${y}" ${selected}>${y}</option>`;
        }

        container.innerHTML = `
            <div style="text-align: left; margin-bottom: 32px; margin-top: 16px; padding: 0 8px;">
                <h1 style="font-size: clamp(2.2rem, 9vw, 3rem); font-weight: 700; color: #005a9c; margin: 0; line-height: 1.15; letter-spacing: -1px;">
                    <div class="kinetic-text" style="animation-delay: 0.1s; display: block; font-weight: 600; font-size: 0.85em; margin-bottom: 4px;">Welcome to</div>
                    <div class="kinetic-text" style="animation-delay: 0.3s; display: block;">MANSHAUL ULOOM</div>
                    <div class="kinetic-text" style="animation-delay: 0.5s; display: block;">MADRASA</div>
                </h1>
            </div>
            <div style="text-align: center; margin-bottom: 24px;">
                <div style="display: flex; justify-content: center; align-items: center; gap: 8px; margin-bottom: 16px;">
                    <h2 style="margin: 0;">Dashboard</h2>
                </div>
                <div style="display: flex; justify-content: center; gap: 8px; align-items: center; flex-wrap: wrap;">
                    <button class="btn btn-secondary" style="width: auto; padding: 4px 8px;" onclick="App.goToPreviousMonth()" title="Go to Previous Month">
                        <i data-lucide="chevron-left" style="margin: 0; width: 20px; height: 20px;"></i>
                    </button>
                    <select id="monthSelect" class="form-control" style="width: auto; padding: 4px 8px; font-size: 0.9em;" onchange="App.handleMonthYearChange()">
                        ${monthOptions}
                    </select>
                    <select id="yearSelect" class="form-control" style="width: auto; padding: 4px 8px; font-size: 0.9em;" onchange="App.handleMonthYearChange()">
                        ${yearOptions}
                    </select>
                    <button class="btn btn-secondary" style="width: auto; padding: 4px 8px;" onclick="App.proceedToNextMonth()" title="Proceed to Next Month">
                        <i data-lucide="chevron-right" style="margin: 0; width: 20px; height: 20px;"></i>
                    </button>
                </div>
            </div>
            
            <div class="metrics-grid">
                <div class="metric-card">
                    <p>Collected</p>
                    <div class="metric-value">₹${collectedBase}${collectedAdvance > 0 ? ` <span style="font-size: 0.6em; opacity: 0.8; font-weight: 500;">(+₹${collectedAdvance})</span>` : ''}</div>
                </div>
                <div class="metric-card outline">
                    <p>Pending</p>
                    <div class="metric-value">₹${pendingAmount}</div>
                </div>
            </div>
            
            <div class="metrics-grid">
                <div class="card mb-0">
                    <p class="text-muted">Paid Parents</p>
                    <h3 style="color: var(--success); font-size: 1.5rem; margin-top: 4px;">${paid.length}</h3>
                </div>
                <div class="card mb-0">
                    <p class="text-muted">Pending Parents</p>
                    <h3 style="color: var(--danger); font-size: 1.5rem; margin-top: 4px;">${pending.length}</h3>
                </div>
            </div>
            
            <div style="text-align: center; margin-top: 24px; display: flex; flex-direction: column; align-items: center; gap: 8px;">
                <button class="btn" id="editTemplateBtn" style="background: var(--primary-600); color: white; padding: 10px 16px; font-size: 0.9rem; display: inline-flex; align-items: center; justify-content: space-between; width: 260px; transition: all 0.3s; opacity: 0.7;" onclick="if(window.isTemplateUnlocked) { App.openReceiptSettingsModal(); } else { UI.showToast('Please tap the lock icon to unlock editing.', 'info'); }">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <i data-lucide="image"></i> Edit Receipt Template
                    </div>
                    <div style="padding: 6px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.2);" onclick="event.stopPropagation(); App.toggleTemplateLock()">
                        <i data-lucide="lock" id="templateLockIcon" style="width: 16px; height: 16px; margin: 0;"></i>
                    </div>
                </button>
                
                <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-top: 8px;">
                    ${unsentMessages.length > 0 ? `
                        <button class="btn" style="position: relative; padding: 10px 16px; font-size: 0.9rem; background: #25D366; color: white; border-radius: 12px; border: none; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 4px 10px rgba(37, 211, 102, 0.3); transition: transform 0.2s;" onclick="App.openUnsentReceiptsModal()" onmousedown="this.style.transform='scale(0.95)'" onmouseup="this.style.transform='scale(1)'" onmouseleave="this.style.transform='scale(1)'">
                            <i data-lucide="message-circle" style="width: 18px; height: 18px;"></i> 
                            Pending Messages
                            <span style="position: absolute; top: -8px; right: -8px; background: var(--danger); color: white; font-size: 0.75rem; font-weight: bold; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: 50%; border: 2px solid var(--surface-color); box-shadow: 0 2px 5px rgba(0,0,0,0.2);">${unsentMessages.length}</span>
                        </button>
                    ` : ''}
                    <button class="btn" style="padding: 10px 16px; font-size: 0.9rem; background: var(--primary-600); color: white; border-radius: 12px; border: none; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); transition: transform 0.2s;" onclick="App.openPosterGeneratorModal()" onmousedown="this.style.transform='scale(0.95)'" onmouseup="this.style.transform='scale(1)'" onmouseleave="this.style.transform='scale(1)'">
                        <i data-lucide="bar-chart-2" style="width: 18px; height: 18px;"></i> 
                        Status Poster
                    </button>
                </div>
            </div>
            
            </div>
        `;
    },

    async changeMonth(month) {
        if(!month) return;
        setActiveMonth(month);
        await generateMonthlyRecords(); // Ensure records are generated for the selected month
        this.renderPage('dashboard');
    },

    handleMonthYearChange() {
        const m = document.getElementById('monthSelect').value;
        const y = document.getElementById('yearSelect').value;
        this.changeMonth(`${y}-${m}`);
    },

    async goToPreviousMonth() {
        if (!confirm('Are you sure you want to navigate to the previous month?')) return;
        const current = getActiveMonth();
        let [year, month] = current.split('-').map(Number);
        month--;
        if (month < 1) {
            month = 12;
            year--;
        }
        const prev = `${year}-${String(month).padStart(2, '0')}`;
        await this.changeMonth(prev);
    },

    async proceedToNextMonth() {
        if (!confirm('Are you sure you want to navigate to the next month?')) return;
        const current = getActiveMonth();
        let [year, month] = current.split('-').map(Number);
        month++;
        if (month > 12) {
            month = 1;
            year++;
        }
        const next = `${year}-${String(month).padStart(2, '0')}`;
        await this.changeMonth(next);
    },

    async openUnsentReceiptsModal() {
        const currentMonth = getActiveMonth();
        const paymentsThisMonth = await db.payments.where('month').equals(currentMonth).toArray();
        const unsent = paymentsThisMonth.filter(p => p.status === 'Paid' && (!p.receiptSent || !p.textSent));
        if(unsent.length === 0) {
            UI.showToast('No pending messages to send!', 'info');
            return;
        }
        
        let unsentList = [];
        for (let p of unsent) {
            const parent = await db.parents.get(p.parentId);
            if (parent) {
                unsentList.push({ payment: p, parent: parent });
            }
        }
        
        const content = `
            <p class="text-muted" style="font-size: 0.9em; margin-bottom: 16px;">Click the WhatsApp icon to message the parent.</p>
            <div id="unsentReceiptsList">
                ${unsentList.map(item => `
                    <div class="list-item" style="padding: 12px; margin-bottom: 8px;">
                        <div class="list-item-content">
                            <h4 style="margin: 0; font-size: 1rem;">${item.parent.parentName}</h4>
                            <p style="margin: 0; font-size: 0.8rem; color: var(--text-muted);">${item.payment.receiptNo} • ₹${item.payment.amount}</p>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button class="btn" style="width: 40px; height: 40px; padding: 0; border-radius: 50%; background: #25D366; box-shadow: 0 4px 10px rgba(37, 211, 102, 0.4); border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0;" onclick="App.openWhatsApp('${item.payment.id}'); this.style.display='none';" title="Open WhatsApp">
                                <i data-lucide="message-circle" style="width: 20px; height: 20px; color: white; margin: 0;"></i>
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        UI.openModal('Pending Messages', content);
    },

    toggleTemplateLock() {
        window.isTemplateUnlocked = !window.isTemplateUnlocked;
        const icon = document.getElementById('templateLockIcon');
        const btn = document.getElementById('editTemplateBtn');
        
        if (window.isTemplateUnlocked) {
            icon.setAttribute('data-lucide', 'unlock');
            btn.style.opacity = '1';
            UI.showToast('Template editing unlocked!', 'success');
        } else {
            icon.setAttribute('data-lucide', 'lock');
            btn.style.opacity = '0.7';
            UI.showToast('Template editing locked.', 'info');
        }
        lucide.createIcons({ root: btn });
    },

    async openReceiptSettingsModal() {
        // Load existing settings
        let settings = {
            nextReceiptNumber: 1,
            receiptNoX: 0.44, receiptNoY: 0.323,
            startX: 0.52,
            nameY: 0.473, monthY: 0.527, amountY: 0.582, wordsY: 0.638,
            dateY: 0.693, methodY: 0.748, remarksY: 0.803,
            template: 'receipt-template.png'
        };
        
        let globalSaved = await db.settings.get('receiptSettings');
        if (!globalSaved) {
            // Migrate from local storage if global is empty
            try {
                const localSaved = localStorage.getItem('receiptSettings');
                if(localSaved) {
                    globalSaved = JSON.parse(localSaved);
                    await db.settings.set('receiptSettings', globalSaved);
                }
            } catch(e) {}
        }
        
        if (globalSaved) settings = { ...settings, ...globalSaved };

        const content = `
            <form id="receiptSettingsForm">
                <div class="form-group" style="text-align: center;">
                    <label>Receipt Template Background</label>
                    <canvas id="templatePreviewCanvas" style="max-width: 100%; height: auto; border-radius: 8px; margin-bottom: 8px; border: 1px solid var(--border-color);"></canvas>
                    <input type="file" id="templateUpload" accept="image/*" class="form-control" style="font-size: 0.8rem;">
                    <small class="text-muted">Upload a custom receipt image from your gallery.</small>
                </div>
                <h4 style="margin-top: 16px; margin-bottom: 8px; border-bottom: 1px solid var(--border-color); padding-bottom: 4px;">Receipt Sequence</h4>
                <div class="metrics-grid" style="grid-template-columns: 1fr; gap: 8px;">
                    <div class="form-group"><label>Next Number</label><input type="number" name="nextReceiptNumber" class="form-control" value="${settings.nextReceiptNumber}"></div>
                </div>
                <h4 style="margin-top: 16px; margin-bottom: 8px; border-bottom: 1px solid var(--border-color); padding-bottom: 4px;">Text Positions (Multiplier 0.0 - 1.0)</h4>
                <div class="metrics-grid" style="grid-template-columns: 1fr 1fr; gap: 8px;">
                    <div class="form-group"><label>Receipt No (X)</label><input type="number" step="0.001" name="receiptNoX" class="form-control" value="${settings.receiptNoX}"></div>
                    <div class="form-group"><label>Receipt No (Y)</label><input type="number" step="0.001" name="receiptNoY" class="form-control" value="${settings.receiptNoY}"></div>
                    <div class="form-group" style="grid-column: span 2;"><label>Main Fields Start (X)</label><input type="number" step="0.001" name="startX" class="form-control" value="${settings.startX}"></div>
                    <div class="form-group"><label>Parent Name (Y)</label><input type="number" step="0.001" name="nameY" class="form-control" value="${settings.nameY}"></div>
                    <div class="form-group"><label>Month (Y)</label><input type="number" step="0.001" name="monthY" class="form-control" value="${settings.monthY}"></div>
                    <div class="form-group"><label>Amount (Y)</label><input type="number" step="0.001" name="amountY" class="form-control" value="${settings.amountY}"></div>
                    <div class="form-group"><label>Amount in Words (Y)</label><input type="number" step="0.001" name="wordsY" class="form-control" value="${settings.wordsY}"></div>
                    <div class="form-group"><label>Date (Y)</label><input type="number" step="0.001" name="dateY" class="form-control" value="${settings.dateY}"></div>
                    <div class="form-group"><label>Method (Y)</label><input type="number" step="0.001" name="methodY" class="form-control" value="${settings.methodY}"></div>
                    <div class="form-group"><label>Remarks (Y)</label><input type="number" step="0.001" name="remarksY" class="form-control" value="${settings.remarksY}"></div>
                </div>
                <button type="submit" class="btn btn-primary mt-4">Save Receipt Settings</button>
                <button type="button" class="btn btn-secondary mt-2" onclick="App.resetReceiptSettings()">Reset to Defaults</button>
            </form>
        `;
        
        UI.openModal('Receipt Editor', content, (modal, closeFunc) => {
            const fileInput = modal.querySelector('#templateUpload');
            const canvas = modal.querySelector('#templatePreviewCanvas');
            const form = modal.querySelector('#receiptSettingsForm');
            let base64Template = settings.template;

            const drawPreview = () => {
                const img = new Image();
                img.onload = () => {
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    
                    const w = canvas.width;
                    const h = canvas.height;
                    const fontSize = w * 0.024;
                    ctx.font = `600 ${fontSize}px "Outfit", sans-serif`;
                    ctx.fillStyle = '#0f172a';
                    ctx.textAlign = 'left';

                    const fd = new FormData(form);
                    const rx = Number(fd.get('receiptNoX')) || 0;
                    const ry = Number(fd.get('receiptNoY')) || 0;
                    const sx = Number(fd.get('startX')) || 0;

                    const previewReceiptNo = fd.get('nextReceiptNumber') || '1';
                    ctx.fillText(previewReceiptNo, w * rx, h * ry);

                    const lines = [
                        { y: Number(fd.get('nameY')) || 0, text: 'Student Name' },
                        { y: Number(fd.get('monthY')) || 0, text: formatMonthYear('2026-07') },
                        { y: Number(fd.get('amountY')) || 0, text: 'Rs. 1000/-' },
                        { y: Number(fd.get('wordsY')) || 0, text: 'One Thousand Only' },
                        { y: Number(fd.get('dateY')) || 0, text: '05-Jul-2026' },
                        { y: Number(fd.get('methodY')) || 0, text: 'Cash' },
                        { y: Number(fd.get('remarksY')) || 0, text: 'Jazakkallah', isRemarks: true }
                    ];

                    lines.forEach(line => {
                        if (line.isRemarks) {
                            ctx.fillStyle = '#16a34a'; // Green
                        } else {
                            ctx.fillStyle = '#0f172a';
                        }
                        ctx.fillText(line.text, w * sx, h * line.y);
                    });
                };
                img.src = base64Template;
            };

            // Draw initial preview
            drawPreview();

            // Redraw on any input change
            form.addEventListener('input', drawPreview);

            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if(file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        base64Template = e.target.result;
                        drawPreview();
                    };
                    reader.readAsDataURL(file);
                }
            });

            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const fd = new FormData(e.target);
                const newSettings = {
                    nextReceiptNumber: Number(fd.get('nextReceiptNumber')),
                    receiptNoX: Number(fd.get('receiptNoX')),
                    receiptNoY: Number(fd.get('receiptNoY')),
                    startX: Number(fd.get('startX')),
                    nameY: Number(fd.get('nameY')),
                    monthY: Number(fd.get('monthY')),
                    amountY: Number(fd.get('amountY')),
                    wordsY: Number(fd.get('wordsY')),
                    dateY: Number(fd.get('dateY')),
                    methodY: Number(fd.get('methodY')),
                    remarksY: Number(fd.get('remarksY')),
                    template: base64Template
                };
                
                // Save globally to Firebase and locally for fallback
                await db.settings.set('receiptSettings', newSettings);
                localStorage.setItem('receiptSettings', JSON.stringify(newSettings));
                
                UI.showToast('Receipt settings updated globally!');
                closeFunc();
            });
        });
    },

    async resetReceiptSettings() {
        if(confirm('Reset all receipt settings to defaults globally?')) {
            await db.settings.set('receiptSettings', null);
            localStorage.removeItem('receiptSettings');
            UI.showToast('Settings reset globally. Please reopen modal.');
            const closeBtn = document.querySelector('.close-btn');
            if(closeBtn) closeBtn.click();
        }
    },

    // --- CLASSES & PARENTS ---
    async renderClasses(container) {
        const classes = await db.classes.toArray();
        const parents = await db.parents.toArray();
        
        let iconsHtml = `<div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 20px;">`;
        classes.forEach((cls, i) => {
            const num = i + 1; // 1 to 10
            const isActive = window.currentClassFilter === cls.id;
            iconsHtml += `
                <div onclick="App.filterByClass('${cls.id}')" style="
                    display: flex; flex-direction: column; align-items: center; justify-content: center;
                    aspect-ratio: 1; border-radius: 16px; cursor: pointer; transition: all 0.2s;
                    background: ${isActive ? 'var(--primary-600)' : 'var(--bg-color)'};
                    color: ${isActive ? 'white' : 'var(--text-color)'};
                    border: 1px solid ${isActive ? 'var(--primary-600)' : 'var(--border-color)'};
                    box-shadow: 0 4px 6px rgba(0,0,0,0.05);
                ">
                    <span style="font-size: 1.5rem; font-weight: 700;">${num}</span>
                </div>
            `;
        });
        iconsHtml += `</div>`;

        let html = `
            <div style="margin-bottom: 20px; text-align: center;">
                <h2 style="margin-bottom: 16px;">Parents Directory</h2>
                <button class="btn btn-primary" onclick="App.openAddParentModal()">
                    <i data-lucide="user-plus"></i> Add Parent
                </button>
            </div>
            
            ${iconsHtml}
            
            <div class="form-group">
                <input type="text" id="parentSearch" class="form-control" placeholder="Search by name or number..." onkeyup="App.filterParents()">
            </div>
            
            <div class="card">
                <div id="parentsList">
        `;
        
        if (parents.length === 0) {
            html += `<p class="text-center text-muted">No parents added yet.</p>`;
        } else {
            // Filter by class if active
            const filteredParents = window.currentClassFilter 
                ? parents.filter(p => p.classId === window.currentClassFilter) 
                : parents;

            if (filteredParents.length === 0) {
                html += `<p class="text-center text-muted">No parents found in this class.</p>`;
            } else {
                // Display parents in the order they were added
                filteredParents.forEach((p) => {
                    const originalIndex = parents.indexOf(p);
                    html += `
                        <div class="list-item parent-item" data-name="${p.parentName.toLowerCase()}" data-phone="${p.whatsappNumber}">
                            <div class="list-item-content">
                                <h3>${originalIndex + 1}. ${p.parentName} ${p.studentName ? `<span style="font-weight: 300; font-size: 0.85em;">(${p.studentName})</span>` : ''}</h3>
                                <p>${p.whatsappNumber ? p.whatsappNumber : '<i data-lucide="phone-off" style="width: 14px; height: 14px; color: var(--danger); vertical-align: text-bottom; margin-right: 2px;"></i><span style="color: var(--danger); font-size: 0.9em;">No Phone</span>'} • ₹${p.monthlyFee}/mo</p>
                            </div>
                        <div class="flex gap-2" style="align-items: center;">
                            <button class="btn btn-secondary" style="width: auto; padding: 6px;" onclick="App.editParent('${p.id}')" title="Edit">
                                <i data-lucide="edit-2" style="margin: 0; width: 16px; height: 16px;"></i>
                            </button>
                            <button class="btn btn-secondary" style="width: auto; padding: 6px; color: var(--danger); border-color: var(--danger);" onclick="App.deleteParent('${p.id}')" title="Delete">
                                <i data-lucide="trash-2" style="margin: 0; width: 16px; height: 16px;"></i>
                            </button>
                        </div>
                    </div>
                `;
            });
            } // close inner else
        }
        
        html += `</div></div>`;
        container.innerHTML = html;
    },

    filterByClass(classId) {
        if(window.currentClassFilter === classId) {
            window.currentClassFilter = null;
        } else {
            window.currentClassFilter = classId;
        }
        this.renderPage('classes');
    },

    filterParents() {
        const term = document.getElementById('parentSearch').value.toLowerCase();
        document.querySelectorAll('.parent-item').forEach(el => {
            const name = el.dataset.name;
            const phone = el.dataset.phone;
            if (name.includes(term) || phone.includes(term)) {
                el.style.display = 'flex';
            } else {
                el.style.display = 'none';
            }
        });
    },

    async openAddParentModal() {
        const classes = await db.classes.toArray();
        let classOpts = classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        
        const content = `
            <form id="addParentForm">
                <div class="form-group">
                    <label>Parent Name *</label>
                    <input type="text" name="parentName" class="form-control" required>
                </div>
                <div class="form-group">
                    <label>Student Name (Optional)</label>
                    <input type="text" name="studentName" class="form-control">
                </div>
                <div class="form-group">
                    <label>Class</label>
                    <select name="classId" class="form-control" required>
                        ${classOpts}
                    </select>
                </div>
                <div class="form-group">
                    <label>WhatsApp Number (with country code, e.g. 91XXXXXXXXXX)</label>
                    <input type="tel" name="whatsappNumber" class="form-control" inputmode="tel">
                </div>
                <div class="form-group">
                    <label>Monthly Fee (₹) *</label>
                    <input type="number" name="monthlyFee" class="form-control" inputmode="numeric" required>
                </div>
                <button type="submit" class="btn btn-primary mt-4">Save Parent</button>
            </form>
        `;
        
        UI.openModal('Add Parent', content, (modal, closeFunc) => {
            modal.querySelector('#addParentForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const fd = new FormData(e.target);
                try {
                    const newId = await db.parents.add({
                        parentName: fd.get('parentName'),
                        studentName: fd.get('studentName'),
                        classId: fd.get('classId'),
                        whatsappNumber: fd.get('whatsappNumber'),
                        monthlyFee: Number(fd.get('monthlyFee')),
                        notes: ''
                    });
                    // Also generate current month payment record immediately
                    await db.payments.add({
                        parentId: newId,
                        month: getActiveMonth(),
                        status: 'Pending',
                        amount: 0,
                        date: null,
                        method: null,
                        remarks: '',
                        receiptNo: null
                    });
                    UI.showToast('Parent added successfully');
                    closeFunc();
                    App.renderPage('classes');
                } catch(err) {
                    UI.showToast('Error saving', 'error');
                }
            });
        });
    },

    async editParent(id) {
        const parent = await db.parents.get(id);
        const classes = await db.classes.toArray();
        let classOpts = classes.map(c => `<option value="${c.id}" ${c.id === parent.classId ? 'selected' : ''}>${c.name}</option>`).join('');
        
        const content = `
            <form id="editParentForm">
                <div class="form-group">
                    <label>Parent Name *</label>
                    <input type="text" name="parentName" class="form-control" value="${parent.parentName}" required>
                </div>
                <div class="form-group">
                    <label>Student Name (Optional)</label>
                    <input type="text" name="studentName" class="form-control" value="${parent.studentName || ''}">
                </div>
                <div class="form-group">
                    <label>Class</label>
                    <select name="classId" class="form-control" required>
                        ${classOpts}
                    </select>
                </div>
                <div class="form-group">
                    <label>WhatsApp Number</label>
                    <input type="tel" name="whatsappNumber" class="form-control" value="${parent.whatsappNumber}" inputmode="tel">
                </div>
                <div class="form-group">
                    <label>Monthly Fee (₹) *</label>
                    <input type="number" name="monthlyFee" class="form-control" value="${parent.monthlyFee}" inputmode="numeric" required>
                </div>
                <button type="submit" class="btn btn-primary mt-4">Update Parent</button>
            </form>
        `;
        
        UI.openModal('Edit Parent', content, (modal, closeFunc) => {
            modal.querySelector('#editParentForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const fd = new FormData(e.target);
                try {
                    await db.parents.update(id, {
                        parentName: fd.get('parentName'),
                        studentName: fd.get('studentName'),
                        classId: fd.get('classId'),
                        whatsappNumber: fd.get('whatsappNumber'),
                        monthlyFee: Number(fd.get('monthlyFee'))
                    });
                    UI.showToast('Parent updated successfully');
                    closeFunc();
                    App.renderPage('classes');
                } catch(err) {
                    UI.showToast('Error updating', 'error');
                }
            });
        });
    },

    async deleteParent(id) {
        if(confirm('Are you sure you want to delete this parent? This will also remove their entire payment history.')) {
            try {
                await db.parents.delete(id);
                // Also delete their payments to keep db clean
                const payments = await db.payments.where('parentId').equals(id).toArray();
                const paymentIds = payments.map(p => p.id);
                await db.payments.bulkDelete(paymentIds);
                
                UI.showToast('Parent deleted successfully');
                App.renderPage('classes');
            } catch(err) {
                UI.showToast('Error deleting parent', 'error');
            }
        }
    },

    // --- PAYMENTS ---
    async renderPayments(container) {
        const currentMonth = getActiveMonth();
        const payments = await db.payments.where('month').equals(currentMonth).toArray();
        const allPending = await db.payments.where('status').equals('Pending').toArray();
        const pastPending = allPending.filter(p => p.month < currentMonth);
        const parents = await db.parents.toArray();
        const classes = await db.classes.toArray();
        
        // Map data to match order of adding parents
        const enriched = parents.map((parent, index) => {
            const pay = payments.find(p => p.parentId === parent.id);
            if (!pay) return null;
            const cls = classes.find(c => c.id === parent.classId) || {};
            const hasPastDue = pastPending.some(p => p.parentId === parent.id);
            return { ...pay, parent, className: cls.name, serialNo: index + 1, hasPastDue };
        }).filter(p => p !== null);
        
        // State for filters
        window.currentPaymentFilter = window.currentPaymentFilter || 'Pending';

        let iconsHtml = `<div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 20px;">`;
        classes.forEach((cls, i) => {
            const num = i + 1; // 1 to 10
            const isActive = window.currentPaymentClassFilter === cls.id;
            iconsHtml += `
                <div onclick="App.filterPaymentByClass('${cls.id}')" style="
                    display: flex; flex-direction: column; align-items: center; justify-content: center;
                    aspect-ratio: 1; border-radius: 16px; cursor: pointer; transition: all 0.2s;
                    background: ${isActive ? 'var(--primary-600)' : 'var(--bg-color)'};
                    color: ${isActive ? 'white' : 'var(--text-color)'};
                    border: 1px solid ${isActive ? 'var(--primary-600)' : 'var(--border-color)'};
                    box-shadow: 0 4px 6px rgba(0,0,0,0.05);
                ">
                    <span style="font-size: 1.5rem; font-weight: 700;">${num}</span>
                </div>
            `;
        });
        iconsHtml += `</div>`;
        
        const renderList = (filter) => {
            window.currentPaymentFilter = filter;
            const filtered = enriched.filter(p => {
                let match = filter === 'All' || p.status === filter;
                if(window.currentPaymentClassFilter) {
                    match = match && (p.parent.classId === window.currentPaymentClassFilter);
                }
                return match;
            });
            
            let html = '';
            if(filtered.length === 0) html = `<p class="text-center text-muted mt-4">No records found.</p>`;
            
            filtered.forEach(p => {
                const isPaid = p.status === 'Paid';
                html += `
                    <div class="list-item payment-item" data-name="${(p.parent.parentName || '').toLowerCase()}" data-phone="${p.parent.whatsappNumber || ''}" style="cursor:pointer; ${p.hasPastDue && !isPaid ? 'border-left: 4px solid var(--danger); background-color: rgba(239, 68, 68, 0.05);' : ''}">
                        <div class="list-item-content" onclick="${isPaid ? `App.viewReceipt('${p.id}')` : `App.recordPayment('${p.id}')`}" style="flex:1">
                            <h3 style="${p.hasPastDue && !isPaid ? 'color: var(--danger); font-weight: bold;' : ''}">
                                ${p.serialNo}. ${p.parent.parentName}
                                ${p.hasPastDue ? `<button class="btn" style="padding: 2px 8px; font-size: 0.7rem; background: var(--danger); color: white; border-radius: 12px; border: none; margin-left: 8px; font-weight: bold; height: auto;" onclick="event.stopPropagation(); App.showPastDues('${p.parent.id}')">View Past Dues</button>` : ''}
                            </h3>
                            <p style="${p.hasPastDue && !isPaid ? 'color: var(--danger); font-weight: 600;' : ''}">${p.className} • ₹${p.parent.monthlyFee}</p>
                        </div>
                        <div class="flex align-center gap-2">
                            <span class="badge ${isPaid ? 'badge-success' : 'badge-danger'}" onclick="${isPaid ? `App.viewReceipt('${p.id}')` : `App.recordPayment('${p.id}')`}">${p.status}</span>
                            ${isPaid ? `
                            <div class="flex gap-1">
                                <button class="btn btn-secondary" style="width: auto; padding: 6px;" onclick="event.stopPropagation(); App.editPayment('${p.id}')" title="Edit Payment">
                                    <i data-lucide="edit-2" style="margin: 0; width: 16px; height: 16px;"></i>
                                </button>
                                <button class="btn btn-secondary" style="width: auto; padding: 6px; border-color: var(--danger); color: var(--danger);" onclick="event.stopPropagation(); App.undoPayment('${p.id}')" title="Mark as Unpaid">
                                    <i data-lucide="undo" style="margin: 0; width: 16px; height: 16px;"></i>
                                </button>
                            </div>
                            ` : ''}
                            <i data-lucide="chevron-right" style="color: var(--text-muted); width: 16px;" onclick="${isPaid ? `App.viewReceipt('${p.id}')` : `App.recordPayment('${p.id}')`}"></i>
                        </div>
                    </div>
                `;
            });
            
            const listContainer = document.getElementById('paymentsList');
            if(listContainer) {
                listContainer.innerHTML = html;
                lucide.createIcons({ root: listContainer });
                
                // Update active tab styling
                document.querySelectorAll('.filter-tab').forEach(btn => {
                    btn.style.borderBottom = btn.innerText === filter ? '2px solid var(--primary-600)' : 'none';
                    btn.style.color = btn.innerText === filter ? 'var(--primary-600)' : 'var(--text-muted)';
                    btn.style.fontWeight = btn.innerText === filter ? '600' : '500';
                });
                
                if (typeof App.filterPaymentsSearch === 'function') {
                    App.filterPaymentsSearch();
                }
            }
            return html;
        };
        
        container.innerHTML = `
            <h2 style="text-align: center; margin-bottom: 16px;">Payments (${formatMonthYear(currentMonth)})</h2>
            
            ${iconsHtml}
            
            <div class="form-group">
                <input type="text" id="paymentSearch" class="form-control" placeholder="Search by name or number..." onkeyup="App.filterPaymentsSearch()">
            </div>
            
            <div class="flex mt-4 mb-4" style="border-bottom: 1px solid var(--border-color);">
                <button class="filter-tab" style="flex:1; padding: 12px; background:none; border:none; border-bottom: 2px solid var(--primary-600); color: var(--primary-600); font-weight: 600;" onclick="App.renderPaymentList('Pending')">Pending</button>
                <button class="filter-tab" style="flex:1; padding: 12px; background:none; border:none; color: var(--text-muted);" onclick="App.renderPaymentList('Paid')">Paid</button>
                <button class="filter-tab" style="flex:1; padding: 12px; background:none; border:none; color: var(--text-muted);" onclick="App.renderPaymentList('All')">All</button>
            </div>
            
            <div class="card" id="paymentsList">
                ${renderList(window.currentPaymentFilter)}
            </div>
        `;
        
        // Expose renderList globally for the buttons
        App.renderPaymentList = renderList;
    },

    filterPaymentByClass(classId) {
        if(window.currentPaymentClassFilter === classId) {
            window.currentPaymentClassFilter = null;
        } else {
            window.currentPaymentClassFilter = classId;
        }
        this.renderPage('payments');
    },

    filterPaymentsSearch() {
        const searchEl = document.getElementById('paymentSearch');
        if (!searchEl) return;
        const term = searchEl.value.toLowerCase();
        document.querySelectorAll('.payment-item').forEach(el => {
            const name = el.dataset.name || '';
            const phone = el.dataset.phone || '';
            if (name.includes(term) || phone.includes(term)) {
                el.style.display = 'flex';
            } else {
                el.style.display = 'none';
            }
        });
    },

    async recordPayment(paymentId) {
        const payment = await db.payments.get(paymentId);
        const parent = await db.parents.get(payment.parentId);
        
        let settings = { prefix: 'MUP', nextReceiptNumber: 1 };
        try {
            let globalSaved = await db.settings.get('receiptSettings');
            if (!globalSaved) {
                const localSaved = localStorage.getItem('receiptSettings');
                if (localSaved) globalSaved = JSON.parse(localSaved);
            }
            if (globalSaved) settings = { ...settings, ...globalSaved };
        } catch(e) {}
        
        const content = `
            <form id="recordPaymentForm">
                <div class="form-group">
                    <label>Receipt Number</label>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <input type="number" name="receiptNumber" class="form-control" style="flex: 1;" value="${settings.nextReceiptNumber || 1}" inputmode="numeric" required>
                    </div>
                </div>
                <div class="form-group">
                    <label>Number of Months Paid</label>
                    <input type="number" id="monthsPaid" name="monthsPaid" class="form-control" value="1" min="1" max="12" inputmode="numeric" required oninput="document.getElementById('amountInput').value = this.value * ${parent.monthlyFee}">
                </div>
                <div class="form-group">
                    <label>Amount Received (₹)</label>
                    <input type="number" id="amountInput" name="amount" class="form-control" value="${parent.monthlyFee}" inputmode="numeric" required>
                </div>
                <div class="form-group">
                    <label>Payment Method</label>
                    <select name="method" class="form-control" required>
                        <option value="Cash">Cash</option>
                        <option value="UPI">UPI / GPay</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Payment Date</label>
                    <input type="date" name="date" class="form-control" value="${new Date().toISOString().split('T')[0]}" required>
                </div>
                <button type="submit" class="btn btn-primary mt-4">Record & Generate Receipt</button>
            </form>
        `;
        
        UI.openModal(`Record Payment - ${parent.parentName}`, content, (modal, closeFunc) => {
            modal.querySelector('#recordPaymentForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const fd = new FormData(e.target);
                
                try {
                    const num = fd.get('receiptNumber');
                    const receiptNo = `${num}`;
                    const monthsPaid = Number(fd.get('monthsPaid')) || 1;
                    const totalAmount = Number(fd.get('amount'));
                    
                    settings.nextReceiptNumber = Number(num) + 1;
                    await db.settings.set('receiptSettings', settings);
                    localStorage.setItem('receiptSettings', JSON.stringify(settings));
                    
                    let receiptMonthText = formatMonthYear(payment.month);
                    if (monthsPaid > 1) {
                        let [y, m] = payment.month.split('-').map(Number);
                        let endY = y;
                        let endM = m + monthsPaid - 1;
                        while (endM > 12) { endM -= 12; endY++; }
                        receiptMonthText = `${formatMonthYear(payment.month)} - ${formatMonthYear(`${endY}-${String(endM).padStart(2, '0')}`)}`;
                    }

                    await db.payments.update(paymentId, {
                        status: 'Paid',
                        amount: totalAmount,
                        method: fd.get('method'),
                        date: fd.get('date'),
                        receiptNo: receiptNo,
                        textSent: false,
                        receiptSent: false,
                        receiptMonthOverride: monthsPaid > 1 ? receiptMonthText : null
                    });
                    
                    if (monthsPaid > 1) {
                        for (let i = 1; i < monthsPaid; i++) {
                            let [y, m] = payment.month.split('-').map(Number);
                            m += i;
                            while (m > 12) { m -= 12; y++; }
                            const futureMonth = `${y}-${String(m).padStart(2, '0')}`;
                            
                            const existing = await db.payments.where('month').equals(futureMonth).toArray();
                            const existingForParent = existing.find(p => p.parentId === payment.parentId);
                            
                            if (existingForParent) {
                                await db.payments.update(existingForParent.id, {
                                    status: 'Paid',
                                    amount: 0,
                                    method: fd.get('method'),
                                    date: fd.get('date'),
                                    receiptNo: receiptNo,
                                    textSent: true,
                                    receiptSent: true
                                });
                            } else {
                                await db.payments.add({
                                    parentId: payment.parentId,
                                    month: futureMonth,
                                    status: 'Paid',
                                    amount: 0,
                                    method: fd.get('method'),
                                    date: fd.get('date'),
                                    receiptNo: receiptNo,
                                    remarks: 'Advance Payment',
                                    textSent: true,
                                    receiptSent: true
                                });
                            }
                        }
                    }
                    
                    UI.showToast('Payment recorded successfully');
                    closeFunc();
                    App.renderPage('payments');
                    
                    // Immediately show receipt options
                    App.viewReceipt(paymentId);
                } catch(err) {
                    UI.showToast('Error recording payment', 'error');
                }
            });
        });
    },

    async editPayment(paymentId) {
        const payment = await db.payments.get(paymentId);
        const parent = await db.parents.get(payment.parentId);
        
        const content = `
            <form id="editPaymentForm">
                <div class="form-group">
                    <label>Amount Received (₹)</label>
                    <input type="number" name="amount" class="form-control" value="${payment.amount}" inputmode="numeric" required>
                </div>
                <div class="form-group">
                    <label>Payment Method</label>
                    <select name="method" class="form-control" required>
                        <option value="Cash" ${payment.method === 'Cash' ? 'selected' : ''}>Cash</option>
                        <option value="UPI" ${payment.method === 'UPI' ? 'selected' : ''}>UPI / GPay</option>
                        <option value="Bank Transfer" ${payment.method === 'Bank Transfer' ? 'selected' : ''}>Bank Transfer</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Payment Date</label>
                    <input type="date" name="date" class="form-control" value="${payment.date}" required>
                </div>
                <button type="submit" class="btn btn-primary mt-4">Update Payment</button>
            </form>
        `;
        
        UI.openModal(`Edit Payment - ${parent.parentName}`, content, (modal, closeFunc) => {
            modal.querySelector('#editPaymentForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const fd = new FormData(e.target);
                
                try {
                    await db.payments.update(paymentId, {
                        amount: Number(fd.get('amount')),
                        method: fd.get('method'),
                        date: fd.get('date')
                    });
                    
                    UI.showToast('Payment updated successfully');
                    closeFunc();
                    App.renderPage('payments');
                } catch(err) {
                    UI.showToast('Error updating payment', 'error');
                }
            });
        });
    },

    async undoPayment(paymentId) {
        if(!confirm('Are you sure you want to undo this payment and mark it as UNPAID?')) return;
        
        try {
            await db.payments.update(paymentId, {
                status: 'Pending',
                amount: 0,
                method: 'Cash',
                date: '',
                receiptNo: '',
                receiptSent: false,
                textSent: false
            });
            UI.showToast('Payment marked as unpaid successfully');
            
            const activeModal = document.querySelector('.modal');
            if(activeModal) {
                const closeBtn = activeModal.querySelector('.modal-close');
                if(closeBtn) closeBtn.click();
            }
            
            const activeNav = document.querySelector('.nav-item.active');
            if (activeNav) App.renderPage(activeNav.dataset.target);
            
        } catch (err) {
            console.error(err);
            UI.showToast('Error undoing payment', 'error');
        }
    },

    async getReceiptBlob(paymentId) {
        return new Promise(async (resolve, reject) => {
            try {
                const payment = await db.payments.get(paymentId);
                const parent = await db.parents.get(payment.parentId);
                let settings = { receiptNoX: 0.44, receiptNoY: 0.323, startX: 0.52, nameY: 0.473, monthY: 0.527, amountY: 0.582, wordsY: 0.638, dateY: 0.693, methodY: 0.748, remarksY: 0.803, template: 'receipt-template.png' };
                try {
                    let globalSaved = await db.settings.get('receiptSettings');
                    if (!globalSaved) {
                        const localSaved = localStorage.getItem('receiptSettings');
                        if(localSaved) { globalSaved = JSON.parse(localSaved); await db.settings.set('receiptSettings', globalSaved); }
                    }
                    if(globalSaved) settings = { ...settings, ...globalSaved };
                } catch(e) {}
                
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width; canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    const w = canvas.width; const h = canvas.height;
                    ctx.font = `600 ${w * 0.024}px "Outfit", sans-serif`;
                    ctx.fillStyle = '#0f172a'; ctx.textAlign = 'left';
                    ctx.fillText(payment.receiptNo, w * settings.receiptNoX, h * settings.receiptNoY);
                    const lines = [
                        { y: settings.nameY, text: parent.parentName }, { y: settings.monthY, text: payment.receiptMonthOverride || formatMonthYear(payment.month) },
                        { y: settings.amountY, text: `Rs. ${payment.amount}/-` }, { y: settings.wordsY, text: App.amountToWords(payment.amount) },
                        { y: settings.dateY, text: formatDate(payment.date) }, { y: settings.methodY, text: payment.method },
                        { y: settings.remarksY, text: payment.remarks || 'Jazakkallah', isRemarks: true }
                    ];
                    lines.forEach(line => {
                        ctx.fillStyle = line.isRemarks ? '#16a34a' : '#0f172a';
                        ctx.fillText(line.text, w * settings.startX, h * line.y);
                    });
                    canvas.toBlob(resolve, 'image/jpeg', 0.95);
                };
                img.onerror = () => reject(new Error("Template image invalid"));
                img.src = settings.template;
            } catch (err) { reject(err); }
        });
    },

    async openWhatsApp(paymentId) {
        const payment = await db.payments.get(paymentId);
        const parent = await db.parents.get(payment.parentId);
        
        await db.payments.update(paymentId, { textSent: true, receiptSent: true });
        const activeNav = document.querySelector('.nav-item.active');
        if (activeNav) App.renderPage(activeNav.dataset.target);
        
        window.open(`https://wa.me/${parent.whatsappNumber}`, '_blank');
    },

    async viewReceipt(paymentId) {
        const payment = await db.payments.get(paymentId);
        const parent = await db.parents.get(payment.parentId);
        const cls = await db.classes.get(parent.classId);
        
        const isUploaded = !!payment.receiptUrl;
        
        const content = `
            <div style="border: 1px dashed var(--border-color); padding: 20px; border-radius: 12px; margin-bottom: 20px; text-align: center;">
                <h4 style="margin-bottom: 4px;">Madrassa Management</h4>
                <p class="text-muted" style="font-size: 0.8em; margin-bottom: 12px;">Payment Receipt</p>
                <div class="flex justify-between" style="text-align: left; font-size: 0.9em; margin-bottom: 8px;">
                    <span>Receipt No:</span>
                    <strong>${payment.receiptNo}</strong>
                </div>
                <div class="flex justify-between" style="text-align: left; font-size: 0.9em; margin-bottom: 8px;">
                    <span>Date:</span>
                    <strong>${formatDate(payment.date)}</strong>
                </div>
                <div class="flex justify-between" style="text-align: left; font-size: 0.9em; margin-bottom: 8px;">
                    <span>Parent:</span>
                    <strong>${parent.parentName}</strong>
                </div>
                <div class="flex justify-between" style="text-align: left; font-size: 0.9em; margin-bottom: 8px;">
                    <span>Class:</span>
                    <strong>${cls.name}</strong>
                </div>
                <div class="flex justify-between" style="text-align: left; font-size: 0.9em; margin-bottom: 8px;">
                    <span>Month:</span>
                    <strong>${payment.receiptMonthOverride || formatMonthYear(payment.month)}</strong>
                </div>
                <hr style="border: none; border-top: 1px dashed var(--border-color); margin: 12px 0;">
                <div class="flex justify-between" style="text-align: left; font-size: 1.1em; color: var(--success);">
                    <span>Amount Paid:</span>
                    <strong>₹${payment.amount} (${payment.method})</strong>
                </div>
            </div>
            
            <div class="flex gap-4" style="flex-direction: column;">
                <button class="btn btn-primary" style="background: #25D366; border: none;" onclick="App.openWhatsApp('${paymentId}')">
                    <i data-lucide="message-circle"></i> Open WhatsApp
                </button>
                <button class="btn btn-secondary" onclick="App.generateJPG('${paymentId}')">
                    <i data-lucide="download"></i> Download JPG
                </button>
                <button class="btn" style="border: 1px solid var(--danger); color: var(--danger); background: transparent;" onclick="App.undoPayment('${paymentId}')">
                    <i data-lucide="undo"></i> Undo Payment
                </button>
                <button class="btn btn-secondary" id="backToPaymentsBtn" style="border-color: var(--text-muted); color: var(--text-main);">
                    <i data-lucide="arrow-left"></i> Back
                </button>
            </div>
        `;
        
        UI.openModal('Receipt', content, (modal, closeFunc) => {
            const backBtn = modal.querySelector('#backToPaymentsBtn');
            if(backBtn) {
                backBtn.addEventListener('click', closeFunc);
            }
        });
    },

    async showPastDues(parentId) {
        const currentMonth = getActiveMonth();
        const parent = await db.parents.get(parentId);
        if (!parent) return;

        const allPending = await db.payments.where('status').equals('Pending').toArray();
        const pastPending = allPending.filter(p => p.parentId === parentId && p.month < currentMonth);

        // Sort by oldest month first
        pastPending.sort((a, b) => a.month.localeCompare(b.month));

        if (pastPending.length === 0) {
            UI.showToast('No past dues found for this parent.', 'info');
            return;
        }

        let totalDue = 0;
        let listHtml = pastPending.map(p => {
            totalDue += Number(parent.monthlyFee);
            return `
                <div class="list-item" style="padding: 12px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; border-left: 3px solid var(--warning);">
                    <div>
                        <h4 style="margin: 0;">${formatMonthYear(p.month)}</h4>
                        <p style="margin: 0; font-size: 0.8em; color: var(--text-muted);">₹${parent.monthlyFee}</p>
                    </div>
                    <button class="btn btn-primary" style="padding: 6px 12px; font-size: 0.8rem;" onclick="
                        const modals = document.querySelectorAll('.modal-backdrop');
                        if (modals.length > 0) { modals[modals.length - 1].querySelector('.close-btn').click(); }
                        App.recordPayment('${p.id}');
                    ">
                        Pay Now
                    </button>
                </div>
            `;
        }).join('');

        const content = `
            <div style="margin-bottom: 16px;">
                <p style="margin: 0; color: var(--text-muted); font-size: 0.9em;">Outstanding Months</p>
                <h2 style="margin: 4px 0 0 0; color: var(--danger);">Total: ₹${totalDue}</h2>
            </div>
            <div style="max-height: 400px; overflow-y: auto; padding-right: 4px;">
                ${listHtml}
            </div>
        `;

        UI.openModal(`Past Dues: ${parent.parentName}`, content);
    },

    // --- WHATSAPP & PDF ---
    async sendBulkReminders() {
        const currentMonth = getActiveMonth();
        const payments = await db.payments.where({month: currentMonth, status: 'Pending'}).toArray();
        if(payments.length === 0) {
            UI.showToast('No pending payments for this month!', 'info');
            return;
        }
        
        const content = `
            <p>There are <strong>${payments.length}</strong> pending payments for ${currentMonth}.</p>
            <p class="text-muted" style="font-size: 0.9em; margin-bottom: 20px;">Currently, WhatsApp requires sending messages one by one. Click below to start messaging the first pending parent.</p>
            <div id="reminderQueue"></div>
        `;
        
        UI.openModal('Send Reminders', content, async (modal) => {
            const queueContainer = modal.querySelector('#reminderQueue');
            // Show the first 5 to avoid overwhelming
            let html = '';
            for(let i=0; i < Math.min(payments.length, 5); i++) {
                const parent = await db.parents.get(payments[i].parentId);
                const cls = await db.classes.get(parent.classId);
                const msg = encodeURIComponent(`Assalamu Alaikum.\n\nThis is a gentle reminder that the Madrassa monthly fee for *${currentMonth}* is still pending.\n\nParent: ${parent.parentName}\nClass: ${cls.name}\nMonthly Fee: ₹${parent.monthlyFee}\n\nKindly make the payment at your earliest convenience.\n\nJazakumullahu Khair.`);
                
                html += `
                    <a href="https://wa.me/${parent.whatsappNumber}?text=${msg}" target="_blank" class="btn btn-secondary mb-4" style="display: flex; text-decoration: none;" onclick="this.style.opacity='0.5';">
                        <i data-lucide="send"></i> Send to ${parent.parentName}
                    </a>
                `;
            }
            if(payments.length > 5) html += `<p class="text-center text-muted">...and ${payments.length - 5} more.</p>`;
            queueContainer.innerHTML = html;
            lucide.createIcons({root: queueContainer});
        });
    },

    async generateJPG(paymentId) {
        try {
            const payment = await db.payments.get(paymentId);
            const parent = await db.parents.get(payment.parentId);
            const cls = await db.classes.get(parent.classId);
            
            let settings = {
                receiptNoX: 0.44, receiptNoY: 0.323,
                startX: 0.52,
                nameY: 0.473, monthY: 0.527, amountY: 0.582, wordsY: 0.638,
                dateY: 0.693, methodY: 0.748, remarksY: 0.803,
                template: 'receipt-template.png'
            };
            
            try {
                let globalSaved = await db.settings.get('receiptSettings');
                if (!globalSaved) {
                    const localSaved = localStorage.getItem('receiptSettings');
                    if(localSaved) {
                        globalSaved = JSON.parse(localSaved);
                        await db.settings.set('receiptSettings', globalSaved);
                    }
                }
                if(globalSaved) settings = { ...settings, ...globalSaved };
            } catch(e) {}
            
            const templateSrc = settings.template;
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                const w = canvas.width;
                const h = canvas.height;
                const fontSize = w * 0.024;
                ctx.font = `600 ${fontSize}px "Outfit", sans-serif`;
                ctx.fillStyle = '#0f172a';
                ctx.textAlign = 'left';
                
                ctx.fillText(payment.receiptNo, w * settings.receiptNoX, h * settings.receiptNoY);
                
                const startX = w * settings.startX;
                const lines = [
                    { y: settings.nameY, text: parent.parentName },
                    { y: settings.monthY, text: payment.receiptMonthOverride || formatMonthYear(payment.month) },
                    { y: settings.amountY, text: `Rs. ${payment.amount}/-` },
                    { y: settings.wordsY, text: App.amountToWords(payment.amount) },
                    { y: settings.dateY, text: formatDate(payment.date) },
                    { y: settings.methodY, text: payment.method },
                    { y: settings.remarksY, text: payment.remarks || 'Jazakkallah', isRemarks: true }
                ];
                
                lines.forEach(line => {
                    if (line.isRemarks) {
                        ctx.fillStyle = '#16a34a'; // Green
                    } else {
                        ctx.fillStyle = '#0f172a';
                    }
                    ctx.fillText(line.text, startX, h * line.y);
                });
                
                const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
                
                const link = document.createElement('a');
                link.href = dataUrl;
                link.download = `${payment.receiptNo}.jpg`;
                link.click();
                UI.showToast("Receipt Downloaded");
            };
            
            img.onerror = () => {
                UI.showToast("Template image not found or invalid!", "error");
            };
            
            img.src = templateSrc;
            
        } catch(err) {
            console.error(err);
            UI.showToast("Error generating JPG", "error");
        }
    },

    async exportReceiptsPDF() {
        try {
            const currentMonth = getActiveMonth();
            const payments = await db.payments.where('month').equals(currentMonth).toArray();
            const paidPayments = payments.filter(p => p.status === 'Paid' && p.receiptNo);

            if (paidPayments.length === 0) {
                UI.showToast('No paid receipts found for this month.', 'info');
                return;
            }

            // Sort by receipt number numerically
            paidPayments.sort((a, b) => {
                const numA = parseInt(a.receiptNo.replace(/\D/g, '')) || 0;
                const numB = parseInt(b.receiptNo.replace(/\D/g, '')) || 0;
                return numA - numB;
            });

            UI.showToast(`Generating PDF for ${paidPayments.length} receipts... Please wait.`);

            let settings = {
                receiptNoX: 0.44, receiptNoY: 0.323,
                startX: 0.52,
                nameY: 0.473, monthY: 0.527, amountY: 0.582, wordsY: 0.638,
                dateY: 0.693, methodY: 0.748, remarksY: 0.803,
                template: 'receipt-template.png'
            };
            
            try {
                let globalSaved = await db.settings.get('receiptSettings');
                if(globalSaved) settings = { ...settings, ...globalSaved };
            } catch(e) {}
            
            const templateSrc = settings.template;
            const img = new Image();
            img.crossOrigin = 'anonymous';

            img.onload = async () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                
                const orientation = img.width > img.height ? 'landscape' : 'portrait';
                const pdf = new window.jspdf.jsPDF(orientation, 'px', [img.width, img.height]);

                for (let i = 0; i < paidPayments.length; i++) {
                    const payment = paidPayments[i];
                    const parent = await db.parents.get(payment.parentId);
                    
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    
                    const w = canvas.width;
                    const h = canvas.height;
                    const fontSize = w * 0.024;
                    ctx.font = `600 ${fontSize}px "Outfit", sans-serif`;
                    ctx.textAlign = 'left';
                    
                    ctx.fillStyle = '#0f172a';
                    ctx.fillText(payment.receiptNo, w * settings.receiptNoX, h * settings.receiptNoY);
                    
                    const startX = w * settings.startX;
                    const lines = [
                        { y: settings.nameY, text: parent.parentName },
                        { y: settings.monthY, text: payment.receiptMonthOverride || formatMonthYear(payment.month) },
                        { y: settings.amountY, text: `Rs. ${payment.amount}/-` },
                        { y: settings.wordsY, text: App.amountToWords(payment.amount) },
                        { y: settings.dateY, text: formatDate(payment.date) },
                        { y: settings.methodY, text: payment.method },
                        { y: settings.remarksY, text: payment.remarks || 'Jazakkallah', isRemarks: true }
                    ];
                    
                    lines.forEach(line => {
                        ctx.fillStyle = line.isRemarks ? '#16a34a' : '#0f172a';
                        ctx.fillText(line.text, startX, h * line.y);
                    });
                    
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                    
                    if (i > 0) pdf.addPage([img.width, img.height], orientation);
                    pdf.addImage(dataUrl, 'JPEG', 0, 0, img.width, img.height);
                }
                
                pdf.save(`Receipts_${currentMonth}.pdf`);
                UI.showToast('PDF Export Complete!');
            };
            img.src = templateSrc;
        } catch(e) {
            UI.showToast(e.message, 'error');
        }
    },

    amountToWords(num) {
        if(num === 0) return 'Zero Only';
        const a = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
        const b = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
        
        let n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
        if (!n) return ''; 
        let str = '';
        str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + ' Crore ' : '';
        str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + ' Lakh ' : '';
        str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + ' Thousand ' : '';
        str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + ' Hundred ' : '';
        str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
        return str.trim() + ' Only';
    },

    // --- SETTINGS ---
    async renderSettings(container) {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const lucideIcon = currentTheme === 'dark' ? 'sun' : 'moon';

        container.innerHTML = `
            <div style="margin-bottom: 20px; text-align: center;">
                <h2 style="margin-bottom: 16px;">Settings</h2>
            </div>
            
            <div class="card mt-4">
                <h3>App Preferences</h3>
                <div class="flex justify-between align-center mt-2">
                    <span style="font-weight: 500;">Dark Mode</span>
                    <button class="btn btn-secondary" style="width: auto; padding: 8px 16px;" onclick="App.toggleTheme()">
                        <span id="theme-toggle-container" style="display: flex; align-items: center; justify-content: center;"><i data-lucide="${lucideIcon}" id="theme-icon-settings"></i></span> Toggle
                    </button>
                </div>
            </div>

            <div class="card mt-4">
                <h3>Reports & Exports</h3>
                <p class="text-muted mb-4">Download comprehensive reports in XLSX or PDF format.</p>
                
                <div class="flex gap-4" style="flex-direction: column;">
                    <button class="btn btn-secondary" onclick="App.exportParents()">
                        <i data-lucide="users"></i> Export All Parents (Excel)
                    </button>
                    <button class="btn btn-secondary" onclick="App.openExportPaymentsModal()">
                        <i data-lucide="table"></i> Export This Month Payments (Excel)
                    </button>
                    <button class="btn btn-secondary" style="background: var(--primary-600); color: white; border: none;" onclick="App.exportReceiptsPDF()">
                        <i data-lucide="file-down"></i> Export All Receipts PDF (Current Month)
                    </button>
                </div>
            </div>
            
            <div class="card mt-4" style="border: 1px solid var(--danger); background: rgba(239, 68, 68, 0.05);">
                <h3 style="color: var(--danger);">Danger Zone</h3>
                <p class="text-muted mb-4">Permanently delete all parents and payment records. This cannot be undone.</p>
                <button class="btn" style="background: var(--danger); color: white; box-shadow: 0 4px 10px rgba(239, 68, 68, 0.3);" onclick="App.clearDatabase()">
                    <i data-lucide="trash-2"></i> Clear Database Completely
                </button>
            </div>
        `;
        
        lucide.createIcons({ root: container });
    },

    async clearDatabase() {
        if(!confirm("⚠️ WARNING: Are you absolutely sure you want to delete ALL parents and ALL payments? This action CANNOT be undone!")) return;
        
        const secondConfirm = prompt("Please type 'DELETE' to confirm.");
        if(secondConfirm !== 'DELETE') {
            UI.showToast("Action cancelled.", "info");
            return;
        }
        
        try {
            await db.parents.clear();
            await db.payments.clear();
            UI.showToast("Database cleared successfully", "success");
            App.renderPage('dashboard');
        } catch(err) {
            console.error(err);
            UI.showToast("Failed to clear database", "error");
        }
    },

    async exportParents() {
        const parents = await db.parents.toArray();
        const classes = await db.classes.toArray();
        
        const data = parents.map(p => {
            const cls = classes.find(c => c.id === p.classId) || {};
            return {
                'Parent Name': p.parentName,
                'Student Name': p.studentName || '-',
                'Class': cls.name,
                'WhatsApp': p.whatsappNumber,
                'Monthly Fee': p.monthlyFee
            };
        });
        
        this.downloadExcel(data, 'Parents_List.xlsx');
    },
    openExportPaymentsModal() {
        const content = `
            <p>Select which payments to include in the export for the current month:</p>
            <div class="flex gap-4" style="flex-direction: column; margin-top: 16px;">
                <button class="btn btn-primary" onclick="App.exportPayments('Pending'); document.querySelector('.modal-close').click()">
                    <i data-lucide="clock"></i> Export Pending Only
                </button>
                <button class="btn btn-primary" style="background: var(--success); border-color: var(--success);" onclick="App.exportPayments('Paid'); document.querySelector('.modal-close').click()">
                    <i data-lucide="check-circle"></i> Export Paid Only
                </button>
                <button class="btn btn-secondary" onclick="App.exportPayments('All'); document.querySelector('.modal-close').click()">
                    <i data-lucide="list"></i> Export All
                </button>
            </div>
        `;
        UI.openModal('Export Payments', content);
    },

    async exportPayments(filterType = 'All') {
        const currentMonth = getActiveMonth();
        let payments = await db.payments.where('month').equals(currentMonth).toArray();
        
        if (filterType !== 'All') {
            payments = payments.filter(p => p.status === filterType);
        }
        
        if (payments.length === 0) {
            UI.showToast('No records found for this filter.', 'info');
            return;
        }
        
        const parents = await db.parents.toArray();
        const classes = await db.classes.toArray();
        
        const data = payments.map(pay => {
            const parent = parents.find(p => p.id === pay.parentId) || {};
            const cls = classes.find(c => c.id === parent.classId) || {};
            return {
                'Receipt No': pay.receiptNo || '-',
                'Parent': parent.parentName,
                'Class': cls.name,
                'Status': pay.status,
                'Amount': pay.amount || 0,
                'Method': pay.method || '-',
                'Date': pay.date ? formatDate(pay.date) : '-'
            };
        });
        
        this.downloadExcel(data, `Payments_${currentMonth}_${filterType}.xlsx`);
    },

    downloadExcel(jsonArray, fileName) {
        if(!window.XLSX) {
            UI.showToast("Excel library not loaded", "error");
            return;
        }
        const worksheet = XLSX.utils.json_to_sheet(jsonArray);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
        XLSX.writeFile(workbook, fileName);
        UI.showToast("Exported Successfully!");
    },

    formatPosterDate(rawString) {
        if (!rawString) return '';
        const d = new Date(rawString);
        if (isNaN(d.getTime())) return rawString;
        return `Last Updated on ${d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true })}`;
    },

    async openPosterGeneratorModal() {
        let savedDateRaw = '';
        try {
            const saved = await db.settings.get('posterSettings');
            if (saved && saved.dateRaw) savedDateRaw = saved.dateRaw;
            else {
                const local = localStorage.getItem('posterSettings');
                if (local) {
                    const parsed = JSON.parse(local);
                    if (parsed.dateRaw) savedDateRaw = parsed.dateRaw;
                }
            }
        } catch(e) {}
        
        if (!savedDateRaw) {
            const now = new Date();
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            savedDateRaw = now.toISOString().slice(0,16);
        }
        
        const content = `
            <div class="form-group">
                <label>Last Updated Date & Time</label>
                <input type="datetime-local" id="posterDateInput" class="form-control" value="${savedDateRaw}">
            </div>
            
            <div class="flex gap-4" style="flex-direction: column; margin-top: 16px;">
                <button class="btn btn-primary" style="background: var(--primary-600); color: white; border: none;" onclick="App.generateStatusPoster(document.getElementById('posterDateInput').value)">
                    <i data-lucide="download"></i> Download Poster
                </button>
                <button class="btn btn-secondary" onclick="App.openPosterSettingsModal()">
                    <i data-lucide="settings"></i> Edit Poster Template
                </button>
            </div>
        `;
        UI.openModal('Status Poster', content);
    },

    async openPosterSettingsModal() {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        const defaultRaw = now.toISOString().slice(0,16);
        
        let settings = {
            template: '',
            dateRaw: defaultRaw,
            chartX: 0.5, chartY: 0.65, chartScale: 1.0,
            boxX: 0.5, boxY: 0.1,
            dateX: 0.5, dateY: 0.9,
            paidColor: '#16a34a', pendingColor: '#ef4444'
        };
        try {
            let saved = await db.settings.get('posterSettings');
            if (!saved) {
                const local = localStorage.getItem('posterSettings');
                if(local) saved = JSON.parse(local);
            }
            if(saved) settings = { ...settings, ...saved };
        } catch(e) {}
        
        const content = `
            <form id="posterSettingsForm">
                <div class="form-group">
                    <label>Poster Template Image</label>
                    <div style="display: flex; gap: 8px;">
                        <input type="file" id="posterTemplateUpload" accept="image/png, image/jpeg" class="form-control" style="padding: 4px; flex: 1;">
                        <button type="button" class="btn btn-secondary" id="clearPosterBtn" title="Clear Image" style="width: auto; padding: 0 12px; border-color: var(--danger); color: var(--danger);">
                            <i data-lucide="trash-2" style="margin: 0; width: 18px; height: 18px;"></i>
                        </button>
                    </div>
                </div>
                <h4 style="margin-top: 16px; margin-bottom: 8px; border-bottom: 1px solid var(--border-color); padding-bottom: 4px;">Alignment Settings (Multiplier 0.0 - 1.0)</h4>
                <div class="form-group">
                    <label>Date & Time</label>
                    <input type="datetime-local" name="dateRaw" class="form-control" value="${settings.dateRaw}">
                </div>
                <div class="metrics-grid" style="grid-template-columns: 1fr 1fr; gap: 8px;">
                    <div class="form-group"><label>Chart Group X</label><input type="number" step="0.01" name="chartX" class="form-control" value="${settings.chartX}"></div>
                    <div class="form-group"><label>Chart Group Y</label><input type="number" step="0.01" name="chartY" class="form-control" value="${settings.chartY}"></div>
                    <div class="form-group" style="grid-column: span 2;"><label>Chart Size Scale (1.0 is default)</label><input type="number" step="0.05" name="chartScale" class="form-control" value="${settings.chartScale}"></div>
                    <div class="form-group"><label>Month Title X</label><input type="number" step="0.01" name="boxX" class="form-control" value="${settings.boxX}"></div>
                    <div class="form-group"><label>Month Title Y</label><input type="number" step="0.01" name="boxY" class="form-control" value="${settings.boxY}"></div>
                    <div class="form-group"><label>Date Text X</label><input type="number" step="0.01" name="dateX" class="form-control" value="${settings.dateX}"></div>
                    <div class="form-group"><label>Date Text Y</label><input type="number" step="0.01" name="dateY" class="form-control" value="${settings.dateY}"></div>
                </div>
                
                <h4 style="margin-top: 16px; margin-bottom: 8px;">Live Preview</h4>
                <div style="border: 1px dashed var(--border-color); padding: 4px; text-align: center; border-radius: 8px; background: var(--bg-color);">
                    <canvas id="posterPreviewCanvas" style="max-width: 100%; height: auto; max-height: 250px; background: #fff;"></canvas>
                </div>
                
                <button type="submit" class="btn btn-primary" style="margin-top: 16px; width: 100%;">Save Settings</button>
            </form>
        `;
        
        UI.openModal('Edit Poster Template', content, (modal, closeFunc) => {
            const form = modal.querySelector('#posterSettingsForm');
            const fileInput = modal.querySelector('#posterTemplateUpload');
            const canvas = modal.querySelector('#posterPreviewCanvas');
            const ctx = canvas.getContext('2d');
            
            let currentTemplateSrc = settings.template;
            
            const drawPreview = () => {
                const fd = new FormData(form);
                const cx = Number(fd.get('chartX')) || 0.5;
                const cy = Number(fd.get('chartY')) || 0.65;
                const cs = Number(fd.get('chartScale')) || 1.0;
                const bx = Number(fd.get('boxX')) || 0.5;
                const by = Number(fd.get('boxY')) || 0.1;
                const dx = Number(fd.get('dateX')) || 0.5;
                const dy = Number(fd.get('dateY')) || 0.9;
                const dText = App.formatPosterDate(fd.get('dateRaw'));
                
                if (currentTemplateSrc) {
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.onload = () => {
                        canvas.width = img.width;
                        canvas.height = img.height;
                        const w = canvas.width;
                        const h = canvas.height;
                        
                        ctx.drawImage(img, 0, 0, w, h);
                        
                        const maxBarH = h * 0.4 * cs;
                        const barW = w * 0.12 * cs;
                        const gap = w * 0.04 * cs;
                        const centerX = w * cx;
                        const bottomY = h * cy;
                        
                        // Month Title Box
                        const dateObj = fd.get('dateRaw') ? new Date(fd.get('dateRaw')) : new Date();
                        const titleTxt = dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });
                        ctx.font = `bold ${w * 0.035}px "Outfit", sans-serif`;
                        ctx.fillStyle = '#000000';
                        ctx.textAlign = 'center';
                        ctx.fillText(titleTxt, w * bx, h * by);
                        
                        // Dummy data (70% Paid, 30% Unpaid)
                        const paidPerc = 70;
                        const pendingPerc = 30;
                        
                        const paidH = (paidPerc / 100) * maxBarH;
                        const paidX = centerX - barW - (gap / 2);
                        const paidY = bottomY - paidH;
                        
                        const unpaidH = (pendingPerc / 100) * maxBarH;
                        const unpaidX = centerX + (gap / 2);
                        const unpaidY = bottomY - unpaidH;
                        
                        // Draw Underline Base
                        ctx.beginPath();
                        ctx.moveTo(centerX - barW * 1.5, bottomY);
                        ctx.lineTo(centerX + barW * 1.5, bottomY);
                        ctx.strokeStyle = '#334155';
                        ctx.lineWidth = Math.max(2, h * 0.003);
                        ctx.stroke();
                        
                        // Draw Paid
                        ctx.fillStyle = settings.paidColor;
                        ctx.fillRect(paidX, paidY, barW, paidH);
                        
                        // Draw Unpaid
                        ctx.fillStyle = settings.pendingColor;
                        ctx.fillRect(unpaidX, unpaidY, barW, unpaidH);
                        
                        ctx.textAlign = 'center';
                        const fontPerc = w * 0.035 * cs;
                        
                        // Percentage on top
                        ctx.font = `bold ${fontPerc}px "Outfit", sans-serif`;
                        ctx.fillStyle = settings.paidColor;
                        ctx.fillText(`${paidPerc}%`, paidX + (barW / 2), paidY - (h * 0.02));
                        
                        ctx.fillStyle = settings.pendingColor;
                        ctx.fillText(`${pendingPerc}%`, unpaidX + (barW / 2), unpaidY - (h * 0.02));
                        
                        // Counts below
                        ctx.font = `600 ${fontPerc * 0.7}px "Outfit", sans-serif`;
                        ctx.fillStyle = settings.paidColor;
                        ctx.fillText("70 Paid", paidX + (barW / 2), bottomY + (h * 0.04));
                        
                        ctx.fillStyle = settings.pendingColor;
                        ctx.fillText("30 Unpaid", unpaidX + (barW / 2), bottomY + (h * 0.04));
                        
                        // Date
                        ctx.font = `500 ${fontPerc * 0.6}px "Outfit", sans-serif`;
                        ctx.fillStyle = '#64748b';
                        ctx.fillText(dText, w * dx, h * dy);
                    };
                    img.onerror = () => {
                        canvas.width = 400; canvas.height = 200;
                        ctx.clearRect(0,0,400,200);
                        ctx.font = '16px sans-serif';
                        ctx.fillText("Image Error", 150, 100);
                    };
                    img.src = currentTemplateSrc;
                } else {
                    canvas.width = 400; canvas.height = 200;
                    ctx.clearRect(0,0,400,200);
                    ctx.font = '16px sans-serif';
                    ctx.fillText("No Template Uploaded", 120, 100);
                }
            };
            
            drawPreview();
            
            form.querySelectorAll('input').forEach(inp => {
                if(inp.type !== 'file') inp.addEventListener('input', drawPreview);
            });
            
            const clearBtn = modal.querySelector('#clearPosterBtn');
            clearBtn.addEventListener('click', () => {
                currentTemplateSrc = '';
                fileInput.value = '';
                drawPreview();
            });

            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if(file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        currentTemplateSrc = ev.target.result;
                        drawPreview();
                    };
                    reader.readAsDataURL(file);
                }
            });
            
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const fd = new FormData(e.target);
                const newSettings = {
                    template: currentTemplateSrc,
                    dateRaw: fd.get('dateRaw'),
                    chartX: Number(fd.get('chartX')), chartY: Number(fd.get('chartY')), chartScale: Number(fd.get('chartScale')),
                    boxX: Number(fd.get('boxX')), boxY: Number(fd.get('boxY')),
                    dateX: Number(fd.get('dateX')), dateY: Number(fd.get('dateY')),
                    paidColor: settings.paidColor, pendingColor: settings.pendingColor
                };
                try {
                    await db.settings.set('posterSettings', newSettings);
                } catch (e) { console.error('DB set error', e); }
                
                try {
                    localStorage.setItem('posterSettings', JSON.stringify(newSettings));
                } catch(e) { console.warn('localStorage full', e); }
                
                UI.showToast("Poster settings saved!");
                closeFunc();
            });
        });
    },

    async generateStatusPoster(dateText) {
        let settings = {
            template: '',
            chartX: 0.5, chartY: 0.65, chartScale: 1.0,
            boxX: 0.5, boxY: 0.1,
            dateX: 0.5, dateY: 0.9,
            paidColor: '#16a34a', pendingColor: '#ef4444'
        };
        try {
            let saved = await db.settings.get('posterSettings');
            if (!saved) {
                const local = localStorage.getItem('posterSettings');
                if(local) saved = JSON.parse(local);
            }
            if(saved) settings = { ...settings, ...saved };
        } catch(e) {}
        
        if (!settings.template) {
            UI.showToast("Please upload a Poster Template first in settings.", "error");
            return;
        }
        
        UI.showToast("Generating poster...");
        
        const currentMonth = getActiveMonth();
        const payments = await db.payments.where('month').equals(currentMonth).toArray();
        let paidCount = 0;
        let pendingCount = 0;
        
        // Count from all active parents to get true pending status for the month
        const parents = await db.parents.toArray();
        parents.forEach(parent => {
            const pay = payments.find(p => p.parentId === parent.id);
            if (pay && pay.status === 'Paid') {
                paidCount++;
            } else {
                pendingCount++;
            }
        });
        
        const total = paidCount + pendingCount;
        const paidPerc = total === 0 ? 0 : Math.round((paidCount / total) * 100);
        const pendingPerc = total === 0 ? 0 : 100 - paidPerc;
        
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            const w = canvas.width;
            const h = canvas.height;
            
            ctx.drawImage(img, 0, 0, w, h);
            
            const cs = settings.chartScale || 1.0;
            const maxBarH = h * 0.4 * cs;
            const barW = w * 0.12 * cs;
            const gap = w * 0.04 * cs;
            const centerX = w * settings.chartX;
            const bottomY = h * settings.chartY;
            
            // Month Title Box
            const dateObj = dateText ? new Date(dateText) : new Date();
            const titleTxt = dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });
            ctx.font = `bold ${w * 0.035}px "Outfit", sans-serif`;
            ctx.fillStyle = '#000000';
            ctx.textAlign = 'center';
            ctx.fillText(titleTxt, w * settings.boxX, h * settings.boxY);
            
            const paidH = (paidPerc / 100) * maxBarH;
            const paidX = centerX - barW - (gap / 2);
            const paidY = bottomY - paidH;
            
            const unpaidH = (pendingPerc / 100) * maxBarH;
            const unpaidX = centerX + (gap / 2);
            const unpaidY = bottomY - unpaidH;
            
            // Draw Underline Base
            ctx.beginPath();
            ctx.moveTo(centerX - barW * 1.5, bottomY);
            ctx.lineTo(centerX + barW * 1.5, bottomY);
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = Math.max(2, h * 0.003);
            ctx.stroke();
            
            // Draw Green Paid Bar
            if (paidH > 0) {
                ctx.fillStyle = settings.paidColor;
                ctx.fillRect(paidX, paidY, barW, paidH);
            }
            // Draw Red Unpaid Bar
            if (unpaidH > 0) {
                ctx.fillStyle = settings.pendingColor;
                ctx.fillRect(unpaidX, unpaidY, barW, unpaidH);
            }
            
            ctx.textAlign = 'center';
            const fontPerc = w * 0.035 * cs;
            
            // Percentage on top
            ctx.font = `bold ${fontPerc}px "Outfit", sans-serif`;
            if (paidH > 0) {
                ctx.fillStyle = settings.paidColor;
                ctx.fillText(`${paidPerc}%`, paidX + (barW / 2), paidY - (h * 0.02));
            }
            if (unpaidH > 0) {
                ctx.fillStyle = settings.pendingColor;
                ctx.fillText(`${pendingPerc}%`, unpaidX + (barW / 2), unpaidY - (h * 0.02));
            }
            
            // Counts below
            ctx.font = `600 ${fontPerc * 0.7}px "Outfit", sans-serif`;
            ctx.fillStyle = settings.paidColor;
            ctx.fillText(`${paidCount} Paid`, paidX + (barW / 2), bottomY + (h * 0.04));
            
            ctx.fillStyle = settings.pendingColor;
            ctx.fillText(`${pendingCount} Unpaid`, unpaidX + (barW / 2), bottomY + (h * 0.04));
            
            // Date
            ctx.font = `500 ${fontPerc * 0.6}px "Outfit", sans-serif`;
            ctx.fillStyle = '#64748b';
            const dText = App.formatPosterDate(dateText); // Using dateText argument which is raw date string from input
            ctx.fillText(dText, w * settings.dateX, h * settings.dateY);
            
            const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `Status_Poster_${currentMonth}.jpg`;
            link.click();
            UI.showToast("Poster Downloaded Successfully!");
        };
        img.onerror = () => {
            UI.showToast("Template image not found or invalid!", "error");
        };
        img.src = settings.template;
    }
};

// Boot
window.addEventListener('DOMContentLoaded', () => {
    App.init();
});
