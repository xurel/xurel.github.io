import { showModal } from './ui.js';

const SMS_SERVERS = { "HP1": "https://smscode.aam-zip.workers.dev", "HP2": "https://smscodezip.aam-zip.workers.dev" };
let currentSmsWorker = ""; let smsInitialized = false; let isSmsLocked = false;

// Trigger ketika tab berubah ke SMS
window.addEventListener('appSwitched', (e) => { if(e.detail === 'sms' && !smsInitialized) initSms(); });

function initSms() {
    smsInitialized = true; const select = document.getElementById('sms-server');
    select.innerHTML = Object.keys(SMS_SERVERS).map(k => `<option value="${SMS_SERVERS[k]}">${k}</option>`).join('');
    isSmsLocked = localStorage.getItem('xurel_locked') === 'true';
    const savedServer = localStorage.getItem('xurel_selected_hp');
    if(savedServer && SMS_SERVERS[savedServer]) { currentSmsWorker = SMS_SERVERS[savedServer]; select.value = currentSmsWorker; } 
    else { currentSmsWorker = SMS_SERVERS["HP1"]; }
    applySmsLockUI(); refreshSms(); setInterval(pollSms, 5000); setInterval(updateSmsTimers, 1000);
}

export function toggleSmsLock() { isSmsLocked = !isSmsLocked; localStorage.setItem('xurel_locked', isSmsLocked); applySmsLockUI(); }
function applySmsLockUI() {
    const select = document.getElementById('sms-server'); const icon = document.getElementById('sms-lock-icon'); select.disabled = isSmsLocked;
    if (isSmsLocked) { icon.className = 'fa-solid fa-lock'; icon.style.color = 'var(--fb-red)'; } 
    else { icon.className = 'fa-solid fa-unlock'; icon.style.color = 'var(--fb-muted)'; }
}

export function changeSmsServer() {
    if(isSmsLocked) return; currentSmsWorker = document.getElementById('sms-server').value;
    localStorage.setItem('xurel_selected_hp', document.getElementById('sms-server').options[document.getElementById('sms-server').selectedIndex].text);
    refreshSms();
}

function refreshSms() { document.getElementById('sms-prices').innerHTML = '<div style="padding:30px; text-align:center; color:#888;">Mengambil Data...</div>'; updateSmsBal(); loadSmsPrices(); pollSms(); }

async function updateSmsBal() {
    try { const res = await fetch(`${currentSmsWorker}/get-balance`); const json = await res.json(); if(json.success) document.getElementById('sms-balance').innerText = `Rp ${json.data.balance.toLocaleString('id-ID')}`; } catch(e) {}
}

async function loadSmsPrices() {
    try {
        const res = await fetch(`${currentSmsWorker}/get-prices`); const json = await res.json(); const box = document.getElementById('sms-prices');
        if (json.success && json.data.length > 0) {
            box.innerHTML = json.data.map(i => {
                let shortName = i.name.replace(/Indonesia/ig, '').replace(/\s+/g, ' ').trim();
                return `<div class="price-item" onclick="buySms(${i.id}, ${i.price}, '${i.name}')"><div style="flex: 1; min-width: 0; padding-right: 10px;"><div style="font-weight:bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${shortName}</div></div><div style="display: flex; align-items: center; flex-shrink: 0; gap: 8px;"><div style="width: 65px; text-align: right; color:var(--fb-red); font-family:monospace; font-size:14px; font-weight: 900;">Rp ${i.price}</div><div style="width: 75px; text-align: right; font-size:12px; color:var(--fb-muted);">${i.available} stok</div></div></div>`;
            }).join('');
        } else box.innerHTML = '<div style="padding:30px; text-align:center;">Kosong</div>';
    } catch (e) {}
}

export async function buySms(pid, price, name) {
    if(!await showModal("Pesan Baru", `Beli nomor untuk ${name} seharga Rp ${price}?`, "confirm")) return;
    try {
        const res = await fetch(`${currentSmsWorker}/create-order`, { method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ product_id: pid }) });
        const j = await res.json();
        if(j.success) { const o = j.data.orders[0]; localStorage.setItem('phone_'+o.id, o.phone_number); localStorage.setItem('price_'+o.id, price); pollSms(); updateSmsBal(); } else showModal("Gagal", j.error.message || "Gagal memesan stok.", "alert");
    } catch(e){}
}

async function pollSms() { try { const res = await fetch(`${currentSmsWorker}/get-active`); const j = await res.json(); if(j.success) renderSmsOrders(j.data); } catch(e) {} }

export function copyPhoneNumber(txt, iconId) {
    if(txt.includes('Mencari')) return; navigator.clipboard.writeText(txt);
    const icon = document.getElementById(iconId);
    if(icon) { icon.className = "fa-solid fa-circle-check"; icon.style.color = "var(--fb-green)"; setTimeout(() => { icon.className = "fa-regular fa-copy"; icon.style.color = "var(--fb-muted)"; }, 1500); }
}

function renderSmsOrders(orders) {
    const container = document.getElementById('sms-active-orders'); const activeIds = orders ? orders.map(o => 'order-' + o.id) : [];
    Array.from(container.children).forEach(child => { if (!activeIds.includes(child.id)) child.remove(); });
    if(!orders || !orders.length) return;
    
    orders.forEach(o => {
        const phone = o.phone || localStorage.getItem('phone_'+o.id) || 'Mencari Nomor...';
        if(o.phone && !localStorage.getItem('phone_'+o.id)) localStorage.setItem('phone_'+o.id, o.phone);
        const serverPrice = o.price || o.cost || localStorage.getItem('price_' + o.id);
        if(serverPrice) localStorage.setItem('price_' + o.id, serverPrice);
        
        let expireTime = 0;
        if (o.expires_at) expireTime = new Date(o.expires_at).getTime(); else if (o.created_at) expireTime = new Date(o.created_at).getTime() + (20 * 60000);
        if (!expireTime || isNaN(expireTime) || expireTime === 0) { expireTime = localStorage.getItem('timer_' + o.id); if (!expireTime) expireTime = Date.now() + (20 * 60000); }
        localStorage.setItem('timer_' + o.id, expireTime); 
        
        let passed2Mins = false; if (expireTime) { const remaining = Math.floor((parseInt(expireTime) - Date.now()) / 1000); if (remaining <= 1080) passed2Mins = true; }
        const resendState = o.otp_code ? '' : 'disabled'; const cancelReplaceState = passed2Mins ? '' : 'disabled';
        let otpDisplay = o.otp_code ? `<span style="color:var(--fb-green); letter-spacing:4px; font-size:26px; font-weight:bold; font-family:monospace;">${o.otp_code}</span>` : `<div class="loader-bars"><span></span><span></span><span></span></div>`;
        const priceDisplay = serverPrice ? parseInt(serverPrice).toLocaleString('id-ID') : '...';

        const existingCard = document.getElementById('order-' + o.id);
        if (existingCard) {
            const phoneBoxSpan = existingCard.querySelector('.phone-text-span'); if (phoneBoxSpan && phoneBoxSpan.innerText !== phone && phone !== 'Mencari Nomor...') phoneBoxSpan.innerText = phone; 
            const otpContainer = existingCard.querySelector('.otp-container'); if (otpContainer.innerHTML.trim() !== otpDisplay.trim()) otpContainer.innerHTML = otpDisplay;
            const priceBox = existingCard.querySelector('.price-box'); if (priceBox && priceBox.innerText.includes('...') && serverPrice) priceBox.innerText = `Rp ${priceDisplay}`;
            if (o.otp_code) { const btnDone = existingCard.querySelector('.btn-done'); if(btnDone && btnDone.disabled) { btnDone.disabled = false; btnDone.style.color = "var(--fb-green)"; btnDone.style.borderColor = "var(--fb-green)"; btnDone.style.background = "#e6f4ea"; } const btnResend = existingCard.querySelector('.btn-resend'); if(btnResend && btnResend.disabled) btnResend.disabled = false; }
            if (passed2Mins) { const btnCancel = existingCard.querySelector('.btn-cancel'); const btnReplace = existingCard.querySelector('.btn-replace'); if(btnCancel) btnCancel.disabled = false; if(btnReplace) btnReplace.disabled = false; }
        } else {
            const cardHTML = `<div class="order-card" id="order-${o.id}"><div style="display:flex; justify-content:space-between; margin-bottom:15px; border-bottom:1px dashed var(--fb-border); padding-bottom:15px; align-items:center;"><div style="display:flex; align-items:center; gap:8px;"><span style="color:var(--fb-blue); font-weight:bold; font-family:monospace; font-size:15px;">#${o.id}</span><span class="badge-status" style="font-size:10px; color:var(--fb-text); font-family:sans-serif; background:rgba(0,0,0,0.1);">ACTIVE</span><span class="price-box" style="font-size:16px; font-weight:900; color:var(--fb-red); font-family:monospace;">Rp ${priceDisplay}</span></div><span class="sms-timer" data-id="${o.id}" style="font-family:monospace; font-weight:bold; color:var(--fb-blue);">--:--</span></div><div style="font-size:11px; color:var(--fb-muted); margin-bottom:5px; text-transform:uppercase;">Tap untuk salin:</div><div class="phone-box" onclick="copyPhoneNumber('${phone}', 'copy-icon-${o.id}')"><span class="phone-text-span">${phone}</span><i id="copy-icon-${o.id}" class="fa-regular fa-copy" style="color: var(--fb-muted);"></i></div><div style="text-align: center; margin: 10px 0 15px 0; padding: 15px 0; background: #fafafa; border-radius: 8px;"><div style="font-size:11px; color:var(--fb-muted); font-weight:bold; letter-spacing:1px; margin-bottom:5px;">KODE OTP</div><div class="otp-container" style="min-height:35px; display:flex; align-items:center; justify-content:center;">${otpDisplay}</div></div><div class="btn-grid-4"><button class="sms-btn btn-done" onclick="actSms('finish', ${o.id})" ${o.otp_code?'style="background:#e6f4ea; color:var(--fb-green); border-color:var(--fb-green);"':'disabled'}>✓ DONE</button><button class="sms-btn btn-resend" onclick="actSms('resend', ${o.id})" ${resendState}>↻ RESEND</button><button class="sms-btn btn-cancel" onclick="actSms('cancel', ${o.id})" ${cancelReplaceState}>✕ CANCEL</button><button class="sms-btn btn-replace" onclick="actSms('replace', ${o.id})" ${cancelReplaceState}>⇄ REPLACE</button></div></div>`;
            container.insertAdjacentHTML('afterbegin', cardHTML);
        }
    });
    updateSmsTimers();
}

function updateSmsTimers() {
    document.querySelectorAll('.sms-timer').forEach(el => {
        const id = el.dataset.id; const end = localStorage.getItem('timer_'+id);
        if(end) {
            const diff = Math.max(0, Math.floor((parseInt(end) - Date.now())/1000));
            el.innerText = `${Math.floor(diff/60)}:${(diff%60).toString().padStart(2,'0')}`; el.style.color = diff < 600 ? "var(--fb-red)" : "var(--fb-blue)";
            if (diff <= 1080) { const existingCard = document.getElementById('order-' + id); if(existingCard) { const btnCancel = existingCard.querySelector('.btn-cancel'); const btnReplace = existingCard.querySelector('.btn-replace'); if(btnCancel && btnCancel.disabled) btnCancel.disabled = false; if(btnReplace && btnReplace.disabled) btnReplace.disabled = false; } }
        }
    });
}

export async function actSms(action, id) {
    let title = "Konfirmasi", msg = "Lanjutkan?", type = "confirm";
    if(action === 'cancel') { title = "Batalkan"; msg = "Yakin batalkan pesanan ini? Saldo dikembalikan."; type = "danger"; }
    if(action === 'replace') { title = "Ganti Nomor"; msg = "Batalkan pesanan ini dan ganti nomor baru?"; }
    if(action === 'resend') { title = "Kirim Ulang"; msg = "Meminta kode OTP baru?"; }
    if(action === 'finish') { title = "Selesaikan"; msg = "Konfirmasi pesanan selesai."; }

    if(!await showModal(title, msg, type)) return;
    try {
        const res = await fetch(`${currentSmsWorker}/order-action`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({id, action}) }); const j = await res.json();
        if(j.success) { if(action === 'cancel' || action === 'finish' || action === 'replace') { localStorage.removeItem('phone_'+id); localStorage.removeItem('timer_'+id); localStorage.removeItem('price_'+id); } pollSms(); updateSmsBal(); } else showModal("Gagal", "Ditolak oleh server.", "alert");
    } catch(e){}
    }
