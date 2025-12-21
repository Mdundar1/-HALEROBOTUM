# Cost Estimator v2 - Modern Architecture

## 📋 Proje Hakkında

Maliyet Sihirbazı, yapay zeka destekli metraj analizi ve maliyet hesaplama platformudur. Mikroservis mimarisi ile geliştirilmiş, yüksek performanslı ve ölçeklenebilir bir web uygulamasıdır.

## 🏗️ Mimari

```
cost-estimator-v2/
├── client/          # Next.js 14 Frontend
├── server/          # Node.js/Express Backend
└── ocr-service/     # Python/FastAPI OCR Engine
```

### Teknoloji Stack

- **Frontend**: Next.js 14, React, Tailwind CSS, Framer Motion
- **Backend**: Node.js, Express, TypeScript
- **OCR Engine**: Python, FastAPI, PaddleOCR
- **Database**: Supabase (PostgreSQL)
- **Storage**: Cloudflare R2
- **Auth**: Supabase Auth

## 🚀 Kurulum

### Gereksinimler

- Node.js 18+
- Python 3.9+
- npm veya yarn

### 1. Client Kurulumu

```bash
cd client
npm install
cp .env.example .env.local
npm run dev
```

Frontend: http://localhost:3000

### 2. Server Kurulumu

```bash
cd server
npm install
cp .env.example .env
npm run dev
```

Backend API: http://localhost:3001

### 3. OCR Service Kurulumu

```bash
cd ocr-service
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

OCR Service: http://localhost:8000

## 🔧 Konfigürasyon

### Supabase

1. [Supabase](https://supabase.com) hesabı oluşturun
2. Yeni proje açın
3. `SUPABASE_URL` ve `SUPABASE_KEY` değerlerini `.env` dosyasına ekleyin

### Cloudflare R2

1. [Cloudflare Dashboard](https://dash.cloudflare.com) üzerinden R2 aktifleştirin
2. Yeni bucket oluşturun
3. API tokens oluşturun
4. R2 bilgilerini `.env` dosyasına ekleyin

## 📊 Database Schema

```sql
-- Poz Items Table
CREATE TABLE poz_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  unit VARCHAR(20),
  unit_price DECIMAL(12, 2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Projects Table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Project Items Table
CREATE TABLE project_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id),
  raw_text TEXT,
  matched_poz_id UUID REFERENCES poz_items(id),
  quantity DECIMAL(12, 2),
  calculated_price DECIMAL(12, 2),
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 🎨 Özellikler

- ✅ Modern, mobil uyumlu arayüz
- ✅ Dosya yükleme (PDF, DOCX, XLSX)
- ✅ PaddleOCR ile hızlı metin tanıma
- ✅ Otomatik POZ kod eşleştirme
- ✅ Gerçek zamanlı maliyet hesaplama
- ✅ Cloudflare R2 ile güvenli dosya depolama
- ✅ Supabase ile ölçeklenebilir veritabanı

## 🔄 Development Workflow

1. **Frontend geliştirme**: `cd client && npm run dev`
2. **Backend geliştirme**: `cd server && npm run dev`
3. **OCR test**: `cd ocr-service && python main.py`

## 📦 Production Build

### Client
```bash
cd client
npm run build
npm start
```

### Server
```bash
cd server
npm run build
npm start
```

## 🐳 Docker (Optional)

```bash
# Build all services
docker-compose build

# Run all services
docker-compose up
```

## 📝 API Endpoints

### Server (Port 3001)
- `POST /api/upload` - Dosya yükle
- `GET /api/poz` - POZ listesi
- `POST /api/calculate` - Maliyet hesapla

### OCR Service (Port 8000)
- `POST /process` - OCR işlemi

## 🤝 Contributing

Pull request'ler memnuniyetle karşılanır!

## 📄 License

MIT
