# NzR Car Play — 48 saatlik demo lisans sunucusu (başlangıç paketi)

Bu paket tek başına hazır/dağıtılmış bir sunucu veya APK değildir. İnternetten erişilebilen HTTPS bir Node.js sunucusuna kurulmalıdır.

## Ne yapar?
- `/v1/status`: cihazın ilk görülme zamanını veritabanına kaydeder; 48 saat demo döndürür; süre bitince `expired` döndürür.
- `/v1/activate`: aktivasyon kodunu doğrular ve kodu tek bir cihazla eşleştirir.
- `/admin/codes`: yönetici anahtarı ile aktivasyon kodları üretir.
- `/admin/codes/disable`: bir kodu devre dışı bırakır.
- SQLite veritabanı yeniden başlatmalarda kalıcı kayıt tutar.

## Sunucuya kurulum
1. Node.js 20+ destekleyen bir sunucu/hosting seçin.
2. Bu klasörü sunucuya yükleyin ve `npm install` çalıştırın.
3. En az 32 karakterlik rastgele bir `ADMIN_KEY` ortam değişkeni ayarlayın. Bunu uygulama içine koymayın.
4. `npm start` çalıştırın.
5. Alan adında HTTPS etkinleştirin. Uygulama HTTP ile üretime alınmamalıdır.
6. `GET /health` yanıtının `{"ok":true,...}` olduğunu kontrol edin.
7. Kod üretmek için yönetici bilgisayar/istemcisinden `POST /admin/codes` isteğine `x-admin-key` başlığı ve `{"count":5}` gövdesi gönderin.

## API örnekleri

Durum:
`POST /v1/status` JSON: `{"deviceId":"ANDROID_ID_VALUE"}`

Aktivasyon:
`POST /v1/activate` JSON: `{"deviceId":"ANDROID_ID_VALUE","code":"ABCD-EFGH-IJKL-MNOP-QRST-UVWX"}`

Kod üretimi:
`POST /admin/codes` başlık `x-admin-key: SUNUCU_ADMIN_ANAHTARI`, JSON `{"count":5}`

## Android uygulamasına bağlamadan önce
- Uygulama `Settings.Secure.ANDROID_ID` değerini cihaz kimliği olarak gönderir. Aynı Android kullanıcısı/cihazı için genellikle yeniden kurulumda kalır; fabrika ayarı, kullanıcı profili veya üretici davranışı gibi durumlarda değişebilir. Hiçbir salt istemci kimliği mutlak kopya koruması değildir.
- `DemoTrial.java` içindeki yerel 72 saatlik kod tek başına kullanılırsa sil-yükle engelini sağlamaz. Bunu sunucu yanıtına dayalı asenkron kontrolle değiştirmek gerekir.
- Mevcut uygulamada telefon ekranı ve Android Auto için ayrı Activity girişleri var. Üretimde demo/lisans kontrolü uygulamanın tüm ana girişlerini kapsamalı; sunucuya ulaşılamadığında davranış (erişimi kapat veya kısa çevrimdışı izin) açıkça seçilmelidir.
- Bu paket sunucu tarafını sağlar; mevcut Mola/NzR Car Play uygulamasına entegrasyon ve gerçek APK derlemesi bu dosyalarla henüz yapılmış/doğrulanmış değildir.
