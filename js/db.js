// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyAjEbBpZnLZcbptYG5bWBK1B3qqYwVN1gk",
  authDomain: "receipt-514a0.firebaseapp.com",
  databaseURL: "https://receipt-514a0-default-rtdb.firebaseio.com",
  projectId: "receipt-514a0",
  storageBucket: "receipt-514a0.firebasestorage.app",
  messagingSenderId: "395267414271",
  appId: "1:395267414271:web:e70c084f38ddfa62fa54ca",
  measurementId: "G-YPK7GF4WX5"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Multi-tenancy: Get Madrasa ID from URL or PWA storage
function getActiveMadrasa() {
    const urlParams = new URLSearchParams(window.location.search);
    const mFromUrl = urlParams.get('m');
    
    if (mFromUrl) {
        // Always save to localStorage in case they install it as a PWA
        localStorage.setItem('activeMadrasa', mFromUrl);
        return mFromUrl;
    }
    
    // Check if the app is running as an installed PWA on a phone/desktop
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    
    if (isPWA) {
        // Installed PWAs don't have URL parameters, so read from storage
        const stored = localStorage.getItem('activeMadrasa');
        if (stored) return stored;
    }
    
    // If it's a normal browser visit and there's no ?m= in the link, ALWAYS show original data
    return 'default';
}

function getDbPath(path) {
    const madrasaId = getActiveMadrasa();
    if (madrasaId === 'default') {
        return path; // keep backward compatibility for existing primary madrasa
    }
    return `madrasas/${madrasaId}/${path}`;
}

// Facade to mimic Dexie API for app.js
const db = {
    open: async () => {
        // Seed Initial Data (if classes are empty)
        try {
            const snap = await database.ref(getDbPath('classes')).once('value');
            if (!snap.exists()) {
                for (let i = 1; i <= 10; i++) {
                    await database.ref(getDbPath(`classes/${i}`)).set({ name: `Class ${i}` });
                }
            }
        } catch (error) {
            console.error("Firebase Database Error (Rules might be locked):", error);
            alert("Firebase Error: " + error.message + "\n\nPlease ensure your Firebase Realtime Database Rules allow read/write access (e.g. set to true).");
        }
    },
    
    classes: {
        toArray: async () => {
            const snap = await database.ref(getDbPath('classes')).once('value');
            const val = snap.val() || {};
            return Object.keys(val).map(k => ({id: String(k), ...val[k]}));
        },
        count: async () => {
            const arr = await db.classes.toArray();
            return arr.length;
        },
        get: async (id) => {
            const snap = await database.ref(getDbPath(`classes/${id}`)).once('value');
            return snap.exists() ? {id: String(id), ...snap.val()} : null;
        }
    },

    parents: {
        toArray: async () => {
            const snap = await database.ref(getDbPath('parents')).once('value');
            const val = snap.val() || {};
            return Object.keys(val).map(k => ({id: String(k), ...val[k]}));
        },
        count: async () => {
            const arr = await db.parents.toArray();
            return arr.length;
        },
        get: async (id) => {
            const snap = await database.ref(getDbPath(`parents/${id}`)).once('value');
            return snap.exists() ? {id: String(id), ...snap.val()} : null;
        },
        add: async (data) => {
            const newRef = database.ref(getDbPath('parents')).push();
            await newRef.set(data);
            return newRef.key;
        },
        update: async (id, data) => {
            await database.ref(getDbPath(`parents/${id}`)).update(data);
        },
        delete: async (id) => {
            await database.ref(getDbPath(`parents/${id}`)).remove();
        }
    },

    payments: {
        toArray: async () => {
            const snap = await database.ref(getDbPath('payments')).once('value');
            const val = snap.val() || {};
            return Object.keys(val).map(k => ({id: String(k), ...val[k]}));
        },
        where: function(field) {
            return {
                equals: function(value) {
                    return {
                        toArray: async () => {
                            const snap = await database.ref(getDbPath('payments')).orderByChild(field).equalTo(value).once('value');
                            const val = snap.val() || {};
                            return Object.keys(val).map(k => ({id: String(k), ...val[k]}));
                        },
                        count: async () => {
                            const arr = await this.toArray();
                            return arr.length;
                        }
                    }
                }
            }
        },
        get: async (id) => {
            const snap = await database.ref(getDbPath(`payments/${id}`)).once('value');
            return snap.exists() ? {id: String(id), ...snap.val()} : null;
        },
        add: async (data) => {
            const newRef = database.ref(getDbPath('payments')).push();
            await newRef.set(data);
            return newRef.key;
        },
        update: async (id, data) => {
            await database.ref(getDbPath(`payments/${id}`)).update(data);
        },
        bulkDelete: async (ids) => {
            const updates = {};
            ids.forEach(id => {
                updates[id] = null;
            });
            await database.ref(getDbPath('payments')).update(updates);
        }
    },

    settings: {
        get: async (key) => {
            const snap = await database.ref(getDbPath(`settings/${key}`)).once('value');
            return snap.val();
        },
        set: async (key, value) => {
            await database.ref(getDbPath(`settings/${key}`)).set(value);
        }
    }
};

// Get Active Month (Manual Control via localStorage)
function getActiveMonth() {
    let activeMonth = localStorage.getItem('activeMonth');
    if (!activeMonth) {
        const d = new Date();
        activeMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        localStorage.setItem('activeMonth', activeMonth);
    }
    return activeMonth;
}

function setActiveMonth(monthStr) {
    localStorage.setItem('activeMonth', monthStr);
}

// Ensure all parents have a payment record for the current month
async function generateMonthlyRecords() {
    const currentMonth = getActiveMonth();
    
    // Determine the range of months from 2026-01 to currentMonth
    let endY = parseInt(currentMonth.substring(0, 4));
    let endM = parseInt(currentMonth.substring(5, 7));
    
    // Ensure we don't go backwards if currentMonth is somehow before 2026 (edge case)
    if (endY < 2026) return;
    
    const months = [];
    let cy = 2026, cm = 1;
    while (cy < endY || (cy === endY && cm <= endM)) {
        months.push(`${cy}-${String(cm).padStart(2, '0')}`);
        cm++;
        if (cm > 12) { cm = 1; cy++; }
    }
    
    // Get all parents and payments for these months concurrently
    const [parents, allPayments] = await Promise.all([
        db.parents.toArray(),
        db.payments.where('month').anyOf(months).toArray()
    ]);
    
    const existingPaymentsMap = new Set();
    allPayments.forEach(p => {
        existingPaymentsMap.add(`${p.month}_${p.parentId}`);
    });
    
    const promises = [];
    for (const month of months) {
        for (const parent of parents) {
            if (!existingPaymentsMap.has(`${month}_${parent.id}`)) {
                promises.push(db.payments.add({
                    parentId: parent.id,
                    month: month,
                    status: 'Pending',
                    amount: 0,
                    date: null,
                    method: null,
                    remarks: '',
                    receiptNo: null
                }));
            }
        }
    }
    
    if (promises.length > 0) {
        await Promise.all(promises);
    }
}

// Helper to get formatted date
function formatDate(dateObj) {
    if(!dateObj) return '';
    const d = new Date(dateObj);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatMonthYear(monthStr) {
    if(!monthStr) return '';
    const parts = monthStr.split('-');
    if(parts.length !== 2) return monthStr;
    const d = new Date(parts[0], parseInt(parts[1]) - 1);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// Generate Receipt Number
async function generateReceiptNumber() {
    const payments = await db.payments.where('status').equals('Paid').toArray();
    const count = payments.length;
    
    // Load custom settings or use defaults
    let settings = {};
    try {
        const saved = localStorage.getItem('receiptSettings');
        if (saved) settings = JSON.parse(saved);
    } catch(e) {}
    
    const prefix = "MUP";
    
    const activeMonthStr = getActiveMonth(); // "YYYY-MM"
    const year = activeMonthStr.substring(2, 4);
    const month = activeMonthStr.substring(5, 7);
    const sequence = String(count + 1).padStart(3, '0');
    
    return prefix ? `${prefix}${year}${month}${sequence}` : `${year}${month}${sequence}`;
}
