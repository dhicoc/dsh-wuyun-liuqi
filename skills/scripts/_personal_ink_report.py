#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成宣纸水墨·读者化版个人运气报告（复用 ink_theme 唯一设计源）。
用法: python _personal_ink_report.py <输出路径>
"""
import sys, os
from html import escape
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
from _common import setup_environment, add_scripts_dir_to_path
setup_environment(add_lib=False, add_scripts=True)
import ink_theme
from generate_html_report import _STYLE, escape_html, LIUQI_WUXING
from _safety_text import CONTEXT_DISCLAIMERS

WX = {'木': 'mu', '火': 'huo', '土': 'tu', '金': 'jin', '水': 'shui'}

# ── 宣纸水墨基础样式（_STYLE + ink_theme token）────────────────────
style = (_STYLE
         .replace('__DARK__', ink_theme.css_vars('dark'))
         .replace('__LIGHT__', ink_theme.css_vars('light'))
         .replace('__PAPER_TEX__', ink_theme.paper_texture(opacity=0.05))
         .replace('__WASH__', ink_theme.ink_wash(color='#8a8375', opacity=0.13))
         + ink_theme.MOTION)

seal_html = ink_theme.seal("甲申")

def _qc(q):
    return WX.get(LIUQI_WUXING.get(q, '金'), 'jin')

# 六步客气数据（2026 丙年）
steps = [
    dict(no="初之气", date="大寒~春分", zhu="厥阴风木", ke="太阳寒水",
         rel="客气生主气", shun="相得·顺", is_ni=False, note="风木主令，寒水来袭，风气偏盛而寒，防肝风与风寒袭表"),
    dict(no="二之气", date="春分~小满", zhu="少阴君火", ke="厥阴风木",
         rel="客气生主气", shun="相得·顺", is_ni=False, note="木生火，风火相煽，气温回升偏快，防温病、风热上扰"),
    dict(no="三之气", date="小满~大暑", zhu="少阳相火", ke="少阴君火",
         rel="客主同气", shun="相得·顺", is_ni=False, note="君相二火当令，火热尤盛，防暑热、心火亢、伤津耗气", sitian=True),
    dict(no="四之气", date="大暑~秋分", zhu="太阴湿土", ke="太阴湿土",
         rel="客主同气", shun="相得·顺", is_ni=False, note="湿土当令，湿热交蒸，防湿阻中焦、脾运失健、水肿痰饮"),
    dict(no="五之气", date="秋分~小雪", zhu="阳明燥金", ke="少阳相火",
         rel="客气克主气", shun="不相得·逆", is_ni=True, note="火克金，燥金受克，燥火并存，防肺燥、咳嗽、咽喉干痛"),
    dict(no="终之气", date="小雪~大寒", zhu="太阳寒水", ke="阳明燥金",
         rel="客气生主气", shun="相得·顺", is_ni=False, note="水金相生，寒燥并盛，防寒邪伤阳、肾阳虚、燥咳", zaiquan=True),
]

def step_card(s, i):
    zc, kc = _qc(s["zhu"]), _qc(s["ke"])
    marks = ""
    if s.get("sitian"):
        marks += '<em class="mark mark-sitian">司天</em>'
    if s.get("zaiquan"):
        marks += '<em class="mark mark-zaiquan">在泉</em>'
    if s["is_ni"]:
        marks += '<em class="mark" style="color:var(--wx-huo);border-color:var(--wx-huo)">逆</em>'
    return f'''<div class="qstep{' is-current' if s['is_ni'] else ''} reveal" data-d="{i+1}">
      <span class="qstep-no">{i+1:02d}</span>
      <div class="qstep-name">{escape_html(s['no'])}<br><span style="font-size:.82rem;color:var(--ink-4)">{escape_html(s['date'])}</span></div>
      <div class="qstep-pair">
        <span class="wx-{zc}">主 · {escape_html(s['zhu'])}</span>
        <span class="wx-{kc}">客 · {escape_html(s['ke'])}</span>
      </div>
      <div class="qstep-rel">{escape_html(s['rel'])} · {escape_html(s['shun'])}</div>
      <div class="qstep-marks">{marks}</div>
      <div class="qstep-path">{escape_html(s['note'])}</div>
    </div>'''

qi_cards = "".join(step_card(s, i) for i, s in enumerate(steps))

# 易感性条目
susceptibility = [
    ("脾胃病 / 湿证 / 水肿 / 肾虚水泛", "健脾化湿、温肾利水；饮食清淡燥湿，少食肥甘", "tu"),
    ("寒证 / 肾病 / 血脉病 / 抑郁", "温补心阳、益气活血；饮食宜温补", "shui"),
    ("热证 / 火证 / 心病 / 黄疸", "清热泻火、疏利肝胆；少食辛温助火", "huo"),
    ("肝系疾病 / 风证 / 筋病 / 腹胀", "平肝息风、健脾止泻；下半年养肝柔筋", "mu"),
    ("寒证 / 肾病 / 关节痛", "温阳散寒、补肾固本；下半年避寒就温", "shui"),
    ("脾胃病 / 寒湿证 / 水肿 / 痹证", "温阳散寒、健脾化湿", "tu"),
    ("肝胆病 / 风火证 / 惊悸 / 眩晕", "清泻肝胆、息风降火", "huo"),
]
susc_html = "".join(
    f'<div class="read-item"><span class="tag wx-{c}">易感</span><h3>{escape_html(d)}</h3><p>{escape_html(r)}</p></div>'
    for d, r, c in susceptibility
)

html = f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>个人运气体质分析 · 甲申 · 2004-07-30</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;700;900&family=Noto+Sans+SC:wght@300;400;500;700&display=swap" rel="stylesheet">
<style>{style}</style>
<noscript><style>.reveal{{opacity:1!important;transform:none!important}}</style></noscript>
</head>
<body>
  <div class="screen-only toolbar">
    <button class="tbtn" onclick="document.documentElement.classList.toggle('light')">墨 / 纸</button>
    <button class="tbtn tbtn-primary" onclick="window.print()">印 · 存 PDF</button>
  </div>

  <header class="hero">
    <div class="hero-wash" aria-hidden="true"></div>
    <div class="hero-grid">
      <div class="hero-main">
        <div class="hero-eyebrow">气化禀赋 · 体质推演</div>
        <h1 class="vtitle">个人运气</h1>
        <p class="hero-sub">2004-07-30（甲申）· 出生 华东 · 江浙沪</p>
        <ul class="hero-meta">
          <li><span>先天岁运</span><b class="wx-tu">土运太过</b></li>
          <li><span>司天</span><b class="wx-huo">少阳相火</b></li>
          <li><span>在泉</span><b class="wx-mu">厥阴风木</b></li>
          <li><span>当前岁运</span><b class="wx-shui">水运太过（丙）</b></li>
        </ul>
      </div>
      <div class="hero-seal" aria-hidden="true">{seal_html}</div>
    </div>
  </header>

  <main>
    <section class="section">
      <h2 class="sec-title reveal"><span class="sec-no">壹</span>先天体质倾向 · <span class="wx-tu">痰湿质</span></h2>
      <div class="metaphor reveal">土运太过之年（甲年）出生，土气敦阜壅塞，升降失司，湿气停聚成痰。<strong>土旺克水</strong>，水道不利，水湿停聚更甚，故成痰湿之体。<span class="metaphor-sub">痰湿凝聚，形体丰腴，腹部肥满松软，口黏苔腻。</span></div>
      <div class="disclaimer reveal"><strong>注</strong>：出生年「土」反复出现 → 后天易罹五脏病（以脾土为先）。以上为运气理论分析，非医学诊断。</div>
    </section>

    <section class="section">
      <h2 class="sec-title reveal"><span class="sec-no">贰</span>当前岁运调理 · <span class="wx-shui">水运太过（2026 丙）</span></h2>
      <p class="reveal" style="color:var(--ink-2)">今年水运太过，寒气偏盛，养生以<b class="wx-shui">温阳散寒、补肾助火</b>为要。</p>
      <div class="read-grid" style="margin-top:1.4rem">
        <div class="read-item"><span class="tag wx-shui">易发</span><h3>健康问题</h3><p>寒水伤阳（畏寒肢冷、泄泻）；寒凝血瘀（痹阻、痛经）；水气凌心（心悸水肿）；肾阳虚衰（腰膝酸软）。</p></div>
        <div class="read-item"><span class="tag wx-tu">调养</span><h3>生活起居</h3><p>居处温暖避湿冷，保暖腰背腹足；运动生热助阳（慢跑、太极，微汗）；常灸关元、命门、肾俞、足三里；温水泡脚。</p></div>
        <div class="read-item"><span class="tag wx-tu">饮食</span><h3>药膳方向</h3><p>当归生姜羊肉汤、肉桂红糖姜茶、杜仲核桃炖猪腰；忌生冷寒凉。方药仅作运气学参考，须由执业中医师辨证加减。</p></div>
      </div>
    </section>

    <section class="section">
      <h2 class="sec-title reveal"><span class="sec-no">叁</span>2026 全年六步客气 · 客主加临</h2>
      <div class="qi reveal">{qi_cards}</div>
      <div class="disclaimer reveal" style="margin-top:1.2rem"><strong>注</strong>：五之气（秋分~小雪）主客不相得为逆，为全年最需留意时段；三之气司天少阴君火、终之气在泉阳明燥金。</div>
    </section>

    <section class="section">
      <h2 class="sec-title reveal"><span class="sec-no">肆</span>先天运气 · 疾病易感性倾向</h2>
      <p class="reveal" style="color:var(--ink-3);margin-bottom:1.2rem">胎孕期（推算受孕日 2003-10-24）：火运不及 · 太阴湿土司天 / 太阳寒水在泉。出生年「土」多次出现，脾土为先。</p>
      <div class="read-grid">{susc_html}</div>
      <div class="disclaimer reveal" style="margin-top:1.2rem"><strong>注</strong>：先天运气 → 体质 → 疾病易感性为统计性 / 关联性证据，非因果，不替代临床诊断。</div>
    </section>

    <section class="section">
      <h2 class="sec-title reveal"><span class="sec-no">伍</span>内经方法论框架</h2>
      <div class="read-grid">
        <div class="read-item"><span class="tag wx-mu">素问</span><h3>阴阳平衡法</h3><p>阴阳应象大论。归阴阳 → 判盛虚 → 用对立面纠正。阳胜则热、阴胜则寒；阴平阳秘，精神乃治。</p></div>
        <div class="read-item"><span class="tag wx-mu">素问</span><h3>五行生克网络</h3><p>藏气法时论。要素归五行 → 画生克图 → 沿链推导连锁 → 找准关键干预点。</p></div>
        <div class="read-item"><span class="tag wx-shui">素问</span><h3>四时调神</h3><p>四气调神大论。春生夏长秋收冬藏，起居情志与季节气机同频，逆则连锁亏损。</p></div>
      </div>
    </section>

    <section class="section">
      <div class="disclaimer reveal"><strong>免责声明</strong>：{CONTEXT_DISCLAIMERS['constitution']}</div>
    </section>
  </main>

  <footer class="foot">个人运气 · 宣纸水墨读者化版 · 五运六气技能包 · 甲申</footer>
{ink_theme.reveal_script()}
</body>
</html>'''

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "personal_ink_report.html"
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"✅ 宣纸水墨报告已生成: {out} ({len(html)} bytes)")
