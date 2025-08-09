"use client";

import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Id } from '../../../../convex/_generated/dataModel';

export default function MaterialsPageClient({ projectId }: { projectId: Id<'projects'> }) {
  const [stageType, setStageType] = useState<'demolition' | 'installation' | 'measurement' | 'electrical' | 'plumbing' | 'finishing' | 'materials'>('demolition');
  const materials = useQuery(api.materials.listProjectMaterials, { projectId, stageType });
  const update = useMutation(api.materials.upsertProjectMaterial);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Материалы проекта</h2>
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
            {(materials ?? []).map((row) => (
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
                  <button className="text-blue-600 hover:underline" onClick={() => update({ projectId, stageType, name: 'Новый материал', consumptionPerUnit: 0, purchasePrice: 0, sellPrice: 0 })}>Добавить</button>
                </td>
              </tr>
            ))}
            {(!materials || materials.length === 0) && (
              <tr><td colSpan={6} className="p-6 text-center text-gray-500">Нет материалов. Добавьте первый.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

