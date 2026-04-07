import { showModal } from './ui.js';

// ==========================================
// 1. KONFIGURASI PROVIDER & STATE
// ==========================================
const PROVIDERS = {
    "smscode": { name: "Code", url: "https://sms.aam-zip.workers.dev" },
    "herosms": { name: "Hero", url: "https://hero.aam-zip.workers.dev" },
    "smsbower": { name: "Bower", url: "https://bower.aam-zip.workers.dev" },
    "otpcepat": { name: "Cepat", url: "https://cepat.aam-zip.workers.dev" }, // <-- URL OTPCEPAT ANDA
    "svco": { name: "Svco", url: "https://svco.aam-zip.workers.dev" } // <-- URL API BARU SMSVIRTUAL.CO
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
    if (activeProviderKey === "svco") return `${price}`; // Menghilangkan logo $ untuk Svco
    return `Rp ${parseInt(price || 0).toLocaleString('id-ID')}`; 
}

// Helper untuk memunculkan Badge Provider atau Ranking
function getOperatorBadge(provider, opCode, rank) {
    if ((provider === "herosms" || provider === "otpcepat" || provider === "svco") && opCode && opCode !== "any") {
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
        } 
        // 🌟 JIKA SVCO: Filter Shopee Indo, Limit Harga & Jabarkan Pilihan Operator
        else if (activeProviderKey === "svco") {
            let htmlList = [];
            
            // Mengecek apakah respons API sudah berupa array list produk atau masih mentah format smsvirtual.co
            let isStandardized = json.data[0] && json.data[0].price !== undefined && !json.data[0].customPrice;
            
            if (isStandardized) {
                let items = json.data.filter(i => {
                    let p = parseFloat(i.price || 0);
                    let op = (i.operator || i.name || "").toLowerCase();
                    return p <= 0.06885 && op !== "any" && op !== "acak";
                }).sort((a, b) => parseFloat(a.price) - parseFloat(b.price));

                htmlList = items.map(i => {
                    let opLabel = (i.operator || "").toUpperCase();
                    return `
                        <div class="price-item" onclick="executeBuySms('${i.id}', ${i.price}, 'Shopee', '${i.operator}', '')">
                            <div style="flex: 1; min-width: 0; padding-right: 10px; display:flex; align-items:center;">
                                <div style="font-weight:bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color:var(--fb-text);">Shopee - ${opLabel}</div>
                            </div>
                            <div style="display: flex; align-items: center; flex-shrink: 0; gap: 8px;">
                                <div style="min-width: 85px; text-align: right; color:var(--fb-red); font-family:monospace; font-size:14px; font-weight: 900; white-space: nowrap;">${formatPrice(i.price)}</div>
                                <div style="min-width: 70px; text-align: right; font-size:12px; color:var(--fb-muted); white-space: nowrap;">${i.available || '~'} stok</div>
                            </div>
                        </div>
                    `;
                });
            } else {
                // Ekstraksi data mentah API smsvirtual
                let shopeeData = json.data.find(x => x.country === 1 || (x.countryName || "").toLowerCase() === "indonesia") || json.data[0];
                if (shopeeData) {
                    let pid = shopeeData.serviceId || "1"; // Gunakan default id
                    let prices = (shopeeData.customPrice || []).filter(p => parseFloat(p.price) <= 0.06885).sort((a,b) => parseFloat(a.price) - parseFloat(b.price));
                    
                    if (prices.length === 0 && shopeeData.priceUsd && parseFloat(shopeeData.priceUsd) <= 0.06885) {
                        prices = [{ price: shopeeData.priceUsd, available: shopeeData.available || '~' }];
                    }
                    
                    let operators = (shopeeData.operators || []).filter(o => o.code && o.code.toLowerCase() !== 'any' && o.name && o.name.toLowerCase() !== 'any');
                    
                    prices.forEach(p => {
                        operators.forEach(op => {
                            htmlList.push(`
                                <div class="price-item" onclick="executeBuySms('${pid}', ${p.price}, 'Shopee', '${op.code}', '')">
                                    <div style="flex: 1; min-width: 0; padding-right: 10px; display:flex; align-items:center;">
                                        <div style="font-weight:bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color:var(--fb-text);">Shopee - ${op.name.toUpperCase()}</div>
                                    </div>
                                    <div style="display: flex; align-items: center; flex-shrink: 0; gap: 8px;">
                                        <div style="min-width: 85px; text-align: right; color:var(--fb-red); font-family:monospace; font-size:14px; font-weight: 900; white-space: nowrap;">${formatPrice(p.price)}</div>
                                        <div style="min-width: 70px; text-align: right; font-size:12px; color:var(--fb-muted); white-space: nowrap;">${p.available} stok</div>
                                    </div>
                                </div>
                            `);
                        });
                    });
                }
            }

            if (htmlList.length > 0) {
                box.innerHTML = htmlList.join('');
            } else {
                box.innerHTML = `<div style="padding:30px; text-align:center; color:var(--fb-red); font-weight:bold;">Tidak ada stok sesuai kriteria harga & provider</div>`;
            }
        } 
        // 🌟 JIKA BOWER / CODE: TAMPILKAN DAFTAR SEPERTI BIASA
        else {
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
    if (activeProviderKey === "svco") borderColor = "#007bff"; // Border biru sesuai instruksi
    
    let displayId = oId;
    if ((activeProviderKey === "otpcepat" || activeProviderKey === "svco") && String(oId).length > 6) {
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
    if ((activeProvi