#!/usr/bin/env python3
"""Fetch Greek text for Aesop fables from mythfolklore.net Chambry edition."""
import sys, re, html, urllib.request

PERRY_CHAMBRY = {
    228: 353, 366: 315, 211: 297, 231: 356, 323: 166,
    324: 168, 415: 345, 372: 71, 300: 92, 12: 37
}

for perry, chambry in sorted(PERRY_CHAMBRY.items()):
    url = f"http://www.mythfolklore.net/aesopica/chambry/{chambry}.htm"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as resp:
            text = resp.read().decode('utf-8', errors='replace')
    except Exception as e:
        print(f"=== Perry {perry} (Chambry {chambry}) === ERROR: {e}")
        continue
    
    # Find Greek title
    titles = re.findall(r'<h3[^>]*class=["\']greek["\'][^>]*>(.*?)</h3>', text, re.DOTALL)
    for t in titles:
        clean = re.sub(r'<[^>]+>', '', t).strip()
        print(f"TITLE: {html.unescape(clean)}")
    
    # Find Greek text spans
    spans = re.findall(r'<span[^>]*class=["\']greek["\'][^>]*>(.*?)</span>', text, re.DOTALL)
    for s in spans:
        clean = re.sub(r'<[^>]+>', '', s).strip()
        clean = html.unescape(clean)
        clean = re.sub(r'\s+', ' ', clean)
        print(clean)
        print()
    
    print(f"=== END Perry {perry} ===")
    print()
