import { showModal } from './ui.js';

// ==========================================
// 1. KONFIGURASI SINGLE WORKER (ALA APP.JS)
// ==========================================
// Masukkan URL Worker Baru Anda di sini:
const BASE_URL = "https://worker-sms-sentral.xurel.workers.dev"; 

let currentServerName = ""; // Menyimpan nama server (HP1, HP2, dll)
let smsInitialized = false; 
let isSmsLocked = false;

// State Management
let activeOrders = [];
let pollingInterval = null;
let timerInterval = null;
let availableProducts = [];

// ==========================================
// 2. FUNGSI UTAMA & BANTUAN API
// ==========================================
async function apiCall(endpoint, method = "GET", body = null) {
    const options = { 
        method: method, 
        headers: { 
            "Content-Type": "application/json",
            // INI KUNCI UTAMANYA: Mengirimkan nama HP ke Worker via Header
            "X-Server-Name": currentServerName 
        } 
    };
    if (body) options.body = JSON.stringify(body);
    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    return await response.json();
}

window.addEventListener('appSwitched', (e) => { 
    if(e.detail === 'sms' && !smsInitialized) initSms(); 
});

async function initSms() {
    smsInitialized = true; 
    const select = document.getElementById('sms-server');
    select.innerHTML = '<option>Memuat Server...</option>';
    
    // MENGAMBIL DAFTAR SERVER OTOMATIS DARI WORKER
    try {
        const res = await fetch(`${BASE_URL}/api/servers`);
        const data = await res.json();
        if(data.success && data.servers && data.servers.length > 0) {
            select.innerHTML = data.servers.map(k => `<option value="${k}">${k}</option>`).join('');
        } else {
            throw new Error("Kosong");
        }
    } catch (e) {
        // Fallback sementara jika Worker baru Anda belum memiliki endpoint /api/servers
        const fallbackServers = ["HP1", "HP2"];
        select.innerHTML = fallbackServers.map(k => `<option value="${k}">${k}</option>`).join('');
    }
    
    isSmsLocked = localStorage.getItem('xurel_locked') === 'true';
    const savedServer = localStorage.getItem('xurel_selected_hp');
    
    // Setel server terpilih
    if(savedServer && Array.from(select.options).some(o => o.value === savedServer)) { 
        currentServerName = savedServer; 
        select.value = currentServerName; 
    } else { 
        currentServerName = select.options[0].value; 
    }
    
    applySmsLockUI(); 
    refreshSms(); 
}

// ==========================================
// 3. PENGATURAN SERVER & UI
// ==========================================
export function toggleSmsLock() { 
    isSmsLocked = !isSmsLocked; 
    localStorage.setItem('xurel_locked', isSmsLocked); 
    applySmsLockUI(); 
}
window.toggleSmsLock = toggleSmsLock;

function applySmsLockUI() {
    const select = document.getElementById('sms-server'); 
    const icon = document.getElementById('sms-lock-icon'); 
    select.disabled = isSmsLocked;
    if (isSmsLocked) { icon.className = 'fa-solid fa-lock'; icon.style.color = 'var(--fb-red)'; } 
    else { icon.className = 'fa-solid fa-unlock'; icon.style.color = 'var(--fb-muted)'; }
}

export function changeSmsServer() {
    if(isSmsLocked) return; 
    const select = document.getElementById('sms-server');
    currentServerName = select.value;
    localStorage.setItem('xurel_selected_hp', currentServerName);
    
    activeOrders = []; 
    document.getElementById('sms-active-orders').innerHTML = '';
    refreshSms();
}
window.changeSmsServer = changeSmsServer;

function refreshSms() { 
    document.getElementById('sms-prices').innerHTML = '<div style="padding:30px; text-align:center; color:#888;">Mengambil Data...</div>'; 
    updateSmsBal(); 
    loadSmsPrices(); 
    syncServerOrders(); 
}

async function updateSmsBal() {
    try { 
        const json = await apiCall('/get-balance'); 
        if(json.success) document.getElementById('sms-balance').innerText = `Rp ${json.data.balance.toLocaleString('id-ID')}`; 
    } catch(e) {}
}

async function loadSmsPrices() {
    try {
        const json = await apiCall('/get-prices'); 
        const box = document.getElementById('sms-prices');
        if (json.success && json.data.length > 0) {
            availableProducts = json.data; 
            box.innerHTML = json.data.map(i => {
                let shortName = i.name.replace(/Indonesia/ig, '').replace(/\s+/g, ' ').trim();
                return `<div class="price-item" onclick="buySms(${i.id}, ${i.price}, '${shortName}')">
                            <div style="flex: 1; min-width: 0; padding-right: 10px;">
                                <div style="font-weight:bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${shortName}</div>
                            </div>
                            <div style="display: flex; align-items: center; flex-shrink: 0; gap: 8px;">
                                <div style="width: 65px; text-align: right; color:var(--fb-red); font-family:monospace; font-size:14px; font-weight: 900;">Rp ${i.price}</div>
                                <div style="width: 75px; text-align: right; font-size:12px; color:var(--fb-muted);">${i.available} stok</div>
                            </div>
                        </div>`;
            }).join('');
        } else box.innerHTML = '<div style="padding:30px; text-align:center;">Kosong</div>';
    } catch (e) {}
}

// ==========================================
// 4. LOGIKA ORDER & SINKRONISASI
// ==========================================
export async function buySms(pid, price, name) {
    if(!await showModal("Pesan Baru", `Beli nomor untuk ${name} seharga Rp ${price}?`, "confirm")) return;
    try {
        const j = await apiCall('/create-order', 'POST', { product_id: parseInt(pid) });
        if(j.success) { 
            const o = j.data.orders[0]; 
            activeOrders.unshift({
                id: o.id,
                productId: pid,
                phone: o.phone_number,
                price: price || o.price || o.cost || 0,
                otp: null,
                status: "ACTIVE",
                expiresAt: new Date(o.expires_at || Date.now() + (20 * 60000)).getTime(),
                cancelUnlockTime: new Date(o.created_at || Date.now()).getTime() + (120 * 1000), 
                isAutoCanceling: false,
                isHidden: false
            });
            startPollingAndTimer(); 
            updateSmsBal(); 
            renderSmsOrders();
        } else {
            showModal("Gagal", j.error.message || "Gagal memesan stok.", "alert");
        }
    } catch(e){}
}
window.buySms = buySms;

async function syncServerOrders() {
    try { 
        const j = await apiCall('/get-active'); 
        if(j.success) { 
            let serverOrders = j.data || [];
            activeOrders = serverOrders.map(order => {
                const exp = order.expires_at ? new Date(order.expires_at).getTime() : Date.now() + (20*60*1000);
                const cTime = order.created_at ? new Date(order.created_at).getTime() : (exp - (20*60*1000));
                
                let fallbackPrice = order.price || order.cost;
                if(!fallbackPrice) {
                    const matchProduct = availableProducts.find(p => String(p.id) === String(order.product_id || order.service_id));
                    if (matchProduct) fallbackPrice = matchProduct.price;
                }

                return {
                    id: order.id,
                    productId: order.product_id || order.service_id || null, 
                    phone: order.phone_number || order.phone || 'Mencari Nomor...',
                    price: fallbackPrice || '...',
                    otp: order.otp_code,
                    status: order.otp_code ? "OTP_RECEIVED" : "ACTIVE",
                    expiresAt: exp,
                    cancelUnlockTime: cTime + (120*1000),
                    isAutoCanceling: false,
                    isHidden: false
                };
            });
            startPollingAndTimer();
            renderSmsOrders();
        } 
    } catch(e) {}
}

export function copyPhoneNumber(txt, iconId) {
    if(txt.includes('Mencari')) return; 
    navigator.clipboard.writeText(txt);
    const icon = document.getElementById(iconId);
    if(icon) { 
        icon.className = "fa-solid fa-circle-check"; icon.style.color = "var(--fb-green)"; 
        setTimeout(() => { icon.className = "fa-regular fa-copy"; icon.style.color = "var(--fb-muted)"; }, 1500); 
    }
}
window.copyPhoneNumber = copyPhoneNumber;

// ==========================================
// 5. RENDER UI 
// ==========================================
export function hideSmsCard(id) {
    const orderIndex = activeOrders.findIndex(o => o.id === id);
    if (orderIndex > -1) {
        activeOrders[orderIndex].isHidden = true;
        renderSmsOrders(); 
    }
}
window.hideSmsCard = hideSmsCard;

function renderSmsOrders() {
    const container = document.getElementById('sms-active-orders'); 
    container.innerHTML = '';
    
    const visibleOrders = activeOrders.filter(o => !o.isHidden);
    if(!visibleOrders || visibleOrders.length === 0) return;
    
    const now = Date.now();

    visibleOrders.forEach((o, index) => {
        let isSuccess = (o.status === "OTP_RECEIVED" || o.otp);
        let otpDisplay = isSuccess ? `<span style="color:var(--fb-green); letter-spacing:4px; font-size:26px; font-weight:bold; font-family:monospace;">${o.otp}</span>` : `<div class="loader-bars"><span></span><span></span><span></span></div>`;
        const priceDisplay = o.price && o.price !== '...' ? parseInt(o.price).toLocaleString('id-ID') : '...';

        const wait = o.cancelUnlockTime - now;
        let passed2Mins = wait <= 0;

        let resendState = isSuccess ? '' : 'disabled'; 
        let cancelReplaceState = (passed2Mins && !isSuccess && !o.isAutoCanceling) ? '' : 'disabled';
        let doneState = isSuccess ? 'style="background:#e6f4ea; color:var(--fb-green); border-color:var(--fb-green);"' : 'disabled';
        
        const displayNumber = index + 1;
        const passProductId = o.productId ? `'${o.productId}'` : 'null'; 

        const cardHTML = `<div class="order-card" id="order-${o.id}">
            <div style="display:flex; justify-content:space-between; margin-bottom:15px; border-bottom:1px dashed var(--fb-border); padding-bottom:15px; align-items:center;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-weight:bold; color:var(--fb-muted); font-size:15px;">${displayNumber}.</span>
                    <span style="color:var(--fb-blue); font-weight:bold; font-family:monospace; font-size:15px;">#${o.id}</span>
                    <span class="badge-status" style="font-size:10px; color:var(--fb-text); font-family:sans-serif; background:rgba(0,0,0,0.1);">ACTIVE</span>
                    <span class="price-box" style="font-size:16px; font-weight:900; color:var(--fb-red); font-family:monospace;">Rp ${priceDisplay}</span>
                </div>
                
                <div style="display:flex; align-items:center; gap:10px;">
                    <i class="fa-regular fa-eye-slash hide-btn-icon" onclick="hideSmsCard(${o.id})" style="color: var(--fb-muted); cursor:pointer; font-size:14px; padding: 5px;" title="Sembunyikan"></i>
                    <span class="sms-timer" id="timer-${o.id}" style="font-family:monospace; font-weight:bold; color:var(--fb-blue);">--:--</span>
                </div>
            </div>
            <div style="font-size:11px; color:var(--fb-muted); margin-bottom:5px; text-transform:uppercase;">Tap untuk salin:</div>
            <div class="phone-box" onclick="copyPhoneNumber('${o.phone}', 'copy-icon-${o.id}')">
                <span class="phone-text-span">${o.phone}</span><i id="copy-icon-${o.id}" class="fa-regular fa-copy" style="color: var(--fb-muted);"></i>
            </div>
            <div style="text-align: center; margin: 10px 0 15px 0; padding: 15px 0; background: #fafafa; border-radius: 8px;">
                <div style="font-size:11px; color:var(--fb-muted); font-weight:bold; letter-spacing:1px; margin-bottom:5px;">KODE OTP</div>
                <div class="otp-container" style="min-height:35px; display:flex; align-items:center; justify-content:center;">${otpDisplay}</div>
            </div>
            <div class="btn-grid-4">
                <button class="sms-btn btn-done" onclick="actSms('finish', ${o.id})" ${doneState}>✓ DONE</button>
                <button class="sms-btn btn-resend" onclick="actSms('resend', ${o.id})" ${resendState}>↻ RESEND</button>
                <button class="sms-btn btn-cancel" onclick="actSms('cancel', ${o.id})" ${cancelReplaceState}>✕ CANCEL</button>
                <button class="sms-btn btn-replace" id="btn-replace-${o.id}" onclick="replaceSms(${o.id}, ${passProductId})" ${cancelReplaceState}>⇄ REPLACE</button>
            </div>
        </div>`;
        container.insertAdjacentHTML('afterbegin', cardHTML);
    });
}

// ==========================================
// 6. POLLING & TIMER
// ==========================================
function startPollingAndTimer() {
    if (timerInterval) clearInterval(timerInterval);
    if (pollingInterval) clearInterval(pollingInterval);
    
    timerInterval = setInterval(() => {
        const now = Date.now();
        let needsRender = false;

        activeOrders.forEach((order, index) => {
            const timeLeft = order.expiresAt - now;
            const timerElement = document.getElementById(`timer-${order.id}`);
            
            if (timeLeft <= 0) { 
                activeOrders.splice(index, 1); 
                needsRender = true; 
                return; 
            }
            
            if (timerElement && !order.isHidden) {
                const m = Math.floor((timeLeft / 1000 / 60) % 60);
                const s = Math.floor((timeLeft / 1000) % 60);
                timerElement.innerText = `${m}:${s < 10 ? '0'+s : s}`;
                timerElement.style.color = timeLeft < 600000 ? "var(--fb-red)" : "var(--fb-blue)"; 
            }

            if(order.cancelUnlockTime - now <= 0 && !order.isHidden) {
                const orderCard = document.getElementById(`order-${order.id}`);
                if(orderCard) {
                    const btnCancel = orderCard.querySelector('.btn-cancel');
                    const btnReplace = orderCard.querySelector('.btn-replace');
                    if(btnCancel && btnCancel.disabled && !order.otp && !order.isAutoCanceling) btnCancel.disabled = false;
                    if(btnReplace && btnReplace.disabled && !order.otp && !order.isAutoCanceling) btnReplace.disabled = false;
                }
            }

            if (timeLeft <= 600000 && !order.otp && !order.isAutoCanceling) {
                order.isAutoCanceling = true; 
                actSms('cancel', order.id, true); 
                if(!order.isHidden) needsRender = true;
            }
        });
        
        if (needsRender) { renderSmsOrders(); updateSmsBal(); }
        if (activeOrders.length === 0) clearInterval(timerInterval);
    }, 1000);

    pollingInterval = setInterval(async () => {
        if (activeOrders.length === 0) { clearInterval(pollingInterval); return; }
        try {
            const j = await apiCall('/get-active'); 
            if(j.success) {
                let stateChanged = false;

                activeOrders = activeOrders.filter(o => {
                    if (o.isHidden) return true; 
                    if (o.status === "OTP_RECEIVED") return true; 
                    
                    let serverMatch = j.data.find(so => so.id === o.id);
                    if (serverMatch) {
                        if (serverMatch.otp_code) {
                            o.otp = serverMatch.otp_code;
                            o.status = "OTP_RECEIVED";
                            stateChanged = true;
                        }
                        return true;
                    }
                    stateChanged = true;
                    return false; 
                });

                if (stateChanged) { renderSmsOrders(); updateSmsBal(); }
            }
        } catch (e) {}
    }, 5000);
}

// ==========================================
// 7. AKSI TOMBOL
// ==========================================
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
                showModal("Gagal Pesan Baru", n.error?.message || "Nomor lama dibatalkan, namun gagal pesan baru.", "alert");
                renderSmsOrders(); updateSmsBal();
            }
        } else {
            showModal("Gagal Batal", c.error?.message || "Server belum mengizinkan pembatalan.", "alert");
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

    let title = "Konfirmasi", msg = "Lanjutkan?", type = "confirm";
    if(action === 'cancel') { title = "Batalkan"; msg = isAuto ? "Waktu sisa 10 menit, membatalkan otomatis..." : "Yakin batalkan pesanan ini? Saldo dikembalikan."; type = "danger"; }
    if(action === 'resend') { title = "Kirim Ulang"; msg = "Meminta kode OTP baru?"; }
    if(action === 'finish') { title = "Selesaikan"; msg = "Konfirmasi pesanan selesai dan tutup tiket."; }

    if(!isAuto) {
        if(!await showModal(title, msg, type)) return;
    }

    try {
        const res = await apiCall('/order-action', 'POST', { id, action }); 
        if(res.success) { 
            if(action === 'cancel' || action === 'finish') { 
                activeOrders = activeOrders.filter(o => o.id !== id); 
            }
            if(action === 'resend' && !isAuto) {
                showModal("Info", "Permintaan kirim ulang terkirim.", "alert");
            }
        } else if (!isAuto) {
            showModal("Gagal", res.error?.message || "Ditolak oleh server.", "alert");
        }
        renderSmsOrders(); 
        updateSmsBal();
    } catch(e) {
        if (!isAuto) showModal("Error", "Gagal menghubungi server.", "alert");
    }
}
window.actSms = actSms;
