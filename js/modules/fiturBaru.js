// ⚠️ GANTI DENGAN URL WORKER ANDA
const BOWER_WORKER = "https://nama-worker-anda.workers.dev";

// Fungsi Utama: Mencetak UI dan Menjalankan Sistem
function jalankanModulSmsBower() {
    // 1. CARI KANVAS KOSONGNYA
    const wadahTabBaru = document.getElementById('app-baru'); 
    if (!wadahTabBaru) return;

    // 2. CETAK DESAIN HTML LANGSUNG DARI JAVASCRIPT
    wadahTabBaru.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; background: white; padding: 12px 16px; border-radius: 12px; margin-bottom: 20px; border: 1px solid #f0f0f0;">
            <div style="display: flex; align-items: center; gap: 10px;">
                <select id="pilihHpBower" style="padding: 6px 10px; border-radius: 6px; border: 1px solid #e0e0e0; background: #f8f9fa; font-size: 13px; font-weight: 600; outline: none; cursor: pointer;">
                    <option value="">Memuat...</option>
                </select>
                <i class="fas fa-lock" style="color: #5f6368;"></i>
            </div>
            <div id="saldoBower" style="background: #e6f4ea; color: #1e8e3e; padding: 6px 14px; border-radius: 20px; font-weight: bold; font-size: 13px;">
                Saldo Siap
            </div>
        </div>

        <div id="wadahOrderAktifBower"></div>

        <div style="font-size: 12px; color: #5f6368; font-weight: bold; margin-bottom: 12px; text-transform: uppercase;">Pesan Nomor Baru</div>
        <div style="background: white; border-radius: 12px; border: 1px solid #f0f0f0; overflow: hidden; margin-bottom: 30px;">
            <div id="btnBeliListBower" style="display: flex; justify-content: space-between; align-items: center; padding: 16px; border-bottom: 1px solid #f0f0f0; cursor: pointer; background: white; transition: background 0.2s;">
                <div style="font-weight: 700; font-size: 14px; color: #000;">
                    Shopee - 🇮🇩 (Otomatis)
                </div>
                <div style="display: flex; gap: 20px; align-items: center;">
                    <span style="color: #d93025; font-weight: bold; font-size: 13px;">Max Rp 1500</span>
                    <span style="color: #5f6368; font-size: 11px;">Beli <i class="fas fa-chevron-right" style="margin-left: 4px;"></i></span>
                </div>
            </div>
        </div>
    `;

    // 3. SETELAH HTML TERCETAK, JALANKAN LOGIKA SISTEMNYA
    initLogikaBower();
}

// Fungsi Logika API dan Tombol
function initLogikaBower() {
    const selectHp = document.getElementById('pilihHpBower');
    const btnBeliList = document.getElementById('btnBeliListBower');
    const wadahOrder = document.getElementById('wadahOrderAktifBower');

    let urutanPembelian = 0; 
    let intervalTimers = {}; 

    // Ambil List HP
    fetch(`${BOWER_WORKER}/list`)
        .then(res => res.json())
        .then(data => {
            selectHp.innerHTML = data.map(hp => `<option value="${hp.id}">${hp.label}</option>`).join('');
            selectHp.disabled = false;
        }).catch(() => selectHp.innerHTML = "<option>Gagal koneksi worker</option>");

    // Aksi Beli
    btnBeliList.onclick = async () => {
        const hp = selectHp.value;
        const listTextAsli = btnBeliList.innerHTML; 
        
        btnBeliList.innerHTML = `<div style="text-align:center; width:100%; font-weight:bold; color:#1a73e8;"><i class="fas fa-spinner fa-spin"></i> Memproses...</div>`;
        btnBeliList.style.pointerEvents = "none";
        
        try {
            const res = await fetch(`${BOWER_WORKER}/beli?target=${hp}`);
            const text = await res.text();
            
            if (text.includes("ACCESS_NUMBER")) {
                const parts = text.split(":");
                const idTransaksi = parts[1];
                const nomorHp = parts[2];
                
                urutanPembelian++; 
                buatKartuOrder(idTransaksi, nomorHp, urutanPembelian, hp);
            } else if (text === "NO_NUMBERS") {
                alert("Stok kosong atau harga di atas Rp 1.500 saat ini.");
            } else {
                alert(`Respon Server: ${text}`);
            }
        } catch (e) { alert("Error sistem / jaringan."); }
        
        btnBeliList.innerHTML = listTextAsli;
        btnBeliList.style.pointerEvents = "auto";
    };

    // Fungsi Buat Kartu
    function buatKartuOrder(id, nomor, urutan, hpTerpilih) {
        const htmlKartu = `
        <div id="kartu-${id}" style="background: white; border-radius: 12px; padding: 16px; margin-bottom: 20px; border: 1px solid #f0f0f0; box-shadow: 0 2px 4px rgba(0,0,0,0.02); transition: opacity 0.3s;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="color: #1a73e8; font-weight: 600; font-size: 14px;">#${id}</span>
                    <span style="background: #f1f3f4; color: #5f6368; font-size: 10px; padding: 3px 6px; border-radius: 4px; font-weight: 800;">ACTIVE</span>
                    <span style="color: #d93025; font-weight: 600; font-size: 14px;">Rp 1.500 <span style="color:#5f6368; font-size:11px; margin-left:4px;">(Ke-${urutan})</span></span>
                </div>
                <div id="timer-${id}" style="color: #1a73e8; font-weight: 600; font-size: 14px;">20:00</div>
            </div>
            <div style="border-top: 1px dashed #e0e0e0; margin-bottom: 16px;"></div>
            <div style="margin-bottom: 20px; text-align: center;">
                <div style="font-size: 10px; color: #5f6368; font-weight: bold; letter-spacing: 1px; margin-bottom: 8px;">TAP UNTUK SALIN:</div>
                <div style="display: flex; justify-content: center; align-items: center; gap: 10px;">
                    <span id="nomorTeks-${id}" style="font-size: 22px; font-weight: 800; letter-spacing: 1px; color: #000; cursor: pointer;">${nomor}</span>
                    <i class="far fa-copy btn-copy-${id}" style="color: #5f6368; cursor: pointer; font-size: 18px;"></i>
                </div>
            </div>
            <div style="text-align: center; margin-bottom: 24px;">
                <div style="font-size: 10px; color: #5f6368; font-weight: bold; letter-spacing: 1px; margin-bottom: 8px;">KODE OTP</div>
                <div id="otpDisplay-${id}" style="color: #1a73e8; font-size: 24px; font-weight: bold; display: flex; justify-content: center; gap: 4px; align-items: center; height: 35px;">
                    <i class="fas fa-signal" style="color: #1a73e8; font-size: 20px;"></i> 
                </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <button id="btnCek-${id}" style="padding: 12px; border-radius: 8px; border: 1px solid #e0e0e0; background: white; color: #1a73e8; font-weight: bold; font-size: 12px; cursor: pointer; transition: 0.2s;"><i class="fas fa-sync-alt"></i> CEK OTP</button>
                <button id="btnBatal-${id}" style="padding: 12px; border-radius: 8px; border: 1px solid #e0e0e0; background: white; color: #d93025; font-weight: bold; font-size: 12px; cursor: pointer; transition: 0.2s;"><i class="fas fa-times"></i> CANCEL</button>
            </div>
        </div>`;

        wadahOrder.insertAdjacentHTML('afterbegin', htmlKartu);
        jalankanTimer(id);

        const salinTeks = () => navigator.clipboard.writeText(nomor).then(() => alert(`Nomor disalin: ${nomor}`));
        document.querySelector(`.btn-copy-${id}`).addEventListener('click', salinTeks);
        document.getElementById(`nomorTeks-${id}`).addEventListener('click', salinTeks);

        const btnCek = document.getElementById(`btnCek-${id}`);
        const btnBatal = document.getElementById(`btnBatal-${id}`);
        
        btnCek.addEventListener('click', async () => {
            const iconAsli = btnCek.innerHTML;
            btnCek.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
            btnCek.disabled = true;

            try {
                const res = await fetch(`${BOWER_WORKER}/status?target=${hpTerpilih}&id=${id}`);
                const text = await res.text();

                if (text.includes("STATUS_OK")) {
                    const otp = text.split(":")[1];
                    document.getElementById(`otpDisplay-${id}`).innerHTML = `<span style="background:#e6f4ea; padding:4px 12px; border-radius:6px; color:#1e8e3e; font-size:32px; font-weight:900; letter-spacing:4px;">${otp}</span>`;
                    clearInterval(intervalTimers[id]);
                    document.getElementById(`timer-${id}`).innerText = "DONE";
                    document.getElementById(`timer-${id}`).style.color = "#1e8e3e";
                    
                    btnCek.disabled = true; btnBatal.disabled = true;
                    btnCek.innerHTML = `<i class="fas fa-check"></i> SUKSES`;
                    btnBatal.innerHTML = `-`;
                } else {
                    const disp = document.getElementById(`otpDisplay-${id}`);
                    disp.style.opacity = '0.3'; setTimeout(() => disp.style.opacity = '1', 300);
                    btnCek.disabled = false;
                }
            } catch (e) { alert("Gagal mengecek server."); btnCek.disabled = false; }
            
            if(!btnCek.disabled) btnCek.innerHTML = iconAsli;
        });

        btnBatal.addEventListener('click', async () => {
            btnBatal.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
            btnBatal.disabled = true; btnCek.disabled = true;

            try {
                await fetch(`${BOWER_WORKER}/cancel?target=${hpTerpilih}&id=${id}`);
                clearInterval(intervalTimers[id]);
                const kartu = document.getElementById(`kartu-${id}`);
                kartu.style.opacity = '0'; setTimeout(() => kartu.remove(), 300);
            } catch (e) { 
                alert("Gagal membatalkan."); 
                btnBatal.innerHTML = `<i class="fas fa-times"></i> CANCEL`;
                btnBatal.disabled = false; btnCek.disabled = false;
            }
        });
    }

    function jalankanTimer(idTransaksi) {
        let waktu = 1200; 
        const elTimer = document.getElementById(`timer-${idTransaksi}`);
        
        intervalTimers[idTransaksi] = setInterval(() => {
            waktu--;
            let m = Math.floor(waktu / 60).toString().padStart(2, '0');
            let s = (waktu % 60).toString().padStart(2, '0');
            elTimer.innerText = `${m}:${s}`;
            
            if (waktu <= 180) elTimer.style.color = "#d93025"; 
            if (waktu <= 0) {
                clearInterval(intervalTimers[idTransaksi]);
                document.getElementById(`btnBatal-${idTransaksi}`).click(); 
            }
        }, 1000);
    }
}

// 4. JALANKAN SEMUANYA DENGAN PENGAMAN LOAD
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", jalankanModulSmsBower);
} else {
    jalankanModulSmsBower();
            }
