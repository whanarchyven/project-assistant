"use client";

import Link from "next/link";

export default function SettingsPage() {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Настройки</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link href="/materials/defaults" className="block rounded-md border border-gray-200 p-4 hover:border-gray-300 hover:bg-gray-50">
          <div className="text-sm font-medium text-gray-900">Библиотека материалов</div>
          <div className="text-xs text-gray-600 mt-1">Настройка дефолтных материалов по этапам</div>
        </Link>
        <Link href="/rooms/types" className="block rounded-md border border-gray-200 p-4 hover:border-gray-300 hover:bg-gray-50">
          <div className="text-sm font-medium text-gray-900">Типы комнат</div>
          <div className="text-xs text-gray-600 mt-1">Создание типов комнат и их материалов</div>
        </Link>
        <Link href="/openings/materials" className="block rounded-md border border-gray-200 p-4 hover:border-gray-300 hover:bg-gray-50">
          <div className="text-sm font-medium text-gray-900">Материалы проёмов</div>
          <div className="text-xs text-gray-600 mt-1">Материалы для проёмов, дверей и окон</div>
        </Link>
      </div>
    </div>
  );
}


