import warnings
warnings.filterwarnings('ignore')

import pdfplumber
import json
import re
import sys
from pathlib import Path

def extract_poz_from_pdf(pdf_path):
    """Extract POZ data from PDF file"""
    poz_items = []
    
    try:
        with pdfplumber.open(pdf_path) as pdf:
            total_pages = len(pdf.pages)
            print(f"  Processing {total_pages} pages...", flush=True)
            
            for page_num, page in enumerate(pdf.pages, 1):
                if page_num % 10 == 0:
                    print(f"    Page {page_num}/{total_pages}...", flush=True)
                
                # Extract text and look for POZ patterns
                text = page.extract_text()
                if not text:
                    continue
                
                # Split into lines
                lines = text.split('\n')
                
                for line in lines:
                    # Look for POZ code pattern at start of line
                    poz_match = re.match(r'^(\d{1,2}\.\d{3}\.\d{3,4}|[A-ZÇŞİĞÜÖ]{2,5}\.\d{3})\s+(.+)', line)
                    
                    if poz_match:
                        poz_code = poz_match.group(1)
                        rest = poz_match.group(2)
                        
                        # Try to extract description, unit, and price
                        # Common patterns: "description UNIT price" or "description price UNIT"
                        parts = rest.split()
                        
                        if len(parts) >= 3:
                            # Try to find price (number with comma or dot)
                            price = None
                            unit = None
                            description_parts = []
                            
                            for i, part in enumerate(parts):
                                # Check if this looks like a price
                                if re.search(r'[\d\.,]+', part):
                                    try:
                                        price_str = part.replace('.', '').replace(',', '.')
                                        price = float(re.search(r'[\d\.]+', price_str).group())
                                        # Everything before might be description
                                        description_parts = parts[:i]
                                        # Next part might be unit
                                        if i + 1 < len(parts):
                                            unit = parts[i + 1]
                                        break
                                    except:
                                        pass
                            
                            if price and description_parts:
                                description = ' '.join(description_parts)
                                if not unit:
                                    unit = 'AD'  # default unit
                                
                                poz_items.append({
                                    'code': poz_code,
                                    'description': description,
                                    'unit': unit,
                                    'unitPrice': price
                                })
    
    except Exception as e:
        print(f"  Error: {e}", flush=True)
    
    return poz_items

def main():
    pdf_dir = Path(__file__).parent
    pdf_files = sorted(list(pdf_dir.glob('*.pdf')))
    
    all_poz_data = []
    
    for pdf_file in pdf_files:
        print(f"\nProcessing {pdf_file.name}...")
        sys.stdout.flush()
        poz_items = extract_poz_from_pdf(pdf_file)
        print(f"  Found {len(poz_items)} POZ items")
        all_poz_data.extend(poz_items)
    
    # Save to JSON
    output_file = pdf_dir / 'poz_dataset.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_poz_data, f, ensure_ascii=False, indent=2)
    
    print(f"\n✓ Total POZ items extracted: {len(all_poz_data)}")
    print(f"✓ Saved to: {output_file}")

if __name__ == '__main__':
    main()
