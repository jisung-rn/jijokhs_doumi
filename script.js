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
// 학사일정 API 연동 및 방학 여부 체크 함수 (방학식 예외 처리 반영)
// -------------------------------
async function checkVacation(targetYmd) {
    const url = `https://open.neis.go.kr/hub/SchoolSchedule?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${OFFICE_CODE}&SD_SCHUL_CODE=${SCHOOL_CODE}&AA_YMD=${targetYmd}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data && data.SchoolSchedule && data.SchoolSchedule[1] && data.SchoolSchedule[1].row) {
            const rows = data.SchoolSchedule[1].row;
            
            // '방학'이 포함되되, 당일 등교하는 '방학식'과 불필요한 키워드는 제외합니다.
            const hasVacation = rows.some(row => {
                const name = row.EVENT_NM;
                
                // 1. 설명회, 상담, 연수 등 불필요한 낚시성 데이터 걸러내기
                const isTrash = name.includes("설명회") || name.includes("상담") || name.includes("연수");
                
                // 2. '방학식' 당일은 학교에 가므로 진짜 방학 상태(수업/급식 없음)에서 제외
                const isVacationCeremony = name.includes("방학식");
                
                return name.includes("방학") && !isVacationCeremony && !isTrash;
            });
            
            return hasVacation;
        }
        return false;
    } catch (error) {
        console.error("학사일정 조회 실패:", error);
        return false;
    }
}

// -------------------------------
// 데이터 새로고침 (방학 분기 처리 로직 도입)
// -------------------------------
async function refreshDashboardData() {
    updateDateDisplay();
    
    const targetYmd = getFormattedYmd(currentDate);
    const table = document.getElementById("timetable");
    const lunchContainer = document.getElementById("mealLunch");
    const dinnerContainer = document.getElementById("mealDinner");

    // 1. 방학 여부를 우선적으로 확인 (방학식날은 false가 반환되어 정상 학기 로직으로 감)
    const isVacation = await checkVacation(targetYmd);
    
    // 비동기 통신 도중 사용자가 날짜를 바꿨을 때를 대비한 방어코드
    if (targetYmd !== getFormattedYmd(currentDate)) return;

    if (isVacation) {
        // 🏖️ 학사일정상 방학일 때의 UI 처리
        if (table) {
            table.innerHTML = `
                <div class="vacation-mode" style="text-align:center; padding: 50px 20px; font-weight:bold; color:#2b6cb0; font-size:18px; line-height:1.6;">
                    🏫 방학 기간입니다!<br>
                    <span style="font-size:14px; color:#718096; font-weight:normal;">정규 수업이 없는 날입니다.</span>
                </div>
            `;
        }
        if (lunchContainer) lunchContainer.innerHTML = `<div class="loading">방학 중에는 급식이 없습니다. 😎</div>`;
        if (dinnerContainer) dinnerContainer.innerHTML = `<div class="loading">방학 중에는 급식이 없습니다. 😎</div>`;
    } else {
        // ✍️ 정상 학기 및 방학식 당일일 때는 기존 로직 작동
        loadTimetable();
        loadMeals();
    }
}

// -------------------------------
// 시간표 조회 (실제 등록 개수 기반 자동 단축 감지 + 화면 항시 유지 버전)
// -------------------------------
async function loadTimetable() {
    const table = document.getElementById("timetable");
    if (!table) return;

    const gradeEl = document.getElementById("grade");
    const classEl = document.getElementById("class");
    const grade = (gradeEl && gradeEl.value) ? gradeEl.value : "2";
    const classNum = (classEl && classEl.value) ? classEl.value : "3";
    
    const targetYmd = getFormattedYmd(currentDate);
    const dayOfWeek = currentDate.getDay(); // 1: 월요일, ..., 5: 금요일

    table.innerHTML = "<div class='loading'>시간표를 불러오는 중...</div>";

    const directUrl = `https://open.neis.go.kr/hub/hisTimetable?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${OFFICE_CODE}&SD_SCHUL_CODE=${SCHOOL_CODE}&ALL_TI_YMD=${targetYmd}&GRADE=${grade}&CLASS_NM=${classNum}`;

    try {
        const response = await fetch(directUrl);
        const data = await response.json();

        if (targetYmd !== getFormattedYmd(currentDate)) return;
        table.innerHTML = "";

        // 1. 교시별 기본값을 없음을 뜻하는 "-" 로 세팅
        let p1 = "-", p2 = "-", p3 = "-", p4 = "-", p5 = "-", p6 = "-", p7 = "-";
        let maxPeriod = 0; // 오늘 나이스에 등록된 실제 최대 교시 (단축 수업 판단용)

        // 2. API 데이터 매핑 및 최대 교시 파악 (문자열 정제 안전장치 포함)
        if (data && data.hisTimetable && data.hisTimetable[1] && data.hisTimetable[1].row) {
            const rows = data.hisTimetable[1].row;
            rows.forEach(subject => {
                const perioStr = String(subject.PERIO).replace(/[^0-9]/g, '');
                const period = parseInt(perioStr);
                const name = subject.ITRT_CNTNT; // 과목명
                
                if (period >= 1 && period <= 7) {
                    if (period > maxPeriod && name && name.trim() !== "") {
                        maxPeriod = period; // 실제로 과목명이 등록된 가장 높은 교시 저장
                    }
                }

                if (period === 1) p1 = name;
                else if (period === 2) p2 = name;
                else if (period === 3) p3 = name;
                else if (period === 4) p4 = name;
                else if (period === 5) p5 = name;
                else if (period === 6) p6 = name;
                else if (period === 7) p7 = name;
            });
        }

        const hasData = data && data.hisTimetable && data.hisTimetable[1] && data.hisTimetable[1].row && data.hisTimetable[1].row.length > 0;

        if (hasData) {
            // 원래 요일별 기준 길이와 나이스 실제 등록 최대 교시 비교
            // 월, 화, 목요일의 기본 일과는 7교시 / 수, 금요일의 기본 일과는 6교시
            const isNormalScheduleLength = 
                ((dayOfWeek === 1 || dayOfWeek === 2 || dayOfWeek === 4) && maxPeriod >= 7) ||
                ((dayOfWeek === 3 || dayOfWeek === 5) && maxPeriod >= 6);

            // 단축 수업이 아닐 때(정상 일과 길이일 때)만 빈 교시 치환 작동
            if (isNormalScheduleLength) {
                if (dayOfWeek === 1) { 
                    // 월요일: 1교시 제외, 2~7교시 빈값 대체
                    if (p2 === "-") p2 = "선택과목";
                    if (p3 === "-") p3 = "선택과목";
                    if (p4 === "-") p4 = "선택과목";
                    if (p5 === "-") p5 = "선택과목";
                    if (p6 === "-") p6 = "선택과목";
                    if (p7 === "-") p7 = "선택과목";
                } else if (dayOfWeek === 2 || dayOfWeek === 4) { 
                    // 화요일, 목요일: 1~7교시 빈값 대체
                    if (p1 === "-") p1 = "선택과목";
                    if (p2 === "-") p2 = "선택과목";
                    if (p3 === "-") p3 = "선택과목";
                    if (p4 === "-") p4 = "선택과목";
                    if (p5 === "-") p5 = "선택과목";
                    if (p6 === "-") p6 = "선택과목";
                    if (p7 === "-") p7 = "선택과목";
                } else if (dayOfWeek === 3 || dayOfWeek === 5) { 
                    // 수요일, 금요일: 1~6교시 빈값 대체 (7교시는 자동 치환 없이 원래 값 그대로 유지)
                    if (p1 === "-") p1 = "선택과목";
                    if (p2 === "-") p2 = "선택과목";
                    if (p3 === "-") p3 = "선택과목";
                    if (p4 === "-") p4 = "선택과목";
                    if (p5 === "-") p5 = "선택과목";
                    if (p6 === "-") p6 = "선택과목";
                }
            }
        } else {
            p1 = "수업 없음"; p2 = "-"; p3 = "-"; p4 = "-"; p5 = "-"; p6 = "-"; p7 = "-";
        }

        // 3. 화면 렌더링 (1~7교시 틀 항상 고정 출력)
        table.innerHTML = `
            <div class="item" id="period-1"><span class="period">1교시</span><span class="subject">${p1}</span></div>
            <div class="item" id="period-2"><span class="period">2교시</span><span class="subject">${p2}</span></div>
            <div class="item" id="period-3"><span class="period">3교시</span><span class="subject">${p3}</span></div>
            <div class="item" id="period-4"><span class="period">4교시</span><span class="subject">${p4}</span></div>
            <div class="item" id="period-5"><span class="period">5교시</span><span class="subject">${p5}</span></div>
            <div class="item" id="period-6"><span class="period">6교시</span><span class="subject">${p6}</span></div>
            <div class="item" id="period-7"><span class="period">7교시</span><span class="subject">${p7}</span></div>
        `;

    } catch (error) {
        console.error(error);
        if (targetYmd === getFormattedYmd(currentDate)) {
            table.innerHTML = `
                <div class="item"><span class="period">1교시</span><span class="subject">-</span></div>
                <div class="item"><span class="period">2교시</span><span class="subject">-</span></div>
                <div class="item"><span class="period">3교시</span><span class="subject">-</span></div>
                <div class="item"><span class="period">4교시</span><span class="subject">-</span></div>
                <div class="item"><span class="period">5교시</span><span class="subject">-</span></div>
                <div class="item"><span class="period">6교시</span><span class="subject">-</span></div>
                <div class="item"><span class="period">7교시</span><span class="subject">-</span></div>
            `;
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
        adjustToWeekday(currentDate, -1); // 토/일요일이면 금요일로 점프
        refreshDashboardData();
    });
}

// 오른쪽 화살표 (미래로 이동)
const nextBtn = document.getElementById("nextDateBtn");
if (nextBtn) {
    nextBtn.addEventListener("click", () => {
        currentDate.setDate(currentDate.getDate() + 1);
        adjustToWeekday(currentDate, 1); // 토/일요일이면 월요일로 점프
        refreshDashboardData();
    });
}

// -----------------------------------------------------------
// 달력 날짜 변경 감지 및 데이터 동기화
// -----------------------------------------------------------
const datePicker = document.getElementById("datePicker");

if (datePicker) {
    datePicker.addEventListener("change", (e) => {
        if (e.target.value) {
            const selectedDate = new Date(e.target.value);
            adjustToWeekday(selectedDate, 1);
            currentDate = selectedDate;
            refreshDashboardData();
        }
    });
}

// 실시간 시계 기능 (시:분 표시)
function updateClock() {
    const now = new Date();
    let hours = now.getHours();
    let minutes = now.getMinutes();

    hours = hours < 10 ? '0' + hours : hours;
    minutes = minutes < 10 ? '0' + minutes : minutes;

    const clockElement = document.getElementById('live-clock');
    if (clockElement) {
        clockElement.innerText = `${hours}:${minutes}`;
    }
}

updateClock();
setInterval(updateClock, 1000);

// -------------------------------
// 최초 앱 실행
// -------------------------------
refreshDashboardData();
