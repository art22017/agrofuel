from pathlib import Path
import json,re
from bs4 import BeautifulSoup
R=Path('.')
names=set(o['region'] for o in json.loads((R/'src/snapshot.json').read_text(encoding='utf-8'))['observations'])
def canon(n):
 n=n.replace('г. ','').replace('авт.','автономная').strip()
 aliases={'Москва':'г. Москва','Санкт-Петербург':'г. Санкт-Петербург','Башкортостан':'Республика Башкортостан','Татарстан':'Республика Татарстан','Пермский край':'Пермский край'}
 if n in names:return n
 for a in names:
  if n.lower() in a.lower() or a.lower() in n.lower():return a
 return None
quotes=[]
for file,source,url,cols in [('petrolplus-index.html','ПетролПлюс','https://www.petrolplus.ru/fuelindex/',{'ai92':1,'ai95':2,'diesel':3}),('benzinanet-prices.html','Бензина.нет','https://www.benzinanet.com/ceny/',{'ai92':1,'ai95':2,'ai98':3,'diesel':5})]:
 s=BeautifulSoup((R/'research'/file).read_text(encoding='utf-8'),'html.parser')
 text=s.get_text(' ',strip=True)
 date=re.search(r'(\d{1,2})\s+октября\s+2026',text)
 observed=f'2026-10-{int(date[1]):02}' if date and source=='ПетролПлюс' else None
 for row in s.select('table tr'):
  cells=row.select('td')
  if len(cells)<4:continue
  original=cells[0].get_text(' ',strip=True);region=canon(original)
  if not region:continue
  # City rows must not be assigned to the surrounding region.
  if source=='Бензина.нет' and original not in names and original not in ['Башкортостан','Татарстан','Москва','Санкт-Петербург']:continue
  for fuel,index in cols.items():
   try:price=float(cells[index].get_text(' ',strip=True).replace(',','.').replace('₽','').strip())
   except (ValueError,IndexError):continue
   if 0<price<300:quotes.append(dict(region=region,fuel=fuel,price=price,source=source,url=url,observedAt=observed,retrievedAt='2026-10-29',scope='Среднее по выборке поставщика'))
(R/'src/provider-prices.json').write_text(json.dumps(quotes,ensure_ascii=False,indent=2),encoding='utf-8')
print('Imported',len(quotes),'quotes;',len(set(q['region'] for q in quotes)),'regions', {s:sum(q['source']==s for q in quotes) for s in ['ПетролПлюс','Бензина.нет']})
