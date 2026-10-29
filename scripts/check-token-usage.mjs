// Enforces DESIGN.md section 3: semantic tokens only, global focus ring, Hugeicons only.
// Usage: node scripts/check-token-usage.mjs [dir or file ...]   (default: src)
// Opt out per file, with a reason: // hf-allow: <rule> -- <reason>
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const root = new URL("..", import.meta.url).pathname
const dirs = process.argv.slice(2).length ? process.argv.slice(2) : ["src"]

const PRIMITIVE_HUES = "green|maroon|gold|ivory|gray|success|warning|danger|info|plum"
const COLOR_UTILS = "bg|text|border|ring|outline|fill|stroke|from|via|to|divide|placeholder|decoration|accent|caret|shadow"
const TAILWIND_PALETTE =
  "slate|zinc|neutral|stone|red|orange|amber|yellow|lime|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose"

const rules = [
  {
    id: "primitive-color",
    message: "Warna primitif atau palet Tailwind. Pakai token semantik (bg-primary, text-muted-foreground).",
    pattern: new RegExp(
      `\\b(?:${COLOR_UTILS})-(?:${PRIMITIVE_HUES}|${TAILWIND_PALETTE})-\\d{2,3}\\b|\\b(?:${COLOR_UTILS})-(?:white|black)\\b|var\\(--color-(?:${PRIMITIVE_HUES}|white|black)\\b`
    ),
  },
  {
    id: "arbitrary-color",
    message: "Warna hex, rgb, hsl, atau oklch langsung. Pakai token semantik.",
    pattern: new RegExp(`\\b(?:${COLOR_UTILS})-\\[(?:#|rgb|hsl|oklch)`),
  },
  {
    id: "dark-variant",
    message: "Override dark:. Mode gelap datang dari token.",
    pattern: /(?<![\w-])dark:[\w[]/,
  },
  {
    id: "outline-none",
    message: "outline-none mematikan cincin fokus global.",
    pattern: /(?<![\w-])outline-none\b/,
  },
  {
    id: "focus-ring",
    message: "focus-visible:ring-* tidak dipakai. Cincin fokus sudah diatur global.",
    pattern: /focus-visible:ring-|ring-ring\//,
  },
  {
    id: "lucide",
    message: "lucide-react tidak dipakai. Pakai Hugeicons.",
    pattern: /from ["']lucide-react["']/,
  },
  {
    id: "uppercase",
    message: "Huruf kapital semua. Pakai sentence case.",
    pattern: /(?<![\w-])uppercase\b/,
  },
]

function* walk(dir) {
  if (!statSync(dir).isDirectory()) {
    yield dir
    return
  }
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) yield* walk(path)
    else if (/\.(tsx?|jsx?)$/.test(name) && !/\.test\.tsx?$/.test(name)) yield path
  }
}

let problems = 0
for (const dir of dirs) {
  for (const file of walk(join(root, dir))) {
    const text = readFileSync(file, "utf8")
    const allowed = new Set([...text.matchAll(/hf-allow:\s*([\w-]+)\s*--\s*\S/g)].map((m) => m[1]))
    text.split("\n").forEach((line, i) => {
      if (/hf-allow:/.test(line) || /^\s*(\/\/|\/?\*)/.test(line)) return
      for (const rule of rules) {
        if (allowed.has(rule.id) || !rule.pattern.test(line)) continue
        problems++
        console.log(`${relative(root, file)}:${i + 1}  [${rule.id}] ${rule.message}\n    ${line.trim().slice(0, 140)}`)
      }
    })
  }
}

if (problems) {
  console.error(`\n${problems} pelanggaran aturan token. Lihat docs/DESIGN.md bagian 3.`)
  process.exit(1)
}
console.log("Semua file memakai token semantik.")
