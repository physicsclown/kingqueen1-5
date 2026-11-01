// LocalStorage Keys
const EVAL_KEY = 'class_1_5_evals_v2';
const NEWS_KEY = 'class_1_5_news_v2';

// 데이터 로드 / 저장
function getEvals() { return JSON.parse(localStorage.getItem(EVAL_KEY) || '[]'); }
function saveEvals(data) { localStorage.setItem(EVAL_KEY, JSON.stringify(data)); }
function getNews() { return JSON.parse(localStorage.getItem(NEWS_KEY) || '[]'); }
function saveNews(data) { localStorage.setItem(NEWS_KEY, JSON.stringify(data)); }

// 현재 달력의 연도와 월 상태 (기본값: 현재 날짜)
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

// 달력 월 이동 버튼
document.getElementById('prev-month-btn').onclick = () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
};

document.getElementById('next-month-btn').onclick = () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
};

// 수행평가 추가
document.getElementById('eval-form').onsubmit = (e) => {
    e.preventDefault();
    const subject = document.getElementById('eval-subject').value;
    const title = document.getElementById('eval-title').value;
    const date = document.getElementById('eval-date').value;
    const tip = document.getElementById('eval-tip').value;
    const imageInput = document.getElementById('eval-image');

    const saveAndClose = (imageData) => {
        const evals = getEvals();
        evals.push({ subject, title, date, tip, image: imageData });
        saveEvals(evals);

        document.getElementById('eval-form').reset();
        evalModal.classList.add('hidden');

        // 등록한 수행평가의 월로 달력 이동
        if (date) {
            const addedDate = new Date(date);
            currentDate = new Date(addedDate.getFullYear(), addedDate.getMonth(), 1);
        }

        renderEvals();
    };

    if (imageInput.files && imageInput.files[0]) {
        const reader = new FileReader();
        reader.onload = (event) => saveAndClose(event.target.result);
        reader.readAsDataURL(imageInput.files[0]);
    } else {
        saveAndClose(null);
    }
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

    if (sortType === 'date') evals.sort((a, b) => new Date(a.date) - new Date(b.date));
    else evals.sort((a, b) => a.subject.localeCompare(b.subject));

    listEl.innerHTML = evals.length === 0 ? '<p style="color:#888; text-align:center; padding:10px;">등록된 수행평가가 없습니다.</p>' : '';

    evals.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'eval-card';
        div.innerHTML = `
            <div class="eval-header" onclick="toggleAccordion('eval-detail-${index}')">
                <span><strong>[${item.subject}]</strong> ${item.title} (${item.date})</span>
                <span class="del-btn" onclick="deleteEval(event, ${index})">삭제</span>
            </div>
            <div id="eval-detail-${index}" class="eval-details hidden">
                ${item.image ? `<img src="${item.image}" class="eval-img" alt="수행평가 공지">` : '<p style="color:#aaa; font-size:12px;">첨부된 이미지 없음</p>'}
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

// 동적 달력 렌더링 (이전/다음 월 넘기기 지원)
function renderCalendar() {
    const calendarEl = document.getElementById('calendar');
    const calendarTitle = document.getElementById('calendar-title');
    calendarEl.innerHTML = '';

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // 제목 업데이트 (예: 2026년 12월, 2027년 1월)
    calendarTitle.innerText = `${year}년 ${month + 1}월`;

    // 해당 월의 첫 번째 날 및 마지막 날짜 계산
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();

    const evals = getEvals();
    const evalDates = new Set(evals.map(e => e.date));

    // 1일 이전의 빈 공간 채우기
    for (let i = 0; i < firstDay; i++) {
        const emptyEl = document.createElement('div');
        emptyEl.className = 'cal-day empty';
        calendarEl.appendChild(emptyEl);
    }

    // 날짜 박스 생성
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