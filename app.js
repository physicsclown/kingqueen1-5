// ===== 클라우드 저장소 (Firebase Firestore): 어느 기기에서 열어도 같은 내용이 보여요 =====
const EVAL_KEY = 'class_1_5_evals_v8';       // (예전 기기 저장 데이터를 옮길 때만 사용)
const SCHEDULE_KEY = 'class_1_5_schedules_v8';
const NEWS_KEY = 'class_1_5_news_v8';

if (typeof firebase === 'undefined' || typeof firebaseConfig === 'undefined' || !firebaseConfig.projectId) {
    alert('Firebase 설정이 안 되어 있어요. firebase-config.js 를 확인해 주세요.');
    throw new Error('firebase config missing');
}
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let evalsCache = [];
let schedulesCache = [];
let newsCache = [];
let booksCache = [];

const loaded = {
    evals: false,
    news: false,
    books: false
};

function getBooks() {
    return booksCache;
}

function getEvals() { return evalsCache; }
function getSchedules() { return schedulesCache; }
function getNews() { return newsCache; }

function byCreated(a, b) { return (a.createdAt || 0) - (b.createdAt || 0); }
function docsToList(snap) { return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort(byCreated); }
function cloudError(err) { console.error(err); alert('서버와 연결이 안 돼요: ' + err.message); }

// 다른 사람이 쓴 글이 화면을 망가뜨리지 않게 특수문자 처리
function esc(v) {
    return String(v === undefined || v === null ? '' : v).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

let currentDate = new Date();
let selectedDateStr = null; // 달력에서 클릭한 날짜 (YYYY-MM-DD)

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

// 이미지 읽기 + 압축 (문서 용량 제한 때문에 작게)
function compressImage(file, maxSize = 900, quality = 0.6) {
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

// 문서 1개 용량 제한(약 1MB) 확인
function tooBig(data) { return JSON.stringify(data).length > 900000; }

// 저장하는 동안 버튼을 잠그고, 15초 넘게 응답 없으면 안내
function runWithBusy(form, task) {
    const btn = form.querySelector('button[type="submit"]');
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = '저장 중...';
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('서버 응답이 없어요. 인터넷 연결을 확인해 주세요.')), 15000));
    return Promise.race([task(), timeout]).finally(() => {
        btn.disabled = false;
        btn.textContent = label;
    });
}

// 선택한 사진은 고르는 즉시 압축해서 보관 (한 장씩 여러 번 추가해도 쌓여요)
const selectedImages = {
    eval: [],
    news: [],
    book: []
};

const loadingCount = {
    eval: 0,
    news: 0,
    book: 0
};

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
setupImagePicker('book', 'book-image', 'book-image-preview');

// 1. 수행평가 등록
document.getElementById('eval-form').onsubmit = (e) => {
    e.preventDefault();
    const form = e.target;
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

    const data = { subject, title, date, tip, images: selectedImages.eval.slice(), createdAt: Date.now() };
    if (tooBig(data)) {
        alert('사진 용량이 너무 커요 😢 사진을 몇 장 줄여서 다시 등록해 주세요.');
        return;
    }

    runWithBusy(form, () => db.collection('evals').add(data)).then(() => {
        form.reset();
        selectedImages.eval = [];
        document.getElementById('eval-image-preview').innerHTML = '';
        dateInput.disabled = false;
        evalModal.classList.add('hidden');

        if (!isUnknown && date) {
            const addedDate = new Date(date);
            currentDate = new Date(addedDate.getFullYear(), addedDate.getMonth(), 1);
        }
        renderEvals();
    }).catch(err => alert('등록 중 오류가 났어요: ' + err.message));
};

// 2. 일반 일정 등록
document.getElementById('schedule-form').onsubmit = (e) => {
    e.preventDefault();
    const form = e.target;
    const title = document.getElementById('schedule-title').value;
    const date = document.getElementById('schedule-date').value;

    runWithBusy(form, () => db.collection('schedules').add({ title, date, createdAt: Date.now() })).then(() => {
        form.reset();
        scheduleModal.classList.add('hidden');

        if (date) {
            const addedDate = new Date(date);
            currentDate = new Date(addedDate.getFullYear(), addedDate.getMonth(), 1);
        }
        renderCalendar();
    }).catch(err => alert('등록 중 오류가 났어요: ' + err.message));
};

// 3. 기사 등록 (다중 사진 포함)
document.getElementById('news-form').onsubmit = (e) => {
    e.preventDefault();
    const form = e.target;
    if (loadingCount.news > 0) {
        alert('사진을 불러오는 중이에요. 잠깐 기다렸다가 다시 눌러 주세요!');
        return;
    }
    const author = document.getElementById('news-author').value;
    const headline = document.getElementById('news-headline').value;
    const content = document.getElementById('news-content').value;
    const date = new Date().toLocaleDateString();

    const data = { author, headline, content, images: selectedImages.news.slice(), date, createdAt: Date.now() };
    if (tooBig(data)) {
        alert('사진 용량이 너무 커요 😢 사진을 몇 장 줄여서 다시 발행해 주세요.');
        return;
    }

    runWithBusy(form, () => db.collection('news').add(data)).then(() => {
        form.reset();
        selectedImages.news = [];
        document.getElementById('news-image-preview').innerHTML = '';
        newsModal.classList.add('hidden');
        renderNews();
    }).catch(err => alert('등록 중 오류가 났어요: ' + err.message));
};

// 수행평가 렌더링
window.renderEvals = function() {
    const evals = getEvals().slice();
    const openIds = new Set(Array.from(document.querySelectorAll('.eval-details:not(.hidden)')).map(el => el.id));
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

    if (!loaded.evals) {
        listEl.innerHTML = '<p style="color:#888; text-align:center; padding:10px;">불러오는 중...</p>';
    } else {
        listEl.innerHTML = evals.length === 0 ? '<p style="color:#888; text-align:center; padding:10px;">등록된 수행평가가 없습니다.</p>' : '';
    }

    evals.forEach((item) => {
        const detailId = 'eval-detail-' + item.id;
        const div = document.createElement('div');
        div.className = 'eval-card';

        let galleryHtml = '';
        if (item.images && item.images.length > 0) {
            galleryHtml = `<div class="eval-gallery">` +
                item.images.map(img => `<img src="${esc(img)}" class="eval-img" alt="수행 공지 사진" data-zoom="1">`).join('') +
                `</div>`;
        } else {
            galleryHtml = '<p style="color:#aaa; font-size:12px;">첨부된 이미지 없음</p>';
        }

        div.innerHTML = `
            <div class="eval-header" onclick="toggleAccordion('${detailId}')">
                <span><strong>[${esc(item.subject)}]</strong> ${esc(item.title)} <span style="color:${item.date === '??' ? '#e74c3c' : '#3498db'};">(${esc(item.date)})</span></span>
                <span class="del-btn" onclick="deleteEval(event, '${item.id}')">삭제</span>
            </div>
            <div id="${detailId}" class="eval-details ${openIds.has(detailId) ? '' : 'hidden'}">
                ${galleryHtml}
                ${item.tip ? `<div class="tip-box">💡 <strong>꿀팁 (Tip):</strong> ${esc(item.tip)}</div>` : ''}
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
    const openIds = new Set(Array.from(document.querySelectorAll('.news-body:not(.hidden)')).map(el => el.id));
    if (!loaded.news) {
        listEl.innerHTML = '<p style="color:#888; text-align:center; padding:10px;">불러오는 중...</p>';
    } else {
        listEl.innerHTML = news.length === 0 ? '<p style="color:#888; text-align:center; padding:10px;">발행된 기사가 없습니다.</p>' : '';
    }

    news.forEach((item) => {
        const detailId = 'news-detail-' + item.id;
        const div = document.createElement('div');
        div.className = 'news-card';

        let galleryHtml = '';
        if (item.images && item.images.length > 0) {
            galleryHtml = `<div class="news-gallery">` +
                item.images.map(img => `<img src="${esc(img)}" class="news-img" alt="기사 사진" data-zoom="1">`).join('') +
                `</div>`;
        }

        div.innerHTML = `
            <div class="news-headline" onclick="toggleAccordion('${detailId}')">
                <h3>📰 ${esc(item.headline)}</h3>
                <span class="news-author">작성자: ${esc(item.author)} | ${esc(item.date)} <button class="del-btn" onclick="deleteNews(event, '${item.id}')">삭제</button></span>
            </div>
            <div id="${detailId}" class="news-body ${openIds.has(detailId) ? '' : 'hidden'}">
                <p>${esc(item.content).replace(/\n/g, '<br>')}</p>
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
        if (dateStr === selectedDateStr) dayEl.classList.add('selected');
        dayEl.onclick = () => {
            selectedDateStr = (selectedDateStr === dateStr) ? null : dateStr;
            renderCalendar();
            if (selectedDateStr) getDayDetailEl().scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        };

        const hasEval = evalDates.has(dateStr);
        const daySchedules = scheduleMap[dateStr] || [];

        let badgesHtml = '<div class="badge-container">';
        if (hasEval) badgesHtml += '<span class="dot blue" title="수행평가"></span>';
        if (daySchedules.length > 0) badgesHtml += '<span class="dot green" title="일반 일정"></span>';
        badgesHtml += '</div>';

        let titleTagHtml = '';
        if (daySchedules.length > 0) {
            titleTagHtml = `<div class="schedule-title-tag">${esc(daySchedules[0])}</div>`;
        }

        dayEl.innerHTML = `<span>${day}</span>${badgesHtml}${titleTagHtml}`;
        calendarEl.appendChild(dayEl);
    }

    renderDayDetail();
};

// 날짜 클릭 시 그 날의 수행평가 + 일정을 목록으로 보여주는 패널
function getDayDetailEl() {
    let el = document.getElementById('day-detail');
    if (!el) {
        el = document.createElement('div');
        el.id = 'day-detail';
        el.className = 'day-detail hidden';
        document.getElementById('calendar').insertAdjacentElement('afterend', el);
    }
    return el;
}

function makeEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
}

function renderDayDetail() {
    const el = getDayDetailEl();
    const prefix = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-`;
    if (!selectedDateStr || !selectedDateStr.startsWith(prefix)) {
        el.classList.add('hidden');
        return;
    }

    const dayEvals = getEvals().filter(e => e.date === selectedDateStr);
    const daySchedules = getSchedules().filter(s => s.date === selectedDateStr);
    const parts = selectedDateStr.split('-');

    el.innerHTML = '';
    el.classList.remove('hidden');

    const head = makeEl('div', 'day-detail-head');
    head.appendChild(makeEl('h3', '', `${Number(parts[1])}월 ${Number(parts[2])}일`));
    const closeBtn = makeEl('button', 'day-detail-close', '×');
    closeBtn.type = 'button';
    closeBtn.onclick = () => { selectedDateStr = null; renderCalendar(); };
    head.appendChild(closeBtn);
    el.appendChild(head);

    if (dayEvals.length === 0 && daySchedules.length === 0) {
        el.appendChild(makeEl('p', 'day-empty', '이 날은 등록된 수행평가나 일정이 없어요.'));
        return;
    }

    if (dayEvals.length > 0) {
        el.appendChild(makeEl('div', 'day-section-title', `📘 수행평가 (${dayEvals.length})`));
        dayEvals.forEach(item => {
            const box = makeEl('div', 'day-item');
            box.appendChild(makeEl('div', 'day-item-title', `[${item.subject}] ${item.title}`));
            if (item.tip) box.appendChild(makeEl('div', 'tip-box', `💡 꿀팁: ${item.tip}`));
            if (item.images && item.images.length > 0) {
                const gallery = makeEl('div', 'eval-gallery');
                item.images.forEach(src => {
                    const img = makeEl('img', 'eval-img');
                    img.src = src;
                    img.alt = '수행 공지 사진';
                    img.dataset.zoom = '1';
                    gallery.appendChild(img);
                });
                box.appendChild(gallery);
            }
            el.appendChild(box);
        });
    }

   if (daySchedules.length > 0) {
    el.appendChild(makeEl('div', 'day-section-title', `📅 일정 (${daySchedules.length})`));

    daySchedules.forEach(sc => {
        const box = makeEl('div', 'day-item day-schedule');

        const title = makeEl('span', '', sc.title);

        const delBtn = makeEl('button', 'del-btn', '삭제');
        delBtn.type = 'button';

      delBtn.onclick = () => window.deleteSchedule(sc.id);

        box.appendChild(title);
        box.appendChild(delBtn);

        el.appendChild(box);
    });
}
}

window.toggleAccordion = function(id) {
    const el = document.getElementById(id);
    el.classList.toggle('hidden');
};

window.deleteEval = function(e, id) {
    e.stopPropagation();
    if (!confirm('이 수행평가를 삭제할까요? (모두에게서 사라져요)')) return;
    db.collection('evals').doc(id).delete().catch(err => alert('삭제 실패: ' + err.message));
};

window.deleteNews = function(e, id) {
    e.stopPropagation();
    if (!confirm('이 기사를 삭제할까요? (모두에게서 사라져요)')) return;
    db.collection('news').doc(id).delete().catch(err => alert('삭제 실패: ' + err.message));
};
// 일반 일정 삭제
window.deleteSchedule = async function(id) {
    if (!confirm('이 일정을 삭제할까요? (모두에게서 사라져요)')) return;

    try {
        console.log('삭제 시도:', id);

        await db.collection('schedules').doc(id).delete();

        alert('일정이 삭제되었습니다!');
    } catch (err) {
        console.error('일정 삭제 오류:', err);
        alert('일정 삭제 실패!\n오류 내용: ' + err.message);
    }
};

document.getElementById('sort-select').addEventListener('change', renderEvals);

// 이 기기에 예전에 저장해 둔 데이터를 공유 저장소로 한 번 옮기기
async function migrateLocalData() {
    if (localStorage.getItem('class_1_5_migrate_declined')) return;
    let le = [], ls = [], ln = [];
    try {
        le = JSON.parse(localStorage.getItem(EVAL_KEY) || '[]');
        ls = JSON.parse(localStorage.getItem(SCHEDULE_KEY) || '[]');
        ln = JSON.parse(localStorage.getItem(NEWS_KEY) || '[]');
    } catch (err) { return; }
    const total = le.length + ls.length + ln.length;
    if (total === 0) return;
    if (!confirm('이 기기에 저장돼 있던 예전 데이터(' + total + '개)를 모두가 볼 수 있는 저장소로 올릴까요?')) {
        localStorage.setItem('class_1_5_migrate_declined', '1');
        return;
    }
    const now = Date.now();
    const jobs = [
        ...le.map((x, i) => db.collection('evals').add({ ...x, createdAt: now + i })),
        ...ls.map((x, i) => db.collection('schedules').add({ ...x, createdAt: now + i })),
        ...ln.map((x, i) => db.collection('news').add({ ...x, createdAt: now + i }))
    ];
    const results = await Promise.allSettled(jobs);
    const failed = results.filter(r => r.status === 'rejected').length;
    if (failed === 0) {
        localStorage.removeItem(EVAL_KEY);
        localStorage.removeItem(SCHEDULE_KEY);
        localStorage.removeItem(NEWS_KEY);
        alert('예전 데이터를 모두 올렸어요!');
    } else {
        alert(failed + '개는 올리지 못했어요 (사진 용량이 너무 클 수 있어요). 이 기기의 예전 데이터는 지우지 않았어요.');
    }
}

// ====================================
// 세현이의 책 소개
// ====================================

// 책 등록 폼 열기
document.getElementById('open-book-form-btn').onclick = () => {
    document.getElementById('book-form').classList.remove('hidden');
};

// 책 등록 폼 닫기
document.getElementById('cancel-book-form-btn').onclick = () => {
    document.getElementById('book-form').classList.add('hidden');
};

// 책 등록
document.getElementById('book-form').onsubmit = (e) => {
    e.preventDefault();

    const form = e.target;

    if (loadingCount.book > 0) {
        alert('사진을 불러오는 중이에요. 잠시 기다려 주세요!');
        return;
    }

    if (selectedImages.book.length === 0) {
        alert('책 표지 이미지를 추가해 주세요.');
        return;
    }

    const data = {
        title: document.getElementById('book-title').value,
        image: selectedImages.book[0],
        intro: document.getElementById('book-intro').value,
        recommendation: document.getElementById('book-recommendation').value,
        createdAt: Date.now()
    };

    if (tooBig(data)) {
        alert('이미지 용량이 너무 커요. 다른 사진을 선택해 주세요.');
        return;
    }

    runWithBusy(form, () =>
        db.collection('books').add(data)
    ).then(() => {
        form.reset();
        selectedImages.book = [];

        document.getElementById('book-image-preview').innerHTML = '';
        form.classList.add('hidden');

        renderBooks();
        alert('책이 등록되었습니다!');
    }).catch(err => {
        alert('책 등록 실패: ' + err.message);
    });
};


// 책 목록 렌더링
window.renderBooks = function() {
    const books = getBooks();
    const listEl = document.getElementById('book-list');

    // 현재 펼쳐진 책 기억
    const openIds = new Set(
        Array.from(
            document.querySelectorAll('.book-details:not(.hidden)')
        ).map(el => el.id)
    );

    if (!loaded.books) {
        listEl.innerHTML = '<p>책을 불러오는 중...</p>';
        return;
    }

    listEl.innerHTML = '';

    if (books.length === 0) {
        listEl.innerHTML = '<p class="book-empty">아직 등록된 책이 없습니다.</p>';
        return;
    }

    books.forEach(item => {
        const card = document.createElement('div');
        card.className = 'book-card';

        // 제목 부분
        const header = document.createElement('div');
        header.className = 'book-header';

        const title = document.createElement('span');
        title.textContent = '📖 ' + item.title;

        const arrow = document.createElement('span');
        arrow.className = 'book-arrow';
        arrow.textContent = openIds.has('book-detail-' + item.id) ? '▲' : '▼';

        header.appendChild(title);
        header.appendChild(arrow);

        // 상세 내용
        const detail = document.createElement('div');
        detail.id = 'book-detail-' + item.id;
        detail.className = 'book-details';

        if (!openIds.has(detail.id)) {
            detail.classList.add('hidden');
        }

        // 책 표지
        if (item.image) {
            const img = document.createElement('img');
            img.src = item.image;
            img.alt = item.title + ' 표지';
            img.className = 'book-cover';
            img.dataset.zoom = '1';
            detail.appendChild(img);
        }

        // 책 소개
        const introSection = document.createElement('div');
        introSection.className = 'book-text-section';

        const introTitle = document.createElement('h4');
        introTitle.textContent = '📚 책 소개';

        const introText = document.createElement('p');
        introText.textContent = item.intro || '';

        introSection.appendChild(introTitle);
        introSection.appendChild(introText);

        // 세현이의 추천글
        const recommendSection = document.createElement('div');
        recommendSection.className = 'book-text-section recommendation';

        const recommendTitle = document.createElement('h4');
        recommendTitle.textContent = '💬 세현이의 추천글';

        const recommendText = document.createElement('p');
        recommendText.textContent = item.recommendation || '';

        recommendSection.appendChild(recommendTitle);
        recommendSection.appendChild(recommendText);

        detail.appendChild(introSection);
        detail.appendChild(recommendSection);

        // 아코디언 작동
        header.onclick = () => {
            detail.classList.toggle('hidden');
            arrow.textContent = detail.classList.contains('hidden') ? '▼' : '▲';
        };

        card.appendChild(header);
        card.appendChild(detail);

        listEl.appendChild(card);
    });
};

// 실시간 동기화: 누군가 올리거나 지우면 모든 기기 화면이 바로 바뀌어요
renderEvals();
renderNews();

db.collection('evals').onSnapshot(snap => {
    evalsCache = docsToList(snap);
    loaded.evals = true;
    renderEvals();
}, cloudError);

db.collection('schedules').onSnapshot(snap => {
    schedulesCache = docsToList(snap);
    renderCalendar();
}, cloudError);

db.collection('news').onSnapshot(snap => {
    newsCache = docsToList(snap);
    loaded.news = true;
    renderNews();
}, cloudError);
// 책 목록 실시간 동기화
renderBooks();

db.collection('books').onSnapshot(snap => {
    booksCache = docsToList(snap);
    loaded.books = true;
    renderBooks();
}, cloudError);
setTimeout(migrateLocalData, 2500);
