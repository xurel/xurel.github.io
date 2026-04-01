import { db } from './firebase.js';
import { showModal, closeModal } from './ui.js';

let shopeeDataCache = {}; 
let userAdmin = null;

window.addEventListener('authStateChanged', (e) => { 
    userAdmin = e.detail; 
    renderShopee(); 
});

db.ref('linkshopee').on('value', snap => { 
    shopeeDataCache = snap.val() || {}; 
    renderShopee(); 
});

export function formatRupiah(el) {
    let angka = el.value.replace(/[^,\d]/g, '').toString(); let split = angka.split(','); let sisa = split[0].length % 3;
    let rupiah = split[0].substr(0, sisa); let ribuan = split[0].substr(sisa).match(/\d{3}/gi);
    if (ribuan) { rupiah += (sisa ? '.' : '') + ribuan.join('.'); }
    el.value = rupiah ? 'Rp ' + rupiah : '';
}

export function openShopeeModal(key = null) {
    document.getElementById('shopee-edit-key').value = key || "";
    if (key && shopeeDataCache[key]) {
        document.getElementById('modal-shopee-title').innerText = "Edit Link Shopee";
        document.getElementById('shopee-title').value = shopeeDataCache[key].title || "";
        document.getElementById('shopee-url').value = shopeeDataCache[key].url || "";
        document.getElementById('shopee-price').value = shopeeDataCache[key].price || "";
        document.getElementById('shopee-status').value = shopeeDataCache[key].status || "";
    } else {
        document.getElementById('modal-shopee-title').innerText = "Tambah Link Shopee";
        document.getElementById('shopee-title').value = "";
        document.getElementById('shopee-url').value = "";
        document.getElementById('shopee-price').value = "";
        document.getElementById('shopee-status').value = "";
    }
    document.getElementById('modal-shopee-form').classList.add('active');
}

export function saveShopee() {
    const key = document.getElementById('shopee-edit-key').value;
    const t = document.getElementById('shopee-title').value; 
    const u = document.getElementById('shopee-url').value;
    const p = document.getElementById('shopee-price').value; 
    const s = document.getElementById('shopee-status').value;
    
    if(t && u) {
        const data = { title: t, url: u, price: p, status: s };
        if (key) {
            db.ref('linkshopee/'+key).update(data).then(() => closeModal('modal-shopee-form'));
        } else {
            db.ref('linkshopee').push(data).then(() => closeModal('modal-shopee-form'));
        }
    } else {
        showModal("Peringatan", "Nama Produk & URL wajib diisi!", "alert");
    }
}

export async function deleteShopee(key) { 
    if(await showModal("Hapus Link", "Yakin ingin menghapus link Shopee ini?", "danger")) {
        db.ref('linkshopee/'+key).remove(); 
    }
}

function renderShopee() {
    const container = document.getElementById('shopee-container'); 
    container.innerHTML = "";
    const colors = ['#e41e3f', '#1877f2', '#8e44ad', '#f39c12', '#2ecc71', '#1abc9c', '#d35400'];
    const isAdmin = !!userAdmin;

    // KUNCI PERBAIKAN URUTAN: Mengurutkan menggunakan ID Unik Firebase
    // localeCompare akan memastikan urutan abjad/angka selalu menaruh data ter-BARU di paling ATAS
    let orderedShopee = Object.keys(shopeeDataCache).map(k => ({ key: k, ...shopeeDataCache[k] }));
    orderedShopee.sort((a, b) => b.key.localeCompare(a.key));

    orderedShopee.forEach((data, idx) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'shopee-item-wrapper'; 
        wrapper.style.background = colors[idx % colors.length];
        
        let st = data.status ? `<span class="badge-status">${data.status}</span>` : ''; 
        let pr = data.price ? `<span class="badge-status">${data.price}</span>` : '';
        
        let adminBtns = '';
        if(isAdmin) {
            adminBtns = `
            <div class="admin-controls">
                <button class="btn-ctrl" onclick="openShopeeModal('${data.key}')" title="Edit"><i class="fa-solid fa-pen" style="font-size:12px;"></i></button>
                <button class="btn-ctrl" style="color:var(--fb-red)" onclick="deleteShopee('${data.key}')" title="Hapus"><i class="fa-solid fa-trash" style="font-size:12px;"></i></button>
            </div>`;
        }

        wrapper.innerHTML = `
            <div class="shopee-copy-btn" onclick="copyShopeeLink(event, '${data.url}', this)" title="Salin Link"><i class="fa-solid fa-copy"></i></div>
            <a href="${data.url}" target="_blank" class="shopee-item">
                <span>${data.title}</span><div class="shopee-details">${st}${pr}</div>
            </a>
            ${adminBtns}
        `;
        container.appendChild(wrapper);
    });
}

export function copyShopeeLink(event, url, btnElement) {
    event.preventDefault(); event.stopPropagation();
    navigator.clipboard.writeText(url).then(() => {
        const originalIcon = btnElement.innerHTML; btnElement.innerHTML = '<i class="fa-solid fa-check" style="color:var(--fb-green);"></i>';
        setTimeout(() => { btnElement.innerHTML = originalIcon; }, 1500);
    }).catch(() => showModal("Gagal", "Perangkat tidak mendukung fitur salin otomatis.", "alert"));
}
