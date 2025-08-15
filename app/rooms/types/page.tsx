"use client";
import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

export default function RoomTypesPage() {
  const types = useQuery(api.rooms.listRoomTypes);
  const upsertType = useMutation(api.rooms.upsertRoomType);
  const upsertMaterial = useMutation(api.rooms.upsertRoomTypeMaterial);
  const upsertWork = useMutation(api.rooms.upsertRoomTypeWork as never);
  const [name, setName] = useState("");
  const [selectedTypeId, setSelectedTypeId] = useState<Id<'roomTypes'> | null>(null);
  const mats = useQuery(api.rooms.listRoomTypeMaterials, selectedTypeId ? { roomTypeId: selectedTypeId } : "skip");
  const works = useQuery(api.rooms.listRoomTypeWorks as never, selectedTypeId ? ({ roomTypeId: selectedTypeId } as never) : "skip");

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Типы комнат</h1>
      <div className="flex gap-4">
        <div className="w-1/2 bg-white border rounded-lg p-4">
          <div className="flex gap-2 mb-3">
            <input className="border rounded px-3 py-2 w-full" placeholder="Название типа (кухня, ванная...)" value={name} onChange={(e) => setName(e.target.value)} />
            <button className="bg-blue-600 text-white px-4 rounded" onClick={() => { if (name.trim()) upsertType({ name }); setName(""); }}>Создать</button>
          </div>
          <ul className="space-y-2">
            {(types ?? []).map(t => (
              <li key={t._id} className={`p-2 border rounded cursor-pointer ${selectedTypeId === t._id ? 'bg-blue-50 border-blue-200' : ''}`} onClick={() => setSelectedTypeId(t._id as Id<'roomTypes'>)}>
                {t.name}
              </li>
            ))}
          </ul>
        </div>
        <div className="w-1/2 bg-white border rounded-lg p-4">
          <h2 className="font-medium mb-2">Материалы и работы типа</h2>
          {!selectedTypeId ? (
            <div className="text-sm text-gray-500">Выберите тип комнаты слева</div>
          ) : (
            <>
              <TypeMaterials mats={mats ?? []} onCreate={(row) => upsertMaterial({ roomTypeId: selectedTypeId as Id<'roomTypes'>, ...row })} />
              <div className="h-6" />
              <TypeWorks rows={(works ?? []) as Array<{ _id?: string; name: string; basis: 'floor_m2'|'wall_m2'; consumptionPerUnit: number; unit?: string; purchasePrice: number; sellPrice: number }>} onCreate={(row) => upsertWork({ roomTypeId: selectedTypeId as Id<'roomTypes'>, ...row } as never)} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TypeMaterials({ mats, onCreate }: { mats: Array<{ _id?: string; name: string; basis: 'floor_m2'|'wall_m2'; consumptionPerUnit: number; unit?: string; purchasePrice: number; sellPrice: number }>; onCreate: (row: { name: string; basis: 'floor_m2'|'wall_m2'; consumptionPerUnit: number; unit?: string; purchasePrice: number; sellPrice: number }) => void }) {
  const [form, setForm] = useState({ name: "", consumptionPerUnit: "", purchasePrice: "", sellPrice: "", unit: "", basis: "floor_m2" });
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <input className="border rounded px-2 py-1" placeholder="Название" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <select className="border rounded px-2 py-1" value={form.basis} onChange={(e) => setForm({ ...form, basis: e.target.value })}>
          <option value="floor_m2">От площади пола (м²)</option>
          <option value="wall_m2">От площади стен (м²)</option>
        </select>
        <input className="border rounded px-2 py-1" placeholder="Расход/ед." value={form.consumptionPerUnit} onChange={(e) => setForm({ ...form, consumptionPerUnit: e.target.value })} />
        <input className="border rounded px-2 py-1" placeholder="Ед." value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
        <input className="border rounded px-2 py-1" placeholder="Закупка" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} />
        <input className="border rounded px-2 py-1" placeholder="Реализация" value={form.sellPrice} onChange={(e) => setForm({ ...form, sellPrice: e.target.value })} />
      </div>
      <button className="bg-emerald-600 text-white px-3 py-1 rounded" onClick={() => {
        const payload = {
          name: form.name,
          consumptionPerUnit: Number(form.consumptionPerUnit || 0),
          purchasePrice: Number(form.purchasePrice || 0),
          sellPrice: Number(form.sellPrice || 0),
          unit: form.unit || undefined,
           basis: form.basis as 'floor_m2'|'wall_m2',
        };
        onCreate(payload);
        setForm({ name: "", consumptionPerUnit: "", purchasePrice: "", sellPrice: "", unit: "", basis: "floor_m2" });
      }}>Добавить материал</button>
      <div className="border rounded">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left p-2">Материал</th>
              <th className="text-left p-2">Основа</th>
              <th className="text-left p-2">Расход/ед.</th>
              <th className="text-left p-2">Ед.</th>
              <th className="text-left p-2">Закупка</th>
              <th className="text-left p-2">Реализация</th>
            </tr>
          </thead>
          <tbody>
            {mats.map((m, idx: number) => (
              <tr key={m._id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="p-2">{m.name}</td>
                <td className="p-2">{m.basis === 'floor_m2' ? 'Площадь пола' : 'Площадь стен'}</td>
                <td className="p-2">{m.consumptionPerUnit}</td>
                <td className="p-2">{m.unit || '-'}</td>
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

function TypeWorks({ rows, onCreate }: { rows: Array<{ _id?: string; name: string; basis: 'floor_m2'|'wall_m2'; consumptionPerUnit: number; unit?: string; purchasePrice: number; sellPrice: number }>; onCreate: (row: { name: string; basis: 'floor_m2'|'wall_m2'; consumptionPerUnit: number; unit?: string; purchasePrice: number; sellPrice: number }) => void }) {
  const [form, setForm] = useState({ name: "", consumptionPerUnit: "", purchasePrice: "", sellPrice: "", unit: "", basis: "floor_m2" });
  return (
    <div className="space-y-3">
      <div className="text-sm font-medium">Работы</div>
      <div className="grid grid-cols-2 gap-2">
        <input className="border rounded px-2 py-1" placeholder="Название" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <select className="border rounded px-2 py-1" value={form.basis} onChange={(e) => setForm({ ...form, basis: e.target.value })}>
          <option value="floor_m2">От площади пола (м²)</option>
          <option value="wall_m2">От площади стен (м²)</option>
        </select>
        <input className="border rounded px-2 py-1" placeholder="Норма/ед." value={form.consumptionPerUnit} onChange={(e) => setForm({ ...form, consumptionPerUnit: e.target.value })} />
        <input className="border rounded px-2 py-1" placeholder="Ед." value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
        <input className="border rounded px-2 py-1" placeholder="Себестоимость" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} />
        <input className="border rounded px-2 py-1" placeholder="Реализация" value={form.sellPrice} onChange={(e) => setForm({ ...form, sellPrice: e.target.value })} />
      </div>
      <button className="bg-indigo-600 text-white px-3 py-1 rounded" onClick={() => {
        const payload = {
          name: form.name,
          consumptionPerUnit: Number(form.consumptionPerUnit || 0),
          purchasePrice: Number(form.purchasePrice || 0),
          sellPrice: Number(form.sellPrice || 0),
          unit: form.unit || undefined,
          basis: form.basis as 'floor_m2'|'wall_m2',
        };
        onCreate(payload);
        setForm({ name: "", consumptionPerUnit: "", purchasePrice: "", sellPrice: "", unit: "", basis: "floor_m2" });
      }}>Добавить работу</button>
      <div className="border rounded">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left p-2">Работа</th>
              <th className="text-left p-2">Основа</th>
              <th className="text-left p-2">Норма</th>
              <th className="text-left p-2">Ед.</th>
              <th className="text-left p-2">Себестоимость</th>
              <th className="text-left p-2">Реализация</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m, idx: number) => (
              <tr key={m._id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="p-2">{m.name}</td>
                <td className="p-2">{m.basis === 'floor_m2' ? 'Площадь пола' : 'Площадь стен'}</td>
                <td className="p-2">{m.consumptionPerUnit}</td>
                <td className="p-2">{m.unit || '-'}</td>
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


