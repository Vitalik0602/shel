// script.js (type="module")
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getDatabase, ref, push, onChildAdded, onValue, serverTimestamp, set } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
import { getAuth, signInAnonymously, onAuthStateChanged, RecaptchaVerifier, signInWithPhoneNumber } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyDOM82ihJg4m1XcbEKBVTvAP3IkEoeSLxw",
  authDomain: "shelkino.firebaseapp.com",
  databaseURL: "https://shelkino-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "shelkino",
  storageBucket: "shelkino.appspot.com",
  messagingSenderId: "380999159158",
  appId: "1:380999159158:web:eb659039985267cdb3fe57",
  measurementId: "G-GLHN9C443L"
};

// Admin Phone Number (replace with actual admin phone number)
const ADMIN_PHONE = "+79123456789"; // Example: use format +7xxxxxxxxxx

if (!firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith("YOUR")) {
  alert("Подставьте ваш firebaseConfig в script.js (apiKey и др.) — инструкция в комментариях.");
}

// Initialize Firebase
let app, db, auth;
try {
  app = initializeApp(firebaseConfig);
  db = getDatabase(app);
  auth = getAuth();
} catch (err) {
  console.error("Firebase init error", err);
  showToast("Ошибка инициализации Firebase. Проверьте config.");
}

// UI References
const pageContent = document.getElementById("pageContent");
const updatedAt = document.getElementById("updatedAt");
const toast = document.getElementById("toast");
const navLinks = document.querySelectorAll("nav a");
const brand = document.querySelector(".brand");

// Local user name
let displayName = localStorage.getItem("shchyolkino_name") || null;
if (!displayName) {
  const name = prompt("Как вас зовут? (будет отображаться в чате)", "");
  displayName = name && name.trim() ? name.trim() : "Гость";
  localStorage.setItem("shchyolkino_name", displayName);
}

// Authentication
let currentUser = null;
let isAdmin = false;
const recaptchaVerifier = new RecaptchaVerifier('recaptcha-container', { size: 'invisible' }, auth);

signInAnonymously(auth).catch(err => {
  console.error("Auth error", err);
  showToast("Ошибка авторизации Firebase. Включите Anonymous Authentication в консоли.");
});

onAuthStateChanged(auth, user => {
  if (user) {
    currentUser = user;
    isAdmin = !!user.phoneNumber && user.phoneNumber === ADMIN_PHONE;
    console.log("Signed in as", user.uid, "isAdmin:", isAdmin);
    set(ref(db, `users/${user.uid}`), { name: displayName, lastSeen: serverTimestamp() })
      .catch(err => console.error("User set error", err));
    document.getElementById("adminLoginBtn").textContent = isAdmin ? "Выйти (Админ)" : "Админ";
  } else {
    currentUser = null;
    isAdmin = false;
    document.getElementById("adminLoginBtn").textContent = "Админ";
  }
});

// Admin Login
function adminLogin() {
  if (isAdmin) {
    auth.signOut().then(() => {
      signInAnonymously(auth);
      showToast("Вышли из админа.");
    });
    return;
  }

  if (currentUser && currentUser.isAnonymous) {
    auth.signOut();
  }

  const phone = prompt("Введите номер телефона для админа (например, +79123456789)");
  if (!phone) {
    if (!currentUser) signInAnonymously(auth);
    return;
  }

  signInWithPhoneNumber(auth, phone, recaptchaVerifier)
    .then(confirmationResult => {
      const code = prompt("Введите код из SMS");
      if (!code) {
        if (!currentUser) signInAnonymously(auth);
        return;
      }
      return confirmationResult.confirm(code);
    })
    .then(result => {
      const user = result.user;
      if (user.phoneNumber !== ADMIN_PHONE) {
        showToast("Этот номер не является администраторским.");
        auth.signOut();
        signInAnonymously(auth);
      } else {
        showToast("Вошли как админ.");
        isAdmin = true;
      }
    })
    .catch(err => {
      showToast("Ошибка: " + err.message);
      if (!currentUser) signInAnonymously(auth);
    });
}

// Add admin login listener
document.getElementById("adminLoginBtn").addEventListener("click", adminLogin);

// Make header clickable
brand.addEventListener("click", () => goTo("home"));

// Helpers
function showToast(msg) {
  if (toast) {
    toast.textContent = msg;
    toast.style.display = "block";
    setTimeout(() => toast.style.display = "none", 5000);
  }
}

function escapeHTML(s) {
  return String(s || "").replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Routing
function goTo(route) {
  navLinks.forEach(a => a.classList.toggle("active", a.dataset.route === route));
  if (updatedAt) updatedAt.textContent = new Date().toLocaleString();
  if (route === "home") renderHome();
  else if (route === "news") renderNews();
  else if (route === "jobs") renderJobs();
  else if (route === "schedule") renderSchedule();
  else if (route === "chat") renderChat();
  else renderHome();
  window.location.hash = route;
}

window.addEventListener("hashchange", () => {
  const r = window.location.hash.replace("#", "") || "home";
  goTo(r);
});

// Initial route
const startRoute = window.location.hash.replace("#", "") || "home";
goTo(startRoute);

// Sidebar quick links
document.querySelectorAll("aside ul li").forEach(li => {
  li.style.cursor = "pointer";
  li.addEventListener("click", () => {
    const text = li.textContent.trim();
    if (text === "Вакансии") goTo("jobs");
    if (text === "Карта города") window.open("https://maps.google.com/?q=Щёлкино", "_blank");
  });
});

// Load announcements
function loadAnnouncements() {
  const announcementsEl = document.getElementById("announcements");
  if (announcementsEl) {
    announcementsEl.innerHTML = "<div class='muted'>Загрузка...</div>";
    onValue(ref(db, "announcements"), snap => {
      const val = snap.val() || {};
      const arr = Object.values(val).sort((a, b) => b.time - a.time).slice(0, 5);
      announcementsEl.innerHTML = arr.length ? arr.map(a => `<div>${escapeHTML(a.text)}</div>`).join("") : "Нет уведомлений.";
    }, { onlyOnce: true });
  }
}
loadAnnouncements();

// Renderers
function renderHome() {
  pageContent.innerHTML = `
    <div class="hero">
      <div class="left">
        <h1>Добро пожаловать на портал Щёлкино</h1>
        <p>Новости города, вакансии, расписание автобусов и чат жителей.</p>
      </div>
      <div class="muted">Обновлено: ${new Date().toLocaleString()}</div>
      <div class="actions">
        ${isAdmin ? '<button class="btn btn-primary" id="addNewsHomeBtn">Добавить новость</button>' : ''}
      </div>
    </div>
    <section class="card fade-in">
      <h2>Последние новости</h2>
      <div id="newsPreview" class="news-list"><div class="muted">Загрузка...</div></div>
      <div style="margin-top:12px"><button class="btn btn-ghost" id="allNewsBtn">Все новости</button></div>
    </section>
    <section class="card fade-in" style="margin-top:12px">
      <h2>Вакансии</h2>
      <div id="jobsPreview" class="jobs-list"><div class="muted">Загрузка...</div></div>
      <div style="margin-top:12px"><button class="btn btn-ghost" id="allJobsBtn">Смотреть все</button></div>
    </section>
    <section class="card fade-in" style="margin-top:12px">
      <h2>Расписание автобусов</h2>
      <div id="routesPreview" class="schedule"><div class="muted">Загрузка...</div></div>
    </section>
    <section class="card fade-in" style="margin-top:12px">
      <h2>Локальный чат</h2>
      <div style="display:flex;gap:12px;align-items:center">
        <div class="muted">Общение жителей</div>
        <button class="btn btn-primary" id="openChatBtn">Перейти в чат</button>
      </div>
    </section>
  `;
  if (isAdmin) document.getElementById("addNewsHomeBtn")?.addEventListener("click", () => goTo("news"));
  document.getElementById("allNewsBtn").addEventListener("click", () => goTo("news"));
  document.getElementById("allJobsBtn").addEventListener("click", () => goTo("jobs"));
  document.getElementById("openChatBtn").addEventListener("click", () => goTo("chat"));
  loadNewsPreview();
  loadJobsPreview();
  loadRoutesPreview();
}

function renderNews() {
  pageContent.innerHTML = `
    <button class="btn btn-ghost" id="backHome">← Назад</button>
    <h2>Новости</h2>
    <div id="newsList"><div class="muted">Загрузка...</div></div>
    ${isAdmin ? `
    <div class="card" style="margin-top:12px">
      <h3>Добавить новость</h3>
      <label>Заголовок<input id="newsTitle"></label>
      <label>Короткое описание<textarea id="newsLead"></textarea></label>
      <div style="margin-top:8px"><button class="btn btn-primary" id="postNewsBtn">Опубликовать</button></div>
    </div>
    ` : ''}
  `;
  document.getElementById("backHome").addEventListener("click", () => goTo("home"));
  if (isAdmin) document.getElementById("postNewsBtn")?.addEventListener("click", postNews);
  listenNewsList();
}

function postNews() {
  if (!isAdmin) { showToast("Только администратор может добавлять."); return; }
  if (!currentUser) { showToast("Авторизуйтесь для публикации."); return; }
  const title = document.getElementById("newsTitle").value.trim();
  const lead = document.getElementById("newsLead").value.trim();
  if (!title) { showToast("Введите заголовок"); return; }
  const data = { title, lead, time: Date.now(), author: displayName };
  push(ref(db, "news"), data)
    .then(() => {
      showToast("Новость опубликована");
      document.getElementById("newsTitle").value = "";
      document.getElementById("newsLead").value = "";
    })
    .catch(e => {
      console.error(e);
      showToast("Ошибка публикации. Проверьте правила БД.");
    });
}

function listenNewsList() {
  const container = document.getElementById("newsList");
  container.innerHTML = "<div class=\"muted\">Загрузка...</div>";
  let newsArr = [];
  onChildAdded(ref(db, "news"), snapshot => {
    newsArr.push({ key: snapshot.key, val: snapshot.val() });
    newsArr.sort((a, b) => b.val.time - a.val.time);
    container.innerHTML = newsArr.map(n => `
      <article class="card fade-in">
        <h3 style="margin:0 0 6px 0">${escapeHTML(n.val.title)}</h3>
        <div class="muted">${new Date(n.val.time).toLocaleString()} · ${escapeHTML(n.val.author || '')}</div>
        <p>${escapeHTML(n.val.lead)}</p>
      </article>
    `).join("");
  });
}

function loadNewsPreview() {
  const preview = document.getElementById("newsPreview");
  preview.innerHTML = "<div class=\"muted\">Загрузка...</div>";
  onValue(ref(db, "news"), snap => {
    const val = snap.val() || {};
    const arr = Object.values(val).sort((a, b) => b.time - a.time).slice(0, 4);
    preview.innerHTML = arr.map(n => `
      <div class="news-item" style="cursor:pointer" onclick="window.location.hash='news'">
        <div class="news-thumb"></div>
        <div>
          <div style="font-weight:700">${escapeHTML(n.title)}</div>
          <div class="news-meta">${new Date(n.time).toLocaleDateString()} · ${escapeHTML(n.lead.slice(0, 100) + (n.lead.length > 100 ? '...' : ''))}</div>
        </div>
      </div>
    `).join("");
  }, { onlyOnce: true });
}

function renderJobs() {
  pageContent.innerHTML = `
    <button class="btn btn-ghost" id="backHome">← Назад</button>
    <h2>Вакансии</h2>
    <div id="jobsList"><div class="muted">Загрузка...</div></div>
    ${isAdmin ? `
    <div class="card" style="margin-top:12px">
      <h3>Разместить вакансию</h3>
      <label>Должность<input id="jobTitle"></label>
      <label>Компания<input id="jobCompany"></label>
      <label>Зарплата<input id="jobSalary"></label>
      <label>Контакт<input id="jobContact" placeholder="+7..."></label>
      <div style="margin-top:8px"><button class="btn btn-primary" id="postJobBtn">Опубликовать</button></div>
    </div>
    ` : ''}
  `;
  document.getElementById("backHome").addEventListener("click", () => goTo("home"));
  if (isAdmin) document.getElementById("postJobBtn")?.addEventListener("click", postJob);
  listenJobsList();
}

function postJob() {
  if (!isAdmin) { showToast("Только администратор может добавлять."); return; }
  if (!currentUser) { showToast("Авторизуйтесь для публикации."); return; }
  const title = document.getElementById("jobTitle").value.trim();
  if (!title) { showToast("Введите должность"); return; }
  const data = {
    title,
    company: document.getElementById("jobCompany").value.trim(),
    salary: document.getElementById("jobSalary").value.trim(),
    contact: document.getElementById("jobContact").value.trim(),
    time: Date.now(),
    author: displayName
  };
  push(ref(db, "jobs"), data)
    .then(() => {
      showToast("Вакансия размещена");
      document.getElementById("jobTitle").value = "";
      document.getElementById("jobCompany").value = "";
      document.getElementById("jobSalary").value = "";
      document.getElementById("jobContact").value = "";
    })
    .catch(e => {
      console.error(e);
      showToast("Ошибка. Проверьте правила БД.");
    });
}

function listenJobsList() {
  const container = document.getElementById("jobsList");
  container.innerHTML = "<div class=\"muted\">Загрузка...</div>";
  onChildAdded(ref(db, "jobs"), snap => {
    const j = snap.val();
    const el = document.createElement("div");
    el.className = "job";
    el.innerHTML = `
      <div>
        <div style="font-weight:700">${escapeHTML(j.title)}</div>
        <div class="muted">${escapeHTML(j.company)} · ${escapeHTML(j.salary)}</div>
        <div class="muted">Контакт: ${escapeHTML(j.contact)}</div>
        <div class="muted">Откликов: <span id="applies_${snap.key}">0</span></div>
      </div>
      <div><button class="btn apply-btn" data-id="${snap.key}">Откликнуться</button></div>
    `;
    container.prepend(el);
    onValue(ref(db, `applies/${snap.key}`), countSnap => {
      const count = countSnap.numChildren();
      document.getElementById(`applies_${snap.key}`).textContent = count;
    }, { onlyOnce: true });
  });
  container.addEventListener("click", e => {
    if (e.target.classList.contains("apply-btn")) {
      applyJob(e.target.dataset.id);
    }
  });
}

function applyJob(id) {
  if (!currentUser) {
    showToast("Авторизуйтесь для отклика.");
    return;
  }
  set(ref(db, `applies/${id}/${currentUser.uid}`), { name: displayName, time: Date.now() })
    .then(() => showToast("Отклик отправлен."))
    .catch(e => {
      console.error(e);
      showToast("Ошибка отправки отклика.");
    });
}

function loadJobsPreview() {
  const preview = document.getElementById("jobsPreview");
  preview.innerHTML = "<div class=\"muted\">Загрузка...</div>";
  onValue(ref(db, "jobs"), snap => {
    const val = snap.val() || {};
    const arr = Object.values(val).sort((a, b) => b.time - a.time).slice(0, 3);
    preview.innerHTML = arr.map(j => `
      <div class="job" style="padding:10px; cursor:pointer" onclick="window.location.hash='jobs'">
        <div>
          <div style="font-weight:700">${escapeHTML(j.title)}</div>
          <div class="muted">${escapeHTML(j.company)} · ${escapeHTML(j.salary)}</div>
        </div>
        <div><button class="btn go-jobs-btn">Подробнее</button></div>
      </div>
    `).join("");
    const btns = preview.querySelectorAll(".go-jobs-btn");
    btns.forEach(btn => btn.addEventListener("click", () => goTo("jobs")));
  }, { onlyOnce: true });
}

function renderSchedule() {
  pageContent.innerHTML = `
    <button class="btn btn-ghost" id="backHome">← Назад</button>
    <h2>Расписание</h2>
    <div id="routesList"><div class="muted">Загрузка...</div></div>
    ${isAdmin ? `
    <div class="card" style="margin-top:12px">
      <h3>Добавить маршрут</h3>
      <label>Маршрут<input id="routeName"></label>
      <label>Время (через запятую)<input id="routeTimes" placeholder="06:30, 09:00"></label>
      <div style="margin-top:8px"><button class="btn btn-primary" id="postRouteBtn">Добавить</button></div>
    </div>
    ` : ''}
  `;
  document.getElementById("backHome").addEventListener("click", () => goTo("home"));
  if (isAdmin) document.getElementById("postRouteBtn")?.addEventListener("click", postRoute);
  listenRoutes();
}

function postRoute() {
  if (!isAdmin) { showToast("Только администратор может добавлять."); return; }
  if (!currentUser) { showToast("Авторизуйтесь для добавления."); return; }
  const route = document.getElementById("routeName").value.trim();
  const times = document.getElementById("routeTimes").value.split(",").map(t => t.trim()).filter(Boolean);
  if (!route || times.length === 0) { showToast("Укажите маршрут и время"); return; }
  push(ref(db, "routes"), { route, times, time: Date.now(), author: displayName })
    .then(() => {
      showToast("Маршрут добавлен");
      document.getElementById("routeName").value = "";
      document.getElementById("routeTimes").value = "";
    })
    .catch(e => {
      console.error(e);
      showToast("Ошибка. Проверьте правила БД.");
    });
}

function listenRoutes() {
  const container = document.getElementById("routesList");
  container.innerHTML = "<div class=\"muted\">Загрузка...</div>";
  onChildAdded(ref(db, "routes"), snap => {
    const r = snap.val();
    const el = document.createElement("div");
    el.className = "card";
    el.style.marginBottom = "8px";
    el.innerHTML = `<div style="font-weight:800">${escapeHTML(r.route)}</div><div class="muted">${r.times.join(' · ')}</div>`;
    container.prepend(el);
  });
}

function loadRoutesPreview() {
  const preview = document.getElementById("routesPreview");
  preview.innerHTML = "<div class=\"muted\">Загрузка...</div>";
  onValue(ref(db, "routes"), snap => {
    const val = snap.val() || {};
    const arr = Object.values(val).sort((a, b) => b.time - a.time).slice(0, 4);
    preview.innerHTML = arr.map(r => `
      <div class="route" style="cursor:pointer" onclick="window.location.hash='schedule'">
        <div style="font-weight:700">${escapeHTML(r.route)}</div>
        <div class="muted">${r.times.join(' · ')}</div>
      </div>
    `).join("");
  }, { onlyOnce: true });
}

function renderChat() {
  pageContent.innerHTML = `
    <button class="btn btn-ghost" id="backHome">← Назад</button>
    <h2>Чат жителей</h2>
    <div style="margin-bottom:12px"><button class="btn btn-ghost" id="changeNameBtn">Изменить имя</button></div>
    <div class="card chat-window">
      <div class="messages" id="messagesBox"><div class="muted">Загрузка...</div></div>
      <div class="chat-input">
        <input id="chatInput" placeholder="Напишите сообщение и нажмите Enter">
        <button class="btn btn-primary" id="sendMsgBtn">Отправить</button>
      </div>
    </div>
  `;
  document.getElementById("backHome").addEventListener("click", () => goTo("home"));
  document.getElementById("sendMsgBtn").addEventListener("click", sendMessage);
  document.getElementById("chatInput").addEventListener("keydown", e => {
    if (e.key === "Enter") sendMessage();
  });
  document.getElementById("changeNameBtn").addEventListener("click", () => {
    const newName = prompt("Введите новое имя:", displayName);
    if (newName && newName.trim()) {
      displayName = newName.trim();
      localStorage.setItem("shchyolkino_name", displayName);
      if (currentUser) set(ref(db, `users/${currentUser.uid}/name`), displayName);
      showToast("Имя изменено.");
    }
  });
  listenChat();
}

function sendMessage() {
  if (!currentUser) { showToast("Авторизуйтесь для отправки сообщений."); return; }
  const input = document.getElementById("chatInput");
  const text = input.value.trim();
  if (!text) return;
  const msg = { user: displayName, uid: currentUser ? currentUser.uid : null, text, time: Date.now() };
  push(ref(db, "chat"), msg)
    .then(() => { input.value = ""; })
    .catch(e => {
      console.error(e);
      showToast("Ошибка отправки сообщения.");
    });
}

function listenChat() {
  const box = document.getElementById("messagesBox");
  box.innerHTML = "<div class=\"muted\">Загрузка...</div>";
  onChildAdded(ref(db, "chat"), snap => {
    const m = snap.val();
    const el = document.createElement("div");
    el.className = "msg " + ((m.uid && currentUser && m.uid === currentUser.uid) ? "me" : "");
    el.innerHTML = `
      <strong>${escapeHTML(m.user)}</strong>
      <div>${escapeHTML(m.text)}</div>
      <div class="muted" style="font-size:11px;margin-top:6px">${new Date(m.time).toLocaleString()}</div>
    `;
    box.appendChild(el);
    box.scrollTop = box.scrollHeight;
  });
}

// Search
document.getElementById("globalSearch").addEventListener("keypress", e => {
  if (e.key === "Enter") {
    const q = e.target.value.trim().toLowerCase();
    if (!q) return;
    window.location.hash = "search";
    performSearch(q);
  }
});

function performSearch(q) {
  navLinks.forEach(a => a.classList.remove("active"));
  let out = `<button class="btn btn-ghost" id="backHomeSearch">← Назад</button><h2>Результаты поиска: ${escapeHTML(q)}</h2><div>`;
  pageContent.innerHTML = out + "<div class=\"muted\">Загрузка...</div></div>";
  document.getElementById("backHomeSearch").addEventListener("click", () => goTo("home"));
  onValue(ref(db, "news"), snap => {
    const news = snap.val() || {};
    const foundNews = Object.values(news).filter(n => (n.title + " " + n.lead).toLowerCase().includes(q));
    out += `<h3>Новости</h3>` + (foundNews.length ? foundNews.map(n => `
      <div class="card" style="cursor:pointer" onclick="window.location.hash='news'">${escapeHTML(n.title)}
      <div class="muted">${new Date(n.time).toLocaleDateString()}</div></div>`).join("") : `<div class="muted">Ничего не найдено</div>`);
    onValue(ref(db, "jobs"), snap2 => {
      const jobs = snap2.val() || {};
      const foundJobs = Object.values(jobs).filter(j => (j.title + " " + j.company).toLowerCase().includes(q));
      out += `<h3 style="margin-top:8px">Вакансии</h3>` + (foundJobs.length ? foundJobs.map(j => `
        <div class="card" style="cursor:pointer" onclick="window.location.hash='jobs'">${escapeHTML(j.title)}
        <div class="muted">${escapeHTML(j.company)}</div></div>`).join("") : `<div class="muted">Ничего не найдено</div>`);
      out += `</div>`;
      pageContent.innerHTML = out;
    }, { onlyOnce: true });
  }, { onlyOnce: true });
}

// Expose helper
window.showToast = showToast;
