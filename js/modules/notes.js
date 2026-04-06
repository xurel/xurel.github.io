function updateStatsUI() {
    let statsText = document.getElementById('note-stats-text');
    
    if (!statsText) {
        statsText = document.createElement('div');
        statsText.id = 'note-stats-text';
        
        // GAYA BARU: Desain Bubble Profesional serasi dengan tombol switch
        // Menggunakan absolute agar melayang di kanan, tinggi mengikuti tombol
        statsText.style.cssText = `
            position: absolute; 
            right: 15px; 
            color: #5f6368; 
            font-size: 11px; 
            font-weight: bold; 
            pointer-events: none; 
            z-index: 10;
            background-color: #f1f3f4; /* Warna background abu-abu muda serasi tombol */
            padding: 4px 10px;        /* Padding agar berbentuk capsule/bubble */
            border-radius: 16px;      /* Border radius penuh mirip tombol */
            border: 1px solid #dadce0; /* Border tipis halus */
            display: flex; 
            align-items: center; 
            justify-content: center;
            box-sizing: border-radius;
            white-space: nowrap;
        `;
    }
    
    // Konten tanpa tanggal
    statsText.innerHTML = `📝 ${statsData.total} &nbsp;|&nbsp; 💾 ${statsData.saved} &nbsp;|&nbsp; 🗑️ ${statsData.deleted}`;
    
    const tabPriv = document.getElementById('tab-priv');
    if (tabPriv) {
        const pill = tabPriv.parentElement; // Tombol kapsul "Publik | Privat"
        const container = pill.parentElement; // Container luas aplikasi
        
        // Jadikan container sebagai area batas posisi
        if (window.getComputedStyle(container).position === 'static') {
            container.style.position = 'relative';
        }
        
        if (!container.contains(statsText)) {
            container.appendChild(statsText);
        }
        
        // KUNCI KOORDINAT: Samakan titik "top" dan tingginya dengan tombol kapsul
        statsText.style.top = pill.offsetTop + 'px';
        statsText.style.height = pill.offsetHeight + 'px';
    }
}
