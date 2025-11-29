# ImageFlow - AI Destekli Görsel İşleme Kılavuzu

## İçindekiler

1. [Genel Bakış](#genel-bakış)
2. [Başlangıç](#başlangıç)
3. [Görsel Yükleme](#görsel-yükleme)
4. [AI Modelleri ve Seçim Kriterleri](#ai-modelleri-ve-seçim-kriterleri)
5. [Açı Değişimi İşlemi](#açı-değişimi-işlemi)
6. [Kaynak Görsel ile İşlem](#kaynak-görsel-ile-işlem)
7. [Akıllı Prompt Asistanı](#akıllı-prompt-asistanı)
8. [Sonuçları Görüntüleme ve Yönetme](#sonuçları-görüntüleme-ve-yönetme)
9. [Üretim Hattı (Pipeline)](#üretim-hattı-pipeline)
10. [Maliyet Bilgileri](#maliyet-bilgileri)

---

## Genel Bakış

ImageFlow, AI modelleri kullanarak görsellerinizi farklı açılardan üretmenize ve iyileştirmenize olanak sağlayan bir görsel işleme platformudur. Sistem, üç farklı AI modeli, akıllı prompt asistanı ve otomatik açı yönetimi ile karakter tutarlılığını koruyarak görsel dönüşümleri gerçekleştirir.

### Temel Özellikler

- **Çoklu AI Model Desteği**: Seedream, Nano Banana, Flux 2 Multi Angles
- **Akıllı Açı Yönetimi**: 8 farklı açı (0°, 45°, 90°, 135°, 180°, 225°, 270°, 315°)
- **Otomatik Prompt Üretimi**: Açı değişimleri için otomatik prompt oluşturma
- **Akıllı Asistan**: OpenRouter tabanlı görsel analiz ve düzeltme önerileri
- **Pipeline Yönetimi**: Hiyerarşik görsel üretim zinciri takibi
- **Maliyet Hesaplama**: Gerçek zamanlı üretim maliyeti gösterimi

---

## Başlangıç

### Giriş Yapma

1. Ana sayfada Firebase Authentication ile giriş yapın
2. Giriş yaptıktan sonra görsel yükleme ekranına yönlendirilirsiniz

### İlk Görsel Yükleme

1. **"Yeni Görsel Yükle"** butonuna tıklayın
2. JPG, PNG, WebP veya GIF formatında görsel seçin (maksimum 10MB)
3. Tek veya çoklu görsel yükleme yapabilirsiniz (maksimum 5 görsel)
4. Yükleme tamamlandığında görsel otomatik olarak işleme ekranına geçer

---

## Görsel Yükleme

### Desteklenen Formatlar

- **JPEG/JPG**: En yaygın format, önerilir
- **PNG**: Şeffaf arka plan desteği
- **WebP**: Modern, optimize format
- **GIF**: Animasyonlu görseller

### Görsel Bilgileri

Yüklenen her görsel için otomatik olarak şu bilgiler saklanır:
- **Dosya Boyutu**: KB/MB cinsinden
- **Çözünürlük**: Genişlik × Yükseklik (piksel)
- **Megapixel (MP)**: Otomatik hesaplanır (Genişlik × Yükseklik / 1.000.000)
- **MIME Tipi**: Görsel formatı

### Kütüphane Yönetimi

- Sol taraftaki **"Kütüphane"** butonu ile tüm görsellerinizi görüntüleyebilirsiniz
- Her görsel kartında:
  - Görsel önizlemesi
  - Dosya adı
  - Boyut bilgisi (MB / MP)
  - İşlenmiş versiyon sayısı

---

## AI Modelleri ve Seçim Kriterleri

Sistem üç farklı AI modeli sunar. Her modelin kendine özgü güçlü yönleri vardır:

### 1. **Seedream**

**Güçlü Yönleri:**
- **Çözünürlük**: Yüksek
- **Açı Dönüşümü**: Orta
- **Karakter Tutarlılığı**: Düşük
- **Maliyet**: Düşük ($0.03 - ₺1.28)

**Ne Zaman Kullanılır?**
- Yüksek çözünürlüklü görseller gerektiğinde
- Bütçe öncelikli olduğunda
- Karakter tutarlılığı kritik değilse
- Sahne kompozisyonu, obje ekleme/çıkarma işlemleri için

**Örnek Kullanım Senaryoları:**
- Arka plan değişiklikleri
- Obje ekleme/çıkarma
- Genel sahne düzenlemeleri

---

### 2. **Nano Banana** (Önerilen)

**Güçlü Yönleri:**
- **Açı Dönüşümü**: Orta
- **Karakter Tutarlılığı**: Yüksek
- **Maliyet**: Orta ($0.04 - ₺1.70)

**Ne Zaman Kullanılır?**
- Karakter tutarlılığı en önemli kriter olduğunda
- Hızlı ve verimli işlem gerektiğinde
- Orta seviye açı dönüşümleri için
- **En iyi genel performans** için önerilir

**Örnek Kullanım Senaryoları:**
- Karakter rotasyonları
- Yüz açı ayarlamaları
- Tutarlı karakter görseli üretimi

---

### 3. **Flux 2 Multi Angles**

**Güçlü Yönleri:**
- **Açı Dönüşümü**: Yüksek
- **Karakter Tutarlılığı**: Orta
- **Maliyet**: Değişken (MP × $0.021)

**Ne Zaman Kullanılır?**
- Açı dönüşümü en önemli kriter olduğunda
- Hassas açı kontrolü gerektiğinde
- `horizontal_angle` parametresi ile çalışır
- Maliyet görsel çözünürlüğüne göre değişir

**Maliyet Hesaplama:**
```
Maliyet = (Genişlik × Yükseklik / 1.000.000) × $0.021
Örnek: 2000×2000 piksel görsel = 4 MP × $0.021 = $0.084 - ₺3.57
```

**Örnek Kullanım Senaryoları:**
- Hassas açı dönüşümleri
- Çoklu açı üretimi
- Profesyonel karakter rotasyonları

---

### Model Karşılaştırma Tablosu

| Kriter | Seedream | Nano Banana | Flux 2 |
|--------|----------|-------------|--------|
| **Açı Dönüşümü** | Orta | Orta | **Yüksek** |
| **Karakter Tutarlılığı** | Düşük | **Yüksek** | Orta |
| **Çözünürlük** | **Yüksek** | Orta | Orta |
| **Maliyet** | **Düşük** | Orta | Değişken |
| **Hız** | Orta | **Hızlı** | Orta |

---

## Açı Değişimi İşlemi

### Desteklenen Açılar

Sistem 8 standart açıyı destekler:
- **0°**: Ön görünüm (Frontal)
- **45°**: Sağ ön üç çeyrek
- **90°**: Sağ yan profil
- **135°**: Sağ arka üç çeyrek
- **180°**: Arka görünüm (Dorsal)
- **225°**: Sol arka üç çeyrek
- **270°**: Sol yan profil
- **315°**: Sol ön üç çeyrek

### Açı Değişimi Adımları

1. **Model Seçimi**
   - İşlemek istediğiniz görseli seçin
   - "AI Modelleri" bölümünden bir model seçin
   - Model kartında güçlü yönleri görüntülenir

2. **Açı Seçimi**
   - 3D açı seçici açılır
   - İstediğiniz açı(lar)ı seçin
   - Birden fazla açı seçerek toplu üretim yapabilirsiniz

3. **Maliyet Bilgisi**
   - Seçilen modele göre tahmini maliyet gösterilir
   - Flux 2 için dinamik hesaplama (MP bazlı)
   - Seedream ve Nano Banana için sabit maliyet

4. **İşlemi Başlatma**
   - "Görseli İşle" butonuna tıklayın
   - Onay modalında seçimlerinizi kontrol edin
   - "Onayla ve İşle" ile başlatın

### Otomatik Prompt Üretimi

**Önemli**: Açı seçtiğinizde sistem otomatik olarak uygun prompt'u oluşturur. Manuel prompt yazmanıza gerek yoktur!

- Her açı için özel, AI modellerine optimize edilmiş prompt'lar
- Açı bilgisi otomatik olarak prompt'a eklenir
- Kullanıcı dostu, teknik detaylar gizlenir

### Açı Değişimi Örnekleri

<!-- Bu bölüm kullanıcı tarafından örnek görsellerle doldurulacak -->

**Örnek 1: 0° → 90° Dönüşümü**
- [Örnek görsel 1: Orijinal 0°]
- [Örnek görsel 2: Üretilen 90°]

**Örnek 2: 45° → 180° Dönüşümü**
- [Örnek görsel 1: Orijinal 45°]
- [Örnek görsel 2: Üretilen 180°]

**Örnek 3: Çoklu Açı Üretimi**
- [Örnek görsel 1: Orijinal]
- [Örnek görsel 2: 0°, 90°, 180°, 270° toplu üretim]

---

## Kaynak Görsel ile İşlem

### Kaynak Görsel Nedir?

Daha önce üretilmiş bir görseli, yeni işlemler için **kaynak** olarak kullanabilirsiniz. Bu özellik, görsel zincirleri oluşturmanıza ve iteratif iyileştirmeler yapmanıza olanak sağlar.

### Kaynak Görsel Seçme

1. **Pipeline Görünümüne Geçin**
   - "Pipeline'ı Görüntüle" butonuna tıklayın
   - Üretilmiş tüm görselleri görüntüleyin

2. **Görseli Kaynak Olarak İşaretle**
   - İstediğiniz görselin üzerine gelin
   - "Kaynak Olarak Kullan" butonuna tıklayın
   - Otomatik olarak işleme ekranına döner

3. **Mevcut Açı Bilgisi**
   - Kaynak görselin açısı otomatik olarak algılanır
   - "Mevcut Açı: X°" bilgisi gösterilir
   - Yeni açı seçimi yapabilir veya aynı açıyı koruyabilirsiniz

### Kaynak Görsel ile Yapılabilecek İşlemler

#### 1. **Açı Değişimi (Revizyon)**
- Kaynak görselden farklı bir açıya dönüşüm
- Örnek: 45° kaynak → 90° hedef
- Sistem otomatik olarak açı farkını algılar ve prompt oluşturur

#### 2. **Aynı Açıda İyileştirme**
- Aynı açıyı koruyarak görsel kalitesini artırma
- Akıllı asistan ile otomatik düzeltme önerileri
- Kullanıcı notları ile özel iyileştirmeler

#### 3. **Akıllı Prompt ile Revizyon**
- Asistan önerileri ile otomatik düzeltmeler
- Açı kontrolü + görsel kalitesi iyileştirmeleri
- Kullanıcı istekleri ile birleştirilmiş prompt'lar

---

## Akıllı Prompt Asistanı

### Asistan Nedir?

Akıllı Prompt Asistanı, OpenRouter API kullanarak görsellerinizi analiz eden ve otomatik düzeltme önerileri sunan bir AI sistemidir.

### Asistanın Görevi

1. **Görsel Analizi**
   - Orijinal referans görseli inceler
   - Üretilmiş görseli analiz eder
   - İki görsel arasındaki farkları tespit eder

2. **Açı Kontrolü**
   - Hedef açıya gerçekten ulaşılıp ulaşılmadığını kontrol eder
   - Açı sapması varsa nasıl düzeltileceğini önerir
   - Orijinal görsele geri dönmek yerine, hedef açıyı tamamlamayı önerir

3. **Görsel Kalitesi İyileştirmeleri**
   - Poz, ifade, vücut oranları
   - El pozisyonları, kıyafet kırışıklıkları
   - Kadraj, kamera yüksekliği
   - Gölgeler, ışık yönü
   - Arka plan detayları, keskinlik

4. **Kullanıcı İsteklerini Entegre Etme**
   - "İstediğiniz değişiklik" alanına yazdığınız notlar
   - Asistan önerileri ile birleştirilir
   - Tek bir optimize edilmiş prompt oluşturulur

### Asistan Nasıl Çalışır?

#### Adım 1: Görsel Hazırlama
- Orijinal referans görsel (img1) hazırlanır
- Kaynak olarak seçilen üretilmiş görsel (img2) hazırlanır
- Her iki görsel base64 formatında OpenRouter'a gönderilir

#### Adım 2: AI Analizi
- OpenRouter'daki AI modeli (varsayılan: `openrouter/auto`) görselleri analiz eder
- Sistem prompt'u ile yönlendirilir:
  - Açı kontrolü yapması
  - Somut düzeltmeler önermesi
  - Karakter kimliği detaylarından kaçınması

#### Adım 3: Prompt Üretimi
- AI, 1-3 cümlelik düzeltme prompt'u üretir
- Animasyonlu yazma efekti ile gösterilir
- Kullanıcı prompt'u düzenleyebilir

#### Adım 4: İşleme Entegrasyonu
- Üretilen prompt, açı prompt'una otomatik eklenir
- Backend'e gönderilir ve AI modeli ile işlenir

### Asistan Kullanım Senaryoları

**Senaryo 1: Açı Düzeltmesi**
```
Durum: 45° hedeflendi ama görsel 30° gibi görünüyor
Asistan Önerisi: "Rotate the head 15 degrees more to the right, bring the right shoulder forward, adjust the torso angle to match 45-degree perspective"
```

**Senaryo 2: Kalite İyileştirme**
```
Durum: Açı doğru ama yüz ifadesi ve ışıklandırma iyileştirilebilir
Asistan Önerisi: "Soften the facial expression to neutral, balance the lighting across the face, reduce shadow on the left wall"
```

**Senaryo 3: Kullanıcı İsteği + Asistan**
```
Kullanıcı Notu: "yüzü daha sinematik ışıkla aydınlat, saçlara parıltı ekle"
Asistan Önerisi: "Apply cinematic lighting to the face with subtle rim light, add highlights to the hair strands, maintain the 90-degree angle while enhancing facial features"
```

### Asistan Avantajları

- **Otomatik Analiz**: Görselleri manuel incelemenize gerek yok
- **Hassas Düzeltmeler**: Somut, uygulanabilir öneriler
- **Açı Kontrolü**: Hedef açıya ulaşılıp ulaşılmadığını otomatik kontrol
- **Zaman Tasarrufu**: Prompt yazma süresini kısaltır
- **Profesyonel Sonuçlar**: AI destekli, optimize edilmiş prompt'lar

---

## Sonuçları Görüntüleme ve Yönetme

### Listem Bölümü

**Listem** bölümünde tüm üretilmiş görsellerinizi görüntüleyebilirsiniz:

- **Referans Görsel**: Orijinal yüklenen görsel
- **Üretilen Görseller**: Tüm işlenmiş versiyonlar
  - Üretilme zamanı (saat:dakika formatında)
  - Dosya boyutu (KB/MB)
  - Açı bilgisi (varsa)
  - "YENİ" rozeti (ilk 15 saniye)

### Görsel Detayları

Bir görsele tıklayarak detaylı bilgileri görebilirsiniz:

- **AI Modeli**: Hangi model kullanıldı
- **İşleme Süresi**: Milisaniye veya saniye cinsinden
- **Açı**: Üretim açısı
- **Oluşturulma Tarihi**: Tam tarih ve saat
- **Dosya Boyutu**: Gerçek boyut bilgisi

### Görsel İşlemleri

Her görsel için şu işlemleri yapabilirsiniz:

1. **Önizleme**: Görseli tam ekranda görüntüleme
2. **İndirme**: Görseli bilgisayarınıza kaydetme
3. **Kaynak Olarak Kullan**: Yeni işlemler için kaynak seçme
4. **Silme**: Görseli kalıcı olarak silme

---

## Üretim Hattı (Pipeline)

### Pipeline Nedir?

Pipeline, görsellerinizin üretim zincirini görselleştiren hiyerarşik bir yapıdır. Hangi görselin hangi görselden üretildiğini takip edebilirsiniz.

### Pipeline Yapısı

```
Ana Referans (Orijinal)
  └── Üretilen Görsel 1 (0°)
  └── Üretilen Görsel 2 (90°)
  └── Üretilen Görsel 3 (180°)
       └── Kaynak Referans (180° görselinden)
            └── Üretilen Görsel 4 (270°)
            └── Üretilen Görsel 5 (45°)
```

### Pipeline Görünümü

- **Ana Referans**: Orijinal yüklenen görsel (mor kenarlı)
- **Kaynak Referans**: Daha önce üretilmiş görsel (mavi kenarlı)
- **Üretilen Görseller**: Her seviyede üretilen görseller
- **Seviye Etiketleri**: Hangi nesil olduğunu gösterir

### Pipeline Özellikleri

- **Görsel Hiyerarşisi**: Hangi görselin hangisinden üretildiği
- **Açı Takibi**: Her görselin açı bilgisi
- **Toplu Görüntüleme**: Aynı kaynaktan üretilen görselleri birlikte görme
- **Hızlı Erişim**: Görsellere tıklayarak hızlı işlem yapma

---

## Maliyet Bilgileri

### Maliyet Gösterimi

Her model seçildiğinde, açı modalında tahmini maliyet bilgisi gösterilir:

#### Seedream
- **Sabit Maliyet**: $0.03 - ₺1.28
- Çözünürlükten bağımsız

#### Nano Banana
- **Sabit Maliyet**: $0.04 - ₺1.70
- Çözünürlükten bağımsız

#### Flux 2 Multi Angles
- **Dinamik Maliyet**: MP × $0.021
- **TL Karşılığı**: Dolar × 42.5
- Örnek: 4 MP görsel = $0.084 - ₺3.57

### Maliyet Hesaplama Formülü

```
Flux 2 Maliyeti = (Genişlik × Yükseklik / 1.000.000) × $0.021
TL Karşılığı = Dolar × 42.5
```

### Maliyet Optimizasyonu

- **Düşük Maliyet**: Seedream kullanın
- **Orta Maliyet**: Nano Banana kullanın
- **Yüksek Çözünürlük**: Seedream tercih edin
- **Açı Hassasiyeti**: Flux 2 kullanın (maliyet değişken)

---

## İpuçları ve En İyi Uygulamalar

### Görsel Kalitesi

1. **Yüksek Çözünürlük**: Mümkün olduğunca yüksek çözünürlüklü görseller yükleyin
2. **Net Görseller**: Bulanık veya düşük kaliteli görsellerden kaçının
3. **İyi Aydınlatma**: Eşit aydınlatılmış görseller daha iyi sonuç verir

### Model Seçimi

1. **Karakter Tutarlılığı Önemliyse**: Nano Banana
2. **Açı Hassasiyeti Önemliyse**: Flux 2 Multi Angles
3. **Bütçe Öncelikliyse**: Seedream
4. **Genel Kullanım**: Nano Banana (önerilen)

### Açı Seçimi

1. **Tek Açı**: Hızlı test için
2. **Çoklu Açı**: Toplu üretim için (0°, 90°, 180°, 270°)
3. **Kademeli Dönüşüm**: 45° artışlarla yavaş yavaş dönüşüm

### Asistan Kullanımı

1. **Açı Kontrolü**: Her üretimden sonra asistanı çalıştırın
2. **Spesifik İstekler**: "İstediğiniz değişiklik" alanını kullanın
3. **İteratif İyileştirme**: Asistan önerilerini kullanarak tekrar üretin

---

## ❓ Sık Sorulan Sorular

### Açı değişimi için prompt yazmam gerekiyor mu?

**Hayır!** Sistem otomatik olarak açı değişimi için uygun prompt'u oluşturur. Sadece açı seçmeniz yeterlidir.

### Kaynak görsel seçtiğimde açı değişmeli mi?

Hayır, zorunlu değil. Aynı açıyı koruyarak sadece görsel kalitesini iyileştirebilir veya farklı bir açıya dönüştürebilirsiniz.

### Asistan her zaman doğru mu?

Asistan AI tabanlıdır ve genellikle iyi öneriler sunar, ancak sonuçları kontrol etmeniz önerilir. İsterseniz asistan önerilerini düzenleyebilirsiniz.

### Hangi modeli seçmeliyim?

- **Karakter tutarlılığı önemliyse**: Nano Banana
- **Açı hassasiyeti önemliyse**: Flux 2
- **Bütçe öncelikliyse**: Seedream

### Maliyet gerçek zamanlı mı?

Evet, Flux 2 için görsel çözünürlüğüne göre gerçek zamanlı hesaplanır. Seedream ve Nano Banana için sabit maliyet gösterilir.

---

## Teknik Detaylar

### Desteklenen Formatlar
- Giriş: JPEG, PNG, WebP, GIF
- Çıkış: JPEG (otomatik dönüşüm)

### Maksimum Dosya Boyutu
- Tek görsel: 10 MB
- Toplu yükleme: 5 görsel (her biri 10 MB'a kadar)

### API Entegrasyonları
- **Fal.ai**: Görsel işleme modelleri
- **OpenRouter**: Akıllı prompt asistanı
- **Firebase**: Kimlik doğrulama ve veri saklama

### Veri Saklama
- Tüm görseller ve metadata Firebase Firestore'da saklanır
- Görseller yerel sunucuda `/uploads` klasöründe tutulur
- Her kullanıcının görselleri izole edilmiştir

---

## Notlar

- Bu kılavuz sürekli güncellenmektedir
- Yeni özellikler eklendikçe kılavuz güncellenecektir
- Sorularınız için proje yöneticisine başvurun

---

**Son Güncelleme**: 2024
**Versiyon**: 1.0

