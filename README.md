# ImageFlow - AI Destekli Görsel İşleme Platformu

ImageFlow, AI modelleri kullanarak görsellerinizi farklı açılardan üretmenize ve iyileştirmenize olanak sağlayan modern bir görsel işleme platformudur. Sistem, karakter tutarlılığını koruyarak görsel dönüşümleri gerçekleştirir.

## 🎯 Proje Amacı

ImageFlow, e-ticaret, pazarlama ve içerik üretimi gibi alanlarda kullanılmak üzere, ürün görsellerini farklı açılardan otomatik olarak üretmeyi hedefler. AI destekli işleme ile manuel çekim maliyetlerini azaltır ve hızlı içerik üretimi sağlar.

### Temel Özellikler

- **Çoklu AI Model Desteği**: Seedream, Nano Banana, Flux 2 Multi Angles
- **Akıllı Açı Yönetimi**: 8 farklı açı (0°, 45°, 90°, 135°, 180°, 225°, 270°, 315°)
- **Otomatik Prompt Üretimi**: Açı değişimleri için otomatik prompt oluşturma
- **Akıllı Asistan**: OpenRouter tabanlı görsel analiz ve düzeltme önerileri
- **Pipeline Yönetimi**: Hiyerarşik görsel üretim zinciri takibi
- **Maliyet Hesaplama**: Gerçek zamanlı üretim maliyeti gösterimi

## 🏗️ Mimari

Proje monorepo yapısında, frontend ve backend ayrı dizinlerde organize edilmiştir.

### Backend (Render)

- **Platform**: [Render](https://render.com)
- **Teknoloji**: Node.js + Express.js + TypeScript
- **Dizin**: `backend/`
- **Deployment**: `render.yaml` ile otomatik deploy
- **Özellikler**:
  - RESTful API endpoints
  - Firebase Authentication entegrasyonu
  - Firestore veritabanı ile veri kalıcılığı
  - fal.ai AI servisleri entegrasyonu
  - OpenRouter API entegrasyonu
  - Statik dosya servisi (`/api/uploads`)

### Frontend (Vercel)

- **Platform**: [Vercel](https://vercel.com)
- **Teknoloji**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Dizin**: `frontend/`
- **Deployment**: Vercel otomatik Next.js algılama
- **Özellikler**:
  - Modern, responsive UI
  - Firebase Authentication
  - Gerçek zamanlı işleme durumu takibi
  - Drag & drop görsel yükleme
  - Pipeline görselleştirme

## 🚀 Hızlı Başlangıç

### Gereksinimler

- Node.js >= 18.0.0
- npm >= 9.0.0
- Firebase projesi
- fal.ai API anahtarı
- OpenRouter API anahtarı

### Yerel Geliştirme

1. **Bağımlılıkları yükleyin**:
   ```bash
   # Backend
   cd backend
   npm install
   
   # Frontend
   cd ../frontend
   npm install
   ```

2. **Environment değişkenlerini ayarlayın**:
   
   Root `.env` dosyası:
   ```env
   FAL_SUBSCRIBER_KEY=your_fal_ai_key
   BACKEND_PORT=4000
   FRONTEND_URL=http://localhost:3000
   BASE_URL=http://localhost:4000
   OPENROUTER_API_KEY=your_openrouter_key
   FIREBASE_PROJECT_ID=your_project_id
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk@...
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   
   # Firebase Storage kullanımı için (opsiyonel, varsayılan: local filesystem)
   USE_FIREBASE_STORAGE=true
   USE_FIREBASE_PUBLIC_URLS=true  # Public URL'ler için (signed URL yerine)
   ```
   
   `frontend/.env.local` dosyası:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:4000/api
   NEXT_PUBLIC_FIREBASE_API_KEY=your_web_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   ```

3. **Servisleri başlatın**:
   ```bash
   # Backend (terminal 1)
   cd backend
   npm run dev
   
   # Frontend (terminal 2)
   cd frontend
   npm run dev
   ```

## 📦 Deployment

### Backend - Render

1. Render dashboard'da yeni bir **Web Service** oluşturun
2. GitHub repository'nizi bağlayın
3. Ayarlar:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
4. Environment Variables:
   ```
   NODE_ENV=production
   FRONTEND_URL=https://your-vercel-app.vercel.app
   BASE_URL=https://your-render-app.onrender.com
   FAL_SUBSCRIBER_KEY=...
   OPENROUTER_API_KEY=...
   FIREBASE_PROJECT_ID=...
   FIREBASE_CLIENT_EMAIL=...
   FIREBASE_PRIVATE_KEY=...
   FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   USE_FIREBASE_STORAGE=true
   USE_FIREBASE_PUBLIC_URLS=true
   ```

### Frontend - Vercel

1. Vercel dashboard'da yeni bir proje oluşturun
2. GitHub repository'nizi bağlayın
3. Ayarlar:
   - **Framework Preset**: Next.js
   - **Root Directory**: `frontend`
4. Environment Variables:
   ```
   NEXT_PUBLIC_API_URL=https://your-render-app.onrender.com/api
   NEXT_PUBLIC_FIREBASE_API_KEY=...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
   NEXT_PUBLIC_FIREBASE_APP_ID=...
   ```

## 🛠️ Teknoloji Stack

### Backend
- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js
- **Database**: Firebase Firestore
- **Authentication**: Firebase Admin SDK
- **AI Services**: fal.ai SDK, OpenRouter API
- **File Storage**: Local filesystem + Firebase Storage

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Authentication**: Firebase Auth
- **HTTP Client**: Axios
- **Icons**: Lucide React

## 📚 Daha Fazla Bilgi

- [Kullanım Kılavuzu](./KULLANIM_KILAVUZU.md) - Detaylı kullanım talimatları
- [Backend README](./backend/README.md) - Backend API dokümantasyonu
- [Frontend README](./frontend/README.md) - Frontend component dokümantasyonu

## 📄 Lisans

Bu proje özel bir projedir.
