// ===============================
// 지족고등학교 대시보드
// script.js (완성본)
// ===============================

// 학교 정보 (대전지족고등학교)
const OFFICE_CODE = "G10";   // 대전광역시교육청
const SCHOOL_CODE = "7431102"; // 대전지족고등학교

// API 요청을 위한 오늘 날짜 구하기 (YYYYMMDD 형식)
const todayDate = new Date();
const yyyy = todayDate.getFullYear();
const mm = String(todayDate.getMonth() + 1).padStart(2, '0');
const dd = String(todayDate.getDate()).padStart(2, '0');
const ymd = `${yyyy}${mm}${dd}`;

// -------------------------------
// 오늘 날짜 표시
// -------------------------------
function updateDate() {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("ko-KR", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "long"
    });
    document.getElementById("today").textContent = formatter.format(now);
}

// -------------------------------
// 시간표 조회
// -------------------------------
async function loadTimetable() {
    const grade = document.getElementById("grade").value;
    const classNum = document.getElementById("class").value;
    const table = document.getElementById("timetable");

    table.innerHTML = "<div class='loading'>시간표를 불러오는 중...</div>";

    // 나이스 고등학교 시간표 개방 API 실제 주소 + CORS 우회 프록시 결합
    const originUrl = `https://open.neis.go.kr/hub/hisTimetable?Type=json&ATPT_OFCDC_SC_CODE=${OFFICE_CODE}&SD_SCHUL_CODE=${SCHOOL_CODE}&ALL_TI_YMD=${ymd}&GRADE=${grade}&CLASS_NM=${classNum}`;
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(originUrl)}`;

    try {
        const response = await fetch(proxyUrl);
        const data = await response.json();

        table.innerHTML = "";

        // 나이스 API의 정상 데이터 검증 구조
        if (!data.hisTimetable) {
            table.innerHTML = `<div class="loading">오늘 시간표가 없거나 주말입니다. 😴</div>`;
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
    meal.innerHTML = "<div class='loading'>급식을 불러오는 중...</div>";

    // 나이스 급식 개방 API 실제 주소 + CORS 우회 프록시 결합
    const originUrl = `https://open.neis.go.kr/hub/mealServiceDietInfo?Type=json&ATPT_OFCDC_SC_CODE=${OFFICE_CODE}&SD_SCHUL_CODE=${SCHOOL_CODE}&MLSV_YMD=${ymd}`;
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(originUrl)}`;

    try {
        const response = await fetch(proxyUrl);
        const data = await response.json();

        meal.innerHTML = "";

        if (!data.mealServiceDietInfo) {
            meal.innerHTML = `<div class="loading">오늘 급식이 없습니다. 🍳</div>`;
            return;
        }

        const ul = document.createElement("ul");
        let menuStr = data.mealServiceDietInfo[1].row[0].DDISH_NM;
        
        // 나이스 데이터 특유의 요리 번호 지우고 줄바꿈(<br/>) 기준으로 쪼개기
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

        // 칼로리 정보가 있다면 우측 정렬로 하단에 표시
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
    todoList.appendChild(div);
}

function loadTodos() {
    const todos = JSON.parse(localStorage.getItem("todos") || "[]");
    todos.forEach(todo => {
        createTodo(todo);
    });
}

// 이벤트 리스너 연결
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

document.getElementById("loadBtn").addEventListener("click", loadTimetable);

// -------------------------------
// 처음 실행 (중복 호출 코드 정리)
// -------------------------------
updateDate();
loadTimetable();
loadMeal();
loadTodos();