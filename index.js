// ===== НАВИГАЦИЯ =====
function updateNav() {
    const actions = document.getElementById('navActions');
    if (!actions) return;
    if (state.user) {
        const initial = state.user.name.charAt(0).toUpperCase();
        actions.innerHTML = '<div class="user-badge" onclick="location.href=\'dashboard.html\'"><div class="user-avatar">' + initial + '</div><div class="user-name">' + state.user.name.split(' ')[0] + '</div></div>';
    } else {
        actions.innerHTML = '<button class="btn btn-ghost" onclick="openModal(\'loginModal\')">Войти</button><button class="btn btn-primary" onclick="openModal(\'registerModal\')">Регистрация</button>';
    }
}

// ===== UI ИНСТРУМЕНТА =====
function updateUI() {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const processBtn = document.getElementById('processBtn');
    const zipLock = document.getElementById('zipLock');
    const isPro = state.data && state.data.isPro;
    const free = state.data ? state.data.freeUsage : 2;

    if (zipLock) zipLock.style.display = isPro ? 'none' : 'inline';
    ['formatSetting','watermarkSetting','dpiSetting'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { const input = el.querySelector('select, input'); if (isPro) { el.classList.remove('disabled'); if (input) input.disabled = false; } else { el.classList.add('disabled'); if (input) input.disabled = true; } }
    });

    if (isPro) {
        if (statusDot) statusDot.classList.add('active');
        if (statusText) statusText.innerHTML = '<strong style="color:#10b981;">⭐ PRO</strong> — безлимит';
        if (processBtn) processBtn.disabled = state.selectedFiles.length === 0;
    } else {
        if (statusDot) statusDot.classList.remove('active');
        if (statusText) statusText.innerHTML = 'Бесплатно: <strong>' + free + '</strong> фото';
        if (processBtn) processBtn.disabled = state.selectedFiles.length === 0 || free <= 0;
    }
}

// ===== ЗАГРУЗКА ФАЙЛОВ =====
function setupUploadZone() {
    const zone = document.getElementById('uploadZone');
    const input = document.getElementById('fileInput');
    if (!zone || !input) return;
    zone.addEventListener('click', () => input.click());
    input.addEventListener('change', (e) => handleFiles(e.target.files));
}

function handleFiles(files) {
    const features = getFeatures();
    const all = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (all.length === 0) { alert('Выберите изображения'); return; }
    if (all.length > features.maxBatchSize) { alert('Максимум ' + features.maxBatchSize + ' фото'); state.selectedFiles = all.slice(0, features.maxBatchSize); }
    else state.selectedFiles = all;
    const zone = document.getElementById('uploadZone');
    zone.innerHTML = '<div class="upload-icon-big">✓</div><h3>Выбрано: ' + state.selectedFiles.length + '</h3><p>Нажмите "Обработать"</p>';
    updateUI();
}

// ===== ОБРАБОТКА =====
function setupProcessBtn() {
    const btn = document.getElementById('processBtn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
        if (state.selectedFiles.length === 0) return;
        const isPro = state.data.isPro;
        if (!isPro && state.data.freeUsage <= 0) { openPayment(); return; }
        btn.disabled = true; btn.textContent = 'Обработка...';
        document.getElementById('resultsArea').innerHTML = '';
        state.processedFiles = [];
        const settings = {
            marketplace: document.getElementById('marketplace').value,
            quality: document.getElementById('quality').value,
            maxSize: parseInt(document.getElementById('maxSize').value),
            outputFormat: isPro ? document.getElementById('outputFormat').value : 'jpg',
            watermark: isPro ? document.getElementById('watermarkText').value : ''
        };
        for (const file of state.selectedFiles) {
            const result = await processImage(file, settings);
            state.processedFiles.push(result);
            displayResult(result, state.processedFiles.length - 1);
            state.data.history.unshift({ name: file.name, date: new Date().toISOString(), originalSize: result.originalSize, optimizedSize: result.optimizedSize, thumbnail: result.optimizedData, data: result.optimizedData });
        }
        if (state.data.history.length > 50) state.data.history = state.data.history.slice(0, 50);
        if (!isPro) { state.data.freeUsage = Math.max(0, state.data.freeUsage - state.selectedFiles.length); }
        state.data.totalProcessed += state.selectedFiles.length;
        state.data.totalSaved += state.processedFiles.reduce((s, r) => s + (r.originalSize - r.optimizedSize), 0) / 1024 / 1024;
        saveUserData();
        btn.disabled = false; btn.textContent = 'Обработать фото';
        if (state.processedFiles.length > 1) document.getElementById('downloadAllBtn').style.display = 'block';
        updateUI();
    });
}

function displayResult(result, index) {
    const savings = ((1 - result.optimizedSize / result.originalSize) * 100).toFixed(1);
    const item = document.createElement('div');
    item.className = 'result-item';
    item.innerHTML = '<img src="' + result.optimizedData + '" class="result-preview"><div class="result-info"><h4>' + result.originalName + '</h4><div class="result-metrics"><div><div class="metric-label">Размер</div><div class="metric-value">' + (result.originalSize/1024).toFixed(1) + ' → ' + (result.optimizedSize/1024).toFixed(1) + ' КБ</div></div><div><div class="metric-label">Сжатие</div><div class="metric-value">-' + savings + '%</div></div><div><div class="metric-label">Формат</div><div class="metric-value dim">' + result.ext.toUpperCase() + '</div></div></div></div><button class="btn btn-primary" onclick="downloadFile(' + index + ')">Скачать</button>';
    document.getElementById('resultsArea').appendChild(item);
}

function downloadFile(index) {
    const r = state.processedFiles[index];
    const link = document.createElement('a');
    link.download = 'optimized_' + r.originalName.replace(/\.[^/.]+$/, '') + '.' + r.ext;
    link.href = r.optimizedData;
    link.click();
}

function setupDownloadAllBtn() {
    const btn = document.getElementById('downloadAllBtn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
        if (!state.data.isPro) { alert('ZIP только в PRO'); openPayment(); return; }
        const zip = new JSZip();
        state.processedFiles.forEach((r, i) => zip.file('optimized_' + r.originalName.replace(/\.[^/.]+$/, '') + '_' + (i+1) + '.' + r.ext, r.optimizedData.split(',')[1], { base64: true }));
        const content = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.download = 'photoboost_optimized.zip';
        link.href = URL.createObjectURL(content);
        link.click();
    });
}

// ===== ЗАПУСК =====
loadUserData();
checkOAuthReturn();
setupUploadZone();
setupProcessBtn();
setupDownloadAllBtn();
document.querySelectorAll('.modal-overlay').forEach(o => o.addEventListener('click', e => { if (e.target === o) { o.classList.remove('active'); document.body.style.overflow = ''; } }));
updateNav();
updateUI();
renderUserReviews();
