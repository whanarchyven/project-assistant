"use client";

import React, { useMemo, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';

function MarkupSummary({ projectId }: { projectId: Id<'projects'> }) {
  const project = useQuery(api.projects.getProject, { projectId });
  const heightRaw = project?.ceilingHeight ?? null;
  const H = heightRaw != null ? (heightRaw >= 100 ? heightRaw / 1000 : heightRaw) : null;
  const mmPerPx = useMmPerPx(projectId);
  const summary = useQuery(api.svgElements.getStageSummaryByProject, { projectId, stageType: 'markup' });
  const projectMaterialsRooms = useQuery(api.materials.listProjectMaterials, { projectId, stageType: 'markup' });
  const defaultsRooms = useQuery(api.materials.listDefaults, { stageType: 'markup' });
  const rooms = useQuery(api.rooms.getRoomsWithGeometryByProject, { projectId });
  const roomTypeMats = useQuery(api.rooms.listAllRoomTypeMaterials, {} as any);
  const openings = useQuery(api.rooms.listOpeningsByProject, { projectId });
  const matsOpening = useQuery(api.rooms.listOpeningMaterials, { openingType: 'opening' } as any);
  const matsDoor = useQuery(api.rooms.listOpeningMaterials, { openingType: 'door' } as any);
  const matsWindow = useQuery(api.rooms.listOpeningMaterials, { openingType: 'window' } as any);

  const nf = useMemo(() => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }), []);
  const money = useMemo(() => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }), []);
  const [show, setShow] = useState(false);

  const derived = useMemo(() => {
    if (!summary || !mmPerPx) return undefined;
    const mPerPx = mmPerPx / 1000;
    const rooms = summary.rooms ? {
      perimeterM: summary.rooms.perimeterPx * mPerPx,
      areaM2: summary.rooms.areaPx2 * (mPerPx * mPerPx),
    } : { perimeterM: 0, areaM2: 0 };
    const doors = summary.doors ? {
      areaM2: summary.doors.areaPx2 * (mPerPx * mPerPx),
    } : { areaM2: 0 };
    const windows = summary.windows ? {
      areaM2: summary.windows.areaPx2 * (mPerPx * mPerPx),
    } : { areaM2: 0 };
    return { rooms, doors, windows };
  }, [summary, mmPerPx]);

  const triggers = useMemo(() => {
    if (!derived || !H) return undefined;
    const tRooms = derived.rooms.perimeterM * H + 2 * derived.rooms.areaM2;
    const tDoors = derived.doors.areaM2 * H;
    const tWindows = derived.windows.areaM2 * (2 / 3 * H);
    return { rooms: tRooms, doors: tDoors, windows: tWindows };
  }, [derived, H]);

  // Расчёты по комнатам по типовым материалам
  const roomMaterialsTotals = useMemo(() => {
    if (!rooms || !roomTypeMats || !mmPerPx) return undefined;
    const mPerPx = mmPerPx / 1000;
    const byType = new Map<string, Array<any>>();
    for (const m of roomTypeMats) {
      const arr = byType.get(m.roomTypeId as any) || [];
      arr.push(m);
      byType.set(m.roomTypeId as any, arr);
    }
    const list: Array<{ roomId: string; name: string; material: string; unit?: string; qty: number; cost: number; revenue: number; profit: number; basis: string }> = [];
    let totalWallsM2 = 0;
    const roomInfo: Record<string, { name: string; floorM2: number; perimeterM: number; wallM2: number }> = {};
    for (const r of rooms) {
      const mats = byType.get(r.roomTypeId as any) || [];
      if (mats.length === 0) continue;
      // площадь пола комнаты (м²)
      let areaPx2 = 0; let perimPx = 0;
      const pts = r.points;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i+1)%pts.length];
        perimPx += Math.hypot(b.x - a.x, b.y - a.y);
        areaPx2 += (a.x * b.y - b.x * a.y);
      }
      const floorM2 = Math.abs(areaPx2) / 2 * (mPerPx * mPerPx);
      // Вычитаем площадь проёмов на стенах комнаты (пока просто суммарно по roomId1/2)
      let openingsAreaM2 = 0;
      if (openings && H) {
        const rel = (openings as any[]).filter(o => o.roomId1 === (r.roomId as any) || o.roomId2 === (r.roomId as any));
        for (const op of rel) {
          const lengthM = op.lengthPx * mPerPx;
          const heightM = (op.heightMm ?? 0) / 1000;
          openingsAreaM2 += lengthM * heightM;
        }
      }
      const wallM2 = Math.max(0, perimPx * mPerPx * (H ?? 0) - openingsAreaM2);
      roomInfo[r.roomId as any] = { name: r.name, floorM2, perimeterM: perimPx * mPerPx, wallM2 };
      totalWallsM2 += wallM2;
      for (const mat of mats) {
        const basisVal = mat.basis === 'floor_m2' ? floorM2 : wallM2;
        const qty = mat.consumptionPerUnit * basisVal;
        const cost = qty * mat.purchasePrice;
        const revenue = qty * mat.sellPrice;
        const profit = revenue - cost;
        list.push({ roomId: r.roomId as any, name: r.name, material: mat.name, unit: mat.unit, qty, cost, revenue, profit, basis: mat.basis });
      }
    }
    const totals = list.reduce((a, x) => ({ qty: a.qty + x.qty, cost: a.cost + x.cost, revenue: a.revenue + x.revenue, profit: a.profit + x.profit }), { qty: 0, cost: 0, revenue: 0, profit: 0 });
    return { list, totals, totalWallsM2, roomInfo };
  }, [rooms, roomTypeMats, mmPerPx, H, openings]);

  // Материалы по проёмам: opening/door/window
  const openingsMaterialsTotals = useMemo(() => {
    if (!openings || !mmPerPx) return undefined;
    const mPerPx = mmPerPx / 1000;
    const byType: Record<'opening'|'door'|'window', Array<any>> = {
      opening: (matsOpening ?? []) as any,
      door: (matsDoor ?? []) as any,
      window: (matsWindow ?? []) as any,
    };
    const roomNameById = new Map<string, string>();
    (rooms ?? []).forEach((r: any) => { roomNameById.set(r.roomId as any, r.name); });
    const rows: Array<{ openingId: string; type: 'opening'|'door'|'window'; room1?: string; room2?: string; material: string; unit?: string; basis: 'opening_m2'|'per_opening'; lengthM: number; areaM2: number; qty: number; cost: number; revenue: number; profit: number }>=[];
    const groups: Array<{ openingId: string; type: 'opening'|'door'|'window'; room1?: string; room2?: string; lengthM: number; areaM2: number; materials: Array<{ material: string; unit?: string; basis: 'opening_m2'|'per_opening'; qty: number; cost: number; revenue: number; profit: number }> }> = [];
    const perType = { opening: { count: 0, areaM2: 0, lengthM: 0 }, door: { count: 0, areaM2: 0, lengthM: 0 }, window: { count: 0, areaM2: 0, lengthM: 0 } } as Record<'opening'|'door'|'window', { count:number; areaM2:number; lengthM:number }>;
    const usedPairKeys = new Set<string>();
    for (const op of (openings as any[])) {
      const lengthM = op.lengthPx * mPerPx;
      const heightM = (op.heightMm ?? 0) / 1000;
      const areaM2 = Math.max(0, lengthM * heightM);
      const rid1 = op.roomId1 as string; const rid2 = (op.roomId2 as string | undefined) || undefined;
      let labelRoom1: string | undefined = roomNameById.get(rid1 as any);
      let labelRoom2: string | undefined = rid2 ? roomNameById.get(rid2 as any) : undefined;
      // Группируем парные проёмы по неориентированному ключу
      let process = true;
      if (rid2) {
        const a = String(rid1) < String(rid2) ? rid1 : rid2;
        const b = a === rid1 ? rid2! : rid1;
        const roundedPx = Math.round((op.lengthPx ?? 0) * 10) / 10;
        const pairKey = `${op.openingType}|${a}|${b}|${op.heightMm ?? 0}|${roundedPx}`;
        if (usedPairKeys.has(pairKey)) {
          process = false;
        } else {
          usedPairKeys.add(pairKey);
          // для отображения стрелки используем отсортированный порядок имён
          labelRoom1 = roomNameById.get(a as any);
          labelRoom2 = roomNameById.get(b as any);
        }
      }
      if (!process) continue;
      perType[op.openingType as 'opening'|'door'|'window'].count += 1;
      perType[op.openingType as 'opening'|'door'|'window'].areaM2 += areaM2;
      perType[op.openingType as 'opening'|'door'|'window'].lengthM += lengthM;
      const mats = byType[op.openingType as 'opening'|'door'|'window'] || [];
      const groupMaterials: Array<{ material: string; unit?: string; basis: 'opening_m2'|'per_opening'; qty: number; cost: number; revenue: number; profit: number }> = [];
      for (const m of mats) {
        const basis: 'opening_m2'|'per_opening' = (m.basis === 'per_opening') ? 'per_opening' : 'opening_m2';
        const qty = (m.consumptionPerUnit ?? 0) * (basis === 'opening_m2' ? areaM2 : 1);
        const cost = qty * (m.purchasePrice ?? 0);
        const revenue = qty * (m.sellPrice ?? 0);
        const profit = revenue - cost;
        rows.push({ openingId: op._id as any, type: op.openingType as any, room1: labelRoom1, room2: labelRoom2, material: m.name, unit: m.unit, basis, lengthM, areaM2, qty, cost, revenue, profit });
        groupMaterials.push({ material: m.name, unit: m.unit, basis, qty, cost, revenue, profit });
      }
      groups.push({ openingId: op._id as any, type: op.openingType as any, room1: labelRoom1, room2: labelRoom2, lengthM, areaM2, materials: groupMaterials });
    }
    const totals = groups.flatMap(g => g.materials).reduce((a,x)=>({ qty:a.qty+x.qty, cost:a.cost+x.cost, revenue:a.revenue+x.revenue, profit:a.profit+x.profit }), { qty:0, cost:0, revenue:0, profit:0 });
    return { rows, groups, totals, perType };
  }, [openings, matsOpening, matsDoor, matsWindow, rooms, mmPerPx]);

  // Материалы по триггерам (берём проектные или дефолтные), но ТОЛЬКО двери/окна. Комнаты считаются по типам в roomMaterialsTotals
  const materials = useMemo(() => {
    if (!triggers) return undefined;
    const src = (projectMaterialsRooms && projectMaterialsRooms.length > 0) ? projectMaterialsRooms : (defaultsRooms ?? []);
    if (src.length === 0) return undefined;
    type Mat = { triggerType?: 'room'|'door'|'window'; consumptionPerUnit: number; purchasePrice: number; sellPrice: number; name: string; unit?: string; _id?: string };
    type MatRow = Mat & { qty: number; cost: number; revenue: number; profit: number };
    const group: { doors: Array<MatRow>; windows: Array<MatRow> } = { doors: [], windows: [] };
    for (const row of src as Array<Mat>) {
      const t = row.triggerType;
      if (!t || t === 'room') continue; // исключаем комнатные материалы из старой логики
      const trigVal = t === 'door' ? triggers.doors : triggers.windows;
      const qty = row.consumptionPerUnit * trigVal;
      const cost = qty * row.purchasePrice;
      const revenue = qty * row.sellPrice;
      const profit = revenue - cost;
      group[t === 'door' ? 'doors' : 'windows'].push({ ...row, qty, cost, revenue, profit });
    }
    const sum = (list: Array<MatRow>) => list.reduce((a, x) => ({ qty: a.qty + x.qty, cost: a.cost + x.cost, revenue: a.revenue + x.revenue, profit: a.profit + x.profit }), { qty: 0, cost: 0, revenue: 0, profit: 0 });
    return {
      doors: { list: group.doors, totals: sum(group.doors) },
      windows: { list: group.windows, totals: sum(group.windows) },
    };
  }, [projectMaterialsRooms, defaultsRooms, triggers]);

  return (
    <div className="mt-3 rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7h18M5 7v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7"/><path d="M7 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2"/></svg>
        </div>
        <div className="text-sm font-medium text-gray-900">Сводка этапа: Разметка</div>
        <div className="ml-auto">
          <button className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-gray-800 text-white hover:bg-gray-900 disabled:opacity-50" onClick={() => setShow(true)} disabled={!materials}>Материалы</button>
        </div>
      </div>
      <div className="px-4 py-4 grid grid-cols-1 sm:grid-cols-4 gap-4">
        {/* Комнаты: кратко */}
        <div className="rounded-md bg-emerald-50 px-3 py-3 border border-emerald-100">
          <div className="text-xs uppercase tracking-wide text-emerald-700/80">Комнаты</div>
          <div className="mt-1 text-sm text-gray-700">P: {derived ? nf.format(derived.rooms.perimeterM) : '—'} м</div>
          <div className="text-sm text-gray-700">S пола: {derived ? nf.format(derived.rooms.areaM2) : '—'} м²</div>
          <div className="text-sm text-gray-700">S стен: {roomMaterialsTotals ? nf.format(roomMaterialsTotals.totalWallsM2) : '—'} м²</div>
        </div>
        {/* Проёмы: кратко */}
        <div className="rounded-md px-3 py-3 border border-rose-200 bg-rose-50">
          <div className="text-xs uppercase tracking-wide text-rose-700/80">Проёмы</div>
          <div className="mt-1 text-sm text-gray-700">Кол-во: {openingsMaterialsTotals ? openingsMaterialsTotals.perType.opening.count : '—'} шт</div>
          <div className="text-sm text-gray-700">Длина: {openingsMaterialsTotals ? nf.format(openingsMaterialsTotals.perType.opening.lengthM) : '—'} м</div>
          <div className="text-sm text-gray-700">S: {openingsMaterialsTotals ? nf.format(openingsMaterialsTotals.perType.opening.areaM2) : '—'} м²</div>
        </div>
        {/* Двери: кратко */}
        <div className="rounded-md px-3 py-3 border" style={{ backgroundColor: '#f3e8e0', borderColor: '#e0cbb8' }}>
          <div className="text-xs uppercase tracking-wide" style={{ color: '#8b5e3c' }}>Двери</div>
          <div className="mt-1 text-sm" style={{ color: '#8b5e3c' }}>Кол-во: {openingsMaterialsTotals ? openingsMaterialsTotals.perType.door.count : '—'} шт</div>
          <div className="text-sm" style={{ color: '#8b5e3c' }}>Длина: {openingsMaterialsTotals ? nf.format(openingsMaterialsTotals.perType.door.lengthM) : '—'} м</div>
          <div className="text-sm" style={{ color: '#8b5e3c' }}>S: {openingsMaterialsTotals ? nf.format(openingsMaterialsTotals.perType.door.areaM2) : '—'} м²</div>
        </div>
        {/* Окна: кратко */}
        <div className="rounded-md border border-yellow-100 px-3 py-3 bg-yellow-50">
          <div className="text-xs uppercase tracking-wide text-yellow-700/80">Окна</div>
          <div className="mt-1 text-sm text-yellow-700/80">Кол-во: {openingsMaterialsTotals ? openingsMaterialsTotals.perType.window.count : '—'} шт</div>
          <div className="text-sm text-yellow-700/80">Длина: {openingsMaterialsTotals ? nf.format(openingsMaterialsTotals.perType.window.lengthM) : '—'} м</div>
          <div className="text-sm text-yellow-700/80">S: {openingsMaterialsTotals ? nf.format(openingsMaterialsTotals.perType.window.areaM2) : '—'} м²</div>
        </div>
      </div>
      {!H && (<div className="px-4 pb-4 -mt-2 text-xs text-gray-500">Для корректного расчёта укажите высоту потолка.</div>)}

      {show && materials && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="text-sm font-medium text-gray-900">Материалы этапа «Разметка»</div>
              <button className="text-gray-500 hover:text-gray-700" onClick={() => setShow(false)}>Закрыть</button>
            </div>
            <div className="p-4 grid grid-cols-1 gap-4 max-h-[75vh] overflow-y-auto">

              {/* Убрали отдельные таблицы дверей и окон из попапа */}
              {roomMaterialsTotals && (
                <div className="rounded-md border border-gray-200 overflow-hidden">
                  <div className="px-3 py-2 text-sm font-medium bg-gray-50 border-b border-gray-100">Комнаты</div>
                  <div className="p-2 space-y-4 max-h-[60vh] overflow-y-auto">
                    {Array.from(new Map(roomMaterialsTotals.list.map(r => [r.roomId, r.name])).entries()).map(([roomId, roomName]) => (
                      <div key={roomId} className="rounded-md border border-gray-100">
                        <div className="px-3 py-2 text-sm font-medium bg-white border-b border-gray-100 flex flex-wrap gap-4">
                          <span>{roomName}</span>
                          <span className="text-gray-600">P: {roomMaterialsTotals.roomInfo[roomId] ? nf.format(roomMaterialsTotals.roomInfo[roomId].perimeterM) : '—'} м</span>
                          <span className="text-gray-600">S пола: {roomMaterialsTotals.roomInfo[roomId] ? nf.format(roomMaterialsTotals.roomInfo[roomId].floorM2) : '—'} м²</span>
                          <span className="text-gray-600">S стен: {roomMaterialsTotals.roomInfo[roomId] ? nf.format(roomMaterialsTotals.roomInfo[roomId].wallM2) : '—'} м²</span>
                        </div>
                        <div className="p-2 overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead className="text-gray-600">
                              <tr>
                                <th className="text-left p-1">Материал</th>
                                <th className="text-left p-1">Основа</th>
                                <th className="text-left p-1">Кол-во</th>
                                <th className="text-left p-1">Закупка</th>
                                <th className="text-left p-1">Реализация</th>
                                <th className="text-left p-1">Профит</th>
                              </tr>
                            </thead>
                            <tbody>
                              {roomMaterialsTotals.list.filter(r => r.roomId === roomId).map((r, idx) => (
                                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                  <td className="p-1">{r.material}</td>
                                  <td className="p-1">{r.basis === 'floor_m2' ? 'Площадь пола' : 'Площадь стен'}</td>
                                  <td className="p-1">{nf.format(r.qty)}</td>
                                  <td className="p-1">{money.format(r.cost)}</td>
                                  <td className="p-1">{money.format(r.revenue)}</td>
                                  <td className="p-1">{money.format(r.profit)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                    <div className="rounded-md border border-gray-100">
                      <div className="px-3 py-2 text-sm font-medium bg-white border-b border-gray-100">Итого по комнатам</div>
                      <div className="p-2">
                        <div className="text-xs text-gray-600">Кол-во: {nf.format(roomMaterialsTotals.totals.qty)}</div>
                        <div className="text-xs text-gray-600">Затраты: {money.format(roomMaterialsTotals.totals.cost)}</div>
                        <div className="text-xs text-gray-600">Реализация: {money.format(roomMaterialsTotals.totals.revenue)}</div>
                        <div className="text-xs text-gray-600">Профит: {money.format(roomMaterialsTotals.totals.profit)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Подробные таблицы проёмов вынесены в попап: группировка по каждому проёму */}
              {openingsMaterialsTotals && (
                <div className="rounded-md border border-gray-200 overflow-hidden">
                  <div className="px-3 py-2 text-sm font-medium bg-gray-50 border-b border-gray-100">Проёмы / Двери / Окна</div>
                  <div className="p-2 space-y-3 max-h-[65vh] overflow-y-auto">
                    {openingsMaterialsTotals.groups.map((g, idx)=> (
                      <div key={g.openingId ?? idx} className="rounded border border-gray-100">
                        <div className="px-3 py-2 text-sm font-medium bg-white border-b border-gray-100 flex flex-wrap gap-4">
                          <span>{g.type==='opening'?'Проём':g.type==='door'?'Дверь':'Окно'}</span>
                          <span className="text-gray-600">{g.room1}{g.room2 ? ' → ' + g.room2 : ''}</span>
                          <span className="text-gray-600">Длина: {nf.format(g.lengthM)} м</span>
                          <span className="text-gray-600">S: {nf.format(g.areaM2)} м²</span>
                        </div>
                        <div className="p-2 overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead className="text-gray-600">
                              <tr>
                                <th className="text-left p-1">Материал</th>
                                <th className="text-left p-1">Основа</th>
                                <th className="text-left p-1">Норма</th>
                                <th className="text-left p-1">Ед.</th>
                                <th className="text-left p-1">Кол-во</th>
                                <th className="text-left p-1">Закупка</th>
                                <th className="text-left p-1">Реализация</th>
                                <th className="text-left p-1">Профит</th>
                              </tr>
                            </thead>
                            <tbody>
                              {g.materials.map((m, j)=> (
                                <tr key={j} className={j%2===0?'bg-white':'bg-gray-50'}>
                                  <td className="p-1">{m.material}</td>
                                  <td className="p-1">{m.basis==='per_opening'?'На проём':'На м² проёма'}</td>
                                  <td className="p-1">{m.basis==='per_opening' ? nf.format(m.qty) : nf.format(m.qty / (g.areaM2 || 1))}</td>
                                  <td className="p-1">{m.unit || '-'}</td>
                                  <td className="p-1">{nf.format(m.qty)} {m.unit ? m.unit : ''}</td>
                                  <td className="p-1">{money.format(m.cost)}</td>
                                  <td className="p-1">{money.format(m.revenue)}</td>
                                  <td className="p-1">{money.format(m.profit)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
            </div>
          </div>
        </div>
      )}
    </div>
  );
}




type StageId = 'measurement' | 'installation' | 'demolition' | 'markup' | 'electrical' | 'plumbing' | 'finishing' | 'materials';

interface StageSummaryProps {
  projectId: Id<'projects'>;
  currentStage: StageId;
}

export default function StageSummary({ projectId, currentStage }: StageSummaryProps) {
  switch (currentStage) {
    case 'markup':
      return <MarkupSummary projectId={projectId} />;
    case 'measurement':
      return <CalibrationSummary projectId={projectId} />;
    case 'demolition':
      return <DemolitionSummary projectId={projectId} />;
    case 'installation':
      return <InstallationSummary projectId={projectId} />;
    case 'baseboards' as any:
      return <BaseboardsSummary projectId={projectId} />;
    default:
      return (
        <div className="mt-3 p-3 rounded-md border border-gray-200 bg-gray-50 text-sm text-gray-600">
          Сводка для этапа будет доступна позже.
        </div>
      );
  }
}
function OpeningsTable({ rows, nf, money, colorClass, borderClass }: { rows: Array<any>; nf: Intl.NumberFormat; money: Intl.NumberFormat; colorClass?: string; borderClass?: string }) {
  return (
    <div className="p-2 overflow-x-auto max-h-[40vh] overflow-y-auto">
      <table className="w-full text-xs">
        <thead className={`text-gray-600 ${borderClass??''}`}>
          <tr>
            <th className="text-left p-2">Комната A</th>
            <th className="text-left p-2">Комната B</th>
            <th className="text-left p-2">Материал</th>
            <th className="text-left p-2">Длина, м</th>
            <th className="text-left p-2">Площадь, м²</th>
            <th className="text-left p-2">Кол-во</th>
            <th className="text-left p-2">Закупка</th>
            <th className="text-left p-2">Реализация</th>
            <th className="text-left p-2">Профит</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={idx} className={idx%2===0?'bg-white':'bg-gray-50'}>
              <td className={`p-2 ${colorClass??''}`}>{r.room1 || '-'}</td>
              <td className={`p-2 ${colorClass??''}`}>{r.room2 || '-'}</td>
              <td className={`p-2 ${colorClass??''}`}>{r.material}</td>
              <td className={`p-2 ${colorClass??''}`}>{nf.format(r.lengthM ?? 0)}</td>
              <td className={`p-2 ${colorClass??''}`}>{nf.format(r.areaM2)}</td>
              <td className={`p-2 ${colorClass??''}`}>{nf.format(r.qty)}</td>
              <td className={`p-2 ${colorClass??''}`}>{money.format(r.cost)}</td>
              <td className={`p-2 ${colorClass??''}`}>{money.format(r.revenue)}</td>
              <td className={`p-2 ${colorClass??''}`}>{money.format(r.profit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function useMmPerPx(projectId: Id<'projects'>) {
  const project = useQuery(api.projects.getProject, { projectId });
  return useMemo(() => {
    if (!project || !project.scale || project.scale.pixelLength === 0) return null;
    return project.scale.knownLength / project.scale.pixelLength;
  }, [project]);
}

function BaseboardsSummary({ projectId }: { projectId: Id<'projects'> }) {
  const mmPerPx = useMmPerPx(projectId);
  const lines = useQuery(api.svgElements.listSvgByProjectAndStage, { projectId, stageType: 'materials' });
  const projectMaterials = useQuery(api.materials.listProjectMaterials, { projectId, stageType: 'materials' });
  const defaultMaterials = useQuery(api.materials.listDefaults, { stageType: 'materials' });
  const nf = useMemo(() => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }), []);
  const money = useMemo(() => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }), []);
  const [showMaterials, setShowMaterials] = useState(false);

  const totals = useMemo(() => {
    if (!lines || !mmPerPx) return undefined;
    const mPerPx = mmPerPx / 1000;
    let lengthM = 0;
    let corners = 0;
    for (const el of lines) {
      if (el.elementType !== 'line') continue;
      const d: any = el.data ?? {};
      if (d.isBaseboard && Array.isArray(d.points) && d.points.length >= 2) {
        for (let i = 0; i < d.points.length - 1; i++) {
          const a = d.points[i]; const b = d.points[i+1];
          lengthM += Math.hypot(b.x - a.x, b.y - a.y) * mPerPx;
        }
        const pts = d.points as Array<{x:number;y:number}>;
        const n = pts.length;
        const isClosed = !!d.isClosed || (n >= 2 && Math.hypot(pts[0].x - pts[n-1].x, pts[0].y - pts[n-1].y) < 1e-6);
        if (isClosed) {
          const uniqueVertices = n > 1 ? n - 1 : 0;
          corners += uniqueVertices;
        } else {
          corners += Math.max(0, n - 2);
        }
      }
    }
    return { lengthM, corners };
  }, [lines, mmPerPx]);

  const materialsComputed = useMemo(() => {
    if (!totals) return undefined;
    const source = (projectMaterials && projectMaterials.length > 0) ? projectMaterials : (defaultMaterials ?? []);
    if (!source || source.length === 0) return undefined;
    const rows = source.map((row: any) => {
      const unit: string = (row.unit || '').toString().toLowerCase();
      const isCorner = unit.includes('угол') || unit.includes('corner');
      const qty = row.consumptionPerUnit * (isCorner ? totals.corners : totals.lengthM);
      const cost = qty * row.purchasePrice;
      const revenue = qty * row.sellPrice;
      const profit = revenue - cost;
      return { ...row, qty, cost, revenue, profit, basis: isCorner ? 'per_corner' : 'per_meter' };
    });
    const sums = rows.reduce((a: any, x: any) => ({ qty: a.qty + x.qty, cost: a.cost + x.cost, revenue: a.revenue + x.revenue, profit: a.profit + x.profit }), { qty: 0, cost: 0, revenue: 0, profit: 0 });
    return { rows, sums };
  }, [projectMaterials, defaultMaterials, totals]);

  return (
    <div className="mt-3 rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3,18 8,14 12,16 16,12 21,15"/></svg>
        </div>
        <div className="text-sm font-medium text-gray-900">Сводка этапа: Плинтусы</div>
        <div className="ml-auto flex items-center gap-2">
          
          <button className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-gray-800 text-white hover:bg-gray-900 disabled:opacity-50" onClick={() => setShowMaterials(true)} disabled={!materialsComputed}>Материалы</button>
        </div>
      </div>
      <div className="px-4 py-4 grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="rounded-md bg-purple-50 px-3 py-3 border border-purple-100">
          <div className="text-xs uppercase tracking-wide text-purple-700/80">Суммарная длина</div>
          <div className="mt-1 text-2xl font-semibold text-purple-700">{totals ? nf.format(totals.lengthM) : '—'} м</div>
        </div>
        <div className="rounded-md bg-purple-50 px-3 py-3 border border-purple-100">
          <div className="text-xs uppercase tracking-wide text-purple-700/80">Количество углов</div>
          <div className="mt-1 text-2xl font-semibold text-purple-700">{totals ? totals.corners : '—'}</div>
        </div>
      </div>
      {!mmPerPx && (
        <div className="px-4 pb-4 -mt-2 text-xs text-gray-500">Для отображения значений в метрах выполните калибровку масштаба.</div>
      )}

      {showMaterials && materialsComputed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="text-sm font-medium text-gray-900">Материалы этапа «Плинтусы»</div>
              <button className="text-gray-500 hover:text-gray-700" onClick={() => setShowMaterials(false)}>Закрыть</button>
            </div>
            <div className="p-4">
              <div className="rounded-md border border-gray-200 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left p-2">Материал</th>
                      <th className="text-left p-2">Основа</th>
                      <th className="text-left p-2">Норма</th>
                      <th className="text-left p-2">Ед.</th>
                      <th className="text-left p-2">Кол-во</th>
                      <th className="text-left p-2">Закупка</th>
                      <th className="text-left p-2">Реализация</th>
                      <th className="text-left p-2">Профит</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materialsComputed.rows.map((m: any, idx: number) => (
                      <tr key={m._id ?? idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="p-2">{m.name}</td>
                        <td className="p-2">{m.basis === 'per_corner' ? 'На угол' : 'На метр'}</td>
                        <td className="p-2">{nf.format(m.consumptionPerUnit)}</td>
                        <td className="p-2">{m.unit || '-'}</td>
                        <td className="p-2">{nf.format(m.qty)}</td>
                        <td className="p-2">{money.format(m.cost)}</td>
                        <td className="p-2">{money.format(m.revenue)}</td>
                        <td className="p-2">{money.format(m.profit)}</td>
                      </tr>
                    ))}
                    <tr className="bg-purple-50 font-medium">
                      <td className="p-2" colSpan={4}>Итого</td>
                      <td className="p-2">{nf.format(materialsComputed.sums.qty)}</td>
                      <td className="p-2">{money.format(materialsComputed.sums.cost)}</td>
                      <td className="p-2">{money.format(materialsComputed.sums.revenue)}</td>
                      <td className="p-2">{money.format(materialsComputed.sums.profit)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="text-xs text-gray-500 mt-3">Подсказка: для материалов "на метр" укажите единицу измерения, содержащую «м», для материалов "на угол" — единицу, содержащую «угол» (или англ. "corner").</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
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
    const list = source.map((row: { _id: string; name: string; unit?: string; consumptionPerUnit: number; purchasePrice: number; sellPrice: number }) => {
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
  }, [projectMaterials, defaultMaterials, totals]);

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
        {/* <div className="rounded-md bg-amber-50 px-3 py-3 border border-amber-100">
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
        </div> */}
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
    const list = source.map((row: { _id: string; name: string; unit?: string; consumptionPerUnit: number; purchasePrice: number; sellPrice: number }) => {
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
        {/* <div className="rounded-md bg-amber-50 px-3 py-3 border border-amber-100">
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
        </div> */}
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

