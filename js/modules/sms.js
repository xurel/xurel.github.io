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

// State Lokal untuk UI (Menyimpan status Hide & Auto-Cancel)
let activeOrders = [];
let orderStates = {};

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
    activeOrders = []; orderStates = {};
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
    activeOrders = []; orderStates = {};
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
            return JSON.parse(text); 
        } catch(e) {
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

// Helper: Pembuat Elemen HTML Kartu (Sudah Termasuk Tombol Mata/Hide)
function createCardHTML(oId, phone, priceDisplay, resendState, cancelReplaceState, otpDisplay, isDone = false) {
    const doneStyle = isDone ? 'style="background:#e6f4ea; color:var(--fb-green); border-color:var(--fb-green);"' : 'disabled';
    const borderColor = activeProviderKey === "herosms" ? "#8e44ad" : "#95a5a6"; 
    
    return `<div class="order-card" id="order-${activeProviderKey}-${oId}" data-created="${Date.now()}" style="border-left: 5px solid ${borderColor};">
        <div style="display:flex; justify-content:space-between; margin-bottom:15px; border-bottom:1px dashed var(--fb-border); padding-bottom:15px; align-items:center;">
            <div style="display:flex; align-items:center; gap:8px;">
                <span style="color:var(--fb-blue); font-weight:bold; font-family:monospace; font-size:15px;">#${oId}</span>
                <span class="badge-status" style="font-size:10px; color:var(--fb-text); font-family:sans-serif; background:rgba(0,0,0,0.1);">ACTIVE</span>
                <span class="price-box" style="font-size:16px; font-weight:900; color:var(--fb-red); font-family:monospace;">${priceDisplay}</span>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
                <i class="fa-regular fa-eye-slash hide-btn-icon" onclick="hideSmsCard(${oId})" style="color: var(--fb-muted); cursor:pointer; font-size:14px; padding: 5px;"></i>
                <span class="sms-timer" data-id="${oId}" style="font-family:monospace; font-weight:bold; color:var(--fb-blue);">--:--</span>
            </div>
        </div>
        <div style="font-size:11px; color:var(--fb-muted); margin-bottom:5px; text-transform:uppercase;">Nomor HP:</div>
        <div class="phone-box" onclick="copyPhoneNumber('${phone}', 'copy-icon-${oId}')">
            <span class="phone-text-span">${phone}</span><i id="copy-icon-${oId}" class="fa-regular fa-copy" style="color: var(--fb-muted);"></i>
        </div>
        <div style="text-align: center; margin: 10px 0 15px 0; padding: 15px 0; background: #fafafa; border-radius: 8px;">
            <div style="font-size:11px; color:var(--fb-muted); font-weight:bold; letter-spacing:1px; margin-bottom:5px;">KODE OTP</div>
            <div class="otp-container" style="min-height:35px; display:flex; align-items:center; justify-content:center;">${otpDisplay}</div>
        </div>
        <div class="btn-grid-4">
            <button class="sms-btn btn-done" onclick="actSms('finish', ${oId})" ${doneStyle}>✓ DONE</button>
            <button class="sms-btn btn-resend" onclick="actSms('resend', ${oId})" ${resendState}>↻ RESEND</button>
            <button class="sms-btn btn-cancel" onclick="actSms('cancel', ${oId})" ${cancelReplaceState}>✕ CANCEL</button>
            <button class="sms-btn btn-replace" onclick="actSms('replace', ${oId})" ${cancelReplaceState}>⇄ REPLACE</button>
        </div>
    </div>`;
}

export async function buySms(pid, price, name) {
    if (activeProviderKey === "herosms") {
        const box = document.getElementById('sms-prices');
        box.innerHTML = '<div style="padding:30px; text-align:center; color:#888;">Memuat Provider...</div>';
        
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
        localStorage.setItem(`timer_${activeProviderKey}_${o.id}`, Date.now() + (20 * 60000));
        
        const container = document.getElementById('sms-active-orders');
        const cardHTML = createCardHTML(o.id, newPhone, formatPrice(price), 'disabled', 'disabled', `<div class="loader-bars"><span></span><span></span><span></span></div>`);
        container.insertAdjacentHTML('afterbegin', cardHTML);

        pollSms(); updateSmsBal();
        setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 150);
    } else {
        showModal("Gagal", j.error?.message || j.message || j.error || "Gagal memesan stok.", "alert");
        refreshSms();
    }
}
window.executeBuySms = executeBuySms;

// ==========================================
// 4. LOGIKA SERVER SYNC & UI RENDER
// ==========================================
async function pollSms() {
    const j = await apiCall('/get-active');
    const isSuccess = j.success === true || j.status === "success";
    if(isSuccess && j.data) {
        activeOrders = j.data; 
        renderSmsOrders(j.data);
    }
}

// Fungsi Fitur Hide (Mata Silang)
export function hideSmsCard(id) {
    if (!orderStates[id]) orderStates[id] = {};
    orderStates[id].isHidden = true; // Tandai lokal
    const card = document.getElementById(`order-${activeProviderKey}-${id}`);
    if (card) card.remove(); // Hapus dari layar
}
window.hideSmsCard = hideSmsCard;

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

function renderSmsOrders(orders) {
    const container = document.getElementById('sms-active-orders');
    const activeIds = orders ? orders.map(o => `order-${activeProviderKey}-${o.id}`) : [];

    Array.from(container.children).forEach(child => {
        if (!activeIds.includes(child.id)) {
            const createdTime = parseInt(child.getAttribute('data-created') || 0);
            if (Date.now() - createdTime > 15000) child.remove();
        }
    });

    if(!orders || !orders.length) return;

    orders.forEach(o => {
        // Cegah merender kartu yang sudah di-hide oleh user
        if (orderStates[o.id] && orderStates[o.id].isHidden) return;

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
        const isDone = !!o.otp_code;
        let otpDisplay = o.otp_code ? `<span style="color:var(--fb-green); letter-spacing:4px; font-size:26px; font-weight:bold; font-family:monospace;">${o.otp_code}</span>` : `<div class="loader-bars"><span></span><span></span><span></span></div>`;
        const priceDisplay = serverPrice ? formatPrice(serverPrice) : '...';

        const cardId = `order-${activeProviderKey}-${o.id}`;
        const existingCard = document.getElementById(cardId);

        if (existingCard) {
            const phoneBoxSpan = existingCard.querySelector('.phone-text-span');
            if (phoneBoxSpan && phoneBoxSpan.innerText !== phone && phone !== 'Mencari Nomor...') {
                phoneBoxSpan.innerText = phone;
                const phoneBox = existingCard.querySelector('.phone-box');
                if (phoneBox) phoneBox.setAttribute('onclick', `copyPhoneNumber('${phone}', 'copy-icon-${o.id}')`);
            }

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

            if (passed2Mins && !o.otp_code) {
                const btnCancel = existingCard.querySelector('.btn-cancel');
                const btnReplace = existingCard.querySelector('.btn-replace');
                if(btnCancel) btnCancel.disabled = false;
                if(btnReplace) btnReplace.disabled = false;
            }
        } else {
            const cardHTML = createCardHTML(o.id, phone, priceDisplay, resendState, cancelReplaceState, otpDisplay, isDone);
            container.insertAdjacentHTML('afterbegin', cardHTML);
        }
    });
    updateSmsTimers();
}

// Eksekusi Batal Otomatis Secara Latar Belakang (Tanpa Popup)
async function autoCancelSilent(id) {
    await apiCall('/order-action', 'POST', { id, action: 'cancel' });
    localStorage.removeItem(`phone_${activeProviderKey}_${id}`);
    localStorage.removeItem(`timer_${activeProviderKey}_${id}`);
    localStorage.removeItem(`price_${activeProviderKey}_${id}`);
    localStorage.removeItem(`pid_${activeProviderKey}_${id}`);
    pollSms(); updateSmsBal();
}

function updateSmsTimers() {
    const now = Date.now();
    
    // 1. Update Timer di Layar & Buka Kunci Tombol (Cancel/Replace)
    document.querySelectorAll('.sms-timer').forEach(el => {
        const id = el.dataset.id;
        const end = parseInt(localStorage.getItem(`timer_${activeProviderKey}_${id}`)) || parseInt(localStorage.getItem('timer_' + id));

        if(end) {
            const diff = Math.max(0, Math.floor((end - now)/1000));
            el.innerText = `${Math.floor(diff/60)}:${(diff%60).toString().padStart(2,'0')}`;
            el.style.color = diff < 600 ? "var(--fb-red)" : "var(--fb-blue)"; 
            
            if (diff <= 1080) { 
                const existingCard = document.getElementById(`order-${activeProviderKey}-${id}`); 
                if(existingCard) { 
                    const btnCancel = existingCard.querySelector('.btn-cancel'); 
                    const btnReplace = existingCard.querySelector('.btn-replace'); 
                    if(btnCancel && btnCancel.disabled && !existingCard.innerHTML.includes('color:var(--fb-green); letter-spacing:4px;')) btnCancel.disabled = false; 
                    if(btnReplace && btnReplace.disabled && !existingCard.innerHTML.includes('color:var(--fb-green); letter-spacing:4px;')) btnReplace.disabled = false; 
                } 
            }
        }
    });

    // 2. LOGIKA AUTO CANCEL (10 MENIT) - Berjalan meskipun kartu disembunyikan/di-hide
    activeOrders.forEach(o => {
        if (o.otp_code) return; // Abaikan jika sudah ada OTP
        
        const end = parseInt(localStorage.getItem(`timer_${activeProviderKey}_${o.id}`));
        if (end) {
            const timeLeft = end - now;
            // Jika waktu tersisa <= 10 menit (600000ms) dan tidak sedang dalam status Auto-Canceled
            if (timeLeft <= 600000 && timeLeft > 0) {
                if (!orderStates[o.id]) orderStates[o.id] = {};
                if (!orderStates[o.id].autoCanceled) {
                    orderStates[o.id].autoCanceled = true; // Kunci agar tidak di-cancel berulang kali
                    autoCancelSilent(o.id);
                }
            }
        }
    });
}

// ==========================================
// 5. AKSI ORDER (GANTI NOMOR DI TEMPAT)
// ==========================================
export async function actSms(action, id) {
    let title = "Konfirmasi", msg = "Lanjutkan?", type = "confirm";
    if(action === 'cancel') { title = "Batalkan"; msg = "Yakin batalkan pesanan ini? Saldo dikembalikan."; type = "danger"; }
    if(action === 'replace') { title = "Ganti Nomor"; msg = "Batalkan pesanan ini dan ganti nomor baru?"; }
    if(action === 'resend') { title = "Kirim Ulang"; msg = "Meminta kode OTP baru?"; }
    if(action === 'finish') { title = "Selesaikan"; msg = "Konfirmasi pesanan selesai."; }

    if(!await showModal(title, msg, type)) return;

    if (action === 'replace') {
        const oldCard = document.getElementById(`order-${activeProviderKey}-${id}`);
        if(oldCard) {
            const otpContainer = oldCard.querySelector('.otp-container');
            if(otpContainer) otpContainer.innerHTML = `<span style="color:var(--fb-blue); font-size:12px; font-weight:bold;"><i class="fa-solid fa-spinner fa-spin"></i> Menukar...</span>`;
        }
    }

    const sendAction = action === 'replace' ? 'cancel' : action;
    const j = await apiCall('/order-action', 'POST', { id, action: sendAction });
    
    const errStr = JSON.stringify(j).toUpperCase();
    let isSuccess = j.success === true || j.status === "success";
    
    if (!isSuccess && (action === 'cancel' || action === 'replace' || action === 'finish')) {
        if (errStr.includes('NOT_FOUND') || errStr.includes('NO_ACTIVATION') || errStr.includes('NOT FOUND') || errStr.includes('ALREADY')) {
            isSuccess = true; 
        }
    }
    if (errStr.includes('EARLY_CANCEL_DENIED') || errStr.includes('BELUM 2 MENIT')) {
        isSuccess = false; 
    }

    if(isSuccess) {
        if(action === 'resend') {
            showModal("Info", "Permintaan terkirim.", "alert");
            pollSms(); return;
        }

        const pid = localStorage.getItem(`pid_${activeProviderKey}_${id}`);
        const price = localStorage.getItem(`price_${activeProviderKey}_${id}`);

        localStorage.removeItem(`phone_${activeProviderKey}_${id}`);
        localStorage.removeItem(`timer_${activeProviderKey}_${id}`);
        localStorage.removeItem(`price_${activeProviderKey}_${id}`);
        localStorage.removeItem(`pid_${activeProviderKey}_${id}`);
        localStorage.removeItem(`phone_${id}`); localStorage.removeItem(`timer_${id}`); localStorage.removeItem(`price_${id}`);

        if (action === 'cancel' || action === 'finish') {
            const oldCard = document.getElementById(`order-${activeProviderKey}-${id}`);
            if (oldCard) oldCard.remove();
        }

        if (action === 'replace' && pid) {
            delete orderStates[id]; // Bersihkan riwayat hide jika ID ini di-replace
            const payload = activeProviderKey === "herosms" ? { product_id: pid, price: price, operator: "any" } : { product_id: parseInt(pid) };
            const n = await apiCall('/create-order', 'POST', payload);
            const nSuccess = n.success === true || n.status === "success";
            
            if (nSuccess && n.data) {
                const od = n.data.orders[0];
                const newPhone = od.phone || od.phone_number || od.phoneNumber || 'Mencari Nomor...';
                
                localStorage.setItem(`phone_${activeProviderKey}_${od.id}`, newPhone);
                localStorage.setItem(`price_${activeProviderKey}_${od.id}`, price);
                localStorage.setItem(`pid_${activeProviderKey}_${od.id}`, pid);
                localStorage.setItem(`timer_${activeProviderKey}_${od.id}`, Date.now() + (20 * 60000));

                const oldCard = document.getElementById(`order-${activeProviderKey}-${id}`);
                if (oldCard) {
                    oldCard.id = `order-${activeProviderKey}-${od.id}`;
                    oldCard.setAttribute('data-created', Date.now()); 
                    
                    const phoneBoxSpan = oldCard.querySelector('.phone-text-span');
                    if (phoneBoxSpan) phoneBoxSpan.innerText = newPhone;

                    const otpContainer = oldCard.querySelector('.otp-container');
                    if (otpContainer) otpContainer.innerHTML = `<div class="loader-bars"><span></span><span></span><span></span></div>`;

                    const timerEl = oldCard.querySelector('.sms-timer');
                    if (timerEl) { timerEl.dataset.id = od.id; timerEl.innerText = '--:--'; }

                    const btnDone = oldCard.querySelector('.btn-done');
                    if (btnDone) { btnDone.disabled = true; btnDone.style.background = ''; btnDone.style.borderColor = ''; btnDone.style.color = ''; btnDone.setAttribute('onclick', `actSms('finish', ${od.id})`); }
                    
                    const btnResend = oldCard.querySelector('.btn-resend');
                    if (btnResend) { btnResend.disabled = true; btnResend.setAttribute('onclick', `actSms('resend', ${od.id})`); }
                    
                    const btnCancel = oldCard.querySelector('.btn-cancel');
                    if (btnCancel) { btnCancel.disabled = true; btnCancel.setAttribute('onclick', `actSms('cancel', ${od.id})`); }
                    
                    const btnReplace = oldCard.querySelector('.btn-replace');
                    if (btnReplace) { btnReplace.disabled = true; btnReplace.setAttribute('onclick', `actSms('replace', ${od.id})`); }
                    
                    const hideBtn = oldCard.querySelector('.hide-btn-icon');
                    if (hideBtn) hideBtn.setAttribute('onclick', `hideSmsCard(${od.id})`);

                    const spans = oldCard.querySelectorAll('span');
                    spans.forEach(sp => { if (sp.innerText.trim() === `#${id}`) sp.innerText = `#${od.id}`; });
                    
                    const copyIcon = oldCard.querySelector('.fa-copy, .fa-circle-check');
                    if (copyIcon) copyIcon.id = `copy-icon-${od.id}`;
                    
                    const phoneBox = oldCard.querySelector('.phone-box');
                    if (phoneBox) phoneBox.setAttribute('onclick', `copyPhoneNumber('${newPhone}', 'copy-icon-${od.id}')`);
                }
            } else { 
                showModal("Gagal Pesan Baru", n.error?.message || n.message || n.error || "Gagal mengganti stok.", "alert"); 
                const oldCard = document.getElementById(`order-${activeProviderKey}-${id}`);
                if (oldCard) oldCard.remove();
            }
        }
        pollSms(); updateSmsBal();
    } else { 
        showModal("Gagal", j.error?.message || j.message || j.error || "Ditolak oleh server.", "alert"); 
        if (action === 'replace') {
            const oldCard = document.getElementById(`order-${activeProviderKey}-${id}`);
            if (oldCard) {
                const otpContainer = oldCard.querySelector('.otp-container');
                if (otpContainer) otpContainer.innerHTML = `<div class="loader-bars"><span></span><span></span><span></span></div>`;
            }
        }
    }
}
window.actSms = actSms;
