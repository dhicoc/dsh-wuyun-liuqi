#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
sync_kb.py — 把 rag-knowledge-base 从上游源仓库重新拉进本插件

用途：
    你用 book-to-skill 蒸馏新文献、往 wuyun-liuqi-skills/rag-knowledge-base/
    灌了新 asset / distilled 之后，跑一下本脚本，就能把最新 RAG 同步到
    本 dsh 插件（skills/rag-knowledge-base/），让 rag_search.py 始终有最新语料。

前置：
    - 本机有 git 且能访问 GitHub（联网）。
    - 不需要任何 pip 依赖（仅用标准库 + git）。

用法：
    python scripts/sync_kb.py
    python scripts/sync_kb.py --repo https://github.com/dhicoc/wuyun-liuqi-skills.git --branch master
    python scripts/sync_kb.py --dry-run        # 只看源端有多少文件，不改动本地
"""

import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

DEFAULT_REPO = "https://github.com/dhicoc/wuyun-liuqi-skills.git"
DEFAULT_BRANCH = "master"
KB_SUBPATH = "rag-knowledge-base"


def run(cmd, cwd=None):
    print(f"→ {cmd if isinstance(cmd, str) else ' '.join(cmd)}")
    return subprocess.run(cmd, shell=isinstance(cmd, str), cwd=cwd,
                           capture_output=True, text=True, encoding="utf-8")


def count_files(d: Path):
    return sum(1 for _ in d.rglob("*") if _.is_file())


def dir_size_mb(d: Path):
    total = 0
    for f in d.rglob("*"):
        if f.is_file():
            total += f.stat().st_size
    return total / 1048576.0


def main():
    ap = argparse.ArgumentParser(description="Sync rag-knowledge-base into this plugin")
    ap.add_argument("--repo", default=DEFAULT_REPO, help="upstream source repo (git URL)")
    ap.add_argument("--branch", default=DEFAULT_BRANCH, help="branch to pull")
    ap.add_argument("--dry-run", action="store_true", help="only report source size, no local changes")
    args = ap.parse_args()

    here = Path(__file__).resolve().parent          # skills/scripts
    skills_dir = here.parent                         # skills
    target = skills_dir / KB_SUBPATH                 # skills/rag-knowledge-base

    print(f"[sync_kb] source : {args.repo}  (branch={args.branch})")
    print(f"[sync_kb] target : {target}")

    with tempfile.TemporaryDirectory(prefix="kb_sync_") as tmp:
        clone = Path(tmp) / "src"
        # 稀疏克隆：只取 rag-knowledge-base 子目录，省带宽
        r = run(["git", "clone", "--filter=blob:none", "--sparse", "--depth", "1",
                 "-b", args.branch, args.repo, str(clone)])
        if r.returncode != 0:
            print("[ERROR] git clone 失败：")
            print(r.stderr.strip())
            sys.exit(1)
        r = run(["git", "-C", str(clone), "sparse-checkout", "set", KB_SUBPATH])
        if r.returncode != 0:
            print("[ERROR] sparse-checkout 失败：")
            print(r.stderr.strip())
            sys.exit(1)

        src_kb = clone / KB_SUBPATH
        if not src_kb.is_dir():
            print(f"[ERROR] 源仓库未找到 {KB_SUBPATH}/")
            sys.exit(1)

        src_count = count_files(src_kb)
        src_mb = dir_size_mb(src_kb)
        print(f"[sync_kb] 源端 RAG：{src_count} 文件 / {src_mb:.1f} MB")

        if args.dry_run:
            print("[sync_kb] --dry-run：未改动本地。")
            return

        if target.is_dir():
            before = count_files(target)
            shutil.rmtree(target)
            print(f"[sync_kb] 已移除本地旧副本（{before} 文件）。")
        else:
            print(f"[sync_kb] 本地无 RAG，首次拉取。")

        shutil.copytree(src_kb, target)
        after = count_files(target)
        after_mb = dir_size_mb(target)
        print(f"[sync_kb] ✅ 已同步：{after} 文件 / {after_mb:.1f} MB -> {target}")
        print("[sync_kb] 提示：rag_search.py 现在即可检索最新语料。")


if __name__ == "__main__":
    main()
