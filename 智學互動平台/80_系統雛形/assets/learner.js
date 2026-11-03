/* 學員端雛形 — 學員為單場教學活動的臨時參與者（Participant），不需正式帳號 */
"use strict";
const $ = (s, e = document) => e.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const L = {
  step: "pin",            // pin | nickname | waiting | question | feedback | done
  pin: "",
  nickname: "",
  displayName: "",
  team: "",
  pick: [],
  submitted: false,
  publishedStats: false,
  publishedAnswer: false,
  publishedBoard: false,
  textFeedback: "",
};

const ACT = {
  pin: "007432",
  set: { questions: [
    { type: "單選", stem: "CPR 按壓深度成人建議為？", options: ["2 公分", "5 公分", "10 公分", "不限制"], correct: [1] },
    { type: "多選", stem: "以下哪些是急救前應確認的事項？（全對才算答對）", options: ["現場安全", "意識與呼吸", "聯絡急救單位", "先拍照打卡"], correct: [0,1,2] },
    { type: "投票", stem: "你今天最有收穫的部分？", options: ["實作練習", "觀念講解", "案例分享", "Q&A"] },
    { type: "開放式文字", stem: "請寫下一件事你今天學到的事。" },
  ]},
};

const root = $("#root");
const card = el =>
  { const d = document.createElement("div"); d.className = "learner-stage"; d.appendChild(el); root.innerHTML=""; root.appendChild(d); return d; };
const topBar = () => `<div class="learner-top">Game PIN ${L.pin}｜${esc(L.displayName || "")}${L.team ? "｜所屬隊伍：" + esc(L.team) : ""} <span class="tag t-active" style="font-size:11px">在線（心跳示意）</span></div>`;

function render() {
  if (L.step === "pin") return stepPin();
  if (L.step === "nickname") return stepNickname();
  if (L.step === "waiting") return stepWaiting();
  if (L.step === "question") return stepQuestion();
  if (L.step === "feedback") return stepFeedback();
  if (L.step === "done") return stepDone();
}

/* 加入：Game PIN／活動連結／QR Code 三種入口指向同一活動加入流程 */
function stepPin() {
  const wrap = document.createElement("div");
  wrap.innerHTML = `<h1 style="text-align:center">加入活動</h1>
    <p class="muted" style="text-align:center">輸入老師投影畫面上的 6 位數字 Game PIN（允許前導 0）。</p>`;
  const f = document.createElement("form");
  f.innerHTML = `<label class="f"><span>Game PIN</span>
    <input type="text" id="lp-pin" inputmode="numeric" maxlength="6" style="text-align:center;font-size:24px;letter-spacing:.3em">
    </label><button class="primary big" style="width:100%" type="submit">加入</button><p class="muted" id="lp-err" style="min-height:1.4em"></p>`;
  f.addEventListener("submit", e => {
    e.preventDefault();
    const v = f.querySelector("#lp-pin").value.trim();
    if (!/^\d{6}$/.test(v)) { f.querySelector("#lp-err").textContent = "Game PIN 為 6 位數字（允許前導 0）。"; return; }
    if (v !== ACT.pin) { f.querySelector("#lp-err").textContent = "無法加入：加入資訊無效、已失效，或活動已結束。"; return; }
    L.pin = v; L.step = "nickname";
    setTimeout(render, 60);
  });
  wrap.appendChild(f);
  const note = document.createElement("div");
  note.className = "pending";
  note.textContent = "參與者憑證格式、保存與重試限制：待平台契約（憑證用於斷線後重連，與加入資訊不同）。";
  wrap.appendChild(note);
  const q = new URLSearchParams(location.search);
  if (q.get("pin")) { /* 從活動連結/QR Code 直入 */ }
  card(wrap);
}

/* 暱稱選填；留空由系統分配顯示名稱；重複暱稱附加辨識序號 */
function stepNickname() {
  const wrap = document.createElement("div");
  wrap.innerHTML = `<p class="muted" style="text-align:center">已驗證加入資訊</p><h1 style="text-align:center">你希望怎麼稱呼？</h1>`;
  const f = document.createElement("form");
  f.innerHTML = `<label class="f"><span>暱稱（選填；留空由系統分配活動內顯示名稱）</span><input type="text" id="lp-nn" maxlength="20"></label>
    <button class="primary big" style="width:100%" type="submit">進入活動</button>`;
  f.addEventListener("submit", e => {
    e.preventDefault();
    const v = f.querySelector("#lp-nn").value.trim();
    if (v) { L.nickname = v; L.displayName = v === "王小明" ? v + "（2）" : v; }
    else L.displayName = "顯示名稱-" + Math.floor(Math.random() * 90 + 10); // 系統分配；不作唯一鍵
    L.team = "Team-2"; // TEAM 模式示意：本人所屬隊伍名稱
    L.step = "waiting";
    render();
  });
  wrap.appendChild(f); card(wrap);
}

/* 等候：已加入但活動未啟動或沒有開放題目 */
function stepWaiting() {
  const wrap = document.createElement("div");
  wrap.innerHTML = `${topBar()}<div class="learner-body">
    <div class="stem">等候中…</div>
    <p class="muted" style="text-align:center">已加入活動；老師尚未開放題目。<br>活動已開始不等於題目開放，請留意大螢幕。</p>
    <div class="pending">TEAM 模式：你的所屬隊伍為 <b>${esc(L.team)}</b>（僅顯示本人隊伍名稱）。</div>
  </div>`;
  const b = document.createElement("button"); b.className = "primary big"; b.textContent = "（示意）老師已開放題目 →";
  b.addEventListener("click", () => { L.step = "question"; L.qi = 0; render(); });
  wrap.querySelector(".learner-body").appendChild(b);
  card(wrap);
}

/* 作答：依題型；開放期間可更新，採最後一筆成功提交 */
function stepQuestion() {
  const q = ACT.set.questions[L.qi];
  const wrap = document.createElement("div");
  const canAnswer = true; // 示意：目前題目開放作答
  let body = `<div class="stem">${esc(q.stem)}</div>`;
  if (q.type === "開放式文字") {
    body += `<textarea id="lp-text" placeholder="自由輸入文字回饋（不設自動判分）"></textarea>`;
  } else {
    body += `<div>${q.options.map((o, i) =>
      `<div class="answer ${L.pick.includes(i) ? (q.type === "投票" ? "picked" : "sel") : ""}" data-i="${i}">${esc(o)}</div>`).join("")}</div>`;
    if (q.type === "多選") body += `<p class="muted">可選多項（全對才算答對）。</p>`;
  }
  const d = document.createElement("div");
  d.innerHTML = `${topBar()}<div class="learner-body">${body}
    ${L.submitted ? '<p class="muted" style="text-align:center">已提交；開放期間可修改，以最後一筆成功提交為準。</p>' : ""}
    </div>`;
  d.querySelectorAll(".answer").forEach(n => n.addEventListener("click", () => {
    if (!canAnswer) return;
    const i = +n.dataset.i;
    if (q.type === "單選" || q.type === "投票") L.pick = [i];
    else L.pick.includes(i) ? L.pick = L.pick.filter(x => x !== i) : L.pick.push(i);
    stepQuestion();
  }));
  const bar = document.createElement("div"); bar.className = "sendbar";
  const send = document.createElement("button"); send.className = "primary big"; send.style.width = "100%";
  send.textContent = L.submitted ? "更新提交" : "提交答案";
  send.addEventListener("click", () => {
    if (L.pick.length === 0 && q.type !== "開放式文字") return;
    L.submitted = true;
    q.type === "開放式文字" ? (L.step = "feedback") : (L.step = "feedback");
    render();
  });
  bar.appendChild(send); d.appendChild(bar);
  card(d);
}

/* 已提交後：依老師公布狀態顯示；公布統計僅答案分布 */
function stepFeedback() {
  const q = ACT.set.questions[L.qi];
  const wrap = document.createElement("div");
  let body = `<div class="stem">已提交！</div><p class="muted" style="text-align:center">等待老師公布結果…</p>`;
  if (L.publishedStats && q.options) {
    const total = 26;
    body += `<div class="dist" style="margin-top:14px">${q.options.map((o, i) => {
      const pct = [38, 27, 23, 12][i] ?? 10;
      return `<div class="bar"><span>${["Ａ","Ｂ","Ｃ","Ｄ"][i]}</span><span class="track"><span class="fill published" style="width:${pct}%"></span></span><span>${pct}%</span></div>`;
    }).join("")}</div>`;
  }
  if (L.publishedAnswer && q.correct) {
    body += `<p class="reveal-anim" style="text-align:center;color:#8a6d1c;font-family:var(--serif)">正確答案：${esc(q.correct.map(i=>q.options[i]).join("、"))}</p>`;
  }
  if (L.publishedBoard && ACT.leaderboard) {
    body += `<p class="muted">團隊排行榜已公布：</p><table class="l"><tbody>
      ${ACT.leaderboard.map(([n,s,r]) => `<tr><td>${r}</td><td>${esc(n)}</td><td>${s}</td></tr>`).join("")}</tbody></table>
      <p class="muted">僅顯示隊名、總分與名次（密集排名；同分並列）。</p>`;
  }
  const d = document.createElement("div");
  d.innerHTML = `${topBar()}<div class="learner-body">${body}</div>`;
  const b = document.createElement("button"); b.className = "primary big"; b.style.width = "100%";
  b.textContent = "下一題";
  b.addEventListener("click", () => {
    if (L.qi >= ACT.set.questions.length - 1) { L.step = "done"; }
    else { L.qi++; L.pick = []; L.submitted = false; L.publishedStats = L.publishedAnswer = L.publishedBoard = false; L.step = "question"; }
    render();
  });
  const demo = document.createElement("div"); demo.style.cssText = "display:grid;gap:6px;margin-bottom:10px";
  const mk = (label, fn) => { const x = document.createElement("button"); x.textContent = "（示意）" + label; x.addEventListener("click", fn); return x; };
  demo.appendChild(mk("老師公布統計", () => { L.publishedStats = true; render(); }));
  demo.appendChild(mk("老師公布正確答案", () => { L.publishedAnswer = true; render(); }));
  demo.appendChild(mk("老師公布排行榜", () => {
    ACT.leaderboard = [["Team-1", "166.67", 1], ["Team-2", "133.33", 2], ["Team-3", "133.33", 2]];
    L.publishedBoard = true; render();
  }));
  d.prepend(demo);
  d.appendChild(b);
  card(d);
}

/* 活動結束：唯讀查看已公布且本人有權的結果 */
function stepDone() {
  const wrap = document.createElement("div");
  wrap.innerHTML = `${topBar()}<div class="learner-body">
    <div class="stem">活動已結束</div>
    <p class="muted" style="text-align:center">感謝參與。僅可唯讀查看老師已公布且你有權檢視的結果；加入與作答已停止。</p>
    ${L.team ? `<p class="muted" style="text-align:center">你的所屬隊伍：${esc(L.team)}</p>` : ""}
    <p class="muted" style="text-align:center"><a href="index.html">返回平台登入頁</a>（學員無需正式帳號）</p>
  </div>`;
  card(wrap);
}

render();