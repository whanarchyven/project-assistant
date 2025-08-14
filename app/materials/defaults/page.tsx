"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';

type StageId = 'measurement' | 'installation' | 'demolition' | 'markup' | 'electrical' | 'plumbing' | 'finishing' | 'materials';

const STAGE_META: Record<StageId, { title: string; description: string; binding: string; triggers?: Array<{ id: 'room'|'door'|'window'; name: string }> }> = {
  measurement: { title: 'Калибровка', description: 'Шаблон калибровки масштаба', binding: 'Привязка не требуется' },
  demolition: { title: 'Демонтаж', description: 'Материалы, расходуемые при демонтаже', binding: 'Привязка: метр демонтируемой стены' },
  installation: { title: 'Монтаж', description: 'Материалы для монтажных работ', binding: 'Привязка: метр возводимой стены' },
  markup: { title: 'Разметка', description: 'Комнаты, двери, окна', binding: '', triggers: [
    { id: 'room', name: 'Комнаты' },
    { id: 'door', name: 'Двери' },
    { id: 'window', name: 'Окна' },
  ]},
  electrical: { title: 'Электрика', description: 'Материалы для электромонтажных работ', binding: 'Привязка: будет уточнено' },
  plumbing: { title: 'Сантехника', description: 'Материалы для сантехнических работ', binding: 'Привязка: будет уточнено' },
  finishing: { title: 'Отделка', description: 'Материалы для отделочных работ', binding: 'Привязка: будет уточнено' },
  materials: { title: 'Материалы', description: 'Прочие материалы', binding: 'Привязка: будет уточнено' },
};

export default function MaterialsDefaultsPage() {
  const [stageType, setStageType] = useState<StageId>('demolition');
  const rows = useQuery(api.materials.listDefaults, { stageType });
  const upsert = useMutation(api.materials.upsertDefault);
  const [triggerTab, setTriggerTab] = useState<'room'|'door'|'window'>('room');

  const meta = STAGE_META[stageType];

  const stages: StageId[] = ['measurement','demolition','installation','markup','electrical','plumbing','finishing','materials'];

  return (
    <div className="max-w-6xl mx-auto px-6 py-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-gray-900">Стандартные материалы</h1>
      </div>

      {/* Табы этапов */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="px-4 pt-3">
          <div className="flex space-x-1 overflow-x-auto">
            {stages.map((s) => (
              <button
                key={s}
                className={`flex-shrink-0 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  stageType === s ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
                onClick={() => setStageType(s)}
                title={STAGE_META[s].description}
              >
                {STAGE_META[s].title}
              </button>
            ))}
          </div>
        </div>

        {/* Описание и действия */}
        <div className="px-4 pb-3">
          <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-3 flex items-center justify-between">
            <div>
              <div className="text-gray-900 font-medium">{meta.title}</div>
              <div className="text-sm text-gray-600">{meta.description}</div>
              <div className="text-sm text-gray-700 mt-1">
                <span className="font-medium"></span>
                {meta.binding}
              </div>
            </div>
            <div>
              {stageType !== 'markup' && (
                <button
                  onClick={() => upsert({ stageType, name: 'Новый материал', consumptionPerUnit: 0, purchasePrice: 0, sellPrice: 0, triggerType: meta.triggers ? triggerTab : undefined })}
                  className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700"
                >
                  + Добавить материал
                </button>
              )}
            </div>
          </div>
          {meta.triggers && stageType !== 'markup' && (
            <div className="mt-3 flex items-center gap-2">
              {meta.triggers.map(t => (
                <button key={t.id} onClick={() => setTriggerTab(t.id)} className={`px-3 py-1.5 text-xs rounded-md border ${triggerTab===t.id?'bg-blue-50 border-blue-200 text-blue-700':'bg-white border-gray-200 text-gray-700'}`}>{t.name}</button>
              ))}
            </div>
          )}
        </div>

        {/* Содержимое вкладки */}
        {stageType === 'markup' ? (
          <div className="px-4 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Link href="/rooms/types" className="block rounded-md border border-gray-200 p-4 hover:bg-gray-50">
                <div className="text-sm font-medium text-gray-900">Типы комнат</div>
                <div className="text-xs text-gray-600 mt-1">Управление типами комнат и их материалами</div>
              </Link>
              <Link href="/openings/materials" className="block rounded-md border border-gray-200 p-4 hover:bg-gray-50">
                <div className="text-sm font-medium text-gray-900">Проёмы / Двери / Окна</div>
                <div className="text-xs text-gray-600 mt-1">Материалы проёмов, дверей и окон</div>
              </Link>
            </div>
          </div>
        ) : (
          <div className="px-4 pb-4">
            <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left p-2">Название</th>
                    <th className="text-left p-2">Расход/ед.</th>
                    <th className="text-left p-2">Ед. измерения</th>
                    <th className="text-left p-2">Закупка</th>
                    <th className="text-left p-2">Реализация</th>
                  </tr>
                </thead>
                <tbody>
                  {(rows ?? []).filter(r => !meta.triggers || (r as { triggerType?: 'room'|'door'|'window' }).triggerType === triggerTab).map((row, idx) => (
                    <tr key={row._id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="p-2 align-top">
                        <input defaultValue={row.name} onBlur={e => upsert({ id: row._id, stageType, name: e.target.value, consumptionPerUnit: row.consumptionPerUnit, purchasePrice: row.purchasePrice, sellPrice: row.sellPrice, unit: row.unit, triggerType: (row as { triggerType?: 'room'|'door'|'window' }).triggerType })} className="w-full border rounded px-2 py-1" />
                      </td>
                      <td className="p-2 align-top">
                        <input type="number" step="0.0001" defaultValue={row.consumptionPerUnit} onBlur={e => upsert({ id: row._id, stageType, name: row.name, consumptionPerUnit: parseFloat(e.target.value || '0'), purchasePrice: row.purchasePrice, sellPrice: row.sellPrice, unit: row.unit, triggerType: (row as { triggerType?: 'room'|'door'|'window' }).triggerType })} className="w-full border rounded px-2 py-1" />
                      </td>
                      <td className="p-2 align-top">
                        <input defaultValue={row.unit || ''} onBlur={e => upsert({ id: row._id, stageType, name: row.name, consumptionPerUnit: row.consumptionPerUnit, purchasePrice: row.purchasePrice, sellPrice: row.sellPrice, unit: e.target.value || undefined, triggerType: (row as { triggerType?: 'room'|'door'|'window' }).triggerType })} className="w-full border rounded px-2 py-1" />
                      </td>
                      <td className="p-2 align-top">
                        <input type="number" step="0.01" defaultValue={row.purchasePrice} onBlur={e => upsert({ id: row._id, stageType, name: row.name, consumptionPerUnit: row.consumptionPerUnit, purchasePrice: parseFloat(e.target.value || '0'), sellPrice: row.sellPrice, unit: row.unit, triggerType: (row as { triggerType?: 'room'|'door'|'window' }).triggerType })} className="w-full border rounded px-2 py-1" />
                      </td>
                      <td className="p-2 align-top">
                        <input type="number" step="0.01" defaultValue={row.sellPrice} onBlur={e => upsert({ id: row._id, stageType, name: row.name, consumptionPerUnit: row.consumptionPerUnit, purchasePrice: row.purchasePrice, sellPrice: parseFloat(e.target.value || '0'), unit: row.unit, triggerType: (row as { triggerType?: 'room'|'door'|'window' }).triggerType })} className="w-full border rounded px-2 py-1" />
                      </td>
                    </tr>
                  ))}
                  {(!rows || rows.length === 0) && (
                    <tr><td colSpan={5} className="p-6 text-center text-gray-500">Нет материалов. Нажмите «Добавить материал» выше.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

