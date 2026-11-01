// LocalStorage Keys
const EVAL_KEY = 'class_1_5_evals_v5';
const NEWS_KEY = 'class_1_5_news_v5';

// 데이터 로드 / 저장
function getEvals() { return JSON.parse(localStorage.getItem(EVAL_KEY) || '[]'); }
function saveEvals(data) { localStorage.setItem(EVAL_KEY, JSON.stringify(data)); }
function getNews() { return JSON.parse(localStorage.getItem(NEWS_KEY) || '[]'); }
function saveNews(data) { localStorage.setItem(NEWS_KEY, JSON.stringify(data)); }

// 현재 달력의 연도와 월 상태
let currentDate = new Date();

// 모달 다루기
const evalModal = document.getElementById('eval-modal');
const newsModal = document.getElementById('news-modal');

document.getElementById('open-eval-modal-btn').onclick = () => evalModal.classList.remove('hidden');
document.getElementById('open-news-modal-btn').onclick = () => newsModal.classList.remove('hidden');

document.querySelectorAll('.close-modal-btn').forEach(btn => {
    btn.onclick = () => {
        evalModal.classList.add('hidden');
        newsModal.classList.add('hidden');
    };
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

// 달력 월 이동 버튼
document.getElementById('prev-month-btn').onclick = () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
};

document.getElementById('next-month-btn').onclick = () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
};

// 수행평가 추가 (다중 이미지 및 미정 날짜 지원)
document.getElementById('eval-form').onsubmit = (e) => {
    e.preventDefault();
    const subject = document.getElementById('eval-subject').value;
    const title = document.getElementById('eval-title').value;
    const isUnknown = unknownCheckbox.checked;
    const date = isUnknown ? '??' : dateInput.value;
    const tip = document.getElementById('eval-tip').value;
    const imageInput = document.getElementById('eval-images');

    if (!isUnknown && !dateInput.value) {
        alert('날짜를 지정하거나 [날짜 미정(??)]을 체크해 주세요.');
        return;
    }

    const files = Array.from(imageInput.files || []);
    const imagePromises = files.map(file => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target.result);
            reader.readAsDataURL(file);
        });
    });

    Promise.all(imagePromises).then(images => {
        const evals = getEvals();
        evals.push({ subject, title, date, tip, images });
        saveEvals(evals);

        document.getElementById('eval-form').reset();
        dateInput.disabled = false;
        evalModal.classList.add('hidden');

        if (!isUnknown && date) {
            const addedDate = new Date(date);
            currentDate = new Date(addedDate.getFullYear(), addedDate.getMonth(), 1);
        }

        renderEvals();
    });
};

// 기사 추가
document.getElementById('news-form').onsubmit = (e) => {
    e.preventDefault();
    const author = document.getElementById('news-author').value;
    const headline = document.getElementById('news-headline').value;
    const content = document.getElementById('news-content').value;
    const date = new Date().toLocaleDateString();

    const news = getNews();
    news.push({ author, headline, content, date });
    saveNews(news);

    document.getElementById('news-form').reset();
    newsModal.classList.add('hidden');
    renderNews();
};

// 수행평가 렌더링
function renderEvals() {
    const evals = getEvals();
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
                item.images.map(img => `<img src="${img}" class="eval-img" alt="공지 사진">`).join('') + 
                `</div>`;
        } else {
            galleryHtml = '<p style="color:#aaa; font-size:12px;">첨부된 이미지 없음</p>';
        }

        div.innerHTML = `
            <div class="eval-header" onclick="toggleAccordion('eval-detail-${index}')">
                <span><strong>[${item.subject}]</strong> ${item.title} <span style="color:${item.date === '??' ? '#e74c3c' : '#3498db'};">(${item.date})</span></span>
                <span class="del-btn" onclick="deleteEval(event, ${index})">삭제</span>
            </div>
            <div id="eval-detail-${index}" class="eval-details hidden">
                ${galleryHtml}
                ${item.tip ? `<div class="tip-box">💡 <strong>꿀팁 (Tip):</strong> ${item.tip}</div>` : ''}
            </div>
        `;
        listEl.appendChild(div);
    });

    renderCalendar();
}

// 기사 렌더링
function renderNews() {
    const news = getNews();
    const listEl = document.getElementById('news-list');
    listEl.innerHTML = news.length === 0 ? '<p style="color:#888; text-align:center; padding:10px;">발행된 기사가 없습니다.</p>' : '';

    news.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'news-card';
        div.innerHTML = `
            <div class="news-headline" onclick="toggleAccordion('news-detail-${index}')">
                <h3>📰 ${item.headline}</h3>
                <span class="news-author">작성자: ${item.author} | ${item.date} <button class="del-btn" onclick="deleteNews(event, ${index})">삭제</button></span>
            </div>
            <div id="news-detail-${index}" class="news-body hidden">
                <p>${item.content.replace(/\n/g, '<br>')}</p>
            </div>
        `;
        listEl.appendChild(div);
    });
}

// 달력 렌더링
function renderCalendar() {
    const calendarEl = document.getElementById('calendar');
    const calendarTitle = document.getElementById('calendar-title');
    calendarEl.innerHTML = '';

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    calendarTitle.innerText = `${year}년 ${month + 1}월`;

    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();

    const evals = getEvals();
    const evalDates = new Set(evals.map(e => e.date));

    for (let i = 0; i < firstDay; i++) {
        const emptyEl = document.createElement('div');
        emptyEl.className = 'cal-day empty';
        calendarEl.appendChild(emptyEl);
    }

    for (let day = 1; day <= lastDate; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayEl = document.createElement('div');
        dayEl.className = 'cal-day' + (evalDates.has(dateStr) ? ' has-eval' : '');
        dayEl.innerText = day;
        calendarEl.appendChild(dayEl);
    }
}

// 아코디언 토글
function toggleAccordion(id) {
    const el = document.getElementById(id);
    el.classList.toggle('hidden');
}

function deleteEval(e, index) {
    e.stopPropagation();
    const evals = getEvals();
    evals.splice(index, 1);
    saveEvals(evals);
    renderEvals();
}

function deleteNews(e, index) {
    e.stopPropagation();
    const news = getNews();
    news.splice(index, 1);
    saveNews(news);
    renderNews();
}

document.getElementById('sort-select').addEventListener('change', renderEvals);

// 초기 실행
renderEvals();
renderNews();