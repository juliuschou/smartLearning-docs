/* 示意資料（seed）— 僅供雛形，詞彙依 20_系統分析/GLOSSARY.md */
/* eslint-disable */
"use strict";

const SEED = {
  // 示意使用者（正式帳號）
  users: [
    { email: "admin@example.com", name: "林管理", accountName: "admin", roles: ["SYSTEM_ADMIN"], password: "Admin1234", status: "ACTIVE" },
    { email: "teacher@example.com", name: "陳老師", accountName: "chen.t", roles: ["TEACHER"], password: "Teach1234", status: "ACTIVE" },
    { email: "mix@example.com", name: "王雙職", accountName: "wang.both", roles: ["SYSTEM_ADMIN", "TEACHER"], password: "Mix12345", status: "ACTIVE" },
    { email: "invited@example.com", name: "張已邀請", accountName: "chang.i", roles: ["TEACHER"], password: "Invit1234", status: "INVITED" },
    { email: "off@example.com", name: "李停用", accountName: "lee.off", roles: ["TEACHER"], password: "Off12345", status: "DISABLED" },
  ],

  // M04 權限目錄（模組讀取／寫入為單位）
  permissionCatalog: [
    { code: "M01_READ",  module: "帳號與登入管理", desc: "本人個人資料與認證狀態（本人範圍）" },
    { code: "M01_WRITE", module: "帳號與登入管理", desc: "維護本人姓名、聯絡電話、Email（Email 變更須重新驗證）" },
    { code: "M02_READ",  module: "角色管理", desc: "角色清單檢視" },
    { code: "M02_WRITE", module: "角色管理", desc: "角色啟用／停用狀態維護" },
    { code: "M03_READ",  module: "老師維護與管理", desc: "老師清單、搜尋與檢視" },
    { code: "M03_WRITE", module: "老師維護與管理", desc: "老師帳號建立、編輯、啟停用、重設密碼、角色指派" },
    { code: "M04_READ",  module: "角色與功能對應管理", desc: "查詢權限目錄及角色映射" },
    { code: "M04_WRITE", module: "角色與功能對應管理", desc: "角色功能授權／取消授權、批次儲存（完整權限集合）" },
    { code: "M05_READ",  module: "題庫管理", desc: "搜尋及檢視本人題庫" },
    { code: "M05_WRITE", module: "題庫管理", desc: "建立／維護／複製／軟刪除本人題庫" },
    { code: "M06_READ",  module: "教學活動管理", desc: "查詢本人活動清單（含活動摘要）" },
    { code: "M06_WRITE", module: "教學活動管理", desc: "建立／維護活動、加入資訊、結束活動、模式設定" },
    { code: "M07_READ",  module: "老師即時控制台", desc: "檢視控制台、人數與模式狀態提示" },
    { code: "M07_WRITE", module: "老師即時控制台", desc: "開始活動、選題、開放／停止作答、公布、投影控制" },
    { code: "M09_READ",  module: "即時統計與結果分析", desc: "檢視本人活動統計與報表" },
    { code: "M09_WRITE", module: "即時統計與結果分析", desc: "（預留）報表匯出等（P1）" },
    { code: "M10_READ",  module: "系統設定與營運監控", desc: "系統參數查詢、活動監控查詢" },
    { code: "M10_WRITE", module: "系統設定與營運監控", desc: "系統參數批次更新（全有全無）" },
    { code: "M11_READ",  module: "可選分組與團隊競賽", desc: "檢視本人活動分組與適用排行榜" },
    { code: "M11_WRITE", module: "可選分組與團隊競賽", desc: "分組設定、隨機分組、隊員調整、確認／解鎖重建、排行榜公布" },
  ],

  // 預設角色—功能對應（最小權限；同 M04 預設矩陣）
  defaultMappings: {
    SYSTEM_ADMIN: ["M01_READ", "M01_WRITE", "M02_READ", "M02_WRITE", "M03_READ", "M03_WRITE", "M04_READ", "M04_WRITE", "M10_READ", "M10_WRITE"],
    TEACHER: ["M01_READ", "M01_WRITE", "M05_READ", "M05_WRITE", "M06_READ", "M06_WRITE", "M07_READ", "M07_WRITE", "M09_READ", "M11_READ", "M11_WRITE"],
  },

  // M05 題庫（老師擁有）
  questionSets: [
    {
      id: "qs1", owner: "teacher@example.com", name: "資訊安全基礎", topic: "資訊安全", description: "授課用基本觀念題庫",
      tags: ["新人訓練", "資安"],
      updatedAt: "2026-10-28 14:30",
      questions: [
        { id: "q1", type: "單選", stem: "下列何者最適合作為主要帳號的登入密碼？",
          options: ["12345678", "我的生日", "P@ssw0rd!2026 這是一段長密碼", "與帳號名稱相同"], correct: [2] },
        { id: "q2", type: "多選", stem: "關於釣魚信件的特徵，下列哪些正確？（全對才算答對）",
          options: ["要求點擊不明連結", "提供官方客服專線且可回撥驗證", "要求提供帳號密碼", "使用公司內部正式公文格式"], correct: [0, 2] },
        { id: "q3", type: "投票", stem: "你今天通勤主要使用什麼方式？",
          options: ["捷運／公車", "開車／騎車", "步行", "其他"] },
        { id: "q4", type: "開放式文字", stem: "請寫下一件你今天學到的事。" },
      ],
    },
    {
      id: "qs2", owner: "teacher@example.com", name: "個人資料保護（副本）", topic: "法遵", description: "由「個人資料保護」複製",
      tags: ["法遵"],
      updatedAt: "2026-10-25 09:12",
      questions: [
        { id: "q5", type: "單選", stem: "蒐集個人資料前，首要原則是什麼？",
          options: ["告知目的並取得同意", "先蒐集再說", "只給主管看", "加密即可"], correct: [0] },
      ],
    },
    {
      id: "qs3", owner: "teacher@example.com", name: "急救概論", topic: "職安", description: "",
      tags: ["公益"],
      updatedAt: "2026-10-20 16:45", deleted: true,
      questions: [
        { id: "q6", type: "單選", stem: "CPR 按壓深度成人建議為？", options: ["2 公分", "5 公分", "10 公分", "不限制"], correct: [1] },
      ],
    },
  ],

  // M06 教學活動
  activities: [
    {
      id: "act1", host: "teacher@example.com", name: "1111 新人資安訓練", date: "2026-11-05", organizer: "",
      pin: "482913", status: "NOT_STARTED",
      grouping: "INDIVIDUAL", leaderboard: "NONE", scoring: true,
      questionSetId: "qs1", joined: 0,
    },
    {
      id: "act2", host: "teacher@example.com", name: "公益團體急救共學", date: "2026-11-01", organizer: "某某公益協會",
      pin: "007432", status: "IN_PROGRESS",
      grouping: "TEAM", leaderboard: "TEAM", scoring: true, groupConfirmed: false, locked: false,
      questionSetId: "qs3", joined: 26,
    },
    {
      id: "act3", host: "teacher@example.com", name: "十月法遵複訓", date: "2026-10-18", organizer: "",
      pin: "335577", status: "ENDED",
      grouping: "INDIVIDUAL", leaderboard: "INDIVIDUAL", scoring: true,
      questionSetId: "qs2", joined: 42,
    },
  ],

  // 學員端示意（活動 act2 進行中）
  learnerDemo: {
    pin: "007432",
    nickname: "",
    activity: null, // 由 app.js 填入
  },
};