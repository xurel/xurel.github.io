import { showModal, closeModal, toggleMainMenu, switchApp } from './modules/ui.js';
import { masukSistem, keluarSistem, auth } from './modules/firebase.js';
import { generateName } from './modules/randomName.js';
import { formatRupiah, openShopeeModal, saveShopee, deleteShopee, copyShopeeLink, moveShopee } from './modules/shopee.js';
import { switchNoteTab, openNoteModal, saveNote, editNote, deleteNote, copyNoteContent } from './modules/notes.js';
import { toggleSmsLock, changeSmsServer, buySms, copyPhoneNumber, actSms } from './modules/sms.js';
import { jalankanFiturBaru } from './modules/fiturBaru.js';

window.showModal = showModal;
window.closeModal = closeModal;
window.toggleMainMenu = toggleMainMenu;
window.switchApp = switchApp;
window.masukSistem = masukSistem;
window.keluarSistem = keluarSistem;
window.generateName = generateName;

window.formatRupiah = formatRupiah;
window.openShopeeModal = openShopeeModal;
window.saveShopee = saveShopee;
window.deleteShopee = deleteShopee;
window.copyShopeeLink = copyShopeeLink;
window.moveShopee = moveShopee;

window.switchNoteTab = switchNoteTab;
window.openNoteModal = openNoteModal;
window.saveNote = saveNote;
window.editNote = editNote;
window.deleteNote = deleteNote;
window.copyNoteContent = copyNoteContent;

window.toggleSmsLock = toggleSmsLock;
window.changeSmsServer = changeSmsServer;
window.buySms = buySms;
window.copyPhoneNumber = copyPhoneNumber;
window.actSms = actSms;
window.jalankanFiturBaru = jalankanFiturBaru;

auth.onAuthStateChanged(user => {
    const isAdmin = !!user;
    document.getElementById('login-form').classList.toggle('hidden', isAdmin);
    document.getElementById('logout-form').classList.toggle('hidden', !isAdmin);
    
    // Perbarui Tampilan FAB sesuai status login
    const fabShopee = document.getElementById('fab-shopee');
    const isShopeeActive = document.getElementById('app-shopee').classList.contains('active');
    if (fabShopee) fabShopee.style.display = (isAdmin && isShopeeActive) ? 'flex' : 'none';
    
    window.dispatchEvent(new CustomEvent('authStateChanged', { detail: user }));
});

document.addEventListener('click', function(e) {
    const popup = document.getElementById('main-menu-popup');
    const btn = document.querySelector('.menu-btn');
    if(popup && popup.classList.contains('active') && !popup.contains(e.target) && !btn.contains(e.target)) {
        popup.classList.remove('active');
    }
});
