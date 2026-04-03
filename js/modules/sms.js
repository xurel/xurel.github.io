// ==========================================
// 7. AKSI TOMBOL (DENGAN PENANGKAP ERROR AKURAT)
// ==========================================

// Fungsi kecil untuk membaca pesan error asli dari server
function getErrMsg(res) {
    if (res?.error?.message) return res.error.message;
    if (typeof res?.error === 'string') return res.error;
    if (res?.message) return res.message;
    if (res?.error_msg) return res.error_msg;
    return JSON.stringify(res) || "Ditolak oleh server.";
}

export async function replaceSms(orderId, productId) {
    const btn = document.getElementById(`btn-replace-${orderId}`);
    if (!productId || productId === 'null') {
        showModal("Peringatan", "Sistem tidak mengenali ID Server, silakan batalkan manual lalu pesan lagi.", "alert");
        return;
    }
    
    if (btn) { btn.disabled = true; btn.innerText = "PROSES..."; }
    
    try {
        const c = await apiCall('/order-action', 'POST', { id: orderId, action: 'cancel' });
        if (c.success || (c.error && c.error.code === 'NOT_FOUND')) {
            activeOrders = activeOrders.filter(o => o.id !== orderId);
            const n = await apiCall('/create-order', 'POST', { product_id: parseInt(productId) });
            if (n.success) {
                const od = n.data.orders[0];
                const pInfo = availableProducts.find(p => String(p.id) === String(productId));
                const finalPrice = od.price || od.cost || (pInfo ? pInfo.price : 0);
                
                activeOrders.unshift({
                    id: od.id, productId: parseInt(productId), phone: od.phone_number, price: finalPrice,
                    otp: null, status: "ACTIVE", expiresAt: new Date(od.expires_at).getTime(),
                    cancelUnlockTime: Date.now() + (120*1000), isAutoCanceling: false,
                    isHidden: false
                });
                
                startPollingAndTimer(); updateSmsBal(); renderSmsOrders();
                window.scrollTo({ top: 0, behavior: 'smooth' });
                copyPhoneNumber(od.phone_number, `copy-icon-${od.id}`); 
            } else {
                showModal("Gagal Pesan Baru", getErrMsg(n), "alert");
                renderSmsOrders(); updateSmsBal();
            }
        } else {
            showModal("Gagal Batal", getErrMsg(c), "alert");
            if (btn) { btn.disabled = false; btn.innerText = "⇄ REPLACE"; }
        }
    } catch (e) {
        showModal("Error Jaringan", "Terjadi kesalahan saat memproses.", "alert");
        if (btn) { btn.disabled = false; btn.innerText = "⇄ REPLACE"; }
    }
}
window.replaceSms = replaceSms;

export async function actSms(action, id, isAuto = false) {
    let order = activeOrders.find(o => o.id === id);
    if (!order && !isAuto) return;

    // Tombol DONE langsung mengeksekusi tanpa pop-up
    if (action === 'finish') {
        const btn = document.querySelector(`#order-${id} .btn-done`);
        if (btn) btn.innerText = "Menutup..."; 
        
        try { await apiCall('/order-action', 'POST', { id, action: 'finish' }); } catch(e) {}
        
        activeOrders = activeOrders.filter(o => o.id !== id);
        renderSmsOrders(); updateSmsBal();
        return; 
    }

    let title = "Konfirmasi", msg = "Lanjutkan?", type = "confirm";
    if(action === 'cancel') { title = "Batalkan"; msg = isAuto ? "Waktu sisa 10 menit, membatalkan otomatis..." : "Yakin batalkan pesanan ini? Saldo dikembalikan."; type = "danger"; }
    if(action === 'resend') { title = "Kirim Ulang"; msg = "Meminta kode OTP baru?"; }

    if(!isAuto) {
        if(!await showModal(title, msg, type)) return;
    }

    try {
        const res = await apiCall('/order-action', 'POST', { id, action }); 
        if(res.success) { 
            if(action === 'cancel') { 
                activeOrders = activeOrders.filter(o => o.id !== id); 
            }
            if(action === 'resend' && !isAuto) {
                showModal("Info", "Permintaan kirim ulang terkirim.", "alert");
            }
        } else if (!isAuto) {
            showModal("Gagal", getErrMsg(res), "alert");
        }
        renderSmsOrders(); 
        updateSmsBal();
    } catch(e) {
        if (!isAuto) showModal("Error", "Gagal menghubungi server.", "alert");
    }
}
window.actSms = actSms;
