export async function generateName() {
    try {
        const fakerObj = window.faker;
        
        if(!fakerObj) {
            alert("Sistem pengacak data sedang dimuat, silakan coba lagi.");
            return;
        }

        fakerObj.locale = "id_ID";

        // ==========================================
        // 1. SISTEM ANTI-DUPLIKAT NAMA HARIAN
        // ==========================================
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

        // ==========================================
        // 2. ACAK NOMOR HP (REALISTIS & SESUAI PROVIDER INDONESIA)
        // ==========================================
        const prefixProvider = [
            // Telkomsel
            '0811', '0812', '0813', '0821', '0822', '0851', '0852', '0853',
            // Indosat
            '0814', '0815', '0816', '0855', '0856', '0857', '0858',
            // XL / Axis
            '0817', '0818', '0819', '0859', '0877', '0878', '0831', '0832', '0833', '0838',
            // Tri (3)
            '0895', '0896', '0897', '0898', '0899',
            // Smartfren
            '0881', '0882', '0883', '0884', '0885', '0886', '0887', '0888', '0889'
        ];
        // Pilih awalan secara acak
        const prefix = prefixProvider[Math.floor(Math.random() * prefixProvider.length)];
        // Generate sisa digit agar total pas 12 digit (Prefix 4 digit + 8 digit acak)
        const sisaDigit = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
        const noHp = prefix + sisaDigit;
        
        // ==========================================
        // 3. ACAK PROVINSI, KOTA & KODE POS (DENGAN BOBOT REGIONAL)
        // ==========================================
        // Weight: Semakin tinggi angkanya, semakin sering provinsinya muncul.
        // ZipPrefix: Awalan kodepos resmi sesuai pulau/provinsi.
        const daerah = [
            // JAWA & BALI (Fokus Utama - Bobot Sangat Tinggi)
            { prov: "DKI JAKARTA", zipPrefix: "1", weight: 30, kota: ["JAKARTA SELATAN", "JAKARTA PUSAT", "JAKARTA TIMUR", "JAKARTA BARAT", "JAKARTA UTARA"] },
            { prov: "JAWA BARAT", zipPrefix: "4", weight: 35, kota: ["BANDUNG", "BOGOR", "BEKASI", "DEPOK", "CIREBON", "GARUT", "TASIKMALAYA", "SUKABUMI", "CIMAHI", "KARAWANG", "SUBANG", "SUMEDANG"] },
            { prov: "JAWA TENGAH", zipPrefix: "5", weight: 30, kota: ["SEMARANG", "SURAKARTA", "MAGELANG", "TEGAL", "PEKALONGAN", "BANYUMAS", "BOYOLALI", "CILACAP", "KUDUS", "PATI", "KLATEN"] },
            { prov: "JAWA TIMUR", zipPrefix: "6", weight: 35, kota: ["SURABAYA", "MALANG", "MADIUN", "KEDIRI", "MOJOKERTO", "PASURUAN", "SIDOARJO", "GRESIK", "JEMBER", "BANYUWANGI", "BLITAR"] },
            { prov: "BANTEN", zipPrefix: "1", weight: 15, kota: ["TANGERANG", "SERANG", "CILEGON", "TANGERANG SELATAN", "PANDEGLANG"] },
            { prov: "DI YOGYAKARTA", zipPrefix: "5", weight: 10, kota: ["YOGYAKARTA", "SLEMAN", "BANTUL", "GUNUNGKIDUL"] },
            { prov: "BALI", zipPrefix: "8", weight: 10, kota: ["DENPASAR", "BADUNG", "GIANYAR", "BULELENG", "TABANAN"] },

            // SUMATERA (Fokus Kedua - Bobot Sedang)
            { prov: "SUMATERA UTARA", zipPrefix: "2", weight: 15, kota: ["MEDAN", "BINJAI", "PEMATANGSIANTAR", "DELI SERDANG", "ASAHAN"] },
            { prov: "SUMATERA BARAT", zipPrefix: "2", weight: 10, kota: ["PADANG", "BUKITTINGGI", "PAYAKUMBUH", "PARIAMAN", "SOLOK"] },
            { prov: "RIAU", zipPrefix: "2", weight: 8, kota: ["PEKANBARU", "DUMAI", "BENGKALIS", "KAMPAR"] },
            { prov: "SUMATERA SELATAN", zipPrefix: "3", weight: 12, kota: ["PALEMBANG", "LUBUKLINGGAU", "PRABUMULIH", "BANYUASIN"] },
            { prov: "LAMPUNG", zipPrefix: "3", weight: 10, kota: ["BANDAR LAMPUNG", "METRO", "LAMPUNG SELATAN", "PESAWARAN"] },
            { prov: "NANGGROE ACEH DARUSSALAM", zipPrefix: "2", weight: 5, kota: ["BANDA ACEH", "LHOKSEUMAWE", "LANGSA", "ACEH BESAR"] },
            { prov: "KEPULAUAN RIAU", zipPrefix: "2", weight: 5, kota: ["BATAM", "TANJUNGPINANG", "BINTAN"] },
            { prov: "JAMBI", zipPrefix: "3", weight: 5, kota: ["JAMBI", "BATANGHARI", "BUNGO"] },

            // KALIMANTAN & SULAWESI (Fokus Ketiga - Bobot Sedang-Kecil)
            { prov: "KALIMANTAN TIMUR", zipPrefix: "7", weight: 8, kota: ["SAMARINDA", "BALIKPAPAN", "BONTANG", "KUTAI KARTANEGARA"] },
            { prov: "KALIMANTAN BARAT", zipPrefix: "7", weight: 6, kota: ["PONTIANAK", "SINGKAWANG", "KAPUAS HULU", "SAMBAS"] },
            { prov: "KALIMANTAN SELATAN", zipPrefix: "7", weight: 6, kota: ["BANJARMASIN", "BANJARBARU", "BANJAR", "TABALONG"] },
            { prov: "KALIMANTAN TENGAH", zipPrefix: "7", weight: 4, kota: ["PALANGKA RAYA", "KOTABARU", "KAPUAS"] },
            { prov: "SULAWESI SELATAN", zipPrefix: "9", weight: 12, kota: ["MAKASSAR", "PALOPO", "PAREPARE", "GOWA", "MAROS", "TANA TORAJA"] },
            { prov: "SULAWESI UTARA", zipPrefix: "9", weight: 6, kota: ["MANADO", "BITUNG", "TOMOHON", "MINAHASA"] },
            { prov: "SULAWESI TENGAH", zipPrefix: "9", weight: 4, kota: ["PALU", "DONGGALA", "MOROWALI"] },

            // NUSA TENGGARA (Bobot Kecil)
            { prov: "NUSA TENGGARA BARAT", zipPrefix: "8", weight: 4, kota: ["MATARAM", "BIMA", "LOMBOK BARAT", "LOMBOK TENGAH"] },
            { prov: "NUSA TENGGARA TIMUR", zipPrefix: "8", weight: 3, kota: ["KUPANG", "ENDE", "MANGGARAI", "SUMBA TIMUR"] },

            // MALUKU & PAPUA (Ditekan Frekuensinya - Bobot Sangat Kecil)
            { prov: "MALUKU", zipPrefix: "9", weight: 1, kota: ["AMBON", "TUAL", "MALUKU TENGAH"] },
            { prov: "MALUKU UTARA", zipPrefix: "9", weight: 1, kota: ["TERNATE", "TIDORE", "HALMAHERA UTARA"] },
            { prov: "PAPUA", zipPrefix: "9", weight: 1, kota: ["JAYAPURA", "BIAK NUMFOR", "MAMBERAMO RAYA"] },
            { prov: "PAPUA BARAT", zipPrefix: "9", weight: 1, kota: ["MANOKWARI", "SORONG", "FAKFAK"] }
        ];

        // Logika Weighted Random untuk memilih daerah
        let totalWeight = daerah.reduce((sum, item) => sum + item.weight, 0);
        let randomNum = Math.random() * totalWeight;
        let pilihDaerah = daerah[0];
        
        for (let i = 0; i < daerah.length; i++) {
            if (randomNum < daerah[i].weight) {
                pilihDaerah = daerah[i];
                break;
            }
            randomNum -= daerah[i].weight;
        }

        const provinsi = pilihDaerah.prov;
        const kota = pilihDaerah.kota[Math.floor(Math.random() * pilihDaerah.kota.length)];
        
        // Generate 5 Digit Kode Pos berdasar Prefix Regional
        const randomZipSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        const kodePos = `${pilihDaerah.zipPrefix}${randomZipSuffix}`;

        // ==========================================
        // 4. ACAK NAMA JALAN
        // ==========================================
        const jalanList = [
            "JL. JENDERAL SUDIRMAN", "JL. MH THAMRIN", "JL. GATOT SUBROTO", "JL. AHMAD YANI", "JL. MERDEKA", 
            "JL. DIPONEGORO", "JL. PAHLAWAN", "JL. VETERAN", "JL. PEMUDA", "JL. KI HAJAR DEWANTARA", 
            "JL. KARTINI", "JL. HASANUDDIN", "JL. TEUKU UMAR", "JL. IMAM BONJOL", "JL. GAJAH MADA", 
            "JL. HAYAM WURUK", "JL. PATTIMURA", "JL. SLAMET RIYADI", "JL. WR SUPRATMAN", "JL. MT HARYONO",
            "JL. MELATI", "JL. MAWAR", "JL. ANGGREK", "JL. CEMARA", "JL. TERATAI", "JL. BOUGENVILLE",
            "JL. KAMBOJA", "JL. DAHLIA", "JL. FLAMBOYAN", "JL. BERINGIN", "JL. PINUS", "JL. MAHONI", 
            "JL. GARUDA", "JL. CENDRAWASIH", "JL. RAJAWALI", "JL. MERPATI", "JL. KUTILANG", "JL. NURI",
            "JL. NUSA INDAH", "JL. RAYA PASAR", "JL. KEMANGGISAN", "JL. TAMAN SISWA", "JL. KEBON JERUK", 
            "JL. MANGGA DUA", "JL. PONDOK INDAH", "JL. CITRA RAYA", "JL. PRAMUKA", "JL. GOTONG ROYONG",
            "JL. HARAPAN INDAH", "JL. ASIA AFRIKA", "JL. MALIOBORO", "JL. DARMO", "JL. TUNJUNGAN"
        ];
        const namaJalan = jalanList[Math.floor(Math.random() * jalanList.length)];
        const awalanGang = ["", "", "", "GANG 1, ", "GANG 2, ", "GANG 3, ", "GANG MAWAR, ", "GANG BUNTU, ", "GANG DAMAI, "];
        const gangAcak = awalanGang[Math.floor(Math.random() * awalanGang.length)];
        const nomorRumah = Math.floor(Math.random() * 250) + 1;
        
        const jalan = `${gangAcak}${namaJalan} NO. ${nomorRumah}`;
        
        // ==========================================
        // 5. ACAK PATOKAN (SANGAT LIAR)
        // ==========================================
        const daftarPatokan = [
            "Samping Masjid", "Depan Gereja", "Sebelah Vihara", "Dekat Pura",
            "Dekat SMA", "Sebelah SD", "Depan SMP", "Samping Kampus",
            "Belakang Pasar", "Depan Alfamart", "Samping Indomaret", "Dekat Alfamidi",
            "Dekat Balai Desa", "Belakang Kantor Kelurahan", "Samping Kantor Pos",
            "Masuk Gang Sebelah Kanan", "Masuk Gang Kiri", "Rumah Pagar Hitam", "Rumah Cat Hijau",
            "Samping Pom Bensin", "Dekat SPBU", "Depan Warung Makan", "Depan Warung Kopi", 
            "Sebelah Toko Bangunan", "Depan Toko Kelontong", "Samping Konter HP", 
            "Dekat Puskesmas", "Samping Apotek", "Belakang RS", "Samping Bidan Desa",
            "Depan Lapangan Bola", "Sebelah Bengkel Motor", "Depan Pos Kamling",
            "Dekat Pertigaan Lampu Merah", "Pas Tikungan", "Sebelah Tukang Cukur"
        ];
        const patokanAcak = daftarPatokan[Math.floor(Math.random() * daftarPatokan.length)].toUpperCase();
        
        // ==========================================
        // 6. GABUNGKAN SEMUA (Ditambah Kode Pos)
        // ==========================================
        const hasilLengkap = `${nama}, ${noHp}, ${provinsi}, ${kota}, ${kodePos}, ${jalan} (${patokanAcak})`;
        
        const outputEl = document.getElementById('genNameOutput');
        if (outputEl) outputEl.value = hasilLengkap; 
        
        // ==========================================
        // SISTEM AUTO-COPY ANTI-GAGAL (KHUSUS HP)
        // ==========================================
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(hasilLengkap);
            } else {
                throw new Error("Fallback");
            }
        } catch (err) {
            const textAreaBayangan = document.createElement("textarea");
            textAreaBayangan.value = hasilLengkap;
            textAreaBayangan.style.position = "fixed"; 
            textAreaBayangan.style.top = "0";
            textAreaBayangan.style.left = "0";
            textAreaBayangan.style.opacity = "0"; 
            document.body.appendChild(textAreaBayangan);
            
            textAreaBayangan.focus();
            textAreaBayangan.select();
            document.execCommand('copy');
            document.body.removeChild(textAreaBayangan);
        }
        
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
