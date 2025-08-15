"use client";

import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Id } from '../../../../convex/_generated/dataModel';

export default function MaterialsPageClient({ projectId }: { projectId: Id<'projects'> }) {
  const [mode, setMode] = useState<'materials'|'works'>('materials');
  const [stageType, setStageType] = useState<'demolition' | 'installation' | 'measurement' | 'electrical' | 'plumbing' | 'finishing' | 'materials'>('demolition');
  const materials = useQuery(api.materials.listProjectMaterials, { projectId, stageType });
  const works = useQuery(api.works?.listProjectWorks as never, { projectId, stageType } as never);
  const updateMat = useMutation(api.materials.upsertProjectMaterial);
  const updateWork = useMutation(api.works?.upsertProjectWork as never);
  type Row = { _id?: string; name: string; consumptionPerUnit: number; purchasePrice: number; sellPrice: number; unit?: string };
  type UpsertPayload = { id?: string; projectId: Id<'projects'>; stageType: typeof stageType; name: string; consumptionPerUnit: number; purchasePrice: number; sellPrice: number; unit?: string };
  const rows: Row[] = (mode==='materials' ? (materials ?? []) : ((works as unknown as Row[]) ?? []));
  const updateMaterialFn = updateMat as unknown as (args: UpsertPayload) => Promise<unknown>;
  const updateWorkFn = updateWork as unknown as (args: UpsertPayload) => Promise<unknown>;
  const update = mode==='materials' ? updateMaterialFn : updateWorkFn;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">{mode==='materials'?'Материалы проекта':'Работы проекта'}</h2>
        <div className="flex items-center gap-2">
          <button className={`px-2 py-1 text-xs rounded border ${mode==='materials'?'bg-blue-50 border-blue-200 text-blue-700':'bg-white border-gray-200 text-gray-700'}`} onClick={()=>setMode('materials')}>Материалы</button>
          <button className={`px-2 py-1 text-xs rounded border ${mode==='works'?'bg-blue-50 border-blue-200 text-blue-700':'bg-white border-gray-200 text-gray-700'}`} onClick={()=>setMode('works')}>Работы</button>
        </div>
        <select value={stageType} onChange={(e) => setStageType(e.target.value as typeof stageType)} className="border border-gray-300 rounded-md px-2 py-1 text-sm">
          <option value="demolition">Демонтаж</option>
          <option value="installation">Монтаж</option>
          <option value="measurement">Калибровка</option>
          <option value="electrical">Электрика</option>
          <option value="plumbing">Сантехника</option>
          <option value="finishing">Отделка</option>
          <option value="materials">Материалы</option>
        </select>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left p-2">Название</th>
              <th className="text-left p-2">Расход/ед.</th>
              <th className="text-left p-2">Ед. измерения</th>
              <th className="text-left p-2">Закупка</th>
              <th className="text-left p-2">Реализация</th>
              <th className="text-right p-2">Действия</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row._id} className="border-t">
                <td className="p-2">
                  <input defaultValue={row.name} onBlur={e => update({ id: row._id, projectId, stageType, name: e.target.value, consumptionPerUnit: row.consumptionPerUnit, purchasePrice: row.purchasePrice, sellPrice: row.sellPrice, unit: row.unit })} className="w-full border rounded px-2 py-1" />
                </td>
                <td className="p-2">
                  <input type="number" step="0.0001" defaultValue={row.consumptionPerUnit} onBlur={e => update({ id: row._id, projectId, stageType, name: row.name, consumptionPerUnit: parseFloat(e.target.value || '0'), purchasePrice: row.purchasePrice, sellPrice: row.sellPrice, unit: row.unit })} className="w-full border rounded px-2 py-1" />
                </td>
                <td className="p-2">
                  <input defaultValue={row.unit || ''} onBlur={e => update({ id: row._id, projectId, stageType, name: row.name, consumptionPerUnit: row.consumptionPerUnit, purchasePrice: row.purchasePrice, sellPrice: row.sellPrice, unit: e.target.value || undefined })} className="w-full border rounded px-2 py-1" />
                </td>
                <td className="p-2">
                  <input type="number" step="0.01" defaultValue={row.purchasePrice} onBlur={e => update({ id: row._id, projectId, stageType, name: row.name, consumptionPerUnit: row.consumptionPerUnit, purchasePrice: parseFloat(e.target.value || '0'), sellPrice: row.sellPrice, unit: row.unit })} className="w-full border rounded px-2 py-1" />
                </td>
                <td className="p-2">
                  <input type="number" step="0.01" defaultValue={row.sellPrice} onBlur={e => update({ id: row._id, projectId, stageType, name: row.name, consumptionPerUnit: row.consumptionPerUnit, purchasePrice: row.purchasePrice, sellPrice: parseFloat(e.target.value || '0'), unit: row.unit })} className="w-full border rounded px-2 py-1" />
                </td>
                <td className="p-2 text-right">
                  <button className="text-blue-600 hover:underline" onClick={() => update({ projectId, stageType, name: mode==='materials'?'Новый материал':'Новая работа', consumptionPerUnit: 0, purchasePrice: 0, sellPrice: 0 })}>Добавить</button>
                </td>
              </tr>
            ))}
            {(rows.length === 0) && (
              <tr><td colSpan={6} className="p-6 text-center text-gray-500">Нет {mode==='materials'?'материалов':'работ'}. Добавьте первую запись.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

