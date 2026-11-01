// LocalStorage Keys
const EVAL_KEY = 'class_1_5_evals';
const NEWS_KEY = 'class_1_5_news';

// 데이터 로드
function getEvals() {
    return JSON.parse(localStorage.getItem(EVAL_KEY) || '[]');
}

function saveEvals(data) {
    localStorage.setItem(EVAL_KEY, JSON.stringify(data));
}

function getNews() {
    return JSON.parse(localStorage.getItem(NEWS_KEY) || '[]');
}

function saveNews(data) {
    localStorage.setItem(NEWS_KEY, JSON.stringify(data));
}

// 렌더링 함수들
function renderEvals() {
    const evals = getEvals();
    const sortType = document.getElementById('sort-select').value;
    const listEl = document.getElementById('eval-list');

    if (sortType === 'date') {
        evals.sort((a, b) => new Date(a.date) - new Date(b.date));
    } else {
        evals.sort((a, b) => a.subject.localeCompare(b.subject));
    }

    listEl.innerHTML = evals.length === 0 ? '<li style="color:#888;">등록된 수행평가가 없습니다.</li>' : '';

    evals.forEach((item, index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span><strong>[${item.subject}]</strong> ${item.title} (${item.date})</span>
            <button class="del-btn" onclick="deleteEval(${index})">삭제</button>
        `;
        listEl.appendChild(li);
    });

    renderCalendar();
}

function renderCalendar() {
    const calendarEl = document.getElementById('calendar');
    calendarEl.innerHTML = '';

    const evals = getEvals();
    const evalDates = new Set(evals.map(e => e.date));

    // 간단한 11월 기준 30일 달력 생성 (예시)
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;

    for (let day = 1; day <= 30; day++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayEl = document.createElement('div');
        dayEl.className = 'cal-day' + (evalDates.has(dateStr) ? ' has-eval' : '');
        dayEl.innerText = day;
        calendarEl.appendChild(dayEl);
    }
}

function renderNews() {
    const news = getNews();
    const listEl = document.getElementById('news-list');
    listEl.innerHTML = news.length === 0 ? '<li style="color:#888;">작성된 기사가 없습니다.</li>' : '';

    news.forEach((item, index) => {
        const li = document.createElement('li');
        li.className = 'news-item';
        li.innerHTML = `
            <span>${item.content}</span>
            <span class="news-meta">작성자: ${item.author} | ${item.date} <button class="del-btn" onclick="deleteNews(${index})">삭제</button></span>
        `;
        listEl.appendChild(li);
    });
}

// 이벤트 리스너
document.getElementById('eval-form').addEventListener('submit', e => {
    e.preventDefault();
    const subject = document.getElementById('eval-subject').value;
    const title = document.getElementById('eval-title').value;
    const date = document.getElementById('eval-date').value;

    const evals = getEvals();
    evals.push({ subject, title, date });
    saveEvals(evals);

    document.getElementById('eval-subject').value = '';
    document.getElementById('eval-title').value = '';
    document.getElementById('eval-date').value = '';

    renderEvals();
});

document.getElementById('news-form').addEventListener('submit', e => {
    e.preventDefault();
    const author = document.getElementById('news-author').value;
    const content = document.getElementById('news-content').value;
    const date = new Date().toLocaleDateString();

    const news = getNews();
    news.push({ author, content, date });
    saveNews(news);

    document.getElementById('news-author').value = '';
    document.getElementById('news-content').value = '';

    renderNews();
});

document.getElementById('sort-select').addEventListener('change', renderEvals);

function deleteEval(index) {
    const evals = getEvals();
    evals.splice(index, 1);
    saveEvals(evals);
    renderEvals();
}

function deleteNews(index) {
    const news = getNews();
    news.splice(index, 1);
    saveNews(news);
    renderNews();
}

// 초기 실행
renderEvals();
renderNews();