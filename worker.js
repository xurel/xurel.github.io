const BOWER_API = "https://smsbower.app/stubs/handler_api.php";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  // Dalam ES Modules, Cloudflare mengirimkan rahasia (secrets) melalui parameter 'env'
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // ========================================================
      // SISTEM BACA TOKEN OTOMATIS DARI CLOUDFLARE SECRETS
      // ========================================================
      // Mengambil data dari variabel bernama 'BOWER_TOKENS'
      const tokensString = env.BOWER_TOKENS || "";
      
      // Memecah token berdasarkan tanda koma, dan menghapus spasi kosong
      const tokenList = tokensString.split(",").map(t => t.trim()).filter(t => t !== "");

      const ACCOUNTS = {};
      tokenList.forEach((token, index) => {
        ACCOUNTS[`HP ${index + 1}`] = token;
      });

      // ========================================================
      // ENDPOINT API
      // ========================================================
      // 1. ENDPOINT: Kirim daftar HP ke Frontend
      if (path === "/accounts") {
        return Response.json({ success: true, accounts: Object.keys(ACCOUNTS) }, { headers: corsHeaders });
      }

      // Validasi Akun
      const account = url.searchParams.get("account");
      let bodyData = {};
      if (request.method === "POST") {
         try { bodyData = await request.json(); } catch(e){}
      }
      const accName = account || bodyData.account;
      const apiKey = ACCOUNTS[accName];

      if (!apiKey) return Response.json({ success: false, message: "Akun/Token belum diatur di Cloudflare Secrets" }, { headers: corsHeaders });

      // 2. ENDPOINT: Cek Saldo
      if (path === "/balance") {
        const res = await fetch(`${BOWER_API}?api_key=${apiKey}&action=getBalance`);
        const text = await res.text();
        if (text.includes("ACCESS_BALANCE")) {
          return Response.json({ success: true, balance: text.split(":")[1] }, { headers: corsHeaders });
        }
        return Response.json({ success: false, balance: "0" }, { headers: corsHeaders });
      }

      // 3. ENDPOINT: Cek Harga KHUSUS Shopee (sh) Indonesia (6)
      if (path === "/prices") {
        const res = await fetch(`${BOWER_API}?api_key=${apiKey}&action=getPrices&service=sh&country=6`);
        const json = await res.json();
        let bestPrice = 99999;
        let totalStock = 0;

        try {
            const shopeeData = json["6"]["sh"];
            for (const priceStr in shopeeData) {
                const p = parseFloat(priceStr);
                const stock = parseInt(shopeeData[priceStr]);
                if (p < bestPrice && stock > 0) bestPrice = p;
                totalStock += stock;
            }
        } catch(e) {}

        if (totalStock > 0) {
            return Response.json({ success: true, price: bestPrice, stock: totalStock }, { headers: corsHeaders });
        } else {
            return Response.json({ success: false, message: "Stok Kosong" }, { headers: corsHeaders });
        }
      }

      // 4. ENDPOINT: Beli Nomor (Proteksi maksimal Rp 1.500)
      if (path === "/buy" && request.method === "POST") {
        const service = bodyData.service || "sh";
        const country = bodyData.country || 6; 
        const maxPrice = 1500; 

        const res = await fetch(`${BOWER_API}?api_key=${apiKey}&action=getNumber&service=${service}&country=${country}&maxPrice=${maxPrice}`);
        const text = await res.text();
        
        if (text.includes("ACCESS_NUMBER")) {
          const parts = text.split(":");
          return Response.json({ success: true, id: parts[1], phone: parts[2] }, { headers: corsHeaders });
        }
        return Response.json({ success: false, message: text }, { headers: corsHeaders });
      }

      // 5. ENDPOINT: Cek OTP Aktif
      if (path === "/active") {
        const res = await fetch(`${BOWER_API}?api_key=${apiKey}&action=getActiveActivations`);
        const json = await res.json();
        let activeOrders = [];
        if (json.status === "success") {
          activeOrders = json.activeActivations.map(act => ({
            id: act.activationId,
            phone: act.phoneNumber,
            otp: act.smsCode ? act.smsCode[0] : null
          }));
        }
        return Response.json({ success: true, data: activeOrders }, { headers: corsHeaders });
      }

      // 6. ENDPOINT: Action (Cancel / Finish)
      if (path === "/action" && request.method === "POST") {
        const id = bodyData.id;
        const actionType = bodyData.action; 
        const statusCode = actionType === 'cancel' ? 8 : 6;
        
        const res = await fetch(`${BOWER_API}?api_key=${apiKey}&action=setStatus&status=${statusCode}&id=${id}`);
        const text = await res.text();
        
        return Response.json({ success: true, message: text }, { headers: corsHeaders });
      }

      return Response.json({ success: false, message: "Endpoint tidak ditemukan" }, { headers: corsHeaders });
    } catch (err) {
      return Response.json({ success: false, message: err.message }, { headers: corsHeaders });
    }
  }
};
                    
