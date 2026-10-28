"""Import one Rosstat regional HTML table into the local app snapshot.

Examples:
  python scripts/import_rosstat.py --date 2026-10-19 --url https://rosstat.gov.ru/...html
  python scripts/import_rosstat.py --date 2026-10-19 --url https://rosstat.gov.ru/...html --file report.html
TLS verification stays enabled. Import is atomic; empty or malformed input never
replaces the checked-in dataset. A browser reload is needed after rebuilding.
"""
import argparse
from datetime import date
import json
from pathlib import Path
import re
import sys
from urllib.parse import urlparse

from bs4 import BeautifulSoup
import requests

ROOT=Path(__file__).resolve().parent.parent

def parse_html(html, observed, source_id):
    soup=BeautifulSoup(html,'html.parser')
    output={}
    for row in soup.select('tr'):
        cells=row.find_all(['td','th'],recursive=False)
        if len(cells)!=6:
            continue
        columns=[' '.join(c.get_text(' ',strip=True).split()) for c in cells]
        name=columns[0].strip().replace('*','')
        numbers=[re.sub(r'\s','',x).replace(',','.') for x in columns[1:]]
        if not all(re.fullmatch(r'\d+\.\d+|\.\.\.|…|–|-',x) for x in numbers):
            continue
        if 'федеральный округ' in name.lower() or 'Российская Федерация' not in name and not any(x in name for x in ['область','край','Республика','республика','округ','Москва','Санкт-Петербург','Севастополь']):
            continue
        name=re.sub(r'^в том числе\s*:\s*','',name,flags=re.I)
        if name.startswith('Архангельская область'):
            if 'кроме' not in name:
                continue
            name='Архангельская область'
        if name.startswith('Тюменская область') and 'кроме' in name:
            continue
        if name.startswith('Ханты-Мансийский'):
            name='Ханты-Мансийский авт. округ'
        if name=='Российская Федерация':
            name='Российская Федерация'
        for fuel,text in zip(['gas','ai92','ai95','ai98','diesel'],numbers):
            if fuel=='gas' or text in ['...','…','–','-']:
                continue
            value=float(text)
            if not 0<value<10000:
                raise ValueError('Out-of-range price in row: '+name)
            output[(name,fuel)]={'region':name,'fuel':fuel,'date':observed,'price':value,'source':source_id}
    if ('Российская Федерация','diesel') not in output or len(output)<20:
        raise ValueError('Regional price table not found or incomplete; snapshot unchanged')
    return list(output.values())

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--date',required=True,help='Observation date, YYYY-MM-DD')
    parser.add_argument('--url',required=True,help='Official canonical publication URL')
    parser.add_argument('--file',type=Path,help='Use a locally saved HTML instead of downloading')
    parser.add_argument('--published',help='Publication date, YYYY-MM-DD; omitted if not known')
    args=parser.parse_args()
    observed=date.fromisoformat(args.date).isoformat()
    parsed=urlparse(args.url)
    if parsed.scheme!='https' or not (parsed.hostname=='rosstat.gov.ru' or (parsed.hostname or '').endswith('.rosstat.gov.ru')) or parsed.username or parsed.password or parsed.query or parsed.fragment:
        parser.error('--url must be a canonical HTTPS Rosstat URL')
    if args.file:
        html=args.file.read_bytes()
    else:
        response=requests.get(args.url,timeout=40)
        response.raise_for_status()
        html=response.content
    source_id='rosstat-'+observed
    rows=parse_html(html,observed,source_id)
    path=ROOT/'src/snapshot.json'
    snapshot=json.loads(path.read_text(encoding='utf-8'))
    replacement_keys={(r['region'],r['fuel'],r['date']) for r in rows}
    snapshot['observations']=[r for r in snapshot['observations'] if (r['region'],r['fuel'],r['date']) not in replacement_keys]+rows
    source={'id':source_id,'title':'Росстат · '+observed,'url':args.url,'observedAt':observed,'publishedAt':date.fromisoformat(args.published).isoformat() if args.published else '', 'kind':'official','unit':'RUB/l','scope':'Средние потребительские розничные цены; не предложения АЗС и не оптовые котировки'}
    snapshot['sources']=[s for s in snapshot['sources'] if s['id']!=source_id]+[source]
    snapshot['asOf']=date.today().isoformat()
    temp=path.with_suffix('.tmp')
    temp.write_text(json.dumps(snapshot,ensure_ascii=False,indent=2),encoding='utf-8')
    temp.replace(path)
    print(f'Imported {len(rows)} observations for {observed}. Run npm test and npm run build.')

if __name__=='__main__':
    try:
        main()
    except (ValueError,requests.RequestException,OSError) as error:
        print('Import failed; snapshot unchanged: '+str(error),file=sys.stderr)
        raise SystemExit(1)
