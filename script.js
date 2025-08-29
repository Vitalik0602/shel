// script.js (type="module")
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getDatabase, ref, push, onValue, serverTimestamp, set, query, orderByChild, limitToLast } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
import { getAuth, onAuthStateChanged, RecaptchaVerifier, signInWithPhoneNumber, signOut } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-storage.js";

// ⚠️ ВАЖНО: ЗАМЕНИТЕ ЭТИ ДАННЫЕ НА ВАШИ ДАННЫЕ ИЗ FIREBASE
const firebaseConfig = {
  apiKey: "AIza...", // <-- ВАШ КЛЮЧ
  authDomain: "your-project-id.firebaseapp.com",
  databaseURL: "https://your-project-id.firebasedatabase.app",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456"
};

// ⚠️ УКАЖИТЕ НОМЕР ТЕЛЕФОНА АДМИНИСТРАТОРА
const ADMIN_PHONE = "+79991234567"; // формат: +7xxxxxxxxxx

// --- Инициализация Firebase ---
let app, db, auth, storage;
try {
  app = initializeApp(firebaseConfig);
  db = getDatabase(app);
  auth = getAuth(app);
  storage = getStorage(app);
} catch (err) {
  console.error("Firebase init error", err);
  alert("Ошибка инициализации Firebase. Проверьте ваш firebaseConfig.");
}

// --- Глобальные переменные и UI ссылки ---
let currentUser = null;
let isAdmin = false;
let displayName = localStorage.getItem("portal_username") || "Гость";
const pageContent = document.getElementById("pageContent");
const modal = document.getElementById("modal");

// --- АУТЕНТИФИКАЦИЯ ---
onAuthStateChanged(auth, user => {
  const authBtn = document.getElementById("authBtn");
  if (user) {
    currentUser = user;
    isAdmin = user.phoneNumber === ADMIN_PHONE;
    authBtn.textContent = isAdmin ? "Админ-панель" : "Выйти";
    // Получаем имя пользователя из базы
    const userRef = ref(db, `users/${user.uid}/name`);
    onValue(userRef, (snapshot) => {
      if (snapshot.exists()) {
        displayName = snapshot.val();
        localStorage.setItem("portal_username", displayName);
      }
    }, { onlyOnce: true });
  } else {
    currentUser = null;
    isAdmin = false;
    authBtn.textContent = "Войти";
    displayName = "Гость";
  }
  // Перерисовываем текущую страницу, чтобы показать/скрыть админские элементы
  goTo(window.location.hash.substring(1) || "home");
});

function handleAuthClick() {
  if (currentUser) {
    if (isAdmin) {
      // Можно добавить переход на специальную админ-страницу
      alert("Вы вошли как администратор. Формы для добавления контента доступны в соответствующих разделах.");
    } else {
      signOut(auth).then(() => showToast("Вы вышли из системы."));
    }
  } else {
    showLoginModal();
  }
}

function showLoginModal() {
  modal.innerHTML = `
    <div class="modal-content">
      <h3 style="margin-bottom: 16px;">Вход или регистрация</h3>
      <form id="authForm">
        <label>Номер телефона<input id="phoneInput" placeholder="+7 900 123 45 67" required></label>
        <div style="margin-top:12px">
          <button type="submit" class="btn btn-primary">Получить код</button>
          <button type="button" class="btn btn-ghost" onclick="document.getElementById('modal').style.display='none'">Отмена</button>
        </div>
      </form>
    </div>`;
  modal.style.display = 'flex';

  document.getElementById('authForm').addEventListener('submit', e => {
    e.preventDefault();
    const phone = document.getElementById('phoneInput').value.trim();
    if (!phone.startsWith('+')) {
        showToast("Номер должен начинаться с +");
        return;
    }
    
    window.recaptchaVerifier = new RecaptchaVerifier('recaptcha-container', { size: 'invisible' }, auth);
    
    signInWithPhoneNumber(auth, phone, window.recaptchaVerifier)
      .then(confirmationResult => {
        const code = prompt("Мы отправили SMS с кодом. Введите его:");
        if (code) {
          return confirmationResult.confirm(code);
        }
      })
      .then(result => {
        showToast(`Добро пожаловать, ${result.user.phoneNumber}!`);
        modal.style.display = 'none';
        promptForName(result.user);
      })
      .catch(err => {
        showToast("Ошибка: " + err.message);
        console.error(err);
      });
  });
}

function promptForName(user) {
    const userRef = ref(db, `users/${user.uid}/name`);
    onValue(userRef, (snapshot) => {
        if (!snapshot.exists()) {
            const name = prompt("Как вас зовут? (Это имя будет видно в чате)");
            if (name && name.trim()) {
                displayName = name.trim();
                set(userRef, displayName);
                localStorage.setItem("portal_username", displayName);
            }
        }
    }, { onlyOnce: true });
}

// --- МАРШРУТИЗАЦИЯ ---
const routes = {
  home: renderHome, news: renderNews, jobs: renderJobs,
  schedule: renderSchedule, afisha: renderAfisha,
  gallery: renderGallery, chat: renderChat
};

function goTo(route) {
  window.location.hash = route;
  document.querySelectorAll("nav a").forEach(a => a.classList.toggle("active", a.dataset.route === route));
  (routes[route] || renderHome)();
}
window.addEventListener("hashchange", () => goTo(window.location.hash.substring(1)));

// --- ОСНОВНЫЕ РЕНДЕР-ФУНКЦИИ ---

function renderHome() {
  pageContent.innerHTML = `<h1>Добро пожаловать на портал!</h1><p>Выберите интересующий вас раздел в меню.</p>`;
}

function renderNews() {
  pageContent.innerHTML = `<h2>Новости</h2><div id="list"></div> ${adminForm("newsForm", "Заголовок", "Текст новости")}`;
  if(isAdmin) document.getElementById("newsForm").onsubmit = (e) => postItem(e, "news");
  renderList("news");
}

function renderJobs() {
  pageContent.innerHTML = `<h2>Вакансии</h2><div id="list"></div> ${adminForm("jobsForm", "Должность", "Описание вакансии")}`;
  if(isAdmin) document.getElementById("jobsForm").onsubmit = (e) => postItem(e, "jobs");
  renderList("jobs");
}

function renderSchedule() {
  pageContent.innerHTML = `<h2>Расписание</h2><div id="list"></div> ${adminForm("scheduleForm", "Маршрут", "Время отправления (через запятую)")}`;
  if(isAdmin) document.getElementById("scheduleForm").onsubmit = (e) => postItem(e, "schedule");
  renderList("schedule");
}

function renderAfisha() {
  pageContent.innerHTML = `<h2>Афиша</h2><div id="list"></div> ${adminForm("afishaForm", "Название события", "Описание", true)}`;
  if(isAdmin) document.getElementById("afishaForm").onsubmit = (e) => postItem(e, "afisha", true);
  renderList("afisha");
}

function renderGallery() {
  pageContent.innerHTML = `<h2>Галерея</h2><div id="galleryGrid" class="gallery-grid"></div> ${adminForm("galleryForm", null, null, true)}`;
  if(isAdmin) document.getElementById("galleryForm").onsubmit = (e) => postItem(e, "gallery", true);
  renderGalleryItems();
}

function renderChat() {
  if (!currentUser) {
    pageContent.innerHTML = `<h2>Чат</h2><p class="muted">Чтобы войти в чат, <a href="#" onclick="showLoginModal(); return false;">авторизуйтесь</a>.</p>`;
    window.showLoginModal = showLoginModal; // Сделать функцию доступной в HTML
    return;
  }
  pageContent.innerHTML = `
    <h2>Чат жителей</h2>
    <div class="card chat-window">
      <div class="messages" id="messagesBox"></div>
      <form class="chat-input" id="chatForm">
        <input id="chatInput" placeholder="Ваше сообщение..." required autocomplete="off">
        <button type="submit" class="btn btn-primary">Отправить</button>
      </form>
    </div>`;
  
  const chatForm = document.getElementById("chatForm");
  const chatInput = document.getElementById("chatInput");
  chatForm.onsubmit = (e) => {
    e.preventDefault();
    if (!chatInput.value.trim()) return;
    push(ref(db, "chat"), {
      text: chatInput.value,
      name: displayName,
      uid: currentUser.uid,
      time: serverTimestamp()
    }).then(() => { chatInput.value = ""; });
  };
  listenChat();
}

// --- ЛОГИКА РЕНДЕРА СПИСКОВ И ЧАТА ---

function renderList(category) {
    const listRef = query(ref(db, category), orderByChild('time'));
    onValue(listRef, (snapshot) => {
        const listEl = document.getElementById('list');
        if (!listEl) return;
        listEl.innerHTML = "";
        if (!snapshot.exists()) {
            listEl.innerHTML = `<p class="muted">Здесь пока ничего нет.</p>`;
            return;
        }
        const data = [];
        snapshot.forEach(child => { data.push(child.val()) });
        
        data.reverse().forEach(item => {
            const card = document.createElement('div');
            card.className = 'card fade-in';
            card.style.marginBottom = '12px';
            
            let content = `<h3 style="margin:0;">${escapeHTML(item.title)}</h3><p>${escapeHTML(item.text)}</p>`;
            if (item.imageUrl) {
                content = `
                <div class="afisha-item">
                    <div class="afisha-thumb" style="background-image: url(${escapeHTML(item.imageUrl)})"></div>
                    <div>
                        <h3 style="margin:0">${escapeHTML(item.title)}</h3>
                        <p>${escapeHTML(item.text)}</p>
                    </div>
                </div>`;
            }
            card.innerHTML = content + `<div class="muted" style="margin-top:8px">${new Date(item.time).toLocaleString()}</div>`;
            listEl.appendChild(card);
        });
    });
}


function renderGalleryItems() {
    const galleryRef = query(ref(db, 'gallery'), orderByChild('time'));
    onValue(galleryRef, (snapshot) => {
        const gridEl = document.getElementById('galleryGrid');
        if (!gridEl) return;
        gridEl.innerHTML = "";
        if (!snapshot.exists()) {
            gridEl.innerHTML = `<p class="muted">В галерее пока нет фото.</p>`;
            return;
        }
        const data = [];
        snapshot.forEach(child => { data.push(child.val()) });
        data.reverse().forEach(item => {
            const imgDiv = document.createElement('div');
            imgDiv.className = 'gallery-item fade-in';
            imgDiv.style.backgroundImage = `url(${item.imageUrl})`;
            gridEl.appendChild(imgDiv);
        });
    });
}

function listenChat() {
    const chatRef = query(ref(db, "chat"), limitToLast(50));
    onValue(chatRef, (snapshot) => {
        const box = document.getElementById("messagesBox");
        if (!box) return;
        box.innerHTML = "";
        if (!snapshot.exists()) return;
        snapshot.forEach(child => {
            const msg = child.val();
            const el = document.createElement("div");
            const isMe = msg.uid === currentUser.uid;
            el.className = "msg " + (isMe ? "me" : "");
            el.innerHTML = `
              ${!isMe ? `<strong>${escapeHTML(msg.name)}</strong>` : ''}
              <div>${escapeHTML(msg.text)}</div>
              <div class="muted" style="font-size:11px;margin-top:4px;text-align:right;">
                ${new Date(msg.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </div>`;
            box.appendChild(el);
        });
        box.scrollTop = box.scrollHeight;
    });
}


// --- ФУНКЦИИ АДМИНИСТРАТОРА ---

function adminForm(id, titleLabel, textLabel, hasImage = false) {
  if (!isAdmin) return "";
  return `
    <div class="card" style="margin-top:20px">
      <h3>Добавить запись</h3>
      <form id="${id}">
        ${titleLabel ? `<label>${titleLabel}<input name="title" required></label>` : ''}
        ${textLabel ? `<label style="margin-top:8px">${textLabel}<textarea name="text" rows="3" required></textarea></label>` : ''}
        ${hasImage ? `<label style="margin-top:8px">Изображение<input name="image" type="file" accept="image/*" required></label>` : ''}
        <div style="margin-top:8px"><button type="submit" class="btn btn-primary">Опубликовать</button></div>
      </form>
    </div>`;
}

async function postItem(e, category, hasImage = false) {
    e.preventDefault();
    const form = e.target;
    const data = { time: serverTimestamp() };
    if (form.title) data.title = form.title.value;
    if (form.text) data.text = form.text.value;

    if (hasImage) {
        const file = form.image.files[0];
        if (!file) { showToast("Выберите файл"); return; }
        showToast("Загрузка файла...");
        const fileRef = storageRef(storage, `${category}/${Date.now()}_${file.name}`);
        try {
            const snapshot = await uploadBytes(fileRef, file);
            data.imageUrl = await getDownloadURL(snapshot.ref);
        } catch (err) {
            showToast("Ошибка загрузки файла: " + err.message);
            return;
        }
    }
    
    push(ref(db, category), data)
        .then(() => { showToast("Запись добавлена!"); form.reset(); })
        .catch(err => showToast("Ошибка: " + err.message));
}


// --- УТИЛИТЫ ---
function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.style.display = "block";
  setTimeout(() => { toast.style.display = "none"; }, 4000);
}
function escapeHTML(s) { return String(s).replace(/[&<>"']/g, i => `&#${i.charCodeAt(0)};`); }

// --- ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ ---
document.addEventListener("DOMContentLoaded", () => {
    document.querySelector(".brand").addEventListener("click", () => goTo("home"));
    document.getElementById("authBtn").addEventListener("click", handleAuthClick);
    document.querySelectorAll('nav a, aside li').forEach(el => {
        if(el.dataset.route) el.addEventListener('click', (e) => goTo(e.target.dataset.route));
    });
    goTo(window.location.hash.substring(1) || "home");
});
