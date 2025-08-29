```javascript
// script.js (type="module")
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import { getDatabase, ref, push, onValue, serverTimestamp, set } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";

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

// Admin Email (replace with actual admin email)
const ADMIN_EMAIL = "admin@example.com";

if (!firebaseConfig.apiKey || firebaseConfig.apiKey.includes("AIzaSy")) {
  alert("Пожалуйста, подставьте ваш собственный firebaseConfig в script.js.");
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
const provider = new GoogleAuthProvider();

// Google Authentication
function googleLogin() {
  if (currentUser) {
    signOut(auth).then(() => {
      showToast("Вы вышли.");
      document.getElementById("adminLoginBtn").textContent = "Войти";
      currentUser = null;
      isAdmin = false;
    }).catch(err => {
      console.error("Sign out error", err);
      showToast("Ошибка выхода: " + err.message);
    });
    return;
  }
  signInWithPopup(auth, provider)
    .then(result => {
      const user = result.user;
      showToast(`Добро пожаловать, ${displayName}!`);
      isAdmin = user.email === ADMIN_EMAIL;
      document.getElementById("adminLoginBtn").textContent = isAdmin ? "Выйти (Админ)" : "Выйти";
      set(ref(db, `users/${user.uid}`), { 
        name: displayName, 
        email: user.email, 
        lastSeen: serverTimestamp() 
      });
    })
    .catch(err => {
      console.error("Google auth error", {
        code: err.code,
        message: err.message,
        stack: err.stack
      });
      if (err.code === "auth/popup-closed-by-user") {
        showToast("Вход отменен: вы закрыли окно Google.");
      } else {
        showToast("Ошибка входа: " + err.message);
      }
    });
}

// Auth State
auth.onAuthStateChanged(user => {
  currentUser = user;
  isAdmin = user && user.email === ADMIN_EMAIL;
  document.getElementById("adminLoginBtn").textContent = user ? (isAdmin ? "Выйти (Админ)" : "Выйти") : "Войти";
  if (user) {
    set(ref(db, `users/${user.uid}`), { 
      name: displayName, 
      email: user.email, 
      lastSeen: serverTimestamp() 
    });
  }
});

// Add login listener
document.getElementById("adminLoginBtn").addEventListener("click", googleLogin);
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
  if (updatedAt) {
    updatedAt.textContent = `Обновлено: ${new Date().toLocaleString()}`;
  } else {
    console.warn("Element with id 'updatedAt' not found.");
  }
  
  const routes = {
    home: renderHome,
    news: renderNews,
    jobs: renderJobs,
    schedule: renderSchedule,
    chat: renderChat,
    gallery: renderGallery,
    events: renderEvents,
    services: renderServices
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
document.getElementById("asideGalleryLink")?.addEventListener("click", () => goTo("gallery"));
document.getElementById("asideEventsLink")?.addEventListener("click", () => goTo("events"));
document.getElementById("asideServicesLink")?.addEventListener("click", () => goTo("services"));

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
        <p>Новости города, вакансии, расписание автобусов, чат жителей, галерея, афиша и услуги.</p>
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
    <section class="card fade-in" style="margin-top:12px">
      <h2>Галерея</h2>
      <div id="galleryPreview" class="gallery-grid"><div class="muted">Загрузка...</div></div>
      <div style="margin-top:12px"><button class="btn btn-ghost" id="allGalleryBtn">Смотреть все</button></div>
    </section>
    <section class="card fade-in" style="margin-top:12px">
      <h2>Афиша</h2>
      <div id="eventsPreview" class="events-list"><div class="muted">Загрузка...</div></div>
      <div style="margin-top:12px"><button class="btn btn-ghost" id="allEventsBtn">Все события</button></div>
    </section>
    <section class="card fade-in" style="margin-top:12px">
      <h2>Услуги</h2>
      <div id="servicesPreview" class="services-list"><div class="muted">Загрузка...</div></div>
      <div style="margin-top:12px"><button class="btn btn-ghost" id="allServicesBtn">Все услуги</button></div>
    </section>
  `;
  document.getElementById("allNewsBtn").addEventListener("click", () => goTo("news"));
  document.getElementById("allJobsBtn").addEventListener("click", () => goTo("jobs"));
  document.getElementById("allScheduleBtn").addEventListener("click", () => goTo("schedule"));
  document.getElementById("allGalleryBtn").addEventListener("click", () => goTo("gallery"));
  document.getElementById("allEventsBtn").addEventListener("click", () => goTo("events"));
  document.getElementById("allServicesBtn").addEventListener("click", () => goTo("services"));
  loadNewsPreview();
  loadJobsPreview();
  loadRoutesPreview();
  loadGalleryPreview();
  loadEventsPreview();
  loadServicesPreview();
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
      goTo('chat');
    }
  });
  listenChat();
}

function renderGallery() {
  pageContent.innerHTML = `
    <button class="btn btn-ghost" onclick="window.history.back()">← Назад</button>
    <h2 style="margin-top: 12px;">Галерея</h2>
    <div id="galleryList" class="gallery-grid"></div>
    ${isAdmin ? `
    <div class="card" style="margin-top:20px">
      <h3>Добавить фото</h3>
      <form id="galleryForm">
        <label>URL изображения<input id="photoUrl" type="url" required></label>
        <label style="margin-top:8px">Описание<textarea id="photoCaption" rows="2"></textarea></label>
        <div style="margin-top:8px"><button type="submit" class="btn btn-primary">Добавить</button></div>
      </form>
    </div>
    ` : ''}
  `;
  if (isAdmin) document.getElementById("galleryForm")?.addEventListener("submit", postPhoto);
  listenGallery();
}

function renderEvents() {
  pageContent.innerHTML = `
    <button class="btn btn-ghost" onclick="window.history.back()">← Назад</button>
    <h2 style="margin-top: 12px;">Афиша</h2>
    <div id="eventsList" class="events-list"></div>
    ${isAdmin ? `
    <div class="card" style="margin-top:20px">
      <h3>Добавить событие</h3>
      <form id="eventForm">
        <label>Название события<input id="eventTitle" required></label>
        <label style="margin-top:8px">Дата и время<input id="eventDateTime" type="datetime-local" required></label>
        <label style="margin-top:8px">Описание<textarea id="eventDescription" rows="4"></textarea></label>
        <label style="margin-top:8px">Место проведения<input id="eventLocation"></label>
        <div style="margin-top:8px"><button type="submit" class="btn btn-primary">Опубликовать</button></div>
      </form>
    </div>
    ` : ''}
  `;
  if (isAdmin) document.getElementById("eventForm")?.addEventListener("submit", postEvent);
  listenEvents();
}

function renderServices() {
  pageContent.innerHTML = `
    <button class="btn btn-ghost" onclick="window.history.back()">← Назад</button>
    <h2 style="margin-top: 12px;">Услуги</h2>
    <div id="servicesList" class="services-list"></div>
    ${isAdmin ? `
    <div class="card" style="margin-top:20px">
      <h3>Добавить услугу</h3>
      <form id="serviceForm">
        <label>Название услуги<input id="serviceTitle" required></label>
        <label style="margin-top:8px">Описание<textarea id="serviceDescription" rows="4"></textarea></label>
        <label style="margin-top:8px">Контакт<input id="serviceContact" placeholder="Телефон или Email" required></label>
        <div style="margin-top:8px"><button type="submit" class="btn btn-primary">Опубликовать</button></div>
      </form>
    </div>
    ` : ''}
  `;
  if (isAdmin) document.getElementById("serviceForm")?.addEventListener("submit", postService);
  listenServices();
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
  if (!currentUser) { showToast("Авторизуйтесь для отклика."); return; }
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

function postPhoto(e) {
  e.preventDefault();
  if (!isAdmin) { showToast("Только администратор может добавлять фото."); return; }
  const data = {
    url: document.getElementById("photoUrl").value.trim(),
    caption: document.getElementById("photoCaption").value.trim(),
    time: serverTimestamp(),
    author: displayName
  };
  push(ref(db, "gallery"), data)
    .then(() => { showToast("Фото добавлено"); e.target.reset(); })
    .catch(err => { console.error(err); showToast("Ошибка добавления."); });
}

function listenGallery() {
  const container = document.getElementById("galleryList");
  container.innerHTML = "<div class=\"muted\">Загрузка галереи...</div>";
  onValue(ref(db, "gallery"), snap => {
    if (!snap.exists()) {
      container.innerHTML = "<div class=\"muted\">Фото пока нет.</div>";
      return;
    }
    const photos = snap.val();
    const sortedPhotos = Object.values(photos).sort((a, b) => b.time - a.time);
    container.innerHTML = sortedPhotos.map(p => `
      <div class="gallery-img" style="background-image: url(${escapeHTML(p.url)});" onclick="window.open('${escapeHTML(p.url)}', '_blank')">
        <div class="muted" style="background: rgba(0,0,0,0.5); color: white; padding: 8px; border-radius: 0 0 12px 12px;">${escapeHTML(p.caption)}</div>
      </div>
    `).join("");
  });
}

function loadGalleryPreview() {
  const preview = document.getElementById("galleryPreview");
  onValue(ref(db, "gallery"), snap => {
    if (!snap.exists()) {
      preview.innerHTML = "<div class='muted'>Фото пока нет.</div>";
      return;
    }
    const arr = Object.values(snap.val()).sort((a, b) => b.time - a.time).slice(0, 3);
    preview.innerHTML = arr.map(p => `
      <div class="gallery-img" style="background-image: url(${escapeHTML(p.url)});" onclick="window.location.hash='gallery'">
        <div class="muted" style="background: rgba(0,0,0,0.5); color: white; padding: 8px; border-radius: 0 0 12px 12px;">${escapeHTML(p.caption)}</div>
      </div>
    `).join("");
  }, { onlyOnce: true });
}

function postEvent(e) {
  e.preventDefault();
  if (!isAdmin) { showToast("Только администратор может добавлять события."); return; }
  const data = {
    title: document.getElementById("eventTitle").value.trim(),
    dateTime: document.getElementById("eventDateTime").value,
    description: document.getElementById("eventDescription").value.trim(),
    location: document.getElementById("eventLocation").value.trim(),
    time: serverTimestamp(),
    author: displayName
  };
  push(ref(db, "events"), data)
    .then(() => { showToast("Событие добавлено"); e.target.reset(); })
    .catch(err => { console.error(err); showToast("Ошибка добавления."); });
}

function listenEvents() {
  const container = document.getElementById("eventsList");
  container.innerHTML = "<div class=\"muted\">Загрузка событий...</div>";
  onValue(ref(db, "events"), snap => {
    if (!snap.exists()) {
      container.innerHTML = "<div class=\"muted\">Событий пока нет.</div>";
      return;
    }
    const events = snap.val();
    const sortedEvents = Object.values(events).sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
    container.innerHTML = sortedEvents.map(e => `
      <div class="event-item fade-in">
        <div style="font-weight:700">${escapeHTML(e.title)}</div>
        <div class="muted" style="margin-top:4px">${new Date(e.dateTime).toLocaleString()}</div>
        <div style="margin-top:4px">${escapeHTML(e.description)}</div>
        <div class="muted" style="margin-top:4px">Место: ${escapeHTML(e.location) || 'Не указано'}</div>
      </div>
    `).join("");
  });
}

function loadEventsPreview() {
  const preview = document.getElementById("eventsPreview");
  onValue(ref(db, "events"), snap => {
    if (!snap.exists()) {
      preview.innerHTML = "<div class='muted'>Событий пока нет.</div>";
      return;
    }
    const arr = Object.values(snap.val()).sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime)).slice(0, 2);
    preview.innerHTML = arr.map(e => `
      <div class="event-item" onclick="window.location.hash='events'">
        <div style="font-weight:700">${escapeHTML(e.title)}</div>
        <div class="muted">${new Date(e.dateTime).toLocaleDateString()}</div>
      </div>
    `).join("");
  }, { onlyOnce: true });
}

function postService(e) {
  e.preventDefault();
  if (!isAdmin) { showToast("Только администратор может добавлять услуги."); return; }
  const data = {
    title: document.getElementById("serviceTitle").value.trim(),
    description: document.getElementById("serviceDescription").value.trim(),
    contact: document.getElementById("serviceContact").value.trim(),
    time: serverTimestamp(),
    author: displayName
  };
  push(ref(db, "services"), data)
    .then(() => { showToast("Услуга добавлена"); e.target.reset(); })
    .catch(err => { console.error(err); showToast("Ошибка добавления."); });
}

function listenServices() {
  const container = document.getElementById("servicesList");
  container.innerHTML = "<div class=\"muted\">Загрузка услуг...</div>";
  onValue(ref(db, "services"), snap => {
    if (!snap.exists()) {
      container.innerHTML = "<div class=\"muted\">Услуг пока нет.</div>";
      return;
    }
    const services = snap.val();
    const sortedServices = Object.values(services).sort((a, b) => b.time - a.time);
    container.innerHTML = sortedServices.map(s => `
      <div class="service-item fade-in">
        <div style="font-weight:700">${escapeHTML(s.title)}</div>
        <div style="margin-top:4px">${escapeHTML(s.description)}</div>
        <div class="muted" style="margin-top:4px">Контакт: ${escapeHTML(s.contact)}</div>
      </div>
    `).join("");
  });
}

function loadServicesPreview() {
  const preview = document.getElementById("servicesPreview");
  onValue(ref(db, "services"), snap => {
    if (!snap.exists()) {
      preview.innerHTML = "<div class='muted'>Услуг пока нет.</div>";
      return;
    }
    const arr = Object.values(snap.val()).sort((a, b) => b.time - a.time).slice(0, 2);
    preview.innerHTML = arr.map(s => `
      <div class="service-item" onclick="window.location.hash='services'">
        <div style="font-weight:700">${escapeHTML(s.title)}</div>
        <div class="muted">${escapeHTML(s.description.slice(0, 50)) + (s.description.length > 50 ? '...' : '')}</div>
      </div>
    `).join("");
  }, { onlyOnce: true });
}

// Search
document.getElementById("globalSearch").addEventListener("keypress", e => {
  if (e.key === "Enter") {
    const query = e.target.value.trim().toLowerCase();
    if (!query) return;
    goTo("search");
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
  const eventsRef = ref(db, "events");
  const servicesRef = ref(db, "services");
  let resultsHTML = "";
  let found = false;

  onValue(newsRef, newsSnap => {
    if (newsSnap.exists()) {
      const foundNews = Object.values(newsSnap.val()).filter(n => 
        (n.title.toLowerCase().includes(q) || n.lead.toLowerCase().includes(q))
      );
      if (foundNews.length > 0) {
        found = true;
        resultsHTML += `<h3>Новости</h3>` + foundNews.sort((a,b) => b.time - a.time).map(n => `
          <div class="card" style="cursor:pointer; margin-bottom: 8px;" onclick="window.location.hash='news'">
            ${escapeHTML(n.title)}
            <div class="muted">${new Date(n.time).toLocaleDateString()}</div>
          </div>`).join("");
      }
    }
    
    onValue(jobsRef, jobsSnap => {
      if (jobsSnap.exists()) {
        const foundJobs = Object.values(jobsSnap.val()).filter(j => 
          (j.title.toLowerCase().includes(q) || j.company.toLowerCase().includes(q))
        );
        if (foundJobs.length > 0) {
          found = true;
          resultsHTML += `<h3 style="margin-top:12px">Вакансии</h3>` + foundJobs.sort((a,b) => b.time - a.time).map(j => `
            <div class="card" style="cursor:pointer; margin-bottom: 8px;" onclick="window.location.hash='jobs'">
              ${escapeHTML(j.title)}
              <div class="muted">${escapeHTML(j.company)}</div>
            </div>`).join("");
        }
      }
      
      onValue(eventsRef, eventsSnap => {
        if (eventsSnap.exists()) {
          const foundEvents = Object.values(eventsSnap.val()).filter(e => 
            (e.title.toLowerCase().includes(q) || e.description.toLowerCase().includes(q))
          );
          if (foundEvents.length > 0) {
            found = true;
            resultsHTML += `<h3 style="margin-top:12px">События</h3>` + foundEvents.sort((a,b) => new Date(a.dateTime) - new Date(b.dateTime)).map(e => `
              <div class="card" style="cursor:pointer; margin-bottom: 8px;" onclick="window.location.hash='events'">
                ${escapeHTML(e.title)}
                <div class="muted">${new Date(e.dateTime).toLocaleDateString()}</div>
              </div>`).join("");
          }
        }
        
        onValue(servicesRef, servicesSnap => {
          if (servicesSnap.exists()) {
            const foundServices = Object.values(servicesSnap.val()).filter(s => 
              (s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q))
            );
            if (foundServices.length > 0) {
              found = true;
              resultsHTML += `<h3 style="margin-top:12px">Услуги</h3>` + foundServices.sort((a,b) => b.time - a.time).map(s => `
                <div class="card" style="cursor:pointer; margin-bottom: 8px;" onclick="window.location.hash='services'">
                  ${escapeHTML(s.title)}
                  <div class="muted">${escapeHTML(s.description.slice(0, 50)) + (s.description.length > 50 ? '...' : '')}</div>
                </div>`).join("");
            }
          }
          resultsContainer.innerHTML = found ? resultsHTML : "<div class='muted'>Ничего не найдено.</div>";
        }, { onlyOnce: true });
      }, { onlyOnce: true });
    }, { onlyOnce: true });
  }, { onlyOnce: true });
}
```
