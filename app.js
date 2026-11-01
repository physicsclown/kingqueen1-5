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

// 다중 이미지 읽기 + 압축 (localStorage 용량 초과 방지)
function compressImage(file, maxSize = 1000, quality = 0.7) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onerror = () => resolve(null);
        reader.onload = (e) => {
            const img = new Image();
            img.onerror = () => resolve(null);
            img.onload = () => {
                const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(img.width * scale);
                canvas.height = Math.round(img.height * scale);
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

function readMultipleImages(files) {
    if (!files || files.length === 0) return Promise.resolve([]);
    return Promise.all(files.map(f => compressImage(f))).then(list => list.filter(Boolean));
}

// 저장 실패(용량 초과) 시 알림
function safeSave(saveFn, data) {
    try { saveFn(data); return true; }
    catch (err) {
        alert('저장 공간이 가득 찼어요 😢 사진 수를 줄이거나 예전 항목을 삭제해 주세요.');
        return false;
    }
}

// 선택한 사진 누적 보관 (한 번에 여러 장이 안 골라져도 여러 번 추가하면 쌓여요)
const selectedFiles = { eval: [], news: [] };

function setupImagePicker(key, inputId, previewId) {
    const input = document.getElementById(inputId);
    input.addEventListener('change', () => {
        Array.from(input.files || []).forEach(f => selectedFiles[key].push(f));
        input.value = ''; // 같은 사진도 다시 고를 수 있게 초기화
        renderPreview(key, previewId);
    });
}

function renderPreview(key, previewId) {
    const container = document.getElementById(previewId);
    container.innerHTML = '';
    selectedFiles[key].forEach((file, i) => {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'position:relative; flex:0 0 auto;';
        const img = document.createElement('img');
        img.className = 'preview-thumb';
        img.src = URL.createObjectURL(file);
        const del = document.createElement('button');
        del.type = 'button';
        del.textContent = '×';
        del.style.cssText = 'position:absolute; top:-6px; right:-6px; width:20px; height:20px; border-radius:50%; border:none; background:#e74c3c; color:#fff; font-size:14px; line-height:20px; padding:0; cursor:pointer;';
        del.onclick = () => {
            selectedFiles[key].splice(i, 1);
            renderPreview(key, previewId);
        };
        wrap.appendChild(img);
        wrap.appendChild(del);
        container.appendChild(wrap);
    });
    if (selectedFiles[key].length > 0) {
        const count = document.createElement('span');
        count.textContent = selectedFiles[key].length + '장 선택됨';
        count.style.cssText = 'font-size:12px; color:#666; align-self:center; white-space:nowrap;';
        container.appendChild(count);
    }
}

setupImagePicker('eval', 'eval-images', 'eval-image-preview');
setupImagePicker('news', 'news-images', 'news-image-preview');

// 1. 수행평가 등록
document.getElementById('eval-form').onsubmit = (e) => {
    e.preventDefault();
    const subject = document.getElementById('eval-subject').value;
    const title = document.getElementById('eval-title').value;
    const isUnknown = unknownCheckbox.checked;
    const date = isUnknown ? '??' : dateInput.value;
    const tip = document.getElementById('eval-tip').value;

    if (!isUnknown && !dateInput.value) {
        alert('날짜를 지정하거나 [날짜 미정(??)]을 체크해 주세요.');
        return;
    }

    readMultipleImages(selectedFiles.eval).then(images => {
        const evals = getEvals();
        evals.push({ subject, title, date, tip, images });
        if (!safeSave(saveEvals, evals)) return;

        document.getElementById('eval-form').reset();
        selectedFiles.eval = [];
        document.getElementById('eval-image-preview').innerHTML = '';
        dateInput.disabled = false;
        evalModal.classList.add('hidden');

        if (!isUnknown && date) {
            const addedDate = new Date(date);
            currentDate = new Date(addedDate.getFullYear(), addedDate.getMonth(), 1);
        }

        renderEvals();
    });
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

// 3.
