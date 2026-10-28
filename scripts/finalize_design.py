from pathlib import Path
import re
p=Path('src/styles.css');s=p.read_text(encoding='utf-8');s=re.sub(r'(?:radial|linear)-gradient\([^;]+(?=;)', 'var(--panel)',s) # data legend below uses actual tokens per cell
s=s.replace('position: sticky;','position: relative;')
s=s.replace('.number-stepper-control > button:disabled { opacity: .35; cursor: not-allowed; }','.number-stepper-control > button:disabled { opacity: .35; cursor: not-allowed; color: var(--muted); background: var(--panel-hover); }')
s=re.sub(r'(\.number-stepper-control\s*>\s*button:disabled\s*\{)([^}]+)',lambda m:m[1]+m[2]+'color: var(--muted); background: var(--panel-hover); cursor: not-allowed;',s)
s+='\n.hex-gradient { background: var(--accent); }\n* { font-variant-numeric: tabular-nums; }\n'
p.write_text(s,encoding='utf-8')
for name in ['FarmOverview.tsx','StationMap.tsx','Workspace.tsx']:
 p=Path('src')/name;s=p.read_text(encoding='utf-8');s=s.replace('В карточке — адрес, цена и расчёт заправки.','В карточке доступны адрес, цена и расчёт заправки.').replace('Не знаю объём — выбрать технику','Выбрать технику').replace('— открытая карта Бензас.','из открытой карты Бензас.').replace('— ПетролПлюс.','из ПетролПлюс.').replace('— geoBoundaries','из geoBoundaries');p.write_text(s,encoding='utf-8')
for name in ['src/Trend.tsx','src/vendor/21st/PriceComparison.tsx']:
 p=Path(name);s=p.read_text(encoding='utf-8').replace('background: "#222b37"','background: "var(--panel)"').replace('background:"#222b37"','background:"var(--panel)"');p.write_text(s,encoding='utf-8')
