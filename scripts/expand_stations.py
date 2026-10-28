"""Add verified station/price matches to an existing snapshot; never discard old rows."""
import concurrent.futures as futures
from pathlib import Path
import json
from collections import defaultdict
import requests
from capture_stations import petrol, match, detail, NOW

ROOT = Path(__file__).resolve().parent.parent
AREAS = [
 ('Самарская область','Самара','samara',(53.12,49.99,53.36,50.34)),
 ('Воронежская область','Воронеж','voronezh',(51.55,39.05,51.78,39.34)),
 ('Волгоградская область','Волгоград','volgograd',(48.53,44.31,48.86,44.76)),
 ('Ставропольский край','Ставрополь','stavropol',(44.96,41.80,45.12,42.10)),
]
path=ROOT/'src/stations.json'
snapshot=json.loads(path.read_text(encoding='utf-8'))
old={str(row['id']):row for row in snapshot['stations']}
tasks=[]
for region,city,slug,bbox in AREAS:
 try:
  rows,url=petrol(slug)
  params=dict(zip(['lat1','lon1','lat2','lon2'],bbox))
  response=requests.get('https://benzas.ru/api/stations',params=params,timeout=25);response.raise_for_status()
  ranked=[(s,match(s,rows)) for s in response.json()]
  ranked.sort(key=lambda pair:(pair[1] is not None,bool(pair[0].get('addr'))),reverse=True)
  picked=[pair for pair in ranked if pair[1] is not None][:25]
  picked += [pair for pair in ranked if pair[1] is None and pair[0].get('addr')][:10]
  tasks.extend((station,region,city,quote,url) for station,quote in picked if str(station['osm_id']) not in old)
  print(city, 'matched',sum(1 for _,q in picked if q),'selected',len(picked),flush=True)
 except (requests.RequestException,ValueError) as error:
  print(city,'unavailable',type(error).__name__,flush=True)
results=[]
with futures.ThreadPoolExecutor(max_workers=3) as pool:
 for i,row in enumerate(pool.map(detail,tasks)):
  if row: results.append(row)
  if (i+1)%15 == 0: print('Processed',i+1,'of',len(tasks),flush=True)
for row in results: old[str(row['id'])]=row
if not results: raise SystemExit('No verified new stations; existing snapshot unchanged')
# One external address matching multiple distinct map entries is ambiguous.
# Preserve coordinates, but discard the shared quote instead of assigning it twice.
references=defaultdict(set)
for station in old.values():
 for quote in station['prices'].values():
  if quote.get('referenceAddress'):
   references[(station['city'],quote['referenceAddress'])].add(station['id'])
ambiguous={key for key, ids in references.items() if len(ids)>1}
for station in old.values():
 station['prices']={fuel:quote for fuel,quote in station['prices'].items()
   if not quote.get('referenceAddress') or (station['city'],quote['referenceAddress']) not in ambiguous}
snapshot['stations']=list(old.values())
snapshot['retrievedAt']=NOW
path.write_text(json.dumps(snapshot,ensure_ascii=False,indent=2),encoding='utf-8')
print('Added',len(results),'stations,',sum(bool(s['prices']) for s in results),'with quotes',flush=True)
