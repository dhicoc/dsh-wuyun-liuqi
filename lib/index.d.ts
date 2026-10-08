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
import type { Context } from '@deepseek-ai/cordis';
/** Cordis plugin name. Must match the `id` in cordis.patch.yml. */
export declare const name = "wuyun-liuqi";
/** Service required by this provider. */
export declare const inject: string[];
/** Register the bundled wuyun-liuqi provider on `ctx.skills`. */
export declare function apply(ctx: Context): void;
