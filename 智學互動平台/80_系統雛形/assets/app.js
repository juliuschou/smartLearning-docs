/* 智學互動平台 — 系統雛形（純 JS，無相依）
   詞彙唯一基準：20_系統分析/GLOSSARY.md
   示意資料見 assets/seed.js */
"use strict";

const $ = (sel, el = document) => el.querySelector(sel);
const el = (tag, attrs = {}, html = "") => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (v === true) n.setAttribute(k, "");
    else if (v !== null && v !== undefined && v !== false) n.setAttribute(k, v);
  }
  if (html) n.innerHTML = html;
  return n;
};
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* ---------------- 模擬狀態 ---------------- */
const state = {
  currentUser: null,          // 登入 Session（示意）
  route: { page: "login" },
  activity: null,             // 控制台開啟中的活動
  qsIndex: 0,                 // 目前題序位置
  qState: "none",             // none | selected | open | closed
  published: { stats: false, answer: false, board: false },
  submissions: {},            // 示意: optionIndex -> count
  answeredCount: 14,
  onlineCount: 17,
  learnerTimer: null,         // 開放作答期間的示意提交流入
  lease: "本瀏覽器",
};

const validRolesOf = u => (u && u.status === "ACTIVE") ? u.roles : [];
const effective = () => {
  const u = state.currentUser; if (!u) return [];
  const set = new Set();
  validRolesOf(u).forEach(r => SEED.defaultMappings[r]?.forEach(p => set.add(p)));
  return [...set];
};
const can = code => effective().includes(code);

/* ---------------- 訊息 ---------------- */
const LOGIN_FAIL = "Email 或密碼不正確，或帳號目前無法登入。"; // 一般化：防帳號枚舉
function toast(msg, kind = "info") {
  const t = el("div", { class: "toast " + kind, role: "status" }, esc(msg));
  Object.assign(t.style, { position: "fixed", right: "20px", bottom: "20px", maxWidth: "340px",
    padding: "12px 16px", background: "#1c2433", color: "#fff", borderRadius: "6px",
    fontSize: "13px", zIndex: 99, opacity: "0", transition: "opacity .3s" });
  document.body.appendChild(t);
  requestAnimationFrame(() => t.style.opacity = "1");
  setTimeout(() => { t.style.opacity = "0"; setTimeout(() => t.remove(), 400); }, 3200);
}

/* ---------------- 登入 / 外框 ---------------- */
function renderLogin() {
  const root = $("#root");
  root.innerHTML = "";
  const wrap = el("div", { class: "login-wrap" });
  wrap.appendChild(el("div", { class: "login-side" },
    `<div class="wordmark">智學互動平台</div>
     <div class="subtitle">為現場授課而設的即時互動系統：老師主持、學員以 Game PIN 加入、大螢幕投影。本頁為系統雛形，資料皆為示意。</div>`));
  const pane = el("div", { class: "login-pane" });
  pane.appendChild(el("h1", {}, "登入"));
  const form = el("form", { class: "entry" });
  form.innerHTML = `
    <label class="f"><span class="req">Email（登入識別）</span><input type="email" id="li-email" autocomplete="username"></label>
    <label class="f"><span class="req">密碼（最低 8 碼）</span><input type="password" id="li-pw" autocomplete="current-password"></label>
    <div class="row"><button class="primary" type="submit">登入</button>
    <button type="button" id="li-forgot">忘記密碼</button></div>
    <p class="muted" id="li-msg" style="min-height:1em"></p>`;
  form.addEventListener("submit", e => {
    e.preventDefault();
    const email = $("#li-email", form).value.trim().toLowerCase();
    const pw = $("#li-pw", form).value;
    const u = SEED.users.find(x => x.email.toLowerCase() === email);
    // 一般化回應：不區分帳號不存在／已停用／密碼錯誤（防帳號枚舉）
    if (!u || u.password !== pw || u.status === "DISABLED") {
      $("#li-msg", form).textContent = LOGIN_FAIL;
      return;
    }
    if (u.status === "INVITED") { $("#li-msg", form).textContent = "此帳號尚未完成邀請啟用，請從 Email 一次性連結設定密碼。"; return; }
    state.currentUser = u;
    toast("登入成功。閒置 30 分鐘或登入後 24 小時逾時（示意）");
    go({ page: "home" });
  });
  $("#li-forgot", form).addEventListener("click", () => {
    $("#li-msg", form).textContent = "已受理。若此 Email 已啟用，將寄送一次性密碼重設連結（30 分鐘內有效；每帳號每 60 秒最多寄送一次）。";
  });
  pane.appendChild(form);
    pane.appendChild(el("div", { class: "demo-note" },
      `<b>雛形示範帳號</b>（密碼見 assets/seed.js）：<br>
       系統管理者 admin@example.com／老師 teacher@example.com／雙角色 mix@example.com<br>
       另有 invited@example.com（帳號狀態 INVITED）與 off@example.com（帳號狀態 DISABLED）。<br>
       <a href="learner.html?pin=007432">前往學員端</a>｜<a href="projection.html?pin=007432">前往投影畫面</a>`));
  wrap.appendChild(pane);
  root.appendChild(wrap);
}

const NAV = [
  { code: "home",    label: "總覽", need: null },
  { code: "m02",     label: "角色管理", need: "M02_READ" },
  { code: "m03",     label: "老師維護與管理", need: "M03_READ" },
  { code: "m04",     label: "角色與功能對應管理", need: "M04_READ" },
  { code: "m05",     label: "題庫管理", need: "M05_READ" },
  { code: "m06",     label: "教學活動管理", need: "M06_READ" },
  { code: "m07",     label: "老師即時控制台", need: "M07_READ" },
  { code: "m09",     label: "即時統計與結果分析", need: "M09_READ" },
  { code: "m10",     label: "系統設定與營運監控", need: "M10_READ", p1: true },
];

function renderShell(pageNo, title, build) {
  const root = $("#root");
  root.innerHTML = "";
  const app = el("div", { class: "app" });
  const nav = el("nav", { class: "side" });
  nav.appendChild(el("div", { class: "brand" }, "智學互動平台"));
  const eff = effective();
  NAV.filter(n => !n.need || eff.includes(n.need)).forEach(n => {
    nav.appendChild(el("a", { href: "#", class: n.code === pageNo ? "on" : "",
      onclick: e => { e.preventDefault(); go({ page: n.code }); } }, n.label + (n.p1 ? "（P1）" : "")));
  });
  const who = el("div", { class: "who" },
    `<b>${esc(state.currentUser.name)}</b>${esc(state.currentUser.email)}<br>
     ${esc(validRolesOf(state.currentUser).join("、"))}<br>
     <button type="button" id="logout" style="margin-top:8px;font-size:12px">登出</button>`);
  nav.appendChild(who);
  app.appendChild(nav);
  const main = el("main");
  main.appendChild(el("div", { class: "crumb" }, esc(validRolesOf(state.currentUser).join("／")) + " 視角"));
  main.appendChild(el("h1", {}, title));
  build(main);
  app.appendChild(main);
  root.appendChild(app);
  $("#logout").addEventListener("click", () => {
    state.currentUser = null; toast("已登出，所有登入 Session 已撤銷（示意）"); go({ page: "login" });
  });
}

/* ---------------- 頁面 ---------------- */
const PAGES = {
  home(main) {
    main.appendChild(el("div", { class: "grid2" }));
    const eff = effective();
    const p = el("div", { class: "panel" },
      `<h2>有效授權</h2><p class="muted">登入憑證建立時的權限快照；權限變更須重新登入後套用（M04／M01）。</p>
       <div class="row">${eff.map(c => `<span class="tag t-lock">${esc(c)}</span>`).join("") || "—"}</div>`);
    main.appendChild(p);
    if (can("M06_READ")) {
      const list = el("div", { class: "panel" }, `<h2>我的教學活動（摘要）</h2>`);
      const t = el("table", { class: "l" }, `<thead><tr><th>活動</th><th>日期</th><th>活動狀態</th><th>模式</th></tr></thead>`);
      const tb = el("tbody");
      SEED.activities.forEach(a => tb.appendChild(el("tr", {}, `
        <td>${esc(a.name)}<div class="muted">Game PIN ${esc(a.pin)}</div></td>
        <td>${esc(a.date)}</td>
        <td>${statusTag(a.status)}</td>
        <td class="muted">grouping_mode=${a.grouping}　leaderboard_mode=${a.leaderboard}</td>`)));
      t.appendChild(tb); list.appendChild(t);
      main.appendChild(list);
    }
    if (can("M10_READ")) {
      main.appendChild(el("div", { class: "panel" },
        `<h2>營運監控入口（P1）</h2><p class="muted">進行中活動與彙總連線狀態 — 見「系統設定與營運監控」。</p>`));
    }
  },

  /* M02 角色管理 */
  m02(main) {
    main.appendChild(el("p", { class: "muted" }, "V1 僅有兩個固定系統角色：代碼、名稱、描述不可修改、角色不可刪除（M02-03 不提供資料變更）。"));
    const t = el("table", { class: "l" },
      `<thead><tr><th>角色代碼</th><th>名稱</th><th>說明</th><th>狀態</th><th>系統保留</th><th></th></tr></thead>`);
    const tb = el("tbody");
    [["SYSTEM_ADMIN", "系統管理者", "帳號、角色、功能授權與系統設定；不因角色自動取得授課能力。"],
     ["TEACHER", "老師", "維護自己的題庫、建立並主持教學活動、檢視自己的報表。"]].forEach(([code, name, desc]) => {
      tb.appendChild(el("tr", {}, `
        <td><code>${code}</code></td><td>${name}</td><td>${desc}</td>
        <td>${tagOk("啟用")}</td><td>${tagOk("是")}</td>
        <td><button data-r="${code}">檢視明細</button></td>`));
    });
    t.appendChild(tb); main.appendChild(t);
    t.querySelectorAll("button[data-r]").forEach(b => b.addEventListener("click", () => showRole(b.dataset.r)));
    function showRole(code) {
      const map = SEED.defaultMappings[code] || [];
      $("#role-detail")?.remove();
      const d = el("div", { class: "panel", id: "role-detail" },
        `<h2>角色明細：${code}</h2>
         <p class="muted">功能授權摘要由 M04 提供（唯讀）。</p>
         <div class="row">${map.map(m => `<span class="tag t-lock">${m}</span>`).join("")}</div>
         <p class="muted" style="margin-top:10px">權限異動入口在「角色與功能對應管理」；帳號角色指派入口在「老師維護與管理」（M02 不直接寫入 USER_ROLE）。</p>
         <div class="row"><button class="danger">停用角色</button>
         <span class="muted">停用將立即撤銷受影響帳號的既有登入憑證；若將使最後有效系統管理者消失，系統拒絕。</span></div>`);
      d.querySelector(".danger").addEventListener("click", () =>
        toast("（示意）" + code + " 為固定系統角色且受最後有效系統管理者保護，此操作被拒絕。"));
      main.appendChild(d);
    }
  },

  /* M03 老師維護與管理 */
  m03(main) {
    const bar = el("div", { class: "row space", style: "margin-bottom:14px" });
    bar.appendChild(el("input", { type: "text", placeholder: "搜尋姓名／帳號名稱／Email", style: "max-width:320px" }));
    const addBtn = el("button", { class: "primary" }, "新增老師");
    bar.appendChild(addBtn);
    main.appendChild(bar);
    const t = el("table", { class: "l" },
      `<thead><tr><th>姓名</th><th>帳號名稱</th><th>Email</th><th>帳號狀態</th><th>有效角色</th><th>管理操作</th></tr></thead>`);
    const tb = el("tbody");
    function paint() {
      tb.innerHTML = "";
      const kw = bar.querySelector("input").value.trim().toLowerCase();
      SEED.users.filter(u => !kw || (u.name + u.accountName + u.email).toLowerCase().includes(kw)).forEach(u => {
        const off = u.status === "DISABLED";
        const inv = u.status === "INVITED";
        tb.appendChild(el("tr", {}, `
          <td>${esc(u.name)}</td><td>${esc(u.accountName)}</td><td>${esc(u.email)}</td>
          <td>${statusTagAccount(u.status)}</td>
          <td>${u.roles.map(r => `<span class="tag t-lock">${r}</span>`).join(" ")}</td>
          <td class="row" style="gap:6px">
            <button data-a="edit" data-e="${u.email}">編輯</button>
            <button data-a="invite" data-e="${u.email}" ${off || !inv ? "disabled" : ""}>重發邀請</button>
            <button data-a="reset" data-e="${u.email}" ${off ? "disabled" : ""}>重設密碼</button>
            <button data-a="role" data-e="${u.email}" ${off ? "disabled" : ""}>指派角色</button>
            <button class="danger" data-a="toggle" data-e="${u.email}">${off ? "啟用" : "停用"}</button>
          </td>`));
      });
      tb.querySelectorAll("button[data-a]").forEach(b => b.addEventListener("click", () => {
        const u = SEED.users.find(x => x.email === b.dataset.e);
        const a = b.dataset.a;
        if (a === "invite") toast(`（示意）已重發邀請：新一次性連結 7 天有效，舊連結立即失效。每帳號每 60 秒最多寄送一次。`);
        if (a === "reset") toast("（示意）已發起密碼重設：Email 一次性連結 30 分鐘內有效；管理者不得取得明文密碼。");
        if (a === "role") toast("（示意）角色指派入口：維護 USER_ROLE；不得移除最後有效角色或使最後有效系統管理者消失。");
        if (a === "edit") toast("（示意）編輯基本資料：Email 變更後須重新驗證，驗證完成前禁止新登入。");
        if (a === "toggle") {
          if (u.status === "DISABLED") { u.status = "ACTIVE"; }
          else {
            if (u.roles.includes("SYSTEM_ADMIN")) {
              const otherAdmin = SEED.users.some(x => x !== u && x.status === "ACTIVE" && x.roles.includes("SYSTEM_ADMIN"));
              if (!otherAdmin) { toast("拒絕：平台至少須保留最後有效系統管理者。", "warn"); return; }
            }
            u.status = "DISABLED";
            const live = SEED.activities.find(x => x.host === u.email && x.status === "IN_PROGRESS");
            if (live) live.status = "ENDED";
            toast("已停用：既有登入憑證立即失效" + (live ? "；其進行中活動已立即結束並保留歷史。" : "。"));
          }
          paint();
        }
      }));
    }
    t.appendChild(tb); main.appendChild(t);
    main.appendChild(el("p", { class: "muted" }, "批次操作（啟用／停用、重發邀請、角色指派）：每批 1–100 筆，全有全無，以冪等識別碼安全重送。「刪除」等同停用，不永久刪除歷史資料。"));
    addBtn.addEventListener("click", () => showAdd());
    function showAdd() {
      $("#add-panel")?.remove();
      const p = el("div", { class: "panel", id: "add-panel" }, `<h2>新增老師</h2>
        <label class="f"><span class="req">姓名</span><input type="text" id="np-name"></label>
        <label class="f"><span class="req">帳號名稱（唯一管理欄位，不作登入識別）</span><input type="text" id="np-acc"></label>
        <label class="f"><span class="req">Email（登入識別，建立後寄送 7 天內有效的邀請）</span><input type="email" id="np-email"></label>
        <label class="f"><span>聯絡電話（選填）</span><input type="text"></label>
        <div class="row"><button class="primary" id="np-save">建立並寄送邀請</button>
        <span class="muted">新帳號狀態為 INVITED，並預設指派 TEACHER。</span></div>`);
      p.querySelector("#np-save").addEventListener("click", () => {
        const name = p.querySelector("#np-name").value.trim();
        const acc = p.querySelector("#np-acc").value.trim();
        const email = p.querySelector("#np-email").value.trim();
        const dupe = SEED.users.some(u => u.email.toLowerCase() === email.toLowerCase() || u.accountName.toLowerCase() === acc.toLowerCase());
        if (!name || !acc || !email) { toast("拒絕：姓名、帳號名稱、Email 均為必填。", "warn"); return; }
        if (dupe) { toast("拒絕：Email 或帳號名稱重複（不分大小寫），請指出衝突欄位後修正。", "warn"); return; }
        SEED.users.push({ email, name, accountName: acc, roles: ["TEACHER"], password: "Temp12345", status: "INVITED" });
        toast("已建立老師帳號（INVITED）並寄送邀請。"); paint(); p.remove();
      });
      main.appendChild(p);
    }
    paint();
  },

  /* M04 角色與功能對應管理 */
  m04(main) {
    main.appendChild(el("p", { class: "muted" }, "權限以模組讀取／寫入為單位；未列入權限目錄者預設拒絕。批次儲存一次提交完整權限集合，全有全無；權限變更於使用者重新登入後套用（權限快照）。"));
    const pick = el("div", { class: "row", style: "margin-bottom:12px" },
      `<span>選擇角色：</span><select id="m04-role"><option value="SYSTEM_ADMIN">SYSTEM_ADMIN 系統管理者</option><option value="TEACHER">TEACHER 老師</option></select>`);
    main.appendChild(pick);
    const panel = el("div", { class: "panel", id: "m04-panel" });
    main.appendChild(panel);
    function paint() {
      const role = pick.querySelector("select").value;
      const cur = new Set(SEED.defaultMappings[role] || []);
      panel.innerHTML = `<h2>完整權限集合：${role}</h2>`;
      const byModule = {};
      SEED.permissionCatalog.forEach(p => (byModule[p.module] ??= []).push(p));
      Object.entries(byModule).forEach(([mod, perms]) => {
        const g = el("div", { style: "margin-bottom:14px" }, `<h3>${esc(mod)}</h3>`);
        perms.forEach(p => {
          const p1 = p.code.includes("ORGANIZATION");
          const row = el("label", { class: "row", style: "gap:8px;margin:4px 0" });
          const cb = el("input", { type: "checkbox" });
          cb.checked = cur.has(p.code);
          if (p1) { cb.disabled = true; }
          row.appendChild(cb);
          row.appendChild(el("span", {}, `<code>${p.code}</code> ${p1 ? '<span class="tag t-disabled">P1 停用，不可指派</span>' : ""}<div class="muted">${esc(p.desc)}</div>`));
          g.appendChild(row);
          cb.addEventListener("change", () => cb.checked ? cur.add(p.code) : cur.delete(p.code));
        });
        panel.appendChild(g);
      });
      const save = el("div", { class: "row" },
        `<button class="primary" id="m04-save">儲存（完整權限集合，全有全無）</button>
         <span class="muted">撤銷會使最後有效管理者失去必要管理能力時，整批拒絕。</span>`);
      save.querySelector("#m04-save").addEventListener("click", () => {
        SEED.defaultMappings[role] = [...cur];
        toast(`已儲存 ${role} 的完整權限集合。受影響使用者須重新登入後套用（權限快照）。`);
      });
      panel.appendChild(save);
    }
    pick.querySelector("select").addEventListener("change", paint);
    paint();
  },

  /* M05 題庫管理 */
  m05(main) {
    if (!can("M05_WRITE")) { main.appendChild(el("p", { class: "muted" }, "您具備 M05 讀取權限但無寫入權限（示意）。")); }
    const bar = el("div", { class: "row space", style: "margin-bottom:14px" });
    const kw = el("input", { type: "text", placeholder: "搜尋名稱／主題／標籤（不分大小寫部分比對）" });
    kw.style.maxWidth = "360px";
    bar.appendChild(kw);
    const newBtn = el("button", { class: "primary" }, "建立題庫");
    bar.appendChild(newBtn);
    main.appendChild(bar);
    const includeDeleted = el("label", { class: "row", style: "gap:6px;font-size:13px;color:var(--grey)" },
      `<input type="checkbox" id="m05-del"> 顯示已軟刪除（擁有者可復原）`);
    main.appendChild(includeDeleted);
    const wrap = el("div", { id: "m05-list" });
    main.appendChild(wrap);
    function paint() {
      wrap.innerHTML = "";
      const k = kw.value.trim().toLowerCase();
      const showDel = includeDeleted.querySelector("input")?.checked;
      const sets = SEED.questionSets.filter(qs => qs.owner === state.currentUser.email)
        .filter(qs => showDel || !qs.deleted)
        .filter(qs => !k || (qs.name + qs.topic + qs.tags.join("")).toLowerCase().includes(k));
      const t = el("table", { class: "l" },
        `<thead><tr><th>名稱</th><th>主題</th><th>標籤</th><th>題數</th><th>更新時間</th><th>操作</th></tr></thead>`);
      const tb = el("tbody");
      sets.forEach(qs => {
        tb.appendChild(el("tr", { style: qs.deleted ? "opacity:.55" : "" }, `
          <td>${esc(qs.name)}${qs.deleted ? ' <span class="tag t-disabled">已刪除</span>' : ""}<div class="muted">${esc(qs.description)}</div></td>
          <td>${esc(qs.topic || "—")}</td><td>${qs.tags.map(x => `<span class="tag t-neutral">${esc(x)}</span>`).join(" ")}</td>
          <td>${qs.questions.length}</td><td class="muted">${esc(qs.updatedAt)}</td>
          <td class="row" style="gap:6px">
            ${qs.deleted
              ? `<button data-a="restore" data-i="${qs.id}">復原</button>`
              : `<button data-a="edit" data-i="${qs.id}">維護題目</button>
                 <button data-a="copy" data-i="${qs.id}">複製</button>
                 <button class="danger" data-a="del" data-i="${qs.id}">刪除</button>`}
          </td>`));
      });
      tb.querySelectorAll("button[data-a]").forEach(b => b.addEventListener("click", () => {
        const qs = SEED.questionSets.find(x => x.id === b.dataset.i);
        const a = b.dataset.a;
        if (a === "del") { qs.deleted = true; toast("已軟刪除：自清單隱藏，可復原；歷史活動的題目快照不受影響。"); paint(); }
        if (a === "restore") { qs.deleted = false; toast("已復原。"); paint(); }
        if (a === "copy") {
          let base = qs.name + "（副本）", name = base, i = 2;
          while (SEED.questionSets.some(x => x.owner === qs.owner && x.name === name)) name = base + " " + (i++);
          const cp = JSON.parse(JSON.stringify(qs));
          cp.id = "qs" + Date.now(); cp.name = name; cp.deleted = false; cp.updatedAt = "2026-11-03 12:00";
          SEED.questionSets.unshift(cp);
          toast("已複製為獨立副本：" + name + "。修改或刪除不影響來源。"); paint();
        }
        if (a === "edit") questionEditor(qs);
      }));
      t.appendChild(tb); wrap.appendChild(t);
    }
    kw.addEventListener("input", paint);
    includeDeleted.querySelector("input").addEventListener("change", paint);
    newBtn.addEventListener("click", () => {
      const qs = { id: "qs" + Date.now(), owner: state.currentUser.email, name: "", topic: "", description: "", tags: [], updatedAt: "—", questions: [] };
      SEED.questionSets.unshift(qs); questionEditor(qs, true);
    });
    function questionEditor(qs, isNew) {
      $("#qse")?.remove();
      const p = el("div", { class: "panel", id: "qse" });
      p.innerHTML = `<h2>${isNew ? "建立題庫" : "維護題庫：" + esc(qs.name)}</h2>
        <label class="f"><span class="req">題庫名稱</span><input type="text" id="qe-name" value="${esc(qs.name)}"></label>
        <label class="f"><span>主題（至多一個，選填）</span><input type="text" id="qe-topic" value="${esc(qs.topic)}"></label>
        <label class="f"><span>描述（選填）</span><input type="text" id="qe-desc" value="${esc(qs.description)}"></label>
        <label class="f"><span>標籤（本人自訂、僅用於本人題庫；以空白分隔多個）</span><input type="text" id="qe-tags" value="${esc(qs.tags.join(" "))}"></label>`;
      const qtb = el("table", { class: "l" }, `<thead><tr><th>題幹</th><th>題型</th><th>選項</th><th>正確答案</th></tr></thead>`);
      const qtb2 = el("tbody");
      qs.questions.forEach(q => qtb2.appendChild(el("tr", {}, `
        <td>${esc(q.stem)}</td><td><span class="tag t-lock">${q.type}</span></td>
        <td class="muted">${esc(q.options.join("｜")) || "自由輸入文字"}</td>
        <td>${q.correct ? esc(q.correct.map(i => q.options[i]).join("、")) : "（無標準答案）"}</td>`)));
      qtb.appendChild(qtb2);
      p.appendChild(qtb);
      const hint = el("div", { class: "pending" },
        "題目編輯器（逐題表單）於正式版提供。規則：題幹必填不得空白；單選恰好 1 個正確答案、多選 1 個以上且作答須全對才算對；單選／多選至少 2 個非空選項且選項不得重複；投票不設標準答案；開放式文字題不設自動判分，其提交內容稱文字回饋。欄位不設字數上限、一律移除首尾空白。");
      p.appendChild(hint);
      const act = el("div", { class: "row", style: "margin-top:12px" },
        `<button class="primary" id="qe-save">保存題庫</button>`);
      act.querySelector("#qe-save").addEventListener("click", () => {
        const name = p.querySelector("#qe-name").value.trim();
        if (!name) { toast("拒絕建立：題庫名稱必填，請指出可修正欄位。", "warn"); return; }
        qs.name = name;
        qs.topic = p.querySelector("#qe-topic").value.trim();
        qs.description = p.querySelector("#qe-desc").value.trim();
        qs.tags = p.querySelector("#qe-tags").value.trim().split(/\s+/).filter(Boolean);
        qs.updatedAt = "2026-11-03 12:00";
        toast("已保存（示意）。已被活動引用仍可維護，既有活動題目快照不受影響。");
        paint();
      });
      p.appendChild(act);
      main.appendChild(p);
      p.scrollIntoView({ behavior: "smooth" });
    }
    paint();
  },

  /* M06 教學活動管理 */
  m06(main) {
    const tabs = el("div", { class: "row", style: "margin-bottom:14px", id: "m06-tabs" });
    [["ALL", "全部"], ["NOT_STARTED", "尚未開始"], ["IN_PROGRESS", "進行中"], ["ENDED", "歷史活動（已結束）"]]
      .forEach(([k, label], i) => tabs.appendChild(el("button", { class: i === 0 ? "primary" : "", data: null, onclick: e => {
        tabs.querySelectorAll("button").forEach(b => b.classList.remove("primary"));
        e.currentTarget.classList.add("primary");
        paint(k);
      } }, label)));
    main.appendChild(tabs);
    const newBtn = el("button", { class: "primary", style: "margin-bottom:14px" }, "建立教學活動");
    main.appendChild(newBtn);
    const wrap = el("div", { id: "m06-list" });
    main.appendChild(wrap);
    function statusLabel(s) { return { NOT_STARTED: "尚未開始", IN_PROGRESS: "進行中", ENDED: "已結束" }[s]; }
    function paint(f = "ALL") {
      wrap.innerHTML = "";
      SEED.activities.filter(a => f === "ALL" || a.status === f).forEach(a => {
        const locked = a.groupConfirmed || a.status === "ENDED" ? a.status === "ENDED" : false;
        const p = el("div", { class: "panel" });
        p.innerHTML = `
          <div class="row space">
            <h2 style="margin:0">${esc(a.name)}</h2>
            ${statusTag(a.status)}
          </div>
          <p class="muted" style="margin:6px 0 12px">Game PIN <b>${esc(a.pin)}</b>（6 位數字，允許前導 0）｜${esc(a.date)}｜主辦單位：${esc(a.organizer || "—")}｜已加入 ${a.joined} 人</p>
          <div class="row" style="margin-bottom:10px">
            <span class="tag t-lock">grouping_mode=${a.grouping}</span>
            <span class="tag t-lock">leaderboard_mode=${a.leaderboard}</span>
            ${a.groupConfirmed ? '<span class="tag t-gold">分組已確認（模式已鎖定）</span>' : ""}
            ${a.status === "ENDED" ? '<span class="tag t-neutral">模式鎖定至活動結束</span>' : ""}
          </div>`;
        const row = el("div", { class: "row" });
        if (a.status !== "ENDED") {
          row.appendChild(el("button", { class: "primary", onclick: () => {
            state.activity = a; state.qsIndex = 0; state.qState = "none";
            state.published = { stats: false, answer: false, board: false };
            state.submissions = {}; state.answeredCount = 0;
            go({ page: "m07" });
          } }, "開啟控制台"));
          row.appendChild(el("button", { onclick: () => showJoin(a) }, "加入資訊"));
          row.appendChild(el("button", { class: "danger", onclick: () => {
            if (confirm(`結束活動「${a.name}」？\n結束後不可恢復，加入與互動即停止，結果保留（歷史活動）。`)) {
              a.status = "ENDED"; toast("活動已結束（不可恢復）。重複結束視為冪等成功。"); paint(f);
            }
          } }, "結束活動"));
        } else {
          row.appendChild(el("button", { onclick: () => go({ page: "m09" }) }, "檢視活動摘要報表"));
          row.appendChild(el("span", { class: "muted" }, "已結束：不可重新啟動，加入資訊已失效。"));
        }
        p.appendChild(row);
        wrap.appendChild(p);
      });
    }
    function showJoin(a) {
      $("#join-panel")?.remove();
      const p = el("div", { class: "panel", id: "join-panel" },
        `<h2>加入資訊：${esc(a.name)}</h2>
         <p>Game PIN：<b style="font-family:var(--serif);font-size:30px;letter-spacing:.12em">${esc(a.pin)}</b></p>
         <p>活動連結：<code>https://example.com/j/${esc(a.pin)}</code>　QR Code：<span class="muted">（雛形示意）</span> ▦</p>
         <p class="muted">三種入口指向同一活動加入流程；僅在活動允許加入期間有效。輪替／撤銷時整組加入資訊一併失效，不可分別撤銷。</p>
         <div class="pending">Game PIN 全平台唯一性、活動允許加入期間的起訖條件：待平台契約定義。</div>
         <div class="row" style="margin-top:10px"><button class="danger">輪替加入資訊</button>
         <span class="muted">確認後舊 PIN／連結／QR Code 全部失效。</span></div>`);
      p.querySelector(".danger").addEventListener("click", () => {
        a.pin = String(Math.floor(Math.random() * 1e6)).padStart(6, "0");
        toast("已輪替：新 Game PIN " + a.pin + "；舊加入資訊一併失效。");
        p.remove(); paint("ALL");
      });
      main.appendChild(p);
    }
    newBtn.addEventListener("click", () => {
      $("#act-new")?.remove();
      const mine = SEED.questionSets.filter(qs => qs.owner === state.currentUser.email && !qs.deleted);
      const p = el("div", { class: "panel", id: "act-new" }, `<h2>建立教學活動</h2>
        <label class="f"><span class="req">活動名稱</span><input type="text" id="an-name"></label>
        <label class="f"><span>日期（選填）</span><input type="text" id="an-date" placeholder="2026-11-10"></label>
        <label class="f"><span>主辦單位（選填）</span><input type="text" id="an-org"></label>
        <label class="f"><span class="req">選擇題庫（僅本人可存取；建立時保存題目快照）</span>
          <select id="an-qs">${mine.map(q => `<option value="${q.id}">${esc(q.name)}（${q.questions.length} 題）</option>`).join("")}</select></label>
        <h3>活動設定</h3>
        <label class="row" style="gap:8px"><input type="checkbox" id="an-score" checked> 啟用計分（計分題答對 100 分）</label>
        <label class="row" style="gap:8px;margin-top:6px"><input type="checkbox" id="an-anon"> 匿名模式（老師端與投影不顯示個資，系統仍保留活動內識別能力）</label>
        <h3>模式設定（相容性由系統驗證）</h3>
        <div class="grid2">
          <label class="f"><span>grouping_mode（分組模式）</span>
            <select id="an-gm"><option value="INDIVIDUAL">INDIVIDUAL（不分組，預設）</option><option value="TEAM">TEAM（分組）</option></select></label>
          <label class="f"><span>leaderboard_mode（排行榜模式）</span>
            <select id="an-lm"><option value="NONE">NONE（預設）</option><option value="INDIVIDUAL">INDIVIDUAL（個人排行榜，僅不分組）</option><option value="TEAM">TEAM（隊伍排行榜，僅分組）</option></select></label>
        </div>
        <p class="muted">允許組合僅 INDIVIDUAL+NONE／INDIVIDUAL 與 TEAM+NONE／TEAM；投票及開放式文字題預設不計分。</p>
        <div class="row"><button class="primary" id="an-save">建立活動</button></div>`);
      main.appendChild(p);
      p.querySelector("#an-save").addEventListener("click", () => {
        const name = p.querySelector("#an-name").value.trim();
        const gm = p.querySelector("#an-gm").value, lm = p.querySelector("#an-lm").value;
        if (!name) { toast("拒絕：活動名稱必填。", "warn"); return; }
        if (!((gm === "INDIVIDUAL" && (lm === "NONE" || lm === "INDIVIDUAL")) ||
              (gm === "TEAM" && (lm === "NONE" || lm === "TEAM")))) {
          toast("模式組合不支援：INDIVIDUAL 只能配 NONE／INDIVIDUAL；TEAM 只能配 NONE／TEAM。", "warn");
          return;
        }
        const a = { id: "act" + Date.now(), host: state.currentUser.email, name,
          date: p.querySelector("#an-date").value.trim() || "—", organizer: p.querySelector("#an-org").value.trim(),
          pin: String(Math.floor(Math.random() * 1e6)).padStart(6, "0"), status: "NOT_STARTED",
          grouping: gm, leaderboard: lm, scoring: p.querySelector("#an-score").checked,
          anonymous: p.querySelector("#an-anon").checked, questionSetId: p.querySelector("#an-qs").value, joined: 0 };
        SEED.activities.unshift(a);
        toast("活動已建立並保存題目快照（SESSION_QUESTION）：事後修改題庫，不影響本活動歷史結果。");
        paint("ALL");
      });
    });
    paint("ALL");
  },

  /* M07 老師即時控制台 */
  m07(main) {
    if (!state.activity) { main.appendChild(el("p", { class: "muted" }, "請先從「教學活動管理」選擇活動並開啟控制台。")); return; }
    const a = state.activity;
    const qs = SEED.questionSets.find(x => x.id === a.questionSetId);
    const q = qs?.questions[state.qsIndex];
    pubBoard();
    function pubBoard() {
      const map = { stats: "答案分布", answer: "正確答案", board: "排行榜" };
      main.appendChild(el("div", { class: "panel", style: "border-color:var(--garnet)" },
        `<div class="row space">
          <div class="kpi">
            <div><b>${{ NOT_STARTED: "尚未開始", IN_PROGRESS: "進行中", ENDED: "已結束" }[a.status]}</b><span>活動狀態</span></div>
            <div><b class="count-num" style="color:var(--ink)">${{ none: "未選題", selected: "已選題未開放", open: "作答中", closed: "已停止作答" }[state.qState]}</b><span>目前題目狀態</span></div>
            <div><b>${a.pin}</b><span>Game PIN</span></div>
          </div>
          <div class="stat-bar" id="pub-bar">${
            Object.entries(map).map(([k, l]) =>
              `<span class="${state.published[k] ? "pv" : ""}">${l}${state.published[k] ? " 已公布" : ""}</span>`).join("")
          }</div>
        </div>
        <p class="muted" style="margin:10px 0 0">模式：<code>grouping_mode=${a.grouping}</code>／<code>leaderboard_mode=${a.leaderboard}</code>
           ${a.groupConfirmed || a.firstScoredOpened ? "｜模式已鎖定" : "｜尚未鎖定（首道計分題開放時鎖定）"}
           ｜控制端租約：${esc(state.lease)}<span class="muted">（租約細節待平台契約）</span></p>`));
    }
    const grid = el("div", { class: "console" });
    main.appendChild(grid);

    /* 左欄：舞台與控制 */
    const left = el("div");
    const stage = el("div", { class: "stage" });
    paintStage();
    function paintStage() {
      if (!q) { stage.innerHTML = `<div class="stem" style="opacity:.6">尚未選題。啟動活動後依題序逐題前進；不得跳題或返回。</div>`; }
      else {
        const stem = `<div class="stem">${esc(q.stem)}</div>`;
        const opts = q.options?.length
          ? `<div class="opts">${q.options.map((o, i) =>
              `<div class="opt ${state.published.answer && q.correct?.includes(i) ? "correct" : ""}">${["Ａ", "Ｂ", "Ｃ", "Ｄ"][i] || "Ｅ"}. ${esc(o)}</div>`).join("")}</div>` : "";
        const ans = state.published.answer && q.correct
          ? `<div class="reveal-anim" style="margin-top:14px;color:var(--garnet);font-family:var(--serif);font-size:20px">正確答案：${esc(q.correct.map(i => q.options[i]).join("、"))}</div>` : "";
        stage.innerHTML = stem + opts + ans;
      }
    }
    left.appendChild(stage);
    const ctrl = el("div", { class: "ctrl" });
    const b1 = el("button", { class: "primary big" },
      a.status === "NOT_STARTED" ? "開始活動" : state.qState === "none" ? "選擇第一題" : "下一題");
    const b2 = el("button", { class: "accent big", disabled: !(q && state.qState === "selected") }, "開放作答");
    const b3 = el("button", { disabled: state.qState !== "open" }, "停止作答");
    const b4 = el("button", { disabled: state.qState !== "closed" || !(state.answeredCount > 0 || q) }, "公布統計");
    const b5 = el("button", { disabled: !(q && q.correct && state.qState !== "open" && state.qState !== "none") }, "公布正確答案");
    ctrl.append(b1, b2, b3);
    if ((a.grouping === "INDIVIDUAL" && a.leaderboard === "INDIVIDUAL") || (a.grouping === "TEAM" && a.leaderboard === "TEAM")) {
      ctrl.appendChild(el("button", { disabled: true, id: "pub-board" }, "公布排行榜"));
    }
    ctrl.append(b4, b5);
    if (a.grouping === "TEAM") {
      const bg = el("button", { onclick: () => showGrouping(a) }, "隨機分組／隊伍確認");
      ctrl.appendChild(bg);
    }
    left.appendChild(ctrl);
    const cdRow = el("div", { class: "row", style: "gap:8px;margin-top:12px" });
    const cd = el("select", {}, `<option value="0">不設倒數</option><option value="30">30 秒</option><option value="60">60 秒</option><option value="90">90 秒</option>`);
    cdRow.append(el("span", { class: "muted" }, "作答倒數（選填，到期只停止作答，不代表結算完成）"), cd);
    left.appendChild(cdRow);
    const projRow = el("div", { class: "row", style: "margin-top:14px" });
    projRow.appendChild(el("span", { class: "muted" }, "投影畫面："));
    const projSel = el("select", { style: "max-width:300px" },
      `<option value="join">加入 QR Code／Game PIN</option><option value="question">當前題目（核准內容）</option><option value="results">已公布結果</option>`);
    projSel.addEventListener("change", () => toast("投影已切換：切換畫面不會自動公布任何結果。"));
    projRow.appendChild(projSel);
    projRow.appendChild(el("button", { onclick: () => window.open(`projection.html?pin=${a.pin}&mode=${projSel.value}`, "_blank") }, "開啟投影"));
    projRow.appendChild(el("span", { class: "pending", style: "display:none" }, ""));
    projRow.lastChild.style.display = "";
    projRow.lastChild.textContent = "投影失聯顯示安全待機畫面";
    left.appendChild(projRow);
    grid.appendChild(left);

    /* 右欄：人數與即時統計 */
    const right = el("div");
    const kpiPanel = el("div", { class: "panel" },
      `<h2>參與人數（三項分別呈現）</h2><div class="kpi" id="kpi"><div><b id="k-online">${state.onlineCount}</b><span>在線人數（最近 60 秒內有效心跳）</span></div>
       <div><b id="k-joined">${a.joined}</b><span>已加入活動總人數</span></div>
       <div><b id="k-answered">${state.answeredCount}</b><span>目前題目已作答人數</span></div></div>`);
    right.appendChild(kpiPanel);
    const statPanel = el("div", { class: "panel" },
      `<h2>即時統計${q ? "：" + esc(q.stem) : ""}</h2><div id="stat-body"><p class="muted">未選題。</p></div>`);
    right.appendChild(statPanel);
    const pending = el("div", { class: "pending", style: "margin-top:10px" },
      "在線／心跳細節、心跳頻率與事件更新方式、控制端租約期限：待平台契約定義。統計未完成時回報「處理中」，不得視為就緒。");
    right.appendChild(pending);
    grid.appendChild(right);

    function paintStat() {
      const body = statPanel.querySelector("#stat-body");
      if (!q) { body.innerHTML = `<p class="muted">未選題。</p>`; return; }
      if (q.type === "開放式文字") {
        body.innerHTML = `<p>文字回饋提交數：<b>${state.answeredCount}</b>（僅計數，內容依核定報表契約提供；P0 不提供文字內容檢視）</p>`;
        return;
      }
      if (q.type === "投票") {
        body.innerHTML = `<p class="muted">投票題無標準答案、預設不計分。正確率：不適用。</p>` + distHtml(q, false === false);
        return;
      }
      body.innerHTML =
        `<p>作答人數 ${state.answeredCount}／資格快照人數 ${a.joined || "（示意象限）"}。未作答計 ${q.correct ? "1 人（未答計為錯誤）" : "—"}</p>` +
        distHtml(q, true);
      const acc = q.correct ? Math.round(100 * state.answeredCount / Math.max(1, a.joined) * 10) / 10 : null;
      if (acc !== null) body.appendChild(el("p", {}, `正確率（完全答對人數 ÷ 資格快照人數）：<b>${q.correct.length === 1 ? acc : acc}%</b>（多選須全對才算對）`));
      else body.appendChild(el("p", { class: "muted" }, "正確率：不適用"));
    }
    function distHtml(q, teacherView) {
      const total = Math.max(1, state.answeredCount);
      return `<div class="dist">${q.options.map((o, i) => {
        const c = state.submissions[i] || 0;
        const pct = (100 * c / total * 10 | 0) / 10;
        return `<div class="bar ${state.published.answer && q.correct?.includes(i) ? (state.published.stats ? "published" : "") : ""} ${!state.published.answer && q.correct?.includes(i) && teacherView ? "correct" : ""}">
          <span>${["Ａ", "Ｂ", "Ｃ", "Ｄ"][i]}</span><span class="track"><span class="fill" style="width:${pct}%"></span></span>
          <span>${c} 人 · ${pct}%</span></div>`;
      }).join("")}</div>
      ${teacherView && q.type !== "投票" ? `<p class="muted">教師視圖含作答／未作答人數；學員端公布統計僅顯示答案分布，不含未作答人數、正確率或文字回饋。</p>` :
        teacherView ? `<p class="muted">教師視圖；公布至學員端時僅顯示答案分布。</p>` : ""}`;
    }

    /* 控制流程 */
    b1.addEventListener("click", () => {
      if (a.status === "NOT_STARTED") {
        a.status = "IN_PROGRESS"; a.joined ||= 24;
        state.onlineCount = 22;
        toast("活動已開始（進行中）。開始活動不等同開放任何題目；學員進入等候。");
        refresh();
      } else if (state.qState === "none") {
        state.qsIndex = 0; state.qState = "selected";
        toast("已依題序選擇第一道題目。學員在題目未開放時不能提交答案。");
        refresh();
      } else {
        if (state.qState !== "closed") { toast(`（示意）下一題須目前題目已停止作答${q?.type === "投票" || q?.type === "開放式文字" ? "" : "且必要結算完成"}。`, "warn"); return; }
        if (state.qsIndex >= qs.questions.length - 1) { toast("沒有下一道可用題目。不得跳題、返回已完成題或重開已停止題。", "warn"); return; }
        state.qsIndex++; state.qState = "selected";
        state.published = { stats: false, answer: false, board: false };
        state.submissions = {}; state.answeredCount = 0;
        toast("已依題序切換至下一題。");
        refresh();
      }
    });
    b2.addEventListener("click", () => {
      if (!q) return;
      state.qState = "open";
      // 示意提交流入
      state.submissions = {}; state.answeredCount = 0;
      const base = Math.min(a.joined || 24, 18);
      q.options?.forEach((_, i) => state.submissions[i] = 0);
      let t = 0;
      const iv = setInterval(() => {
        if (state.qState !== "open") { clearInterval(iv); return; }
        t++;
        state.answeredCount = Math.min(base, Math.round(base * t / 8));
        if (q.options) {
          const pool = [...q.options.keys()];
          for (let i = 0; i < state.answeredCount; i++) {
            const pick = pool[Math.floor(Math.sin(i * 7 + t) * 1000 % 1e4) % q.options.length];
            state.submissions[pick] = (state.submissions[pick] || 0) + 1;
          }
        }
        $("#k-answered") && ($("#k-answered").textContent = state.answeredCount);
        paintStat();
      }, 900);
      state.learnerTimer && clearInterval(state.learnerTimer);
      state.learnerTimer = iv;
      // 首道計分題 → 鎖定模式
      const isScored = q.type === "單選" || q.type === "多選";
      if (isScored && a.scoring && !a.firstScoredOpened) { a.firstScoredOpened = true; toast("本題為第一道計分題：分組/排行榜模式已原子鎖定至活動結束。"); }
      const secs = +cd.value;
      const start = () => { b2.disabled = true; b3.disabled = false; b4.disabled = false; b5.disabled = !q.correct; paintStat(); };
      start();
      if (secs > 0) setTimeout(() => {
        if (state.qState === "open") { state.qState = "closed"; b3.disabled = true; toast("作答倒數到期：已自動停止作答（不代表結算完成）。"); }
      }, Math.min(secs, 10) * 1000);
      toast("已開放作答。只有開放狀態才接受學員答案；開放期間允許更新，採最後一筆成功提交。");
    });
    b3.addEventListener("click", () => {
      state.qState = "closed"; b3.disabled = true;
      if (state.learnerTimer) clearInterval(state.learnerTimer);
      toast("已停止作答：不再接受新的有效答案；已成功提交的答案保留供統計。");
    });
    b4.addEventListener("click", () => {
      if (state.qState !== "closed") { toast("目前題目尚在作答中或未選題。", "warn"); return; }
      state.published.stats = true;
      toast("已公布統計至學員端與投影：僅顯示答案分布。公布不可撤回。");
      pubBoard(); paintStat();
    });
    b5.addEventListener("click", () => {
      if (!q?.correct) { toast("投票題與開放式文字題不設標準答案，公布正確答案不適用。", "warn"); return; }
      state.published.answer = true;
      paintStage(); pubBoard();
      toast("已公布正確答案（一經公布不可撤回）。學員端僅適用有標準答案題型。");
    });
    const bb = ctrl.querySelector("#pub-board");
    bb?.addEventListener("click", () => {
      state.published.board = true;
      state.leaderboard = a.grouping === "TEAM"
        ? [["Team-1", "166.67", 1], ["Team-2", "133.33", 2], ["Team-3", "133.33", 2]]
        : [["王小明", "300", 1], ["林志玲".replace("志玲", "同學"), "200", 2], ["陳同學", "200", 2], ["黃同學", "100", 4]];
      toast("已公布排行榜（個人採競賽排名 1、1、3；隊伍採密集排名 1、1、2）。公布不可撤回。");
      pubBoard();
      statPanel.querySelector("#stat-body").innerHTML =
        `<h3>排行榜（密集）${a.grouping === "TEAM" ? " — 隊伍得分＝具資格隊員得分總和 ÷ 該題有效人數" : " — 個人得分（每題答對 100）"}</h3>
         <table class="l"><thead><tr><th>名次</th><th>${a.grouping === "TEAM" ? "隊伍" : "學員（示意）"}</th><th>得分</th></tr></thead><tbody>${
          state.leaderboard.map(([n, s, r]) => `<tr><td>${r}</td><td>${esc(n)}</td><td>${s}</td></tr>`).join("")
         }</tbody></table>
         <p class="muted">同分並列，不使用未公告的決勝規則（如速度加分）。投影遮蔽學員識別資訊；顯示比例小數 1 位、報表小數 2 位。</p>`;
    });

    function rosterOf(a) {
      if (a.roster) return a.roster;
      const n = a.joined || 24;
      a.roster = Array.from({ length: n }, (_, i) => "學員-" + String(i + 1).padStart(2, "0"));
      return a.roster;
    }
    function teamLabel(i) { return "Team-" + (i + 1); }
    function splitBalanced(names, k) {
      const shuffled = names.slice();
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      const teams = Array.from({ length: k }, () => []);
      shuffled.forEach((m, i) => teams[i % k].push(m));
      return teams;
    }
    function showGrouping(a) {
      $("#grp-panel")?.remove();
      const locked = a.groupConfirmed || a.firstScoredOpened;
      if (!a.groups) {
        const teams = splitBalanced(rosterOf(a), 3);
        a.groups = teams.map((ms, i) => ({ name: teamLabel(i), members: ms }));
      }
      let picked = null; // 目前選取待調整的組員
      const p = el("div", { class: "panel", id: "grp-panel" });
      const teamsBox = el("div", { id: "grp-teams" });

      function membersOf() { return a.groups.flatMap(g => g.members); }
      function commit() { toast("已更新分組安排（尚未確認）。"); paintTeams(); }
      function moveChip(chipName, from, to) {
        if (locked || from === to) return;
        a.groups[from].members = a.groups[from].members.filter(m => m !== chipName);
        a.groups[to].members.push(chipName);
        picked = null;
        commit();
      }
      function renameTeam(i, raw) {
        const name = raw.trim();
        const dup = a.groups.some((g, j) => j !== i && g.name === name);
        if (!name || name.length > 30 || dup) {
          toast(dup ? "隊名重複：活動內不得重複，已還原。" : "隊名須為 1–30 字，已還原。", "warn");
        } else {
          a.groups[i].name = name;
          toast("已更新隊名。");
        }
        paintTeams();
      }
      function paintTeams() {
        teamsBox.innerHTML = "";
        a.groups.forEach((g, i) => {
          const card = el("div", { class: "grp-team" + (picked !== null && i !== null ? "" : "") });
          if (picked !== null) card.classList.add("grp-target");
          const head = el("div", { class: "grp-team-head" });
          if (locked) {
            head.innerHTML = `<b>${esc(g.name)}</b><span class="muted">${g.members.length} 人</span>`;
          } else {
            const nameBtn = el("button", { class: "grp-name", title: "編輯隊名" }, esc(g.name));
            nameBtn.addEventListener("click", () => {
              const inp = el("input", { type: "text", value: g.name, maxlength: "30" });
              head.replaceChild(inp, nameBtn); inp.focus(); inp.select();
              const done = () => renameTeam(i, inp.value);
              inp.addEventListener("blur", done);
              inp.addEventListener("keydown", e => { if (e.key === "Enter") inp.blur(); if (e.key === "Escape") { inp.removeEventListener("blur", done); paintTeams(); } });
            });
            head.appendChild(nameBtn);
            head.appendChild(el("span", { class: "muted" }, `${g.members.length} 人`));
          }
          card.appendChild(head);
          const mList = el("div", { class: "grp-members" });
          g.members.forEach(m => {
            const chip = el("button", {
              class: "chip" + (picked === m ? " sel" : ""),
              disabled: locked,
              draggable: String(!locked),
            }, esc(m));
            chip.addEventListener("click", () => {
              if (locked) return;
              picked = picked === m ? null : m;
              toast(picked ? `已選取 ${esc(m)}：點擊目標隊伍即可移動。` : "已取消選取。");
              paintTeams();
            });
            chip.addEventListener("dragstart", e => {
              e.dataTransfer.setData("text/plain", m + "|" + i);
            });
            chip.addEventListener("dragend", () => { teamsBox.querySelectorAll(".grp-team").forEach(t => t.classList.remove("grp-over")); });
            mList.appendChild(chip);
          });
          if (!g.members.length) mList.appendChild(el("span", { class: "muted" }, "（無組員）"));
          card.appendChild(mList);
          if (!locked) {
            card.addEventListener("dragover", e => { e.preventDefault(); card.classList.add("grp-over"); });
            card.addEventListener("dragleave", () => card.classList.remove("grp-over"));
            card.addEventListener("drop", e => {
              e.preventDefault(); card.classList.remove("grp-over");
              const [m, from] = e.dataTransfer.getData("text/plain").split("|");
              if (m && from !== undefined && !locked) moveChip(m, Number(from), i);
            });
          }
          if (picked !== null) {
            const hint = el("button", { class: "grp-move" }, "移入組員");
            hint.addEventListener("click", e => { e.stopPropagation(); moveChip(picked, a.groups.findIndex(g => g.members.includes(picked)), i); });
            card.appendChild(hint);
          }
          teamsBox.appendChild(card);
        });
      }
      function pickedFrom() { return a.groups.findIndex(g => g.members.includes(picked)); }

      const tools = el("div", { class: "row", style: "margin:8px 0 4px" });
      const cntInput = el("input", { type: "number", id: "grp-count", value: a.groups.length, min: "2", max: "10", style: "width:90px" });
      tools.append(
        el("label", { class: "row", style: "gap:6px;font-size:14px" }, "隊伍數", cntInput),
        el("button", { class: "primary", id: "grp-reroll", disabled: locked }, "重新隨機分組"),
      );
      tools.querySelector("#grp-reroll").addEventListener("click", () => {
        const k = Number(cntInput.value);
        if (!Number.isInteger(k) || k < 2 || k > 10) { toast("隊伍數須為 2–10 的整數。", "warn"); return; }
        const names = a.groups.flatMap(g => g.name.startsWith("Team-") ? [] : [g.name]);
        const members = rosterOf(a).slice();
        // 保留已自訂隊名（不足者補 Team-N）
        const teams = splitBalanced(members, k);
        a.groups = teams.map((ms, i) => ({ name: names[i] || teamLabel(i), members: ms }));
        picked = null;
        commit();
      });

      const actRow = el("div", { class: "row" });
      const confirmBtn = el("button", { class: "accent", id: "grp-confirm", disabled: locked }, "確認分組（即鎖定隊伍與模式）");
      confirmBtn.addEventListener("click", () => {
        a.groupConfirmed = true;
        toast("已確認分組：隊伍安排與 grouping_mode／leaderboard_mode 即時鎖定。");
        $("#grp-panel")?.remove(); showGrouping(a); pubBoard();
      });
      actRow.appendChild(confirmBtn);
      actRow.appendChild(el("button", { class: "danger", id: "grp-unlock" }, "解鎖／重建分組（僅首道計分題開放前）"));
      actRow.querySelector("#grp-unlock").addEventListener("click", () => {
        if (a.firstScoredOpened) { toast("首道計分題已開放：不得解鎖、重建或切換模式；如需變更須另開活動。", "warn"); return; }
        const reason = prompt("解鎖／重建須填寫原因（操作前再次確認）：");
        if (reason) { a.groupConfirmed = false; toast("已解鎖，可重新調整隊伍；既有題目資格快照與已結算分數不受影響。"); $("#grp-panel")?.remove(); showGrouping(a); pubBoard(); }
      });

      p.appendChild(el("h2", {}, "分組（僅 TEAM 模式顯示）"));
      if (locked) {
        p.appendChild(el("p", { class: "tag t-gold" }, a.groupConfirmed ? "分組已確認（模式已鎖定）" : "首道計分題已開放：模式與隊伍安排已原子鎖定"));
      }
      p.appendChild(tools);
      p.appendChild(el("p", { class: "muted" }, "隨機洗牌後儘量平均分配；任兩隊人數差至多 1。每場至多 300 位有效學員、10 隊。重新分組不影響已自訂的隊名。"));
      p.appendChild(teamsBox);
      p.appendChild(el("p", { class: "muted" }, "調整組員：點選組員後再點目標隊伍的「移入組員」，或直接拖曳。隊名點擊即可編輯（1–30 字、活動內不得重複；未自訂用 Team-1、Team-2…）。手動調整組員於確認前可用。"));
      p.appendChild(actRow);
      p.appendChild(el("p", { class: "muted", style: "margin-top:8px" }, "遲到者指派至當時人數最少隊伍（並列時隨機）；僅參與尚未開放且具資格的計分題；所有計分題已開放或結束後加入者為旁聽。"));
      paintTeams();
      main.appendChild(p);
      p.scrollIntoView({ behavior: "smooth" });
    }

    function refresh() {
      go({ page: "m07", silent: true });
    }
  },

  /* M09 即時統計與結果分析 */
  m09(main) {
    main.appendChild(el("p", { class: "muted" }, "統計先「統計可查」（內部就緒），經主持老師「公布」才向學員顯示；公布不可撤回。歷史報表依活動當時的題目快照（SESSION_QUESTION）。"));
    const acts = SEED.activities.filter(a => a.host === state.currentUser.email);
    acts.forEach(a => {
      const qs = SEED.questionSets.find(x => x.id === a.questionSetId);
      const p = el("div", { class: "panel" }, `<h2>${esc(a.name)} ${statusTag(a.status)}</h2>
        <p class="muted">已加入 ${a.joined} 人｜<code>leaderboard_mode=${a.leaderboard}</code></p>`);
      const t = el("table", { class: "l" }, `<thead><tr><th>題目</th><th>題型</th><th>作答完成率</th><th>正確率</th><th>答案分布</th></tr></thead>`);
      const tb = el("tbody");
      qs.questions.forEach((q, i) => {
        const eligible = a.joined || 0;
        const answered = a.status === "ENDED" || a.status === "IN_PROGRESS" ? Math.min(eligible, 30 - i * 7) : 0;
        const completion = eligible > 0 ? (100 * answered / eligible * 10 | 0) / 10 + "%" : "不適用";
        const accur = q.correct && eligible > 0 ? (100 * answered / eligible * 10 | 0) / 10 + "%" : "不適用";
        tb.appendChild(el("tr", {}, `<td>${esc(q.stem)}</td><td><span class="tag t-lock">${q.type}</span></td>
          <td>${completion}（有效作答 ${answered}/${eligible}）</td>
          <td>${accur}${q.type === "多選" ? '<div class="muted">多選須全對才算對</div>' : ""}</td>
          <td class="muted">${q.options ? "ＡＢＣＤ 各選項比例顯示至小數 1 位（總和可能不為 100%）" : "文字回饋提交數：" + Math.min(answered, 12)}</td>`));
      });
      t.appendChild(tb); p.appendChild(t);
      const avg = qs.questions.filter(q => q.correct).length;
      const overallAvg = avg > 0
        ? Math.round(qs.questions.filter(q => q.correct).reduce((s, q, idx, arr) => s + Math.min(a.joined || 0, 30 - qs.questions.indexOf(q) * 7) / Math.max(1, a.joined || 1) * 100, 0) / avg * 10) / 10 + "%"
        : "不適用";
      const fbCount = qs.questions.filter(q => q.type === "開放式文字").length;
      p.appendChild(el("p", {},
        `活動整體正確率（適用逐題值算術平均，不加權）：<b>${overallAvg}</b>｜文字回饋提交數：<b>${fbCount ? "合併計數，僅提供數量，不提供文字內容" : "0"}</b>`));
      if (a.leaderboard !== "NONE") {
        const lb = a.grouping === "TEAM"
          ? [["Team-1", "66.67", 1], ["Team-2", "33.33", 2]]
          : [["學員 A（示意，去識別化）", "300", 1], ["學員 B（示意）", "200", 2], ["學員 C（示意）", "200", 2], ["學員 D（示意）", "100", 4]];
        p.appendChild(el("div", {}, `<h3>${a.grouping === "TEAM" ? "隊伍排行榜（密集排名）" : "個人排行榜（競賽排名）"}</h3>
          <table class="l"><tbody>${lb.map(([n, s, r]) => `<tr><td>${r}</td><td>${esc(n)}</td><td>${s}</td></tr>`).join("")}</tbody></table>
          <p class="muted">僅於相容模式啟用且老師公布後向學員顯示；此處為教師報表視圖。${a.grouping === "TEAM" ? "隊伍得分＝具資格隊員得分總和 ÷ 該題有效人數。" : "個人得分：每題答對 100、其餘 0、等權重累加。"}</p>`));
      } else {
        p.appendChild(el("p", { class: "muted" }, "leaderboard_mode=NONE：不得因此省略教師所需彙總統計，但不得生成或向學員提供排行榜（BR-029）。"));
      }
      const row = el("div", { class: "row", style: "margin-top:8px" });
      row.appendChild(el("button", { onclick: () => toast("（P1）報表匯出為 UTF-8 CSV／XLSX，欄位對齊畫面報表，文字欄位防公式注入；P0 尚未開放。") }, "匯出報表（P1）"));
      row.appendChild(el("button", { onclick: () => toast("（P1）組織排行榜：比較授權同場活動的組織標準化成績；不開放跨組織原始資料。P0 尚未開放。") }, "組織排行榜（P1）"));
      p.appendChild(row);
      main.appendChild(p);
    });
    main.appendChild(el("div", { class: "pending" },
      "提交版本與重試細節、統計／團隊結算狀態名稱與同步協定、M11 團隊結果詳規：待工程契約核定。"));
  },

  /* M10 系統設定與營運監控（P1） */
  m10(main) {
    main.appendChild(el("p", { class: "pending" }, "本模組為 P1。參數代碼、型別、核准值與可調範圍由平台政策核定；批次更新版本欄位與衝突回應格式待平台契約。"));
    const p = el("div", { class: "panel" }, `<h2>系統參數（活動預設值＋登入 Session 逾時）</h2>`);
    [["活動預設值", "匿名模式", "選項", "關閉"], ["活動預設值", "排行榜模式", "選項", "NONE"], ["登入 Session", "閒置逾時", "分鐘", "30"]].forEach(([cat, n, ty, v]) => {
      p.appendChild(el("label", { class: "f" }, `<span>${cat}：${n}（${ty}）</span><input type="text" value="${v}">`));
    });
    p.appendChild(el("div", { class: "row" }, `<button class="primary">批次更新（全有全無）</button>
      <span class="muted">版本不符時全數拒絕並要求重新讀取。變更只套用於新建立的活動／Session，不回溯既有。</span>`));
    main.appendChild(p);
    const mon = el("div", { class: "panel" }, `<h2>活動監控（僅查詢；不含告警、不提供活動控制）</h2>`);
    const t = el("table", { class: "l" }, `<thead><tr><th>活動</th><th>活動狀態</th><th>彙總連線狀態</th><th>最後更新</th></tr></thead>`);
    const tb = el("tbody");
    SEED.activities.filter(a => a.status === "IN_PROGRESS").forEach(a => {
      tb.appendChild(el("tr", {}, `<td>${esc(a.name)}（Game PIN ${esc(a.pin)}）</td><td>進行中</td>
        <td><span class="tag t-active">在線 ${22}/${a.joined}</span> <span class="muted">（活動層級摘要，不含個別參與者明細）</span></td><td class="muted">2026-11-03 10:42:15</td>`));
    });
    tb.appendChild(el("tr", {}, `<td>（示意）另一場活動</td><td>進行中</td><td><span class="tag t-disabled">未知</span> <span class="muted">連線狀態過期或來源暫時無法取得時標示「未知」，不得呈現為即時正常。</span></td><td class="muted">—</td>`));
    t.appendChild(tb); mon.appendChild(t);
    main.appendChild(mon);
  },
};

function statusTag(s) {
  const m = { NOT_STARTED: ["尚未開始", "t-neutral"], IN_PROGRESS: ["進行中", "t-active"], ENDED: ["已結束", "t-disabled"] };
  const [label, cls] = m[s];
  return `<span class="tag ${cls}">${label}</span>`;
}
function statusTagAccount(s) {
  const m = { ACTIVE: ["啟用", "t-active"], INVITED: ["已邀請", "t-invited"], DISABLED: ["停用", "t-disabled"] };
  const [label, cls] = m[s];
  return `<span class="tag ${cls}">${label}</span>`;
}
function tagOk(x) { return `<span class="tag t-neutral">${x}</span>`; }

function go(route) {
  state.route = route;
  const page = route.page;
  if (page === "login" || !state.currentUser) { renderLogin(); return; }
  const titles = { home: "總覽", m02: "角色管理", m03: "老師維護與管理", m04: "角色與功能對應管理", m05: "題庫管理", m06: "教學活動管理", m07: "老師即時控制台", m09: "即時統計與結果分析", m10: "系統設定與營運監控（P1）" };
  const fn = PAGES[page] || PAGES.home;
  renderShell(page, titles[page] || "智學互動平台", fn);
}

go({ page: "login" });