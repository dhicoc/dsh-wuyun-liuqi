# dsh-wuyun-liuqi

[![awesome · DSH plugin](https://awesome-dsh-plugin.com/badge.svg)](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)

> **五运六气（运气学）AI Agent 技能包的 DeepSeek Harness（dsh）插件版。**
> 把 [`dhicoc/wuyun-liuqi-skills`](https://github.com/dhicoc/wuyun-liuqi-skills)（39★，MIT）完整封装成一个 dsh Cordis 插件，随包分发、随插件加载，无需手动维护候选清单。

---

## 这是什么

- **完整移植**：把源仓库的全部 **SKILL.md**（去重后 31 个）原样封装为 dsh 技能候选，包括主技能 `wuyun-liuqi`、6 个 `modules/*` 子技能、2 个 `perspectives/*` 注家视角，以及 22 个 `scripts/lib/neijing_snapshot/*` 《黄帝内经》推理模式技能。
- **插件形态**：以 dsh 一等公民的 `skill` seam（`ctx.skills`）注册一个 provider，harness 启动时自动把全部技能注入可用技能库。
- **相对资源解析**：每个技能的 `resourceBase` 指向其自身目录，技能正文里引用的 `routing.yaml`、`rules/`、`scripts/` 等配套文件随包分发，相对路径可解析。

### 适用范围（请遵守）

本仓库内容仅用于 **中医传统理论（运气学说）的学习、研究与辅助推算**。运气学说非现代医学诊断标准，临床输出须附加免责声明（见 `skills/case-journal/precedent-disclaimer.md`）。一切未授权或误导性使用与本仓库无关。

---

## 安装

本仓库已声明 `dsh.bundle` manifest（见 `cordis.patch.yml`），因此可直接用一行命令安装并激活：

```bash
# 从 GitHub 安装并激活（推荐）
dsh plugin add github:dhicoc/dsh-wuyun-liuqi
```

安装后 harness 即可通过 `ctx.skills` 发现全部 31 个五运六气技能；让 agent 调用示例：

> "用 wuyun-liuqi 这个 skill，给我 2026 年的五运六气年度分析（调用 yunqi_report.py 风格的输出）"

---

## 本地自测（无需 dsh 运行时）

```bash
node _selftest.mjs
# 输出：31 个候选、无重名、userInvocable / modelInvocable 计数、get() 取正文验证
```

---

## 目录结构

```text
dsh-wuyun-liuqi/
├── src/index.ts              # 数据驱动的 Cordis 插件：递归扫描并注册全部 SKILL.md
├── lib/index.js              # 编译产物（已提交，install 免编译即可用）
├── cordis.patch.yml         # dsh.bundle 补丁（声明 Cordis 插件 id + npm 包名）
├── skills/                   # 从源仓库打包的全部技能内容（SKILL.md + 配套文件）
│   ├── SKILL.md              # 主技能 wuyun-liuqi
│   ├── modules/              # 6 个子技能（ganzhi-basics, yunqi-calc, ...）
│   ├── perspectives/         # 2 个注家视角（刘完素 / 张介宾）
│   ├── scripts/lib/neijing_snapshot/  # 22 个《黄帝内经》推理模式技能
│   ├── routing.yaml, rules/, references/, workflows/, ...
│   └── ...（其余支撑文件）
└── package.json
```

> 注：源仓库的 `.claude/`、`.cursor/` 跨工具副本、14M RAG 语料（`rag-knowledge-base`）与生成报告（`reports`）未打包进本插件，以控制体积；技能正文指令完整保留。

## License

MIT — 与源仓库 [`dhicoc/wuyun-liuqi-skills`](https://github.com/dhicoc/wuyun-liuqi-skills) 一致。
