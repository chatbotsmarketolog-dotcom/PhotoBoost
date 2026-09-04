// ===== КОНФИГ OAUTH =====
// ВСТАВЬ СЮДА СВОИ client_id ПОСЛЕ РЕГИСТРАЦИИ ПРИЛОЖЕНИЙ (инструкция ниже)
const OAUTH_CONFIG = {
    yandex: { clientId: '', name: 'Яндекс' },
    google: { clientId: '', name: 'Google' },
    vk:     { clientId: '', name: 'ВКонтакте' }
};

// ===== СОСТОЯНИЕ =====
let state = {
    user: JSON.parse(localStorage.getItem('pbUser')) || null,
    data: null,
    selectedFiles: [],
    processedFiles: [],
    reviewPhoto: null,
    reviewRating: 5
};

const PRO_FEATURES = { maxBatchSize: 100, advancedSettings: true, watermark: true, outputFormats: ['jpg','png','webp'] };
const FREE_FEATURES = { maxBatchSize: 1, advancedSettings: false, watermark: false, outputFormats: ['jpg'] };
function getFeatures() { return (state.data && state.data.isPro) ? PRO_FEATURES : FREE_FEATURES; }

// ===== ДАННЫЕ ПОЛЬЗОВАТЕЛЯ (привязаны к email — новый аккаунт = чистая история) =====
function dataKey() { return 'pbData_' + (state.user ? state.user.email : 'guest'); }

function loadUserData() {
    const def = { history: [], freeUsage: 2, totalProcessed: 0, totalSaved: 0, isPro: false, proExpiry: null, paidClicked: false, usedCodes: [] };
    const raw = JSON.parse(localStorage.getItem(dataKey()) || 'null');
    state.data = Object.assign(def, raw || {});
    // Проверка истечения PRO
    if (state.data.proExpiry && new Date(state.data.proExpiry) < new Date()) {
        state.data.isPro = false;
        saveUserData();
    }
}

function saveUserData() {
    if (state.data) localStorage.setItem(dataKey(), JSON.stringify(state.data));
}

// ===== БАЗОВЫЕ ФУНКЦИИ =====
function scrollToSection(id) {
    const el = document.getElementById(id);
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.pageYOffset - 80, behavior: 'smooth' });
}

function openModal(id) { const m = document.getElementById(id); if (m) { m.classList.add('active'); document.body.style.overflow = 'hidden'; } }
function closeModal(id) { const m = document.getElementById(id); if (m) { m.classList.remove('active'); document.body.style.overflow = ''; } }
function switchModal(from, to) { closeModal(from); setTimeout(() => openModal(to), 200); }
function toggleFaq(el) { const item = el.parentElement; const was = item.classList.contains('active'); document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('active')); if (!was) item.classList.add('active'); }
function formatDate(d) { if (!d) return '—'; return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }); }

// ===== OAUTH =====
function oauthLogin(provider) {
    const cfg = OAUTH_CONFIG[provider];
    if (!cfg.clientId) {
        alert('Вход через ' + cfg.name + ' сейчас подключается.\n\nПожалуйста, используйте регистрацию через email — это займёт 10 секунд.');
        return;
    }
    const redirect = encodeURIComponent(location.origin + location.pathname);
    let url = '';
    if (provider === 'yandex') url = 'https://oauth.yandex.ru/authorize?response_type=token&client_id=' + cfg.clientId + '&redirect_uri=' + redirect + '&state=' + provider;
    if (provider === 'vk') url = 'https://oauth.vk.com/authorize?client_id=' + cfg.clientId + '&display=page&redirect_uri=' + redirect + '&response_type=token&scope=email&state=' + provider;
    if (provider === 'google') url = 'https://accounts.google.com/o/oauth2/auth?response_type=token&client_id=' + cfg.clientId + '&redirect_uri=' + redirect + '&scope=email%20profile&state=' + provider;
    location.href = url;
}

// Проверка возврата с OAuth (вызывается при загрузке страницы)
function checkOAuthReturn() {
    const hash = location.hash.replace('#', '');
    if (!hash) return;
    const params = new URLSearchParams(hash);
    const token = params.get('access_token');
    const provider = params.get('state');
    if (!token || !provider) return;
    history.replaceState(null, '', location.pathname); // чистим URL

    fetchUserInfo(provider, token).then(info => {
        if (!info.email) { alert('Не удалось получить email от провайдера'); return; }
        oauthCreateOrLogin(info.email, info.name);
    }).catch(() => alert('Ошибка входа через ' + provider));
}

function fetchUserInfo(provider, token) {
    if (provider === 'yandex') {
        return fetch('https://login.yandex.ru/info?format=json&oauth_token=' + token).then(r => r.json()).then(j => ({ email: j.default_email, name: j.display_name || j.real_name || 'Пользователь' }));
    }
    if (provider === 'google') {
        return fetch('https://www.googleapis.com/oauth2/v3/userinfo?access_token=' + token).then(r => r.json()).then(j => ({ email: j.email, name: j.name || 'Пользователь' }));
    }
    if (provider === 'vk') {
        return fetch('https://api.vk.com/method/users.get?access_token=' + token + '&v=5.131').then(r => r.json()).then(j => {
            const u = j.response && j.response[0];
            return { email: (j.email) || ((u && u.id) ? 'vk_' + u.id + '@vk.com' : null), name: u ? (u.first_name + ' ' + u.last_name) : 'Пользователь ВК' };
        });
    }
    return Promise.reject();
}

function oauthCreateOrLogin(email, name) {
    const users = JSON.parse(localStorage.getItem('pbUsers') || '[]');
    let user = users.find(u => u.email === email);
    if (!user) {
        user = { name: name, email: email, password: '', registeredAt: new Date().toISOString(), oauth: true };
        users.push(user);
        localStorage.setItem('pbUsers', JSON.stringify(users));
    }
    state.user = user;
    localStorage.setItem('pbUser', JSON.stringify(user));
    loadUserData();
    alert('✅ Добро пожаловать, ' + user.name + '!');
    if (typeof updateNav === 'function') updateNav();
    if (typeof updateUI === 'function') updateUI();
}

// ===== РЕГИСТРАЦИЯ / ВХОД / ВЫХОД =====
function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const users = JSON.parse(localStorage.getItem('pbUsers') || '[]');
    if (users.find(u => u.email === email)) { alert('Пользователь уже существует'); return; }
    const newUser = { name: name, email: email, password: password, registeredAt: new Date().toISOString() };
    users.push(newUser);
    localStorage.setItem('pbUsers', JSON.stringify(users));
    localStorage.setItem('pbUser', JSON.stringify(newUser));
    state.user = newUser;
    // НОВЫЙ АККАУНТ = ЧИСТАЯ ИСТОРИЯ (создаём пустой профиль)
    state.data = { history: [], freeUsage: 2, totalProcessed: 0, totalSaved: 0, isPro: false, proExpiry: null, paidClicked: false, usedCodes: [] };
    saveUserData();
    closeModal('registerModal');
    if (typeof updateNav === 'function') updateNav();
    if (typeof updateUI === 'function') updateUI();
    alert('✅ Аккаунт создан! Добро пожаловать, ' + name + '!');
}

function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const users = JSON.parse(localStorage.getItem('pbUsers') || '[]');
    const user = users.find(u => u.email === email && u.password === password);
    if (user) {
        state.user = user;
        localStorage.setItem('pbUser', JSON.stringify(user));
        loadUserData(); // загружаем данные именно этого пользователя
        closeModal('loginModal');
        if (typeof updateNav === 'function') updateNav();
        if (typeof updateUI === 'function') updateUI();
    } else {
        alert('Неверный email или пароль');
    }
}

function handleLogout() {
    if (confirm('Выйти?')) {
        state.user = null;
        localStorage.removeItem('pbUser');
        loadUserData(); // гостевой профиль
        if (typeof updateNav === 'function') updateNav();
        if (typeof updateUI === 'function') updateUI();
        if (typeof closeModal === 'function') closeModal('dashboardModal');
        if (location.pathname.includes('dashboard')) location.href = 'index.html';
    }
}

function handleResetStep1(e) {
    e.preventDefault();
    const email = document.getElementById('resetEmail').value;
    const users = JSON.parse(localStorage.getItem('pbUsers') || '[]');
    if (users.find(u => u.email === email)) {
        document.getElementById('resetStep1').style.display = 'none';
        document.getElementById('resetStep2').style.display = 'block';
    } else alert('Пользователь не найден');
}

function handleResetStep2(e) {
    e.preventDefault();
    const p1 = document.getElementById('newPassword').value;
    const p2 = document.getElementById('confirmPassword').value;
    if (p1 !== p2) { alert('Пароли не совпадают'); return; }
    const email = document.getElementById('resetEmail').value;
    const users = JSON.parse(localStorage.getItem('pbUsers') || '[]');
    const user = users.find(u => u.email === email);
    if (user) { user.password = p1; localStorage.setItem('pbUsers', JSON.stringify(users)); }
    alert('Пароль изменён!');
    closeModal('resetModal');
}

// ===== ОПЛАТА =====
function openPayment() {
    if (!state.user) { alert('Зарегистрируйтесь, чтобы купить PRO'); openModal('registerModal'); return; }
    // восстанавливаем состояние кнопки
    const paidBtn = document.getElementById('paidBtn');
    const contacts = document.getElementById('paymentContacts');
    if (state.data.paidClicked) { paidBtn.style.display = 'none'; contacts.style.display = 'block'; }
    else { paidBtn.style.display = 'block'; contacts.style.display = 'none'; }
    openModal('paymentModal');
}

function markPaid() {
    state.data.paidClicked = true;
    saveUserData();
    document.getElementById('paidBtn').style.display = 'none';
    document.getElementById('paymentContacts').style.display = 'block';
    if (typeof renderSubscription === 'function') renderSubscription();
}

// ===== АКТИВАЦИЯ ПО КОДУ =====
function activateByCode() {
    const input = document.getElementById('activationCodeInput');
    if (!input) return;
    const code = input.value.trim().toUpperCase();
    if (!/^WB-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) { alert('❌ Неверный формат. Пример: WB-A1B2-C3D4'); return; }

    const valid = JSON.parse(localStorage.getItem('pbValidCodes') || '[]');
    if (valid.length > 0) {
        if (!valid.includes(code)) { alert('❌ Код не найден. Напишите в поддержку.'); return; }
        localStorage.setItem('pbValidCodes', JSON.stringify(valid.filter(c => c !== code)));
    }
    if (state.data.usedCodes.includes(code)) { alert('❌ Этот код уже был использован'); return; }

    state.data.usedCodes.push(code);
    state.data.isPro = true;
    const exp = new Date(); exp.setMonth(exp.getMonth() + 1);
    state.data.proExpiry = exp.toISOString();
    saveUserData();
    input.value = '';
    if (typeof updateUI === 'function') updateUI();
    if (typeof renderSubscription === 'function') renderSubscription();
    alert('🎉 PRO активирована до ' + formatDate(state.data.proExpiry) + '!');
}

// ===== ОБРАБОТКА ИЗОБРАЖЕНИЙ =====
function processImage(file, settings) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
                let tW = 900, tH = 1200;
                if (settings.marketplace === 'avito') { tW = 1200; tH = 900; }
                const canvas = document.getElementById('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = tW; canvas.height = tH;
                const scale = Math.max(tW / img.width, tH / img.height);
                ctx.drawImage(img, (tW/2)-(img.width/2)*scale, (tH/2)-(img.height/2)*scale, img.width*scale, img.height*scale);
                if (settings.watermark) { ctx.font = 'bold 24px Arial'; ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText(settings.watermark, tW-20, tH-20); }
                let q = settings.quality === 'high' ? 0.9 : settings.quality === 'low' ? 0.5 : 0.7;
                let mime = 'image/jpeg', ext = 'jpg';
                if (settings.outputFormat === 'png') { mime = 'image/png'; ext = 'png'; }
                else if (settings.outputFormat === 'webp') { mime = 'image/webp'; ext = 'webp'; }
                let url = canvas.toDataURL(mime, q);
                let size = url.length * 0.75;
                while (size > settings.maxSize * 1024 && q > 0.1 && ext !== 'png') { q -= 0.05; url = canvas.toDataURL(mime, q); size = url.length * 0.75; }
                resolve({ originalName: file.name, originalSize: file.size, optimizedData: url, optimizedSize: size, width: tW, height: tH, ext: ext });
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// ===== ОТЗЫВЫ =====
function getUserReviews() { return JSON.parse(localStorage.getItem('pbUserReviews') || '[]'); }
function renderUserReviews() {
    const c = document.getElementById('userReviewsContainer');
    if (!c) return;
    const reviews = getUserReviews();
    if (reviews.length === 0) { c.innerHTML = ''; return; }
    c.innerHTML = reviews.map(r => {
        const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
        return '<div class="testimonial-card"><div class="stars">' + stars + '</div><p class="testimonial-text">' + r.text + '</p><div class="testimonial-author"><div class="testimonial-author-photo" style="background: var(--gradient-purple); display:flex; align-items:center; justify-content:center; color:white; font-weight:700;">' + r.name.charAt(0).toUpperCase() + '</div><div class="testimonial-author-info"><h4>' + r.name + '</h4><p>' + (r.position || 'Пользователь') + '</p></div></div></div>';
    }).join('');
}
