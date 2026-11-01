// Копирует контент из репозитория в приложение: node scripts/sync-content.mjs
// content/*.json (сценарии, уроки, квест, «Безопасный выход», юр. тексты, персонажи) и модель Щита.
// Модель скоринга (CatBoost → JSON) выгружает scripts/export_risk_model.py — ему нужен Python с catboost.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const app = path.resolve(here, '..')
const repo = path.resolve(app, '..')
const from = path.join(repo, 'content')
const to = path.join(app, 'src', 'content')

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true })
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name)
    const d = path.join(dst, name)
    if (fs.statSync(s).isDirectory()) copyDir(s, d)
    else if (name.endsWith('.json')) fs.copyFileSync(s, d)
  }
}

if (!fs.existsSync(from)) {
  console.error(`Нет папки ${from}: скрипт запускается из mobile/ внутри репозитория`)
  process.exit(1)
}
copyDir(from, to)
fs.mkdirSync(path.join(to, 'models'), { recursive: true })
fs.copyFileSync(path.join(repo, 'backend', 'app', 'ml', 'models', 'shield.json'), path.join(to, 'models', 'shield.json'))
console.log('Контент и модель Щита скопированы в src/content')
