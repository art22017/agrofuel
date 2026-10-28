from pathlib import Path
import re,json
p=Path('src/styles.css');s=p.read_text(encoding='utf-8')
# Lift historic literals into a single theme; keep the existing brand face.
colors={}
def color(m):
 v=m[0].lower(); key=colors.setdefault(v,'--tone-'+str(len(colors)+1));return 'var('+key+')'
# Do not rewrite data URLs, font declarations or existing token blocks.
parts=re.split(r'(:root\s*\{[^}]*\})',s,flags=re.S)
for i in range(0,len(parts),2):
 parts[i]=re.sub(r'url\([^)]*\)|#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)',lambda m:m[0] if m[0].startswith('url(') else color(m),parts[i])
s=''.join(parts)
s=s.replace('Ubuntu, Arial, sans-serif','var(--font-body)').replace('Ubuntu,Arial,sans-serif','var(--font-body)')
# Off-scale font sizes collapse to the standard, readable scale.
scale=[12,14,16,18,20,24,30,36,48,60,72,96,128]
s=re.sub(r'font-size:\s*(\d+(?:\.\d+)?)px',lambda m:'font-size: '+str(max([n for n in scale if n<=float(m[1])] or [12]))+'px',s)
s=s.replace('100vw','100%').replace('transition: all','transition: opacity')
s=re.sub(r'\b(ease-in-out|ease-out|ease-in|ease|linear)(?=[;, ])','cubic-bezier(0.22,1,0.36,1)',s)
# One spacing scale, also used in the old rules so later edits cannot drift.
spaces={2:'3xs',4:'2xs',8:'xs',12:'sm',16:'md',24:'lg',32:'32',40:'xl',48:'48',64:'2xl',80:'80',96:'3xl'}
def spacing(m):
 key,val=m[1],m[2]
 def sub(x):
  n=float(x[1]);near=min(spaces,key=lambda a:abs(a-n));return ('-' if n<0 else '')+'var(--space-'+spaces[near]+')'
 val=re.sub(r'(?<![\w-])(-?\d+(?:\.\d+)?)px',sub,val)
 return key+':'+val+';'
s=re.sub(r'(padding(?:-[\w]+)?|margin(?:-[\w]+)?|gap|column-gap|row-gap)\s*:([^;{}]+);',spacing,s)
s='''/* Hallmark · shape: app screen · genre: modern-minimal · theme: brand · redesign: restyle
 * brand: RSHB digital (source research/rshb-digital.css) · display: Ubuntu · body: Ubuntu
 * nav: kept · signature: regional station map · states: loading, empty, error, full
 * axes: dark/Ubuntu/green · posture: restrained · contrast: reviewed · v2.0.0 */
/* Hallmark · pre-emit critique: P4 H4 E3 S5 R4 V3 · weakest: E, unified control geometry and removed layered decoration */
@import url("./tokens.css");
@import url("./base.css");
'''+s
s+='\n:root {\n'+''.join(k+': '+v+';\n' for v,k in colors.items())+'}\n'
s+='''
/* Shared workbench finish. The map and figures carry the screen. */
html, body { overflow-x: clip; }
body { font-family: var(--font-body); }
h1,h2,h3 { text-wrap: balance; overflow-wrap: break-word; min-width: 0; font-weight: 500; color: var(--ink); }
p { text-wrap: pretty; }
:root { --heading: 24px; --number: 48px; --radius: 16px; }
.product-header { max-width: 1440px; margin: auto; position: relative; top: auto; padding: var(--space-lg) var(--space-32); background: var(--bg); }
.workspace-main { width: 100%; max-width: 1384px; margin: 0 auto; }
.workspace > .navigation { top: 0; }
.search-panel { background: var(--panel); box-shadow: none; border-color: var(--line); max-width: 1120px; padding: var(--space-2xl); }
.search-panel::before,.search-panel::after,.bento-rim,.fill-symbol { display: none; }
.search-panel h1 { font-size: 48px; line-height: 1; letter-spacing: -0.02em; max-width: 680px; }
.search-explanation { max-width: 680px; margin-block: var(--space-lg) var(--space-32); }
.search-fields input,.search-fields select,.region-field input { background: var(--bg); border-color: var(--line); }
.surface,.find-fuel-card,.price-story,.fill-card { background: var(--panel); color: var(--ink); border: 1px solid var(--line); border-radius: 16px; box-shadow: none; }
.fill-card { padding: var(--space-32); }
.fill-card p,.fill-card .number-stepper-label,.fill-estimate > span,.fleet-link { color: var(--muted); }
.fill-estimate > button,.number-stepper-control,.number-stepper-control input { color: var(--ink); }
.fill-card .fill-action { background: var(--accent); color: var(--accent-ink); border-color: var(--accent); }
.number-stepper-control { background: var(--bg); border-color: var(--line); border-radius: 8px; }
.number-stepper-control > button { color: var(--ink); background: var(--panel-hover); }
.find-fuel-intro { padding: var(--space-32); gap: var(--space-md); }
.find-fuel-intro h2,.card-heading h2 { font-size: 24px; line-height: 32px; margin: 0; }
.find-fuel-intro .button { margin-top: var(--space-xs); width: auto; }
.find-fuel-intro p { margin: 0; }
.farm-layout { gap: var(--space-lg); }
.farm-layout .price-story { padding: var(--space-32); }
.provider-prices { grid-column: 1/-1; padding: var(--space-32); display: grid; grid-template-columns: minmax(0,1fr) minmax(0,2fr); gap: var(--space-32); }
.provider-prices h2 { font-size: 24px; line-height: 32px; margin-bottom: var(--space-xs); }
.provider-prices p,.provider-row small { color: var(--muted); font-size: 14px; line-height: 20px; }
.provider-rows { display: flex; gap: var(--space-lg); }
.provider-row { flex: 1; display: flex; align-items: center; justify-content: space-between; text-align: left; gap: var(--space-lg); padding: var(--space-md); border-radius: 8px; }
.provider-row:hover { background: var(--panel-hover); }
.provider-row strong,.provider-row small { display: block; }
.provider-row b { font-size: 30px; line-height: 36px; font-weight: 500; }
.provider-detail > strong { font-size: 48px; }
.provider-detail { display: grid; gap: var(--space-lg); }
button,input,select,a { transition: opacity 300ms cubic-bezier(0.22,1,0.36,1), transform 500ms cubic-bezier(0.22,1,0.36,1); }
button:active:not(:disabled),.button:active { transform: scale(.98); }
button:disabled,input:disabled,select:disabled { cursor: not-allowed; color: var(--muted); background: var(--panel-hover); opacity: .6; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; transition: none; }
.hero-number,.result-number,.provider-row b { font-variant-numeric: tabular-nums; }
@media(max-width:800px) {
 .search-panel { padding: var(--space-lg); }
 .search-panel h1 { font-size: 36px; line-height: 40px; }
 .provider-prices { grid-template-columns: minmax(0,1fr); padding: var(--space-lg); gap: var(--space-md); }
 .provider-rows { flex-direction: column; gap: var(--space-xs); }
 .fill-card,.farm-layout .price-story,.find-fuel-intro { padding: var(--space-lg); }
}
@media(prefers-reduced-motion:reduce) { *,*::before,*::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; } }
'''
p.write_text(s,encoding='utf-8')
p=Path('src/tokens.css');s=p.read_text();s=s.replace('FILL ME','Ubuntu')
s+='''\n:root {
 --font-body: Ubuntu, sans-serif; --font-display: var(--font-body);
 --color-paper: #141b25; --color-paper-2: #1d2531; --color-paper-3: #252f3d;
 --color-ink: #dbe2f9; --color-ink-2: #a7b1c6; --color-muted: #a7b1c6; --color-rule: #343f50;
 --color-accent: #87df50; --color-accent-ink: #14200f; --color-focus: #87df50;
 --space-32: 32px; --space-48: 48px; --space-80: 80px;
 --text-lg: 1.125rem; --text-xl: 1.25rem; --text-2xl: 1.5rem; --text-3xl: 1.875rem;
 --ease-out: cubic-bezier(0.22,1,0.36,1); --dur-micro: 300ms; --dur-short: 300ms;
}
''';p.write_text(s)
Path('design.md').write_text('''# АгроТопливо
Рабочий сервис, app screen. Сохраняются все маршруты и обработчики.
Брендовый приоритет: Ubuntu и палитра из research/rshb-digital.css, заданные пользователем раньше. Это осознанное исключение из списка шрифтов и чёрных поверхностей Landing Page Design.
Без рекламных слоганов, секции tagline и искусственных доказательств. Зелёный обозначает действие и выбор. Панели плоские, один уровень вложенности. 14/16/24/30/36/48 px. Отступы 4/8/12/16/24/32/40/48/64. Иконки Phosphor.
Данные: официальная средняя, независимые индексы и цены станций показаны раздельно. Нет синтетических цен или истории.
''',encoding='utf-8')
Path('.hallmark/preflight.json').write_text(json.dumps({'scope':'app','preserve':['routes','handlers','brand Ubuntu','regional map'],'files':['src/styles.css:1','src/ui.tsx:1','src/FarmOverview.tsx:1','src/ProviderPrices.tsx:1'],'introduced':['Phosphor','provider index panel','shared scale']},indent=2))
