/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React from 'react';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';

// Helpers: rounding and sheet formatting
const r2 = (val: any) => {
  const n = Number(val) || 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
};

function formatNumericCellsTo2(ws: XLSX.WorkSheet) {
  const ref = ws['!ref'];
  if (!ref) return;
  const range = XLSX.utils.decode_range(ref);
  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[addr] as XLSX.CellObject | undefined;
      if (cell && cell.t === 'n') {
        cell.z = '0.00';
        if (typeof cell.v === 'number') cell.v = r2(cell.v);
      }
    }
  }
}

function setCols(ws: XLSX.WorkSheet, widths: number[]) {
  ws['!cols'] = widths.map((wch) => ({ wch }));
}

function addMerges(ws: XLSX.WorkSheet, merges: Array<string>) {
  const list = (ws['!merges'] || []) as XLSX.Range[];
  for (const m of merges) list.push(XLSX.utils.decode_range(m));
  ws['!merges'] = list;
}

// removed unused StageId

export default function ExportExcelButton({ projectId }: { projectId: Id<'projects'> }) {
  const project = useQuery(api.projects.getProject, { projectId });
  const mmPerPx = project?.scale ? (project.scale.knownLength / project.scale.pixelLength) : null;
  const mPerPx = mmPerPx ? mmPerPx / 1000 : null;

  // Подгружаем сводки/данные по этапам
  const summaryDemolition = useQuery(api.svgElements.getStageSummaryByProject, { projectId, stageType: 'demolition' });
  const summaryInstallation = useQuery(api.svgElements.getStageSummaryByProject, { projectId, stageType: 'installation' });
  const baseboardLines = useQuery(api.svgElements.listSvgByProjectAndStage, { projectId, stageType: 'materials' });
  const electricalEls = useQuery(api.svgElements.listSvgByProjectAndStage, { projectId, stageType: 'electrical' });
  const demoLines = useQuery(api.svgElements.listSvgByProjectAndStage, { projectId, stageType: 'demolition' });
  const instLines = useQuery(api.svgElements.listSvgByProjectAndStage, { projectId, stageType: 'installation' });
  const summaryMarkup = useQuery(api.svgElements.getStageSummaryByProject, { projectId, stageType: 'markup' });
  const rooms = useQuery(api.rooms.getRoomsWithGeometryByProject, { projectId });
  const openings = useQuery(api.rooms.listOpeningsByProject, { projectId });
  const roomTypes = useQuery(api.rooms.listRoomTypes, {});
  const roomTypeMats = useQuery(api.rooms.listAllRoomTypeMaterials, {});
  const roomTypeWorks = useQuery(api.rooms.listAllRoomTypeWorks as any, {} as any);
  const matsOpening = useQuery(api.rooms.listOpeningMaterials, { openingType: 'opening' });
  const matsDoor = useQuery(api.rooms.listOpeningMaterials, { openingType: 'door' });
  const matsWindow = useQuery(api.rooms.listOpeningMaterials, { openingType: 'window' });
  const worksOpening = useQuery(api.rooms.listOpeningWorks as any, { openingType: 'opening' } as any);
  const worksDoor = useQuery(api.rooms.listOpeningWorks as any, { openingType: 'door' } as any);
  const worksWindow = useQuery(api.rooms.listOpeningWorks as any, { openingType: 'window' } as any);

  // Материалы/Работы по этапам
  const matsDemolition = useQuery(api.materials.listProjectMaterials, { projectId, stageType: 'demolition' }) ?? [];
  const matsInstallation = useQuery(api.materials.listProjectMaterials, { projectId, stageType: 'installation' }) ?? [];
  const matsBaseboards = useQuery(api.materials.listProjectMaterials, { projectId, stageType: 'materials' }) ?? [];
  const matsElectrical = useQuery(api.materials.listProjectMaterials, { projectId, stageType: 'electrical' }) ?? [];
  const matsMarkup = useQuery(api.materials.listProjectMaterials, { projectId, stageType: 'markup' }) ?? [];
  const matsDefaults = {
    demolition: useQuery(api.materials.listDefaults, { stageType: 'demolition' }) ?? [],
    installation: useQuery(api.materials.listDefaults, { stageType: 'installation' }) ?? [],
    materials: useQuery(api.materials.listDefaults, { stageType: 'materials' }) ?? [],
    electrical: useQuery(api.materials.listDefaults, { stageType: 'electrical' }) ?? [],
    markup: useQuery(api.materials.listDefaults, { stageType: 'markup' }) ?? [],
  } as Record<string, any[]>;

  const worksDemolition = (useQuery(api.works.listProjectWorks as any, { projectId, stageType: 'demolition' } as any) ?? []) as any[];
  const worksInstallation = (useQuery(api.works.listProjectWorks as any, { projectId, stageType: 'installation' } as any) ?? []) as any[];
  const worksBaseboards = (useQuery(api.works.listProjectWorks as any, { projectId, stageType: 'materials' } as any) ?? []) as any[];
  const worksElectrical = (useQuery(api.works.listProjectWorks as any, { projectId, stageType: 'electrical' } as any) ?? []) as any[];
  const worksMarkup = (useQuery(api.works.listProjectWorks as any, { projectId, stageType: 'markup' } as any) ?? []) as any[];
  const worksDefaults = {
    demolition: (useQuery(api.works.listDefaults as any, { stageType: 'demolition' } as any) ?? []) as any[],
    installation: (useQuery(api.works.listDefaults as any, { stageType: 'installation' } as any) ?? []) as any[],
    materials: (useQuery(api.works.listDefaults as any, { stageType: 'materials' } as any) ?? []) as any[],
    electrical: (useQuery(api.works.listDefaults as any, { stageType: 'electrical' } as any) ?? []) as any[],
    markup: (useQuery(api.works.listDefaults as any, { stageType: 'markup' } as any) ?? []) as any[],
  } as Record<string, any[]>;

  const ceilingHeightM = project?.ceilingHeight ? (project.ceilingHeight >= 100 ? project.ceilingHeight/1000 : project.ceilingHeight) : null;

  const disabled = !project || !project.scale || !mPerPx;

  const computeBaseboards = () => {
    if (!baseboardLines || !mPerPx) return { lengthM: 0, corners: 0 };
    let lengthM = 0; let corners = 0;
    for (const el of baseboardLines) {
      if (el.elementType !== 'line') continue;
      const d: any = el.data ?? {};
      if (d.isBaseboard && Array.isArray(d.points) && d.points.length >= 2) {
        for (let i=0;i<d.points.length-1;i++) {
          const a=d.points[i]; const b=d.points[i+1]; lengthM += Math.hypot(b.x-a.x,b.y-a.y) * mPerPx;
        }
        const pts = d.points as Array<{x:number;y:number}>;
        const n = pts.length; const isClosed = !!d.isClosed || (n>=2 && Math.hypot(pts[0].x-pts[n-1].x, pts[0].y-pts[n-1].y)<1e-6);
        corners += isClosed ? (n>1?n-1:0) : Math.max(0, n-2);
      }
    }
    return { lengthM, corners };
  };

  const computeElectrical = () => {
    let spotlights=0, bras=0, outlets=0, switches=0, ledLengthM=0;
    if (electricalEls) {
      for (const el of electricalEls) {
        const st = (el as any).semanticType as string | undefined;
        if (st==='spotlight') spotlights++; else if (st==='bra') bras++; else if (st==='outlet') outlets++; else if (st==='switch') switches++;
        else if (st==='led' && mPerPx) {
          const d:any = el.data ?? {}; if (Array.isArray(d.points)&&d.points.length>=2){
            for (let i=0;i<d.points.length-1;i++){ const a=d.points[i], b=d.points[i+1]; ledLengthM += Math.hypot(b.x-a.x,b.y-a.y) * mPerPx; }
          }
        }
      }
    }
    return { spotlights, bras, outlets, switches, ledLengthM };
  };

  const selectRows = (projectRows: any[], defaultRows: any[]) => (projectRows && projectRows.length>0 ? projectRows : (defaultRows ?? []));

  const handleExport = async () => {
    if (disabled) return;
    let wb: XLSX.WorkBook = XLSX.utils.book_new();

    // ======= Подготовка блоков по этапам =======
    const blocksTotals: Record<string, number> = {};

    // Демонтаж
    const dem = summaryDemolition && ceilingHeightM && mPerPx ? {
      lengthM: summaryDemolition.totalLengthPx * mPerPx,
    } : { lengthM: 0 };
    const demMaterials = selectRows(matsDemolition, matsDefaults.demolition).map((row:any)=>{
      const qty = (row.consumptionPerUnit ?? 0) * dem.lengthM * (ceilingHeightM ?? 0);
      const cost = qty * (row.purchasePrice ?? 0);
      return [row.name, row.consumptionPerUnit, row.unit || '-', qty, cost] as [string, number, string, number, number];
    });
    const demWorks = selectRows(worksDemolition, worksDefaults.demolition).map((row:any)=>{
      const qty = (row.consumptionPerUnit ?? 0) * dem.lengthM * (ceilingHeightM ?? 0);
      const cost = qty * (row.purchasePrice ?? 0);
      return [row.name, row.consumptionPerUnit, 'ч', qty, cost] as [string, number, string, number, number];
    });
    blocksTotals['Демонтаж'] = [...demMaterials, ...demWorks].reduce((a,x)=>a+(x[4]||0),0);
    // Cоздаём отдельный лист «Демонтаж» (отключено)
    if (false) {
      const aoa: any[][] = [];
      aoa.push(['Сводка этапа: Демонтаж']);
      aoa.push(['Длина стен, м', dem.lengthM]);
      aoa.push(['Высота, м', ceilingHeightM ?? 0]);
      aoa.push(['Площадь стен, м²', (dem.lengthM*(ceilingHeightM ?? 0))]);
      aoa.push(['']);
      // Материалы слева
      const matAoa = [['Материалы', '', '', '', ''], ['Наименование','Норма','Ед.','Кол-во','Сумма'], ...demMaterials];
      // Работы справа
      const workAoa = [['Работы (ед.: ч)','','','',''], ['Наименование','Норма','Ед.','Кол-во','Сумма'], ...demWorks];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      XLSX.utils.sheet_add_aoa(ws, matAoa, { origin: 'A6' });
      XLSX.utils.sheet_add_aoa(ws, workAoa, { origin: 'G6' });
      addMerges(ws, ['A6:E6','G6:K6']);
      setCols(ws, [22,12,8,12,16, 4, 22,12,8,12,16]);
      formatNumericCellsTo2(ws);
      XLSX.utils.book_append_sheet(wb, ws, 'Демонтаж');
    }

    // Монтаж
    const inst = summaryInstallation && mPerPx ? { lengthM: summaryInstallation.totalLengthPx * mPerPx } : { lengthM: 0 };
    const instMaterials = selectRows(matsInstallation, matsDefaults.installation).map((row:any)=>{
      const qty = (row.consumptionPerUnit ?? 0) * inst.lengthM * (ceilingHeightM ?? 0);
      const cost = qty * (row.purchasePrice ?? 0);
      return [row.name, row.consumptionPerUnit, row.unit || '-', qty, cost];
    });
    const instWorks = selectRows(worksInstallation, worksDefaults.installation).map((row:any)=>{
      const qty = (row.consumptionPerUnit ?? 0) * inst.lengthM * (ceilingHeightM ?? 0);
      const cost = qty * (row.purchasePrice ?? 0);
      return [row.name, row.consumptionPerUnit, 'ч', qty, cost];
    });
    blocksTotals['Монтаж'] = [...instMaterials, ...instWorks].reduce((a,x)=>a+(x[4]||0),0);
    // Лист «Монтаж» (отключено)
    if (false) {
      const aoa: any[][] = [];
      aoa.push(['Сводка этапа: Монтаж']);
      aoa.push(['Длина стен, м', inst.lengthM]);
      aoa.push(['Высота, м', ceilingHeightM ?? 0]);
      aoa.push(['Площадь стен, м²', (inst.lengthM*(ceilingHeightM ?? 0))]);
      aoa.push(['']);
      const matAoa = [['Материалы','','','',''], ['Наименование','Норма','Ед.','Кол-во','Сумма'], ...instMaterials];
      const workAoa = [['Работы (ед.: ч)','','','',''], ['Наименование','Норма','Ед.','Кол-во','Сумма'], ...instWorks];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      XLSX.utils.sheet_add_aoa(ws, matAoa, { origin: 'A6' });
      XLSX.utils.sheet_add_aoa(ws, workAoa, { origin: 'G6' });
      addMerges(ws, ['A6:E6','G6:K6']);
      setCols(ws, [22,12,8,12,16, 4, 22,12,8,12,16]);
      formatNumericCellsTo2(ws);
      XLSX.utils.book_append_sheet(wb, ws, 'Монтаж');
    }

    // Плинтусы
    const base = computeBaseboards();
    const baseMaterials = selectRows(matsBaseboards, matsDefaults.materials).map((row:any)=>{
      const unit = (row.unit || '').toString().toLowerCase();
      const isCorner = unit.includes('угол') || unit.includes('corner');
      const basis = isCorner ? base.corners : base.lengthM;
      const qty = (row.consumptionPerUnit ?? 0) * basis;
      const cost = qty * (row.purchasePrice ?? 0);
      return [row.name, row.consumptionPerUnit, isCorner ? 'угол' : (row.unit || '-'), qty, cost];
    });
    const baseWorks = selectRows(worksBaseboards, worksDefaults.materials).map((row:any)=>{
      const unit = (row.unit || '').toString().toLowerCase();
      const isCorner = unit.includes('угол') || unit.includes('corner');
      const basis = isCorner ? base.corners : base.lengthM;
      const qty = (row.consumptionPerUnit ?? 0) * basis;
      const cost = qty * (row.purchasePrice ?? 0);
      return [row.name, row.consumptionPerUnit, 'ч', qty, cost];
    });
    blocksTotals['Плинтусы'] = [...baseMaterials, ...baseWorks].reduce((a,x)=>a+(x[4]||0),0);
    // Лист «Плинтусы» (отключено)
    if (false) {
      const aoa: any[][] = [];
      aoa.push(['Сводка этапа: Плинтусы']);
      aoa.push(['Длина, м', base.lengthM]);
      aoa.push(['Количество углов, шт', base.corners]);
      aoa.push(['']);
      const matAoa = [['Материалы','','','',''], ['Наименование','Норма','Ед.','Кол-во','Сумма'], ...baseMaterials];
      const workAoa = [['Работы (ед.: ч)','','','',''], ['Наименование','Норма','Ед.','Кол-во','Сумма'], ...baseWorks];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      XLSX.utils.sheet_add_aoa(ws, matAoa, { origin: 'A6' });
      XLSX.utils.sheet_add_aoa(ws, workAoa, { origin: 'G6' });
      addMerges(ws, ['A6:E6','G6:K6']);
      setCols(ws, [22,12,8,12,16, 4, 22,12,8,12,16]);
      formatNumericCellsTo2(ws);
      XLSX.utils.book_append_sheet(wb, ws, 'Плинтусы');
    }

    // Электрика
    const elec = computeElectrical();
    const elecMaterials = selectRows(matsElectrical, matsDefaults.electrical).map((row:any)=>{
      const t = row.triggerType as 'spotlight'|'bra'|'led'|'outlet'|'switch'|undefined;
      const basis = t==='spotlight'? elec.spotlights : t==='bra'? elec.bras : t==='outlet'? elec.outlets : t==='switch'? elec.switches : t==='led'? elec.ledLengthM : 0;
      const qty = (row.consumptionPerUnit ?? 0) * basis;
      const cost = qty * (row.purchasePrice ?? 0);
      return [row.name, row.consumptionPerUnit, row.unit || '-', qty, cost];
    });
    const elecWorks = selectRows(worksElectrical, worksDefaults.electrical).map((row:any)=>{
      const t = row.triggerType as 'spotlight'|'bra'|'led'|'outlet'|'switch'|undefined;
      const basis = t==='spotlight'? elec.spotlights : t==='bra'? elec.bras : t==='outlet'? elec.outlets : t==='switch'? elec.switches : t==='led'? elec.ledLengthM : 0;
      const qty = (row.consumptionPerUnit ?? 0) * basis;
      const cost = qty * (row.purchasePrice ?? 0);
      return [row.name, row.consumptionPerUnit, 'ч', qty, cost];
    });
    blocksTotals['Электрика'] = [...elecMaterials, ...elecWorks].reduce((a,x)=>a+(x[4]||0),0);
    // Лист «Электрика» (отключено)
    if (false) {
      const aoa: any[][] = [];
      aoa.push(['Сводка этапа: Электрика']);
      aoa.push(['Светильники, шт', elec.spotlights]);
      aoa.push(['Бра, шт', elec.bras]);
      aoa.push(['Розетки, шт', elec.outlets]);
      aoa.push(['Выключатели, шт', elec.switches]);
      aoa.push(['LED-ленты, м', elec.ledLengthM]);
      aoa.push(['']);
      const matAoa = [['Материалы','','','',''], ['Наименование','Норма','Ед.','Кол-во','Сумма'], ...elecMaterials];
      const workAoa = [['Работы (ед.: ч)','','','',''], ['Наименование','Норма','Ед.','Кол-во','Сумма'], ...elecWorks];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      XLSX.utils.sheet_add_aoa(ws, matAoa, { origin: 'A8' });
      XLSX.utils.sheet_add_aoa(ws, workAoa, { origin: 'G8' });
      addMerges(ws, ['A8:E8','G8:K8']);
      setCols(ws, [22,12,8,12,16, 4, 22,12,8,12,16]);
      formatNumericCellsTo2(ws);
      XLSX.utils.book_append_sheet(wb, ws, 'Электрика');
    }

    // Отделка (Разметка)
    const markupTotals = (() => {
      const res = { perimeterM: 0, floorM2: 0, wallM2: 0, openingsAreaM2: 0 };
      if (!rooms || !mPerPx || !ceilingHeightM) return res;
      for (const r of rooms) {
        let perimPx=0, area2=0; const pts = r.points as Array<{x:number;y:number}>;
        for (let i=0;i<pts.length;i++){ const a=pts[i], b=pts[(i+1)%pts.length]; perimPx += Math.hypot(b.x-a.x,b.y-a.y); area2 += (a.x*b.y - b.x*a.y); }
        const perimM = perimPx * mPerPx; const floorM2 = Math.abs(area2)/2 * (mPerPx*mPerPx);
        let openingsAreaM2 = 0;
        const rel = (openings as any[]|undefined)?.filter(o => o.roomId1 === (r.roomId as any) || o.roomId2 === (r.roomId as any)) ?? [];
        for (const op of rel) { const lenM = op.lengthPx * mPerPx; const hM = (op.heightMm ?? 0)/1000; openingsAreaM2 += lenM * hM; }
        res.perimeterM += perimM; res.floorM2 += floorM2; res.openingsAreaM2 += openingsAreaM2; res.wallM2 += Math.max(0, perimM*ceilingHeightM - openingsAreaM2);
      }
      return res;
    })();
    const markupMaterialsRoomTypes = (() => {
      const out: any[] = [];
      if (!roomTypeMats) return out;
      for (const m of roomTypeMats as any[]) {
        const basisVal = m.basis === 'floor_m2' ? markupTotals.floorM2 : markupTotals.wallM2;
        const qty = (m.consumptionPerUnit ?? 0) * basisVal; const cost = qty * (m.purchasePrice ?? 0);
        out.push([m.name, m.consumptionPerUnit, m.unit || '-', qty, cost]);
      }
      return out;
    })();
    const markupMaterialsOpenings = (() => {
      const out: any[] = [];
      const perType = { opening: matsOpening ?? [], door: matsDoor ?? [], window: matsWindow ?? [] } as Record<'opening'|'door'|'window', any[]>;
      if (!openings || !mPerPx) return out;
      for (const t of ['opening','door','window'] as const) {
        const rel = (openings as any[]).filter(o => o.openingType === t);
        let areaM2 = 0; for (const op of rel) { areaM2 += (op.lengthPx * mPerPx) * ((op.heightMm ?? 0)/1000); }
        for (const m of perType[t]) {
          const basis = (m.basis === 'per_opening') ? 'per_opening' : 'opening_m2';
          const qty = (m.consumptionPerUnit ?? 0) * (basis==='per_opening' ? rel.length : areaM2);
          const cost = qty * (m.purchasePrice ?? 0);
          out.push([m.name, m.consumptionPerUnit, m.unit || '-', qty, cost]);
        }
      }
      return out;
    })();
    const markupMaterialsLegacy = (() => {
      const src = selectRows(matsMarkup, matsDefaults.markup);
      if (!summaryMarkup || !mPerPx) return [] as any[];
      const m2Factor = (mPerPx*mPerPx);
      const doorsM2 = (summaryMarkup.doors?.areaPx2 ?? 0) * m2Factor;
      const windowsM2 = (summaryMarkup.windows?.areaPx2 ?? 0) * m2Factor;
      return (src as any[]).filter(r => r.triggerType==='door' || r.triggerType==='window').map((r:any)=>{
        const basis = r.triggerType==='door' ? doorsM2 : windowsM2;
        const qty = (r.consumptionPerUnit ?? 0) * basis; const cost = qty * (r.purchasePrice ?? 0);
        return [r.name, r.consumptionPerUnit, r.unit || '-', qty, cost];
      });
    })();
    const markupMaterials = [...markupMaterialsRoomTypes, ...markupMaterialsOpenings, ...markupMaterialsLegacy];

    const markupWorksRoomTypes = (() => {
      const out: any[] = [];
      if (!roomTypeWorks) return out;
      for (const w of roomTypeWorks as any[]) {
        const basisVal = w.basis === 'floor_m2' ? markupTotals.floorM2 : markupTotals.wallM2;
        const qty = (w.consumptionPerUnit ?? 0) * basisVal; const cost = qty * (w.purchasePrice ?? 0);
        out.push([w.name, w.consumptionPerUnit, 'ч', qty, cost]);
      }
      return out;
    })();
    const markupWorksOpenings = (() => {
      const out: any[] = [];
      const perType = { opening: worksOpening ?? [], door: worksDoor ?? [], window: worksWindow ?? [] } as Record<'opening'|'door'|'window', any[]>;
      if (!openings || !mPerPx) return out;
      for (const t of ['opening','door','window'] as const) {
        const rel = (openings as any[]).filter(o => o.openingType === t);
        let areaM2 = 0; for (const op of rel) { areaM2 += (op.lengthPx * mPerPx) * ((op.heightMm ?? 0)/1000); }
        for (const m of perType[t]) {
          const basis = (m.basis === 'per_opening') ? 'per_opening' : 'opening_m2';
          const qty = (m.consumptionPerUnit ?? 0) * (basis==='per_opening' ? rel.length : areaM2);
          const cost = qty * (m.purchasePrice ?? 0);
          out.push([m.name, m.consumptionPerUnit, 'ч', qty, cost]);
        }
      }
      return out;
    })();
    const markupWorksLegacy = (() => {
      const src = selectRows(worksMarkup, worksDefaults.markup);
      if (!summaryMarkup || !mPerPx) return [] as any[];
      const m2Factor = (mPerPx*mPerPx);
      const doorsM2 = (summaryMarkup.doors?.areaPx2 ?? 0) * m2Factor;
      const windowsM2 = (summaryMarkup.windows?.areaPx2 ?? 0) * m2Factor;
      return (src as any[]).filter(r => r.triggerType==='door' || r.triggerType==='window').map((r:any)=>{
        const basis = r.triggerType==='door' ? doorsM2 : windowsM2;
        const qty = (r.consumptionPerUnit ?? 0) * basis; const cost = qty * (r.purchasePrice ?? 0);
        return [r.name, r.consumptionPerUnit, 'ч', qty, cost];
      });
    })();
    const markupWorks = [...markupWorksRoomTypes, ...markupWorksOpenings, ...markupWorksLegacy];
    blocksTotals['Отделка'] = [...markupMaterials, ...markupWorks].reduce((a,x)=>a+(x[4]||0),0);
    // Лист «Отделка» (отключено)
    if (false) {
      const aoa: any[][] = [];
      aoa.push(['Сводка этапа: Отделка']);
      aoa.push(['Периметр комнат, м', markupTotals.perimeterM]);
      aoa.push(['Площадь пола, м²', markupTotals.floorM2]);
      aoa.push(['Площадь стен, м²', markupTotals.wallM2]);
      aoa.push(['']);
      const matAoa = [['Материалы','','','',''], ['Наименование','Норма','Ед.','Кол-во','Сумма'], ...markupMaterials];
      const workAoa = [['Работы (ед.: ч)','','','',''], ['Наименование','Норма','Ед.','Кол-во','Сумма'], ...markupWorks];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      XLSX.utils.sheet_add_aoa(ws, matAoa, { origin: 'A6' });
      XLSX.utils.sheet_add_aoa(ws, workAoa, { origin: 'G6' });
      addMerges(ws, ['A6:E6','G6:K6']);
      setCols(ws, [22,12,8,12,16, 4, 22,12,8,12,16]);
      formatNumericCellsTo2(ws);
      XLSX.utils.book_append_sheet(wb, ws, 'Отделка');
    }
    // ======= Лист «Смета» по фикс-правилам =======
    const estimate: any[][] = [];
    estimate.push(['Смета проекта']);
    estimate.push([project?.name ?? '']);
    estimate.push(['']);
    estimate.push(['Наименование работ', 'Ед.', 'Кол-во', 'За ед., ₽', 'Сумма, ₽']);

    const pushRow = (name: string, unit: string, qty: number, price: number) => {
      const q = Number(qty) || 0;
      const p = Number(price) || 0;
      const s = q * p;
      estimate.push([name, unit, r2(q), r2(p), r2(s)]);
    };

    const demAreaM2 = r2((dem.lengthM || 0) * (ceilingHeightM || 0));
    const instAreaM2 = r2((inst.lengthM || 0) * (ceilingHeightM || 0));
    const totalsByRoom = (() => {
      const out = { floorM2: 0, wallM2: 0, wallM2Living: 0, wallM2Bath: 0, floorM2Bath: 0, floorM2Living: 0 };
      if (!rooms || !mPerPx || !ceilingHeightM) return out;
      const bathIds = new Set((roomTypes ?? []).filter((t:any)=> (t.name||'').toString().toLowerCase()==='ванная').map((t:any)=> t._id as string));
      for (const r of rooms) {
        let perimPx = 0; let area2 = 0; const pts = r.points as Array<{x:number;y:number}>;
        for (let i=0;i<pts.length;i++){ const a=pts[i], b=pts[(i+1)%pts.length]; perimPx += Math.hypot(b.x-a.x,b.y-a.y); area2 += (a.x*b.y - b.x*a.y); }
        const perimM = perimPx * mPerPx; const floorM2 = Math.abs(area2)/2 * (mPerPx*mPerPx);
        let openingsAreaM2 = 0; const rel = (openings as any[]|undefined)?.filter(o => o.roomId1 === (r.roomId as any) || o.roomId2 === (r.roomId as any)) ?? [];
        for (const op of rel) { const lenM = op.lengthPx * mPerPx; const hM = (op.heightMm ?? 0)/1000; openingsAreaM2 += lenM * hM; }
        const wallM2 = Math.max(0, perimM*ceilingHeightM - openingsAreaM2);
        out.floorM2 += floorM2; out.wallM2 += wallM2;
        if (bathIds.has(r.roomTypeId as any)) { out.wallM2Bath += wallM2; out.floorM2Bath += floorM2; }
        else { out.wallM2Living += wallM2; out.floorM2Living += floorM2; }
      }
      return out;
    })();
    const baseTotals = computeBaseboards();

    pushRow('Демонтаж перегородок', 'м²', demAreaM2, 200);
    pushRow('Кладка перегородок', 'м²', instAreaM2, 220);
    pushRow('Заливка стяжки', 'м²', totalsByRoom.floorM2, 220);
    pushRow('Штукатурка стен', 'м²', totalsByRoom.wallM2, 150);
    pushRow('Финишная шпаклёвка', 'м²', totalsByRoom.wallM2Living, 180);
    pushRow('Укладка плитки', 'м²', totalsByRoom.wallM2Bath + totalsByRoom.floorM2Bath, 900);
    pushRow('Установка плинтуса', 'м', baseTotals.lengthM, 99);

    estimate.push(['', '', '', '', '']);
    const totalSum = r2(estimate.slice(4).reduce((acc, row) => acc + (Number(row[4]) || 0), 0));
    estimate.push(['Итого', '', '', '', totalSum]);

    // Подготовим данные для листа Обмер заранее (используем и в шаблонной ветке, и в фоллбэке)
    const vols: any[][] = (() => {
      const out: any[][] = [];
      if (!(rooms && openings && mPerPx)) return out;
      // Таблица по комнатам
      const rws: any[] = [['Наименование', 'Периметр, м', 'Площадь, м²', 'Площадь стен, м²', 'Высота, м']];
      const H = ceilingHeightM ?? 0;
      for (const r of rooms) {
        let perimPx = 0; let area2=0; const pts=r.points as Array<{x:number;y:number}>;
        for (let i=0;i<pts.length;i++){ const a=pts[i], b=pts[(i+1)%pts.length]; perimPx += Math.hypot(b.x-a.x,b.y-a.y); area2 += (a.x*b.y - b.x*a.y);}    
        const floorM2 = Math.abs(area2)/2 * (mPerPx*mPerPx);
        // минус площадь проёмов для этой комнаты
        let openingsAreaM2 = 0;
        const rel = (openings as any[]).filter(o => o.roomId1 === (r.roomId as any) || o.roomId2 === (r.roomId as any));
        for (const op of rel) {
          const lengthM = op.lengthPx * mPerPx; const hM = (op.heightMm ?? 0)/1000; openingsAreaM2 += lengthM * hM;
        }
        const wallM2 = Math.max(0, perimPx * mPerPx * H - openingsAreaM2);
        const typeName = (roomTypes ?? []).find((t:any)=> (t._id as string) === (r.roomTypeId as any))?.name || '';
        rws.push([`${r.name}${typeName?' ('+typeName+')':''}`, r2(perimPx*mPerPx), r2(floorM2), r2(wallM2), r2(H)]);
      }
      out.push(...rws);
      // Таблица по проёмам
      out.push(['']);
      out.push(['Проёмы']);
      out.push(['Проём', 'Тип', 'Высота, м', 'Длина, м', 'Вертикальная площадь, м²']);
      if (openings && mPerPx) {
        const roomIndexById = new Map<string, number>();
        rooms.forEach((r: any, idx: number) => roomIndexById.set(r.roomId as string, idx + 1));
        let idxOp = 1;
        const typeLabel: Record<'opening'|'door'|'window', string> = { opening: 'проём', door: 'дверь', window: 'окно' };
        for (const op of openings as any[]) {
          const lengthM = (op.lengthPx ?? 0) * mPerPx;
          const heightM = ((op.heightMm ?? 0) / 1000);
          const verticalAreaM2 = lengthM * heightM;
          const i = roomIndexById.get(op.roomId1 as string);
          const j = op.roomId2 ? roomIndexById.get(op.roomId2 as string) : undefined;
          const label = (i && j) ? `Проём ${i}-${j}` : (i ? `Проём ${i}` : `Проём ${idxOp}`);
          const t: 'opening'|'door'|'window' = op.openingType as any;
          out.push([label, typeLabel[t], r2(heightM), r2(lengthM), r2(verticalAreaM2)]);
          idxOp++;
        }
      }
      // Демонтаж детально
      out.push(['']); out.push(['Демонтаж']); out.push(['Стена', 'Длина, м', 'Площадь, м²', 'Высота, м']);
      if (demoLines && ceilingHeightM) {
        let idx = 1;
        for (const el of demoLines) {
          if (el.elementType !== 'line') continue;
          const pts = (el.data?.points ?? []) as Array<{x:number;y:number}>;
          if (!Array.isArray(pts) || pts.length < 2) continue;
          let lengthM = 0; for (let i=0;i<pts.length-1;i++){ lengthM += Math.hypot(pts[i+1].x-pts[i].x, pts[i+1].y-pts[i].y) * mPerPx!; }
          out.push([`Стена ${idx++}`, r2(lengthM), r2(lengthM * ceilingHeightM), r2(ceilingHeightM)]);
        }
      }
      // Монтаж детально
      out.push(['']); out.push(['Монтаж']); out.push(['Стена', 'Длина, м', 'Площадь, м²', 'Высота, м']);
      if (instLines && ceilingHeightM) {
        let idx = 1;
        for (const el of instLines) {
          if (el.elementType !== 'line') continue;
          const pts = (el.data?.points ?? []) as Array<{x:number;y:number}>;
          if (!Array.isArray(pts) || pts.length < 2) continue;
          let lengthM = 0; for (let i=0;i<pts.length-1;i++){ lengthM += Math.hypot(pts[i+1].x-pts[i].x, pts[i+1].y-pts[i].y) * mPerPx!; }
          out.push([`Стена ${idx++}`, r2(lengthM), r2(lengthM * ceilingHeightM), r2(ceilingHeightM)]);
        }
      }
      // Электрика
      const e = computeElectrical();
      out.push(['']); out.push(['Электрика']); out.push(['Наименование', 'Кол-во']);
      out.push(['Светильники', r2(e.spotlights)]);
      out.push(['Бра', r2(e.bras)]);
      out.push(['Розетки', r2(e.outlets)]);
      out.push(['Выключатели', r2(e.switches)]);
      out.push(['LED-ленты, м', r2(e.ledLengthM)]);
      // Плинтус
      out.push(['']); out.push(['Плинтус']); out.push(['Длина, м', r2(base.lengthM || 0)]); out.push(['Углы, шт', r2(base.corners || 0)]);
      return out;
    })();

    // Попытка применить шаблон через exceljs (сохранение стилей)
    try {
      const resp = await fetch('/estimate_template.xlsx');
      if (resp.ok) {
        const buf = await resp.arrayBuffer();
        const ej = new ExcelJS.Workbook();
        await ej.xlsx.load(buf);
        const ws = ej.getWorksheet('Смета') ?? ej.worksheets[0];
        // Replace placeholders preserving styles
        ws.eachRow({ includeEmpty: true }, (row)=>{
          row.eachCell({ includeEmpty: true }, (cell)=>{
            const v = (cell.value ?? '') as any;
            if (typeof v === 'string') {
              let s = v as string;
              s = s.replaceAll('[[DATE]]', new Date().toLocaleDateString('ru-RU')).replaceAll('DATE', new Date().toLocaleDateString('ru-RU'));
              s = s.replaceAll('[[PROJECT_NAME]]', project?.name ?? '').replaceAll('PROJECT_NAME', project?.name ?? '');
              if (s !== v) cell.value = s;
            }
          });
        });
        // Find SMETA_START
        let startRow = -1, startCol = -1;
        ws.eachRow({ includeEmpty: true }, (row, rIdx)=>{
          row.eachCell({ includeEmpty: true }, (cell, cIdx)=>{
            const raw = cell.value as any;
            let text = '';
            if (typeof raw === 'string') text = raw;
            else if (raw && typeof raw === 'object' && Array.isArray((raw as any).richText)) {
              text = ((raw as any).richText as Array<{ text: string }>).map(t=>t.text).join('');
            }
            const norm = text.replace(/\s|\u00A0|\[|\]/g, '').toUpperCase();
            if (norm.includes('SMETASTART') || norm.includes('SMETA_START')) {
              startRow = rIdx; startCol = cIdx; cell.value='';
            }
          });
        });
        if (startRow > 0 && startCol > 0) {
          const data = estimate.slice(4);
          const baseRow = ws.getRow(startRow);
          const baseRowHeight = baseRow.height; // может быть undefined
          // Сохраним ширины задействованных колонок (если заданы в шаблоне)
          const baseColWidths: Record<number, number | undefined> = {};
          for (let j = 0; j < (data[0]?.length || 0); j++) {
            const colIdx = startCol + j;
            baseColWidths[colIdx] = ws.getColumn(colIdx).width;
          }
          for (let i=0;i<data.length;i++){
            const row = ws.getRow(startRow + i);
            for (let j=0;j<data[i].length;j++){
              const cell = row.getCell(startCol + j);
              const baseCell = baseRow.getCell(startCol + j);
              cell.value = data[i][j] as any;
              cell.style = { ...baseCell.style };
            }
            if (typeof baseRowHeight === 'number') row.height = baseRowHeight;
            row.commit?.();
          }
          // Вернём ширины колонок (на случай если exceljs их изменил)
          Object.entries(baseColWidths).forEach(([idx, w])=>{ if (typeof w === 'number') ws.getColumn(Number(idx)).width = w; });
        }
        // Обмер лист
        const wsObm = ej.getWorksheet('Обмер') ?? ej.addWorksheet('Обмер');
        wsObm.spliceRows(1, wsObm.rowCount, ...vols.map(r=>r));
        // ширины колонок для «Обмер»
        const obmWidths = [40, 22, 22, 22, 14];
        wsObm.columns = obmWidths.map(w=>({ width: w }));
        const out = await ej.xlsx.writeBuffer();
        const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href=url; a.download=`Смета_${project?.name ?? 'проект'}_${new Date().toISOString().slice(0,10)}.xlsx`; a.click(); URL.revokeObjectURL(url);
        return;
      }
    } catch {}
    if (!wb || !wb.SheetNames || wb.SheetNames.length === 0) {
      const wsEstimate = XLSX.utils.aoa_to_sheet(estimate);
      addMerges(wsEstimate, ['A1:E1']);
      setCols(wsEstimate, [36, 10, 12, 12, 16]);
      formatNumericCellsTo2(wsEstimate);
      XLSX.utils.book_append_sheet(wb, wsEstimate, 'Смета');
      const wsRooms = XLSX.utils.aoa_to_sheet(vols);
      setCols(wsRooms, [32,18,18,18,12]);
      formatNumericCellsTo2(wsRooms);
      XLSX.utils.book_append_sheet(wb, wsRooms, 'Обмер');
    }

    // Листы по этапам добавлены выше

    // Лист «Обмер»
    if (rooms && openings && mPerPx) {
      const vols: any[][] = [];
      // (Удалён блок «Сводка по объектам» по требованию)

      // Таблица по комнатам
      const rws: any[] = [['Наименование', 'Периметр, м', 'Площадь, м²', 'Площадь стен, м²', 'Высота, м']];
      const H = ceilingHeightM ?? 0;
      for (const r of rooms) {
        let perimPx = 0; let area2=0; const pts=r.points as Array<{x:number;y:number}>;
        for (let i=0;i<pts.length;i++){ const a=pts[i], b=pts[(i+1)%pts.length]; perimPx += Math.hypot(b.x-a.x,b.y-a.y); area2 += (a.x*b.y - b.x*a.y);}    
        const floorM2 = Math.abs(area2)/2 * (mPerPx*mPerPx);
        // минус площадь проёмов для этой комнаты
        let openingsAreaM2 = 0;
        const rel = (openings as any[]).filter(o => o.roomId1 === (r.roomId as any) || o.roomId2 === (r.roomId as any));
        for (const op of rel) {
          const lengthM = op.lengthPx * mPerPx; const hM = (op.heightMm ?? 0)/1000; openingsAreaM2 += lengthM * hM;
        }
        const wallM2 = Math.max(0, perimPx * mPerPx * H - openingsAreaM2);
        const typeName = (roomTypes ?? []).find((t:any)=> (t._id as string) === (r.roomTypeId as any))?.name || '';
        rws.push([`${r.name}${typeName?' ('+typeName+')':''}`, r2(perimPx*mPerPx), r2(floorM2), r2(wallM2), r2(H)]);
      }
      vols.push(...rws);

      // Таблица по проёмам
      vols.push(['']);
      vols.push(['Проёмы']);
      vols.push(['Проём', 'Тип', 'Высота, м', 'Длина, м', 'Вертикальная площадь, м²']);
      if (openings && mPerPx) {
        // Нумерация комнат для подписи пар (roomIndex)
        const roomIndexById = new Map<string, number>();
        rooms.forEach((r: any, idx: number) => roomIndexById.set(r.roomId as string, idx + 1));
        let idxOp = 1;
        const typeLabel: Record<'opening'|'door'|'window', string> = { opening: 'проём', door: 'дверь', window: 'окно' };
        for (const op of openings as any[]) {
          const lengthM = (op.lengthPx ?? 0) * mPerPx;
          const heightM = ((op.heightMm ?? 0) / 1000);
          const verticalAreaM2 = lengthM * heightM; // длина × высота
          const i = roomIndexById.get(op.roomId1 as string);
          const j = op.roomId2 ? roomIndexById.get(op.roomId2 as string) : undefined;
          const label = (i && j) ? `Проём ${i}-${j}` : (i ? `Проём ${i}` : `Проём ${idxOp}`);
          const t: 'opening'|'door'|'window' = op.openingType as any;
          vols.push([label, typeLabel[t], r2(heightM), r2(lengthM), r2(verticalAreaM2)]);
          idxOp++;
        }
      }

      // Демонтаж — детализация по стенам
      vols.push(['']);
      vols.push(['Демонтаж']);
      vols.push(['Стена', 'Длина, м', 'Площадь, м²', 'Высота, м']);
      if (demoLines && ceilingHeightM) {
        let idx = 1;
        for (const el of demoLines) {
          if (el.elementType !== 'line') continue;
          const pts = (el.data?.points ?? []) as Array<{x:number;y:number}>;
          if (!Array.isArray(pts) || pts.length < 2) continue;
          let lengthM = 0; for (let i=0;i<pts.length-1;i++){ lengthM += Math.hypot(pts[i+1].x-pts[i].x, pts[i+1].y-pts[i].y) * mPerPx!; }
          vols.push([`Стена ${idx++}`, r2(lengthM), r2(lengthM * ceilingHeightM), r2(ceilingHeightM)]);
        }
      }

      // Монтаж — детализация по стенам
      vols.push(['']);
      vols.push(['Монтаж']);
      vols.push(['Стена', 'Длина, м', 'Площадь, м²', 'Высота, м']);
      if (instLines && ceilingHeightM) {
        let idx = 1;
        for (const el of instLines) {
          if (el.elementType !== 'line') continue;
          const pts = (el.data?.points ?? []) as Array<{x:number;y:number}>;
          if (!Array.isArray(pts) || pts.length < 2) continue;
          let lengthM = 0; for (let i=0;i<pts.length-1;i++){ lengthM += Math.hypot(pts[i+1].x-pts[i].x, pts[i+1].y-pts[i].y) * mPerPx!; }
          vols.push([`Стена ${idx++}`, r2(lengthM), r2(lengthM * ceilingHeightM), r2(ceilingHeightM)]);
        }
      }

      // Электрика
      vols.push(['']);
      vols.push(['Электрика']);
      vols.push(['Наименование', 'Кол-во']);
      const e = computeElectrical();
      vols.push(['Светильники', r2(e.spotlights)]);
      vols.push(['Бра', r2(e.bras)]);
      vols.push(['Розетки', r2(e.outlets)]);
      vols.push(['Выключатели', r2(e.switches)]);
      vols.push(['LED-ленты, м', r2(e.ledLengthM)]);

      // Плинтус
      vols.push(['']);
      vols.push(['Плинтус']);
      vols.push(['Длина, м', r2(base.lengthM || 0)]);
      vols.push(['Углы, шт', r2(base.corners || 0)]);

      const wsRooms = XLSX.utils.aoa_to_sheet(vols);
      setCols(wsRooms, [32,18,18,18,12]);
      formatNumericCellsTo2(wsRooms);
      XLSX.utils.book_append_sheet(wb, wsRooms, 'Обмер');
    }

    // Генерация файла
    const filename = `Смета_${project?.name ?? 'проект'}_${new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  return (
    <button
      className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-gray-800 text-white hover:bg-gray-900 disabled:opacity-50"
      onClick={handleExport}
      disabled={disabled}
      title={disabled ? 'Доступно после калибровки масштаба' : 'Экспорт сметы в Excel'}
    >
      Экспорт в Excel
    </button>
  );
}


