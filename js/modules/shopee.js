import { db } from './firebase.js';
import { showModal } from './ui.js';

let shopeeDataCache = {}; 
let editingShopeeKey = null;
let userAdmin = null;

// Mendengarkan perubahan login dari main.js
window.addEventListener('authStateChanged', (e) => { userAdmin = e.detail; renderShopee(); });

db.ref('linkshopee').on('value', snap => { shopeeDataCache = snap.val() || {}; renderShopee(); });

export function formatRupiah(el) {
    let angka = el.value.replace(/[^,\d]/g, '').toString(); let split = angka.split(','); let sisa = split[0].length % 3;
    let rupiah = split[0].substr(0, sisa); let ribuan = split[0].substr(sisa).match(/\d{3}/gi);
    if (ribuan) { rupiah += (sisa ? '.' : '') + ribuan.join('.'); }
    el.value = rupiah ? 'Rp ' + rupiah : '';
}

export async function addShopeeMenu() {
    const t = document.getElementById('shopee-title').value; const u = document.getElementById('shopee-url').value;
    const p = document.getElementById('shopee-price').value; const s = document.getElementById('shopee-status').value;
    if(t && u) {
        db.ref('linkshopee').push({ title: t, url: u, price: p, status: s, createdAt: Date.now() }).then(() => {
            document.getElementById('shopee-title').value = ""; document.getElementById('shopee-url').value = "";
            document.getElementById('shopee-price').value = ""; document.getElementById('shopee-status').value = "";
        });
    } else showModal("Peringatan", "Nama Produk & URL wajib diisi!", "alert");
}

function renderShopee() {
    const container = document.getElementById('shopee-container'); container.innerHTML = "";
    const colors = ['#e41e3f', '#1877f2', '#8e44ad', '#f39c12', '#2ecc71', '#1abc9c', '#d35400'];
    
    Object.keys(shopeeDataCache).reverse().forEach((key, idx) => {
        const data = shopeeDataCache[key]; const isAdmin = !!userAdmin;
        const wrapper = document.createElement('div');
        
        if (isAdmin && editingShopeeKey === key) {
            wrapper.className = 'content-card'; wrapper.style.padding = '10px'; wrapper.style.marginBottom = '0';
            wrapper.innerHTML = `
                <input id="ed-t-${key}" class="form-input" value="${data.title}">
                <input id="ed-u-${key}" class="form-input" value="${data.url}">
                <button class="btn-primary" onclick="saveEditShopee('${key}')">Simpan</button>`;
        } else {
            wrapper.className = 'shopee-item-wrapper'; wrapper.style.background = colors[idx % colors.length];
            let st = data.status ? `<span class="badge-status">${data.status}</span>` : ''; let pr = data.price ? `<span class="badge-status">${data.price}</span>` : '';
            wrapper.innerHTML = `
                <div class="shopee-copy-btn" onclick="copyShopeeLink(event, '${data.url}', this)" title="Salin Link"><i class="fa-solid fa-copy"></i></div>
                <a href="${data.url}" target="_blank" class="shopee-item"><span>${data.title}</span><div class="shopee-details">${st}${pr}</div></a>
                ${isAdmin ? `<div class="admin-controls"><button class="btn-ctrl" onclick="editingShopeeKey='${key}'; window.dispatchEvent(new Event('renderShopeeReq'));"><i class="fa-solid fa-pen" style="font-size:12px;"></i></button><button class="btn-ctrl" style="color:var(--fb-red)" onclick="deleteShopee('${key}')"><i class="fa-solid fa-trash" style="font-size:12px;"></i></button></div>` : ''}`;
        }
        container.appendChild(wrapper);
    });
}

// Trick untuk me-render ulang dari tombol edit
window.addEventListener('renderShopeeReq', renderShopee);
window.editingShopeeKey = null; // Setel ke window agar tombol HTML bisa memodifikasinya jika diperlukan.

export function saveEditShopee(key) { db.ref('linkshopee/'+key).update({ title: document.getElementById(`ed-t-${key}`).value, url: document.getElementById(`ed-u-${key}`).value }).then(() => { editingShopeeKey = null; renderShopee(); }); }
export async function deleteShopee(key) { if(await showModal("Hapus Link", "Yakin ingin menghapus link Shopee ini?", "danger")) db.ref('linkshopee/'+key).remove(); }
export function copyShopeeLink(event, url, btnElement) {
    event.preventDefault(); event.stopPropagation();
    navigator.clipboard.writeText(url).then(() => {
        const originalIcon = btnElement.innerHTML; btnElement.innerHTML = '<i class="fa-solid fa-check" style="color:var(--fb-green);"></i>';
        setTimeout(() => { btnElement.innerHTML = originalIcon; }, 1500);
    }).catch(() => showModal("Gagal", "Perangkat tidak mendukung fitur salin otomatis.", "alert"));
}
