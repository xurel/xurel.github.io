import { showModal } from './ui.js';

// ==========================================
// 1. KONFIGURASI MULTI-PROVIDER
// ==========================================
const PROVIDERS = {
    "smscode": { name: "Code", url: "https://sms.aam-zip.workers.dev" },
    "herosms": { name: "Hero", url: "https://hero.aam-zip.workers.dev" } // <-- GANTI DENGAN WORKER HERO ANDA
};

let activeProviderKey = localStorage.getItem('xurel_provider') || "smscode";
let BASE_URL = PROVIDERS[activeProviderKey].url;

let currentServerName = ""; 
let smsInitialized = false; 
let isSmsLocked = false;

let activeOrders = [];
let pollingInterval = null;
let timerInterval = null;
let availableProducts = [];

// ==========================================
// 2. LOGIKA KHUSUS SMS-CODE
// ==========================================
const LogicCode = {
    formatPrice: (price) => `Rp ${parseInt(price || 0).toLocaleString('id-ID')}`,
    
    // SMSCode sinkronisasi instan (Jika hilang di server, langsung hapus di layar)
    filterActiveOrders: (localOrders, serverOrders) => {
        let stateChanged = false;
        const filtered = localOrders.filter(local => {
            if (local.isHidden) return true; 
            
            const serverMatch = serverOrders.find(s => String(s.id) === String(local.id));
            if (serverMatch) {
                if (serverMatch.otp_code) {
                    local.otp = serverMatch.otp_code;
                    local.status = "OTP_RECEIVED";
                }
                if (serverMatch.expires_at) local.expiresAt = new Date(serverMatch.expires_at).getTime();
                if (serverMatch.created_at) local.cancelUnlockTime = new Date(serverMatch.created_at).getTime() + 120000;
                stateChanged = true;
                return true;
            }
            // Jika tidak ada di server SMSCode, berarti pesanan sudah mati
            stateChanged = true; 
            return false; 
        });
        return { orders: filtered, changed: stateChanged };
    }
};

// ==========================================
// 3. LOGIKA KHUSUS HERO-SMS
// ==========================================
const LogicHero = {
    formatPrice: (price) => `${price}`, // HeroSMS desimal murni tanpa Rp
    
    // HeroSMS butuh waktu (Grace Period 30 detik agar pesanan tidak langsung hilang)
    filterActiveOrders: (localOrders, serverOrders) => {
        let stateChanged = false;
        const filtered = localOrders.filter(local => {
            if (local.isHidden) return true; 
            if (local.status === "OTP_RECEIVED") return true; 
            
            const serverMatch = serverOrders.find(s => String(s.id) === String(local.id));
            if (serverMatch) {
                if (serverMatch.otp_code) {
                    local.otp = serverMatch.otp_code;
                    local.status = "OTP_RECEIVED";
                }
                if (serverMatch.expires_at) local.expiresAt = new Date(serverMatch.expires_at).getTime();
                if (serverMatch.created_at) local.cancelUnlockTime = new Date(serverMatch.created_at).getTime() + 120000;
                stateChanged = true;
                return true;
            }
            
            // Grace Period 30 Detik khusus HeroSMS
            const timeSinceCreated = Date.now() - (local.cancelUnlockTime - 120000);
            if (timeSinceCreated < 30000) {
                return true; 
            }
            
            stateChanged = true; 
            return false; 
        });
        return { orders: filtered, changed: stateChanged };
    }
};

// Fungsi Jembatan untuk memilih logika yang aktif
function getActiveLogic() {
    return activeProviderKey === "smscode" ? LogicCode : LogicHero;
}

// ==========================================
// 4. CORE SYSTEM & API
// ==========================================
async function apiCall(endpoint, method = "GET", body = null) {
    const options = { 
        method: method, 
        headers: { "Content-Type": "application/json", "X-Server-Name": currentServerName } 
    };
    if (body) options.body = JSON.stringify(body);
    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    return await response.json();
}

function getErrMsg(res) {
    if (res?.error?.message) return res.error.message;
    if (typeof res?.error === 'string') return res.error;
    if (res?.message) return res.message;
    if (res?.error_msg) return res.error_msg;
    return JSON.stringify(res) || "Ditolak oleh server.";
}

// ==========================================
// 5. INISIALISASI & UI (SAMA UNTUK KEDUANYA)
// ==========================================
window.addEventListener('appSwitched', (e) => { 
    if(e.detail === 'sms' && !smsInitialized) initSms(); 
});

async function initSms() {
    smsInitialized = true; 
    const selectHp = document.getElementById('sms-server');
    
    if (!document.getElementById('sms-provider')) {
        const provSelect = document.createElement('select');
        provSelect.id = 'sms-provider';
        provSelect.className = selectHp.className; 
        provSelect.style.marginRight = "10px"; 
        provSelect.style.fontWeight = "bold";
        provSelect.style.color = "var(--fb-blue)";
        provSelect.onchange = changeSmsProvider;
        
        provSelect.innerHTML = Object.keys(PROVIDERS).map(k => `<option value="${k}">${PROVIDERS[k].name}</option>`).join('');
        provSelect.value = activeProviderKey;
        selectHp.parentNode.insertBefore(provSelect, selectHp);
    }
    
    await loadServersList();
    isSmsLocked = localStorage.getItem('xurel_locked') === 'true';
    applySmsLockUI(); 
    refreshSms(); 
}

async function loadServersList() {
    const select = document.getElementById('sms-server');
    select.innerHTML = '<option>Memuat...</option>';
    try {
        const res = await fetch(`${BASE_URL}/api/servers`);
        const data = await res.json();
        if(data.success && data.servers && data.servers.length > 0) {
            select.innerHTML = data.servers.map(k => `<option value="${k}">${k}</option>`).join('');
        } else throw new Error("Kosong");
    } catch (e) {
        select.innerHTML = ["HP1", "HP2"].map(k => `<option value="${k}">${k}</option>`).join('');
    }
    
    const savedServer = localStorage.getItem(`xurel_hp_${activeProviderKey}`);
    if(savedServer && Array.from(select.options).some(o => o.value === savedServer)) { 
        currentServerName = savedServer; select.value = currentServerName; 
    } else { 
        currentServerName = select.options[0].value; 
    }
}

export async function changeSmsProvider() {
    if(isSmsLocked) return;
    activeProviderKey = document.getElementById('sms-provider').value;
    BASE_URL = PROVIDERS[activeProviderKey].url;
    localStorage.setItem('xurel_provider', activeProviderKey);
    activeOrders = []; document.getElementById('sms-active-orders').innerHTML = '';
    await loadServersList(); refreshSms();
}
window.changeSmsProvider = changeSmsProvider;

export function changeSmsServer() {
    if(isSmsLocked) return; 
    currentServerName = document.getElementById('sms-server').value;
    localStorage.setItem(`xurel_hp_${activeProviderKey}`, currentServerName);
    activeOrders = []; document.getElementById('sms-active-orders').innerHTML = '';
    refreshSms();
}
window.changeSmsServer = changeSmsServer;

export function toggleSmsLock() { 
    isSmsLocked = !isSmsLocked; 
    localStorage.setItem('xurel_locked', isSmsLocked); applySmsLockUI(); 
}
window.toggleSmsLock = toggleSmsLock;

function applySmsLockUI() {
    const selectHp = document.getElementById('sms-server'); 
    const selectProv = document.getElementById('sms-provider'); 
    const icon = document.getElementById('sms-lock-icon'); 
    if(selectHp) selectHp.disabled = isSmsLocked;
    if(selectProv) selectProv.disabled = isSmsLocked;
    if(icon) icon.className = isSmsLocked ? 'fa-solid fa-lock' : 'fa-solid fa-unlock';
    if(icon) icon.style.color = isSmsLocked ? 'var(--fb-red)' : 'var(--fb-muted)';
}

function refreshSms() { 
    document.getElementById('sms-prices').innerHTML = '<div style="padding:30px; text-align:center; color:#888;">Mengambil Data...</div>'; 
    updateSmsBal(); loadSmsPrices(); syncServerOrders(); 
}

async function updateSmsBal() {
    try { 
        const json = await apiCall('/get-balance'); 
        if(json.success) {
            document.getElementById('sms-balance').innerText = getActiveLogic().formatPrice(json.data.balance);
        } else { document.getElementById('sms-balance').innerText = "Error"; }
    } catch(e) { document.getElementById('sms-balance').innerText = "Offline"; }
}

async function loadSmsPrices() {
    const box = document.getElementById('sms-prices');
    try {
        const json = await apiCall('/get-prices'); 
        if (json.success && json.data.length > 0) {
            availableProducts = json.data; 
            box.innerHTML = json.data.map(i => {
                let shortName = i.name.replace(/Indonesia/ig, '').replace(/\s+/g, ' ').trim();
                let displayPrice = getActiveLogic().formatPrice(i.price);
                return `<div class="price-item" onclick="buySms('${i.id}', ${i.price}, '${shortName}')">
                            <div style="flex: 1; min-width: 0; padding-right: 10px;">
                                <div style="font-weight:bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${shortName}</div>
                            </div>
                            <div style="display: flex; align-items: center; flex-shrink: 0; gap: 8px;">
                                <div style="width: 65px; text-align: right; color:var(--fb-red); font-family:monospace; font-size:14px; font-weight: 900;">${displayPrice}</div>
                                <div style="width: 75px; text-align: right; font-size:12px; color:var(--fb-muted);">${i.available} stok</div>
                            </div>
                        </div>`;
            }).join('');
        } else {
            box.innerHTML = `<div style="padding:30px; text-align:center; color:var(--fb-red); font-weight:bold;">${json.error?.message || json.error || 'Stok Kosong'}</div>`;
        }
    } catch (e) {
        box.innerHTML = `<div style="padding:30px; text-align:center; color:var(--fb-red);"><b>Gagal Terhubung</b><br><small style="color:var(--fb-muted);">${e.message}</small></div>`;
    }
}

// ==========================================
// 6. MANAJEMEN ORDER
// ==========================================
export async function buySms(pid, price, name) {
    const priceText = getActiveLogic().formatPrice(price);
    if(!await showModal("Pesan Baru", `Beli nomor untuk ${name} seharga ${priceText}?`, "confirm")) return;
    
    try {
        const j = await apiCall('/create-order', 'POST', { product_id: pid });
        if(j.success) { 
            const o = j.data.orders[0]; 
            const expTime = o.expires_at ? new Date(o.expires_at).getTime() : Date.now() + (20 * 60000);
            const lockTime = o.created_at ? new Date(o.created_at).getTime() + (120 * 1000) : Date.now() + (120 * 1000);
            
            localStorage.setItem(`xurel_pid_${activeProviderKey}_${o.id}`, pid);
            
            activeOrders.unshift({
                id: o.id, productId: pid, phone: o.phone_number, price: price || o.price || o.cost || 0,
                otp: null, status: "ACTIVE", expiresAt: expTime, cancelUnlockTime: lockTime, 
                isAutoCanceling: false, isHidden: false
            });
            startPollingAndTimer(); updateSmsBal(); renderSmsOrders();
        } else { showModal("Gagal", getErrMsg(j), "alert"); }
    } catch(e){}
}
window.buySms = buySms;

async function syncServerOrders() {
    try { 
        const j = await apiCall('/get-active'); 
        if(j.success) { 
            let serverOrders = j.data || [];
            activeOrders = serverOrders.map(order => {
                let savedPid = localStorage.getItem(`xurel_pid_${activeProviderKey}_${order.id}`);
                let finalPid = order.product_id || order.service_id || savedPid || null;
                let fallbackPrice = order.price || order.cost;

                if(!fallbackPrice && finalPid) {
                    const matchProduct = availableProducts.find(p => String(p.id) === String(finalPid));
                    if (matchProduct) fallbackPrice = matchProduct.price;
                }
                
                let exp = order.expires_at ? new Date(order.expires_at).getTime() : Date.now() + (20*60*1000);
                let lock = order.created_at ? new Date(order.created_at).getTime() + 120000 : exp - (18*60000);

                return {
                    id: order.id, productId: finalPid, phone: order.phone_number || order.phone || 'Mencari Nomor...',
                    price: fallbackPrice || '...', otp: order.otp_code,
                    status: order.otp_code ? "OTP_RECEIVED" : "ACTIVE",
                    expiresAt: exp, cancelUnlockTime: lock, isAutoCanceling: false, isHidden: false
                };
            });
            startPollingAndTimer(); renderSmsOrders();
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

export function hideSmsCard(id) {
    const orderIndex = activeOrders.findIndex(o => o.id === id);
    if (orderIndex > -1) { activeOrders[orderIndex].isHidden = true; renderSmsOrders(); }
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
        
        const priceDisplay = o.price && o.price !== '...' ? getActiveLogic().formatPrice(o.price) : '...';
        const wait = o.cancelUnlockTime - now;
        let passed2Mins = wait <= 0;

        let resendState = isSuccess ? '' : 'disabled'; 
        let cancelReplaceState = (passed2Mins && !isSuccess && !o.isAutoCanceling) ? '' : 'disabled';
        let doneState = isSuccess ? 'style="background:#e6f4ea; color:var(--fb-green); border-color:var(--fb-green);"' : 'disabled';
        
        const passProductId = o.productId ? `'${o.productId}'` : 'null'; 

        const cardHTML = `<div class="order-card" id="order-${o.id}">
            <div style="display:flex; justify-content:space-between; margin-bottom:15px; border-bottom:1px dashed var(--fb-border); padding-bottom:15px; align-items:center;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-weight:bold; color:var(--fb-muted); font-size:15px;">${index + 1}.</span>
                    <span style="color:var(--fb-blue); font-weight:bold; font-family:monospace; font-size:15px;">#${o.id}</span>
                    <span class="badge-status" style="font-size:10px; color:var(--fb-text); font-family:sans-serif; background:rgba(0,0,0,0.1);">ACTIVE</span>
                    <span class="price-box" style="font-size:16px; font-weight:900; color:var(--fb-red); font-family:monospace;">${priceDisplay}</span>
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
// 7. POLLING & TIMER
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
            
            if (timeLeft <= 0) { activeOrders.splice(index, 1); needsRender = true; return; }
            
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
                order.isAutoCanceling = true; actSms('cancel', order.id, true); 
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
                // Menjalankan penyaring data sesuai Provider yang sedang aktif
                const logic = getActiveLogic();
                const result = logic.filterActiveOrders(activeOrders, j.data);
                activeOrders = result.orders;
                
                if (result.changed) { renderSmsOrders(); updateSmsBal(); }
            }
        } catch (e) {}
    }, 5000);
}

// ==========================================
// 8. AKSI TOMBOL
// ==========================================
export async function replaceSms(orderId, productId) {
    const btn = document.getElementById(`btn-replace-${orderId}`);
    if (!productId || productId === 'null') { showModal("Peringatan", "Sistem tidak mengenali ID Produk.", "alert"); return; }
    if (btn) { btn.disabled = true; btn.innerText = "PROSES..."; }
    
    try {
        const c = await apiCall('/order-action', 'POST', { id: orderId, action: 'cancel' });
        if (c.success || (c.error && c.error.code === 'NOT_FOUND')) {
            activeOrders = activeOrders.filter(o => o.id !== orderId);
            localStorage.removeItem(`xurel_pid_${activeProviderKey}_${orderId}`); 
            
            const n = await apiCall('/create-order', 'POST', { product_id: productId });
            if (n.success) {
                const od = n.data.orders[0];
                const pInfo = availableProducts.find(p => String(p.id) === String(productId));
                const finalPrice = od.price || od.cost || (pInfo ? pInfo.price : 0);
                
                const expTime = od.expires_at ? new Date(od.expires_at).getTime() : Date.now() + (20 * 60000);
                const lockTime = od.created_at ? new Date(od.created_at).getTime() + (120 * 1000) : Date.now() + (120 * 1000);
                
                localStorage.setItem(`xurel_pid_${activeProviderKey}_${od.id}`, productId);
                
                activeOrders.unshift({
                    id: od.id, productId: productId, phone: od.phone_number, price: finalPrice,
                    otp: null, status: "ACTIVE", expiresAt: expTime, cancelUnlockTime: lockTime, 
                    isAutoCanceling: false, isHidden: false
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
        showModal("Error", "Gagal terhubung ke server.", "alert");
        if (btn) { btn.disabled = false; btn.innerText = "⇄ REPLACE"; }
    }
}
window.replaceSms = replaceSms;

export async function actSms(action, id, isAuto = false) {
    let order = activeOrders.find(o => o.id === id);
    if (!order && !isAuto) return;

    if (action === 'finish') {
        const btn = document.querySelector(`#order-${id} .btn-done`);
        if (btn) btn.innerText = "Menutup..."; 
        try { await apiCall('/order-action', 'POST', { id, action: 'finish' }); } catch(e) {}
        activeOrders = activeOrders.filter(o => o.id !== id);
        localStorage.removeItem(`xurel_pid_${activeProviderKey}_${id}`); 
        renderSmsOrders(); updateSmsBal(); return; 
    }

    let title = "Konfirmasi", msg = "Lanjutkan?", type = "confirm";
    if(action === 'cancel') { title = "Batalkan"; msg = isAuto ? "Otomatis..." : "Yakin batalkan pesanan ini? Saldo dikembalikan."; type = "danger"; }
    if(action === 'resend') { title = "Kirim Ulang"; msg = "Meminta kode OTP baru?"; }

    if(!isAuto) { if(!await showModal(title, msg, type)) return; }

    try {
        const res = await apiCall('/order-action', 'POST', { id, action }); 
        if(res.success) { 
            if(action === 'cancel') { 
                activeOrders = activeOrders.filter(o => o.id !== id); 
                localStorage.removeItem(`xurel_pid_${activeProviderKey}_${id}`); 
            }
            if(action === 'resend' && !isAuto) showModal("Info", "Permintaan kirim ulang terkirim.", "alert");
        } else if (!isAuto) { showModal("Gagal", getErrMsg(res), "alert"); }
        renderSmsOrders(); updateSmsBal();
    } catch(e) { if (!isAuto) showModal("Error", "Gagal menghubungi server.", "alert"); }
}
window.actSms = actSms;
