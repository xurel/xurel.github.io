export function generateName() {
    try {
        // Mengambil Faker dari global window agar terbaca di dalam Modul
        const faker = window.faker;
        
        if (!faker) {
            alert("Sistem pengacak data sedang dimuat, silakan coba lagi dalam beberapa detik.");
            return;
        }

        faker.locale = "id_ID";
        const nama = faker.name.findName();
        const noHp = faker.phone.phoneNumber('08##########'); 
        const provinsi = faker.address.state().toUpperCase();
        const kota = faker.address.city().toUpperCase();
        const jalan = faker.address.streetName().toUpperCase();
        
        const daftarPatokan = ["Samping Masjid", "Depan Gereja", "Dekat SMA", "Sebelah SD", "Belakang Pasar", "Depan Alfamart", "Samping Indomaret"];
        const patokanAcak = daftarPatokan[Math.floor(Math.random() * daftarPatokan.length)].toUpperCase();
        
        const hasilLengkap = `${nama}, ${noHp}, ${provinsi}, ${kota}, ${jalan} (${patokanAcak})`;
        
        const outputEl = document.getElementById('genNameOutput');
        if (outputEl) outputEl.value = hasilLengkap; 
        
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(hasilLengkap);
        } else if (outputEl) {
            outputEl.select();
            document.execCommand('copy');
            window.getSelection().removeAllRanges(); 
        }
        
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
        console.error("Error saat mengacak data:", err);
        // Menampilkan pesan error asli agar lebih mudah dilacak jika terjadi lagi
        alert("Gagal mengacak data. Error: " + err.message);
    }
}
