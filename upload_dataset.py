import sys
import requests
import os

def upload_file(filepath):
    url = 'http://localhost:3001/api/dataset/upload'
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        sys.exit(1)
        
    print(f"Uploading {filepath} to {url}...")
    try:
        with open(filepath, 'rb') as f:
            files = {'file': f}
            response = requests.post(url, files=files)
            
        print(f"Status Code: {response.status_code}")
        print("Response:", response.text)
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python upload_dataset.py <filepath>")
        sys.exit(1)
    upload_file(sys.argv[1])
