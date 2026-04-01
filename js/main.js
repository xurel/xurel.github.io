import { showModal, closeModal, toggleMainMenu, switchApp } from './modules/ui.js';
import { masukSistem, keluarSistem, auth } from './modules/firebase.js';
import { generateName } from './modules/randomName.js';
import { formatRupiah, addShopeeMenu, saveEditShopee, deleteShopee, copyShopeeLink } from './modules/shopee.js';
import { switchNoteTab, openNoteModal, saveNote, editNote, deleteNote, copyNoteContent } from './modules/notes.js';
import { toggleSmsLock, changeSmsServer, buySms, copyPhoneNumber, actSms } from './modules/sms.js';
import { jalankanFiturBaru } from './modules/fiturBaru.js';

// Mendaftarkan fungsi ke Global Scope (Window) agar onclick di HTML berfungsi
window.showModal = showModal;
window.closeModal = closeModal;
window.toggleMainMenu = toggleMainMenu;
window.switchApp = switchApp;
window.masukSistem = masukSistem;
window.keluarSistem = keluarSistem;
window.generateName = generateName;
window.formatRupiah = formatRupiah;
window.addShopeeMenu = addShopeeMenu;
window.saveEditShopee = saveEditShopee;
window.deleteShopee = deleteShopee;
window.copyShopeeLink = copyShopeeLink;
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

// Pengendali Login Status
auth.onAuthStateChanged(user => {
    const isAdmin = !!user;
    document.getElementById('login-form').classList.toggle('hidden', isAdmin);
    document.getElementById('logout-form').classList.toggle('hidden', !isAdmin);
    document.getElementById('shopee-admin').classList.toggle('hidden', !isAdmin);
    
    // Memberitahu modul lain bahwa status login berubah (Event-Driven)
    window.dispatchEvent(new CustomEvent('authStateChanged', { detail: user }));
});

document.addEventListener('click', function(e) {
    const popup = document.getElementById('main-menu-popup');
    const btn = document.querySelector('.menu-btn');
    if(popup && popup.classList.contains('active') && !popup.contains(e.target) && !btn.contains(e.target)) {
        popup.classList.remove('active');
    }
});
