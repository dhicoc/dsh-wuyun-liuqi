# 更新日志

## 1.3.0 (2026-10-08)

同步上游 wuyun-liuqi-skills@42e18fa（自 1.0.4 同步点 3f429d9 以来的 17 个提交），技能 36 → **37** 个。

### 新增

- **新蒸馏技能 `yixue-qiongyuanji-yunqi`**（《医学穷源集·卷二》运气专论，明·王肯堂撰）：9 个章节文档 + cheatsheet/glossary/patterns + EVAL_vs_RAG，六书六层互补链补齐第六书。
- **RAG 资产 asset39**（医学穷源集·运气）与 **asset40**（时疫温病气运徵验论瘟疫运气专库）。
- **GROUNDING_POLICY.md**：RAG 检索引用的落地规则。
- `scripts/index_distilled_qiongyuan.py`。

### 修复与深化

- **RAG 医案大扩充**（+5.4 万行）：asset18 回春录 40→476、asset19 张聿青 138→944、asset20 吴鞠通 70→317、asset21 寓意草 17→21、asset22 洄溪 23→43、asset23 花韵楼 20→30、asset24 诊余举隅 14→34、asset28 丛桂草堂 8→26、asset29 外科正宗 70→162，逐字校核 source_quote，检索 golden 全量更新。
- **检索可达性修复**：asset17-32 并入 `_default_asset_keys()` 默认检索范围（此前约 57% 医案默认不可达）；21 条 reedit 逐字债修复 + 1125 条跨版本引文显式声明。
- **历史嵌套目录清理**：删除插件包内错误遗留的 `rag-knowledge-base/rag-knowledge-base/` 双层嵌套副本（142 个文件，上游不存在该结构）。

### 同步策略

- 继续排除上游的 `.claude/`、`.cursor/` 跨工具副本、`reports/` 示例与根级工程文件（`.github/`、`package.json`、`package-lock.json`、`pyproject.toml`）。
- 同步后运行 `normalize-skill-names.py`：上游 6 个中文 frontmatter name（5 个既有蒸馏技能 + 新技能）自动规范化为目录 kebab-case 名（防 issue #1 回归）；中文书名在 description 中完整保留。

### 验证

- `_selftest.mjs` 11 项断言全绿（37 候选 / name 全合法 / 无重名 / 块标量 / get 正文）。
- 真 0.2.0-rc.2 `SkillRegistry` 端到端：37/37 注册、5 个既有蒸馏技能新名全部通过校验、`get()` 完整正文。

## 1.2.0 (2026-10-08)

修复 dsh 0.2.0-rc.2 上的技能注册失败（issue #1），并移植 dsh-reverse-skill v1.2.0 的 provider 加固。

### 修复

- **5 个蒸馏技能的 frontmatter `name` 为中文标题，导致 provider 注册中断**（issue #1）：
  DSH 核心对所有候选技能名做硬校验 `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`，一个非法名即让
  `list()` 抛错、同包 36 个技能全部无法注入。以下技能的 `name` 已改为各自目录名
  （与路由 id 一致），中文书名在 `description` 中完整保留，展示与触发不受影响：
  - `liejing-tuyi-yunqi`（类经图翼·运气）
  - `sanyin-sitiansi-yunqi-fang`（三因极一病证方论·运气诸方）
  - `suwen-rushi-yunqi-lunao`（素问入式运气论奥）
  - `yizong-jinjian-yunqi-yaojue`（医宗金鉴·运气要诀）
  - `yunqi-zhengzhi-gejue`（运气证治歌诀）

### Provider 加固（对齐 dsh-reverse-skill v1.2.0，源自其 PR #7）

- `registerProvider` 工厂接收 `SkillProviderControl`，尊重注册生命周期 `signal` 与
  每次 lookup 的 `options.signal`（插件被 disposed 或 lookup 被取代时停止遍历目录树）。
- `list()` 返回 `SkillProviderObservation`：任一目录 `readdir` 失败时报
  `complete: false` 且**不缓存**目录，注册中心永远不会把残缺目录当权威目录。
- `SKILLS_ROOT` 防御式解析（`resolveBundledRoot`）：宿主用非 `file:` 的
  `import.meta.url` 加载插件 bundle 时不再在模块加载期抛错。
- 目录缓存移入注册闭包：HMR 重挂载或二次注册不会复用已销毁实例的候选。
- 候选与 `get()` 返回补上 `path` 字段（0.2.0-rc.2 起 `path` 位于 `SkillSummary`）。
- frontmatter 解析支持 `|` / `>` 块标量（含 chomping 与 indent 数字）：蒸馏技能的
  `description: |` 不再被解析成字面量 `"|"` 而丢失路由描述。
- **非法名运行时兜底**（issue #1 防复发）：`name` 不匹配注册中心正则时，自动回退到
  该技能目录的 kebab-case 名并 `console.warn`；无法回退则跳过该候选——单个坏名
  不再拖垮整个 provider 的注册。

### 自检

- `_selftest.mjs` 从纯打印改为硬断言：name 正则、无重名、36 个候选、`complete`、
  块标量描述、`get()` 正文，失败时非零退出。

## 1.1.0 (2026-09-29)

- 声明 DSH 0.2.0-rc.2 兼容（`dsh.compatibility.dshReleases` 增加 `0.2.0-rc.1` /
  `0.2.0-rc.2`；peer 升至 `@deepseek-ai/dsh-skill ^0.2.0-rc.2`）。

## 1.0.4 (2026-09-01)

- 同步源仓库 wuyun-liuqi-skills@3f429d9：新增 4 个蒸馏技能 + RAG/index 更新，共 36 技能。

## 1.0.3 (2026-08-31)

- 重新发布以修复损坏的 npm 包文档。

## 1.0.2 (2026-08-30)

- 移除 prepare 脚本，`dsh plugin add` 不再需要 allowBuilds 授权。

## 1.0.1 / 1.0.0 (2026-08)

- 首次发布：五运六气（运气学）技能包封装为 DeepSeek Harness Cordis 插件。
