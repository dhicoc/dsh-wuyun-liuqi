/**
 * Complete wuyun-liuqi (五运六气) skill pack as a DeepSeek Harness Cordis plugin.
 *
 * Data-driven provider: it walks the bundled `skills/` tree (recursively, so
 * nested sub-skills such as modules/*, perspectives/* and the inline
 * neijing_snapshot reasoning patterns are discovered too), exposes every
 * SKILL.md through the `ctx.skills` seam, and serves the full body on demand.
 * No manual candidate list to keep in sync with the source pack.
 *
 * @module @wuyun-liuqi/dsh-wuyun-liuqi
 */
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const SKILLS_ROOT = fileURLToPath(new URL('../skills', import.meta.url));
const PROVIDER_NAME = 'wuyun-liuqi';

interface Frontmatter {
  [key: string]: string;
}

interface CollectedSkill {
  path: string;
  fm: Frontmatter;
  body: string;
}

/** Minimal YAML-frontmatter reader — enough for name / description / metadata,
 *  including `>` / `|` block scalars (folded / literal). */
function parseFrontmatter(text: string): { fm: Frontmatter; body: string } {
  const src = text.replace(/\r\n/g, '\n');
  if (!src.startsWith('---')) return { fm: {}, body: text };
  const end = src.indexOf('\n---', 3);
  if (end === -1) return { fm: {}, body: text };
  const fmText = src.slice(3, end);
  const body = src.slice(end + 4);
  const fm: Frontmatter = {};
  const lines = fmText.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || /^\s/.test(line)) continue; // blank or continuation
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    const bm = val.match(/^([>|][+-]?)\s*$/);
    if (bm) {
      const folded = bm[1][0] === '>';
      const buf: string[] = [];
      i++;
      while (i < lines.length && (/^\s/.test(lines[i]) || lines[i] === '')) {
        buf.push(lines[i].replace(/^\s+/, ''));
        i++;
      }
      i--;
      fm[key] = buf.join(folded ? ' ' : '\n').trim();
      continue;
    }
    fm[key] = val.replace(/^["']|["']$/g, '');
  }
  return { fm, body };
}

async function collect(root: string): Promise<CollectedSkill[]> {
  const out: CollectedSkill[] = [];
  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) await walk(p);
      else if (e.name === 'SKILL.md') {
        const text = await readFile(p, 'utf8');
        const { fm, body } = parseFrontmatter(text);
        if (fm['name']) out.push({ path: p, fm, body });
      }
    }
  }
  await walk(root);
  return out;
}

let CACHE: any[] | null = null;
async function buildCandidates(): Promise<any[]> {
  if (CACHE) return CACHE;
  const all = await collect(SKILLS_ROOT);
  // Deduplicate by name; keep the entry with the shortest relative path so the
  // canonical root skill (skills/SKILL.md) wins over any cross-tool copy.
  const byName = new Map<string, CollectedSkill & { rel: string }>();
  for (const item of all) {
    const rel = item.path.slice(SKILLS_ROOT.length).replace(/\\/g, '/');
    const prev = byName.get(item.fm['name']);
    if (!prev || rel.split('/').length < prev.rel.split('/').length)
      byName.set(item.fm['name'], { ...item, rel });
  }
  const cands = [...byName.values()].map(({ path, fm }) => ({
    name: fm['name'],
    description: fm['description'] ?? '',
    invocation: { modelInvocable: true, userInvocable: true },
    provider: PROVIDER_NAME,
    source: 'bundled',
    resourceBase: { kind: 'directory', path: dirname(path) },
    rank: 0,
    locator: pathToFileURL(path),
    metadata: fm,
  }));
  CACHE = cands;
  return cands;
}

const provider = {
  name: PROVIDER_NAME,
  list: () => buildCandidates(),
  async get(candidate: any) {
    const text = await readFile(candidate.locator, 'utf8');
    const { body } = parseFrontmatter(text);
    return {
      name: candidate.name,
      description: candidate.description,
      invocation: candidate.invocation,
      provider: candidate.provider,
      source: candidate.source,
      resourceBase: candidate.resourceBase,
      content: body,
      metadata: candidate.metadata,
    };
  },
};

/** Cordis plugin name. Must match the `id` in cordis.patch.yml. */
export const name = 'wuyun-liuqi';
/** Service required by this provider. */
export const inject = ['skills'];
/** Register the bundled wuyun-liuqi provider on `ctx.skills`. */
export function apply(ctx: any): void {
  ctx.skills.registerProvider(() => provider);
}
