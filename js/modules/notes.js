import { db } from './firebase.js';
import { showModal, closeModal } from './ui.js';

let currentNoteTab = 'public'; let selectedNoteKey = null; let currentNoteRaw = ""; let isEditingNote = false;
let userAdmin = null;

window.addEventListener('authStateChanged', (e) => { 
    userAdmin = e.detail; 
    if(currentNoteTab === 'private' && !userAdmin) switchNoteTab('public'); else syncNotes();
});

export function switchNoteTab(tab) {
    currentNoteTab = tab;
    document.getElementById('tab-pub').classList.toggle('active', tab === 'public');
    document.getElementById('tab-priv').classList.toggle('active', tab === 'private');
    
    if (tab === 'private' && !userAdmin) {
        document.getElementById('note-lock-section').classList.remove('hidden');
        document.getElementById('notes-grid').classList.add('hidden');
        document.getElementById('fab-note').style.display = 'none';
    } else {
        document.getElementById('note-lock-section').classList.add('hidden');
        document.getElementById('notes-grid').classList.remove('hidden');
        if (document.getElementById('app-notes').classList.contains('active')) document.getElementById('fab-note').style.display = 'flex';
        syncNotes();
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
    const path = getNotesPath(); db.ref(path).off();
    db.ref(path).orderByChild('timestamp').on('value', snap => {
        const grid = document.getElementById('notes-grid'); grid.innerHTML = ''; let items = [];
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
    isEditingNote = false; document.getElementById('note-title').value = ""; document.getElementById('note-content').value = "";
    document.getElementById('modal-note-form').classList.add('active');
}

export function saveNote() {
    let t = document.getElementById('note-title').value.trim(); const c = document.getElementById('note-content').value;
    if(!c) return showModal("Peringatan", "Konten tidak boleh kosong!", "alert");
    const path = getNotesPath();
    if(!t) {
        db.ref(path).once('value').then(snapshot => {
            let usedNumbers = new Set();
            snapshot.forEach(child => {
                if (isEditingNote && child.key === selectedNoteKey) return; 
                let titleStr = child.val().title;
                if (titleStr && /^\d+$/.test(titleStr.toString().trim())) usedNumbers.add(parseInt(titleStr.toString().trim()));
            });
            let nextNum = 1; while (usedNumbers.has(nextNum)) { nextNum++; }
            executeNoteSave(nextNum.toString(), c, path);
        }).catch(e => showModal("Gagal", "Gagal menghubungi database.", "alert"));
    } else { executeNoteSave(t, c, path); }
}

function executeNoteSave(title, content, path) {
    const data = { title: title, content: content, timestamp: Date.now() };
    const req = (isEditingNote && selectedNoteKey) ? db.ref(`${path}/${selectedNoteKey}`).update(data) : db.ref(path).push(data);
    req.then(() => closeModal('modal-note-form')).catch(() => showModal("Gagal", "Akses Ditolak.", "alert"));
}

export function editNote() {
    closeModal('modal-note-view'); isEditingNote = true;
    document.getElementById('note-title').value = document.getElementById('view-title').innerText;
    document.getElementById('note-content').value = currentNoteRaw;
    document.getElementById('modal-note-form').classList.add('active');
}

export async function deleteNote() {
    if(await showModal("Hapus Catatan", "Yakin ingin menghapus catatan ini?", "danger")) {
        db.ref(`${getNotesPath()}/${selectedNoteKey}`).remove(); closeModal('modal-note-view');
    }
}

export function copyNoteContent(btn) {
    navigator.clipboard.writeText(currentNoteRaw); const originalHTML = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-check"></i> Tersalin'; setTimeout(() => { btn.innerHTML = originalHTML; }, 1500);
}
