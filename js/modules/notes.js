import { db } from './firebase.js';
import { showModal, closeModal } from './ui.js';

let currentNoteTab = 'public'; let selectedNoteKey = null; let currentNoteRaw = ""; let isEditingNote = false;
let userAdmin = null;

// ==========================================
// FITUR STATISTIK HARIAN & TOTAL
// ==========================================
let currentStatsRef = null;
let statsData = { total: 0, saved: 0, deleted: 0 }; 

function getTodayWIB() {
    const d = new Date();
    const wibTime = new Date(d.getTime() + (d.getTimezoneOffset() * 60000) + (3600000 * 7));
    return `${wibTime.getFullYear()}-${String(wibTime.getMonth() + 1).padStart(2, '0')}-${String(wibTime.getDate()).padStart(2, '0')}`;
}

function getStatsPath() {
    const today = getTodayWIB();
    return (currentNoteTab === 'private' && userAdmin) 
        ? `notes_stats/users/${userAdmin.uid}/${today}` 
        : `notes_stats/public/${today}`;
}

function incrementStat(type) {
    try {
        const path = getStatsPath();
        db.ref(path).child(type).transaction((currentValue) => (currentValue || 0) + 1);
    } catch (e) {}
}

async function resetStatsManual() {
    const confirm = await showModal("Reset Statistik", "Hapus data simpan & hapus hari ini?", "danger");
    if (confirm) {
        try {
            await db.ref(getStatsPath()).update({ saved: 0, deleted: 0 });
        } catch (e) {}
    }
}

function syncStats() {
    try {
        const path = getStatsPath();
        if (currentStatsRef) currentStatsRef.off();
        currentStatsRef = db.ref(path);
        currentStatsRef.on('value', snap => {
            const data = snap.val() || { saved: 0, deleted: 0 };
            statsData.saved = data.saved || 0;
            statsData.deleted = data.deleted || 0;
            updateStatsUI(); 
        });
    } catch (e) {}
}

function updateStatsUI() {
    try {
        let statsContainer = document.getElementById('note-stats-unified');
        const subnav = document.querySelector('.notes-subnav');
        
        if (!subnav) return;

        if (!statsContainer) {
            statsContainer = document.createElement('div');
            statsContainer.id = 'note-stats-unified';
            // Styling agar menyatu dengan subnav (background & border-radius sama)
            statsContainer.style.cssText = `
                display: flex; align-items: center; gap: 12px;
                margin-left: 15px; padding-left: 15px;
                border-left: 1px solid #ccd0d5; height: 20px;
                color: #65676B; font-size: 13px; font-weight: 600;
            `;
            subnav.appendChild(statsContainer);
            // Menyesuaikan lebar subnav agar menampung statistik
            subnav.style.width = 'auto';
            subnav.style.maxWidth = 'none';
            subnav.style.display = 'flex';
            subnav.style.alignItems = 'center';
        }
        
        statsContainer.innerHTML = `
            <span>📝 ${statsData.total} &nbsp;|&nbsp; 💾 ${statsData.saved} &nbsp;|&nbsp; 🗑️ ${statsData.deleted}</span>
            <div id="btn-reset-stat" style="
                width: 22px; height: 22px; background: #bcc0c4; 
                border-radius: 50%; display: flex; align-items: center; 
                justify-content: center; cursor: pointer; transition: 0.2s;
                margin-left: 5px;
            " title="Reset Harian">
                <i class="fas fa-sync-alt" style="font-size: 10px; color: white;"></i>
            </div>
        `;

        const btnReset = statsContainer.querySelector('#btn-reset-stat');
        btnReset.onclick = (e) => { e.stopPropagation(); resetStatsManual(); };
        btnReset.onmouseover = () => btnReset.style.background = '#4b4d50';
        btnReset.onmouseout = () => btnReset.style.background = '#bcc0c4';

    } catch (error) {}
}

// ==========================================
// CORE FUNCTIONS
// ==========================================

window.addEventListener('authStateChanged', (e) => { 
    userAdmin = e.detail; 
    if(currentNoteTab === 'private' && !userAdmin) switchNoteTab('public'); 
    else { syncNotes(); syncStats(); }
});

export function switchNoteTab(tab) {
    currentNoteTab = tab;
    const tPub = document.getElementById('tab-pub');
    const tPriv = document.getElementById('tab-priv');
    if(tPub) tPub.classList.toggle('active', tab === 'public');
    if(tPriv) tPriv.classList.toggle('active', tab === 'private');
    
    if (tab === 'private' && !userAdmin) {
        document.getElementById('note-lock-section').classList.remove('hidden');
        document.getElementById('notes-grid').classList.add('hidden');
        document.getElementById('fab-note').style.display = 'none';
    } else {
        document.getElementById('note-lock-section').classList.add('hidden');
        document.getElementById('notes-grid').classList.remove('hidden');
        if (document.getElementById('app-notes')?.classList.contains('active')) {
            document.getElementById('fab-note').style.display = 'flex';
        }
        syncNotes();
        syncStats();
    }
}

function getNotesPath() { return (currentNoteTab === 'private' && userAdmin) ? `notes/users/${userAdmin.uid}` : 'notes/public'; }

function formatDate(ts) {
    if(!ts) return "---"; const d = new Date(ts);
    return `${['Ming', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'][d.getDay()]}, ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function autoLinkText(text) { return text.replace(/(https?:\/\/[^\s]+)/g, url => `<a href="${url}" target="_blank" class="text-link" onclick="event.stopPropagation()">${url}</a>`); }
function escapeHTML(str) { return !str ? "" : str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m])); }

function syncNotes() {
    const path = getNotesPath(); 
    db.ref(path).off();
    db.ref(path).orderByChild('timestamp').on('value', snap => {
        statsData.total = snap.numChildren();
        updateStatsUI();
        const grid = document.getElementById('notes-grid'); 
        if(!grid) return;
        grid.innerHTML = ''; let items = [];
        snap.forEach(child => { items.push({ key: child.key, ...child.val() }); });
        items.reverse().forEach(d => {
            const card = document.createElement('div'); card.className = 'note-card'; 
            card.onclick = () => {
                selectedNoteKey = d.key; currentNoteRaw = d.content;
                document.getElementById('view-tag').innerText = (currentNoteTab === 'private' ? "🔒 PRIV | " : "🌐 PUB | ") + formatDate(d.timestamp);
                document.getElementById('view-title').innerText = d.title;
                document.getElementById('view-content').innerHTML = autoLinkText(escapeHTML(d.content));
                document.getElementById('modal-note-view').classList.add('active');
            };
            card.innerHTML = `<div class="note-title">${escapeHTML(d.title) || 'Untitled'}</div><div class="note-preview">${escapeHTML(d.content)}</div><div class="note-date">${formatDate(d.timestamp)}</div>`;
            grid.appendChild(card);
        });
    });
}

export function openNoteModal() {
    isEditingNote = false; 
    document.getElementById('note-title').value = ""; 
    document.getElementById('note-content').value = "";
    document.getElementById('modal-note-form').classList.add('active');
}

export async function saveNote() {
    let t = document.getElementById('note-title').value.trim(); 
    const c = document.getElementById('note-content').value;
    if(!c) return showModal("Peringatan", "Konten tidak boleh kosong!", "alert");
    
    const path = getNotesPath();
    try {
        const snapshot = await db.ref(path).once('value');
        let usedNumbers = new Set();
        let isDuplicate = false;

        snapshot.forEach(child => {
            if (isEditingNote && child.key === selectedNoteKey) return; 
            if (child.val().content === c) isDuplicate = true;
            let titleStr = child.val().title;
            if (titleStr && /^\d+$/.test(titleStr.toString().trim())) usedNumbers.add(parseInt(titleStr.toString().trim()));
        });

        if (isDuplicate) {
            const confirm = await showModal("Teks Duplikat", "Catatan dengan teks yang sama persis sudah ada. Tetap simpan?", "confirm");
            if (!confirm) return;
        }

        if(!t) {
            let nextNum = 1; while (usedNumbers.has(nextNum)) { nextNum++; }
            t = nextNum.toString();
        }
        executeNoteSave(t, c, path);
    } catch (e) { showModal("Gagal", "Gagal menghubungi database.", "alert"); }
}

function executeNoteSave(title, content, path) {
    const data = { title: title, content: content, timestamp: Date.now() };
    const req = (isEditingNote && selectedNoteKey) ? db.ref(`${path}/${selectedNoteKey}`).update(data) : db.ref(path).push(data);
    req.then(() => {
        closeModal('modal-note-form');
        if (!isEditingNote) incrementStat('saved');
    }).catch(() => showModal("Gagal", "Akses Ditolak.", "alert"));
}

export function editNote() {
    closeModal('modal-note-view'); isEditingNote = true;
    document.getElementById('note-title').value = document.getElementById('view-title').innerText;
    document.getElementById('note-content').value = currentNoteRaw;
    document.getElementById('modal-note-form').classList.add('active');
}

export async function deleteNote() {
    if(await showModal("Hapus Catatan", "Yakin ingin menghapus catatan ini?", "danger")) {
        db.ref(`${getNotesPath()}/${selectedNoteKey}`).remove().then(() => {
            incrementStat('deleted');
            closeModal('modal-note-view');
        });
    }
}

export function copyNoteContent(btn) {
    navigator.clipboard.writeText(currentNoteRaw); const originalHTML = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-check"></i> Tersalin'; setTimeout(() => { btn.innerHTML = originalHTML; }, 1500);
}
