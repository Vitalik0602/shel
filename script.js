// script.js (type="module")
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getDatabase, ref, push, onValue, serverTimestamp, set } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
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
const ADMIN_PHONE = "+79151199589"; // Example: use format +7xxxxxxxxxx

if (!firebaseConfig.apiKey || firebaseConfig.apiKey.includes("AIzaSy")) {
  alert("Пожалуйста, подставьте ваш собственный firebaseConfig в script.js, чтобы ваше приложение работало корректно и безопасно.");
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
  const name = prompt("Как вас зовут? (это имя будет видно в чате)", "");
  displayName = name && name.trim() ? name.trim() : "Гость";
  localStorage.setItem("shchyolkino_name", displayName);
}

// Authentication
let currentUser = null;
let isAdmin = false;
let recaptchaVerifier;

try {
    recaptchaVerifier = new RecaptchaVerifier('recaptcha-container', { size: 'invisible' }, auth);
} catch(e) {
    console.error("Recaptcha Verifier error", e);
}


signInAnonymously(auth).catch(err => {
  console.error("Auth error", err);
  showToast("Ошибка анонимной авторизации.");
});

onAuthStateChanged(auth, user => {
  if (user) {
    currentUser = user;
    isAdmin = !!user.phoneNumber && user.phoneNumber === ADMIN_PHONE;
    console.log("Signed in as", user.uid, "isAdmin:", isAdmin);
    set(ref(db, `users/${user.uid}`), { name: displayName, lastSeen: serverTimestamp(), isAnonymous: user.isAnonymous })
      .catch(err => console.error("User presence error", err));
    document.getElementById("adminLoginBtn").textContent = isAdmin ? "Выйти (Админ)" : "Админ";
  } else {
    currentUser = null;
    isAdmin = false;
    document.getElementById("adminLoginBtn").textContent = "Админ";
    signInAnonymously(auth); // Ensure user is always logged in
  }
});

// Admin Login
function adminLogin() {
  if (isAdmin) {
    auth.signOut().then(() => showToast("Вы вышли из режима администратора."));
    return;
  }

  const phone = prompt("Введите номер телефона администратора (формат: +79123456789)");
  if (!phone) return;

  signInWithPhoneNumber(auth, phone, recaptchaVerifier)
    .then(confirmationResult => {
      const code = prompt("Введите код из SMS");
      if (!code) return;
      return confirmationResult.confirm(code);
    })
    .then(result => {
      const user = result.user;
      if (user.phoneNumber !== ADMIN_PHONE) {
        showToast("Этот номер не является администраторским.");
        auth.signOut();
      } else {
        showToast("Вы успешно вошли как администратор.");
      }
    })
    .catch(err => {
      showToast("Ошибка входа: " + err.message);
      console.error("Admin login error", err);
    });
}

// Add admin login listener
document.getElementById("adminLoginBtn").addEventListener("click", adminLogin);
brand.addEventListener("click", () => goTo("home"));

// Helpers
function showToast(msg) {
  if (toast) {
    toast.textContent = msg;
    toast.style.display = "block";
    setTimeout(() => { toast.style.display = "none"; }, 4000);
  }
}

function escapeHTML(s) {
  return String(s || "").replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// Routing
function goTo(route) {
  navLinks.forEach(a => a.classList.toggle("active", a.dataset.route === route));
  updatedAt.textContent = `Обновлено: ${new Date().toLocaleString()}`;
  
  const routes = {
      home: renderHome,
      news: renderNews,
      jobs: renderJobs,
      schedule: renderSchedule,
      chat: renderChat
  };
  
  (routes[route] || renderHome)();
  window.location.hash = route;
}

window.addEventListener("hashchange", () => {
  const r = window.location.hash.substring(1) || "home";
  goTo(r);
});

// Initial route
goTo(window.location.hash.substring(1) || "home");

// Sidebar quick links
document.getElementById("asideJobsLink")?.addEventListener("click", () => goTo("jobs"));
document.getElementById("asideMapLink")?.addEventListener("click", () => window.open("https://www.google.com/maps", "_blank"));


// Load announcements
onValue(ref(db, "announcements"), snap => {
  const announcementsEl = document.getElementById("announcements");
  if (!announcementsEl) return;

  if (!snap.exists()) {
    announcementsEl.innerHTML = "<div class='muted'>Нет уведомлений.</div>";
    return;
  }
  const val = snap.val() || {};
  const arr = Object.values(val).sort((a, b) => b.time - a.time).slice(0, 5);
  announcementsEl.innerHTML = arr.map(a => `<div>${escapeHTML(a.text)}</div>`).join("");
});


// --- RENDERERS ---

function renderHome() {
  pageContent.innerHTML = `
    <div class="hero">
      <div class="left">
        <h1>Добро пожаловать на портал Щёлкино</h1>
        <p>Новости города, вакансии, расписание автобусов и чат жителей.</p>
      </div>
    </div>
    <section class="card fade-in" style="margin-top:20px;">
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
       <div style="margin-top:12px"><button class="btn btn-ghost" id="allScheduleBtn">Все маршруты</button></div>
    </section>
  `;
  document.getElementById("allNewsBtn").addEventListener("click", () => goTo("news"));
  document.getElementById("allJobsBtn").addEventListener("click", () => goTo("jobs"));
  document.getElementById("allScheduleBtn").addEventListener("click", () => goTo("schedule"));
  loadNewsPreview();
  loadJobsPreview();
  loadRoutesPreview();
}

function renderNews() {
  pageContent.innerHTML = `
    <button class="btn btn-ghost" onclick="window.history.back()">← Назад</button>
    <h2 style="margin-top: 12px;">Новости</h2>
    <div id="newsList" class="news-list"></div>
    ${isAdmin ? `
    <div class="card" style="margin-top:20px">
      <h3>Добавить новость</h3>
      <form id="newsForm">
        <label>Заголовок<input id="newsTitle" required></label>
        <label style="margin-top:8px">Текст новости<textarea id="newsLead" rows="4" required></textarea></label>
        <div style="margin-top:8px"><button type="submit" class="btn btn-primary">Опубликовать</button></div>
      </form>
    </div>
    ` : ''}
  `;
  if (isAdmin) document.getElementById("newsForm")?.addEventListener("submit", postNews);
  listenNewsList();
}

function renderJobs() {
    pageContent.innerHTML = `
    <button class="btn btn-ghost" onclick="window.history.back()">← Назад</button>
    <h2 style="margin-top: 12px;">Вакансии</h2>
    <div id="jobsList" class="jobs-list"></div>
    ${isAdmin ? `
    <div class="card" style="margin-top:20px">
      <h3>Разместить вакансию</h3>
      <form id="jobForm">
        <label>Должность<input id="jobTitle" required></label>
        <label style="margin-top:8px">Компания<input id="jobCompany"></label>
        <label style="margin-top:8px">Зарплата<input id="jobSalary" placeholder="Напр., 50 000 руб."></label>
        <label style="margin-top:8px">Контакт<input id="jobContact" placeholder="Телефон или Email" required></label>
        <div style="margin-top:8px"><button type="submit" class="btn btn-primary">Опубликовать</button></div>
      </form>
    </div>
    ` : ''}
  `;
  if (isAdmin) document.getElementById("jobForm")?.addEventListener("submit", postJob);
  listenJobsList();
}


function renderSchedule() {
    pageContent.innerHTML = `
    <button class="btn btn-ghost" onclick="window.history.back()">← Назад</button>
    <h2 style="margin-top: 12px;">Расписание</h2>
    <div id="routesList"></div>
    ${isAdmin ? `
    <div class="card" style="margin-top:20px">
      <h3>Добавить маршрут</h3>
      <form id="routeForm">
        <label>Название маршрута<input id="routeName" placeholder="Напр., Щёлкино - Ленино" required></label>
        <label style="margin-top:8px">Время отправления (через запятую)<input id="routeTimes" placeholder="06:30, 09:00, 12:30, 17:00" required></label>
        <div style="margin-top:8px"><button class="btn btn-primary" type="submit">Добавить</button></div>
      </form>
    </div>
    ` : ''}
  `;
  if (isAdmin) document.getElementById("routeForm")?.addEventListener("submit", postRoute);
  listenRoutes();
}

function renderChat() {
  pageContent.innerHTML = `
    <button class="btn btn-ghost" onclick="window.history.back()">← Назад</button>
    <h2 style="margin-top: 12px;">Чат жителей</h2>
    <div style="margin-bottom:12px"><button class="btn btn-ghost" id="changeNameBtn">Имя в чате: ${escapeHTML(displayName)}</button></div>
    <div class="card chat-window">
      <div class="messages" id="messagesBox"><div class="muted">Загрузка чата...</div></div>
      <form class="chat-input" id="chatForm">
        <input id="chatInput" placeholder="Напишите сообщение..." required autocomplete="off">
        <button type="submit" class="btn btn-primary">Отправить</button>
      </form>
    </div>
  `;
  document.getElementById("chatForm").addEventListener("submit", sendMessage);
  document.getElementById("changeNameBtn").addEventListener("click", () => {
    const newName = prompt("Введите новое имя:", displayName);
    if (newName && newName.trim()) {
      displayName = newName.trim();
      localStorage.setItem("shchyolkino_name", displayName);
      if (currentUser) set(ref(db, `users/${currentUser.uid}/name`), displayName);
      showToast("Имя изменено на: " + displayName);
      goTo('chat'); // Re-render to show new name on button
    }
  });
  listenChat();
}

// --- DATA LISTENERS AND POSTING ---

function postNews(e) {
  e.preventDefault();
  if (!isAdmin) { showToast("Только администратор может добавлять новости."); return; }
  const title = document.getElementById("newsTitle").value.trim();
  const lead = document.getElementById("newsLead").value.trim();
  const data = { title, lead, time: serverTimestamp(), author: displayName };
  push(ref(db, "news"), data)
    .then(() => {
      showToast("Новость опубликована");
      e.target.reset();
    })
    .catch(err => { console.error(err); showToast("Ошибка публикации."); });
}

function listenNewsList() {
  const container = document.getElementById("newsList");
  container.innerHTML = "<div class=\"muted\">Загрузка новостей...</div>";
  onValue(ref(db, "news"), snap => {
    if (!snap.exists()) {
      container.innerHTML = "<div class=\"muted\">Новостей пока нет.</div>";
      return;
    }
    const news = snap.val();
    const sortedNews = Object.values(news).sort((a, b) => b.time - a.time);
    container.innerHTML = sortedNews.map(n => `
      <article class="card fade-in">
        <h3 style="margin:0 0 6px 0">${escapeHTML(n.title)}</h3>
        <p>${escapeHTML(n.lead)}</p>
        <div class="muted">${new Date(n.time).toLocaleString()}</div>
      </article>
    `).join("");
  });
}

function loadNewsPreview() {
  const preview = document.getElementById("newsPreview");
  onValue(ref(db, "news"), snap => {
      if (!snap.exists()) {
          preview.innerHTML = "<div class='muted'>Новостей пока нет.</div>";
          return;
      }
    const arr = Object.values(snap.val()).sort((a, b) => b.time - a.time).slice(0, 3);
    preview.innerHTML = arr.map(n => `
      <div class="news-item" onclick="window.location.hash='news'">
        <div class="news-thumb"></div>
        <div>
          <div style="font-weight:700">${escapeHTML(n.title)}</div>
          <div class="news-meta">${new Date(n.time).toLocaleDateString()} · ${escapeHTML(n.lead.slice(0, 100)) + (n.lead.length > 100 ? '...' : '')}</div>
        </div>
      </div>
    `).join("");
  }, { onlyOnce: true });
}

function postJob(e) {
  e.preventDefault();
  if (!isAdmin) { showToast("Только администратор может добавлять вакансии."); return; }
  const data = {
    title: document.getElementById("jobTitle").value.trim(),
    company: document.getElementById("jobCompany").value.trim(),
    salary: document.getElementById("jobSalary").value.trim(),
    contact: document.getElementById("jobContact").value.trim(),
    time: serverTimestamp(),
  };
  push(ref(db, "jobs"), data)
    .then(() => { showToast("Вакансия размещена"); e.target.reset(); })
    .catch(err => { console.error(err); showToast("Ошибка публикации."); });
}

function listenJobsList() {
    const container = document.getElementById("jobsList");
    container.innerHTML = "<div class=\"muted\">Загрузка вакансий...</div>";
    onValue(ref(db, "jobs"), snap => {
        if (!snap.exists()) {
            container.innerHTML = "<div class=\"muted\">Вакансий пока нет.</div>";
            return;
        }
        const jobs = snap.val();
        const sortedJobs = Object.keys(jobs).map(key => ({...jobs[key], key})).sort((a, b) => b.time - a.time);
        container.innerHTML = sortedJobs.map(j => `
            <div class="job fade-in">
              <div>
                <div style="font-weight:700">${escapeHTML(j.title)}</div>
                <div class="muted">${escapeHTML(j.company) || 'Компания не указана'}</div>
                <div style="font-weight: 600; margin-top: 4px;">${escapeHTML(j.salary) || 'З/П не указана'}</div>
                <div class="muted" style="margin-top: 4px;">Контакт: ${escapeHTML(j.contact)}</div>
              </div>
              <div><button class="btn btn-primary apply-btn" data-id="${j.key}">Откликнуться</button></div>
            </div>
        `).join("");
    });

    container.addEventListener("click", e => {
        if (e.target.classList.contains("apply-btn")) {
            applyJob(e.target.dataset.id);
        }
    });
}

function applyJob(id) {
    if (!currentUser) return;
    set(ref(db, `applies/${id}/${currentUser.uid}`), { name: displayName, time: serverTimestamp() })
        .then(() => showToast("Ваш отклик отправлен!"))
        .catch(err => { console.error(err); showToast("Не удалось откликнуться."); });
}

function loadJobsPreview() {
  const preview = document.getElementById("jobsPreview");
  onValue(ref(db, "jobs"), snap => {
    if (!snap.exists()) {
        preview.innerHTML = "<div class='muted'>Вакансий пока нет.</div>";
        return;
    }
    const arr = Object.values(snap.val()).sort((a, b) => b.time - a.time).slice(0, 3);
    preview.innerHTML = arr.map(j => `
      <div class="job" onclick="window.location.hash='jobs'">
        <div>
          <div style="font-weight:700">${escapeHTML(j.title)}</div>
          <div class="muted">${escapeHTML(j.company)} · ${escapeHTML(j.salary)}</div>
        </div>
        <div><button class="btn btn-ghost">Подробнее</button></div>
      </div>
    `).join("");
  }, { onlyOnce: true });
}

function postRoute(e) {
  e.preventDefault();
  if (!isAdmin) { showToast("Только администратор может добавлять маршруты."); return; }
  const route = document.getElementById("routeName").value.trim();
  const times = document.getElementById("routeTimes").value.split(",").map(t => t.trim()).filter(Boolean);
  push(ref(db, "routes"), { route, times, time: serverTimestamp() })
    .then(() => { showToast("Маршрут добавлен"); e.target.reset(); })
    .catch(err => { console.error(err); showToast("Ошибка добавления."); });
}

function listenRoutes() {
  const container = document.getElementById("routesList");
  container.innerHTML = "<div class=\"muted\">Загрузка расписания...</div>";
  onValue(ref(db, "routes"), snap => {
    if (!snap.exists()) {
      container.innerHTML = "<div class=\"muted\">Расписания пока нет.</div>";
      return;
    }
    const routes = snap.val();
    const sortedRoutes = Object.values(routes).sort((a, b) => b.time - a.time);
    container.innerHTML = sortedRoutes.map(r => `
      <div class="card fade-in" style="margin-bottom: 8px">
        <div style="font-weight:700; font-size: 1.1em;">${escapeHTML(r.route)}</div>
        <div class="muted" style="margin-top: 6px">${r.times.join(' · ')}</div>
      </div>
    `).join("");
  });
}

function loadRoutesPreview() {
    const preview = document.getElementById("routesPreview");
    onValue(ref(db, "routes"), snap => {
        if (!snap.exists()) {
            preview.innerHTML = "<div class='muted'>Расписания пока нет.</div>";
            return;
        }
        const arr = Object.values(snap.val()).sort((a, b) => b.time - a.time).slice(0, 2);
        preview.innerHTML = arr.map(r => `
            <div class="route" onclick="window.location.hash='schedule'">
                <div style="font-weight:700">${escapeHTML(r.route)}</div>
                <div class="muted">${r.times.slice(0, 4).join(' · ')}...</div>
            </div>
        `).join("");
    }, { onlyOnce: true });
}

function sendMessage(e) {
  e.preventDefault();
  if (!currentUser) { showToast("Авторизуйтесь для отправки сообщений."); return; }
  const input = document.getElementById("chatInput");
  const text = input.value.trim();
  if (!text) return;
  const msg = { user: displayName, uid: currentUser.uid, text, time: serverTimestamp() };
  push(ref(db, "chat"), msg)
    .then(() => { input.value = ""; })
    .catch(err => { console.error(err); showToast("Ошибка отправки сообщения."); });
}

function listenChat() {
    const box = document.getElementById("messagesBox");
    const chatRef = ref(db, "chat");

    onValue(chatRef, (snap) => {
        if (!snap.exists()) {
            box.innerHTML = "<div class='muted' style='text-align: center; padding: 20px;'>Сообщений пока нет. Будьте первым!</div>";
            return;
        }
        
        box.innerHTML = "";
        snap.forEach(childSnap => {
            const m = childSnap.val();
            const el = document.createElement("div");
            const isMe = m.uid && currentUser && m.uid === currentUser.uid;
            el.className = "msg " + (isMe ? "me" : "");
            el.innerHTML = `
              ${!isMe ? `<strong>${escapeHTML(m.user)}</strong>` : ''}
              <div>${escapeHTML(m.text)}</div>
              <div class="muted" style="font-size:11px;margin-top:4px;text-align:right;">${new Date(m.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
            `;
            box.appendChild(el);
        });
        box.scrollTop = box.scrollHeight;
    });
}


// Search
document.getElementById("globalSearch").addEventListener("keypress", e => {
  if (e.key === "Enter") {
    const query = e.target.value.trim().toLowerCase();
    if (!query) return;
    goTo("search"); // Navigate to a virtual search route
    performSearch(query);
  }
});

function performSearch(q) {
  pageContent.innerHTML = `
    <button class="btn btn-ghost" onclick="window.history.back()">← Назад</button>
    <h2 style="margin-top:12px">Результаты поиска: ${escapeHTML(q)}</h2>
    <div id="searchResults"></div>
  `;
  const resultsContainer = document.getElementById("searchResults");
  resultsContainer.innerHTML = "<div class='muted'>Идет поиск...</div>";

  const newsRef = ref(db, "news");
  const jobsRef = ref(db, "jobs");
  let resultsHTML = "";
  let found = false;

  onValue(newsRef, newsSnap => {
    if(newsSnap.exists()){
      const foundNews = Object.values(newsSnap.val()).filter(n => 
        (n.title.toLowerCase().includes(q) || n.lead.toLowerCase().includes(q))
      );
      if(foundNews.length > 0) {
        found = true;
        resultsHTML += `<h3>Новости</h3>` + foundNews.sort((a,b) => b.time - a.time).map(n => `
          <div class="card" style="cursor:pointer; margin-bottom: 8px;" onclick="window.location.hash='news'">
            ${escapeHTML(n.title)}
            <div class="muted">${new Date(n.time).toLocaleDateString()}</div>
          </div>`).join("");
      }
    }
    
    onValue(jobsRef, jobsSnap => {
      if(jobsSnap.exists()){
        const foundJobs = Object.values(jobsSnap.val()).filter(j => 
          (j.title.toLowerCase().includes(q) || j.company.toLowerCase().includes(q))
        );
        if(foundJobs.length > 0) {
          found = true;
          resultsHTML += `<h3 style="margin-top:12px">Вакансии</h3>` + foundJobs.sort((a,b) => b.time - a.time).map(j => `
            <div class="card" style="cursor:pointer; margin-bottom: 8px;" onclick="window.location.hash='jobs'">
              ${escapeHTML(j.title)}
              <div class="muted">${escapeHTML(j.company)}</div>
            </div>`).join("");
        }
      }
      resultsContainer.innerHTML = found ? resultsHTML : "<div class='muted'>Ничего не найдено.</div>";
    }, { onlyOnce: true });
  }, { onlyOnce: true });
}

