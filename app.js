/* =========================================================
   PROJECT ARCHIVE
   CORE APPLICATION
========================================================= */

const STORAGE_KEY = "projectArchive_writings_v1";
const DRAFT_KEY = "projectArchive_draft_v1";

let writings = [];
let activeFilter = "all";
let activeWritingId = null;
let draftTimer = null;

/* =========================================================
   ELEMENTS
========================================================= */

const pages = {
    home: document.getElementById("homePage"),
    library: document.getElementById("libraryPage"),
    write: document.getElementById("writePage"),
    more: document.getElementById("morePage")
};

const titleInput = document.getElementById("writingTitle");
const contentInput = document.getElementById("writingContent");
const categoryInput = document.getElementById("writingCategory");
const wordCountElement = document.getElementById("wordCount");
const saveStatus = document.getElementById("saveStatus");

const libraryGrid = document.getElementById("libraryGrid");
const recentWriting = document.getElementById("recentWriting");
const librarySearch = document.getElementById("librarySearch");

const readingOverlay = document.getElementById("readingOverlay");
const sectionOverlay = document.getElementById("sectionOverlay");

/* =========================================================
   STORAGE
========================================================= */
// ============================================================
// PROJECT ARCHIVE — INDEXEDDB STORAGE ENGINE
// ============================================================

const DB_NAME = "ProjectArchiveDB";
const DB_VERSION = 1;
const DB_STORE = "writings";

function openArchiveDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            if (!db.objectStoreNames.contains(DB_STORE)) {
                db.createObjectStore(DB_STORE, { keyPath: "id" });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function getAllFromDB() {
    const db = await openArchiveDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(DB_STORE, "readonly");
        const store = transaction.objectStore(DB_STORE);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);

        transaction.oncomplete = () => db.close();
    });
}

async function saveAllToDB(items) {
    const db = await openArchiveDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(DB_STORE, "readwrite");
        const store = transaction.objectStore(DB_STORE);

        store.clear();

        items.forEach(item => {
            store.put(item);
        });

        transaction.oncomplete = () => {
            db.close();
            resolve(true);
        };

        transaction.onerror = () => {
            db.close();
            reject(transaction.error);
        };

        transaction.onabort = () => {
            db.close();
            reject(transaction.error);
        };
    });
}

async function migrateLocalStorageToDB() {
    const existingDBItems = await getAllFromDB();

    if (existingDBItems.length > 0) {
        return existingDBItems;
    }

    const oldData = localStorage.getItem(STORAGE_KEY);

    if (!oldData) {
        return [];
    }

    const oldWritings = JSON.parse(oldData);

    if (Array.isArray(oldWritings) && oldWritings.length > 0) {
        await saveAllToDB(oldWritings);
    }

    return oldWritings;
}

async function loadWritings() {
    try {
        return await migrateLocalStorageToDB();
    } catch (error) {
        console.error("Unable to load writings from IndexedDB:", error);
        return [];
    }
}

async function saveWritingsToStorage() {
    try {
        await saveAllToDB(writings);
        return true;
    } catch (error) {
        console.error("Unable to save writings to IndexedDB:", error);
        return false;
    }
}



function saveDraftToStorage() {
    const draft = {
        title: titleInput.value,
        content: contentInput.value,
        category: categoryInput.value,
        updatedAt: new Date().toISOString()
    };

    try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        saveStatus.textContent = "Draft saved";
    } catch (error) {
        saveStatus.textContent = "Unable to save";
        console.error(error);
    }
}

function loadDraft() {
    try {
        const storedDraft = localStorage.getItem(DRAFT_KEY);

        if (!storedDraft) return;

        const draft = JSON.parse(storedDraft);

        titleInput.value = draft.title || "";
        contentInput.value = draft.content || "";
        categoryInput.value = draft.category || "poetry";

        updateWordCount();
    } catch (error) {
        console.error("Unable to load draft:", error);
    }
}

/* =========================================================
   NAVIGATION
========================================================= */

function navigateTo(pageName) {
    if (!pages[pageName]) return;

    Object.values(pages).forEach(page => {
        page.classList.remove("active");
    });

    pages[pageName].classList.add("active");

    document.querySelectorAll(".nav-item").forEach(item => {
        item.classList.remove("active");
    });

    const selectedNav = document.querySelector(
        `.nav-item[data-page="${pageName}"]`
    );

    if (selectedNav) {
        selectedNav.classList.add("active");
    }

    if (pageName === "home") {
        renderRecent();
    }

    if (pageName === "library") {
        renderLibrary();
    }

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

document.querySelectorAll("[data-page]").forEach(button => {
    button.addEventListener("click", () => {
        const pageName = button.dataset.page;

        if (pageName === "write") {
            startNewWriting();
        }

        navigateTo(pageName);
    });
});

/* =========================================================
   EDITOR
========================================================= */

function startNewWriting() {
    activeWritingId = null;

    titleInput.value = "";
    contentInput.value = "";
    categoryInput.value = "poetry";

    loadDraft();

    updateWordCount();

    saveStatus.textContent = "Ready";
}

function startEditingWriting(id) {
    const writing = writings.find(item => item.id === id);

    if (!writing) return;

    activeWritingId = id;

    titleInput.value = writing.title;
    contentInput.value = writing.content;
    categoryInput.value = writing.category || "other";

    updateWordCount();

    readingOverlay.classList.remove("open");

    navigateTo("write");
}

function updateWordCount() {
    const text = contentInput.value.trim();

    if (!text) {
        wordCountElement.textContent = "0 words";
        return;
    }

    const words = text.split(/\s+/).filter(Boolean).length;

    wordCountElement.textContent =
        `${words} ${words === 1 ? "word" : "words"}`;
}

function scheduleDraftSave() {
    saveStatus.textContent = "Saving...";

    updateWordCount();

    clearTimeout(draftTimer);

    draftTimer = setTimeout(() => {
        saveDraftToStorage();
    }, 500);
}

titleInput.addEventListener("input", scheduleDraftSave);
contentInput.addEventListener("input", scheduleDraftSave);
categoryInput.addEventListener("change", scheduleDraftSave);

document.getElementById("saveWritingButton").addEventListener("click", saveWriting);

async function saveWriting() {
    const title = titleInput.value.trim();
    const content = contentInput.value.trim();
    const category = categoryInput.value;

    if (!title && !content) {
        alert("Write something first before saving.");
        return;
    }

    const now = new Date().toISOString();

    if (activeWritingId) {
        const existing = writings.find(
            item => item.id === activeWritingId
        );

        if (existing) {
            existing.title = title || "Untitled";
            existing.content = content;
            existing.category = category;
            existing.updatedAt = now;
        }
    } else {
        const writing = {
            id: generateId(),
            title: title || "Untitled",
            content: content,
            category: category,
            createdAt: now,
            updatedAt: now
        };

        writings.unshift(writing);

        activeWritingId = writing.id;
    }

    if (!(await saveWritingsToStorage())) {
        alert("Your writing could not be saved to storage.");
        return;
    }
    localStorage.removeItem(DRAFT_KEY);

    saveStatus.textContent = "Saved";

    renderLibrary();
    renderRecent();

    alert("Your writing has been saved to your Library.");

    navigateTo("library");
}

function generateId() {
    return (
        Date.now().toString(36) +
        Math.random().toString(36).slice(2, 9)
    );
}

document.getElementById("clearDraftButton").addEventListener("click", () => {
    const confirmed = confirm(
        "Clear this page? Unsaved draft content will be erased."
    );

    if (!confirmed) return;

    titleInput.value = "";
    contentInput.value = "";
    categoryInput.value = "poetry";

    activeWritingId = null;

    localStorage.removeItem(DRAFT_KEY);

    updateWordCount();

    saveStatus.textContent = "Cleared";
});

/* =========================================================
   LIBRARY
========================================================= */

function renderLibrary() {
    const searchTerm = librarySearch.value.toLowerCase().trim();

    const filteredWritings = writings.filter(writing => {
        const matchesCategory =
            activeFilter === "all" ||
            writing.category === activeFilter;

        const matchesSearch =
            writing.title.toLowerCase().includes(searchTerm) ||
            writing.content.toLowerCase().includes(searchTerm);

        return matchesCategory && matchesSearch;
    });

    if (filteredWritings.length === 0) {
        const isEmpty = writings.length === 0;

        libraryGrid.innerHTML = `
            <div class="empty-state library-empty">
                <span class="empty-symbol">✧</span>
                <h3>${isEmpty ? "Your library is waiting." : "Nothing found."}</h3>
                <p>
                    ${
                        isEmpty
                        ? "Write something and it will appear here."
                        : "Try another search or category."
                    }
                </p>
                ${
                    isEmpty
                    ? `<button class="primary-button" data-library-write>
                        Write something <span>↗</span>
                       </button>`
                    : ""
                }
            </div>
        `;

        const writeButton = libraryGrid.querySelector("[data-library-write]");

        if (writeButton) {
            writeButton.addEventListener("click", () => {
                startNewWriting();
                navigateTo("write");
            });
        }

        return;
    }

    libraryGrid.innerHTML = filteredWritings.map((writing, index) => {
        const category = writing.category || "other";
        const coverClass = getBookColorClass(writing.id);
        const formattedDate = formatDate(writing.updatedAt);

        return `
            <article class="book-card" data-id="${escapeHTML(writing.id)}">

                <div class="book-object ${coverClass}">

                    <div class="book-spine">
                        <span class="book-spine-title">
                            ${escapeHTML(writing.title || "Untitled")}
                        </span>

                        <span class="book-spine-category">
                            ${escapeHTML(category)}
                        </span>
                    </div>

                </div>

                <div class="book-info">
                    <p>${escapeHTML(formattedDate)}</p>
                </div>

            </article>
        `;
    }).join("");

    libraryGrid.querySelectorAll(".book-card").forEach(card => {
        card.addEventListener("click", () => {
            openReading(card.dataset.id);
        });
    });
}

function getCoverClass(category, index) {
    const categoryClasses = {
        poetry: "cover-poetry",
        story: "cover-story",
        essay: "cover-essay",
        thought: "cover-thought",
        other: "cover-other"
    };

    if (categoryClasses[category]) {
        return categoryClasses[category];
    }

    return `cover-${(index % 3) + 1}`;
}

function getBookColorClass(id) {
    const palette = [
        "book-color-1",
        "book-color-2",
        "book-color-3",
        "book-color-4",
        "book-color-5",
        "book-color-6",
        "book-color-7",
        "book-color-8",
        "book-color-9",
        "book-color-10",
        "book-color-11",
        "book-color-12"
    ];

    let hash = 0;

    for (let i = 0; i < String(id).length; i++) {
        hash = ((hash << 5) - hash + String(id).charCodeAt(i)) | 0;
    }

    return palette[Math.abs(hash) % palette.length];
}

document.querySelectorAll("[data-filter]").forEach(button => {
    button.addEventListener("click", () => {
        activeFilter = button.dataset.filter;

        document.querySelectorAll(".filter-button").forEach(filter => {
            filter.classList.remove("active");
        });

        button.classList.add("active");

        renderLibrary();
    });
});

librarySearch.addEventListener("input", renderLibrary);

/* =========================================================
   RECENT WRITINGS
========================================================= */

function renderRecent() {
    const recent = [...writings]
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .slice(0, 3);

    if (recent.length === 0) {
        recentWriting.innerHTML = `
            <div class="empty-state">
                <span class="empty-symbol">✧</span>
                <p>Your words will find their home here.</p>
            </div>
        `;

        return;
    }

    recentWriting.innerHTML = recent.map(writing => `
        <article class="recent-item" data-id="${escapeHTML(writing.id)}">

            <div class="recent-cover">
                ✧
            </div>

            <div class="recent-info">

                <h3>
                    ${escapeHTML(writing.title || "Untitled")}
                </h3>

                <p>
                    ${escapeHTML(writing.category || "other")}
                    ·
                    ${escapeHTML(formatDate(writing.updatedAt))}
                </p>

            </div>

        </article>
    `).join("");

    recentWriting.querySelectorAll(".recent-item").forEach(item => {
        item.addEventListener("click", () => {
            openReading(item.dataset.id);
        });
    });
}

/* =========================================================
   READING MODE
========================================================= */

function openReading(id) {
    const writing = writings.find(item => item.id === id);

    if (!writing) return;

    activeWritingId = writing.id;

    document.getElementById("readingTitle").textContent =
        writing.title || "Untitled";

    document.getElementById("readingCategory").textContent =
        (writing.category || "other").toUpperCase();

    document.getElementById("readingDate").textContent =
        formatDate(writing.updatedAt);

    document.getElementById("readingBody").textContent =
        writing.content || "";

    readingOverlay.classList.add("open");
}

document.getElementById("closeReadingButton").addEventListener("click", () => {
    readingOverlay.classList.remove("open");
});

document.getElementById("editReadingButton").addEventListener("click", () => {
    if (!activeWritingId) return;

    startEditingWriting(activeWritingId);
});

/* =========================================================
   MORE SECTIONS
========================================================= */

const sectionContent = {
    journal: {
        title: "Journal",
        description: "A space for everyday entries and moments.",
        content: `
            <p>
                Your journal entries will have their own home here.
                We'll build a dedicated journal system in a later stage.
            </p>
        `
    },

    fragments: {
        title: "Fragments",
        description: "A home for lines, unfinished ideas, and little pieces.",
        content: `
            <p>
                Save small pieces of writing without needing to turn
                them into a complete story or poem.
            </p>
        `
    },

    collections: {
        title: "Collections",
        description: "Gather your writings into meaningful collections.",
        content: `
            <p>
                Collections will let you group your writing into
                personal shelves, themes, or projects.
            </p>
        `
    },

    archive: {
        title: "Archive",
        description: "Keep pieces without cluttering your main Library.",
        content: `
            <p>
                Archived writings will be kept separately and
                remain available whenever you need them.
            </p>
        `
    }
};

document.querySelectorAll("[data-section]").forEach(button => {
    button.addEventListener("click", () => {
        openSection(button.dataset.section);
    });
});

function openSection(sectionName) {
    const section = sectionContent[sectionName];

    if (!section) return;

    document.getElementById("sectionModalContent").innerHTML = `
        <p class="eyebrow">PROJECT ARCHIVE</p>

        <h1>${escapeHTML(section.title)}</h1>

        <p>${escapeHTML(section.description)}</p>

        <div class="section-content-list">
            <div class="section-content-item">
                ${section.content}
            </div>
        </div>
    `;

    sectionOverlay.classList.add("open");
}

document.getElementById("closeSectionButton").addEventListener("click", () => {
    sectionOverlay.classList.remove("open");
});

/* =========================================================
   UTILITIES
========================================================= */

function formatDate(dateString) {
    if (!dateString) return "Recently";

    const date = new Date(dateString);

    if (isNaN(date.getTime())) return "Recently";

    return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric"
    });
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, character => {
        const map = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };

        return map[character];
    });
}

/* =========================================================
   INITIALIZATION
========================================================= */
async function initializeArchive() {
    writings = await loadWritings();

    loadDraft();
    updateWordCount();
    renderLibrary();
    renderRecent();

    navigateTo("home");

    console.log("Project Archive initialized.");
}

initializeArchive();


/* =========================================================
   SERVICE WORKER REGISTRATION
========================================================= */

if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./service-worker.js")
            .then(registration => {
                console.log(
                    "Project Archive offline system ready:",
                    registration.scope
                );
            })
            .catch(error => {
                console.error(
                    "Service worker registration failed:",
                    error
                );
            });
    });
}