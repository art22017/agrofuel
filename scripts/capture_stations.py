"""Capture bounded, public map areas. Never submit reports or invent prices.

Coordinates and region classification: Benzas public map API.
Quotes: Benzas dated quotes or PetrolPlus public address/brand listings.
PetrolPlus quotes without observation timestamps retain observedAt=None.
"""
import concurrent.futures as futures
from datetime import datetime, timezone
import json, re, time
from pathlib import Path
import requests
from bs4 import BeautifulSoup

ROOT=Path(__file__).resolve().parent.parent
AREAS=[
 ('Краснодарский край','Краснодар','krasnodar',(44.99,38.85,45.17,39.2),36),
 ('Ростовская область','Ростов-на-Дону','rostov-na-donu',(47.16,39.57,47.33,39.86),24),
 ('Республика Татарстан','Казань','kazan',(55.70,49.00,55.88,49.28),24),
]
NOW=datetime.now(timezone.utc).isoformat()
ALIASES={'rosneft':'роснефть','lukoil':'лукойл','gazpromneft':'газпромнефть','gazprom':'газпром','teboil':'teboil','татнефть':'татнефть','tatneft':'татнефть'}
def norm(text):
 text=text.lower().replace('ё','е').replace('teboil','тебойл')
 text=re.sub(r'\b(улица|ул|имени|им|корпус|корп|краснодарский|край|россия|краснодар|ростов|область|дон|казань|республика|татарстан)\b',' ',text)
 return set(re.findall(r'[а-яa-z]+|\d+(?:[/к]\d+)?',text))
def brand(s):
 raw=s.get('name') or s.get('brand') or ''
 for key,value in ALIASES.items():
  if key in raw.lower():return value
 for value in ALIASES.values():
  if value in raw.lower():return value
 return raw.lower().strip()
def house(address):
 text=address.lower().replace('ё','е')
 text=re.sub(r'\b(?:корпус|корп\.?)\s*','к',text)
 text=re.sub(r'(\d)\s+к\s*(\d)',r'\1к\2',text)
 parts=re.findall(r'\d+(?:[/к]\d+)?[а-яa-z]?',text)
 parts=[p for p in parts if len(re.sub(r'\D','',p))<6]
 return parts[-1].translate(str.maketrans({'a':'а','b':'в','c':'с','e':'е','k':'к'})) if parts else None
def match(station,rows):
 tokens=norm(station.get('addr',''));nums={t for t in tokens if t[0].isdigit()}
 if not re.search(r'\d+(?:\s*к\s*\d+|/\d+)?[а-яa-z]?\s*$',station.get('addr','').lower()):return None
 address_house=house(station.get('addr',''))
 if not nums or not address_house:return None
 candidates=[]
 for row in rows:
  if brand(station)!=brand(row.get('external_brand') or {}):continue
  if address_house!=house(row['address']):continue
  other=norm(row['address']);othernums={t for t in other if t[0].isdigit() and len(t)<6}
  streets={t for t in tokens.intersection(other) if not t[0].isdigit() and len(t)>3}
  if streets:candidates.append((len(streets),row))
 candidates.sort(key=lambda x:x[0],reverse=True)
 if candidates and (len(candidates)==1 or candidates[0][0]>candidates[1][0]):return candidates[0][1]
 return None
def petrol(city):
 url='https://www.petrolplus.ru/fuelstations/'+city+'/'
 path=ROOT/'research'/('petrolplus-'+city+'.html')
 if not path.exists():
  r=requests.get(url,timeout=25);r.raise_for_status();path.write_bytes(r.content)
 soup=BeautifulSoup(path.read_bytes(),'html.parser');raw=soup.select_one('#__NUXT_DATA__')
 if not raw:return [],url
 a=json.loads(raw.text)
 def dec(i):
  if i<0:return None
  x=a[i]
  if isinstance(x,dict):return {k:dec(v) for k,v in x.items()}
  if isinstance(x,list):return [dec(v) for v in x]
  return x
 candidates=[(i,x) for i,x in enumerate(a) if isinstance(x,dict) and 'data' in x and 'meta' in x]
 for i,x in candidates:
  rows=dec(x['data'])
  if isinstance(rows,list) and len(rows)>20 and all(isinstance(r,dict) and 'fuel_prices' in r for r in rows):return rows,url
 return [],url

def detail(task):
 station,region,city,quote,url=task
 try:
  r=requests.get('https://benzas.ru/api/station/'+station['osm_id']+'/insight',timeout=20);r.raise_for_status();data=r.json()
  if (data.get('region') or {}).get('name')!=region:return None
  grades={'92':'ai92','95':'ai95','98':'ai98','100':'ai98','ДТ':'diesel'};prices={}
  for grade,p in (data.get('prices') or {}).items():
   if grade in grades and isinstance(p.get('price'),(int,float)):
    prices[grades[grade]]={'price':p['price'],'observedAt':p.get('at'),'retrievedAt':NOW,'source':'Бензас','url':'https://benzas.ru/','grade':grade,'stale':bool(p.get('stale'))}
  if quote:
   for row in quote.get('fuel_prices',[]):
    key={'Аи-92':'ai92','Аи-95':'ai95','Аи-98':'ai98','ДТ':'diesel','ДТ Летнее':'diesel'}.get(row['fuel'])
    if key and key not in prices and isinstance(row.get('price'),(int,float)):
     prices[key]={'price':row['price'],'observedAt':None,'retrievedAt':NOW,'source':'ПетролПлюс','url':url,'grade':row['fuel'],'stale':False,'referenceAddress':quote['address']}
  time.sleep(.2)
  return {'id':station['osm_id'],'name':station.get('name') or station.get('brand') or 'АЗС','brand':brand(station),'address':station.get('addr') or (quote or {}).get('address') or 'Адрес не опубликован','lat':station['lat'],'lon':station['lon'],'region':region,'city':city,'prices':prices,'coordinateSource':'https://benzas.ru/','retrievedAt':NOW}
 except (requests.RequestException,ValueError):return None

def main():
 tasks=[]
 for region,city,slug,bbox,limit in AREAS:
  try:
   rows,url=petrol(slug)
   params=dict(zip(['lat1','lon1','lat2','lon2'],bbox));r=requests.get('https://benzas.ru/api/stations',params=params,timeout=25);r.raise_for_status();stations=r.json()
   ranked=[(s,match(s,rows)) for s in stations]
   ranked.sort(key=lambda pair:(pair[1] is not None,bool(pair[0].get('addr'))),reverse=True)
   tasks.extend((s,region,city,q,url) for s,q in ranked[:limit])
   print(city,len(stations),'available,',min(limit,len(ranked)),'selected',flush=True)
  except (requests.RequestException,ValueError) as e:print(city,'unavailable',type(e).__name__,flush=True)
 result=[]
 with futures.ThreadPoolExecutor(max_workers=3) as pool:
  for i,row in enumerate(pool.map(detail,tasks)):
   if row:result.append(row)
   if (i+1)%15==0:print('Processed',i+1,'of',len(tasks),flush=True)
 if not result:raise SystemExit('No verified stations; existing snapshot unchanged')
 out={'retrievedAt':NOW,'stations':result,'scope':'Загруженные АЗС в указанных городах; не полное покрытие регионов. Дата получения не является датой обновления цены.'}
 (ROOT/'src/stations.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
 print('Saved',len(result),'stations,',sum(bool(s['prices']) for s in result),'with quotes',flush=True)
if __name__=='__main__':main()
