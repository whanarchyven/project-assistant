"use client";

import React from "react";
import Link from "next/link";
import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";

export default function Navbar() {
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();

  return (
    <header className="w-full bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-base font-semibold text-gray-900">
            Проектный ассистент
          </Link>
          <nav className="hidden sm:flex items-center gap-4">
            <Link href="/projects" className="text-sm text-gray-700 hover:text-gray-900">
              Мои проекты
            </Link>
            <Link href="/materials/defaults" className="text-sm text-gray-700 hover:text-gray-900">
              Библиотека материалов
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <button
              onClick={() => signOut()}
              className="text-sm text-gray-700 hover:text-gray-900"
            >
              Выйти
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}

