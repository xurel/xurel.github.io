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
// 2. LOGIKA TERPISAH (SMS-CODE vs HERO-SMS)
// ==========================================
const LogicCode = {
    formatPrice: (price) => `Rp ${parseInt(price || 0).toLocaleString('id-ID')}`,
    filterActiveOrders: (localOrders, serverOrders) => {
        let stateChanged = false;
        const filtered = localOrders.filter(local => {
            if (local.isHidden) return true; 
            const sMatch = serverOrders.find(s => String(s.id) === String(local.id));
            if (sMatch) {
                if (sMatch.otp_code) { local.otp = sMatch.otp_code; local.status = "OTP_RECEIVED"; }
                stateChanged = true; return true;
            }
            stateChanged = true; return false; // Instan hapus jika tidak ada di server
        });
        return { orders: filtered, changed: stateChanged };
    }
};

const LogicHero = {
    formatPrice: (price) => `${price}`, 
    filterActiveOrders: (localOrders, serverOrders) => {
        let stateChanged = false;
        const filtered = localOrders.filter(local => {
            if (local.isHidden || local.status === "OTP_RECEIVED") return true; 
            const sMatch = serverOrders.find(s => String(s.id) === String(local.id));
            if (sMatch) {
                if (sMatch.otp_code) { local.otp = sMatch.otp_code; local.status = "OTP_RECEIVED"; }
                stateChanged = true; return true;
            }
            // Grace Period 30 Detik khusus HeroSMS (Delay server API)
            if (Date.now() - (local.cancelUnlockTime - 120000) < 30000) return true; 
            stateChanged = true; return false; 
        });
        return { orders: filtered, changed: stateChanged };
    }
};

function getActiveLogic() { return activeProviderKey === "smscode" ? LogicCode : LogicHero; }

// ==========================================
// 3. KONEKSI API & INISIALISASI UI
// ==========================================
async function apiCall(endpoint, method = "GET", body = null) {
    const options = { method, headers: { "Content-Type": "application/json", "X-Server-Name": currentServerName } };
    if (body) options.body = JSON.stringify(body);
    const res = await fetch(`${BASE_URL}${endpoint}`, options);
    return await res.json();
}

function getErrMsg(res) {
    if (res?.error?.message) return res.error.message;
    if (typeof res?.error === 'string') return res.error;
    if (res?.message) return res.message;
    if (res?.error_msg) return res.error_msg;
    return JSON.stringify(res) || "Ditolak oleh server.";
}

window.addEventListener('appSwitched', (e) => { if(e.detail === 'sms' && !smsInitialized) initSms(); });

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
    applySmsLockUI(); refreshSms(); 
}

async function loadServersList() {
    const select = document.getElementById('sms-server');
    select.innerHTML = '<option>Memuat...</option>';
    try {
        const res = await fetch(`${BASE_URL}/api/servers`);
        const data = await res.json();
        if(data.success && data.servers.length) select.innerHTML = data.servers.map(k => `<option value="${k}">${k}</option>`).join('');
        else throw new Error("Kosong");
    } catch (e) {
        select.innerHTML = ["HP1", "HP2"].map(k => `<option value="${k}">${k}</option>`).join('');
    }
    const saved = localStorage.getItem(`xurel_hp_${activeProviderKey}`);
    currentServerName = (saved && Array.from(select.options).some(o => o.value === saved)) ? saved : select.options[0].value;
    select.value = currentServerName;
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
    isSmsLocked = !isSmsLocked; localStorage.setItem('xurel_locked', isSmsLocked); applySmsLockUI(); 
}
window.toggleSmsLock = toggleSmsLock;

function applySmsLockUI() {
    const sHp = document.getElementById('sms-server'), sProv = document.getElementById('sms-provider'), icon = document.getElementById('sms-lock-icon'); 
    if(sHp) sHp.disabled = isSmsLocked; if(sProv) sProv.disabled = isSmsLocked;
    if(icon) { icon.className = isSmsLocked ? 'fa-solid fa-lock' : 'fa-solid fa-unlock'; icon.style.color = isSmsLocked ? 'var(--fb-red)' : 'var(--fb-muted)'; }
}

export function refreshSms() { 
    document.getElementById('sms-prices').innerHTML = '<div style="padding:30px; text-align:center; color:#888;">Mengambil Data...</div>'; 
    updateSmsBal(); loadSmsPrices(); syncServerOrders(); 
}
window.refreshSms = refreshSms;

async function updateSmsBal() {
    try { 
        const json = await apiCall('/get-balance'); 
        document.getElementById('sms-balance').innerText = json.success ? getActiveLogic().formatPrice(json.data.balance) : "Error"; 
    } catch(e) { document.getElementById('sms-balance').innerText = "Offline"; }
}

async function loadSmsPrices() {
    const box = document.getElementById('sms-prices');
    try {
        const json = await apiCall('/get-prices'); 
        if (json.success && json.data.length > 0) {
            availableProducts = json.data; 
            box.innerHTML = json.data.map(i => {
                let sName = i.name.replace(/Indonesia/ig, '').replace(/\s+/g, ' ').trim();
                return `<div class="price-item" onclick="buySms('${i.id}', ${i.price}, '${sName}')">
                            <div style="flex: 1; min-width: 0; padding-right: 10px;"><div style="font-weight:bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${sName}</div></div>
                            <div style="display: flex; align-items: center; flex-shrink: 0; gap: 8px;">
                                <div style="width: 65px; text-align: right; color:var(--fb-red); font-family:monospace; font-size:14px; font-weight: 900;">${getActiveLogic().formatPrice(i.price)}</div>
                                <div style="width: 75px; text-align: right; font-size:12px; color:var(--fb-muted);">${i.available} stok</div>
                            </div>
                        </div>`;
            }).join('');
        } else box.innerHTML = `<div style="padding:30px; text-align:center; color:var(--fb-red); font-weight:bold;">${json.error || 'Stok Kosong'}</div>`;
    } catch (e) { box.innerHTML = `<div style="padding:30px; text-align:center; color:var(--fb-red);"><b>Gagal Terhubung</b></div>`; }
}

// ==========================================
// 4. LOGIKA ORDER & PILIH PROVIDER
// ==========================================
export async function buySms(pid, price, name) {
    // JIKA HERO SMS: Tampilkan Pilihan Provider di dalam Box
    if (activeProviderKey === "herosms") {
        const box = document.getElementById('sms-prices');
        box.innerHTML = '<div style="padding:30px; text-align:center; color:#888;">Memuat Provider...</div>';
        try {
            const r = await apiCall('/get-operators');
            const ops = r.success ? r.data : ["any", "telkomsel", "indosat", "axis", "three", "smartfren"];
            
            let html = `<div style="padding:15px 10px; font-weight:bold; text-align:center; color:var(--fb-blue); border-bottom:1px dashed var(--fb-border); margin-bottom:10px;">Pilih Provider untuk Harga ${price}</div>`;
            
            ops.forEach(op => {
                let opName = op === "any" ? "🌟 RANDOM / BEBAS" : op.toUpperCase();
                html += `<div class="price-item" onclick="executeBuySms('${pid}', ${price}, '${name}', '${op}')">
                    <div style="flex: 1; font-weight:bold; padding-left:5px; color:var(--fb-text);">${opName}</div>
                    <i class="fa-solid fa-chevron-right" style="color:var(--fb-muted); margin-right:5px;"></i>
                </div>`;
            });
            html += `<button class="sms-btn btn-cancel" style="width:100%; margin-top:15px; padding:12px;" onclick="refreshSms()">Batal / Kembali</button>`;
            box.innerHTML = html;
        } catch(e) { executeBuySms(pid, price, name, "any"); }
    } else {
        // JIKA SMSCODE: Langsung Pesan
        executeBuySms(pid, price, name, "any");
    }
}
window.buySms = buySms;

export async function executeBuySms(pid, price, name, operator) {
    const priceText = getActiveLogic().formatPrice(price);
    const opText = operator !== "any" ? ` (Prov: ${operator.toUpperCase()})` : "";
    if(!await showModal("Pesan Baru", `Beli nomor untuk ${name}${opText} seharga ${priceText}?`, "confirm")) {
        if(activeProviderKey === "herosms") refreshSms(); 
        return;
    }
    
    try {
        const j = await apiCall('/create-order', 'POST', { product_id: pid, price: price, operator: operator });
        if(j.success) { 
            const o = j.data.orders[0]; 
            const expTime = Date.now() + (20 * 60000);
            const lockTime = Date.now() + (120 * 1000);
            
            localStorage.setItem(`xurel_pid_${activeProviderKey}_${o.id}`, pid);
            localStorage.setItem(`xurel_exp_${activeProviderKey}_${o.id}`, expTime);
            localStorage.setItem(`xurel_lock_${activeProviderKey}_${o.id}`, lockTime);
            
            activeOrders.unshift({
                id: o.id, productId: pid, phone: o.phone_number, price: price, otp: null, status: "ACTIVE",
                expiresAt: expTime, cancelUnlockTime: lockTime, isAutoCanceling: false, isHidden: false
            });
            startPollingAndTimer(); updateSmsBal(); renderSmsOrders();
        } else { showModal("Gagal", getErrMsg(j), "alert"); refreshSms(); }
    } catch(e){ refreshSms(); }
}
window.executeBuySms = executeBuySms;

async function syncServerOrders() {
    try { 
        const j = await apiCall('/get-active'); 
        if(j.success) { 
            let serverOrders = j.data || [];
            activeOrders = serverOrders.map(o => {
                let pid = localStorage.getItem(`xurel_pid_${activeProviderKey}_${o.id}`) || o.product_id;
                let price = o.price;
                if(!price && pid) { const pMatch = availableProducts.find(p => String(p.id) === String(pid)); if (pMatch) price = pMatch.price; }
                
                let exp = parseInt(localStorage.getItem(`xurel_exp_${activeProviderKey}_${o.id}`)) || (Date.now() + 20*60000);
                let lock = parseInt(localStorage.getItem(`xurel_lock_${activeProviderKey}_${o.id}`)) || (Date.now() + 120000);

                return {
                    id: o.id, productId: pid, phone: o.phone_number || 'Mencari Nomor...', price: price, 
                    otp: o.otp_code, status: o.otp_code ? "OTP_RECEIVED" : "ACTIVE",
                    expiresAt: exp, cancelUnlockTime: lock, isAutoCanceling: false, isHidden: false
                };
            });
            startPollingAndTimer(); renderSmsOrders();
        } 
    } catch(e) {}
}

export function copyPhoneNumber(txt, iconId) {
    if(txt.includes('Mencari')) return; 
    navigator.clipboard.writeText(txt); const icon = document.getElementById(iconId);
    if(icon) { icon.className = "fa-solid fa-circle-check"; icon.style.color = "var(--fb-green)"; setTimeout(() => { icon.className = "fa-regular fa-copy"; icon.style.color = "var(--fb-muted)"; }, 1500); }
}
window.copyPhoneNumber = copyPhoneNumber;

export function hideSmsCard(id) {
    const idx = activeOrders.findIndex(o => o.id === id);
    if (idx > -1) { activeOrders[idx].isHidden = true; renderSmsOrders(); }
}
window.hideSmsCard = hideSmsCard;

function renderSmsOrders() {
    const container = document.getElementById('sms-active-orders'); container.innerHTML = '';
    const visibleOrders = activeOrders.filter(o => !o.isHidden);
    if(!visibleOrders.length) return;
    
    visibleOrders.forEach((o, index) => {
        let isSuccess = (o.status === "OTP_RECEIVED" || o.otp);
        let otpDisplay = isSuccess ? `<span style="color:var(--fb-green); letter-spacing:4px; font-size:26px; font-weight:bold; font-family:monospace;">${o.otp}</span>` : `<div class="loader-bars"><span></span><span></span><span></span></div>`;
        
        const priceDisplay = o.price && o.price !== '...' ? getActiveLogic().formatPrice(o.price) : '...';
        let passed2Mins = (o.cancelUnlockTime - Date.now()) <= 0;

        let resendState = isSuccess ? '' : 'disabled'; 
        let cancelReplaceState = (passed2Mins && !isSuccess && !o.isAutoCanceling) ? '' : 'disabled';
        let doneState = isSuccess ? 'style="background:#e6f4ea; color:var(--fb-green); border-color:var(--fb-green);"' : 'disabled';
        
        const pIdStr = o.productId ? `'${o.productId}'` : 'null'; 

        container.insertAdjacentHTML('afterbegin', `<div class="order-card" id="order-${o.id}">
            <div style="display:flex; justify-content:space-between; margin-bottom:15px; border-bottom:1px dashed var(--fb-border); padding-bottom:15px; align-items:center;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-weight:bold; color:var(--fb-muted); font-size:15px;">${index + 1}.</span>
                    <span style="color:var(--fb-blue); font-weight:bold; font-family:monospace; font-size:15px;">#${o.id}</span>
                    <span class="badge-status" style="font-size:10px; color:var(--fb-text); font-family:sans-serif; background:rgba(0,0,0,0.1);">ACTIVE</span>
                    <span class="price-box" style="font-size:16px; font-weight:900; color:var(--fb-red); font-family:monospace;">${priceDisplay}</span>
                </div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <i class="fa-regular fa-eye-slash hide-btn-icon" onclick="hideSmsCard(${o.id})" style="color: var(--fb-muted); cursor:pointer; font-size:14px; padding: 5px;"></i>
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
                <button class="sms-btn btn-replace" id="btn-replace-${o.id}" onclick="replaceSms(${o.id}, ${pIdStr})" ${cancelReplaceState}>⇄ REPLACE</button>
            </div>
        </div>`);
    });
}

function startPollingAndTimer() {
    if (timerInterval) clearInterval(timerInterval); if (pollingInterval) clearInterval(pollingInterval);
    
    timerInterval = setInterval(() => {
        const now = Date.now(); let needsRender = false;
        activeOrders.forEach((o, i) => {
            const timeLeft = o.expiresAt - now;
            if (timeLeft <= 0) { activeOrders.splice(i, 1); needsRender = true; return; }
            
            const tEl = document.getElementById(`timer-${o.id}`);
            if (tEl && !o.isHidden) {
                tEl.innerText = `${Math.floor((timeLeft/1000/60)%60)}:${Math.floor((timeLeft/1000)%60).toString().padStart(2,'0')}`;
                tEl.style.color = timeLeft < 600000 ? "var(--fb-red)" : "var(--fb-blue)"; 
            }

            if(o.cancelUnlockTime - now <= 0 && !o.isHidden) {
                const card = document.getElementById(`order-${o.id}`);
                if(card) {
                    const bC = card.querySelector('.btn-cancel'), bR = card.querySelector('.btn-replace');
                    if(bC && bC.disabled && !o.otp && !o.isAutoCanceling) bC.disabled = false;
                    if(bR && bR.disabled && !o.otp && !o.isAutoCanceling) bR.disabled = false;
                }
            }

            if (timeLeft <= 600000 && !o.otp && !o.isAutoCanceling) { o.isAutoCanceling = true; actSms('cancel', o.id, true); if(!o.isHidden) needsRender = true; }
        });
        if (needsRender) { renderSmsOrders(); updateSmsBal(); }
        if (activeOrders.length === 0) clearInterval(timerInterval);
    }, 1000);

    pollingInterval = setInterval(async () => {
        if (activeOrders.length === 0) { clearInterval(pollingInterval); return; }
        try {
            const j = await apiCall('/get-active'); 
            if(j.success) {
                const logic = getActiveLogic();
                const result = logic.filterActiveOrders(activeOrders, j.data);
                activeOrders = result.orders;
                if (result.changed) { renderSmsOrders(); updateSmsBal(); }
            }
        } catch (e) {}
    }, 5000);
}

// ==========================================
// 5. AKSI TOMBOL
// ==========================================
export async function replaceSms(id, pid) {
    const btn = document.getElementById(`btn-replace-${id}`);
    if (!pid || pid === 'null') { showModal("Peringatan", "Sistem tidak mengenali ID Produk.", "alert"); return; }
    if (btn) { btn.disabled = true; btn.innerText = "PROSES..."; }
    
    try {
        const c = await apiCall('/order-action', 'POST', { id, action: 'cancel' });
        if (c.success || c.error?.code === 'NOT_FOUND') {
            
            let order = activeOrders.find(o => o.id === id);
            let orderPrice = order ? order.price : null;

            activeOrders = activeOrders.filter(o => o.id !== id);
            localStorage.removeItem(`xurel_pid_${activeProviderKey}_${id}`); localStorage.removeItem(`xurel_exp_${activeProviderKey}_${id}`); localStorage.removeItem(`xurel_lock_${activeProviderKey}_${id}`);
            
            const n = await apiCall('/create-order', 'POST', { product_id: pid, price: orderPrice, operator: "any" });
            if (n.success) {
                const od = n.data.orders[0];
                const exp = Date.now() + (20 * 60000); const lock = Date.now() + (120 * 1000);
                localStorage.setItem(`xurel_pid_${activeProviderKey}_${od.id}`, pid); localStorage.setItem(`xurel_exp_${activeProviderKey}_${od.id}`, exp); localStorage.setItem(`xurel_lock_${activeProviderKey}_${od.id}`, lock);
                
                activeOrders.unshift({
                    id: od.id, productId: pid, phone: od.phone_number, price: orderPrice || 0,
                    otp: null, status: "ACTIVE", expiresAt: exp, cancelUnlockTime: lock, isAutoCanceling: false, isHidden: false
                });
                startPollingAndTimer(); updateSmsBal(); renderSmsOrders(); window.scrollTo({ top: 0, behavior: 'smooth' }); copyPhoneNumber(od.phone_number, `copy-icon-${od.id}`); 
            } else { showModal("Gagal Pesan Baru", n.error?.message || n.error, "alert"); renderSmsOrders(); updateSmsBal(); }
        } else { showModal("Gagal Batal", c.error?.message || c.error, "alert"); if (btn) { btn.disabled = false; btn.innerText = "⇄ REPLACE"; } }
    } catch (e) { showModal("Error", "Gagal terhubung.", "alert"); if (btn) { btn.disabled = false; btn.innerText = "⇄ REPLACE"; } }
}
window.replaceSms = replaceSms;

export async function actSms(action, id, isAuto = false) {
    let order = activeOrders.find(o => o.id === id); if (!order && !isAuto) return;

    if (action === 'finish') {
        const btn = document.querySelector(`#order-${id} .btn-done`); if (btn) btn.innerText = "Menutup..."; 
        try { await apiCall('/order-action', 'POST', { id, action: 'finish' }); } catch(e) {}
        activeOrders = activeOrders.filter(o => o.id !== id);
        localStorage.removeItem(`xurel_pid_${activeProviderKey}_${id}`); localStorage.removeItem(`xurel_exp_${activeProviderKey}_${id}`); localStorage.removeItem(`xurel_lock_${activeProviderKey}_${id}`);
        renderSmsOrders(); updateSmsBal(); return; 
    }

    let title = "Konfirmasi", msg = "Lanjutkan?", type = "confirm";
    if(action === 'cancel') { title = "Batalkan"; msg = isAuto ? "Otomatis..." : "Yakin batalkan pesanan ini?"; type = "danger"; }
    if(action === 'resend') { title = "Kirim Ulang"; msg = "Meminta kode OTP baru?"; }
    if(!isAuto && !await showModal(title, msg, type)) return;

    try {
        const res = await apiCall('/order-action', 'POST', { id, action }); 
        if(res.success) { 
            if(action === 'cancel') { 
                activeOrders = activeOrders.filter(o => o.id !== id); 
                localStorage.removeItem(`xurel_pid_${activeProviderKey}_${id}`); localStorage.removeItem(`xurel_exp_${activeProviderKey}_${id}`); localStorage.removeItem(`xurel_lock_${activeProviderKey}_${id}`);
            }
            if(action === 'resend' && !isAuto) showModal("Info", "Permintaan terkirim.", "alert");
        } else if (!isAuto) { showModal("Gagal", getErrMsg(res), "alert"); }
        renderSmsOrders(); updateSmsBal();
    } catch(e) { if (!isAuto) showModal("Error", "Gagal menghubungi server.", "alert"); }
}
window.actSms = actSms;
