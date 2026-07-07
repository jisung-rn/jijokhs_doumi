// ===============================
// 지족고등학교 대시보드 (나이스 다이렉트 고속 + 틀 고정 버전)
// script.js
// ===============================

// 💎 나이스에서 발급받은 인증키를 따옴표 안에 넣어주세요!
const API_KEY = "55a6304ce0b141288aa279f1f788fe14"; 

// 학교 정보 (대전지족고등학교)
const OFFICE_CODE = "G10";   // 대전광역시교육청
const SCHOOL_CODE = "7430149"; // 대전지족고등학교

// 현재 대시보드가 보여주고 있는 기준 날짜 데이터 (기본값: 오늘)
let currentDate = new Date();

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
// 시간표 조회 (1~7교시 틀 고정 및 데이터 매핑)
// -------------------------------
async function loadTimetable() {
    const table = document.getElementById("timetable");
    if (!table) return;

    const gradeEl = document.getElementById("grade");
    const classEl = document.getElementById("class");
    const grade = (gradeEl && gradeEl.value) ? gradeEl.value : "2";
    const classNum = (classEl && classEl.value) ? classEl.value : "3";
    
    const targetYmd = getFormattedYmd(currentDate);
    const dayOfWeek = currentDate.getDay(); // 1: 월요일, 2: 화요일 ...

    table.innerHTML = "<div class='loading'>시간표를 불러오는 중...</div>";

    // 🚀 프록시 없이 KEY를 붙여 나이스 서버에 다이렉트로 초고속 요청
    const directUrl = `https://open.neis.go.kr/hub/hisTimetable?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${OFFICE_CODE}&SD_SCHUL_CODE=${SCHOOL_CODE}&ALL_TI_YMD=${targetYmd}&GRADE=${grade}&CLASS_NM=${classNum}`;

    try {
        const response = await fetch(directUrl);
        const data = await response.json();

        if (targetYmd !== getFormattedYmd(currentDate)) return;
        table.innerHTML = "";

        // 💎 1교시부터 7교시까지의 과목을 담을 빈 배열 생성 (1번 인덱스 ~ 7번 인덱스 사용)
        const dailySubjects = Array(8).fill("-"); 

        // 나이스 API 데이터가 정상적으로 들어온 경우에만 배열에 과목 매핑
        if (data && data.hisTimetable && data.hisTimetable[1] && data.hisTimetable[1].row) {
            const rows = data.hisTimetable[1].row;
            rows.forEach(subject => {
                const period = parseInt(subject.PERIO);
                if (period >= 1 && period <= 7) {
                    dailySubjects[period] = subject.ITRT_CNTNT; // 해당 교시에 과목명 저장
                }
            });
        }

        // 💎 [특수성 처리] 월요일(1)이면 1교시는 데이터가 있어도 강제로 '-' 처리
        if (dayOfWeek === 1) {
            dailySubjects[1] = "-";
        }

        // 💎 데이터 유무와 상관없이 1교시부터 7교시까지 무조건 화면에 틀을 그림
        for (let period = 1; period <= 7; period++) {
            table.innerHTML += `
            <div class="item">
                <span class="period">${period}교시</span>
                <span class="subject">${dailySubjects[period]}</span>
            </div>
            `;
        }

    } catch (error) {
        console.error(error);
        if (targetYmd === getFormattedYmd(currentDate)) {
            // 에러가 나거나 네트워크가 불안정해도 틀이 깨지지 않게 1~7교시 빈 틀을 출력
            table.innerHTML = "";
            for (let period = 1; period <= 7; period++) {
                table.innerHTML += `
                <div class="item">
                    <span class="period">${period}교시</span>
                    <span class="subject">-</span>
                </div>
                `;
            }
        }
    }
}

// -------------------------------
// 급식 조회 (중식 & 석식 통합 처리)
// -------------------------------
async function loadMeals() {
    const lunchContainer = document.getElementById("mealLunch");
    const dinnerContainer = document.getElementById("mealDinner");
    if (!lunchContainer || !dinnerContainer) return;

    const targetYmd = getFormattedYmd(currentDate);
    
    lunchContainer.innerHTML = "<div class='loading'>중식을 불러오는 중...</div>";
    dinnerContainer.innerHTML = "<div class='loading'>석식을 불러오는 중...</div>";

    // 🚀 급식도 프록시 없이 KEY를 붙여 다이렉트 요청
    const directUrl = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${OFFICE_CODE}&SD_SCHUL_CODE=${SCHOOL_CODE}&MLSV_YMD=${targetYmd}`;

    try {
        const response = await fetch(directUrl);
        const data = await response.json();

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
// 최초 앱 실행
// -------------------------------
refreshDashboardData();
