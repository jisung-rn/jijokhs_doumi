// ===============================
// 지족고등학교 대시보드 (날짜 이동 최종본)
// script.js
// ===============================

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
// 데이터 새로고침 (시간표 & 급식 동시 호출)
// -------------------------------
function refreshDashboardData() {
    updateDateDisplay();
    loadTimetable();
    loadMeal();
}

// -------------------------------
// 시간표 조회
// -------------------------------
async function loadTimetable() {
    const grade = document.getElementById("grade").value;
    const classNum = document.getElementById("class").value;
    const table = document.getElementById("timetable");
    const ymd = getFormattedYmd(currentDate);

    table.innerHTML = "<div class='loading'>시간표를 불러오는 중...</div>";

    const originUrl = `https://open.neis.go.kr/hub/hisTimetable?Type=json&ATPT_OFCDC_SC_CODE=${OFFICE_CODE}&SD_SCHUL_CODE=${SCHOOL_CODE}&ALL_TI_YMD=${ymd}&GRADE=${grade}&CLASS_NM=${classNum}`;
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(originUrl)}`;

    try {
        const response = await fetch(proxyUrl);
        const data = await response.json();

        table.innerHTML = "";

        if (!data.hisTimetable) {
            table.innerHTML = `<div class="loading">선택하신 날짜에 시간표가 없거나 주말입니다. 😴</div>`;
            return;
        }

        const rows = data.hisTimetable[1].row;
        rows.forEach(subject => {
            table.innerHTML += `
            <div class="item">
                <span class="period">${subject.PERIO}교시</span>
                <span class="subject">${subject.ITRT_CNTNT}</span>
            </div>
            `;
        });
    } catch (error) {
        console.error(error);
        table.innerHTML = `<div class="loading">시간표를 가져오지 못했습니다.</div>`;
    }
}

// -------------------------------
// 급식 조회
// -------------------------------
async function loadMeal() {
    const meal = document.getElementById("meal");
    const ymd = getFormattedYmd(currentDate);
    
    meal.innerHTML = "<div class='loading'>급식을 불러오는 중...</div>";

    const originUrl = `https://open.neis.go.kr/hub/mealServiceDietInfo?Type=json&ATPT_OFCDC_SC_CODE=${OFFICE_CODE}&SD_SCHUL_CODE=${SCHOOL_CODE}&MLSV_YMD=${ymd}`;
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(originUrl)}`;

    try {
        const response = await fetch(proxyUrl);
        const data = await response.json();

        meal.innerHTML = "";

        if (!data.mealServiceDietInfo) {
            meal.innerHTML = `<div class="loading">선택하신 날짜에 급식이 없습니다. 🍳</div>`;
            return;
        }

        const ul = document.createElement("ul");
        let menuStr = data.mealServiceDietInfo[1].row[0].DDISH_NM;
        
        menuStr = menuStr.replace(/[0-9.()]/g, '');
        const foods = menuStr.split('<br/>');

        foods.forEach(food => {
            if (food.trim()) {
                const li = document.createElement("li");
                li.textContent = "🍚 " + food.trim();
                ul.appendChild(li);
            }
        });
        meal.appendChild(ul);

        const calorieInfo = data.mealServiceDietInfo[1].row[0].CAL_INFO;
        if (calorieInfo) {
            const div = document.createElement("div");
            div.style.marginTop = "20px";
            div.style.fontWeight = "bold";
            div.style.textAlign = "right";
            div.style.color = "#666";
            div.textContent = "🔥 총 열량: " + calorieInfo;
            meal.appendChild(div);
        }
    } catch (error) {
        console.error(error);
        meal.innerHTML = `<div class="loading">급식을 불러오지 못했습니다.</div>`;
    }
}

// -------------------------------
// Todo 기능
// -------------------------------
const todoInput = document.getElementById("todoText");
const todoList = document.getElementById("todoList");
const addBtn = document.getElementById("addTodo");

function saveTodos() {
    const todos = [];
    document.querySelectorAll(".todo span").forEach(item => {
        todos.push(item.textContent);
    });
    localStorage.setItem("todos", JSON.stringify(todos));
}

function createTodo(text) {
    const div = document.createElement("div");
    div.className = "todo";

    const span = document.createElement("span");
    span.textContent = text;

    const btn = document.createElement("button");
    btn.textContent = "삭제";
    btn.onclick = function () {
        div.remove();
        saveTodos();
    };

    div.appendChild(span);
    div.appendChild(btn);
    if(todoList) todoList.appendChild(div);
}

function loadTodos() {
    const todos = JSON.parse(localStorage.getItem("todos") || "[]");
    todos.forEach(todo => {
        createTodo(todo);
    });
}

// -------------------------------
// 이벤트 리스너 설정
// -------------------------------
if(addBtn && todoInput) {
    addBtn.addEventListener("click", () => {
        const text = todoInput.value.trim();
        if (text === "") return;
        createTodo(text);
        saveTodos();
        todoInput.value = "";
    });

    todoInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            addBtn.click();
        }
    });
}

const loadBtn = document.getElementById("loadBtn");
if(loadBtn) {
    loadBtn.addEventListener("click", loadTimetable);
}

// 💎 날짜 이동 버튼 이벤트 리스너 안전하게 연결
const prevBtn = document.getElementById("prevDateBtn");
const nextBtn = document.getElementById("nextDateBtn");

if(prevBtn) {
    prevBtn.addEventListener("click", () => {
        currentDate.setDate(currentDate.getDate() - 1); // 하루 빼기
        refreshDashboardData();
    });
}

if(nextBtn) {
    nextBtn.addEventListener("click", () => {
        currentDate.setDate(currentDate.getDate() + 1); // 하루 더하기
        refreshDashboardData();
    });
}

// -------------------------------
// 최초 앱 실행
// -------------------------------
refreshDashboardData();
loadTodos();
