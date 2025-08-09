"use client";

import React, { useMemo, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';

type StageId = 'measurement' | 'installation' | 'demolition' | 'electrical' | 'plumbing' | 'finishing' | 'materials';

interface StageSummaryProps {
  projectId: Id<'projects'>;
  currentStage: StageId;
}

export default function StageSummary({ projectId, currentStage }: StageSummaryProps) {
  switch (currentStage) {
    case 'measurement':
      return <CalibrationSummary projectId={projectId} />;
    case 'demolition':
      return <DemolitionSummary projectId={projectId} />;
    case 'installation':
      return <InstallationSummary projectId={projectId} />;
    default:
      return (
        <div className="mt-3 p-3 rounded-md border border-gray-200 bg-gray-50 text-sm text-gray-600">
          Сводка для этапа будет доступна позже.
        </div>
      );
  }
}

function useMmPerPx(projectId: Id<'projects'>) {
  const project = useQuery(api.projects.getProject, { projectId });
  return useMemo(() => {
    if (!project || !project.scale || project.scale.pixelLength === 0) return null;
    return project.scale.knownLength / project.scale.pixelLength;
  }, [project]);
}

function CalibrationSummary({ projectId }: { projectId: Id<'projects'> }) {
  const project = useQuery(api.projects.getProject, { projectId });
  const mmPerPx = useMmPerPx(projectId);

  return (
    <div className="mt-3 p-3 rounded-md border border-blue-200 bg-blue-50">
      <div className="text-sm text-blue-900">
        <div className="font-medium mb-1">Калибровка масштаба</div>
        {mmPerPx ? (
          <div>
            <div>Коэффициент: {mmPerPx.toFixed(4)} мм/px</div>
            <div className="text-xs text-blue-800 mt-1">Известная длина: {project?.scale?.knownLength} мм, Пикселей: {project?.scale?.pixelLength}</div>
          </div>
        ) : (
          <div>Не выполнена. Перед началом работы проведите калибровку.</div>
        )}
      </div>
    </div>
  );
}

function DemolitionSummary({ projectId }: { projectId: Id<'projects'> }) {
  const mmPerPx = useMmPerPx(projectId);
  const summary = useQuery(api.svgElements.getStageSummaryByProject, { projectId, stageType: 'demolition' });
  const projectMaterials = useQuery(api.materials.listProjectMaterials, { projectId, stageType: 'demolition' });
  const defaultMaterials = useQuery(api.materials.listDefaults, { stageType: 'demolition' });
  const project = useQuery(api.projects.getProject, { projectId });

  const nf = useMemo(() => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }), []);
  const money = useMemo(() => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }), []);
  const [showMaterials, setShowMaterials] = useState(false);

  const totals = useMemo(() => {
    if (!summary || !mmPerPx) return undefined;
    const mPerPx = mmPerPx / 1000; // метры на пиксель
    return {
      totalLengthM: summary.totalLengthPx * mPerPx,
      totalAreaM2: summary.totalAreaPx2 * (mPerPx * mPerPx),
    };
  }, [summary, mmPerPx]);

  const materialsComputed = useMemo(() => {
    if (!totals) return undefined;
    const raw = project?.ceilingHeight ?? null;
    const heightM = raw != null ? (raw >= 100 ? raw / 1000 : raw) : null; // поддержка старых значений в метрах
    if (!heightM || heightM <= 0) return undefined;
    const source = (projectMaterials && projectMaterials.length > 0) ? projectMaterials : (defaultMaterials ?? []);
    if (source.length === 0) return undefined;
    const list = source.map((row: any) => {
      const qty = row.consumptionPerUnit * totals.totalLengthM * heightM; // расход на 1 м × длина (м) × высота (м)
      const cost = qty * row.purchasePrice; // закупка
      const revenue = qty * row.sellPrice;  // реализация
      const profit = revenue - cost;
      return { ...row, qty, cost, revenue, profit };
    });
    const totalsRow = list.reduce((acc, x) => {
      acc.qty += x.qty; acc.cost += x.cost; acc.revenue += x.revenue; acc.profit += x.profit; return acc;
    }, { qty: 0, cost: 0, revenue: 0, profit: 0 });
    return { list, totalsRow };
  }, [projectMaterials, totals]);

  return (
    <div className="mt-3 rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7h18M5 7v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7"/><path d="M7 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2"/></svg>
        </div>
        <div className="text-sm font-medium text-gray-900">Сводка этапа: Демонтаж</div>
        <div className="ml-auto">
          <button
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-gray-800 text-white hover:bg-gray-900 disabled:opacity-50"
            onClick={() => setShowMaterials(true)}
            disabled={!materialsComputed}
          >
            Материалы
          </button>
        </div>
      </div>
      <div className="px-4 py-4 grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="rounded-md bg-rose-50 px-3 py-3 border border-rose-100">
          <div className="text-xs uppercase tracking-wide text-rose-700/80">Суммарная длина стен</div>
          <div className="mt-1 text-2xl font-semibold text-rose-700">
            {totals ? `${nf.format(totals.totalLengthM)} м` : <span className="text-gray-400 text-base">недоступно</span>}
          </div>
        </div>
        <div className="rounded-md bg-blue-50 px-3 py-3 border border-blue-100">
          <div className="text-xs uppercase tracking-wide text-blue-700/80">Суммарная площадь</div>
          <div className="mt-1 text-2xl font-semibold text-blue-700">
            {totals ? `${nf.format(totals.totalAreaM2)} м²` : <span className="text-gray-400 text-base">недоступно</span>}
          </div>
        </div>
        <div className="rounded-md bg-amber-50 px-3 py-3 border border-amber-100">
          <div className="text-xs uppercase tracking-wide text-amber-700/80">Затраты на этап</div>
          <div className="mt-1 text-2xl font-semibold text-amber-700">
            {materialsComputed ? money.format(materialsComputed.totalsRow.cost) : <span className="text-gray-400 text-base">н/д</span>}
          </div>
        </div>
        <div className="rounded-md bg-emerald-50 px-3 py-3 border border-emerald-100">
          <div className="text-xs uppercase tracking-wide text-emerald-700/80">Прибыль этапа</div>
          <div className="mt-1 text-2xl font-semibold text-emerald-700">
            {materialsComputed ? money.format(materialsComputed.totalsRow.profit) : <span className="text-gray-400 text-base">н/д</span>}
          </div>
        </div>
      </div>
      {!mmPerPx && (
        <div className="px-4 pb-4 -mt-2 text-xs text-gray-500">Для отображения значений в метрах выполните калибровку масштаба.</div>
      )}

      {/* Попап с материалами */}
      {showMaterials && materialsComputed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="text-sm font-medium text-gray-900">Материалы этапа «Демонтаж»</div>
              <button className="text-gray-500 hover:text-gray-700" onClick={() => setShowMaterials(false)}>Закрыть</button>
            </div>
            <div className="p-4">
              <div className="rounded-md border border-gray-200 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left p-2">Материал</th>
                      <th className="text-left p-2">Расход на 1 м</th>
                      <th className="text-left p-2">Ед.</th>
                      <th className="text-left p-2">Кол-во</th>
                      <th className="text-left p-2">Закупка</th>
                      <th className="text-left p-2">Реализация</th>
                      <th className="text-left p-2">Профит</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materialsComputed.list.map((m, idx) => (
                      <tr key={m._id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="p-2">{m.name}</td>
                        <td className="p-2">{nf.format(m.consumptionPerUnit)}</td>
                        <td className="p-2">{m.unit || '-'}</td>
                        <td className="p-2">{nf.format(m.qty)}</td>
                        <td className="p-2">{money.format(m.cost)}</td>
                        <td className="p-2">{money.format(m.revenue)}</td>
                        <td className="p-2">{money.format(m.profit)}</td>
                      </tr>
                    ))}
                    <tr className="bg-emerald-50 font-medium">
                      <td className="p-2" colSpan={3}>Итого</td>
                      <td className="p-2">{nf.format(materialsComputed.totalsRow.qty)}</td>
                      <td className="p-2">{money.format(materialsComputed.totalsRow.cost)}</td>
                      <td className="p-2">{money.format(materialsComputed.totalsRow.revenue)}</td>
                      <td className="p-2">{money.format(materialsComputed.totalsRow.profit)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {totals && (
                <div className="text-xs text-gray-500 mt-3">Расчёт основан на длине стен: {nf.format(totals.totalLengthM)} м</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InstallationSummary({ projectId }: { projectId: Id<'projects'> }) {
  const mmPerPx = useMmPerPx(projectId);
  const summary = useQuery(api.svgElements.getStageSummaryByProject, { projectId, stageType: 'installation' });
  const projectMaterials = useQuery(api.materials.listProjectMaterials, { projectId, stageType: 'installation' });
  const defaultMaterials = useQuery(api.materials.listDefaults, { stageType: 'installation' });
  const project = useQuery(api.projects.getProject, { projectId });
  const nf = useMemo(() => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }), []);
  const money = useMemo(() => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }), []);
  const [showMaterials, setShowMaterials] = useState(false);

  const totals = useMemo(() => {
    if (!summary || !mmPerPx) return undefined;
    const mPerPx = mmPerPx / 1000;
    return {
      totalLengthM: summary.totalLengthPx * mPerPx,
      totalAreaM2: summary.totalAreaPx2 * (mPerPx * mPerPx),
    };
  }, [summary, mmPerPx]);

  const materialsComputed = useMemo(() => {
    if (!totals) return undefined;
    const raw = project?.ceilingHeight ?? null;
    const heightM = raw != null ? (raw >= 100 ? raw / 1000 : raw) : null;
    if (!heightM || heightM <= 0) return undefined;
    const source = (projectMaterials && projectMaterials.length > 0) ? projectMaterials : (defaultMaterials ?? []);
    if (source.length === 0) return undefined;
    const list = source.map((row: any) => {
      const qty = row.consumptionPerUnit * totals.totalLengthM * heightM;
      const cost = qty * row.purchasePrice;
      const revenue = qty * row.sellPrice;
      const profit = revenue - cost;
      return { ...row, qty, cost, revenue, profit };
    });
    const totalsRow = list.reduce((acc, x) => {
      acc.qty += x.qty; acc.cost += x.cost; acc.revenue += x.revenue; acc.profit += x.profit; return acc;
    }, { qty: 0, cost: 0, revenue: 0, profit: 0 });
    return { list, totalsRow };
  }, [projectMaterials, totals]);

  return (
    <div className="mt-3 rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7h18M5 7v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7"/><path d="M7 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2"/></svg>
        </div>
        <div className="text-sm font-medium text-gray-900">Сводка этапа: Монтаж</div>
        <div className="ml-auto">
          <button
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-gray-800 text-white hover:bg-gray-900 disabled:opacity-50"
            onClick={() => setShowMaterials(true)}
            disabled={!materialsComputed}
          >
            Материалы
          </button>
        </div>
      </div>
      <div className="px-4 py-4 grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="rounded-md bg-emerald-50 px-3 py-3 border border-emerald-100">
          <div className="text-xs uppercase tracking-wide text-emerald-700/80">Суммарная длина стен</div>
          <div className="mt-1 text-2xl font-semibold text-emerald-700">
            {totals ? `${nf.format(totals.totalLengthM)} м` : <span className="text-gray-400 text-base">недоступно</span>}
          </div>
        </div>
        <div className="rounded-md bg-blue-50 px-3 py-3 border border-blue-100">
          <div className="text-xs uppercase tracking-wide text-blue-700/80">Суммарная площадь</div>
          <div className="mt-1 text-2xl font-semibold text-blue-700">
            {totals ? `${nf.format(totals.totalAreaM2)} м²` : <span className="text-gray-400 text-base">недоступно</span>}
          </div>
        </div>
        <div className="rounded-md bg-amber-50 px-3 py-3 border border-amber-100">
          <div className="text-xs uppercase tracking-wide text-amber-700/80">Затраты на этап</div>
          <div className="mt-1 text-2xl font-semibold text-amber-700">
            {materialsComputed ? money.format(materialsComputed.totalsRow.cost) : <span className="text-gray-400 text-base">н/д</span>}
          </div>
        </div>
        <div className="rounded-md bg-emerald-50 px-3 py-3 border border-emerald-100">
          <div className="text-xs uppercase tracking-wide text-emerald-700/80">Прибыль этапа</div>
          <div className="mt-1 text-2xl font-semibold text-emerald-700">
            {materialsComputed ? money.format(materialsComputed.totalsRow.profit) : <span className="text-gray-400 text-base">н/д</span>}
          </div>
        </div>
      </div>
      {!mmPerPx && (
        <div className="px-4 pb-4 -mt-2 text-xs text-gray-500">Для отображения значений в метрах выполните калибровку масштаба.</div>
      )}

      {showMaterials && materialsComputed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="text-sm font-medium text-gray-900">Материалы этапа «Монтаж»</div>
              <button className="text-gray-500 hover:text-gray-700" onClick={() => setShowMaterials(false)}>Закрыть</button>
            </div>
            <div className="p-4">
              <div className="rounded-md border border-gray-200 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left p-2">Материал</th>
                      <th className="text-left p-2">Расход на 1 м</th>
                      <th className="text-left p-2">Ед.</th>
                      <th className="text-left p-2">Кол-во</th>
                      <th className="text-left p-2">Закупка</th>
                      <th className="text-left p-2">Реализация</th>
                      <th className="text-left p-2">Профит</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materialsComputed.list.map((m, idx) => (
                      <tr key={m._id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="p-2">{m.name}</td>
                        <td className="p-2">{nf.format(m.consumptionPerUnit)}</td>
                        <td className="p-2">{m.unit || '-'}</td>
                        <td className="p-2">{nf.format(m.qty)}</td>
                        <td className="p-2">{money.format(m.cost)}</td>
                        <td className="p-2">{money.format(m.revenue)}</td>
                        <td className="p-2">{money.format(m.profit)}</td>
                      </tr>
                    ))}
                    <tr className="bg-emerald-50 font-medium">
                      <td className="p-2" colSpan={3}>Итого</td>
                      <td className="p-2">{nf.format(materialsComputed.totalsRow.qty)}</td>
                      <td className="p-2">{money.format(materialsComputed.totalsRow.cost)}</td>
                      <td className="p-2">{money.format(materialsComputed.totalsRow.revenue)}</td>
                      <td className="p-2">{money.format(materialsComputed.totalsRow.profit)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {totals && (
                <div className="text-xs text-gray-500 mt-3">Расчёт основан на длине стен: {nf.format(totals.totalLengthM)} м</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

