# Birlikte – Aile Bütçesi

Türkçe, mobil uyumlu, kurulumsuz aile harcama ve hesaplaşma uygulaması.

## Özellikler
- Aile üyelerini ekleme, yeniden adlandırma, silme
- Gider ve gelir kaydı; tarih, kategori, ödeyen, not
- Her giderde masrafı paylaşan aile üyelerini seçme, eşit kişi başı dağıtım
- Aylık toplam gelir, gider ve nakit farkı; kategoriler ve kişi bazlı ödeme toplamları
- Borç / alacak bakiyesi, "kim kime ödesin" önerisi, ödemeyi yapıldı olarak işaretleme
- Kategori bazlı aylık bütçe limitleri; 6 aylık görsel rapor
- İşlem arama / filtreleme / düzenleme / silme
- JSON yedek dışa/içe aktarma; Excel uyumlu CSV
- Mobil PWA, çevrimdışı statik açılış

## Kullanım
GitHub Pages üzerinden adresini açıp ilk olarak **Aile Üyeleri** ekranından kişilerin isimlerini düzenleyin. Sonra **Yeni işlem** ile gelir/gider ekleyin ve gideri paylaşacak kişileri işaretleyin.

## Gizlilik ve sınırlamalar
**Bu sürüm tek cihaz/tarayıcı temellidir.** Veriler yalnızca tarayıcının \`localStorage\` alanına yazılır. GitHub'a, herhangi bir sunucuya veya üçüncü tarafa bütçe verisi aktarılmaz. Farklı cihazlarda aynı kayıtları eş zamanlı düzenleme, kullanıcı girişi ve otomatik bulut senkronizasyonu **yoktur**. Cihazlar arası taşıma için JSON yedek dışa/içe aktarın. Tarayıcı verisini silmek kayıtları yok edebilir; düzenli yedek alın.

Eşit bölüşüm kuruş hassasiyetindedir; kuruş farkı, seçilen üye sırasına dağıtılır. Gelirler ortak masraf alacak/borç hesabına katılmaz. Borç kapatma ödemeleri aylık hesaplaşmada dikkate alınır; gelir veya harcama sayılmaz.

## Geliştirme
Sunucu, derleme, paket yöneticisi, API anahtarı gerekmez. \`index.html\` dosyasını yerel statik sunucudan açın; \`app.js\` ve \`style.css\` aynı klasörde olmalıdır. PWA için HTTPS veya localhost gerekir.

## Yerleşim
Bu uygulama \`beyzatuzcu.github.io\` deposunun \`/aile-butcesi/\` dizinindedir; mevcut YÖKDİL uygulamasını etkilemez.
