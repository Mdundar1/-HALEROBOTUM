from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from paddleocr import PaddleOCR
import shutil
import os
import re
import fitz # PyMuPDF
from typing import List, Dict

app = FastAPI()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize PaddleOCR (Turkish language)
ocr = PaddleOCR(use_angle_cls=True, lang='tr')

@app.get("/")
def read_root():
    return {"message": "OCR Service is running", "version": "2.0"}

def extract_poz_items(text: str) -> List[Dict]:
    """Extract POZ items from OCR text"""
    items = []
    lines = text.strip().split('\n')
    
    for line in lines:
        line = line.strip()
        if len(line) < 5 or 'Poz' in line or 'Tanım' in line or 'Birim' in line or 'Fiyat' in line:
            continue
        
        # Match POZ code pattern: XX.XXX.XXXX or similar
        poz_match = re.match(r'^(\d{1,2}\.\d{3}\.\d{3,4}|\d+[\.\d\/]+)', line)
        if not poz_match:
            continue
        
        code = poz_match.group(1)
        rest = line[len(code):].strip()
        parts = rest.split()
        
        # Extract price (usually the last numeric value)
        unit_price = 0
        for i in range(len(parts) - 1, -1, -1):
            clean = re.sub(r'[^\d\.,]', '', parts[i])
            if clean and re.match(r'[\d\.,]+', clean):
                price_str = clean.replace('.', '').replace(',', '.')
                try:
                    price = float(price_str)
                    if price > 0:
                        unit_price = price
                        parts.pop(i)
                        break
                except:
                    pass
        
        # Extract unit
        unit = 'Adet'
        for i in range(len(parts) - 1, -1, -1):
            if re.match(r'^(m[23²³]?|kg|ton|adet|lt|ad|mt|set|takım)$', parts[i].lower()):
                unit = parts[i]
                parts.pop(i)
                break
        
        # Remaining is description
        description = ' '.join(parts).strip()
        
        if code and description:
            items.append({
                "code": code,
                "description": description,
                "unit": unit,
                "unitPrice": unit_price
            })
    
    return items

@app.post("/process")
async def process_file(file: UploadFile = File(...)):
    try:
        temp_filename = f"temp_{file.filename}"
        with open(temp_filename, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        all_items = []
        
        # Check if PDF
        if file.filename.lower().endswith('.pdf'):
            try:
                # Convert PDF to images using PyMuPDF
                doc = fitz.open(temp_filename)
                
                for i in range(len(doc)):
                    page = doc.load_page(i)
                    pix = page.get_pixmap(dpi=200)
                    img_path = f"temp_page_{i}.png"
                    pix.save(img_path)
                    
                    # Run OCR on each page
                    result = ocr.ocr(img_path, cls=True)
                    
                    # Extract text
                    page_text = []
                    if result and result[0]:
                        for line in result[0]:
                            page_text.append(line[1][0])
                    
                    # Parse POZ items
                    items = extract_poz_items('\n'.join(page_text))
                    all_items.extend(items)
                    
                    # Cleanup page image
                    if os.path.exists(img_path):
                        os.remove(img_path)
            except Exception as e:
                if "poppler" in str(e).lower():
                    raise Exception("PDF işleme hatası: Windows'ta 'poppler' yüklü değil. Lütfen PDF yerine ekran görüntüsü (PNG/JPG) yükleyin.")
                raise Exception(f"Original error: {str(e)}")
        else:
            # Process as image
            result = ocr.ocr(temp_filename, cls=True)
            page_text = []
            if result and result[0]:
                for line in result[0]:
                    page_text.append(line[1][0])
            
            items = extract_poz_items('\n'.join(page_text))
            all_items.extend(items)
        
        # Cleanup
        os.remove(temp_filename)

        return {
            "status": "success",
            "items": all_items,
            "count": len(all_items)
        }

    except Exception as e:
        # Cleanup on error
        if os.path.exists(temp_filename):
            os.remove(temp_filename)
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
