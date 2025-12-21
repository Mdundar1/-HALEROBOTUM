-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Poz Items Table
CREATE TABLE poz_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  unit VARCHAR(20),
  unit_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
  category VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for faster searching
CREATE INDEX idx_poz_items_code ON poz_items(code);
CREATE INDEX idx_poz_items_description ON poz_items USING gin(to_tsvector('turkish', description));

-- Projects Table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  total_cost DECIMAL(12, 2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_projects_user_id ON projects(user_id);

-- Project Items Table
CREATE TABLE project_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  raw_text TEXT,
  matched_poz_id UUID REFERENCES poz_items(id) ON DELETE SET NULL,
  quantity DECIMAL(12, 4) DEFAULT 0,
  unit VARCHAR(20),
  calculated_price DECIMAL(12, 2) DEFAULT 0,
  confidence_score DECIMAL(3, 2),
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_project_items_project_id ON project_items(project_id);
CREATE INDEX idx_project_items_status ON project_items(status);

-- File Uploads Table
CREATE TABLE file_uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  file_key VARCHAR(500) NOT NULL,
  file_size BIGINT,
  mime_type VARCHAR(100),
  status VARCHAR(50) DEFAULT 'uploaded',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_file_uploads_project_id ON file_uploads(project_id);

-- Insert sample POZ data
INSERT INTO poz_items (code, description, unit, unit_price, category) VALUES
('15.120.101', 'Çimento esaslı, elyaf takviyeli, tek bileşenli tamir harcı', 'm²', 450.50, 'Tamir Harcları'),
('Y.16.050/01', 'C 25/30 basınç dayanım sınıfında beton dökülmesi', 'm³', 2800.00, 'Beton'),
('MSB.915', 'Epoksi esaslı self-levelling zemin kaplaması', 'm²', 1200.75, 'Zemin Kaplamaları'),
('15.010.1001', 'Kırma taş dolgu', 'm³', 180.00, 'Dolgu'),
('15.250.1001', 'Betonarme kalıp', 'm²', 95.50, 'Kalıp');
