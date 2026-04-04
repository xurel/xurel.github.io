import { showModal } from './ui.js';

// ==========================================
// 1. KONFIGURASI PROVIDER & STATE
// ==========================================
const PROVIDERS = {
    "smscode": { name: "Code", url: "https://sms.aam-zip.workers.dev" },
    "herosms": { name: "Hero", url: "https://hero.aam-zip.workers.dev" }
};

let activeProviderKey = localStorage.getItem('xurel_provider') || "smscode";
let BASE_URL = PROVIDERS[activeProviderKey].url;

let currentServerName = ""; 
let smsInitialized = false; 
let isSmsLocked = false;
let pollingInterval = null;
let timerInterval = null;

// ==========================================
// 2. INISIALISASI & UI HANDLER
// ==========================================
window.addEventListener('appSwitched', (e) => { if(e.detail === 'sms' && !smsInitialized) initSms(); });

function formatPrice(price) {
    if (activeProviderKey === "herosms") return `${price}`;
    return `Rp ${parseInt(price || 0).toLocaleString('id-ID')}`;
}

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

    isSmsLocked = localStorage.getItem('xurel_locked') === 'true';
    await loadServersList();
    applySmsLockUI();
    refreshSms();

    if(pollingInterval) clearInterval(pollingInterval);
    if(timerInterval) clearInterval(timerInterval);
    pollingInterval = setInterval(pollSms, 5000);
    timerInterval = setInterval(updateSmsTimers, 1000);
}

export async function changeSmsProvider() {
    if(isSmsLocked) return;
    activeProviderKey = document.getElementById('sms-provider').value;
    BASE_URL = PROVIDERS[activeProviderKey].url;
    localStorage.setItem('xurel_provider', activeProviderKey);
    document.getElementById('sms-active-orders').innerHTML = ''; 
    await loadServersList();
    refreshSms();
}
window.changeSmsProvider = changeSmsProvider;

async function loadServersList() {
    const select = document.getElementById('sms-server');
    select.innerHTML = '<option>Memuat...</option>';
    try {
        const res = await apiCall('/api/servers');
        if(res.success && res.servers) select.innerHTML = res.servers.map(k => `<option value="${k}">${k}</option>`).join('');
        else throw new Error("Kosong");
    } catch (e) {
        select.innerHTML = ["HP1", "HP2"].map(k => `<option value="${k}">${k}</option>`).join('');
    }
    const saved = localStorage.getItem(`xurel_hp_${activeProviderKey}`);
    currentServerName = (saved && Array.from(select.options).some(o => o.value === saved)) ? saved : select.options[0].value;
    select.value = currentServerName;
}

export function changeSmsServer() {
    if(isSmsLocked) return;
    currentServerName = document.getElementById('sms-server').value;
    localStorage.setItem(`xurel_hp_${activeProviderKey}`, currentServerName);
    document.getElementById('sms-active-orders').innerHTML = '';
    refreshSms();
}
window.changeSmsServer = changeSmsServer;

export function toggleSmsLock() {
    isSmsLocked = !isSmsLocked; localStorage.setItem('xurel_locked', isSmsLocked); applySmsLockUI();
}
window.toggleSmsLock = toggleSmsLock;

function applySmsLockUI() {
    const sHp = document.getElementById('sms-server');
    const sProv = document.getElementById('sms-provider');
    const icon = document.getElementById('sms-lock-icon');
    if(sHp) sHp.disabled = isSmsLocked;
    if(sProv) sProv.disabled = isSmsLocked;
    if(icon) {
        icon.className = isSmsLocked ? 'fa-solid fa-lock' : 'fa-solid fa-unlock';
        icon.style.color = isSmsLocked ? 'var(--fb-red)' : 'var(--fb-muted)';
    }
}

export function refreshSms() {
    document.getElementById('sms-prices').innerHTML = '<div style="padding:30px; text-align:center; color:#888;">Mengambil Data...</div>';
    updateSmsBal(); loadSmsPrices(); pollSms();
}
window.refreshSms = refreshSms;

// ==========================================
// 3. API PENGHANCUR CRASH (ANTI-ERROR)
// ==========================================
async function apiCall(endpoint, method = "GET", body = null) {
    const options = { method, headers: { "Content-Type": "application/json", "X-Server-Name": currentServerName } };
    if (body) options.body = JSON.stringify(body);
    try {
        const res = await fetch(`${BASE_URL}${endpoint}`, options);
        const text = await res.text(); 
        try {
            return JSON.parse(text); // Jika format benar, jadikan JSON otomatis
        } catch(e) {
            // Jika format gagal diparse (Error Cloudflare/Teks Mentah), ubah manual agar UI panel tidak Crash!
            return { success: res.ok, status: res.ok ? "success" : "failed", error: { message: text || "Format server tidak sesuai" } };
        }
    } catch(err) {
        return { success: false, error: { message: "Jaringan terputus / Server Sibuk" } };
    }
}

async function updateSmsBal() {
    const json = await apiCall('/get-balance');
    const isSuccess = json.success === true || json.status === "success";
    if(isSuccess && json.data) document.getElementById('sms-balance').innerText = formatPrice(json.data.balance);
    else document.getElementById('sms-balance').innerText = "Offline";
}

async function loadSmsPrices() {
    const json = await apiCall('/get-prices');
    const box = document.getElementById('sms-prices');
    const isSuccess = json.success === true || json.status === "success";
    
    if (isSuccess && json.data && json.data.length > 0) {
        box.innerHTML = json.data.map(i => {
            let shortName = i.name.replace(/Indonesia/ig, '').replace(/\s+/g, ' ').trim();
            return `<div class="price-item" onclick="buySms('${i.id}', ${i.price}, '${shortName}')">
                        <div style="flex: 1; min-width: 0; padding-right: 10px;"><div style="font-weight:bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${shortName}</div></div>
                        <div style="display: flex; align-items: center; flex-shrink: 0; gap: 8px;">
                            <div style="width: 65px; text-align: right; color:var(--fb-red); font-family:monospace; font-size:14px; font-weight: 900;">${formatPrice(i.price)}</div>
                            <div style="width: 75px; text-align: right; font-size:12px; color:var(--fb-muted);">${i.available} stok</div>
                        </div>
                    </div>`;
        }).join('');
    } else { 
        box.innerHTML = `<div style="padding:30px; text-align:center; color:var(--fb-red); font-weight:bold;">${json.error?.message || json.message || json.error || 'Stok Kosong'}</div>`;
    }
}

export async function buySms(pid, price, name) {
    if (activeProviderKey === "herosms") {
        const box = document.getElementById('sms-prices');
        box.innerHTML = '<div style="padding:30px; text-align:center; color:#888;">Memuat Provider...</div>';
        
        // HANYA 3 PROVIDER SESUAI PERMINTAAN ANDA (TANPA ANY/RANDOM)
        const ops = ["indosat", "telkomsel", "axis"];
        let html = `<div style="padding:15px 10px; font-weight:bold; text-align:center; color:var(--fb-blue); border-bottom:1px dashed var(--fb-border); margin-bottom:10px;">Pilih Provider untuk Harga ${formatPrice(price)}</div>`;

        ops.forEach(op => {
            let opName = op.toUpperCase();
            html += `<div class="price-item" onclick="executeBuySms('${pid}', ${price}, '${name}', '${op}')">
                <div style="flex: 1; font-weight:bold; padding-left:5px; color:var(--fb-text);">${opName}</div>
                <i class="fa-solid fa-chevron-right" style="color:var(--fb-muted); margin-right:5px;"></i>
            </div>`;
        });
        html += `<button class="sms-btn btn-cancel" style="width:100%; margin-top:15px; padding:12px;" onclick="refreshSms()">Batal / Kembali</button>`;
        box.innerHTML = html;
    } else {
        executeBuySms(pid, price, name, "any");
    }
}
window.buySms = buySms;

export async function executeBuySms(pid, price, name, operator) {
    const pText = formatPrice(price);
    const opText = operator !== "any" ? ` (Prov: ${operator.toUpperCase()})` : "";
    if(!await showModal("Pesan Baru", `Beli nomor untuk ${name}${opText} seharga ${pText}?`, "confirm")) {
        if(activeProviderKey === "herosms") refreshSms();
        return;
    }

    const payload = activeProviderKey === "herosms" ? { product_id: String(pid), price: price, operator: operator } : { product_id: parseInt(pid) };
    const j = await apiCall('/create-order', 'POST', payload);
    const isSuccess = j.success === true || j.status === "success";

    if(isSuccess && j.data) {
        const o = j.data.orders[0];
        const newPhone = o.phone || o.phone_number || o.phoneNumber || 'Mencari Nomor...';
        
        localStorage.setItem(`phone_${activeProviderKey}_${o.id}`, newPhone);
        localStorage.setItem(`price_${activeProviderKey}_${o.id}`, price);
        localStorage.setItem(`pid_${activeProviderKey}_${o.id}`, pid);
        
        pollSms(); updateSmsBal();
        setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 150);
    } else {
        showModal("Gagal", j.error?.message || j.message || j.error || "Gagal memesan stok.", "alert");
        refreshSms();
    }
}
window.executeBuySms = executeBuySms;

// ==========================================
// 4. LOGIKA SERVER SYNC (TIMER & UI)
// ==========================================
async function pollSms() {
    const j = await apiCall('/get-active');
    const isSuccess = j.success === true || j.status === "success";
    if(isSuccess && j.data) renderSmsOrders(j.data);
}

function renderSmsOrders(orders) {
    const container = document.getElementById('sms-active-orders');
    const activeIds = orders ? orders.map(o => `order-${activeProviderKey}-${o.id}`) : [];

    Array.from(container.children).forEach(child => {
        if (!activeIds.includes(child.id)) child.remove();
    });

    if(!orders || !orders.length) return;

    orders.forEach(o => {
        const serverPhone = o.phone || o.phone_number || o.phoneNumber;
        const phone = serverPhone || localStorage.getItem(`phone_${activeProviderKey}_${o.id}`) || localStorage.getItem('phone_'+o.id) || 'Mencari Nomor...';
        if(serverPhone) localStorage.setItem(`phone_${activeProviderKey}_${o.id}`, serverPhone);

        const serverPrice = o.price || o.cost || localStorage.getItem(`price_${activeProviderKey}_${o.id}`) || localStorage.getItem('price_'+o.id);
        if(serverPrice) localStorage.setItem(`price_${activeProviderKey}_${o.id}`, serverPrice);

        let expireTime = 0;
        if (o.expires_at) {
            expireTime = new Date(o.expires_at).getTime();
            if (isNaN(expireTime)) expireTime = parseInt(o.expires_at);
        } else if (o.created_at) {
            let created = new Date(o.created_at).getTime();
            if (isNaN(created)) created = parseInt(o.created_at);
            expireTime = created + (20 * 60000);
        }
        
        if (!expireTime || isNaN(expireTime) || expireTime === 0) { 
            expireTime = localStorage.getItem(`timer_${activeProviderKey}_${o.id}`) || localStorage.getItem('timer_' + o.id); 
            if (!expireTime) expireTime = Date.now() + (20 * 60000); 
        }
        localStorage.setItem(`timer_${activeProviderKey}_${o.id}`, expireTime); 
        
        let passed2Mins = false; 
        if (expireTime) { 
            const remaining = Math.floor((parseInt(expireTime) - Date.now()) / 1000); 
            if (remaining <= 1080) passed2Mins = true; 
        }

        const resendState = o.otp_code ? '' : 'disabled';
        const cancelReplaceState = passed2Mins ? '' : 'disabled';
        let otpDisplay = o.otp_code ? `<span style="color:var(--fb-green); letter-spacing:4px; font-size:26px; font-weight:bold; font-family:monospace;">${o.otp_code}</span>` : `<div class="loader-bars"><span></span><span></span><span></span></div>`;
        const priceDisplay = serverPrice ? formatPrice(serverPrice) : '...';

        const cardId = `order-${activeProviderKey}-${o.id}`;
        const existingCard = document.getElementById(cardId);

        if (existingCard) {
            const phoneBoxSpan = existingCard.querySelector('.phone-text-span');
            if (phoneBoxSpan && phoneBoxSpan.innerText !== phone && phone !== 'Mencari Nomor...') phoneBoxSpan.innerText = phone;

            const otpContainer = existingCard.querySelector('.otp-container');
            if (otpContainer.innerHTML.trim() !== otpDisplay.trim()) otpContainer.innerHTML = otpDisplay;

            const priceBox = existingCard.querySelector('.price-box');
            if (priceBox && priceBox.innerText.includes('...') && serverPrice) priceBox.innerText = priceDisplay;

            if (o.otp_code) {
                const btnDone = existingCard.querySelector('.btn-done');
                if(btnDone && btnDone.disabled) { btnDone.disabled = false; btnDone.style.color = "var(--fb-green)"; btnDone.style.borderColor = "var(--fb-green)"; btnDone.style.background = "#e6f4ea"; }
                const btnResend = existingCard.querySelector('.btn-resend');
                if(btnResend && btnResend.disabled) btnResend.disabled = false;
            }

            if (passed2Mins) {
                const btnCancel = existingCard.querySelector('.btn-cancel');
                const btnReplace = existingCard.querySelector('.btn-replace');
                if(btnCancel) btnCancel.disabled = false;
                if(btnReplace) btnReplace.disabled = false;
            }
        } else {
            const cardHTML = `<div class="order-card" id="${cardId}">
                <div style="display:flex; justify-content:space-between; margin-bottom:15px; border-bottom:1px dashed var(--fb-border); padding-bottom:15px; align-items:center;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="color:var(--fb-blue); font-weight:bold; font-family:monospace; font-size:15px;">#${o.id}</span>
                        <span class="badge-status" style="font-size:10px; color:var(--fb-text); font-family:sans-serif; background:rgba(0,0,0,0.1);">ACTIVE</span>
                        <span class="price-box" style="font-size:16px; font-weight:900; color:var(--fb-red); font-family:monospace;">${priceDisplay}</span>
                    </div>
                    <span class="sms-timer" data-id="${o.id}" style="font-family:monospace; font-weight:bold; color:var(--fb-blue);">--:--</span>
                </div>
                <div style="font-size:11px; color:var(--fb-muted); margin-bottom:5px; text-transform:uppercase;">Nomor HP:</div>
                <div class="phone-box" style="cursor:default;">
                    <span class="phone-text-span">${phone}</span>
                </div>
                <div style="text-align: center; margin: 10px 0 15px 0; padding: 15px 0; background: #fafafa; border-radius: 8px;">
                    <div style="font-size:11px; color:var(--fb-muted); font-weight:bold; letter-spacing:1px; margin-bottom:5px;">KODE OTP</div>
                    <div class="otp-container" style="min-height:35px; display:flex; align-items:center; justify-content:center;">${otpDisplay}</div>
                </div>
                <div class="btn-grid-4">
                    <button class="sms-btn btn-done" onclick="actSms('finish', ${o.id})" ${o.otp_code?'style="background:#e6f4ea; color:var(--fb-green); border-color:var(--fb-green);"':'disabled'}>✓ DONE</button>
                    <button class="sms-btn btn-resend" onclick="actSms('resend', ${o.id})" ${resendState}>↻ RESEND</button>
                    <button class="sms-btn btn-cancel" onclick="actSms('cancel', ${o.id})" ${cancelReplaceState}>✕ CANCEL</button>
                    <button class="sms-btn btn-replace" onclick="actSms('replace', ${o.id})" ${cancelReplaceState}>⇄ REPLACE</button>
                </div>
            </div>`;
            container.insertAdjacentHTML('afterbegin', cardHTML);
        }
    });
    updateSmsTimers();
}

function updateSmsTimers() {
    document.querySelectorAll('.sms-timer').forEach(el => {
        const id = el.dataset.id;
        const end = parseInt(localStorage.getItem(`timer_${activeProviderKey}_${id}`)) || parseInt(localStorage.getItem('timer_' + id));

        if(end) {
            const diff = Math.max(0, Math.floor((end - Date.now())/1000));
            el.innerText = `${Math.floor(diff/60)}:${(diff%60).toString().padStart(2,'0')}`;
            el.style.color = diff < 600 ? "var(--fb-red)" : "var(--fb-blue)"; 
            
            if (diff <= 1080) { 
                const existingCard = document.getElementById(`order-${activeProviderKey}-${id}`); 
                if(existingCard) { 
                    const btnCancel = existingCard.querySelector('.btn-cancel'); 
                    const btnReplace = existingCard.querySelector('.btn-replace'); 
                    if(btnCancel && btnCancel.disabled) btnCancel.disabled = false; 
                    if(btnReplace && btnReplace.disabled) btnReplace.disabled = false; 
                } 
            }
        }
    });
}

// ==========================================
// 5. AKSI ORDER (DIJAMIN TANPA CRASH & NYANGKUT)
// ==========================================
export async function actSms(action, id) {
    let title = "Konfirmasi", msg = "Lanjutkan?", type = "confirm";
    if(action === 'cancel') { title = "Batalkan"; msg = "Yakin batalkan pesanan ini? Saldo dikembalikan."; type = "danger"; }
    if(action === 'replace') { title = "Ganti Nomor"; msg = "Batalkan pesanan ini dan ganti nomor baru?"; }
    if(action === 'resend') { title = "Kirim Ulang"; msg = "Meminta kode OTP baru?"; }
    if(action === 'finish') { title = "Selesaikan"; msg = "Konfirmasi pesanan selesai."; }

    if(!await showModal(title, msg, type)) return;

    const sendAction = action === 'replace' ? 'cancel' : action;
    const j = await apiCall('/order-action', 'POST', { id, action: sendAction });
    
    // Deteksi sukses pintar: Menangkap error palsu dari server saat pesanan nyangkut
    const errStr = JSON.stringify(j).toUpperCase();
    let isSuccess = j.success === true || j.status === "success";
    
    if (!isSuccess && (action === 'cancel' || action === 'replace' || action === 'finish')) {
        if (errStr.includes('NOT_FOUND') || errStr.includes('NO_ACTIVATION') || errStr.includes('NOT FOUND') || errStr.includes('ALREADY')) {
            isSuccess = true; // Anggap sukses agar UI bersih dari pesanan mati
        }
    }

    if (errStr.includes('EARLY_CANCEL_DENIED') || errStr.includes('BELUM 2 MENIT')) {
        isSuccess = false; // Tolak pembatalan jika waktu belum mencapai syarat
    }

    if(isSuccess) {
        if(action === 'resend') {
            showModal("Info", "Permintaan terkirim.", "alert");
            pollSms(); return;
        }

        const pid = localStorage.getItem(`pid_${activeProviderKey}_${id}`);
        const price = localStorage.getItem(`price_${activeProviderKey}_${id}`);

        // Bersihkan data lokal
        localStorage.removeItem(`phone_${activeProviderKey}_${id}`);
        localStorage.removeItem(`timer_${activeProviderKey}_${id}`);
        localStorage.removeItem(`price_${activeProviderKey}_${id}`);
        localStorage.removeItem(`pid_${activeProviderKey}_${id}`);
        localStorage.removeItem(`lock_${activeProviderKey}_${id}`);
        
        localStorage.removeItem(`phone_${id}`);
        localStorage.removeItem(`timer_${id}`);
        localStorage.removeItem(`price_${id}`);

        if (action === 'replace' && pid) {
            // Langsung pakai "any" di backend agar mendapatkan nomor pengganti tercepat
            const payload = activeProviderKey === "herosms" ? { product_id: pid, price: price, operator: "any" } : { product_id: parseInt(pid) };
            const n = await apiCall('/create-order', 'POST', payload);
            const nSuccess = n.success === true || n.status === "success";
            
            if (nSuccess && n.data) {
                const od = n.data.orders[0];
                const newPhone = od.phone || od.phone_number || od.phoneNumber || 'Mencari Nomor...';
                localStorage.setItem(`phone_${activeProviderKey}_${od.id}`, newPhone);
                localStorage.setItem(`price_${activeProviderKey}_${od.id}`, price);
                localStorage.setItem(`pid_${activeProviderKey}_${od.id}`, pid);
                setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 150);
            } else { 
                showModal("Gagal Pesan Baru", n.error?.message || n.message || n.error || "Gagal mengganti stok.", "alert"); 
            }
        }
        pollSms(); updateSmsBal();
    } else { 
        showModal("Gagal", j.error?.message || j.message || j.error || "Ditolak oleh server.", "alert"); 
    }
}
window.actSms = actSms;
