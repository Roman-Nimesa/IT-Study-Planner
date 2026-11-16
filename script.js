import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, doc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// Конфигурация веб-приложения Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBYI5kVNefeCDLea2R76TQtQp-Jq4d8bW8",
  authDomain: "itstudyplanner.firebaseapp.com",
  projectId: "itstudyplanner",
  storageBucket: "itstudyplanner.firebasestorage.app",
  messagingSenderId: "498250378170",
  appId: "1:498250378170:web:06f08a78a9bc8643c00b83",
  measurementId: "G-VR1W770TGD"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const $ = (id) => document.getElementById(id);
let currentUser = null;
let tasks = [];
let currentFilter = "all";
let unsubscribeTasks = null;
let isRegisterMode = false;

$("today").textContent = new Intl.DateTimeFormat("ru-RU", {day:"numeric",month:"long",year:"numeric"}).format(new Date());

$("toggleAuth").addEventListener("click", () => {
  isRegisterMode = !isRegisterMode;
  $("authTitle").textContent = isRegisterMode ? "Создание аккаунта" : "Вход в аккаунт";
  $("authSubmit").textContent = isRegisterMode ? "Зарегистрироваться" : "Войти";
  $("toggleAuth").textContent = isRegisterMode ? "Уже есть аккаунт? Войти" : "Нет аккаунта? Зарегистрироваться";
  $("passwordInput").autocomplete = isRegisterMode ? "new-password" : "current-password";
  $("authMessage").textContent = "";
});

$("authForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = $("emailInput").value.trim();
  const password = $("passwordInput").value;
  $("authSubmit").disabled = true;
  $("authMessage").textContent = "Подключаем аккаунт...";
  try {
    if (isRegisterMode) await createUserWithEmailAndPassword(auth, email, password);
    else await signInWithEmailAndPassword(auth, email, password);
    $("authForm").reset();
    $("authMessage").textContent = "";
  } catch (error) {
    $("authMessage").textContent = authErrorMessage(error.code);
  } finally {
    $("authSubmit").disabled = false;
  }
});

$("logoutBtn").addEventListener("click", async () => {
  try { await signOut(auth); }
  catch (error) { $("formMessage").textContent = "Не удалось выйти: " + error.message; }
});

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  $("authPanel").hidden = Boolean(user);
  $("planner").hidden = !user;
  if (unsubscribeTasks) { unsubscribeTasks(); unsubscribeTasks = null; }
  tasks = [];
  render();
  if (user) {
    $("userEmail").textContent = user.email || "Аккаунт Firebase";
    const tasksRef = collection(db, "users", user.uid, "tasks");
    unsubscribeTasks = onSnapshot(query(tasksRef, orderBy("createdAt", "desc")), (snapshot) => {
      tasks = snapshot.docs.map((item) => ({id:item.id, ...item.data()}));
      render();
    }, (error) => {
      $("formMessage").textContent = "Ошибка загрузки задач: " + error.message;
    });
  }
});

$("taskForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser) return;
  const title = $("taskInput").value.trim();
  if (!title) { $("formMessage").textContent = "Введите название задачи."; return; }
  try {
    await addDoc(collection(db, "users", currentUser.uid, "tasks"), {
      title, category: $("categoryInput").value, completed: false, createdAt: serverTimestamp()
    });
    $("taskInput").value = "";
    $("formMessage").textContent = "";
    $("taskInput").focus();
  } catch (error) { $("formMessage").textContent = "Не удалось добавить задачу: " + error.message; }
});

document.querySelectorAll(".filter-btn").forEach((button) => button.addEventListener("click", () => {
  currentFilter = button.dataset.filter;
  document.querySelectorAll(".filter-btn").forEach((item) => item.classList.toggle("active", item === button));
  render();
}));

async function toggleTask(id, completed) {
  if (!currentUser) return;
  try { await updateDoc(doc(db, "users", currentUser.uid, "tasks", id), {completed}); }
  catch (error) { $("formMessage").textContent = "Не удалось обновить задачу: " + error.message; }
}
async function deleteTask(id) {
  if (!currentUser) return;
  try { await deleteDoc(doc(db, "users", currentUser.uid, "tasks", id)); }
  catch (error) { $("formMessage").textContent = "Не удалось удалить задачу: " + error.message; }
}

function render() {
  const completed = tasks.filter((task) => task.completed).length;
  const total = tasks.length;
  const percent = total ? Math.round(completed / total * 100) : 0;
  $("totalCount").textContent = total;
  $("doneCount").textContent = completed;
  $("leftCount").textContent = total - completed;
  $("progressText").textContent = percent + "%";
  $("progressBar").style.width = percent + "%";
  const visible = tasks.filter((task) => currentFilter === "all" || (currentFilter === "active" ? !task.completed : task.completed));
  $("taskList").replaceChildren();
  $("emptyState").hidden = visible.length !== 0;
  visible.forEach((task) => {
    const item = document.createElement("article"); item.className = "task-item" + (task.completed ? " completed" : "");
    const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.className = "task-check"; checkbox.checked = Boolean(task.completed); checkbox.setAttribute("aria-label", "Отметить задачу выполненной"); checkbox.addEventListener("change", () => toggleTask(task.id, checkbox.checked));
    const info = document.createElement("div"); info.className = "task-info";
    const title = document.createElement("div"); title.className = "task-title"; title.textContent = task.title || "Без названия";
    const meta = document.createElement("div"); meta.className = "task-meta"; meta.textContent = task.completed ? "Выполнено" : "В работе"; info.append(title, meta);
    const category = document.createElement("span"); category.className = "category"; category.textContent = task.category || "Другое";
    const remove = document.createElement("button"); remove.className = "delete-btn"; remove.type = "button"; remove.textContent = "Удалить"; remove.setAttribute("aria-label", "Удалить задачу " + (task.title || "")); remove.addEventListener("click", () => deleteTask(task.id));
    item.append(checkbox, info, category, remove); $("taskList").append(item);
  });
}

function authErrorMessage(code) {
  const messages = {
    "auth/invalid-email":"Проверь адрес электронной почты.",
    "auth/user-not-found":"Аккаунт не найден. Возможно, сначала нужно зарегистрироваться.",
    "auth/wrong-password":"Неверный пароль.",
    "auth/invalid-credential":"Неверная почта или пароль.",
    "auth/email-already-in-use":"Этот адрес уже зарегистрирован. Попробуй войти.",
    "auth/weak-password":"Пароль должен содержать не менее 6 символов.",
    "auth/too-many-requests":"Слишком много попыток. Попробуй позже.",
    "auth/network-request-failed":"Проверь подключение к интернету."
  };
  return messages[code] || "Ошибка Firebase: " + code;
}
