# -*- coding: utf-8 -*-
import requests
import os
from pathlib import Path
import time

pdf_dir = Path(r'c:\Users\Pc\.gemini\antigravity\playground\glacial-hubble\cost-estimator-v2\poz-data')
pdf_files = [
    'inşaat birim.pdf',
    'mekanik birim.pdf', 
    'elektrik birim.pdf',
    'msb birim.pdf',
    'ptt birim.pdf'
]

print("=" * 60)
print("POZ DATASET YÜKLEME - OCR İLE PDF İŞLEME")
print("=" * 60)
print()

total_added = 0

for idx, pdf_file in enumerate(pdf_files, 1):
    filepath = pdf_dir / pdf_file
    if not filepath.exists():
        print(f"[X] [{idx}/{len(pdf_files)}] {pdf_file} bulunamadi")
        continue
    
    file_size = filepath.stat().st_size / (1024 * 1024)  # MB
    print(f"[>>] [{idx}/{len(pdf_files)}] Yukleniyor: {pdf_file} ({file_size:.1f} MB)...")
    
    start_time = time.time()
    
    try:
        with open(filepath, 'rb') as f:
            files = {'file': (pdf_file, f, 'application/pdf')}
            response = requests.post(
                'http://localhost:3001/api/dataset/upload',
                files=files,
                timeout=600  # 10 dakika timeout
            )
        
        elapsed = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            added = data.get('addedCount', 0)
            total_in_db = data.get('totalCount', 0)
            total_added += added
            
            print(f"[OK] Basarili! {added} oge eklendi ({elapsed:.1f} saniye)")
            print(f"[>>] Toplam dataset: {total_in_db} oge")
            print()
        else:
            print(f"[X] Hata ({response.status_code}): {response.text}")
            print()
    except requests.exceptions.Timeout:
        print(f"[!] Timeout! Islem {elapsed:.1f} saniyeden uzun surdu")
        print()
    except Exception as e:
        print(f"[X] Hata: {str(e)}")
        print()

print("=" * 60)
print(f"OZET: Toplam {total_added} oge eklendi")
print("=" * 60)
