/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';

type StageId = 'measurement' | 'installation' | 'demolition' | 'markup' | 'baseboards' | 'electrical' | 'plumbing' | 'finishing' | 'materials';

const STAGE_META: Record<StageId, { title: string; description: string; binding: string; triggers?: Array<{ id: 'room'|'door'|'window'|'spotlight'|'bra'|'led'|'outlet'|'switch'; name: string }> }> = {
  measurement: { title: 'Калибровка', description: 'Шаблон калибровки масштаба', binding: 'Привязка не требуется' },
  demolition: { title: 'Демонтаж', description: 'Материалы, расходуемые при демонтаже', binding: 'Привязка: метр демонтируемой стены' },
  installation: { title: 'Монтаж', description: 'Материалы для монтажных работ', binding: 'Привязка: метр возводимой стены' },
  markup: { title: 'Разметка', description: 'Комнаты, двери, окна', binding: '', triggers: [
    { id: 'room', name: 'Комнаты' },
    { id: 'door', name: 'Двери' },
    { id: 'window', name: 'Окна' },
  ]},
  baseboards: { title: 'Плинтуса', description: 'Материалы для плинтусов', binding: 'Привязки: метр длины, количество углов' },
  electrical: { title: 'Электрика', description: 'Материалы для электромонтажных работ', binding: 'Привязка: по объектам электрики', triggers: [
    { id: 'spotlight', name: 'Светильники' },
    { id: 'bra', name: 'Бра' },
    { id: 'led', name: 'LED-ленты' },
    { id: 'outlet', name: 'Розетки' },
    { id: 'switch', name: 'Выключатели' },
  ] },
  plumbing: { title: 'Сантехника', description: 'Материалы для сантехнических работ', binding: 'Привязка: будет уточнено' },
  finishing: { title: 'Отделка', description: 'Материалы для отделочных работ', binding: 'Привязка: будет уточнено' },
  materials: { title: 'Материалы', description: 'Прочие материалы', binding: 'Привязка: будет уточнено' },
};

export default function MaterialsDefaultsPage() {
  const [stageType, setStageType] = useState<StageId>('demolition');
  const normalizedStage: 'measurement' | 'installation' | 'demolition' | 'markup' | 'electrical' | 'plumbing' | 'finishing' | 'materials' = (stageType === 'baseboards' ? 'materials' : stageType);
  const rows = useQuery(api.materials.listDefaults, { stageType: normalizedStage });
  const upsert = useMutation(api.materials.upsertDefault);
  const [triggerTab, setTriggerTab] = useState<'room'|'door'|'window'|'spotlight'|'bra'|'led'|'outlet'|'switch'>('room');

  const meta = STAGE_META[stageType];

  const stages: StageId[] = ['measurement','demolition','installation','markup','baseboards','electrical','plumbing','finishing','materials'];

  return (
    <div className="max-w-6xl mx-auto px-6 py-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-gray-900">Стандартные материалы</h1>
      </div>

      {/* Табы этапов */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="px-4 pt-3">
          <div className="flex space-x-1 overflow-x-auto">
            {stages.map((s: StageId) => (
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
              <div className="text-gray-900 font-medium">{STAGE_META[stageType].title}</div>
              <div className="text-sm text-gray-600">{STAGE_META[stageType].description}</div>
              <div className="text-sm text-gray-700 mt-1">
                <span className="font-medium"></span>
                {meta.binding}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {stageType === 'baseboards' ? (
                <>
                  <button
                    onClick={() => upsert({ stageType: normalizedStage as any, name: 'Новый материал (метр)', consumptionPerUnit: 0, purchasePrice: 0, sellPrice: 0, unit: 'м' })}
                    className="inline-flex items-center px-3 py-2 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700"
                  >
                    + На метр
                  </button>
                  <button
                    onClick={() => upsert({ stageType: normalizedStage as any, name: 'Новый материал (угол)', consumptionPerUnit: 0, purchasePrice: 0, sellPrice: 0, unit: 'угол' })}
                    className="inline-flex items-center px-3 py-2 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700"
                  >
                    + На угол
                  </button>
                </>
              ) : (
                stageType !== 'markup' && (
                  <button
                    onClick={() => upsert({ stageType: normalizedStage as any, name: 'Новый материал', consumptionPerUnit: 0, purchasePrice: 0, sellPrice: 0, triggerType: meta.triggers ? (triggerTab as any) : undefined })}
                    className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700"
                  >
                    + Добавить материал
                  </button>
                )
              )}
            </div>
          </div>
          {meta.triggers && stageType !== 'markup' && (
            <div className="mt-3 flex items-center gap-2">
              {meta.triggers.map(t => (
                <button key={t.id} onClick={() => setTriggerTab(t.id as any)} className={`px-3 py-1.5 text-xs rounded-md border ${triggerTab===t.id?'bg-blue-50 border-blue-200 text-blue-700':'bg-white border-gray-200 text-gray-700'}`}>{t.name}</button>
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
        ) : (stageType as StageId) === 'baseboards' ? (
          <div className="px-4 pb-4">
            <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left p-2">Название</th>
                    <th className="text-left p-2">Основа</th>
                    <th className="text-left p-2">Норма</th>
                    <th className="text-left p-2">Ед. измерения</th>
                    <th className="text-left p-2">Закупка</th>
                    <th className="text-left p-2">Реализация</th>
                  </tr>
                </thead>
                <tbody>
                  {(rows ?? []).map((row: any, idx: number) => {
                    const unit: string = (row.unit || '').toString().toLowerCase();
                    const basis = unit.includes('угол') || unit.includes('corner') ? 'corner' : 'meter';
                    return (
                      <tr key={row._id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="p-2 align-top">
                          <input defaultValue={row.name} onBlur={e => upsert({ id: row._id, stageType: normalizedStage as any, name: e.target.value, consumptionPerUnit: row.consumptionPerUnit, purchasePrice: row.purchasePrice, sellPrice: row.sellPrice, unit: row.unit })} className="w-full border rounded px-2 py-1" />
                        </td>
                        <td className="p-2 align-top">
                          <select defaultValue={basis} onChange={e => upsert({ id: row._id, stageType: normalizedStage as any, name: row.name, consumptionPerUnit: row.consumptionPerUnit, purchasePrice: row.purchasePrice, sellPrice: row.sellPrice, unit: e.target.value === 'corner' ? 'угол' : 'м' })} className="border rounded px-2 py-1">
                            <option value="meter">На метр</option>
                            <option value="corner">На угол</option>
                          </select>
                        </td>
                        <td className="p-2 align-top">
                          <input type="number" step="0.0001" defaultValue={row.consumptionPerUnit} onBlur={e => upsert({ id: row._id, stageType: normalizedStage as any, name: row.name, consumptionPerUnit: parseFloat(e.target.value || '0'), purchasePrice: row.purchasePrice, sellPrice: row.sellPrice, unit: row.unit })} className="w-full border rounded px-2 py-1" />
                        </td>
                        <td className="p-2 align-top">
                          <input defaultValue={row.unit || ''} onBlur={e => upsert({ id: row._id, stageType: normalizedStage as any, name: row.name, consumptionPerUnit: row.consumptionPerUnit, purchasePrice: row.purchasePrice, sellPrice: row.sellPrice, unit: e.target.value || undefined })} className="w-full border rounded px-2 py-1" />
                        </td>
                        <td className="p-2 align-top">
                          <input type="number" step="0.01" defaultValue={row.purchasePrice} onBlur={e => upsert({ id: row._id, stageType: normalizedStage as any, name: row.name, consumptionPerUnit: row.consumptionPerUnit, purchasePrice: parseFloat(e.target.value || '0'), sellPrice: row.sellPrice, unit: row.unit })} className="w-full border rounded px-2 py-1" />
                        </td>
                        <td className="p-2 align-top">
                          <input type="number" step="0.01" defaultValue={row.sellPrice} onBlur={e => upsert({ id: row._id, stageType: normalizedStage as any, name: row.name, consumptionPerUnit: row.consumptionPerUnit, purchasePrice: row.purchasePrice, sellPrice: parseFloat(e.target.value || '0'), unit: row.unit })} className="w-full border rounded px-2 py-1" />
                        </td>
                      </tr>
                    );
                  })}
                  {(!rows || rows.length === 0) && (
                    <tr><td colSpan={6} className="p-6 text-center text-gray-500">Нет материалов. Добавьте «на метр» или «на угол».</td></tr>
                  )}
                </tbody>
              </table>
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
                  {(rows ?? []).filter((r: any) => !meta.triggers || (r as { triggerType?: 'room'|'door'|'window'|'spotlight'|'bra'|'led'|'outlet'|'switch' }).triggerType === triggerTab).map((row: any, idx: number) => (
                    <tr key={row._id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="p-2 align-top">
                        <input defaultValue={row.name} onBlur={e => upsert({ id: row._id, stageType: normalizedStage as any, name: e.target.value, consumptionPerUnit: row.consumptionPerUnit, purchasePrice: row.purchasePrice, sellPrice: row.sellPrice, unit: row.unit, triggerType: (row as { triggerType?: 'room'|'door'|'window'|'spotlight'|'bra'|'led'|'outlet'|'switch' }).triggerType })} className="w-full border rounded px-2 py-1" />
                      </td>
                      <td className="p-2 align-top">
                        <input type="number" step="0.0001" defaultValue={row.consumptionPerUnit} onBlur={e => upsert({ id: row._id, stageType: normalizedStage as any, name: row.name, consumptionPerUnit: parseFloat(e.target.value || '0'), purchasePrice: row.purchasePrice, sellPrice: row.sellPrice, unit: row.unit, triggerType: (row as { triggerType?: 'room'|'door'|'window'|'spotlight'|'bra'|'led'|'outlet'|'switch' }).triggerType })} className="w-full border rounded px-2 py-1" />
                      </td>
                      <td className="p-2 align-top">
                        <input defaultValue={row.unit || ''} onBlur={e => upsert({ id: row._id, stageType: normalizedStage as any, name: row.name, consumptionPerUnit: row.consumptionPerUnit, purchasePrice: row.purchasePrice, sellPrice: row.sellPrice, unit: e.target.value || undefined, triggerType: (row as { triggerType?: 'room'|'door'|'window'|'spotlight'|'bra'|'led'|'outlet'|'switch' }).triggerType })} className="w-full border rounded px-2 py-1" />
                      </td>
                      <td className="p-2 align-top">
                        <input type="number" step="0.01" defaultValue={row.purchasePrice} onBlur={e => upsert({ id: row._id, stageType: normalizedStage as any, name: row.name, consumptionPerUnit: row.consumptionPerUnit, purchasePrice: parseFloat(e.target.value || '0'), sellPrice: row.sellPrice, unit: row.unit, triggerType: (row as { triggerType?: 'room'|'door'|'window'|'spotlight'|'bra'|'led'|'outlet'|'switch' }).triggerType })} className="w-full border rounded px-2 py-1" />
                      </td>
                      <td className="p-2 align-top">
                        <input type="number" step="0.01" defaultValue={row.sellPrice} onBlur={e => upsert({ id: row._id, stageType: normalizedStage as any, name: row.name, consumptionPerUnit: row.consumptionPerUnit, purchasePrice: row.purchasePrice, sellPrice: parseFloat(e.target.value || '0'), unit: row.unit, triggerType: (row as { triggerType?: 'room'|'door'|'window'|'spotlight'|'bra'|'led'|'outlet'|'switch' }).triggerType })} className="w-full border rounded px-2 py-1" />
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

