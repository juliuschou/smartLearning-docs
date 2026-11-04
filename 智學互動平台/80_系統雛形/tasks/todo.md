# 2026-11-03 智學互動平台 系統雛形（純 JS + HTML）

## 目標
依 `docs/智學互動平台/20_系統分析`（M01–M11 + GLOSSARY.md）製作純 JS + HTML 互動雛形，輸出至 `docs/智學互動平台/80_系統雛形/`。詞彙以 20_系統分析/GLOSSARY.md 為唯一基準。

## Acceptance criteria
- 單純 HTML/CSS/JS，無框架、無 build step，直接以瀏覽器開啟 index.html 可用
- 涵蓋 M01–M11 主要畫面（系統管理者 / 老師 / 學員 / 投影 四種視角）
- 所有文案用語符合 GLOSSARY.md（含 6 條書寫守則：不裸用 Session、寫全名 grouping_mode 等）
- 待決議事項在畫面中以「待決議」標示
- 示意資料內建（demo seed data），前端選單過濾依角色模擬

## Steps
- [x] 彙整 M01–M11 畫面需求（subagent 摘要完成）
- [x] 設計 plan（色彩 / 字體 / 版面 / 原則）並自我審視非模板化
- [x] 建檔：index.html、learner.html、projection.html、assets/{app,learner,seed}.js、style.css、README.md
- [x] 驗證：node --check + Playwright headless 全流程（登入成功/失敗/停用、選單過濾、控制台選題→開放→停止→公布、學員端作答與公布檢視、投影失聯待機、admin 視角選單）全部 PASS，零 console error
- [x] 結果記錄

## 設計 plan（v1 草案）

**主題隱喻**：「課堂現場」— 這是老師站在講台、學生拿手機、大螢幕投影的即時系統。介面要像「教室裡的教具」而不是後台儀表板。

**色彩**（避開 cream+terracotta、深底+螢光綠的模板預設）：
- `靛墨` #23315C — 主要結構色（導覽、標題、按鈕主色）
- `紙白` #F6F7F4 — 底色（偏冷灰紙，非暖奶油）
- `梔子黃` #DFA320 — 強調／公布時刻（講台上唯一最亮的顏色）
- `松石` #2E7D6B — 成功／在線／有效提交
- `朱砂` #B5482F — 警示／停用／撤銷
- `墨灰` #565E6B — 次要文字

**字體**：
- 顯示：Noto Serif TC（教材／課本感，用於標題與投影大字）
- 介面：Noto Sans TC（UI 與表格）

**版面**：
- 後台：左側窄導覽（依有效權限過濾）+ 主內容左對齊，表格式資料密度
- 控制台 M07：左右分欄「題目/控制 | 即時統計」，操作按鈕大而少（開放作答／停止作答／公布統計／公布正確答案／下一題）
- 學員端 M08：手機直式單欄，大按鈕選項卡
- 投影：純大字與答案分布，梔子黃點綴

**原則**：
1. 一頁一個動詞：每個畫面最顯眼的是「現在你該做的那件事」
2. 統計先「可查」、經「公布」才給學員 — 兩段式視覺（可查=灰、公布=亮）
3. 用語嚴守 GLOSSARY，待決議事項以虛線框標示
4. 動效只出現在「公布」時刻（唯一一次非互動動效留給揭曉）

## 自我審視
- 梔子黃+靛藍 vs 常見 terracotta/靛墨差異 OK；投影頁以「答案分布長條+公布揭曉」為記憶點
- 已避免 ALL-CAPS eyebrow、→ 尾綴、卡片海、單字強調

## Results
- 產出：`80_系統雛形/` 內 index.html、learner.html、projection.html、README.md、assets/（app.js、learner.js、seed.js、style.css）；純 HTML/CSS/JS，瀏覽器直開可用
- 詞彙：全站依 `20_系統分析/GLOSSARY.md`（含 6 條書寫守則）；待決議事項以虛線框標示
- 驗證：`node --check` 3 檔全過；Playwright headless 冪端到端流程 PASS、零 pageerror/console error
- 測試中發現並修正：`el()` 對 `disabled: false` 誤寫屬性、全域 `top` 與 `window.top` 衝突、控制台「選擇第一題」漏態

## Lessons
- file:// 直開的多頁雛形用絕對相對路徑（assets/）即可，不需伺服器
- Playwright 可直接從相鄰 repo 的 node_modules 以絕對路徑 import，免安裝