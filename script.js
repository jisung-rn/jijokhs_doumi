// ===============================
// 지족고등학교 대시보드 (초고속 안정화 버전)
// script.js
// ===============================

// 학교 정보 (대전지족고등학교)
const OFFICE_CODE = "G10";   // 대전광역시교육청
const SCHOOL_CODE = "7430149"; // 대전지족고등학교

// 현재 대시보드가 보여주고 있는 기준 날짜 데이터 (기본값: 오늘)
let currentDate = new Date();

// 💎 날짜 이동 시 이전 중복 요청을 취소하여 무한 로딩을 막는 컨트롤러
let timetableController = null;
let mealController = null;

// 나이스 API 규격에 맞는 YYYYMMDD 문자열 생성 함수
function getFormattedYmd(dateObj) {
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    return `${yyyy}${mm}${dd}`;
}

// -------------------------------
// 상단 날짜 텍스트 업데이트
// -------------------------------
function updateDateDisplay() {
    const formatter = new Intl.DateTimeFormat("ko-KR", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "long"
    });
    document.getElementById("today").textContent = formatter.format(currentDate);
}

// -------------------------------
// 데이터 새로고침
// -------------------------------
function refreshDashboardData() {
    updateDateDisplay();
    loadTimetable();
    loadMeals();
}

// -------------------------------
// 시간표 조회 (월요일 1교시 예외 및 최대 7교시 제한)
// -------------------------------
async function loadTimetable() {
    // 💎 요소가 아직 로드되지 않았을 경우를 대비해 기본값 안전장치 마련
    const gradeEl = document.getElementById("grade");
    const classEl = document.getElementById("class");
    const grade = gradeEl ? gradeEl.value : "2";
    const classNum = classEl ? classEl.value : "3";
    
    const table = document.getElementById("timetable");
    const targetYmd = getFormattedYmd(currentDate);
    const dayOfWeek = currentDate.getDay(); // 1: 월요일, 2: 화요일 ...

    table.innerHTML = "<div class='loading'>시간표를 불러오는 중...</div>";

    // 💎 이전 요청이 남아있으면 강제로 취소해서 병목현상 제거
    if (timetableController) timetableController.abort();
    timetableController = new AbortController();

    const originUrl = `https://open.neis.go.kr/hub/hisTimetable?Type=json&ATPT_OFCDC_SC_CODE=${OFFICE_CODE}&SD_SCHUL_CODE=${SCHOOL_CODE}&ALL_TI_YMD=${targetYmd}&GRADE=${grade}&CLASS_NM=${classNum}`;
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(originUrl)}`;

    try {
        const response = await fetch(proxyUrl, { signal: timetableController.signal });
        const resData = await response.json();
        const data = JSON.parse(resData.contents);

        if (targetYmd !== getFormattedYmd(currentDate)) return;
        table.innerHTML = "";

        if (!data || !data.hisTimetable) {
            table.innerHTML = `<div class="loading">선택하신 날짜에 시간표가 없거나 주말입니다. 😴</div>`;
            return;
        }

        let rows = data.hisTimetable[1].row;

        // 월요일(1)이면 1교시 데이터 제외하기
        if (dayOfWeek === 1) {
            rows = rows.filter(subject => parseInt(subject.PERIO) !== 1);
        }

        let displayCount = 0;

        rows.forEach(subject => {
            const period = parseInt(subject.PERIO);
            if (period <= 7 && displayCount < 7) {
                table.innerHTML += `
                <div class="item">
                    <span class="period">${period}교시</span>
                    <span class="subject">${subject.ITRT_CNTNT}</span>
                </div>
                `;
                displayCount++;
            }
        });

        if (displayCount === 0) {
            table.innerHTML = `<div class="loading">표시할 시간표 데이터가 없습니다.</div>`;
        }

    } catch (error) {
        if (error.name === 'AbortError') return; // 취소된 요청은 에러 처리 안 함
        console.error(error);
        if (targetYmd === getFormattedYmd(currentDate)) {
            table.innerHTML = `<div class="loading">시간표를 가져오지 못했습니다.</div>`;
        }
    }
}

// -------------------------------
// 급식 조회 (중식 & 석식 통합 처리)
// -------------------------------
async function loadMeals() {
    const lunchContainer = document.getElementById("mealLunch");
    const dinnerContainer = document.getElementById("mealDinner");
    const targetYmd = getFormattedYmd(currentDate);
    
    lunchContainer.innerHTML = "<div class='loading'>중식을 불러오는 중...</div>";
    dinnerContainer.innerHTML = "<div class='loading'>석식을 불러오는 중...</div>";

    // 💎 이전 급식 요청이 끝나지 않았다면 취소해서 랙 방지
    if (mealController) mealController.abort();
    mealController = new AbortController();

    const originUrl = `https://open.neis.go.kr/hub/mealServiceDietInfo?Type=json&ATPT_OFCDC_SC_CODE=${OFFICE_CODE}&SD_SCHUL_CODE=${SCHOOL_CODE}&MLSV_YMD=${targetYmd}`;
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(originUrl)}`;

    try {
        const response = await fetch(proxyUrl, { signal: mealController.signal });
        const resData = await response.json();
        const data = JSON.parse(resData.contents);

        if (targetYmd !== getFormattedYmd(currentDate)) return;

        lunchContainer.innerHTML = "";
        dinnerContainer.innerHTML = "";

        if (!data || !data.mealServiceDietInfo) {
            const emptyMsg = `<div class="loading">선택하신 날짜에 급식이 없습니다. 🍳</div>`;
            lunchContainer.innerHTML = emptyMsg;
            dinnerContainer.innerHTML = emptyMsg;
            return;
        }

        const rows = data.mealServiceDietInfo[1].row;
        
        let hasLunch = false;
        let hasDinner = false;

        rows.forEach(mealRow => {
            const mealCode = mealRow.MMEAL_SC_CODE; // 2: 중식, 3: 석식
            
            let menuStr = mealRow.DDISH_NM;
            menuStr = menuStr.replace(/[0-9.()]/g, '');
            const foods = menuStr.split('<br/>');

            const ul = document.createElement("ul");
            foods.forEach(food => {
                if (food.trim()) {
                    const li = document.createElement("li");
                    li.textContent = "🍚 " + food.trim();
                    ul.appendChild(li);
                }
            });

            const calorieInfo = mealRow.CAL_INFO;
            if (calorieInfo) {
                const div = document.createElement("div");
                div.style.marginTop = "15px";
                div.style.fontWeight = "bold";
                div.style.textAlign = "right";
                div.style.color = "#666";
                div.style.fontSize = "13px";
                div.textContent = "🔥 " + calorieInfo;
                ul.appendChild(div);
            }

            if (mealCode === "2") {
                lunchContainer.appendChild(ul);
                hasLunch = true;
            } else if (mealCode === "3") {
                dinnerContainer.appendChild(ul);
                hasDinner = true;
            }
        });

        if (!hasLunch) {
            lunchContainer.innerHTML = `<div class="loading">등록된 중식이 없습니다. 😴</div>`;
        }
        if (!hasDinner) {
            dinnerContainer.innerHTML = `<div class="loading">등록된 석식이 없습니다. 😴</div>`;
        }

    } catch (error) {
        if (error.name === 'AbortError') return;
        console.error(error);
        if (targetYmd === getFormattedYmd(currentDate)) {
            const errorMsg = `<div class="loading">급식을 불러오지 못했습니다.</div>`;
            lunchContainer.innerHTML = errorMsg;
            dinnerContainer.innerHTML = errorMsg;
        }
    }
}

// -------------------------------
// 이벤트 리스너 설정
// -------------------------------
const loadBtn = document.getElementById("loadBtn");
if (loadBtn) {
    loadBtn.addEventListener("click", loadTimetable);
}

const prevBtn = document.getElementById("prevDateBtn");
const nextBtn = document.getElementById("nextDateBtn");

if (prevBtn) {
    prevBtn.addEventListener("click", () => {
        currentDate.setDate(currentDate.getDate() - 1);
        refreshDashboardData();
    });
}

if (nextBtn) {
    nextBtn.addEventListener("click", () => {
        currentDate.setDate(currentDate.getDate() + 1);
        refreshDashboardData();
    });
}

// -------------------------------
// 최초 앱 실행 (DOM이 모두 구성된 뒤 호출하도록 보장)
// -------------------------------
window.addEventListener("DOMContentLoaded", () => {
    refreshDashboardData();
});
