// ==========================================
// KONFIGURASI STORAGE & DATA
// ==========================================
const STORAGE_BASE_EMAIL = 'xurel_base_email';
const STORAGE_EMAIL_INDEX = 'xurel_email_index';

// Fungsi bantuan untuk menyalin teks tanpa menampilkannya
async function copyToClipboard(text) {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
        } else {
            throw new Error("Fallback");
        }
    } catch (err) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px"; // Sembunyikan textarea
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
    }
}

// Fungsi format iterasi email
function formatEmail(baseEmail, index) {
    if (!baseEmail) return "";
    if (index === 0) return baseEmail;
    const parts = baseEmail.split('@');
    return `${parts[0]}${index}@${parts[1]}`;
}

// ==========================================
// FUNGSI UTAMA ACAK DATA
// ==========================================
export async function generateName() {
    try {
        const fakerObj = window.faker;
        if(!fakerObj) {
            alert("Sistem pengacak data sedang dimuat, silakan coba lagi.");
            return;
        }
        fakerObj.locale = "id_ID";

        // 1. SISTEM ANTI-DUPLIKAT HARIAN
        const hariIni = new Date().toDateString(); 
        let tanggalTersimpan = localStorage.getItem('xurel_used_date');
        let namaTerpakai = [];

        if (tanggalTersimpan !== hariIni) {
            localStorage.setItem('xurel_used_date', hariIni);
            localStorage.setItem('xurel_used_names', JSON.stringify([]));
        } else {
            const memoriNama = localStorage.getItem('xurel_used_names');
            if (memoriNama) namaTerpakai = JSON.parse(memoriNama);
        }

        let nama = "";
        let batasMaksimal = 0; 
        do {
            nama = fakerObj.name.findName();
            batasMaksimal++;
        } while (namaTerpakai.includes(nama) && batasMaksimal < 150);

        namaTerpakai.push(nama);
        localStorage.setItem('xurel_used_names', JSON.stringify(namaTerpakai));

        // 2. ACAK NOMOR HP (REALISTIS INDONESIA)
        const prefixProvider = [
            '0811', '0812', '0813', '0821', '0822', '0852', // Telkomsel
            '0815', '0816', '0857', '0858',                 // Indosat
            '0817', '0818', '0819', '0859', '0877', '0878', // XL
            '0895', '0896', '0897', '0898',                 // Tri
            '0881', '0882', '0887', '0888'                  // Smartfren
        ];
        const prefix = prefixProvider[Math.floor(Math.random() * prefixProvider.length)];
        const sisaDigit = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
        const noHp = prefix + sisaDigit;
        
        // 3. ACAK PROVINSI, KOTA & KODE POS (WEIGHTED)
        const daerah = [
            { prov: "DKI JAKARTA", zip: "1", weight: 30, kota: ["JAKARTA SELATAN", "JAKARTA PUSAT", "JAKARTA BARAT", "JAKARTA TIMUR"] },
            { prov: "JAWA BARAT", zip: "4", weight: 35, kota: ["BANDUNG", "BOGOR", "BEKASI", "DEPOK", "CIREBON", "GARUT"] },
            { prov: "JAWA TENGAH", zip: "5", weight: 30, kota: ["SEMARANG", "SURAKARTA", "MAGELANG", "CILACAP", "KUDUS"] },
            { prov: "JAWA TIMUR", zip: "6", weight: 35, kota: ["SURABAYA", "MALANG", "SIDOARJO", "GRESIK", "JEMBER"] },
            { prov: "BALI", zip: "8", weight: 15, kota: ["DENPASAR", "BADUNG", "GIANYAR"] },
            { prov: "SUMATERA UTARA", zip: "2", weight: 15, kota: ["MEDAN", "BINJAI", "DELI SERDANG"] },
            { prov: "SULAWESI SELATAN", zip: "9", weight: 12, kota: ["MAKASSAR", "GOWA", "MAROS"] },
            { prov: "PAPUA", zip: "9", weight: 1, kota: ["JAYAPURA", "SORONG"] } // Bobot kecil
        ];

        let totalWeight = daerah.reduce((sum, item) => sum + item.weight, 0);
        let randomNum = Math.random() * totalWeight;
        let pilihDaerah = daerah[0];
        for (let d of daerah) {
            if (randomNum < d.weight) { pilihDaerah = d; break; }
            randomNum -= d.weight;
        }

        const provinsi = pilihDaerah.prov;
        const kota = pilihDaerah.kota[Math.floor(Math.random() * pilihDaerah.kota.length)];
        const kodePos = `${pilihDaerah.zip}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

        // 4. ACAK JALAN DAN PATOKAN
        const jalanList = ["JL. JENDERAL SUDIRMAN", "JL. GATOT SUBROTO", "JL. AHMAD YANI", "JL. MERDEKA", "JL. DIPONEGORO", "JL. PAHLAWAN", "JL. MELATI", "JL. ANGGREK", "JL. NUSA INDAH"];
        const namaJalan = jalanList[Math.floor(Math.random() * jalanList.length)];
        const nomorRumah = Math.floor(Math.random() * 200) + 1;
        const jalan = `${namaJalan} NO. ${nomorRumah}`;
        
        const patokanList = ["Samping Masjid", "Depan Indomaret", "Sebelah SD", "Belakang Pasar", "Samping Apotek", "Pas Tikungan", "Rumah Pagar Hitam"];
        const patokanAcak = patokanList[Math.floor(Math.random() * patokanList.length)].toUpperCase();

        // ========================================
        // EKSEKUSI DATA (DATA DISALIN, EMAIL TAMPIL)
        // ========================================
        const hasilLengkap = `${nama}, ${noHp}, ${provinsi}, ${kota}, ${kodePos}, ${jalan} (${patokanAcak})`;
        
        // Buat Email Base
        const baseEmail = `${fakerObj.internet.userName().toLowerCase().replace(/[^a-z0-9]/g, '')}${Math.floor(Math.random() * 99)}@gmail.com`;
        localStorage.setItem(STORAGE_BASE_EMAIL, baseEmail);
        localStorage.setItem(STORAGE_EMAIL_INDEX, "0");

        // Set email ke dalam kolom Input
        const outputEl = document.getElementById('genNameOutput');
        if (outputEl) outputEl.value = formatEmail(baseEmail, 0);

        // Salin DATA LENGKAP ke Clipboard
        await copyToClipboard(hasilLengkap);

        // Feedback Visual Tombol Acak
        const btn = document.getElementById('btn-gen'); 
        if (btn) {
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Disalin!'; 
            btn.style.background = '#e6f4ea';
            btn.style.color = '#28a745';
            btn.style.borderColor = '#28a745';
            setTimeout(() => { 
                btn.innerHTML = originalText; 
                btn.style.background = 'white'; 
                btn.style.color = 'var(--fb-text)';
                btn.style.borderColor = 'var(--fb-border)';
            }, 1000);
        }

    } catch (err) {
        console.error("Error Detail:", err);
    }
}

// ==========================================
// EVENT LISTENERS: TOMBOL NEXT & PREV (KHUSUS EMAIL)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    const outputEl = document.getElementById('genNameOutput');

    // Load email terakhir saat web direfresh
    const savedBase = localStorage.getItem(STORAGE_BASE_EMAIL);
    const savedIndex = localStorage.getItem(STORAGE_EMAIL_INDEX);
    if (savedBase && outputEl) {
        outputEl.value = formatEmail(savedBase, parseInt(savedIndex || 0));
    }

    // Fungsi klik NEXT
    btnNext?.addEventListener('click', async () => {
        let base = localStorage.getItem(STORAGE_BASE_EMAIL);
        let index = parseInt(localStorage.getItem(STORAGE_EMAIL_INDEX) || 0);

        if (!base) return; 
        index++;
        localStorage.setItem(STORAGE_EMAIL_INDEX, index.toString());
        
        const newEmail = formatEmail(base, index);
        if (outputEl) outputEl.value = newEmail;
        await copyToClipboard(newEmail); // Salin email ke clipboard

        // Efek Flash
        const originHtml = btnNext.innerHTML;
        btnNext.innerHTML = '<i class="fa-solid fa-check"></i>';
        setTimeout(() => btnNext.innerHTML = originHtml, 500);
    });

    // Fungsi klik PREV
    btnPrev?.addEventListener('click', async () => {
        let base = localStorage.getItem(STORAGE_BASE_EMAIL);
        let index = parseInt(localStorage.getItem(STORAGE_EMAIL_INDEX) || 0);

        if (!base || index <= 0) return; // Cegah index minus
        index--;
        localStorage.setItem(STORAGE_EMAIL_INDEX, index.toString());
        
        const newEmail = formatEmail(base, index);
        if (outputEl) outputEl.value = newEmail;
        await copyToClipboard(newEmail); // Salin email ke clipboard

        // Efek Flash
        const originHtml = btnPrev.innerHTML;
        btnPrev.innerHTML = '<i class="fa-solid fa-check"></i>';
        setTimeout(() => btnPrev.innerHTML = originHtml, 500);
    });
});
