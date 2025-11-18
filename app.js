async function loadNDJSON(path) {
    const res = await fetch(path);
    const txt = await res.text();

    // Ignore blank lines and parse each line as JSON
    return txt
        .trim()
        .split("\n")
        .map(line => JSON.parse(line));
}

let shamrockItems = [];
let usfoodsItems = [];
let matches = {};
let filterState = "all";

// Load saved matches from local storage
function loadProgress() {
    const saved = localStorage.getItem("matches");
    if (saved) matches = JSON.parse(saved);
}

// Save matches to local storage
function saveProgress() {
    localStorage.setItem("matches", JSON.stringify(matches));
}

// Load CSV-like JSON (NDJSON)
async function loadData() {
    shamrockItems = await loadNDJSON("./data/shamrock.json");
    usfoodsItems = await loadNDJSON("./data/usfoods.json");
    loadProgress();
    updateCounts();
    renderList();
}

// Fuzzy match simple scoring
function scoreMatch(a, b) {
    a = a.toLowerCase();
    b = b.toLowerCase();
    let score = 0;

    a.split(/[\s,-]+/).forEach(word => {
        if (b.includes(word)) score++;
    });

    return score;
}

function findBestMatches(shamrockDesc) {
    let scored = usfoodsItems.map(u => ({
        item: u,
        score: scoreMatch(shamrockDesc, u.description)
    }));

    scored = scored.filter(s => s.score > 0);
    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, 5);
}

function updateCounts() {
    const matched = Object.keys(matches).length;
    const total = shamrockItems.length;
    const noMatch = shamrockItems.filter(i => matches[i.id] === null).length;
    const pending = total - matched - noMatch;

    document.getElementById("count-shamrock").innerText = total;
    document.getElementById("count-matched").innerText = matched;
    document.getElementById("count-no-match").innerText = noMatch;
    document.getElementById("count-pending").innerText = pending;
}

function renderList() {
    const list = document.getElementById("list");
    list.innerHTML = "";

    shamrockItems.forEach(item => {
        let status = matches[item.id];
        if (filterState === "matched" && !status) return;
        if (filterState === "pending" && status !== undefined) return;
        if (filterState === "nomatch" && status !== null) return;

        const div = document.createElement("div");
        div.className = "item";

        let html = `<div class="left"><strong>${item.description}</strong></div>`;
        html += `<div class="right">`;

        if (status === undefined) {
            // Pending → show match candidates
            const best = findBestMatches(item.description);
            if (best.length === 0) {
                html += `<button onclick="markNoMatch(${item.id})">No Match</button>`;
            } else {
                html += best
                    .map(
                        b =>
                            `<button onclick="selectMatch(${item.id}, ${b.item.id})">${b.item.description}</button>`
                    )
                    .join("");
                html += `<button onclick="markNoMatch(${item.id})" class="nomatch">No Match</button>`;
            }
        } else if (status === null) {
            html += `<span class="tag nomatch">No Match</span>`;
        } else {
            const u = usfoodsItems.find(x => x.id === status);
            html += `<span class="tag matched">${u.description}</span>`;
        }

        html += `</div>`;
        div.innerHTML = html;
        list.appendChild(div);
    });
}

function selectMatch(shamrockId, usfoodsId) {
    matches[shamrockId] = usfoodsId;
    saveProgress();
    updateCounts();
    renderList();
}

function markNoMatch(id) {
    matches[id] = null;
    saveProgress();
    updateCounts();
    renderList();
}

function clearSavedProgress() {
    if (confirm("Clear all saved matches?")) {
        localStorage.removeItem("matches");
        matches = {};
        updateCounts();
        renderList();
    }
}

function setFilter(f) {
    filterState = f;
    renderList();
}

function exportJSON() {
    const data = JSON.stringify(matches, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "matches.json";
    a.click();
}

function exportCSV() {
    const rows = [["shamrock_id", "usfoods_id"]];
    Object.keys(matches).forEach(id => {
        rows.push([id, matches[id]]);
    });

    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "matches.csv";
    a.click();
}

function importJSONFile() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = e => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = () => {
            matches = JSON.parse(reader.result);
            saveProgress();
            updateCounts();
            renderList();
        };
        reader.readAsText(file);
    };
    input.click();
}

document.addEventListener("DOMContentLoaded", loadData);
