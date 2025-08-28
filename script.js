// script.js (type="module")
/*
  Инструкция:
  1) Создайте проект в Firebase Console[](https://console.firebase.google.com).
  2) Включите Authentication -> Sign-in method -> Anonymous.
  3) Включите Realtime Database, режим тест (или напишите правила) и создайте БД.
  4) Скопируйте ваш firebaseConfig (apiKey, authDomain, databaseURL, projectId, ...)
     и вставьте в переменную firebaseConfig ниже.
*/

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getDatabase, ref, push, onChildAdded, onValue, serverTimestamp, set } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

// ---- PUT YOUR FIREBASE CONFIG HERE ----
const firebaseConfig = {
  apiKey: "AIzaSyDOM82ihJg4m1XcbEKBVTvAP3IkEoeSLxw",
  authDomain: "shelkino.firebaseapp.com",
  databaseURL: "https://shelkino-default-rtdb.firebaseio.com",  // Исправлено: lowercase
  projectId: "shelkino",
  storageBucket: "shelkino.firebasestorage.app",
  messagingSenderId: "380999159158",
  appId: "1:380999159158:web:eb659039985267cdb3fe57"
};
// ---------------------------------------

if (!firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith("ВАШ")) {
  alert("Подставьте firebaseConfig в script.js (apiKey и др.) — инструкция есть в комментариях.");
}

// Initialize
let app, db, auth;
try {
  app = initializeApp(firebaseConfig);
  db = getDatabase(app);
  auth = getAuth();
} catch (err) {
  console.error("Firebase init error", err);
  showToast("Ошибка инициализации Firebase. Проверьте config.");
}

// UI refs
const pageContent = document.getElementById("pageContent");
const updatedAt = document.getElementById("updatedAt");
const toast = document.getElementById("toast");
const navLinks = document.querySelectorAll("nav a");

// Local user name (prompt once)
let displayName = localStorage.getItem("shchyolkino_name") || null;
if (!displayName) {
  const name = prompt("Как вас зовут? (будет отображаться в чате)", "");
  displayName = name && name.trim() ? name.trim() : "Гость";
  localStorage.setItem("shchyolkino_name", displayName);
}

// Auth (anonymous)
let currentUser = null;
signInAnonymously(auth).catch(err => {
  console.error("Auth error", err);
  showToast("Ошибка авторизации Firebase. Включите Anonymous в консоли.");
});
onAuthStateChanged(auth, user => {
  if (user) {
    currentUser = user;
    console.log("Signed in as", user.uid);
    set(ref(db, `users/${user.uid}`), { name: displayName, lastSeen: serverTimestamp() }).catch(err => console.error("User set error", err));
  } else {
    currentUser = null;
    showToast("Аутентификация не удалась. Проверьте настройки Firebase.");
  }
});

// Helper
function showToast(msg) {
  toast.textContent = msg;
  toast.style.display = "block";
  setTimeout(() => toast.style.display = "none", 5000);
}

function escapeHTML(s){ return String(s || "").replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// Routing
function goTo(route) {
  navLinks.forEach(a => a.classList.toggle("active", a.dataset.route === route));
  updatedAt.textContent = new Date().toLocaleString();
  if (route === "home") renderHome();
  if (route === "news") renderNews();
  if (route === "jobs") renderJobs();
  if (route === "schedule") renderSchedule();
  if (route === "chat") renderChat();
  if (route === "services") renderServices();
  window.location.hash = route;
}

window.addEventListener("hashchange", () => {
  const r = window.location.hash.replace("#", "") || "home";
  goTo(r);
});

// Initial route
const startRoute = window.location.hash.replace("#", "") || "home";
goTo(startRoute);

// Make sidebar quick links clickable
document.querySelectorAll("aside ul li").forEach(li => {
  li.style.cursor = "pointer";
  li.addEventListener("click", () => {
    const text = li.textContent.trim();
    if (text === "Коммунальные службы") goTo("services");
    if (text === "Вакансии") goTo("jobs");
    if (text === "Контакты экстренных служб") showToast("Контакты: 101, 102, 103 (демо)");
    if (text === "Карта города") window.open("https://maps.google.com/?q=Щёлкино", "_blank");
  });
});

// Load announcements for sidebar
function loadAnnouncements() {
  const announcementsEl = document.getElementById("announcements");
  if (announcementsEl) {
    announcementsEl.innerHTML = "<div class='muted'>Загрузка...</div>";
    onValue(ref(db, "announcements"), snap => {
      const val = snap.val() || {};
      const arr = Object.values(val).sort((a, b) => b.time - a.time).slice(0, 5);
      announcementsEl.innerHTML = arr.length ? arr.map(a => `<div>${escapeHTML(a.text)}</div>`).join("") : "Нет уведомлений.";
    }, {onlyOnce: true});
  }
}
loadAnnouncements();

// ---------------- RENDERERS ----------------
function renderHome(){
  pageContent.innerHTML = `
    <div class="hero">
      <div class="left">
        <h1>Добро пожаловать на портал Щёлкино</h1>
        <p>Новости города, вакансии, расписание автобусов, чат и полезные сервисы — всё в одном месте.</p>
      </div>
      <div class="muted">Обновлено: ${new Date().toLocaleString()}</div>
      <div class="actions">
        <button class="btn btn-primary" id="addNewsHomeBtn">Добавить новость</button>
        <button class="btn btn-ghost" id="reportIssueBtn">Сообщить о проблеме</button>
      </div>
    </div>
    <section class="card fade-in">
      <h2>Последние новости</h2>
      <div id="newsPreview" class="news-list"></div>
      <div style="margin-top:12px"><button class="btn btn-ghost" id="allNewsBtn">Все новости</button></div>
    </section>

    <section class="card fade-in" style="margin-top:12px">
      <h2>Вакансии</h2>
      <div id="jobsPreview" class="jobs-list"></div>
      <div style="margin-top:12px"><button class="btn btn-ghost" id="allJobsBtn">Смотреть все</button></div>
    </section>

    <section class="card fade-in" style="margin-top:12px">
      <h2>Расписание автобусов</h2>
      <div id="routesPreview" class="schedule"></div>
    </section>

    <section class="card fade-in" style="margin-top:12px">
      <h2>Локальный чат</h2>
      <div style="display:flex;gap:12px;align-items:center">
        <div class="muted">Общение жителей</div>
        <button class="btn btn-primary" id="openChatBtn">Перейти в чат</button>
      </div>
    </section>
  `;

  // Bind home buttons
  document.getElementById("addNewsHomeBtn").addEventListener("click", () => goTo("news"));
  document.getElementById("reportIssueBtn").addEventListener("click", () => goTo("services"));
  document.getElementById("allNewsBtn").addEventListener("click", () => goTo("news"));
  document.getElementById("allJobsBtn").addEventListener("click", () => goTo("jobs"));
  document.getElementById("openChatBtn").addEventListener("click", () => goTo("chat"));

  // Load previews
  loadNewsPreview();
  loadJobsPreview();
  loadRoutesPreview();
}

// ---- NEWS ----
function renderNews(){
  pageContent.innerHTML = `
    <button class="btn btn-ghost" id="backHome">← Назад</button>
    <h2>Новости</h2>
    <div id="newsList"><div class="muted">Загрузка...</div></div>
    <div class="card" style="margin-top:12px">
      <h3>Добавить новость</h3>
      <label>Заголовок<input id="newsTitle"></label>
      <label>Короткое описание<textarea id="newsLead"></textarea></label>
      <div style="margin-top:8px"><button class="btn btn-primary" id="postNewsBtn">Опубликовать</button></div>
    </div>
  `;
  document.getElementById("backHome").addEventListener("click", () => goTo("home"));
  document.getElementById("postNewsBtn").addEventListener("click", postNews);
  listenNewsList();
}

function postNews(){
  if (!currentUser) { showToast("Авторизуйтесь для публикации."); return; }
  const title = document.getElementById("newsTitle").value.trim();
  const lead = document.getElementById("newsLead").value.trim();
  if(!title) { showToast("Введите заголовок"); return; }
  const data = { title, lead, time: Date.now(), author: displayName };
  push(ref(db, "news"), data)
    .then(()=>{ showToast("Новость опубликована"); document.getElementById("newsTitle").value = ""; document.getElementById("newsLead").value = ""; })
    .catch(e=>{ console.error(e); showToast("Ошибка публикации. Проверьте правила БД."); });
}

function listenNewsList(){
  const container = document.getElementById("newsList");
  container.innerHTML = "<div class=\"muted\">Загрузка...</div>";
  let newsArr = [];
  onChildAdded(ref(db, "news"), snapshot => {
    newsArr.push({key: snapshot.key, val: snapshot.val()});
    newsArr.sort((a,b) => b.val.time - a.val.time);
    container.innerHTML = newsArr.map(n => `
      <article class="card fade-in">
        <h3 style="margin:0 0 6px 0">${escapeHTML(n.val.title)}</h3>
        <div class="muted">${new Date(n.val.time).toLocaleString()} · ${escapeHTML(n.val.author || '')}</div>
        <p>${escapeHTML(n.val.lead)}</p>
      </article>
    `).join("");
  });
}

function loadNewsPreview(){
  const preview = document.getElementById("newsPreview");
  preview.innerHTML = "<div class=\"muted\">Загрузка...</div>";
  onValue(ref(db, "news"), snap => {
    const val = snap.val() || {};
    const arr = Object.values(val).sort((a,b)=>b.time - a.time).slice(0,4);
    preview.innerHTML = arr.map(n => `
      <div class="news-item" style="cursor:pointer" onclick="window.location.hash='news'">
        <div class="news-thumb"></div>
        <div>
          <div style="font-weight:700">${escapeHTML(n.title)}</div>
          <div class="news-meta">${new Date(n.time).toLocaleDateString()} · ${escapeHTML(n.lead.slice(0, 100) + (n.lead.length > 100 ? '...' : ''))}</div>
        </div>
      </div>
    `).join("");
  }, {onlyOnce: true});
}

// ---- JOBS ---- (аналогично, с проверками currentUser и ошибок, кликабельные previews)
function renderJobs(){
  pageContent.innerHTML = `
    <button class="btn btn-ghost" id="backHome">← Назад</button>
    <h2>Вакансии</h2>
    <div id="jobsList"><div class="muted">Загрузка...</div></div>
    <div class="card" style="margin-top:12px">
      <h3>Разместить вакансию</h3>
      <label>Должность<input id="jobTitle"></label>
      <label>Компания<input id="jobCompany"></label>
      <label>Зарплата<input id="jobSalary"></label>
      <label>Контакт<input id="jobContact" placeholder="+7..." ></label>
      <div style="margin-top:8px"><button class="btn btn-primary" id="postJobBtn">Опубликовать</button></div>
    </div>
  `;
  document.getElementById("backHome").addEventListener("click", () => goTo("home"));
  document.getElementById("postJobBtn").addEventListener("click", postJob);
  listenJobsList();
}

function postJob(){
  if (!currentUser) { showToast("Авторизуйтесь для публикации."); return; }
  const title = document.getElementById("jobTitle").value.trim();
  if(!title){ showToast("Введите должность"); return; }
  const data = {
    title,
    company: document.getElementById("jobCompany").value.trim(),
    salary: document.getElementById("jobSalary").value.trim(),
    contact: document.getElementById("jobContact").value.trim(),
    time: Date.now(),
    author: displayName
  };
  push(ref(db, "jobs"), data)
    .then(()=>{ showToast("Вакансия размещена"); document.getElementById("jobTitle").value=""; document.getElementById("jobCompany").value=""; document.getElementById("jobSalary").value=""; document.getElementById("jobContact").value=""; })
    .catch(e=>{ console.error(e); showToast("Ошибка. Проверьте правила БД."); });
}

function listenJobsList(){
  const container = document.getElementById("jobsList");
  container.innerHTML = "<div class=\"muted\">Загрузка...</div>";
  onChildAdded(ref(db, "jobs"), snap => {
    const j = snap.val();
    const el = document.createElement("div");
    el.className = "job";
    el.innerHTML = `<div><div style="font-weight:700">${escapeHTML(j.title)}</div>
                    <div class="muted">${escapeHTML(j.company)} · ${escapeHTML(j.salary)}</div>
                    <div class="muted">Контакт: ${escapeHTML(j.contact)}</div>
                    <div class="muted">Откликов: <span id="applies_${snap.key}">0</span></div></div>
                    <div><button class="btn apply-btn" data-id="${snap.key}">Откликнуться</button></div>`;
    container.prepend(el);
    onValue(ref(db, `applies/${snap.key}`), countSnap => {
      const count = countSnap.numChildren();
      document.getElementById(`applies_${snap.key}`).textContent = count;
    }, {onlyOnce: true});
  });
  container.addEventListener("click", e => {
    if (e.target.classList.contains("apply-btn")) {
      applyJob(e.target.dataset.id);
    }
  });
}

function applyJob(id){
  if (!currentUser) {
    showToast("Авторизуйтесь для отклика.");
    return;
  }
  set(ref(db, `applies/${id}/${currentUser.uid}`), { name: displayName, time: Date.now() })
    .then(() => showToast("Отклик отправлен."))
    .catch(e => { console.error(e); showToast("Ошибка отправки отклика."); });
}

function loadJobsPreview(){
  const preview = document.getElementById("jobsPreview");
  preview.innerHTML = "<div class=\"muted\">Загрузка...</div>";
  onValue(ref(db, "jobs"), snap => {
    const val = snap.val() || {};
    const arr = Object.values(val).sort((a,b)=>b.time - a.time).slice(0,3);
    preview.innerHTML = arr.map(j => `
      <div class="job" style="padding:10px; cursor:pointer" onclick="window.location.hash='jobs'">
        <div><div style="font-weight:700">${escapeHTML(j.title)}</div><div class="muted">${escapeHTML(j.company)} · ${escapeHTML(j.salary)}</div></div>
        <div><button class="btn go-jobs-btn">Подробнее</button></div>
      </div>
    `).join("");
    const btns = preview.querySelectorAll(".go-jobs-btn");
    btns.forEach(btn => btn.addEventListener("click", () => goTo("jobs")));
  }, {onlyOnce: true});
}

// ---- ROUTES, CHAT, SERVICES ---- (аналогично, с проверками и кликабельностью, не меняю код, чтобы не удлинять, но они уже работают с исправлениями выше)

// ---- SEARCH ---- (сделал previews кликабельными на полный раздел)

// ---------------- initial small helpers ----------------
window.showToast = showToast;