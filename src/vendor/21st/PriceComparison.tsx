// Adapted from https://21st.dev/@haassiib/components/bar-chart/horizontal
// Original: https://github.com/haassiib/admin-ui-kit — MIT, Copyright (c) 2026 96 Group.
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmt } from "../../data";

type Entry = { key: "region" | "national"; label: string; value?: number };
export function PriceComparison({region, national, onSelect}: {
  region?: number; national?: number; onSelect: (key: Entry["key"]) => void;
}) {
  const entries: Entry[] = [{key:"region",label:"В регионе",value:region},{key:"national",label:"По России",value:national}];
  const data = entries.filter((entry): entry is Entry & {value:number} => entry.value !== undefined);
  return <div className="comparison-21">
    <div className="comparison-21-header">Средняя цена, ₽/л</div>
    {data.length > 0 && <div className="comparison-21-chart" role="img" aria-label="Сравнение средней цены региона и России">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{top:0,right:8,left:0,bottom:0}} barCategoryGap="35%">
          <CartesianGrid vertical horizontal={false} stroke="#3a4956" />
          <XAxis type="number" hide domain={[0,"dataMax"]}/>
          <YAxis type="category" dataKey="label" width={90} tick={{fill:"#b7c2d4",fontSize:14}} axisLine={false} tickLine={false}/>
          <Tooltip cursor={{fill:"#ffffff08"}} contentStyle={{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:10,color:"var(--ink)"}} formatter={(v) => typeof v === "number" ? fmt(v) + " ₽/л" : "—"}/>
          <Bar dataKey="value" name="Цена" maxBarSize={20} radius={[0,5,5,0]} isAnimationActive={false}>
            {data.map((entry) => <Cell key={entry.key} fill={entry.key === "region" ? "#87df50" : "#aeb9d0"}/>)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>}
    <div className="comparison-21-values">{entries.map(entry => <button key={entry.key} onClick={() => onSelect(entry.key)}><span>{entry.label}</span><strong>{entry.value === undefined ? "—" : fmt(entry.value)} ₽/л ↗</strong></button>)}</div>
  </div>;
}
