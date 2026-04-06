import { showModal } from './ui.js';

// ==========================================
// 1. KONFIGURASI PROVIDER & STATE
// ==========================================
const PROVIDERS = {
    "smscode": { name: "Code", url: "https://sms.aam-zip.workers.dev" },
    "herosms": { name: "Hero", url: "https://hero.aam-zip.workers.dev" },
    "smsbower": { name: "Bower", url: "https://bower.aam-zip.workers.dev" },
    "otpcepat": { name: "Cepat", url: "https://cepat.aam-zip.workers.dev" } // <-- URL OTPCEPAT ANDA
};

let activeProviderKey = localStorage.getItem('xurel_provider') || "smscode";
let BASE_URL = PROVIDERS[activeProviderKey].url;

let currentServerName = ""; 
let smsInitialized = false; 
let isSmsLocked = false;
let pollingInterval = null;
let timerInterval = null;

let activeOrders = [];
let orderStates = {};

window.addEventListener('appSwitched', (e) => { if(e.detail === 'sms' && !smsInitialized) initSms(); });

function formatPrice(price) {
    if (activeProviderKey === "herosms") return `${price}`;
    if (activeProviderKey === "smsbower") return `$ ${price}`;
    return `Rp ${parseInt(price || 0).toLocaleString('id-ID')}`; 
}

// Helper untuk memunculkan Badge Provider atau Ranking
function getOperatorBadge(provider, opCode, rank) {
    if ((provider === "herosms" || provider === "otpcepat") && opCode && opCode !== "any") {
        const opMap = { "telkomsel": "TL", "indosat": "ST", "axis": "XS", "three": "TR", "xl": "XL", "smartfren": "SM" };
        let initial = opMap[opCode.toLowerCase()] || opCode.substring(0, 2).toUpperCase();
        return `<span style="font-size:11px; font-family:sans-serif; font-weight:900; color:#fff; margin-left:8px; background:var(--fb-blue); padding:2px 6px; border-radius:4px; box-shadow:0 1px 2px rgba(0,0,0,0.2);">${initial}</span>`;
    } else if (provider === "smsbower" && rank) {
        if (rank === "G") return `<span style="background: linear-gradient(135deg, #f1c40f, #f39c12); font-family:sans-serif; color: white; padding: 1px 6px; border-radius: 4px; font-weight: 900; font-size: 11px; margin-left:8px; border:1px solid #d35400;">G</span>`;
        if (rank === "S") return `<span style="background: linear-gradient(135deg, #bdc3c7, #95a5a6); font-family:sans-serif; color: white; padding: 1px 6px; border-radius: 4px; font-weight: 900; font-size: 11px; margin-left:8px; border:1px solid #7f8c8d;">S</span>`;
        if (rank === "B") return `<span style="background: linear-gradient(135deg, #e67e22, #d35400); font-family:sans-serif; color: white; padding: 1px 6px; border-radius: 4px; font-weight: 900; font-size: 11px; margin-left:8px; border:1px solid #a04000;">B</span>`;
    }
    return "";
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

async function apiCall(endpoint, method = "GET", body = null) {
    const options = { method, headers: { "Content-Type": "application/json", "X-Server-Name": currentServerName } };
    if (body) options.body = JSON.stringify(body);
    try {
        const res = await fetch(`${BASE_URL}${endpoint}`, options);
        const text = await res.text(); 
        try { return JSON.parse(text); } 
        catch(e) { return { success: res.ok, status: res.ok ? "success" : "failed", error: { message: text || "Format server tidak sesuai" } }; }
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
        
        // 🌟 JIKA HERO / CEPAT: Tampilkan Operator
        if (activeProviderKey === "herosms" || activeProviderKey === "otpcepat") {
            let item = json.data.find(x => x.name && x.name.toLowerCase().includes("shope")) || json.data[0];
            let pid = item ? item.id : "ka";
            let name = "Shopee";
            let basePrice = item ? item.price : 0;

            let sendPrice = activeProviderKey === "otpcepat" ? 1100 : basePrice;
            let displayPrice = formatPrice(sendPrice);

            const ops = [
                { id: "telkomsel", label: "TELKOMSEL" },
                { id: "indosat", label: "INDOSAT" },
                { id: "axis", label: "AXIS" },
                { id: "three", label: "THREE" },
                { id: "xl", label: "XL" },
                { id: "smartfren", label: "SMARTFREN" }
            ];

            box.innerHTML = ops.map(op => {
                return `<div class="price-item" onclick="executeBuySms('${pid}', ${sendPrice}, '${name}', '${op.id}', '')">
                            <div style="flex: 1; min-width: 0; padding-right: 10px; display:flex; align-items:center;">
                                <div style="font-weight:bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color:var(--fb-text);">${op.label}</div>
                            </div>
                            <div style="display: flex; align-items: center; flex-shrink: 0; gap: 8px;">
                                <div style="min-width: 85px; text-align: right; color:var(--fb-red); font-family:monospace; font-size:14px; font-weight: 900; white-space: nowrap;">${displayPrice}</div>
                                <div style="min-width: 70px; text-align: right; font-size:12px; color:var(--fb-muted); white-space: nowrap;">~ stok</div>
                            </div>
                        </div>`;
            }).join('');
        } else {
            // 🌟 JIKA BOWER / CODE: TAMPILKAN DAFTAR SEPERTI BIASA
            box.innerHTML = json.data.map(i => {
                let shortName = i.name.replace(/Indonesia/ig, '').replace(/\s+/g, ' ').trim();
                let rankBadge = getOperatorBadge(activeProviderKey, i.operator, i.rank);
                let idLabel = (activeProviderKey === "smsbower" && i.operator !== "any") ? ` <span style="color:#aaa;">(ID: ${i.operator})</span>` : "";
                let extra = activeProviderKey === "smsbower" ? i.operator : (i.available || "~");
                let rankParam = i.rank || "S";

                return `<div class="price-item" onclick="executeBuySms('${i.id}', ${i.price}, '${shortName}', '${extra}', '${rankParam}')">
                            <div style="flex: 1; min-width: 0; padding-right: 10px; display:flex; align-items:center;">
                                <div style="font-weight:bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${shortName}${idLabel}</div>
                                ${rankBadge}
                            </div>
                            <div style="display: flex; align-items: center; flex-shrink: 0; gap: 8px;">
                                <div style="min-width: 85px; text-align: right; color:var(--fb-red); font-family:monospace; font-size:14px; font-weight: 900; white-space: nowrap;">${formatPrice(i.price)}</div>
                                <div style="min-width: 70px; text-align: right; font-size:12px; color:var(--fb-muted); white-space: nowrap;">${i.available || '~'} stok</div>
                            </div>
                        </div>`;
            }).join('');
        }
    } else { 
        box.innerHTML = `<div style="padding:30px; text-align:center; color:var(--fb-red); font-weight:bold;">${json.error?.message || json.message || json.error || 'Stok Kosong'}</div>`;
    }
}

function createCardHTML(oId, phone, priceDisplay, resendState, cancelState, replaceState, otpDisplay, isDone = false) {
    const doneStyle = isDone ? 'style="background:#e6f4ea; color:var(--fb-green); border-color:var(--fb-green);"' : 'disabled';
    
    let borderColor = "#95a5a6"; 
    if (activeProviderKey === "herosms") borderColor = "#8e44ad";
    if (activeProviderKey === "smsbower") borderColor = "#27ae60";
    if (activeProviderKey === "otpcepat") borderColor = "#e74c3c"; 
    
    let displayId = oId;
    if (activeProviderKey === "otpcepat" && String(oId).length > 6) {
        displayId = "..." + String(oId).slice(-4);
    }

    return `<div class="order-card" id="order-${activeProviderKey}-${oId}" data-created="${Date.now()}" style="border: 2px solid ${borderColor};">
        <div style="display:flex; justify-content:space-between; margin-bottom:15px; border-bottom:1px dashed var(--fb-border); padding-bottom:15px; align-items:center;">
            <div style="display:flex; align-items:center; gap:8px;">
                <span style="color:var(--fb-blue); font-weight:bold; font-family:monospace; font-size:15px;">#${displayId}</span>
                <span class="badge-status" style="font-size:10px; color:#fff; font-family:sans-serif; background:${borderColor}; padding:3px 6px; border-radius:4px; font-weight:bold;">ACTIVE</span>
                <span class="price-box" style="font-size:16px; font-weight:900; color:var(--fb-red); font-family:monospace; display:flex; align-items:center; white-space: nowrap;">${priceDisplay}</span>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
                <i class="fa-regular fa-eye-slash hide-btn-icon" onclick="hideSmsCard('${oId}')" style="color: var(--fb-muted); cursor:pointer; font-size:14px; padding: 5px;"></i>
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
            <button class="sms-btn btn-done" onclick="actSms('finish', '${oId}')" ${doneStyle}>✓ DONE</button>
            <button class="sms-btn btn-resend" onclick="actSms('resend', '${oId}')" ${resendState}>↻ RESEND</button>
            <button class="sms-btn btn-cancel" onclick="actSms('cancel', '${oId}')" ${cancelState}>✕ CANCEL</button>
            <button class="sms-btn btn-replace" onclick="actSms('replace', '${oId}')" ${replaceState}>⇄ REPLACE</button>
        </div>
    </div>`;
}

export async function buySms(pid, price, name, extra = "~", rank = "S") {
    let operator = extra === "~" ? "any" : extra;
    executeBuySms(pid, price, name, operator, rank);
}
window.buySms = buySms;

export async function executeBuySms(pid, price, name, operator, rank = "") {
    const pText = formatPrice(price);
    let opText = "";
    if ((activeProviderKey === "herosms" || activeProviderKey === "otpcepat") && operator !== "any") opText = ` (Prov: ${operator.toUpperCase()})`;
    else if (activeProviderKey === "smsbower" && operator !== "any") opText = ` (ID: ${operator})`;

    if(!await showModal("Pesan Baru", `Beli nomor untuk ${name}${opText} seharga ${pText}?`, "confirm")) {
        return;
    }

    const payload = (activeProviderKey === "herosms" || activeProviderKey === "smsbower" || activeProviderKey === "otpcepat") ? { product_id: String(pid), price: price, operator: operator } : { product_id: parseInt(pid) };
    const j = await apiCall('/create-order', 'POST', payload);
    const isSuccess = j.success === true || j.status === "success";

    if(isSuccess && j.data) {
        const o = j.data.orders[0];
        const newPhone = o.phone || o.phone_number || o.phoneNumber || 'Mencari Nomor...';
        
        localStorage.setItem(`phone_${activeProviderKey}_${o.id}`, newPhone);
        localStorage.setItem(`price_${activeProviderKey}_${o.id}`, price);
        localStorage.setItem(`pid_${activeProviderKey}_${o.id}`, pid);
        localStorage.setItem(`timer_${activeProviderKey}_${o.id}`, Date.now() + (20 * 60000));
        
        if (operator) localStorage.setItem(`op_${activeProviderKey}_${o.id}`, operator);
        if (rank) localStorage.setItem(`rank_${activeProviderKey}_${o.id}`, rank);

        const extraBadge = getOperatorBadge(activeProviderKey, operator, rank);
        const priceDisplay = formatPrice(price) + extraBadge;
        
        // CANCEL INSTAN: OtpCepat dan Bower langsung aktif sejak awal!
        let cancelState = (activeProviderKey === "smsbower" || activeProviderKey === "otpcepat") ? '' : 'disabled';
        let replaceState = 'disabled'; 

        const container = document.getElementById('sms-active-orders');
        const cardHTML = createCardHTML(o.id, newPhone, priceDisplay, 'disabled', cancelState, replaceState, `<div class="loader-bars"><span></span><span></span><span></span></div>`);
        container.insertAdjacentHTML('afterbegin', cardHTML);

        pollSms(); updateSmsBal();
        setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 150);
    } else {
        showModal("Gagal", j.error?.message || j.message || j.error || "Gagal memesan stok.", "alert");
    }
}
window.executeBuySms = executeBuySms;

async function pollSms() {
    let localIds = [];
    for(let i=0; i<localStorage.length; i++) {
        let k = localStorage.key(i);
        if(k.startsWith(`phone_${activeProviderKey}_`)) localIds.push(k.split('_')[2]);
    }

    const j = await apiCall('/get-active', 'POST', { ids: localIds });
    const isSuccess = j.success === true || j.status === "success";
    if(isSuccess && j.data) {
        activeOrders = j.data; 
        renderSmsOrders(j.data);
    }
}

export function hideSmsCard(id) {
    if (!orderStates[id]) orderStates[id] = {};
    orderStates[id].isHidden = true; 
    const card = document.getElementById(`order-${activeProviderKey}-${id}`);
    if (card) card.remove(); 
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

        const savedOp = localStorage.getItem(`op_${activeProviderKey}_${o.id}`) || "";
        const savedRank = localStorage.getItem(`rank_${activeProviderKey}_${o.id}`) || "";
        const extraBadge = getOperatorBadge(activeProviderKey, savedOp, savedRank);

        const priceDisplay = (serverPrice ? formatPrice(serverPrice) : '...') + extraBadge;
        const resendState = o.otp_code ? '' : 'disabled';
        const isDone = !!o.otp_code;
        let otpDisplay = o.otp_code ? `<span style="color:var(--fb-green); letter-spacing:4px; font-size:26px; font-weight:bold; font-family:monospace;">${o.otp_code}</span>` : `<div class="loader-bars"><span></span><span></span><span></span></div>`;
        
        const cancelState = (passed2Mins || activeProviderKey === "smsbower" || activeProviderKey === "otpcepat") && !o.otp_code ? '' : 'disabled';
        const replaceState = (passed2Mins && activeProviderKey !== "smsbower" && activeProviderKey !== "otpcepat") && !o.otp_code ? '' : 'disabled';

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
            if (priceBox && serverPrice) priceBox.innerHTML = priceDisplay;

            let displayNewId = o.id;
            if (activeProviderKey === "otpcepat" && String(o.id).length > 4) {
                displayNewId = "..." + String(o.id).slice(-4);
            }
            const spans = existingCard.querySelectorAll('span');
            spans.forEach(sp => { 
                if (sp.innerText.trim().startsWith('#')) sp.innerText = `#${displayNewId}`; 
            });

            if (o.otp_code) {
                const btnDone = existingCard.querySelector('.btn-done');
                if(btnDone && btnDone.disabled) { btnDone.disabled = false; btnDone.style.color = "var(--fb-green)"; btnDone.style.borderColor = "var(--fb-green)"; btnDone.style.background = "#e6f4ea"; }
                const btnResend = existingCard.querySelector('.btn-resend');
                if(btnResend && btnResend.disabled) btnResend.disabled = false;
                
                const btnCancel = existingCard.querySelector('.btn-cancel');
                if(btnCancel) btnCancel.disabled = true;
                const btnReplace = existingCard.querySelector('.btn-replace');
                if(btnReplace) btnReplace.disabled = true;
            } else {
                const btnCancel = existingCard.querySelector('.btn-cancel');
                if(btnCancel && btnCancel.disabled && (passed2Mins || activeProviderKey === "smsbower" || activeProviderKey === "otpcepat")) btnCancel.disabled = false;
                
                const btnReplace = existingCard.querySelector('.btn-replace');
                if(btnReplace && btnReplace.disabled && (passed2Mins && activeProviderKey !== "smsbower" && activeProviderKey !== "otpcepat")) btnReplace.disabled = false;
            }
        } else {
            const cardHTML = createCardHTML(o.id, phone, priceDisplay, resendState, cancelState, replaceState, otpDisplay, isDone);
            container.insertAdjacentHTML('afterbegin', cardHTML);
        }
    });
    updateSmsTimers();
}

async function autoCancelSilent(id) {
    await apiCall('/order-action', 'POST', { id, action: 'cancel' });
    localStorage.removeItem(`phone_${activeProviderKey}_${id}`);
    localStorage.removeItem(`timer_${activeProviderKey}_${id}`);
    localStorage.removeItem(`price_${activeProviderKey}_${id}`);
    localStorage.removeItem(`pid_${activeProviderKey}_${id}`);
    localStorage.removeItem(`op_${activeProviderKey}_${id}`);
    localStorage.removeItem(`rank_${activeProviderKey}_${id}`);
    pollSms(); updateSmsBal();
}

function updateSmsTimers() {
    const now = Date.now();
    document.querySelectorAll('.sms-timer').forEach(el => {
        const id = el.dataset.id;
        const end = parseInt(localStorage.getItem(`timer_${activeProviderKey}_${id}`)) || parseInt(localStorage.getItem('timer_' + id));

        if(end) {
            const diff = Math.max(0, Math.floor((end - now)/1000));
            el.innerText = `${Math.floor(diff/60)}:${(diff%60).toString().padStart(2,'0')}`;
            el.style.color = diff < 600 ? "var(--fb-red)" : "var(--fb-blue)"; 
            
            if (diff <= 1080 || activeProviderKey === "smsbower" || activeProviderKey === "otpcepat") { 
                const existingCard = document.getElementById(`order-${activeProviderKey}-${id}`); 
                if(existingCard && !existingCard.innerHTML.includes('color:var(--fb-green); letter-spacing:4px;')) { 
                    const btnCancel = existingCard.querySelector('.btn-cancel'); 
                    if(btnCancel && btnCancel.disabled) btnCancel.disabled = false; 
                    
                    if(activeProviderKey !== "smsbower" && activeProviderKey !== "otpcepat" && diff <= 1080) {
                        const btnReplace = existingCard.querySelector('.btn-replace'); 
                        if(btnReplace && btnReplace.disabled) btnReplace.disabled = false; 
                    }
                } 
            }
        }
    });

    activeOrders.forEach(o => {
        if (o.otp_code) return; 
        const end = parseInt(localStorage.getItem(`timer_${activeProviderKey}_${o.id}`));
        if (end) {
            const timeLeft = end - now;
            if (timeLeft <= 600000 && timeLeft > 0) {
                if (!orderStates[o.id]) orderStates[o.id] = {};
                if (!orderStates[o.id].autoCanceled) {
                    orderStates[o.id].autoCanceled = true; 
                    autoCancelSilent(o.id);
                }
            }
        }
    });
}

export async function actSms(action, id) {
    if (action === 'replace' && (activeProviderKey === "smsbower" || activeProviderKey === "otpcepat")) {
        showModal("Peringatan", "Fitur Replace tidak didukung oleh provider ini.", "alert");
        return;
    }

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
    if (errStr.includes('EARLY_CANCEL_DENIED') || errStr.includes('BELUM 2 MENIT') || errStr.includes('WAKTUNYA')) {
        isSuccess = false; 
    }

    if(isSuccess) {
        if(action === 'resend') {
            showModal("Info", "Permintaan terkirim.", "alert");
            pollSms(); return;
        }

        const pid = localStorage.getItem(`pid_${activeProviderKey}_${id}`);
        const price = localStorage.getItem(`price_${activeProviderKey}_${id}`);
        const oldOp = localStorage.getItem(`op_${activeProviderKey}_${id}`) || "any";

        localStorage.removeItem(`phone_${activeProviderKey}_${id}`);
        localStorage.removeItem(`timer_${activeProviderKey}_${id}`);
        localStorage.removeItem(`price_${activeProviderKey}_${id}`);
        localStorage.removeItem(`pid_${activeProviderKey}_${id}`);
        localStorage.removeItem(`op_${activeProviderKey}_${id}`);
        localStorage.removeItem(`rank_${activeProviderKey}_${id}`);

        if (action === 'cancel' || action === 'finish') {
            const oldCard = document.getElementById(`order-${activeProviderKey}-${id}`);
            if (oldCard) oldCard.remove();
        }

        if (action === 'replace' && pid) {
            delete orderStates[id]; 
            const payload = (activeProviderKey === "herosms" || activeProviderKey === "otpcepat") ? { product_id: String(pid), price: price, operator: oldOp } : { product_id: parseInt(pid) };
            const n = await apiCall('/create-order', 'POST', payload);
            const nSuccess = n.success === true || n.status === "success";
            
            if (nSuccess && n.data) {
                const od = n.data.orders[0];
                const newPhone = od.phone || od.phone_number || od.phoneNumber || 'Mencari Nomor...';
                
                localStorage.setItem(`phone_${activeProviderKey}_${od.id}`, newPhone);
                localStorage.setItem(`price_${activeProviderKey}_${od.id}`, price);
                localStorage.setItem(`pid_${activeProviderKey}_${od.id}`, pid);
                localStorage.setItem(`timer_${activeProviderKey}_${od.id}`, Date.now() + (20 * 60000));
                localStorage.setItem(`op_${activeProviderKey}_${od.id}`, oldOp);

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
                    if (btnDone) { btnDone.disabled = true; btnDone.style.background = ''; btnDone.style.borderColor = ''; btnDone.style.color = ''; btnDone.setAttribute('onclick', `actSms('finish', '${od.id}')`); }
                    
                    const btnResend = oldCard.querySelector('.btn-resend');
                    if (btnResend) { btnResend.disabled = true; btnResend.setAttribute('onclick', `actSms('resend', '${od.id}')`); }
                    
                    const btnCancel = oldCard.querySelector('.btn-cancel');
                    if (btnCancel) { btnCancel.disabled = true; btnCancel.setAttribute('onclick', `actSms('cancel', '${od.id}')`); }
                    
                    const btnReplace = oldCard.querySelector('.btn-replace');
                    if (btnReplace) { btnReplace.disabled = true; btnReplace.setAttribute('onclick', `actSms('replace', '${od.id}')`); }
                    
                    const hideBtn = oldCard.querySelector('.hide-btn-icon');
                    if (hideBtn) hideBtn.setAttribute('onclick', `hideSmsCard('${od.id}')`);

                    let displayNewId = od.id;
                    if (activeProviderKey === "otpcepat" && String(od.id).length > 4) {
                        displayNewId = "..." + String(od.id).slice(-4);
                    }
                    const spans = oldCard.querySelectorAll('span');
                    spans.forEach(sp => { 
                        if (sp.innerText.trim().startsWith('#')) sp.innerText = `#${displayNewId}`; 
                    });
                    
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
