// ===============================
// 지족고등학교 대시보드 (주말 스킵 + 모바일 완벽 호환 달력 버전)
// script.js
// ===============================

// 💎 나이스에서 발급받은 인증키를 따옴표 안에 넣어주세요!
const API_KEY = "55a6304ce0b141288aa279f1f788fe14"; 

// 학교 정보 (대전지족고등학교)
const OFFICE_CODE = "G10";   // 대전광역시교육청
const SCHOOL_CODE = "7430149"; // 대전지족고등학교

// 현재 대시보드가 보여주고 있는 기준 날짜 데이터 (기본값: 오늘)
let currentDate = new Date();

// 💎 만약 처음 켰을 때 오늘이 주말(토/일)이라면 다가오는 월요일로 세팅
adjustToWeekday(currentDate, 1); 

// 주말 우회 안전장치 함수 (방향: 1은 미래로, -1은 과거로 이동)
function adjustToWeekday(dateObj, direction = 1) {
    const day = dateObj.getDay(); // 0: 일요일, 6: 토요일
    if (day === 6) { // 토요일이면
        dateObj.setDate(dateObj.getDate() + (direction === 1 ? 2 : -1));
    } else if (day === 0) { // 일요일이면
        dateObj.setDate(dateObj.getDate() + (direction === 1 ? 1 : -2));
    }
}

// 나이스 API 규격에 맞는 YYYYMMDD 문자열 생성 함수
function getFormattedYmd(dateObj) {
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    return `${yyyy}${mm}${dd}`;
}

// -------------------------------
// 상단 날짜 텍스트 업데이트 및 달력 값 동기화
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

    // 투명하게 겹쳐진 input[type=date]의 값도 현재 날짜 포맷(YYYY-MM-DD)으로 갱신
    const picker = document.getElementById("datePicker");
    if (picker) {
        const yyyy = currentDate.getFullYear();
        const mm = String(currentDate.getMonth() + 1).padStart(2, '0');
        const dd = String(currentDate.getDate()).padStart(2, '0');
        picker.value = `${yyyy}-${mm}-${dd}`;
    }
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

    const directUrl = `https://open.neis.go.kr/hub/hisTimetable?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${OFFICE_CODE}&SD_SCHUL_CODE=${SCHOOL_CODE}&ALL_TI_YMD=${targetYmd}&GRADE=${grade}&CLASS_NM=${classNum}`;

    try {
        const response = await fetch(directUrl);
        const data = await response.json();

        if (targetYmd !== getFormattedYmd(currentDate)) return;
        table.innerHTML = "";

        const dailySubjects = Array(8).fill("-"); 

        if (data && data.hisTimetable && data.hisTimetable[1] && data.hisTimetable[1].row) {
            const rows = data.hisTimetable[1].row;
            rows.forEach(subject => {
                const period = parseInt(subject.PERIO);
                if (period >= 1 && period <= 7) {
                    dailySubjects[period] = subject.ITRT_CNTNT; 
                }
            });
        }

        if (dayOfWeek === 1) {
            dailySubjects[1] = "-";
        }

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
            const mealCode = mealRow.MMEAL_SC_CODE; 
            
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

// 왼쪽 화살표 (과거로 이동)
const prevBtn = document.getElementById("prevDateBtn");
if (prevBtn) {
    prevBtn.addEventListener("click", () => {
        currentDate.setDate(currentDate.getDate() - 1);
        adjustToWeekday(currentDate, -1); // 💎 토/일요일이면 금요일로 점프
        refreshDashboardData();
    });
}

// 오른쪽 화살표 (미래로 이동)
const nextBtn = document.getElementById("nextDateBtn");
if (nextBtn) {
    nextBtn.addEventListener("click", () => {
        currentDate.setDate(currentDate.getDate() + 1);
        adjustToWeekday(currentDate, 1); // 💎 토/일요일이면 월요일로 점프
        refreshDashboardData();
    });
}

// -----------------------------------------------------------
// 💎 [최종 마스터] PC 및 모바일 달력 차단 완벽 우회 로직
// -----------------------------------------------------------
const datePicker = document.getElementById("datePicker");
const wrapper = document.querySelector(".datepicker-wrapper");

if (wrapper && datePicker) {
    // 달력을 열어주는 핵심 실행 함수
    const openCalendar = (e) => {
        e.preventDefault(); // 모바일 더블 액션 및 이벤트 버블링 차단
        e.stopPropagation();
        
        try {
            if (typeof datePicker.showPicker === 'function') {
                datePicker.showPicker(); // 최신 브라우저 표준 강제 오픈
            } else {
                datePicker.click(); // 구형 브라우저 호환용
            }
        } catch (err) {
            console.error("달력 호출 실패:", err);
        }
    };

    // 1️⃣ PC 사용자를 위한 마우스 클릭 리스너
    wrapper.addEventListener("click", openCalendar);

    // 2️⃣ 모바일 사용자를 위한 터치 스타트 리스너 (보안 우회 핵심)
    wrapper.addEventListener("touchstart", openCalendar, { passive: false });

    // 3️⃣ 사용자가 달력에서 날짜를 변경 완료했을 때
    datePicker.addEventListener("change", (e) => {
        if (e.target.value) {
            const selectedDate = new Date(e.target.value);
            // 주말이면 평일로 자동 점프
            adjustToWeekday(selectedDate, 1);
            currentDate = selectedDate;
            refreshDashboardData();
        }
    });
}

// -------------------------------
// 최초 앱 실행
// -------------------------------
refreshDashboardData();
