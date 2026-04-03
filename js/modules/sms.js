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
    if (activeProviderKey === "herosms") return `${price}`; // Hanya nominal untuk Hero
    return `Rp ${parseInt(price || 0).toLocaleString('id-ID')}`; // Rp untuk Code
}

async function initSms() {
    smsInitialized = true;
    const selectHp = document.getElementById('sms-server');

    // Buat Dropdown Provider
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
    document.getElementById('sms-active-orders').innerHTML = ''; // Bersihkan layar
    await loadServersList();
    refreshSms();
}
window.changeSmsProvider = changeSmsProvider;

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
// 3. API & DATA FETCHING
// ==========================================
async function apiCall(endpoint, method = "GET", body = null) {
    const options = { method, headers: { "Content-Type": "application/json", "X-Server-Name": currentServerName } };
    if (body) options.body = JSON.stringify(body);
    const res = await fetch(`${BASE_URL}${endpoint}`, options);
    return await res.json();
}

async function updateSmsBal() {
    try {
        const json = await apiCall('/get-balance');
        if(json.success) document.getElementById('sms-balance').innerText = formatPrice(json.data.balance);
        else document.getElementById('sms-balance').innerText = "Error";
    } catch(e) { document.getElementById('sms-balance').innerText = "Offline"; }
}

async function loadSmsPrices() {
    try {
        const json = await apiCall('/get-prices');
        const box = document.getElementById('sms-prices');
        if (json.success && json.data.length > 0) {
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
        } else box.innerHTML = `<div style="padding:30px; text-align:center; color:var(--fb-red); font-weight:bold;">${json.error?.message || json.error || 'Stok Kosong'}</div>`;
    } catch (e) { document.getElementById('sms-prices').innerHTML = '<div style="padding:30px; text-align:center; color:var(--fb-red);">Gagal Terhubung</div>'; }
}

export async function buySms(pid, price, name) {
    if (activeProviderKey === "herosms") {
        const box = document.getElementById('sms-prices');
        box.innerHTML = '<div style="padding:30px; text-align:center; color:#888;">Memuat Provider...</div>';
        try {
            const r = await apiCall('/get-operators');
            const ops = r.success ? r.data : ["any", "telkomsel", "indosat", "axis", "three", "smartfren", "xl"];
            let html = `<div style="padding:15px 10px; font-weight:bold; text-align:center; color:var(--fb-blue); border-bottom:1px dashed var(--fb-border); margin-bottom:10px;">Pilih Provider untuk Harga ${formatPrice(price)}</div>`;

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

    try {
        const payload = activeProviderKey === "herosms"
            ? { product_id: String(pid), price: price, operator: operator }
            : { product_id: parseInt(pid) };

        const j = await apiCall('/create-order', 'POST', payload);

        if(j.success) {
            const o = j.data.orders[0];
            localStorage.setItem(`phone_${activeProviderKey}_${o.id}`, o.phone_number);
            localStorage.setItem(`price_${activeProviderKey}_${o.id}`, price);
            localStorage.setItem(`pid_${activeProviderKey}_${o.id}`, pid);
            pollSms(); updateSmsBal();
            setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 150);
        } else {
            showModal("Gagal", j.error?.message || j.error || "Gagal memesan stok.", "alert");
            refreshSms();
        }
    } catch(e){ refreshSms(); }
}
window.executeBuySms = executeBuySms;

// ==========================================
// 4. LOGIKA SERVER SYNC (TIMER & UI)
// ==========================================
async function pollSms() {
    try {
        const j = await apiCall('/get-active');
        if(j.success) renderSmsOrders(j.data);
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

function renderSmsOrders(orders) {
    const container = document.getElementById('sms-active-orders');
    const activeIds = orders ? orders.map(o => `order-${activeProviderKey}-${o.id}`) : [];

    // Hapus kartu yang sudah tidak ada di server
    Array.from(container.children).forEach(child => {
        if (!activeIds.includes(child.id)) child.remove();
    });

    if(!orders || !orders.length) return;

    orders.forEach(o => {
        // Data Fallback
        const phone = o.phone_number || localStorage.getItem(`phone_${activeProviderKey}_${o.id}`) || 'Mencari Nomor...';
        if(o.phone_number && !localStorage.getItem(`phone_${activeProviderKey}_${o.id}`)) localStorage.setItem(`phone_${activeProviderKey}_${o.id}`, o.phone_number);

        const serverPrice = o.price || o.cost || localStorage.getItem(`price_${activeProviderKey}_${o.id}`);
        if(serverPrice) localStorage.setItem(`price_${activeProviderKey}_${o.id}`, serverPrice);

        // KUNCI SINKRONISASI SERVER LINTAS PERANGKAT
        let expireTime = 0;
        if (o.expires_at) {
            expireTime = (typeof o.expires_at === 'string') ? new Date(o.expires_at).getTime() : o.expires_at;
        } else if (o.created_at) {
            let createdAt = (typeof o.created_at === 'string') ? new Date(o.created_at).getTime() : o.created_at;
            expireTime = createdAt + (20 * 60000);
        }

        if (!expireTime || isNaN(expireTime) || expireTime === 0) {
            expireTime = parseInt(localStorage.getItem(`timer_${activeProviderKey}_${o.id}`));
            if (!expireTime || isNaN(expireTime)) expireTime = Date.now() + (20 * 60000);
        }
        localStorage.setItem(`timer_${activeProviderKey}_${o.id}`, expireTime);

        // Sinkronisasi Lock 2 Menit Cancel
        let lockTime = 0;
        if (o.created_at) {
            let createdAt = (typeof o.created_at === 'string') ? new Date(o.created_at).getTime() : o.created_at;
            lockTime = createdAt + 120000;
        } else {
            lockTime = parseInt(localStorage.getItem(`lock_${activeProviderKey}_${o.id}`));
            if (!lockTime || isNaN(lockTime)) lockTime = Date.now() + 120000;
        }
        localStorage.setItem(`lock_${activeProviderKey}_${o.id}`, lockTime);

        let passed2Mins = Date.now() >= lockTime;

        // UI State
        const resendState = o.otp_code ? '' : 'disabled';
        const cancelReplaceState = passed2Mins ? '' : 'disabled';
        let otpDisplay = o.otp_code ? `<span style="color:var(--fb-green); letter-spacing:4px; font-size:26px; font-weight:bold; font-family:monospace;">${o.otp_code}</span>` : `<div class="loader-bars"><span></span><span></span><span></span></div>`;
        const priceDisplay = serverPrice ? formatPrice(serverPrice) : '...';

        const cardId = `order-${activeProviderKey}-${o.id}`;
        const existingCard = document.getElementById(cardId);

        if (existingCard) {
            // Update Text jika ada perubahan
            const phoneBoxSpan = existingCard.querySelector('.phone-text-span');
            if (phoneBoxSpan && phoneBoxSpan.innerText !== phone && phone !== 'Mencari Nomor...') phoneBoxSpan.innerText = phone;

            const otpContainer = existingCard.querySelector('.otp-container');
            if (otpContainer.innerHTML.trim() !== otpDisplay.trim()) otpContainer.innerHTML = otpDisplay;

            const priceBox = existingCard.querySelector('.price-box');
            if (priceBox && priceBox.innerText.includes('...') && serverPrice) priceBox.innerText = priceDisplay;

            // Update Tombol
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
            // Buat Kartu Baru
            const cardHTML = `<div class="order-card" id="${cardId}">
                <div style="display:flex; justify-content:space-between; margin-bottom:15px; border-bottom:1px dashed var(--fb-border); padding-bottom:15px; align-items:center;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="color:var(--fb-blue); font-weight:bold; font-family:monospace; font-size:15px;">#${o.id}</span>
                        <span class="badge-status" style="font-size:10px; color:var(--fb-text); font-family:sans-serif; background:rgba(0,0,0,0.1);">ACTIVE</span>
                        <span class="price-box" style="font-size:16px; font-weight:900; color:var(--fb-red); font-family:monospace;">${priceDisplay}</span>
                    </div>
                    <span class="sms-timer" data-id="${o.id}" style="font-family:monospace; font-weight:bold; color:var(--fb-blue);">--:--</span>
                </div>
                <div style="font-size:11px; color:var(--fb-muted); margin-bottom:5px; text-transform:uppercase;">Tap untuk salin:</div>
                <div class="phone-box" onclick="copyPhoneNumber('${phone}', 'copy-icon-${o.id}')">
                    <span class="phone-text-span">${phone}</span><i id="copy-icon-${o.id}" class="fa-regular fa-copy" style="color: var(--fb-muted);"></i>
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
        const end = parseInt(localStorage.getItem(`timer_${activeProviderKey}_${id}`));

        if(end) {
            const diff = Math.max(0, Math.floor((end - Date.now())/1000));
            el.innerText = `${Math.floor(diff/60)}:${(diff%60).toString().padStart(2,'0')}`;
            el.style.color = diff < 600 ? "var(--fb-red)" : "var(--fb-blue)"; // Merah di sisa 10 mnt

            // Buka gembok Replace/Cancel secara real-time
            const lockTime = parseInt(localStorage.getItem(`lock_${activeProviderKey}_${id}`));
            if (lockTime && Date.now() >= lockTime) {
                const existingCard = document.getElementById(`order-${activeProviderKey}-${id}`);
                if(existingCard) {
                    const btnCancel = existingCard.querySelector('.btn-cancel');
                    const btnReplace = existingCard.querySelector('.btn-replace');
                    if(btnCancel && btnCancel.disabled && !existingCard.innerHTML.includes('color:var(--fb-green); letter-spacing:4px;')) {
                        btnCancel.disabled = false;
                    }
                    if(btnReplace && btnReplace.disabled && !existingCard.innerHTML.includes('color:var(--fb-green); letter-spacing:4px;')) {
                        btnReplace.disabled = false;
                    }
                }
            }
        }
    });
}

// ==========================================
// 5. AKSI ORDER (REPLACE REAL)
// ==========================================
export async function actSms(action, id) {
    let title = "Konfirmasi", msg = "Lanjutkan?", type = "confirm";
    if(action === 'cancel') { title = "Batalkan"; msg = "Yakin batalkan pesanan ini? Saldo dikembalikan."; type = "danger"; }
    if(action === 'replace') { title = "Ganti Nomor"; msg = "Batalkan pesanan ini dan ganti nomor baru?"; }
    if(action === 'resend') { title = "Kirim Ulang"; msg = "Meminta kode OTP baru?"; }
    if(action === 'finish') { title = "Selesaikan"; msg = "Konfirmasi pesanan selesai."; }

    if(!await showModal(title, msg, type)) return;

    // Untuk replace, eksekusi cancel ke server terlebih dahulu
    try {
        const res = await apiCall('/order-action', 'POST', { id, action: action === 'replace' ? 'cancel' : action });
        const j = await res.json();

        // NOT_FOUND dianggap sukses untuk REPLACE agar tidak stuck
        if(j.success || j.error?.code === 'NOT_FOUND') {
            if(action === 'cancel' || action === 'finish' || action === 'replace') {
                const pid = localStorage.getItem(`pid_${activeProviderKey}_${id}`);
                const price = localStorage.getItem(`price_${activeProviderKey}_${id}`);

                // Bersihkan sampah cache
                localStorage.removeItem(`phone_${activeProviderKey}_${id}`);
                localStorage.removeItem(`timer_${activeProviderKey}_${id}`);
                localStorage.removeItem(`lock_${activeProviderKey}_${id}`);
                localStorage.removeItem(`price_${activeProviderKey}_${id}`);
                localStorage.removeItem(`pid_${activeProviderKey}_${id}`);

                // Eksekusi pemesanan ulang otomatis untuk Replace
                if (action === 'replace' && pid) {
                    const payload = activeProviderKey === "herosms"
                        ? { product_id: pid, price: price, operator: "any" }
                        : { product_id: parseInt(pid) };

                    const n = await apiCall('/create-order', 'POST', payload);
                    if (n.success) {
                        const od = n.data.orders[0];
                        localStorage.setItem(`phone_${activeProviderKey}_${od.id}`, od.phone_number);
                        localStorage.setItem(`price_${activeProviderKey}_${od.id}`, price);
                        localStorage.setItem(`pid_${activeProviderKey}_${od.id}`, pid);
                        setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 150);
                    } else {
                        showModal("Gagal Pesan Baru", n.error?.message || n.error || "Gagal mengganti stok.", "alert");
                    }
                }
            }
            pollSms(); updateSmsBal();
        } else {
            showModal("Gagal", j.error?.message || j.error || "Ditolak oleh server.", "alert");
        }
    } catch(e){
        showModal("Error", "Gagal terhubung ke server.", "alert");
    }
}
window.actSms = actSms;
