# 智學互動平台 — 需求蒐集層級詞彙表（規劃書 V1.2）

本檔記錄《系統功能規劃書 V1.2》使用的原始領域詞彙，供對照需求來源之用。**權威定義與正名見 [`../20_系統分析/GLOSSARY.md`](../20_系統分析/GLOSSARY.md)**；兩處衝突時，以系統分析層級的權威版為準。

## Language

**即時互動教學系統 (Instructor-Led Interactive Learning System)**:
本平台英文名；「Instructor-Led（講師主導）」僅作產品定位語，人物角色一律稱「老師（Teacher）」。

**授課情境 (On-site Instruction)**:
企業與公益團體的現場教學，為本系統的核心使用情境。

**角色 (Role)**
系統管理者 (SYSTEM_ADMIN) 與老師 (TEACHER)，V1 僅此兩者；助教 (Teaching Assistant)、企業管理者 (Enterprise Administrator) 為未來自訂角色的例子，非現行角色。

**企業 (Enterprise) / 公益團體 (Non-profit Organization) / 組織 (Organization)**:
使用本平台的組織型態。「組織」明示不可與「隊伍 (Team)」混為同一資料物件。

**老師／講師**:
規劃書正文兩詞混用，權威版統一為「老師（Teacher）」。

**學員 (Learner / Student)**:
以 QR Code／PIN 等加入活動的臨時參與者，不需註冊正式帳號。
_Avoid_: 參賽者（語意偏競賽，權威版不再使用）

**教學活動 (Teaching Activity) / 活動 / 場次 / Session**:
規劃書對同一實體（`TEACHING_SESSION`）有四種說法，權威版統一「教學活動」。

**題庫 (Question Bank)**:
老師擁有、可跨課程及組織重複使用的題目集合。
_Avoid_: 教材（H05 曾以「教材」指題庫）

**活動參與模式 (Participation Mode)**:
V1.2 對「分組模式」的舊稱；權威版統一分組模式（Grouping Mode）。

**加入資訊 / 活動憑證**:
規劃書 M06 定義「加入資訊」（PIN／QR Code／活動連結），M01／M08 卻以「活動憑證」泛稱學員參與所憑；權威版區分「加入資訊」與「參與者憑證」，「活動憑證」為泛稱不再使用。

**公布統計／公布結果**:
規劃書兩詞並用；權威版統一「公布（Publish）」為動作統稱，統計、正確答案、排行榜分別公布。

**有效隊伍 (Active Team)**:
競賽中有效的隊伍歸屬，同一學員最多屬於一個（BR-014）。

**組織排行榜 (Organization Leaderboard)**:
P1：比較各參與組織標準化成績的榜單。

**歷史活動 (Historical Activity)**:
已結束的活動。

**活動摘要 (Activity Summary)**:
整理各題與活動整體統計。

**組織間競賽 (Inter-organization Competition)**:
P1：比較不同組織標準化彙總成績；V1.1 曾寫「組織競賽」。

## 規劃書層級即已存在的用語問題（供對照）

詳列見來源分析，重點：Session 一詞雙義（登入 vs 教學活動）、`INDIVIDUAL`／`TEAM` 代碼在分組模式與排行榜模式語意不同、老師／講師混用、學員／參與者／參賽者混用、隊伍／組／團隊混用、「個人」一詞負載過重（個人資料／個人排行榜／個人分數／個人模式）。