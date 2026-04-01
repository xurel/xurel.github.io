export function generateName() {
    try {
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
        outputEl.value = hasilLengkap; 
        
        if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(hasilLengkap);
        else { outputEl.select(); document.execCommand('copy'); window.getSelection().removeAllRanges(); }
        
        const btn = document.getElementById('btn-gen'); 
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Disalin!'; 
        btn.style.background = 'var(--fb-green)';
        setTimeout(() => { 
            btn.innerHTML = '<i class="fa-solid fa-shuffle"></i> Acak Data'; 
            btn.style.background = 'var(--fb-blue)'; 
        }, 1500);
    } catch (err) { alert("Gagal mengacak data. Pastikan koneksi internet Anda aktif."); }
}
