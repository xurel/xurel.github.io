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
        db.ref(path).child(type).transaction((currentValue) => {
            return (currentValue || 0) + 1;
        });
    } catch (e) { console.warn("Stat error:", e); }
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
        let statsText = document.getElementById('note-stats-text');
        
        if (!statsText) {
            statsText = document.createElement('div');
            statsText.id = 'note-stats-text';
            
            // BUBBLE PROFESIONAL: Warnanya disamakan persis dengan .notes-subnav di CSS kamu (#e4e6eb)
            statsText.style.cssText = `
                background: #e4e6eb; 
                color: #65676B; 
                padding: 6px 15px; 
                border-radius: 20px; 
                font-size: 11px; 
                font-weight: bold; 
                display: flex; 
                align-items: center; 
                gap: 8px;
                pointer-events: none;
            `;
        }
        
        statsText.innerHTML = `📝 ${statsData.total} &nbsp;|&nbsp; 💾 ${statsData.saved} &nbsp;|&nbsp; 🗑️ ${statsData.deleted}`;
        
        const tabPriv = document.getElementById('tab-priv');
        if (tabPriv && tabPriv.parentElement) {
            const subnav = tabPriv.parentElement; // Ini adalah elemen <div class="notes-subnav">
            
            // Kita buat pembungkus Flexbox agar tombol & statistik sejajar alami tanpa saling tabrak
            if (!subnav.parentElement.classList.contains('stats-wrapper')) {
                const wrapper = document.createElement('div');
                wrapper.className = 'stats-wrapper';
                wrapper.style.display = 'flex';
                wrapper.style.justifyContent = 'space-between'; // Mendorong bubble ke paling kanan
                wrapper.style.alignItems = 'center';
                wrapper.style.marginBottom = '15px'; // Mengambil alih margin dari subnav
                
                subnav.style.marginBottom = '0'; // Hapus margin asli agar tidak dobel
                
                subnav.parentNode.insertBefore(wrapper, subnav);
                wrapper.appendChild(subnav);
                wrapper.appendChild(statsText);
            } else {
                const wrapper = subnav.parentElement;
                if (!wrapper.contains(statsText)) wrapper.appendChild(statsText);
            }
        }
    } catch (error) {
        console.warn("Gagal render UI Statistik:", error);
    }
}
// ==========================================

window.addEventListener('authStateChanged', (e) => { 
    userAdmin = e.detail; 
    if(currentNoteTab === 'private' && !userAdmin) switchNoteTab('public'); else { syncNotes(); syncStats(); }
});

export function switchNoteTab(tab) {
    currentNoteTab = tab;
    
    try {
        const pubBtn = document.getElementById('tab-pub');
        const privBtn = document.getElementById('tab-priv');
        if(pubBtn) pubBtn.classList.toggle('active', tab === 'public');
        if(privBtn) privBtn.classList.toggle('active', tab === 'private');
    } catch(e){}
    
    statsData.total = 0; updateStatsUI();
    
    const lockSec = document.getElementById('note-lock-section');
    const gridSec = document.getElementById('notes-grid');
    const fabBtn = document.getElementById('fab-note');

    if (tab === 'private' && !userAdmin) {
        if(lockSec) lockSec.classList.remove('hidden');
        if(gridSec) gridSec.classList.add('hidden');
        if(fabBtn) fabBtn.style.display = 'none';
    } else {
        if(lockSec) lockSec.classList.add('hidden');
        if(gridSec) gridSec.classList.remove('hidden');
        if(document.getElementById('app-notes') && document.getElementById('app-notes').classList.contains('active')) {
            if(fabBtn) fabBtn.style.display = 'flex';
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
    try { db.ref(path).off(); } catch(e){}
    
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
    try {
        document.getElementById('note-title').value = ""; 
        document.getElementById('note-content').value = "";
        document.getElementById('modal-note-form').classList.add('active');
    } catch(e){}
}

export async function saveNote() {
    try {
        let t = document.getElementById('note-title').value.trim(); 
        const c = document.getElementById('note-content').value;
        if(!c) return showModal("Peringatan", "Konten tidak boleh kosong!", "alert");
        
        const path = getNotesPath();
        const snapshot = await db.ref(path).once('value');
        let usedNumbers = new Set();
        let isDuplicate = false;

        snapshot.forEach(child => {
            if (isEditingNote && child.key === selectedNoteKey) return; 
            const childData = child.val();
            if (childData.content === c) isDuplicate = true;
            let titleStr = childData.title;
            if (titleStr && /^\d+$/.test(titleStr.toString().trim())) {
                usedNumbers.add(parseInt(titleStr.toString().trim()));
            }
        });

        if (isDuplicate) {
            const confirmSave = await showModal("Teks Duplikat", "Catatan dengan teks yang sama persis sudah ada. Tetap simpan?", "confirm");
            if (!confirmSave) return;
        }

        if(!t) {
            let nextNum = 1; 
            while (usedNumbers.has(nextNum)) { nextNum++; }
            t = nextNum.toString();
        }
        executeNoteSave(t, c, path);
    } catch (e) {
        showModal("Gagal", "Gagal menghubungi database.", "alert");
    }
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
    try {
        closeModal('modal-note-view'); isEditingNote = true;
        document.getElementById('note-title').value = document.getElementById('view-title').innerText;
        document.getElementById('note-content').value = currentNoteRaw;
        document.getElementById('modal-note-form').classList.add('active');
    } catch(e){}
}

export async function deleteNote() {
    if(await showModal("Hapus Catatan", "Yakin ingin menghapus catatan ini?", "danger")) {
        db.ref(`${getNotesPath()}/${selectedNoteKey}`).remove().then(() => {
            incrementStat('deleted'); 
            closeModal('modal-note-view');
        }).catch(() => showModal("Gagal", "Gagal menghapus catatan.", "alert"));
    }
}

export function copyNoteContent(btn) {
    try {
        navigator.clipboard.writeText(currentNoteRaw); 
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i> Tersalin'; 
        setTimeout(() => { btn.innerHTML = originalHTML; }, 1500);
    } catch(e){}
}
