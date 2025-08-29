// script.js (type="module")
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getDatabase, ref, push, onValue, serverTimestamp, set, query, orderByChild, limitToLast } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
import { getAuth, onAuthStateChanged, RecaptchaVerifier, signInWithPhoneNumber, signOut } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-storage.js";

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

if (!firebaseConfig.apiKey || firebaseConfig.apiKey.includes("AIzaSy")) {
  alert("Пожалуйста, подставьте ваш собственный firebaseConfig в script.js, чтобы ваше приложение работало корректно и безопасно.");
}

// Initialize Firebase
let app, db, auth, storage;
try {
  app = initializeApp(firebaseConfig);
  db = getDatabase(app);
  auth = getAuth(app);
  storage = getStorage(app);
} catch (err) {
  console.error("Firebase init error", err);
  showToast("Ошибка инициализации Firebase. Проверьте config.");
}

// --- GLOBAL STATE & UI REFS ---
let currentUser = null;
let isAdmin = false;
let displayName = localStorage.getItem("shchyolkino_name") || "Гость";
const pageContent = document.getElementById("pageContent");
const updatedAt = document.getElementById("updatedAt");
const toast = document.getElementById("toast");
const modal = document.getElementById("modal");

// --- AUTHENTICATION ---
onAuthStateChanged(auth, user => {
  const authBtn = document.getElementById("authBtn");
  if (user) {
    currentUser = user;
    isAdmin = user.phoneNumber === ADMIN_PHONE;
    onValue(ref(db, `users/${user.uid}/name`), snap => {
        if (snap.exists()) displayName = snap.val();
        localStorage.setItem("shchyolkino_name", displayName);
        authBtn.textContent = isAdmin ? "Выйти (Админ)" : "Выйти";
    }, { onlyOnce: true });
    
    set(ref(db, `users/${user.uid}`), { name: displayName, lastSeen: serverTimestamp() });
    console.log("Signed in as", user.uid, "isAdmin:", isAdmin);
    
  } else {
    currentUser = null;
    isAdmin = false;
    authBtn.textContent = "Войти";
    displayName = "Гость";
  }
  // Re-render current page to reflect auth changes (e.g., show admin forms)
  goTo(window.location.hash.substring(1) || "home", true);
});

function handleAuthClick() {
  if (currentUser) {
    signOut(auth).then(() => showToast("Вы вышли из системы."));
  } else {
    showLoginModal();
  }
}

function showLoginModal() {
  modal.innerHTML = `
    <div class="modal-content">
      <h3>Вход на портал</h3>
      <p class="muted" style="margin-bottom: 16px;">Введите ваш номер телефона для авторизации. Мы пришлем вам SMS с кодом подтверждения.</p>
      <form id="authForm">
        <label>Номер телефона
          <input id="phoneInput" placeholder="+7 900 123 45 67" required>
        </label>
        <div style="margin-top:12px">
          <button type="submit" class="btn btn-primary">Получить код</button>
          <button type="button" class="btn btn-ghost" onclick="document.getElementById('modal').style.display='none'">Отмена</button>
        </div>
      </form>
    </div>
  `;
  modal.style.display = 'flex';
  
  const authForm = document.getElementById('authForm');
  authForm.addEventListener('submit', e => {
    e.preventDefault();
    const phone = document.getElementById('phoneInput').value.trim();
    if (!phone) return;

    window.recaptchaVerifier = new RecaptchaVerifier('recaptcha-container', { size: 'invisible' }, auth);

    signInWithPhoneNumber(auth, phone, window.recaptchaVerifier)
      .then(confirmationResult => {
        window.confirmationResult = confirmationResult;
        const code = prompt("Введите код из SMS");
        if (!code) return;
        return confirmationResult.confirm(code);
      })
      .then(() => {
        showToast("Вы успешно вошли!");
        modal.style.display = 'none';
        promptForName();
      })
      .catch(err => {
        showToast("Ошибка входа: " + err.message);
        console.error("Auth error", err);
      });
  });
}

function promptForName() {
    if (!currentUser) return;
    onValue(ref(db, `users/${currentUser.uid}/name`), (snap) => {
        if (!snap.exists()) {
             const name = prompt("Как вас зовут? (это имя будет видно в чате)", "");
             if (name && name.trim()){
                 displayName = name.trim();
                 localStorage.setItem("shchyolkino_name", displayName);
                 set(ref(db, `users/${currentUser.uid}/name`), displayName);
             }
        }
    }, { onlyOnce: true });
}


// --- HELPERS ---
function showToast(msg) {
  if (!toast) return;
  toast.textContent = msg;
  toast.style.display = "block";
  setTimeout(() => { toast.style.display = "none"; }, 4000);
}

function escapeHTML(s) {
  return String(s || "").replace(/[&<>"']/g, i => `&#${i.charCodeAt(0)};`);
}

// --- ROUTING ---
const routes = {
  home: renderHome,
  news: renderNews,
  jobs: renderJobs,
  schedule: renderSchedule,
  chat: renderChat,
  afisha: renderAfisha,
  gallery: renderGallery
};

function goTo(route, isRefresh = false) {
  if (!isRefresh) window.location.hash = route;
  document.querySelectorAll("nav a").forEach(a => a.classList.toggle("active", a.dataset.route === route));
  updatedAt.textContent = `Обновлено: ${new Date().toLocaleString()}`;
  
  const renderer = routes[route] || renderHome;
  renderer();
}

window.addEventListener("hashchange", () => goTo(window.location.hash.substring(1)));

// --- EVENT LISTENERS ---
document.addEventListener("DOMContentLoaded", () => {
  document.querySelector(".brand").addEventListener("click", () => goTo("home"));
  document.getElementById("authBtn").addEventListener("click", handleAuthClick);
  document.querySelectorAll("aside ul li").forEach(li => {
      if(li.dataset.route) li.addEventListener("click", () => goTo(li.dataset.route));
  });
  document.getElementById("asideMapLink")?.addEventListener("click", () => window.open("https://yandex.ru/maps/11471/shelkino", "_blank"));
  
  goTo(window.location.hash.substring(1) || "home");
  loadAnnouncements();
});


// --- DATA LOADERS & RENDERERS ---

// Announcements
function loadAnnouncements() {
    onValue(ref(db, "announcements"), snap => {
      const el = document.getElementById("announcements");
      if (!el) return;
      if (!snap.exists()) {
        el.innerHTML = "<div class='muted'>Нет уведомлений.</div>";
        return;
      }
      const data = Object.values(snap.val()).sort((a,b) => b.time - a.time).slice(0, 5);
      el.innerHTML = data.map(a => `<div>${escapeHTML(a.text)}</div>`).join("<hr style='border:0; border-top: 1px solid #f1f5f9; margin: 8px 0;'>");
    });
}

// Home Page
function renderHome() {
  pageContent.innerHTML = `
    <div class="hero">
      <div class="left">
        <h1>Добро пожаловать на портал Щёлкино</h1>
        <p>Новости, вакансии, афиша, расписание и чат жителей.</p>
      </div>
    </div>
    <section class="card fade-in" style="margin-top:20px;">
      <h2>Последние новости</h2>
      <div id="newsPreview" class="news-list"><div class="muted">Загрузка...</div></div>
    </section>
    <section class="card fade-in" style="margin-top:12px">
      <h2>Афиша</h2>
      <div id="afishaPreview" class="afisha-list"><div class="muted">Загрузка...</div></div>
    </section>
  `;
  // Load previews
  onValue(query(ref(db, "news"), orderByChild('time'), limitToLast(3)), snap => {
     const el = document.getElementById("newsPreview");
     if (!snap.exists()) { el.innerHTML = "<div class='muted'>Новостей пока нет.</div>"; return; }
     const data = Object.values(snap.val()).reverse();
     el.innerHTML = data.map(n => `
      <div class="news-item" onclick="window.location.hash='news'">
        <div class="news-thumb"></div>
        <div>
          <div style="font-weight:700">${escapeHTML(n.title)}</div>
          <div class="news-meta">${new Date(n.time).toLocaleDateString()}</div>
        </div>
      </div>`).join("") + `<div style="margin-top:12px"><button class="btn btn-ghost" onclick="window.location.hash='news'">Все новости</button></div>`;
  }, { onlyOnce: true });

  onValue(query(ref(db, "afisha"), orderByChild('time'), limitToLast(2)), snap => {
     const el = document.getElementById("afishaPreview");
     if (!snap.exists()) { el.innerHTML = "<div class='muted'>Событий пока нет.</div>"; return; }
     const data = Object.values(snap.val()).reverse();
     el.innerHTML = data.map(item => `
        <div class="afisha-item">
          <div class="afisha-thumb" style="background-image: url(${escapeHTML(item.imageUrl || 'https://via.placeholder.com/120x80')})"></div>
          <div>
            <div style="font-weight:700">${escapeHTML(item.title)}</div>
            <div class="afisha-meta">${new Date(item.date).toLocaleDateString("ru-RU", { day: 'numeric', month: 'long' })}</div>
          </div>
        </div>`).join("") + `<div style="margin-top:12px"><button class="btn btn-ghost" onclick="window.location.hash='afisha'">Вся афиша</button></div>`;
  }, { onlyOnce: true });
}

// News
function renderNews() {
  pageContent.innerHTML = `
    <h2>Новости</h2><div id="newsList" class="news-list"></div>
    ${isAdmin ? `
    <div class="card" style="margin-top:20px">
      <h3>Добавить новость</h3>
      <form id="newsForm">
        <label>Заголовок<input id="newsTitle" required></label>
        <label style="margin-top:8px">Текст<textarea id="newsLead" rows="4" required></textarea></label>
        <div style="margin-top:8px"><button type="submit" class="btn btn-primary">Опубликовать</button></div>
      </form>
    </div>` : ''}
  `;
  if (isAdmin) document.getElementById("newsForm").addEventListener("submit", postNews);
  
  onValue(query(ref(db, "news"), orderByChild('time')), snap => {
    const el = document.getElementById("newsList");
    if (!snap.exists()) { el.innerHTML = "<div class='muted'>Новостей пока нет.</div>"; return; }
    const data = Object.values(snap.val()).reverse();
    el.innerHTML = data.map(n => `
      <article class="card fade-in">
        <h3 style="margin:0 0 6px 0">${escapeHTML(n.title)}</h3>
        <p>${escapeHTML(n.lead)}</p>
        <div class="muted">${new Date(n.time).toLocaleString()}</div>
      </article>`).join("");
  });
}

function postNews(e) {
  e.preventDefault();
  const title = document.getElementById("newsTitle").value.trim();
  const lead = document.getElementById("newsLead").value.trim();
  push(ref(db, "news"), { title, lead, time: serverTimestamp() })
    .then(() => { showToast("Новость опубликована"); e.target.reset(); })
    .catch(err => showToast("Ошибка: " + err.message));
}

// Afisha
function renderAfisha() {
    pageContent.innerHTML = `
    <h2>Афиша</h2><div id="afishaList" class="afisha-list"></div>
    ${isAdmin ? `
    <div class="card" style="margin-top:20px">
      <h3>Добавить событие</h3>
      <form id="afishaForm">
        <label>Название<input id="afishaTitle" required></label>
        <label style="margin-top:8px">Описание<textarea id="afishaDesc" rows="3" required></textarea></label>
        <label style="margin-top:8px">Дата<input id="afishaDate" type="date" required></label>
        <label style="margin-top:8px">Изображение<input id="afishaImage" type="file" accept="image/*" required></label>
        <div style="margin-top:8px"><button type="submit" class="btn btn-primary">Добавить</button></div>
      </form>
    </div>` : ''}
  `;
  if (isAdmin) document.getElementById("afishaForm").addEventListener("submit", postAfisha);

  onValue(query(ref(db, "afisha"), orderByChild('date')), snap => {
    const el = document.getElementById("afishaList");
    if (!snap.exists()) { el.innerHTML = "<div class='muted'>Событий пока нет.</div>"; return; }
    const data = Object.values(snap.val()).reverse();
    el.innerHTML = data.map(item => `
      <div class="card fade-in">
        <div class="afisha-item">
            <div class="afisha-thumb" style="background-image: url(${escapeHTML(item.imageUrl)})"></div>
            <div>
                <h3 style="margin:0">${escapeHTML(item.title)}</h3>
                <p style="margin:4px 0">${escapeHTML(item.description)}</p>
                <div class="afisha-meta"><b>Когда:</b> ${new Date(item.date).toLocaleDateString("ru-RU", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
            </div>
        </div>
      </div>`).join("");
  });
}

async function postAfisha(e) {
  e.preventDefault();
  const title = document.getElementById("afishaTitle").value.trim();
  const description = document.getElementById("afishaDesc").value.trim();
  const date = document.getElementById("afishaDate").value;
  const imageFile = document.getElementById("afishaImage").files[0];
  if (!title || !description || !date || !imageFile) {
      showToast("Заполните все поля.");
      return;
  }
  
  showToast("Загрузка изображения...");
  const imageRef = storageRef(storage, `afisha/${Date.now()}-${imageFile.name}`);
  try {
      const snapshot = await uploadBytes(imageRef, imageFile);
      const imageUrl = await getDownloadURL(snapshot.ref);
      
      await push(ref(db, "afisha"), { title, description, date, imageUrl, time: serverTimestamp() });
      showToast("Событие добавлено!");
      e.target.reset();
  } catch (err) {
      showToast("Ошибка загрузки: " + err.message);
      console.error(err);
  }
}

// Gallery
function renderGallery() {
    pageContent.innerHTML = `
    <h2>Галерея</h2><div id="galleryGrid" class="gallery-grid"></div>
    ${isAdmin ? `
    <div class="card" style="margin-top:20px">
      <h3>Загрузить фото</h3>
      <form id="galleryForm">
        <label>Выберите изображение<input id="galleryImage" type="file" accept="image/*" required></label>
        <div style="margin-top:8px"><button type="submit" class="btn btn-primary">Загрузить</button></div>
      </form>
    </div>` : ''}
  `;
  if (isAdmin) document.getElementById("galleryForm").addEventListener("submit", postGallery);
  
  onValue(query(ref(db, "gallery"), orderByChild('time')), snap => {
    const el = document.getElementById("galleryGrid");
    if (!snap.exists()) { el.innerHTML = "<div class='muted'>Фотографий пока нет.</div>"; return; }
    const data = Object.values(snap.val()).reverse();
    el.innerHTML = data.map(item => `
      <div class="gallery-item" style="background-image: url(${escapeHTML(item.url)})" onclick="showImageModal('${escapeHTML(item.url)}')"></div>
      `).join("");
  });
}

async function postGallery(e) {
  e.preventDefault();
  const imageFile = document.getElementById("galleryImage").files[0];
  if (!imageFile) return;

  showToast("Загрузка фото...");
  const imageRef = storageRef(storage, `gallery/${Date.now()}-${imageFile.name}`);
  try {
      const snapshot = await uploadBytes(imageRef, imageFile);
      const url = await getDownloadURL(snapshot.ref);
      await push(ref(db, "gallery"), { url, time: serverTimestamp() });
      showToast("Фото добавлено в галерею!");
      e.target.reset();
  } catch (err) {
      showToast("Ошибка загрузки: " + err.message);
      console.error(err);
  }
}

function showImageModal(url) {
    modal.innerHTML = `
        <div class="modal-content" style="padding: 4px; max-width: 90vw; max-height: 90vh;">
            <img src="${url}" style="max-width: 100%; max-height: 100%; display: block; border-radius: 10px;">
        </div>
    `;
    modal.style.display = 'flex';
    modal.onclick = () => modal.style.display = 'none';
}


// Chat
function renderChat() {
  if (!currentUser) {
      pageContent.innerHTML = `<h2>Чат жителей</h2><div class="card muted" style="padding: 30px; text-align: center;">Пожалуйста, <a href="#" id="loginLink">войдите в систему</a>, чтобы пользоваться чатом.</div>`;
      document.getElementById("loginLink").addEventListener('click', (e) => { e.preventDefault(); showLoginModal(); });
      return;
  }
  pageContent.innerHTML = `
    <h2>Чат жителей</h2>
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
      goTo('chat', true);
    }
  });
  listenChat();
}

function sendMessage(e) {
  e.preventDefault();
  const input = document.getElementById("chatInput");
  const text = input.value.trim();
  if (!text) return;
  const msg = { name: displayName, uid: currentUser.uid, text, time: serverTimestamp() };
  push(ref(db, "chat"), msg)
    .then(() => input.value = "")
    .catch(err => showToast("Ошибка отправки: " + err.message));
}

function listenChat() {
    const box = document.getElementById("messagesBox");
    const chatRef = query(ref(db, "chat"), limitToLast(50));
    onValue(chatRef, (snap) => {
        if (!box || !snap.exists()) {
            if(box) box.innerHTML = "<div class='muted' style='text-align: center; padding: 20px;'>Сообщений пока нет.</div>";
            return;
        }
        box.innerHTML = "";
        snap.forEach(childSnap => {
            const m = childSnap.val();
            const el = document.createElement("div");
            const isMe = m.uid && currentUser && m.uid === currentUser.uid;
            el.className = "msg " + (isMe ? "me" : "");
            el.innerHTML = `
              ${!isMe ? `<strong>${escapeHTML(m.name)}</strong>` : ''}
              <div>${escapeHTML(m.text)}</div>
              <div class="muted" style="font-size:11px;margin-top:4px;text-align:right;">${new Date(m.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
            `;
            box.appendChild(el);
        });
        box.scrollTop = box.scrollHeight;
    });
}


// --- OTHER RENDERERS (Jobs, Schedule) ---
// These are simplified to focus on the new features, but they can be expanded similarly.
function renderJobs() { pageContent.innerHTML = `<h2>Вакансии</h2><p>Раздел в разработке.</p>`; }
function renderSchedule() { pageContent.innerHTML = `<h2>Расписание</h2><p>Раздел в разработке.</p>`; }
