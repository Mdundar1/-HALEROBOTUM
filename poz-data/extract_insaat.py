import warnings
warnings.filterwarnings('ignore')

import PyPDF2
import json
import re
from pathlib import Path

def extract_poz_from_pdf_simple(pdf_path):
    """Extract POZ data from PDF using PyPDF2"""
    poz_items = []
    
    print(f"Opening {pdf_path.name}...")
    
    try:
        with open(pdf_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            total_pages = len(pdf_reader.pages)
            print(f"Total pages: {total_pages}")
            
            for page_num in range(min(total_pages, 50)):  # Process first 50 pages for testing
                if page_num % 5 == 0:
                    print(f"  Processing page {page_num + 1}...")
                
                page = pdf_reader.pages[page_num]
                text = page.extract_text()
                
                if not text:
                    continue
                
                lines = text.split('\n')
                
                for line in lines:
                    line = line.strip()
                    if not line:
                        continue
                    
                    # Look for POZ code at start: "15.010.1001" or "ÇŞM.003"
                    poz_pattern = r'^(\d{1,2}\.\d{3}\.\d{3,4})\s+(.+)'
                    match = re.match(poz_pattern, line)
                    
                    if match:
                        poz_code = match.group(1)
                        rest = match.group(2).strip()
                        
                        # Split and try to find unit and price
                        parts = rest.split()
                        
                        # Look for price (usually at end)
                        price = None
                        unit = None
                        description = rest
                        
                        # Try to find numbers that look like prices
                        for i in range(len(parts) - 1, -1, -1):
                            part = parts[i].replace('.', '').replace(',', '.')
                            if re.match(r'^\d+\.?\d*$', part):
                                try:
                                    price = float(part)
                                    # Everything before this is description
                                    description = ' '.join(parts[:i])
                                    # Part before price might be unit
                                    if i > 0:
                                        unit = parts[i - 1]
                                        description = ' '.join(parts[:i - 1])
                                    break
                                except:
                                    pass
                        
                        if price and description:
                            if not unit or len(unit) > 10:  # If unit looks wrong
                                unit = 'AD'
                            
                            poz_items.append({
                                'code': poz_code,
                                'description': description.strip(),
                                'unit': unit.strip() if unit else 'AD',
                                'unitPrice': price
                            })
    
    except Exception as e:
        print(f"Error: {e}")
    
    return poz_items

def main():
    pdf_dir = Path(__file__).parent
    pdf_file = pdf_dir / 'inşaat birim.pdf'
    
    if not pdf_file.exists():
        print(f"ERROR: {pdf_file} not found!")
        return
    
    print("\n" + "="*60)
    print("POZ DATA EXTRACTION - İNŞAAT")
    print("="*60 + "\n")
    
    poz_items = extract_poz_from_pdf_simple(pdf_file)
    
    print(f"\n✓ Extracted {len(poz_items)} POZ items")
    
    # Show first 5 items
    print("\nFirst 5 items:")
    for item in poz_items[:5]:
        print(f"  {item['code']} - {item['description'][:50]}... | {item['unit']} | ₺{item['unitPrice']}")
    
    # Save to JSON
    output_file = pdf_dir / 'insaat_poz_dataset.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(poz_items, f, ensure_ascii=False, indent=2)
    
    print(f"\n✓ Saved to: {output_file}")
    print("="*60)

if __name__ == '__main__':
    main()
