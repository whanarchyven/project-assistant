import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Подавляем часто всплывающие предупреждения по зависимостям хуков в UI-коде
      'react-hooks/exhaustive-deps': 'off',
      // Разрешаем временно использовать any в местах интеграций (Convex типы могут быть сложными)
      '@typescript-eslint/no-explicit-any': 'off',
      // Иногда используем let для наглядности пошаговых расчётов
      'prefer-const': 'off',
    },
  },
];

export default eslintConfig;
