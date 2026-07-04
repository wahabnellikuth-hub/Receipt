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

// Facade to mimic Dexie API for app.js
const db = {
    open: async () => {
        // Seed Initial Data (if classes are empty)
        try {
            const snap = await database.ref('classes').once('value');
            if (!snap.exists()) {
                for (let i = 1; i <= 10; i++) {
                    await database.ref(`classes/${i}`).set({ name: `Class ${i}` });
                }
            }
        } catch (error) {
            console.error("Firebase Database Error (Rules might be locked):", error);
            alert("Firebase Error: " + error.message + "\n\nPlease ensure your Firebase Realtime Database Rules allow read/write access (e.g. set to true).");
        }
    },
    
    classes: {
        toArray: async () => {
            const snap = await database.ref('classes').once('value');
            const val = snap.val() || {};
            return Object.keys(val).map(k => ({id: String(k), ...val[k]}));
        },
        count: async () => {
            const arr = await db.classes.toArray();
            return arr.length;
        },
        get: async (id) => {
            const snap = await database.ref(`classes/${id}`).once('value');
            return snap.exists() ? {id: String(id), ...snap.val()} : null;
        }
    },

    parents: {
        toArray: async () => {
            const snap = await database.ref('parents').once('value');
            const val = snap.val() || {};
            return Object.keys(val).map(k => ({id: String(k), ...val[k]}));
        },
        count: async () => {
            const arr = await db.parents.toArray();
            return arr.length;
        },
        get: async (id) => {
            const snap = await database.ref(`parents/${id}`).once('value');
            return snap.exists() ? {id: String(id), ...snap.val()} : null;
        },
        add: async (data) => {
            const newRef = database.ref('parents').push();
            await newRef.set(data);
            return newRef.key;
        },
        update: async (id, data) => {
            await database.ref(`parents/${id}`).update(data);
        },
        delete: async (id) => {
            await database.ref(`parents/${id}`).remove();
        }
    },

    payments: {
        toArray: async () => {
            const snap = await database.ref('payments').once('value');
            const val = snap.val() || {};
            return Object.keys(val).map(k => ({id: String(k), ...val[k]}));
        },
        where: function(field) {
            return {
                equals: function(value) {
                    return {
                        toArray: async () => {
                            const snap = await database.ref('payments').orderByChild(field).equalTo(value).once('value');
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
            const snap = await database.ref(`payments/${id}`).once('value');
            return snap.exists() ? {id: String(id), ...snap.val()} : null;
        },
        add: async (data) => {
            const newRef = database.ref('payments').push();
            await newRef.set(data);
            return newRef.key;
        },
        update: async (id, data) => {
            await database.ref(`payments/${id}`).update(data);
        },
        bulkDelete: async (ids) => {
            const updates = {};
            ids.forEach(id => {
                updates[id] = null;
            });
            await database.ref('payments').update(updates);
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
    
    // Get all parents
    const parents = await db.parents.toArray();
    
    for (const parent of parents) {
        // Check if a payment record exists for this month
        const paymentsSnap = await database.ref('payments')
            .orderByChild('parentId')
            .equalTo(parent.id)
            .once('value');
            
        let existingRecord = null;
        const val = paymentsSnap.val() || {};
        const records = Object.keys(val).map(k => ({id: String(k), ...val[k]}));
        existingRecord = records.find(r => r.month === currentMonth);
            
        if (!existingRecord) {
            // Create a pending record
            await db.payments.add({
                parentId: parent.id,
                month: currentMonth,
                status: 'Pending',
                amount: 0,
                date: null,
                method: null,
                remarks: '',
                receiptNo: null
            });
        }
    }
}

// Helper to get formatted date
function formatDate(dateObj) {
    if(!dateObj) return '';
    const d = new Date(dateObj);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Generate Receipt Number
async function generateReceiptNumber() {
    const payments = await db.payments.where('status').equals('Paid').toArray();
    const count = payments.length;
    const prefix = "MDR";
    const year = new Date().getFullYear().toString().slice(-2);
    return `${prefix}-${year}-${String(count + 1).padStart(4, '0')}`;
}
