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
        // 2. ACAK NOMOR HP
        // ==========================================
        const noHp = fakerObj.phone.phoneNumber('08##########');
        
        // ==========================================
        // 3. ACAK PROVINSI DAN KOTA (SUPER LENGKAP)
        // ==========================================
        const daerah = [
            // SUMATERA
            { prov: "NANGGROE ACEH DARUSSALAM", kota: ["BANDA ACEH", "SABANG", "LHOKSEUMAWE", "LANGSA", "SUBULUSSALAM", "ACEH BESAR", "PIDIE", "BIREUEN", "ACEH UTARA", "ACEH TIMUR", "ACEH BARAT", "ACEH SELATAN", "ACEH TENGAH", "GAYO LUES", "SIMEULUE"] },
            { prov: "SUMATERA UTARA", kota: ["MEDAN", "BINJAI", "PEMATANGSIANTAR", "TANJUNG BALAI", "TEBING TINGGI", "SIBOLGA", "PADANGSIDIMPUAN", "DELI SERDANG", "LANGKAT", "KARO", "SIMALUNGUN", "ASAHAN", "LABUHANBATU", "TAPANULI UTARA", "TAPANULI SELATAN", "NIAS", "MANDAILING NATAL", "TOBA SAMOSIR"] },
            { prov: "SUMATERA BARAT", kota: ["PADANG", "BUKITTINGGI", "PAYAKUMBUH", "PARIAMAN", "SOLOK", "SAWAHLUNTO", "PADANG PANJANG", "AGAM", "LIMA PULUH KOTA", "TANAH DATAR", "PESISIR SELATAN", "PASAMAN", "MENTAWAI", "DHARMASRAYA"] },
            { prov: "RIAU", kota: ["PEKANBARU", "DUMAI", "BENGKALIS", "INDRAGIRI HILIR", "INDRAGIRI HULU", "KAMPAR", "KUANTAN SINGINGI", "PELALAWAN", "ROKAN HILIR", "ROKAN HULU", "SIAK", "MERANTI"] },
            { prov: "KEPULAUAN RIAU", kota: ["BATAM", "TANJUNGPINANG", "BINTAN", "KARIMUN", "NATUNA", "LINGGA", "KEPULAUAN ANAMBAS"] },
            { prov: "JAMBI", kota: ["JAMBI", "SUNGAI PENUH", "BATANGHARI", "BUNGO", "KERINCI", "MERANGIN", "MUARO JAMBI", "SAROLANGUN", "TANJUNG JABUNG BARAT", "TANJUNG JABUNG TIMUR", "TEBO"] },
            { prov: "SUMATERA SELATAN", kota: ["PALEMBANG", "LUBUKLINGGAU", "PRABUMULIH", "PAGAR ALAM", "BANYUASIN", "EMPAT LAWANG", "LAHAT", "MUARA ENIM", "MUSI BANYUASIN", "MUSI RAWAS", "Ogan Ilir", "OKU", "OKI"] },
            { prov: "BANGKA BELITUNG", kota: ["PANGKALPINANG", "BANGKA", "BANGKA BARAT", "BANGKA SELATAN", "BANGKA TENGAH", "BELITUNG", "BELITUNG TIMUR"] },
            { prov: "BENGKULU", kota: ["BENGKULU", "BENGKULU SELATAN", "BENGKULU TENGAH", "BENGKULU UTARA", "KAUR", "KEPAHIANG", "LEBONG", "MUKOMUKO", "REJANG LEBONG", "SELUMA"] },
            { prov: "LAMPUNG", kota: ["BANDAR LAMPUNG", "METRO", "LAMPUNG BARAT", "LAMPUNG SELATAN", "LAMPUNG TENGAH", "LAMPUNG TIMUR", "LAMPUNG UTARA", "MESUJI", "PESAWARAN", "PESISIR BARAT", "PRINGSEWU", "TANGGAMUS", "TULANG BAWANG", "WAY KANAN"] },
            
            // JAWA & BALI
            { prov: "DKI JAKARTA", kota: ["JAKARTA SELATAN", "JAKARTA PUSAT", "JAKARTA TIMUR", "JAKARTA BARAT", "JAKARTA UTARA", "KEPULAUAN SERIBU"] },
            { prov: "BANTEN", kota: ["TANGERANG", "SERANG", "CILEGON", "TANGERANG SELATAN", "LEBAK", "PANDEGLANG", "KABUPATEN TANGERANG", "KABUPATEN SERANG"] },
            { prov: "JAWA BARAT", kota: ["BANDUNG", "BOGOR", "BEKASI", "DEPOK", "CIREBON", "GARUT", "TASIKMALAYA", "SUKABUMI", "CIMAHI", "BANJAR", "CIANJUR", "CIAMIS", "INDRAMAYU", "KARAWANG", "KUNINGAN", "MAJALENGKA", "PANGANDARAN", "PURWAKARTA", "SUBANG", "SUMEDANG", "BANDUNG BARAT"] },
            { prov: "JAWA TENGAH", kota: ["SEMARANG", "SURAKARTA", "MAGELANG", "TEGAL", "PEKALONGAN", "SALATIGA", "BANJARNEGARA", "BANYUMAS", "BATANG", "BLORA", "BOYOLALI", "BREBES", "CILACAP", "DEMAK", "GROBOGAN", "JEPARA", "KARANGANYAR", "KEBUMEN", "KENDAL", "KLATEN", "KUDUS", "PATI", "PEMALANG", "PURBALINGGA", "PURWOREJO", "REMBANG", "SRAGEN", "SUKOHARJO", "TEMANGGUNG", "WONOGIRI", "WONOSOBO"] },
            { prov: "DI YOGYAKARTA", kota: ["YOGYAKARTA", "SLEMAN", "BANTUL", "GUNUNGKIDUL", "KULON PROGO"] },
            { prov: "JAWA TIMUR", kota: ["SURABAYA", "MALANG", "MADIUN", "KEDIRI", "MOJOKERTO", "PASURUAN", "PROBOLINGGO", "BLITAR", "BATU", "SIDOARJO", "GRESIK", "LAMONGAN", "TUBAN", "BOJONEGORO", "NGAWI", "MAGETAN", "PONOROGO", "PACITAN", "TRENGGALEK", "TULUNGAGUNG", "JOMBANG", "NGANJUK", "LUMAJANG", "JEMBER", "BANYUWANGI", "SITUBONDO", "BONDOWOSO", "BANGKALAN", "SAMPANG", "PAMEKASAN", "SUMENEP"] },
            { prov: "BALI", kota: ["DENPASAR", "BADUNG", "BANGLI", "BULELENG", "GIANYAR", "JEMBRANA", "KARANGASEM", "KLUNGKUNG", "TABANAN"] },

            // NUSA TENGGARA
            { prov: "NUSA TENGGARA BARAT", kota: ["MATARAM", "BIMA", "DOMPU", "LOMBOK BARAT", "LOMBOK TENGAH", "LOMBOK TIMUR", "LOMBOK UTARA", "SUMBAWA", "SUMBAWA BARAT"] },
            { prov: "NUSA TENGGARA TIMUR", kota: ["KUPANG", "ALOR", "BELU", "ENDE", "FLORES TIMUR", "MANGGARAI", "MANGGARAI BARAT", "MANGGARAI TIMUR", "NAGEKEO", "NGADA", "ROTE NDAO", "SABU RAIJUA", "SIKKA", "SUMBA BARAT", "SUMBA TIMUR", "TIMOR TENGAH SELATAN", "TIMOR TENGAH UTARA"] },

            // KALIMANTAN
            { prov: "KALIMANTAN BARAT", kota: ["PONTIANAK", "SINGKAWANG", "BENGKAYANG", "KAPUAS HULU", "KAYONG UTARA", "KETAPANG", "KUBU RAYA", "LANDAK", "MELAWI", "MEMPAWAH", "SAMBAS", "SANGGAU", "SEKADAU", "SINTANG"] },
            { prov: "KALIMANTAN TENGAH", kota: ["PALANGKA RAYA", "BARITO SELATAN", "BARITO TIMUR", "BARITO UTARA", "GUNUNG MAS", "KAPUAS", "KATINGAN", "KOTAWARINGIN BARAT", "KOTAWARINGIN TIMUR", "LAMANDAU", "MURUNG RAYA", "PULANG PISAU", "SUKAMARA", "SERUYAN"] },
            { prov: "KALIMANTAN SELATAN", kota: ["BANJARMASIN", "BANJARBARU", "BALANGAN", "BANJAR", "BARITO KUALA", "HULU SUNGAI SELATAN", "HULU SUNGAI TENGAH", "HULU SUNGAI UTARA", "KOTABARU", "TABALONG", "TANAH BUMBU", "TANAH LAUT", "TAPIN"] },
            { prov: "KALIMANTAN TIMUR", kota: ["SAMARINDA", "BALIKPAPAN", "BONTANG", "BERAU", "KUTAI BARAT", "KUTAI KARTANEGARA", "KUTAI TIMUR", "MAHAKAM ULU", "PASER", "PENAJAM PASER UTARA"] },
            { prov: "KALIMANTAN UTARA", kota: ["TARAKAN", "BULUNGAN", "MALINAU", "NUNUKAN", "TANA TIDUNG"] },

            // SULAWESI
            { prov: "SULAWESI UTARA", kota: ["MANADO", "BITUNG", "KOTAMOBAGU", "TOMOHON", "BOLAANG MONGONDOW", "MINAHASA", "MINAHASA SELATAN", "MINAHASA UTARA", "KEPULAUAN SANGIHE", "KEPULAUAN TALAUD"] },
            { prov: "GORONTALO", kota: ["GORONTALO", "BOALEMO", "BONE BOLANGO", "POHUWATO", "GORONTALO UTARA"] },
            { prov: "SULAWESI TENGAH", kota: ["PALU", "BANGGAI", "DONGGALA", "MOROWALI", "PARIGI MOUTONG", "POSO", "SIGI", "TOJO UNA-UNA", "TOLI-TOLI"] },
            { prov: "SULAWESI BARAT", kota: ["MAMUJU", "MAJENE", "MAMASA", "PASANGKAYU", "POLEWALI MANDAR", "MAMUJU TENGAH"] },
            { prov: "SULAWESI SELATAN", kota: ["MAKASSAR", "PALOPO", "PAREPARE", "BANTAENG", "BARRU", "BONE", "BULUKUMBA", "ENREKANG", "GOWA", "JENEPONTO", "LUWU", "MAROS", "PANGKEP", "PINRANG", "SINJAI", "SOPPENG", "TAKALAR", "TANA TORAJA", "WAJO"] },
            { prov: "SULAWESI TENGGARA", kota: ["KENDARI", "BAUBAU", "BOMBANA", "BUTON", "KOLAKA", "KONAWE", "MUNA", "WAKATOBI"] },

            // MALUKU & PAPUA
            { prov: "MALUKU", kota: ["AMBON", "TUAL", "BURU", "KEPULAUAN ARU", "MALUKU TENGAH", "MALUKU TENGGARA", "SERAM BAGIAN BARAT", "SERAM BAGIAN TIMUR"] },
            { prov: "MALUKU UTARA", kota: ["TERNATE", "TIDORE KEPULAUAN", "HALMAHERA BARAT", "HALMAHERA TENGAH", "HALMAHERA UTARA", "HALMAHERA SELATAN", "KEPULAUAN SULA", "PULAU MOROTAI"] },
            { prov: "PAPUA", kota: ["JAYAPURA", "BIAK NUMFOR", "KEEROM", "MAMBERAMO RAYA", "SARMI", "SUPIORI", "WAROPEN"] },
            { prov: "PAPUA BARAT", kota: ["MANOKWARI", "SORONG", "FAKFAK", "KAIMANA", "RAJA AMPAT", "TELUK BINTUNI", "TELUK WONDAMA"] },
            { prov: "PAPUA SELATAN", kota: ["MERAUKE", "BOUVEN DIGOEL", "MAPPI", "ASMAT"] },
            { prov: "PAPUA TENGAH", kota: ["NABIRE", "MIMIKA", "PANIAI", "PUNCAK JAYA"] },
            { prov: "PAPUA PEGUNUNGAN", kota: ["JAYAWIJAYA", "YAHUKIMO", "TOLIKARA", "LANY JAYA"] }
        ];

        const pilihDaerah = daerah[Math.floor(Math.random() * daerah.length)];
        const provinsi = pilihDaerah.prov;
        const kota = pilihDaerah.kota[Math.floor(Math.random() * pilihDaerah.kota.length)];

        // ==========================================
        // 4. ACAK NAMA JALAN (DIPERBANYAK & BERAGAM)
        // ==========================================
        const jalanList = [
            // Nama Pahlawan / Tokoh
            "JL. JENDERAL SUDIRMAN", "JL. MH THAMRIN", "JL. GATOT SUBROTO", "JL. AHMAD YANI", "JL. MERDEKA", 
            "JL. DIPONEGORO", "JL. PAHLAWAN", "JL. VETERAN", "JL. PEMUDA", "JL. KI HAJAR DEWANTARA", 
            "JL. KARTINI", "JL. HASANUDDIN", "JL. TEUKU UMAR", "JL. IMAM BONJOL", "JL. GAJAH MADA", 
            "JL. HAYAM WURUK", "JL. PATTIMURA", "JL. CUT NYAK DIEN", "JL. RADEN SALEH", "JL. HOS COKROAMINOTO",
            "JL. SLAMET RIYADI", "JL. WR SUPRATMAN", "JL. MT HARYONO", "JL. DI PANJAITAN", "JL. LETJEN SUPRAPTO",
            "JL. PIERRE TENDEAN", "JL. S PARMAN", "JL. SUTOMO", "JL. WAHID HASYIM", "JL. SULTAN AGUNG",
            // Nama Bunga / Pohon
            "JL. MELATI", "JL. MAWAR", "JL. ANGGREK", "JL. KENANGA", "JL. CEMARA", "JL. TERATAI", "JL. BOUGENVILLE",
            "JL. KAMBOJA", "JL. DAHLIA", "JL. FLAMBOYAN", "JL. CEMPAKA", "JL. TULIP", "JL. ASOKA", "JL. SAKURA", 
            "JL. ASTER", "JL. MATAHARI", "JL. TANJUNG", "JL. BERINGIN", "JL. PINUS", "JL. MAHONI", "JL. JATI",
            // Nama Burung / Hewan
            "JL. KELINCI", "JL. GARUDA", "JL. CENDRAWASIH", "JL. RAJAWALI", "JL. MERPATI", "JL. KUTILANG", 
            "JL. NURI", "JL. MERAK", "JL. KAKAKTUA", "JL. MURAI", "JL. KENARI", "JL. JALAK", "JL. PERKUTUT",
            // Nama Daerah / Buah / Umum
            "JL. NUSA INDAH", "JL. RAYA PASAR", "JL. KEMANGGISAN", "JL. TAMAN SISWA", "JL. KEBON JERUK", 
            "JL. MANGGA DUA", "JL. DUKUH", "JL. RAMBUTAN", "JL. DURIAN", "JL. MANGGIS", "JL. CEMPEDAK",
            "JL. RAYA UTAMA", "JL. LINTAS TIMUR", "JL. LINGKAR SELATAN", "JL. PONDOK INDAH", "JL. CITRA RAYA",
            "JL. PRAMUKA", "JL. BINA MARGA", "JL. KARYA BAKTI", "JL. GOTONG ROYONG", "JL. SUMBER MAKMUR",
            "JL. HARAPAN INDAH", "JL. MAJU JAYA", "JL. KUSUMA BANGSA", "JL. RAYA WANGI", "JL. PANDANARAN",
            "JL. BRAGA", "JL. ASIA AFRIKA", "JL. MALIOBORO", "JL. DARMO", "JL. TUNJUNGAN", "JL. MARGOREJO"
        ];
        const namaJalan = jalanList[Math.floor(Math.random() * jalanList.length)];
        const awalanGang = ["", "", "", "GANG 1, ", "GANG 2, ", "GANG 3, ", "GANG MAWAR, ", "GANG BUNTU, ", "GANG DAMAI, "];
        const gangAcak = awalanGang[Math.floor(Math.random() * awalanGang.length)];
        const nomorRumah = Math.floor(Math.random() * 250) + 1; // Acak nomor rumah 1 - 250
        
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
            "Dekat Pertigaan Lampu Merah", "Pas Tikungan", "Sebelah Tukang Cukur",
            "Samping Lapangan Voli", "Depan Tukang Bakso", "Rumah Tingkat Dua", "Dekat Jembatan"
        ];
        const patokanAcak = daftarPatokan[Math.floor(Math.random() * daftarPatokan.length)].toUpperCase();
        
        // ==========================================
        // 6. GABUNGKAN SEMUA
        // ==========================================
        const hasilLengkap = `${nama}, ${noHp}, ${provinsi}, ${kota}, ${jalan} (${patokanAcak})`;
        
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
        
