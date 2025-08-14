"use client";
import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";

export default function OpeningMaterialsPage() {
  const [active, setActive] = useState<'door'|'window'|'opening'>('opening');
  const list = useQuery(api.rooms.listOpeningMaterials, { openingType: active });
  const upsert = useMutation(api.rooms.upsertOpeningMaterial);
  const [form, setForm] = useState({ name: "", basis: 'opening_m2' as 'opening_m2'|'per_opening', consumptionPerUnit: "", purchasePrice: "", sellPrice: "", unit: "" });
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Материалы дверей, окон и проёмов</h1>
      <div className="flex gap-2 mb-4">
        {(['opening','door','window'] as const).map(t => (
          <button key={t} className={`px-3 py-1.5 rounded border ${active===t?'bg-gray-900 text-white':'bg-white'}`} onClick={()=>setActive(t)}>
            {t==='opening'?'Проём':t==='door'?'Дверь':'Окно'}
          </button>
        ))}
      </div>
      <div className="bg-white border rounded-lg p-4 mb-4">
        <div className="grid grid-cols-6 gap-2 mb-2">
          <input className="border rounded px-2 py-1" placeholder="Материал" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} />
          <select className="border rounded px-2 py-1" value={form.basis} onChange={e=>setForm({...form, basis: e.target.value as any})}>
            <option value="opening_m2">Расход на 1 м² проёма</option>
            <option value="per_opening">Кол-во на 1 проём (шт/проём)</option>
          </select>
          <input className="border rounded px-2 py-1" placeholder={form.basis==='opening_m2'?"Расход/м² проёма":"Кол-во/проём"} value={form.consumptionPerUnit} onChange={e=>setForm({...form, consumptionPerUnit:e.target.value})} />
          <input className="border rounded px-2 py-1" placeholder="Ед." value={form.unit} onChange={e=>setForm({...form, unit:e.target.value})} />
          <input className="border rounded px-2 py-1" placeholder="Закупка" value={form.purchasePrice} onChange={e=>setForm({...form, purchasePrice:e.target.value})} />
          <input className="border rounded px-2 py-1" placeholder="Реализация" value={form.sellPrice} onChange={e=>setForm({...form, sellPrice:e.target.value})} />
        </div>
        <button className="bg-emerald-600 text-white px-3 py-1 rounded" onClick={()=>{
          if(!form.name) return;
          upsert({ openingType: active, name: form.name, basis: form.basis, consumptionPerUnit: Number(form.consumptionPerUnit||0), purchasePrice: Number(form.purchasePrice||0), sellPrice: Number(form.sellPrice||0), unit: form.unit||undefined });
          setForm({ name:"", basis:'opening_m2', consumptionPerUnit:"", purchasePrice:"", sellPrice:"", unit:"" });
        }}>Добавить</button>
      </div>
      <div className="rounded border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left p-2">Материал</th>
              <th className="text-left p-2">Основа</th>
              <th className="text-left p-2">Норма</th>
              <th className="text-left p-2">Ед.</th>
              <th className="text-left p-2">Закупка</th>
              <th className="text-left p-2">Реализация</th>
            </tr>
          </thead>
          <tbody>
            {(list??[]).map((m:any, idx:number)=>(
              <tr key={m._id} className={idx%2===0?'bg-white':'bg-gray-50'}>
                <td className="p-2">{m.name}</td>
                <td className="p-2">{m.basis==='per_opening'?'На проём':'На м² проёма'}</td>
                <td className="p-2">{m.consumptionPerUnit}</td>
                <td className="p-2">{m.unit||'-'}</td>
                <td className="p-2">{m.purchasePrice}</td>
                <td className="p-2">{m.sellPrice}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


