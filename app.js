// LocalStorage Keys
const EVAL_KEY = 'class_1_5_evals_v8';
const SCHEDULE_KEY = 'class_1_5_schedules_v8';
const NEWS_KEY = 'class_1_5_news_v8';

function getEvals() { return JSON.parse(localStorage.getItem(EVAL_KEY) || '[]'); }
function saveEvals(data) { localStorage.setItem(EVAL_KEY, JSON.stringify(data)); }

function getSchedules() { return JSON.parse(localStorage.getItem(SCHEDULE_KEY) || '[]'); }
function saveSchedules(data) { localStorage.setItem(SCHEDULE_KEY, JSON.stringify(data)); }

function getNews() { return JSON.parse(localStorage.getItem(NEWS_KEY) || '[]'); }
function saveNews(data) { localStorage.setItem(NEWS_KEY, JSON.stringify(data)); }

let currentDate = new Date();

// 모달 요소들
const evalModal = document.getElementById('eval-modal');
const scheduleModal = document.getElementById('schedule-modal');
const newsModal = document.getElementById('news-modal');
const imageZoomModal = document.getElementById('image-zoom-modal');
const zoomedImg = document.getElementById('zoomed-img');

// 모달 열기 버튼
document.getElementById('open-eval-modal-btn').onclick = () => evalModal.classList.remove('hidden');
document.getElementById('open-schedule-modal-btn').onclick = () => scheduleModal.classList.remove('hidden');
document.getElementById('open-news-modal-btn').onclick = () => newsModal.classList.remove('hidden');

// 모달 닫기 버튼 공통 처리
document.querySelectorAll('.close-modal-btn').forEach(btn => {
    btn.onclick = () => {
        evalModal.classList.add('hidden');
        scheduleModal.classList.add('hidden');
        newsModal.classList.add('hidden');
    };
});

// 모달 배경 클릭시 닫기
window.onclick = (e) => {
    if (e.target === evalModal) evalModal.classList.add('hidden');
    if (e.target === scheduleModal) scheduleModal.classList.add('hidden');
    if (e.target === newsModal) newsModal.classList.add('hidden');
    if (e.target === imageZoomModal) imageZoomModal.classList.add('hidden');
};

// 이미지 확대 모달 닫기
document.querySelector('.zoom-close-btn').onclick = () => {
    imageZoomModal.classList.add('hidden');
};

// 전역 함수로 이미지 줌 오픈 등록
window.openZoomModal = function(imgSrc) {
    zoomedImg.src = imgSrc;
    imageZoomModal.classList.remove('hidden');
};

document.addEventListener('click', (e) => {
    if (e.target.dataset && e.target.dataset.zoom) openZoomModal(e.target.src);
});

// 날짜 미정 체크박스 제어
const unknownCheckbox = document.getElementById('eval-date-unknown');
const dateInput = document.getElementById('eval-date');

unknownCheckbox.addEventListener('change', (e) => {
    if (e.target.checked) {
        dateInput.value = '';
        dateInput.disabled = true;
    } else {
        dateInput.disabled = false;
    }
});

// 이미지 읽기 + 압축 (localStorage 용량 초과 방지)
function compressImage(file, maxSize = 1000, quality = 0.7) {
    const job = new Promise((resolve) => {
        const reader = new FileReader();
        reader.onerror = () => resolve(null);
        reader.onload = (e) => {
            const img = new Image();
            img.onerror = () => resolve(null);
            img.onload = () => {
                try {
                    const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.round(img.width * scale);
                    canvas.height = Math.round(img.height * scale);
                    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL('image/jpeg', quality));
                } catch (err) { resolve(null); }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
    const timeout = new Promise(resolve => setTimeout(() => resolve(null), 20000));
    return Promise.race([job, timeout]);
}

// 저장 실패(용량 초과) 시 알림
function safeSave(saveFn, data) {
    try { saveFn(data); return true; }
    catch (err) {
        alert('저장 공간이 가득 찼어요 😢 사진 수를 줄이거나 예전 항목을 삭제해 주세요.');
        return false;
    }
}

// 선택한 사진은 고르는 즉시 압축해서 보관 (한 장씩 여러 번 추가해도 쌓여요)
const selectedImages = { eval: [], news: [] };
const loadingCount = { eval: 0, news: 0 };

function setupImagePicker(key, inputId, previewId) {
    const input = document.getElementById(inputId);
    input.addEventListener('change', async () => {
        const files = Array.from(input.files || []);
        if (files.length === 0) return;
        loadingCount[key] += files.length;
        renderPreview(key, previewId);

        let failed = 0;
        const results = await Promise.all(files.map(f => compressImage(f)));
        results.forEach(url => {
            if (url) selectedImages[key].push(url);
            else failed++;
        });
        loadingCount[key] -= files.length;
        input.value = '';
        renderPreview(key, previewId);
        if (failed > 0) alert(failed + '장은 불러오지 못했어요. 다른 사진으로 다시 시도해 주세요.');
    });
}

function renderPreview(key, previewId) {
    const container = document.getElementById(previewId);
    container.innerHTML = '';
    selectedImages[key].forEach((url, i) => {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'position:relative; flex:0 0 auto;';
        const img = document.createElement('img');
        img.className = 'preview-thumb';
        img.src = url;
        const del = document.createElement('button');
        del.type = 'button';
        del.textContent = '×';
        del.style.cssText = 'position:absolute; top:-6px; right:-6px; width:20px; height:20px; border-radius:50%; border:none; background:#e74c3c; color:#fff; font-size:14px; line-height:20px; padding:0; cursor:pointer;';
        del.onclick = () => {
            selectedImages[key].splice(i, 1);
            renderPreview(key, previewId);
        };
        wrap.appendChild(img);
        wrap.appendChild(del);
        container.appendChild(wrap);
    });
    const info = document.createElement('span');
    info.style.cssText = 'font-size:12px; color:#666; align-self:center; white-space:nowrap;';
    if (loadingCount[key] > 0) {
        info.textContent = '사진 불러오는 중...';
        container.appendChild(info);
    } else if (selectedImages[key].length > 0) {
        info.textContent = selectedImages[key].length + '장 선택됨';
        container.appendChild(info);
    }
}

setupImagePicker('eval', 'eval-images', 'eval-image-preview');
setupImagePicker('news', 'news-images', 'news-image-preview');

// 1. 수행평가 등록
document.getElementById('eval-form').onsubmit = (e) => {
    e.preventDefault();
    try {
        if (loadingCount.eval > 0) {
            alert('사진을 불러오는 중이에요. 잠깐 기다렸다가 다시 눌러 주세요!');
            return;
        }
        const subject = document.getElementById('eval-subject').value;
        const title = document.getElementById('eval-title').value;
        const isUnknown = unknownCheckbox.checked;
        const date = isUnknown ? '??' : dateInput.value;
        const tip = document.getElementById('eval-tip').value;

        if (!isUnknown && !dateInput.value) {
            alert('날짜를 지정하거나 [날짜 미정(??)]을 체크해 주세요.');
            return;
        }

        const images = selectedImages.eval.slice();
        const evals = getEvals();
        evals.push({ subject, title, date, tip, images });
        if (!safeSave(saveEvals, evals)) return;

        document.getElementById('eval-form').reset();
        selectedImages.eval = [];
        document.getElementById('eval-image-preview').innerHTML = '';
        dateInput.disabled = false;
        evalModal.classList.add('hidden');

        if (!isUnknown && date) {
            const addedDate = new Date(date);
            currentDate = new Date(addedDate.getFullYear(), addedDate.getMonth(), 1);
        }

        renderEvals();
    } catch (err) {
        alert('등록 중 오류가 났어요: ' + err.message);
    }
};

// 2. 일반 일정 등록
document.getElementById('schedule-form').onsubmit = (e) => {
    e.preventDefault();
    const title = document.getElementById('schedule-title').value;
    const date = document.getElementById('schedule-date').value;

    const schedules = getSchedules();
    schedules.push({ title, date });
    saveSchedules(schedules);

    document.getElementById('schedule-form').reset();
    scheduleModal.classList.add('hidden');

    if (date) {
        const addedDate = new Date(date);
        currentDate = new Date(addedDate.getFullYear(), addedDate.getMonth(), 1);
    }

    renderCalendar();
};

// 3. 기사 등록 (다중 사진 포함)
document.getElementById('news-form').onsubmit = (e) => {
    e.preventDefault();
    try {
        if (loadingCount.news > 0) {
            alert('사진을 불러오는 중이에요. 잠깐 기다렸다가 다시 눌러 주세요!');
            return;
        }
        const author = document.getElementById('news-author').value;
        const headline = document.getElementById('news-headline').value;
        const content = document.getElementById('news-content').value;
        const date = new Date().toLocaleDateString();

        const images = selectedImages.news.slice();
        const news = getNews();
        news.push({ author, headline, content, images, date });
        if (!safeSave(saveNews, news)) return;

        document.getElementById('news-form').reset();
        selectedImages.news = [];
        document.getElementById('news-image-preview').innerHTML = '';
        newsModal.classList.add('hidden');
        renderNews();
    } catch (err) {
        alert('등록 중 오류가 났어요: ' + err.message);
    }
};

// 수행평가 렌더링
window.renderEvals = function() {
    const evals = getEvals().map((e, i) => ({ ...e, _i: i }));
    const sortType = document.getElementById('sort-select').value;
    const listEl = document.getElementById('eval-list');

    if (sortType === 'date') {
        evals.sort((a, b) => {
            if (a.date === '??') return 1;
            if (b.date === '??') return -1;
            return new Date(a.date) - new Date(b.date);
        });
    } else {
        evals.sort((a, b) => a.subject.localeCompare(b.subject));
    }

    listEl.innerHTML = evals.length === 0 ? '<p style="color:#888; text-align:center; padding:10px;">등록된 수행평가가 없습니다.</p>' : '';

    evals.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'eval-card';

        let galleryHtml = '';
        if (item.images && item.images.length > 0) {
            galleryHtml = `<div class="eval-gallery">` +
                item.images.map(img => `<img src="${img}" class="eval-img" alt="수행 공지 사진" data-zoom="1">`).join('') +
                `</div>`;
        } else {
            galleryHtml = '<p style="color:#aaa; font-size:12px;">첨부된 이미지 없음</p>';
        }

        div.innerHTML = `
            <div class="eval-header" onclick="toggleAccordion('eval-detail-${index}')">
                <span><strong>[${item.subject}]</strong> ${item.title} <span style="color:${item.date === '??' ? '#e74c3c' : '#3498db'};">(${item.date})</span></span>
                <span class="del-btn" onclick="deleteEval(event, ${item._i})">삭제</span>
            </div>
            <div id="eval-detail-${index}" class="eval-details hidden">
                ${galleryHtml}
                ${item.tip ? `<div class="tip-box">💡 <strong>꿀팁 (Tip):</strong> ${item.tip}</div>` : ''}
            </div>
        `;
        listEl.appendChild(div);
    });

    renderCalendar();
};

// 기사 렌더링 (다중 이미지 포함)
window.renderNews = function() {
    const news = getNews();
    const listEl = document.getElementById('news-list');
    listEl.innerHTML = news.length === 0 ? '<p style="color:#888; text-align:center; padding:10px;">발행된 기사가 없습니다.</p>' : '';

    news.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'news-card';

        let galleryHtml = '';
        if (item.images && item.images.length > 0) {
            galleryHtml = `<div class="news-gallery">` +
                item.images.map(img => `<img src="${img}" class="news-img" alt="기사 사진" data-zoom="1">`).join('') +
                `</div>`;
        }

        div.innerHTML = `
            <div class="news-headline" onclick="toggleAccordion('news-detail-${index}')">
                <h3>📰 ${item.headline}</h3>
                <span class="news-author">작성자: ${item.author} | ${item.date} <button class="del-btn" onclick="deleteNews(event, ${index})">삭제</button></span>
            </div>
            <div id="news-detail-${index}" class="news-body hidden">
                <p>${item.content.replace(/\n/g, '<br>')}</p>
                ${galleryHtml}
            </div>
        `;
        listEl.appendChild(div);
    });
};

document.getElementById('prev-month-btn').onclick = () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
};

document.getElementById('next-month-btn').onclick = () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
};

window.renderCalendar = function() {
    const calendarEl = document.getElementById('calendar');
    const calendarTitle = document.getElementById('calendar-title');
    calendarEl.innerHTML = '';

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    calendarTitle.innerText = `${year}년 ${month + 1}월`;

    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();

    const evals = getEvals();
    const schedules = getSchedules();

    const evalDates = new Set(evals.map(e => e.date));
    const scheduleMap = {};
    schedules.forEach(s => {
        if (!scheduleMap[s.date]) scheduleMap[s.date] = [];
        scheduleMap[s.date].push(s.title);
    });

    for (let i = 0; i < firstDay; i++) {
        const emptyEl = document.createElement('div');
        emptyEl.className = 'cal-day empty';
        calendarEl.appendChild(emptyEl);
    }

    for (let day = 1; day <= lastDate; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayEl = document.createElement('div');
        dayEl.className = 'cal-day';

        const hasEval = evalDates.has(dateStr);
        const daySchedules = scheduleMap[dateStr] || [];

        let badgesHtml = '<div class="badge-container">';
        if (hasEval) badgesHtml += '<span class="dot blue" title="수행평가"></span>';
        if (daySchedules.length > 0) badgesHtml += '<span class="dot green" title="일반 일정"></span>';
        badgesHtml += '</div>';

        let titleTagHtml = '';
        if (daySchedules.length > 0) {
            titleTagHtml = `<div class="schedule-title-tag">${daySchedules[0]}</div>`;
        }

        dayEl.innerHTML = `<span>${day}</span>${badgesHtml}${titleTagHtml}`;
        calendarEl.appendChild(dayEl);
    }
};

window.toggleAccordion = function(id) {
    const el = document.getElementById(id);
    el.classList.toggle('hidden');
};

window.deleteEval = function(e, index) {
    e.stopPropagation();
    const evals = getEvals();
    evals.splice(index, 1);
    saveEvals(evals);
    renderEvals();
};

window.deleteNews = function(e, index) {
    e.stopPropagation();
    const news = getNews();
    news.splice(index, 1);
    saveNews(news);
    renderNews();
};

document.getElementById('sort-select').addEventListener('change', renderEvals);

renderEvals();
renderNews();
