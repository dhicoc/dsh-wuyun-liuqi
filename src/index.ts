/**
 * Complete wuyun-liuqi (五运六气) skill pack as a DeepSeek Harness Cordis plugin.
 *
 * Data-driven provider: it walks the bundled `skills/` tree (recursively, so
 * nested sub-skills such as distilled/* and the inline neijing_snapshot reasoning
 * patterns are discovered too), exposes every SKILL.md through the `ctx.skills`
 * seam, and serves the full body on demand. No manual candidate list to keep in
 * sync with the source pack.
 *
 * Targets the DSH 0.2.0-rc.2 skill seam (`@deepseek-ai/dsh-skill` ^0.2.0-rc.2):
 *
 *   - `registerProvider` hands the factory a `SkillProviderControl`.
 *     `control.signal` is the registration's lifecycle signal and is honoured
 *     alongside the per-call `options.signal`. `control.invalidate()` is the
 *     provider-to-registry notification and is deliberately never called: this
 *     pack's catalog is immutable for the lifetime of a registration.
 *   - `list()` returns a `SkillProviderObservation` so genuinely partial discovery
 *     can be reported. If a `readdir` under the root fails, the observation is
 *     marked `complete: false` and the catalog is not memoized, so the registry
 *     never caches a truncated catalog as authoritative (issue #9 pattern).
 *   - `path` is emitted on every candidate and definition now that it lives on
 *     `SkillSummary`.
 *   - YAML block scalars (`description: |`) are parsed; the distilled SKILL.md
 *     files use them and previously lost their routing description entirely.
 *
 * Illegal frontmatter names are defused at the provider boundary (issue #1):
 * the DSH core validates every candidate name against `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`
 * and one bad name used to abort the whole registration, taking all 36 skills
 * down with it. When a `name:` does not match, the provider substitutes the
 * skill's kebab-case directory name (which the registry accepts and which keeps
 * the skill reachable) and warns; if even that is impossible the candidate is
 * skipped with a warning instead of poisoning the catalog.
 *
 * Credit: the `SkillProviderControl` / `SkillProviderObservation` handling and
 * the per-registration cache scoping follow PR #7 on dsh-reverse-skill by
 * @chen-sky, reimplemented here on the same 0.2.0-rc.2 seam.
 *
 * @module @dhicoc/dsh-wuyun-liuqi
 */

import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type {
  SkillCandidate,
  SkillDefinition,
  SkillLookupOptions,
  SkillProvider,
  SkillProviderControl,
  SkillProviderObservation,
} from '@deepseek-ai/dsh-skill'

// Repo layout: src/index.ts -> lib/index.js ; skills/ sits at the package root,
// one level above lib/. The URL below (no trailing slash, no extra dirname)
// resolves to the skills/ *directory* itself. Note: do NOT wrap in dirname() —
// `new URL('../skills/', import.meta.url)` already ends in a directory name, so
// dirname() would wrongly strip it and leave the package root (which also
// contains node_modules and would double-count every SKILL.md). This holds for
// both local dev (dsh-wuyun-liuqi/lib) and the published package
// (node_modules/@dhicoc/dsh-wuyun-liuqi/lib).
//
// Resolve the bundled root defensively. Some hosts load plugin bundles through
// an internal module loader whose `import.meta.url` is NOT a `file:` URL; a
// bare fileURLToPath there throws at module load (loud) or — worse — a failed
// readdir silently cached an empty catalog (the dsh-reverse-skill issue #9
// pattern). A resolved-but-missing root still yields a partial observation, so
// the registry never caches it as authoritative; an unresolvable root disables
// discovery the same way.
function resolveBundledRoot(relative: string): string | undefined {
  try {
    return fileURLToPath(new URL(relative, import.meta.url))
  } catch {
    return undefined
  }
}
const SKILLS_ROOT = resolveBundledRoot('../skills')

const PROVIDER_NAME = 'wuyun-liuqi'

/** Hard validation the DSH core applies to every candidate name (packages/skill/skill/src/index.ts). */
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Stop discovery when either the registration or the caller has been cancelled,
 * so a disposed plugin or a superseded lookup cannot keep walking the tree.
 */
function throwIfAborted(registration: AbortSignal, options: SkillLookupOptions): void {
  if (registration.aborted) throw registration.reason
  const { signal } = options
  if (signal?.aborted) throw signal.reason
}

/** YAML block scalar indicator: `|` or `>`, optionally with chomping (- / +) and an indent digit. */
const BLOCK_SCALAR = /^([|>])[+-]?\d*$/

/**
 * Read a YAML block scalar whose `key: |` line sits at `start - 1`.
 *
 * The distilled SKILL.md files write `description` as a block scalar. Read
 * line-by-line, such a value parses as the literal indicator "|", which leaves
 * those skills with no usable routing description at all.
 *
 * `style` is the indicator character. Returns the joined text and the index of
 * the first line after the block.
 */
function readBlockScalar(
  lines: readonly string[],
  start: number,
  style: string,
): { value: string; next: number } {
  const raw: string[] = []
  let i = start
  for (; i < lines.length; i += 1) {
    const line = lines[i]
    if (line.trim() === '') {
      raw.push('')
      continue
    }
    // An unindented line ends the block; this includes the closing `---`.
    if (!/^[ \t]/.test(line)) break
    raw.push(line)
  }
  while (raw.length > 0 && raw[raw.length - 1] === '') raw.pop()

  // Strip the block's common indentation; blank lines do not participate.
  const indents = raw
    .filter((l) => l !== '')
    .map((l) => ((l.match(/^[ \t]*/) as RegExpMatchArray)[0]).length)
  const indent = indents.length > 0 ? Math.min(...indents) : 0
  const text = raw.map((l) => (l === '' ? '' : l.slice(indent)))

  if (style === '|') {
    // Literal: newlines are preserved.
    return { value: text.join('\n').trim(), next: i }
  }
  // Folded: single newlines become spaces, blank lines stay as paragraph breaks.
  const folded = text.map((l, idx) => (l === '' ? '\n' : idx === 0 ? l : ` ${l}`)).join('')
  return { value: folded.replace(/\n{3,}/g, '\n\n').trim(), next: i }
}

/** Minimal YAML-frontmatter reader — enough for name / description / metadata. */
function parseFrontmatter(text: string): { fm: Record<string, string>; body: string } {
  // Strip an optional UTF-8 BOM and normalize CRLF -> LF so the delimiter search
  // and line regex are consistent across editor encodings and Windows checkouts.
  const src = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  if (!src.startsWith('---')) return { fm: {}, body: text }
  const end = src.indexOf('\n---', 3)
  if (end === -1) return { fm: {}, body: text }
  const fmText = src.slice(3, end)
  const body = src.slice(end + 4)
  const fm: Record<string, string> = {}
  const lines = fmText.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // Blank lines and indented continuation lines never start a key; block
    // scalar bodies are consumed wholesale by readBlockScalar below.
    const m = line.match(/^([A-Za-z0-9_-]+):[ \t]*(.*)$/)
    if (!m) continue
    const key = m[1]
    const value = m[2].trim()
    if (BLOCK_SCALAR.test(value)) {
      const block = readBlockScalar(lines, i + 1, value[0])
      fm[key] = block.value
      i = block.next - 1
      continue
    }
    fm[key] = value.replace(/^["']|["']$/g, '')
  }
  return { fm, body }
}

interface Collected {
  path: string
  fm: Record<string, string>
  body: string
}

/**
 * Recursively collect every parseable SKILL.md, reporting whether the walk was
 * exhaustive. A directory that cannot be read marks the result partial instead
 * of silently narrowing the catalog (issue #9 pattern).
 */
async function collect(
  root: string,
  registration: AbortSignal,
  options: SkillLookupOptions,
): Promise<{ items: Collected[]; complete: boolean }> {
  const items: Collected[] = []
  let complete = true
  async function walk(dir: string): Promise<void> {
    throwIfAborted(registration, options)
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      // An unreadable directory means this catalog is a partial view; surface
      // that through the observation instead of pretending discovery succeeded.
      complete = false
      return
    }
    for (const e of entries) {
      throwIfAborted(registration, options)
      const p = join(dir, e.name)
      if (e.isDirectory()) await walk(p)
      else if (e.name === 'SKILL.md') {
        const text = await readFile(p, 'utf8')
        const { fm, body } = parseFrontmatter(text)
        if (fm['name']) items.push({ path: p, fm, body })
      }
    }
  }
  await walk(root)
  return { items, complete }
}

interface Catalog {
  candidates: readonly SkillCandidate[]
  complete: boolean
}

/**
 * Resolve the registry-safe name for a collected skill (issue #1).
 *
 * Prefers the frontmatter `name:`; when it would fail the core's hard regex,
 * falls back to the skill's own directory name (which is kebab-case in this
 * pack and matches its routing id) and warns once. Returns `undefined` when no
 * registry-safe name exists — the caller skips the candidate rather than
 * letting one bad name abort the whole registration.
 */
function resolveCandidateName(path: string, name: string): string | undefined {
  if (SKILL_NAME.test(name)) return name
  const dir = dirname(path)
  const base = dir.split(/[\\/]/).pop() ?? ''
  // The root skills/SKILL.md has no meaningful directory fallback.
  const fallback = base === 'skills' ? undefined : base
  if (fallback !== undefined && SKILL_NAME.test(fallback)) {
    console.warn(
      `[${PROVIDER_NAME}] SKILL.md frontmatter name "${name}" is not registry-safe; ` +
        `using directory name "${fallback}" (${path})`,
    )
    return fallback
  }
  console.warn(
    `[${PROVIDER_NAME}] skipping skill with registry-unsafe name "${name}" ` +
      `and no usable directory fallback (${path})`,
  )
  return undefined
}

/**
 * One provider instance per registration. The catalog cache lives in this
 * closure rather than at module scope, so an HMR remount or a second
 * registration can never reuse candidates built by a provider whose fiber was
 * already disposed.
 */
function createProvider(control: SkillProviderControl): SkillProvider {
  let cache: Catalog | null = null

  async function build(options: SkillLookupOptions): Promise<Catalog> {
    if (cache !== null) return cache
    const registration = control.signal
    // An unresolvable root (non-file: loader URL) reads as incomplete discovery
    // — never as an authoritative empty catalog.
    const walk = SKILLS_ROOT === undefined
      ? { items: [] as Collected[], complete: false }
      : await collect(SKILLS_ROOT, registration, options)

    // Deduplicate by registry-safe name; keep the entry with the shortest
    // relative path so the canonical root skill (skills/SKILL.md) wins over
    // any cross-tool copy.
    const byName = new Map<string, Collected & { rel: string }>()
    for (const item of walk.items) {
      const safe = resolveCandidateName(item.path, item.fm['name'])
      if (safe === undefined) continue
      const rel = item.path.substring((SKILLS_ROOT ?? '').length).replace(/\\/g, '/')
      const prev = byName.get(safe)
      if (!prev || rel.split('/').length < prev.rel.split('/').length) {
        byName.set(safe, { ...item, fm: { ...item.fm, name: safe }, rel })
      }
    }

    const candidates = [...byName.values()].map(({ path, fm }) => ({
      name: fm['name'],
      description: fm['description'] ?? '',
      invocation: { modelInvocable: true, userInvocable: true },
      provider: PROVIDER_NAME,
      source: 'bundled',
      resourceBase: { kind: 'directory', path: dirname(path) },
      path,
      rank: 0,
      locator: pathToFileURL(path),
      metadata: fm,
    })) as SkillCandidate[]

    const catalog: Catalog = { candidates, complete: walk.complete }
    // Only memoize a trustworthy catalog; a partial walk is retried on the next list().
    if (catalog.complete) cache = catalog
    return catalog
  }

  return {
    name: PROVIDER_NAME,
    async list(options: SkillLookupOptions = {}): Promise<SkillProviderObservation> {
      throwIfAborted(control.signal, options)
      const catalog = await build(options)
      return { candidates: catalog.candidates, complete: catalog.complete }
    },
    async get(
      candidate: SkillCandidate,
      options: SkillLookupOptions = {},
    ): Promise<SkillDefinition | undefined> {
      throwIfAborted(control.signal, options)
      const source = candidate.path ?? candidate.locator
      const text = await readFile(source as string | URL, 'utf8')
      const { body } = parseFrontmatter(text)
      return {
        name: candidate.name,
        description: candidate.description,
        invocation: candidate.invocation,
        provider: candidate.provider,
        source: candidate.source,
        resourceBase: candidate.resourceBase,
        path: candidate.path,
        content: body,
        metadata: (candidate as { metadata?: Record<string, string> }).metadata,
      } as SkillDefinition
    },
  }
}

/** Cordis plugin name. Must match the `id` in cordis.patch.yml. */
export const name = 'wuyun-liuqi'
/** Service required by this provider. */
export const inject = ['skills']
/** Register the bundled wuyun-liuqi provider on `ctx.skills`. */
export function apply(ctx: Context): void {
  ctx.skills.registerProvider((control) => createProvider(control))
}
