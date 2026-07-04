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
                case 'reports': await this.renderReports(main); break;
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
        const iconBtn = document.getElementById('theme-icon');
        if (iconBtn) {
            iconBtn.setAttribute('data-lucide', theme === 'dark' ? 'sun' : 'moon');
            lucide.createIcons({ root: document.getElementById('theme-toggle') });
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
        
        const paidButNotSent = paid.filter(p => !p.receiptSent);
        
        const collectedAmount = paid.reduce((sum, p) => sum + Number(p.amount), 0);
        
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
            <div class="flex justify-between align-center mb-4">
                <div class="flex align-center gap-2">
                    <h2 style="margin: 0;">Dashboard</h2>
                    ${paidButNotSent.length > 0 ? `
                        <button class="btn" style="padding: 6px; width: 36px; height: 36px; border-radius: 50%; position: relative; background: #25D366; border: none; color: white; display: flex; align-items: center; justify-content: center; cursor: pointer;" onclick="App.openUnsentReceiptsModal()" title="View Pending Receipts">
                            <i data-lucide="bell" style="margin: 0; width: 18px; height: 18px;"></i>
                            <span style="position: absolute; top: -4px; right: -4px; background: var(--danger); color: white; border-radius: 50%; font-size: 10px; font-weight: bold; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">${paidButNotSent.length}</span>
                        </button>
                    ` : ''}
                </div>
                <div class="flex gap-2 align-center">
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
                    <div class="metric-value">₹${collectedAmount}</div>
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

    async proceedToNextMonth() {
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
        const unsent = paymentsThisMonth.filter(p => p.status === 'Paid' && !p.receiptSent);
        if(unsent.length === 0) {
            UI.showToast('No pending receipts to send!', 'info');
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
            <p class="text-muted" style="font-size: 0.9em; margin-bottom: 16px;">Click the WhatsApp icon to generate and send the receipt.</p>
            <div id="unsentReceiptsList">
                ${unsentList.map(item => `
                    <div class="list-item" style="padding: 12px; margin-bottom: 8px;">
                        <div class="list-item-content">
                            <h4 style="margin: 0; font-size: 1rem;">${item.parent.parentName}</h4>
                            <p style="margin: 0; font-size: 0.8rem; color: var(--text-muted);">${item.payment.receiptNo} • ₹${item.payment.amount}</p>
                        </div>
                        <button class="btn" style="width: 40px; height: 40px; padding: 0; border-radius: 50%; background: #25D366; box-shadow: 0 4px 10px rgba(37, 211, 102, 0.4); border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0;" onclick="App.generateJPG(${item.payment.id}, true); this.parentElement.style.opacity='0.5';" title="Send Receipt">
                            <i data-lucide="message-circle" style="width: 20px; height: 20px; color: white; margin: 0;"></i>
                        </button>
                    </div>
                `).join('')}
            </div>
        `;
        
        UI.openModal('Pending Receipts', content);
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
                <div onclick="App.filterByClass(${cls.id})" style="
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
            <div class="flex justify-between align-center mb-4">
                <h2>Parents Directory</h2>
                <button class="btn btn-primary" style="width: auto; padding: 8px 12px;" onclick="App.openAddParentModal()">
                    <i data-lucide="user-plus"></i> Add
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
            // Group by class
            for (const cls of classes) {
                if (window.currentClassFilter && window.currentClassFilter !== cls.id) continue;
                
                const classParents = parents.filter(p => p.classId === cls.id);
                if (classParents.length > 0) {
                    html += `<h4 class="mt-4 mb-2" style="color: var(--primary-600); border-bottom: 1px solid var(--border-color); padding-bottom: 4px;">${cls.name}</h4>`;
                    classParents.forEach(p => {
                        html += `
                            <div class="list-item parent-item" data-name="${p.parentName.toLowerCase()}" data-phone="${p.whatsappNumber}">
                                <div class="list-item-content">
                                    <h3>${p.parentName} ${p.studentName ? `<span style="font-weight: 300; font-size: 0.85em;">(${p.studentName})</span>` : ''}</h3>
                                    <p>${p.whatsappNumber} • ₹${p.monthlyFee}/mo</p>
                                </div>
                                <div class="flex gap-2" style="align-items: center;">
                                    <button class="btn btn-secondary" style="width: auto; padding: 6px;" onclick="App.editParent(${p.id})" title="Edit">
                                        <i data-lucide="edit-2" style="margin: 0; width: 16px; height: 16px;"></i>
                                    </button>
                                    <button class="btn btn-secondary" style="width: auto; padding: 6px; color: var(--danger); border-color: var(--danger);" onclick="App.deleteParent(${p.id})" title="Delete">
                                        <i data-lucide="trash-2" style="margin: 0; width: 16px; height: 16px;"></i>
                                    </button>
                                </div>
                            </div>
                        `;
                    });
                }
            }
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
                    <label>WhatsApp Number (with country code, e.g. 91XXXXXXXXXX) *</label>
                    <input type="text" name="whatsappNumber" class="form-control" required>
                </div>
                <div class="form-group">
                    <label>Monthly Fee (₹) *</label>
                    <input type="number" name="monthlyFee" class="form-control" required>
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
                        classId: Number(fd.get('classId')),
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
                    <label>WhatsApp Number *</label>
                    <input type="text" name="whatsappNumber" class="form-control" value="${parent.whatsappNumber}" required>
                </div>
                <div class="form-group">
                    <label>Monthly Fee (₹) *</label>
                    <input type="number" name="monthlyFee" class="form-control" value="${parent.monthlyFee}" required>
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
                        classId: Number(fd.get('classId')),
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
        const parents = await db.parents.toArray();
        const classes = await db.classes.toArray();
        
        // Map data
        const enriched = payments.map(pay => {
            const parent = parents.find(p => p.id === pay.parentId) || {};
            const cls = classes.find(c => c.id === parent.classId) || {};
            return { ...pay, parent, className: cls.name };
        }).filter(p => p.parent.id); // Valid ones
        
        // State for filters
        window.currentPaymentFilter = window.currentPaymentFilter || 'Pending';
        
        const renderList = (filter) => {
            window.currentPaymentFilter = filter;
            const filtered = enriched.filter(p => filter === 'All' || p.status === filter);
            
            let html = '';
            if(filtered.length === 0) html = `<p class="text-center text-muted mt-4">No records found.</p>`;
            
            filtered.forEach(p => {
                const isPaid = p.status === 'Paid';
                html += `
                    <div class="list-item" style="cursor:pointer">
                        <div class="list-item-content" onclick="${isPaid ? `App.viewReceipt(${p.id})` : `App.recordPayment(${p.id})`}" style="flex:1">
                            <h3>${p.parent.parentName}</h3>
                            <p>${p.className} • ₹${p.parent.monthlyFee}</p>
                        </div>
                        <div class="flex align-center gap-2">
                            <span class="badge ${isPaid ? 'badge-success' : 'badge-danger'}" onclick="${isPaid ? `App.viewReceipt(${p.id})` : `App.recordPayment(${p.id})`}">${p.status}</span>
                            ${isPaid ? `
                            <div class="flex gap-1">
                                <button class="btn btn-secondary" style="width: auto; padding: 6px;" onclick="event.stopPropagation(); App.editPayment(${p.id})" title="Edit Payment">
                                    <i data-lucide="edit-2" style="margin: 0; width: 16px; height: 16px;"></i>
                                </button>
                                <button class="btn btn-secondary" style="width: auto; padding: 6px; border-color: var(--danger); color: var(--danger);" onclick="event.stopPropagation(); App.undoPayment(${p.id})" title="Mark as Unpaid">
                                    <i data-lucide="undo" style="margin: 0; width: 16px; height: 16px;"></i>
                                </button>
                            </div>
                            ` : ''}
                            <i data-lucide="chevron-right" style="color: var(--text-muted); width: 16px;" onclick="${isPaid ? `App.viewReceipt(${p.id})` : `App.recordPayment(${p.id})`}"></i>
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
            }
            return html;
        };
        
        container.innerHTML = `
            <h2>Payments (${currentMonth})</h2>
            
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

    async recordPayment(paymentId) {
        const payment = await db.payments.get(paymentId);
        const parent = await db.parents.get(payment.parentId);
        
        const content = `
            <form id="recordPaymentForm">
                <div class="form-group">
                    <label>Amount Received (₹)</label>
                    <input type="number" name="amount" class="form-control" value="${parent.monthlyFee}" required>
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
                    const receiptNo = await generateReceiptNumber();
                    await db.payments.update(paymentId, {
                        status: 'Paid',
                        amount: Number(fd.get('amount')),
                        method: fd.get('method'),
                        date: fd.get('date'),
                        receiptNo: receiptNo
                    });
                    
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
                    <input type="number" name="amount" class="form-control" value="${payment.amount}" required>
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
                receiptSent: false
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

    async viewReceipt(paymentId) {
        const payment = await db.payments.get(paymentId);
        const parent = await db.parents.get(payment.parentId);
        const cls = await db.classes.get(parent.classId);
        
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
                    <strong>${payment.month}</strong>
                </div>
                <hr style="border: none; border-top: 1px dashed var(--border-color); margin: 12px 0;">
                <div class="flex justify-between" style="text-align: left; font-size: 1.1em; color: var(--success);">
                    <span>Amount Paid:</span>
                    <strong>₹${payment.amount} (${payment.method})</strong>
                </div>
            </div>
            
            <div class="flex gap-4" style="flex-direction: column;">
                <button class="btn btn-primary" onclick="App.generateJPG(${paymentId}, true)">
                    <i data-lucide="share-2"></i> Send via WhatsApp
                </button>
                <button class="btn btn-secondary" onclick="App.generateJPG(${paymentId}, false)">
                    <i data-lucide="download"></i> Download JPG
                </button>
                <button class="btn" style="border: 1px solid var(--danger); color: var(--danger); background: transparent;" onclick="App.undoPayment(${paymentId})">
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

    async generateJPG(paymentId, sendViaWhatsapp) {
        try {
            if(sendViaWhatsapp) {
                await db.payments.update(paymentId, { receiptSent: true });
                const activeNav = document.querySelector('.nav-item.active');
                if (activeNav) App.renderPage(activeNav.dataset.target);
            }
            const payment = await db.payments.get(paymentId);
            const parent = await db.parents.get(payment.parentId);
            const cls = await db.classes.get(parent.classId);
            
            const templateSrc = 'receipt-template.png';
            const img = new Image();
            
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
                
                ctx.fillText(payment.receiptNo, w * 0.44, h * 0.323);
                
                const startX = w * 0.52;
                const lines = [
                    { y: 0.473, text: parent.parentName },
                    { y: 0.527, text: payment.month },
                    { y: 0.582, text: `Rs. ${payment.amount}/-` },
                    { y: 0.638, text: App.amountToWords(payment.amount) },
                    { y: 0.693, text: formatDate(payment.date) },
                    { y: 0.748, text: payment.method },
                    { y: 0.803, text: payment.remarks || '-' }
                ];
                
                lines.forEach(line => {
                    ctx.fillText(line.text, startX, h * line.y);
                });
                
                const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
                
                if(sendViaWhatsapp) {
                    const link = document.createElement('a');
                    link.href = dataUrl;
                    link.download = `${payment.receiptNo}.jpg`;
                    link.click();
                    UI.showToast("JPG downloaded. Opening WhatsApp...");
                    setTimeout(() => {
                        const msg = encodeURIComponent(`Assalamu Alaikum.\n\nPlease find attached/below the fee receipt *${payment.receiptNo}* for ${payment.month}.\nAmount Paid: ₹${payment.amount}\n\nJazakumullahu Khair.`);
                        window.open(`https://wa.me/${parent.whatsappNumber}?text=${msg}`, '_blank');
                    }, 1000);
                } else {
                    const link = document.createElement('a');
                    link.href = dataUrl;
                    link.download = `${payment.receiptNo}.jpg`;
                    link.click();
                    UI.showToast("Receipt Downloaded");
                }
            };
            
            img.onerror = () => {
                UI.showToast("Template image not found!", "error");
            };
            
            img.src = templateSrc;
            
        } catch(err) {
            console.error(err);
            UI.showToast("Error generating JPG", "error");
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

    // --- REPORTS ---
    async renderReports(container) {
        container.innerHTML = `
            <h2>Reports & Exports</h2>
            <div class="card mt-4">
                <h3>Export to Excel</h3>
                <p class="text-muted mb-4">Download comprehensive reports in XLSX format.</p>
                
                <div class="flex gap-4" style="flex-direction: column;">
                    <button class="btn btn-secondary" onclick="App.exportParents()">
                        <i data-lucide="users"></i> Export All Parents
                    </button>
                    <button class="btn btn-secondary" onclick="App.exportPayments()">
                        <i data-lucide="receipt"></i> Export This Month Payments
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

    async exportPayments() {
        const currentMonth = getActiveMonth();
        const payments = await db.payments.where('month').equals(currentMonth).toArray();
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
        
        this.downloadExcel(data, `Payments_${currentMonth}.xlsx`);
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
    }
};

// Boot
window.addEventListener('DOMContentLoaded', () => {
    App.init();
});
