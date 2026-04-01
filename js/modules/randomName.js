export async function generateName() {
    try {
        const fakerObj = window.faker;
        
        if(!fakerObj) {
            alert("Sistem pengacak data sedang dimuat, silakan coba lagi.");
            return;
        }

        fakerObj.locale = "id_ID";
        const nama = fakerObj.name.findName();
        const noHp = fakerObj.phone.phoneNumber('08##########');
        const provinsi = fakerObj.address.state().toUpperCase();
        const kota = fakerObj.address.city().toUpperCase();
        const jalan = fakerObj.address.streetName().toUpperCase();
        
        const daftarPatokan = ["Samping Masjid", "Depan Gereja", "Dekat SMA", "Sebelah SD", "Belakang Pasar", "Depan Alfamart", "Samping Indomaret", "Dekat Balai Desa"];
        const patokanAcak = daftarPatokan[Math.floor(Math.random() * daftarPatokan.length)].toUpperCase();
        
        const hasilLengkap = `${nama}, ${noHp}, ${provinsi}, ${kota}, ${jalan} (${patokanAcak})`;
        
        const outputEl = document.getElementById('genNameOutput');
        if (outputEl) outputEl.value = hasilLengkap; 
        
        // ==========================================
        // SISTEM AUTO-COPY ANTI-GAGAL (KHUSUS HP)
        // ==========================================
        try {
            // 1. Mencoba cara modern terlebih dahulu
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(hasilLengkap);
            } else {
                throw new Error("Gunakan cara paksa (fallback)");
            }
        } catch (err) {
            // 2. Cara paksa menggunakan Invisible Textarea (Trik Android/iOS)
            const textAreaBayangan = document.createElement("textarea");
            textAreaBayangan.value = hasilLengkap;
            
            // Cegah layar HP melompat/scroll ke bawah
            textAreaBayangan.style.position = "fixed"; 
            textAreaBayangan.style.top = "0";
            textAreaBayangan.style.left = "0";
            
            // Sembunyikan dari layar
            textAreaBayangan.style.opacity = "0"; 
            
            document.body.appendChild(textAreaBayangan);
            
            // Fokus dan Salin
            textAreaBayangan.focus();
            textAreaBayangan.select();
            document.execCommand('copy');
            
            // Hapus kembali area bayangan
            document.body.removeChild(textAreaBayangan);
        }
        // ==========================================
        
        // Animasi Tombol
        const btn = document.getElementById('btn-gen'); 
        if (btn) {
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Disalin!'; 
            btn.style.background = 'var(--fb-green)';
            setTimeout(() => { 
                btn.innerHTML = '<i class="fa-solid fa-shuffle"></i> Acak Data'; 
                btn.style.background = 'var(--fb-blue)'; 
            }, 1500);
        }

    } catch (err) {
        console.error("Error Detail:", err);
        alert("Gagal mengacak data. Error: " + err.message);
    }
}
