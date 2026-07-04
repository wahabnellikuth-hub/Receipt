// Initialize Dexie
const db = new Dexie('MadrassaFeeDB');

// Define Schema
db.version(1).stores({
    classes: '++id, name',
    parents: '++id, classId, parentName, whatsappNumber',
    payments: '++id, parentId, month, status' // month format: 'YYYY-MM'
});

// Version 2: Update classes to 1-10
db.version(2).upgrade(async tx => {
    await tx.classes.clear();
    const newClasses = [];
    for (let i = 1; i <= 10; i++) {
        newClasses.push({ name: `Class ${i}` });
    }
    await tx.classes.bulkAdd(newClasses);
});

// Seed Initial Data (if empty)
db.on('populate', async () => {
    const classes = [];
    for (let i = 1; i <= 10; i++) {
        classes.push({ name: `Class ${i}` });
    }
    await db.classes.bulkAdd(classes);
});

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
        const existingRecord = await db.payments
            .where({ parentId: parent.id, month: currentMonth })
            .first();
            
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
    const count = await db.payments.where('status').equals('Paid').count();
    const prefix = "MDR";
    const year = new Date().getFullYear().toString().slice(-2);
    return `${prefix}-${year}-${String(count + 1).padStart(4, '0')}`;
}
