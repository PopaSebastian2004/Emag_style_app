// ============================
// Variabile globale si utilitare
// ============================
let currentFilter = { mine: true }; // Filtru curent (review-urile mele sau pe categorie)
let reviewsTitle = null;            // Referinta la titlul sectiunii de review-uri
let allReviews = [];                // Toate review-urile incarcate din backend
let lightboxImages = [];            // Imagini pentru lightbox
let lightboxIndex = 0;              // Indexul imaginii curente din lightbox
let currentUser = null;             // Utilizatorul curent
let currentSort = "recent";         // Sortarea curenta a review-urilor
let currentSearchEntity = "";       // Cautare dupa nume produs

// =================================
// Functii utilitare UI
// =================================
function showPopup(id) {
    document.getElementById(id).style.display = "block";
    document.body.classList.add("popup-open");
}
function hidePopup(id) {
    document.getElementById(id).style.display = "none";
    document.body.classList.remove("popup-open");
}
function clearPopupForm(id) {
    const form = document.querySelector(`#${id} form`);
    if (form) form.reset();
}
// Escapare HTML pentru a preveni XSS in afisare
function escapeHTML(str) {
    return (str || '').replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
}
// Afisare stelute rating
function renderStars(rating, max = 5) {
    rating = parseFloat(rating) || 0;
    let out = '';
    for (let i = 1; i <= max; i++) {
        let fill = Math.min(1, Math.max(0, rating - i + 1));
        if (fill === 1) {
            out += '<span class="star full"></span>';
        } else if (fill === 0) {
            out += '<span class="star empty"></span>';
        } else {
            out += `<span class="star partial" style="--star-fill:${(fill * 100).toFixed(0)}%"></span>`;
        }
    }
    return out;
}

// =================================
// Initializare la incarcarea paginii
// =================================
document.addEventListener("DOMContentLoaded", () => {
    // Referinte la elemente principale
    const usernameSpan = document.getElementById("username");
    const reviewsContainer = document.getElementById("reviews-container");
    reviewsTitle = document.getElementById("reviews-title");
    const searchEntityInput = document.getElementById("search-entity");
    const sortReviewsSelect = document.getElementById("sort-reviews");

    // ====================== Filtrare/SORTARE UI ==========================
    if (searchEntityInput && sortReviewsSelect) {
        searchEntityInput.addEventListener("input", function () {
            currentSearchEntity = this.value.trim().toLowerCase();
            renderFilteredAndSortedReviews();
        });
        sortReviewsSelect.addEventListener("change", function () {
            currentSort = this.value;
            renderFilteredAndSortedReviews();
        });
    }

    // ======================= EXPORT CSV (server-side, date corecte) ==================
    document.getElementById("export-csv-btn").onclick = function () {
        fetch("/export-csv")
            .then(res => res.text())
            .then(csv => {
                const blob = new Blob([csv], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "inventar_reviews.csv";
                a.click();
                URL.revokeObjectURL(url);
            });
    };

    // ======================= EXPORT JSON (client-side) ==================
    document.getElementById("export-json-btn").onclick = function () {
        fetch("/get-reviews")
            .then(res => res.json())
            .then(data => {
                const str = JSON.stringify(data, null, 2);
                const blob = new Blob([str], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "inventar_reviews.json";
                a.click();
                URL.revokeObjectURL(url);
            });
    };

    // ======================= IMPORT CSV/JSON (popup unic) ==================
    document.getElementById("import-csv-btn").onclick = () => showImportPopup("csv");
    document.getElementById("import-json-btn").onclick = () => showImportPopup("json");

    function showImportPopup(type) {
        const popup = document.getElementById("import-popup");
        popup.style.display = "block";
        document.body.classList.add("popup-open");
        popup.querySelector("h2").textContent = `Importă date (${type.toUpperCase()})`;
        popup.querySelector("#import-file").accept = type === "csv" ? ".csv,text/csv" : ".json,application/json";
        popup.dataset.type = type;
    }
    document.getElementById("close-import-popup").onclick = () => {
        document.getElementById("import-popup").style.display = "none";
        document.body.classList.remove("popup-open");
    };
    document.getElementById("import-form").onsubmit = function (e) {
        e.preventDefault();
        const popup = document.getElementById("import-popup");
        const type = popup.dataset.type;
        const fileInput = document.getElementById("import-file");
        const errMsg = document.getElementById("import-err-msg");
        errMsg.style.display = "none";
        if (!fileInput.files.length) return;
        const formData = new FormData();
        formData.append("file", fileInput.files[0]);
        fetch(`/import-${type}`, { method: "POST", body: formData })
            .then(res => res.text().then(msg => ({ ok: res.ok, msg })))
            .then(({ ok, msg }) => {
                if (!ok) {
                    errMsg.textContent = msg;
                    errMsg.style.display = "block";
                    return;
                }
                popup.style.display = "none";
                document.body.classList.remove("popup-open");
                loadReviews(currentFilter);
            });
    };

    // ======================= EXPORT PDF ==================
    document.getElementById("export-pdf-btn").onclick = function () {
        fetch("/get-reviews")
            .then(res => res.json())
            .then(data => {
                // Incarca jsPDF daca nu exista deja si apoi genereaza PDF
                if (typeof window.jspdf === "undefined" || !window.jspdf) {
                    const script = document.createElement("script");
                    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
                    script.onload = genPdf;
                    document.body.appendChild(script);
                } else genPdf();
                function genPdf() {
                    const { jsPDF } = window.jspdf || window.jspdf_umd;
                    const doc = new jsPDF();
                    doc.setFontSize(13);
                    doc.text("Inventar Reviews", 15, 15);
                    let y = 25;
                    doc.setFontSize(10);
                    doc.text("Id", 10, y);
                    doc.text("Entitate", 25, y);
                    doc.text("Categorie", 65, y);
                    doc.text("Nota", 105, y);
                    doc.text("Autor", 125, y);
                    doc.text("Comentariu", 150, y);
                    y += 7;
                    for (const r of data) {
                        if (y > 270) { doc.addPage(); y = 20; }
                        doc.text(String(r.id), 10, y);
                        doc.text(String(r.entity), 25, y, { maxWidth: 35 });
                        doc.text(String(r.category), 65, y, { maxWidth: 35 });
                        doc.text(String(Number(r.avg_rating).toFixed(2)), 105, y);
                        doc.text(String(r.username), 125, y, { maxWidth: 23 });
                        doc.text(String(r.comment || "").substring(0, 45), 150, y, { maxWidth: 55 });
                        y += 7;
                    }
                    doc.save("inventar_reviews.pdf");
                }
            });
    };

    // ======================= POPUP STATISTICI ==================
    const statsBtn = document.getElementById("stats-btn");
    const statsContent = document.getElementById("stats-content");
    document.getElementById("close-stats-popup").onclick = () => hidePopup("stats-popup");
    statsBtn.onclick = function () {
        statsContent.innerHTML = "<p>Se încarcă statistici...</p>";
        showPopup("stats-popup");
        fetch("/get-reviews")
            .then(res => res.json())
            .then(reviews => {
                if (!reviews.length) { statsContent.innerHTML = "<p>Nu există date.</p>"; return; }
                // Statistici: review-uri pe categorie, pe utilizator, medii pe categorie
                const byCat = {}, byUser = {}, ratingsCat = {};
                for (const r of reviews) {
                    byCat[r.category] = (byCat[r.category] || 0) + 1;
                    byUser[r.username] = (byUser[r.username] || 0) + 1;
                    ratingsCat[r.category] = ratingsCat[r.category] || [];
                    ratingsCat[r.category].push(Number(r.avg_rating));
                }
                let out = `<b>Total review-uri:</b> ${reviews.length}<br><br>`;
                out += `<b>Pe categorii:</b><ul>`;
                for (const k in byCat) out += `<li><b>${escapeHTML(k)}:</b> ${byCat[k]}</li>`;
                out += "</ul>";
                out += `<b>Medie notă pe categorie:</b><ul>`;
                for (const k in ratingsCat) {
                    let medie = (ratingsCat[k].reduce((a, b) => a + b, 0) / ratingsCat[k].length).toFixed(2);
                    out += `<li><b>${escapeHTML(k)}:</b> ${medie}</li>`;
                }
                out += "</ul>";
                out += `<b>Top utilizatori (nr. review-uri):</b><ul>`;
                let topUsers = Object.entries(byUser).sort((a, b) => b[1] - a[1]).slice(0, 5);
                for (const [u, n] of topUsers)
                    out += `<li><b>${escapeHTML(u)}:</b> ${n}</li>`;
                out += "</ul>";
                statsContent.innerHTML = out;
            });
    };

    // ======================= POPUP CLASAMENT ==================
    const clasamentBtn = document.getElementById("clasament-btn");
    const clasamentContent = document.getElementById("clasament-content");
    document.getElementById("close-clasament-popup").onclick = () => hidePopup("clasament-popup");
    clasamentBtn.onclick = function () {
        clasamentContent.innerHTML = "<p>Se încarcă clasamentul...</p>";
        showPopup("clasament-popup");
        fetch("/get-reviews")
            .then(res => res.json())
            .then(reviews => {
                if (!reviews.length) { clasamentContent.innerHTML = "<p>Nu există date.</p>"; return; }
                // Grupare entitati cu notele lor (inclusiv din comentarii)
                const entities = {};
                for (const r of reviews) {
                    const key = r.category + "|" + r.entity;
                    if (!entities[key]) entities[key] = { notes: [], category: r.category, entity: r.entity };
                    entities[key].notes.push(Number(r.rating));
                    if (r.comments && r.comments.length) {
                        for (const c of r.comments) {
                            if (c.rating) entities[key].notes.push(Number(c.rating));
                        }
                    }
                }
                let arr = [];
                for (const k in entities) {
                    let allNotes = entities[k].notes.filter(x => !isNaN(x));
                    if (allNotes.length > 2) {
                        let avg = allNotes.reduce((a, b) => a + b, 0) / allNotes.length;
                        arr.push({ entity: entities[k].entity, category: entities[k].category, avg: avg, count: allNotes.length });
                    }
                }
                let top = arr.sort((a, b) => b.avg - a.avg).slice(0, 5);
                let flop = [...arr].sort((a, b) => a.avg - b.avg).slice(0, 5);
                let html = "<b>Top 5 cele mai bine cotate entități (min 3 review-uri):</b><ol>";
                for (const x of top) html += `<li><span class="clasament-cat">${escapeHTML(x.category)}</span> &mdash; <b>${escapeHTML(x.entity)}</b> (${x.count} review-uri) — <span style="color:#388e3c;">${x.avg.toFixed(2)}/5</span></li>`;
                html += "</ol>";
                html += "<b>Top 5 cele mai detestate entități (min 3 review-uri):</b><ol>";
                for (const x of flop) html += `<li><span class="clasament-cat">${escapeHTML(x.category)}</span> &mdash; <b>${escapeHTML(x.entity)}</b> (${x.count} review-uri) — <span style="color:#d32f2f;">${x.avg.toFixed(2)}/5</span></li>`;
                html += "</ol>";
                clasamentContent.innerHTML = html;
            });
    };

    // ======================= FILTRARE: autocomplete lista categorii ==================
    let allCategories = [];
    function fetchAllCategories() {
        fetch("/get-reviews")
            .then(res => res.json())
            .then(reviews => {
                allCategories = Array.from(new Set(reviews.map(r => r.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ro"));
                renderAllCategoriesList(allCategories);
            });
    }
    fetchAllCategories();

    const filterCategoryInput = document.getElementById("filter-category");
    const filterCategoryList = document.getElementById("filter-category-list");
    const allCategoriesList = document.getElementById("all-categories-list");

    function renderAllCategoriesList(filtered) {
        allCategoriesList.innerHTML = "";
        filtered.forEach(cat => {
            const span = document.createElement("span");
            span.className = "cat-badge";
            span.textContent = cat;
            span.onclick = () => {
                filterCategoryInput.value = cat;
                filterCategoryInput.focus();
                renderAllCategoriesList([cat]);
            };
            allCategoriesList.appendChild(span);
        });
    }

    filterCategoryInput.addEventListener("input", () => {
        const val = filterCategoryInput.value.trim().toLowerCase();
        const filtered = allCategories.filter(cat => cat.toLowerCase().startsWith(val));
        renderAllCategoriesList(filtered);
    });

    document.getElementById("filter-popup-btn").addEventListener("click", () => {
        setTimeout(() => {
            filterCategoryInput.value = "";
            renderAllCategoriesList(allCategories);
        }, 100);
    });

    // ======================= RSS BUTTON ==================
    document.getElementById("rss-btn").onclick = function () {
        window.open("/clasament.rss", "_blank");
    };

    // ======================= PROFIL si ADMIN menu ==================
    const profileBtn = document.getElementById("profile-dropdown-btn");
    const profileMenu = document.getElementById("profile-dropdown-menu");
    const adminMenuBtn = document.getElementById("admin-menu-btn");
    profileBtn.onclick = (e) => {
        e.stopPropagation();
        profileMenu.classList.toggle("open");
    };
    document.body.addEventListener("click", () => {
        profileMenu.classList.remove("open");
    });

    if (adminMenuBtn) {
        adminMenuBtn.onclick = () => {
            window.location.href = "/admin";
        };
    }

    // ======================= Editare profil ==================
    document.getElementById("edit-profile-btn").onclick = () => {
        if (currentUser) {
            document.getElementById("edit-username").value = currentUser.username;
            document.getElementById("edit-email").value = currentUser.email;
        }
        showPopup("edit-profile-popup");
    };

    // ======================= Lista review-urilor mele (popup) ==================
    document.getElementById("my-reviews-btn").onclick = () => {
        fetch("/get-my-reviews")
            .then(res => res.json())
            .then(reviews => {
                const ul = document.getElementById("my-reviews-list");
                ul.innerHTML = "";
                if (!reviews.length) {
                    ul.innerHTML = "<p>Nu ai review-uri.</p>";
                    return;
                }
                for (let review of reviews) {
                    const li = document.createElement("li");
                    li.className = "review-list-item";
                    li.innerHTML = `
    <div class="review-list-header">
        <span class="review-cat-label"><b>Categoria:</b> ${escapeHTML(review.category)}</span>
        <span class="review-prod-label"><b>Produs:</b> ${escapeHTML(review.entity)}</span>
    </div>
    <div class="review-comment">${escapeHTML(review.comment)}</div>
    <button class="delete-my-review-btn" data-id="${review.id}">Șterge</button>
`;
                    ul.appendChild(li);
                }
                ul.querySelectorAll(".delete-my-review-btn").forEach(btn => {
                    btn.onclick = function () {
                        if (!confirm("Ești sigur că vrei să ștergi acest review?")) return;
                        fetch(`/delete-review?id=${btn.dataset.id}`, { method: "DELETE" })
                            .then(r => r.text())
                            .then(msg => {
                                btn.closest("li").remove();
                                loadReviews(currentFilter);
                            });
                    };
                });
                showPopup("my-reviews-popup");
            });
    };

    // ======================= Lista comentariilor mele (popup) ==================
    document.getElementById("my-comments-btn").onclick = () => {
        fetch("/get-my-comments")
            .then(res => res.json())
            .then(comments => {
                const ul = document.getElementById("my-comments-list");
                ul.innerHTML = "";
                if (!comments.length) {
                    ul.innerHTML = "<p>Nu ai comentarii.</p>";
                    return;
                }
                for (let c of comments) {
                    const li = document.createElement("li");
                    li.className = "comment-list-item";
                    li.innerHTML = `
    <div class="comment-list-header">
        <span class="comment-cat-label"><b>Categoria:</b> ${escapeHTML(c.category || "")}</span>
        <span class="comment-prod-label"><b>Produs:</b> ${escapeHTML(c.entity || "review")}</span>
    </div>
    <div class="comment-comment">${escapeHTML(c.comment)}</div>
    <button class="delete-my-comment-btn" data-id="${c.id}">Șterge</button>
`;
                    ul.appendChild(li);
                }
                ul.querySelectorAll(".delete-my-comment-btn").forEach(btn => {
                    btn.onclick = function () {
                        if (!confirm("Ești sigur că vrei să ștergi acest comentariu?")) return;
                        fetch(`/delete-comment?id=${btn.dataset.id}`, { method: "DELETE" })
                            .then(r => r.text())
                            .then(msg => {
                                btn.closest("li").remove();
                                loadReviews(currentFilter);
                            });
                    };
                });
                showPopup("my-comments-popup");
            });
    };

    // ======================= Inchidere popups ==================
    document.getElementById("close-edit-profile-popup").onclick = () => hidePopup("edit-profile-popup");
    document.getElementById("close-my-reviews-popup").onclick = () => hidePopup("my-reviews-popup");
    document.getElementById("close-my-comments-popup").onclick = () => hidePopup("my-comments-popup");

    document.getElementById("filter-popup-btn").onclick = () => {
        if (currentFilter.category) {
            currentFilter = { mine: true };
            reviewsTitle.textContent = "Review-urile tale";
            loadReviews(currentFilter);
            hidePopup("filter-popup");
        } else showPopup("filter-popup");
    };
    document.getElementById("add-review-popup-btn").onclick = () => showPopup("add-review-popup");
    document.getElementById("close-filter-popup").onclick = () => hidePopup("filter-popup");
    document.getElementById("close-add-review-popup").onclick = () => hidePopup("add-review-popup");
    document.getElementById("close-comment-popup").onclick = () => hidePopup("comment-popup");
    document.getElementById("close-add-comment-popup").onclick = () => hidePopup("add-comment-popup");

    // ======================= Autentificare utilizator si meniu admin ==================
    fetch("/get-user").then(r => r.json()).then(data => {
        if (data.username) {
            currentUser = data;
            if (usernameSpan) usernameSpan.textContent = data.username;
            reviewsTitle.textContent = "Review-urile tale";
            currentFilter = { mine: true };
            loadReviews(currentFilter);

            // Arata butonul admin doar daca utilizatorul e admin
            fetch('/admin/users').then(res => {
                if (!res.ok) return;
                return res.json();
            }).then(users => {
                if (!users) return;
                const me = users.find(u => u.id === currentUser.id);
                if (me && me.isadmin && adminMenuBtn) {
                    adminMenuBtn.style.display = 'block';
                }
            });
        } else window.location.href = "/";
    });

    // ======================= Filtrare dupa categorie (form) ==================
    document.getElementById("filter-form").onsubmit = (e) => {
        e.preventDefault();
        const category = document.getElementById("filter-category").value.trim();
        if (!category) {
            reviewsTitle.textContent = "Review-urile tale";
            currentFilter = { mine: true };
            loadReviews(currentFilter);
        } else {
            reviewsTitle.textContent = `Review-uri pentru categoria "${category}"`;
            currentFilter = { category };
            loadReviews(currentFilter);
        }
        hidePopup("filter-popup");
    };

    // ======================= Adauga review nou ==================
    document.getElementById("review-form").onsubmit = (e) => {
        e.preventDefault();
        const entity = document.getElementById("entity").value;
        const category = document.getElementById("category").value;
        const rating = document.getElementById("rating").value;
        const comment = document.getElementById("comment").value;
        const imgInput = document.getElementById("review-images");
        const errorMsg = document.getElementById("review-error-msg");
        errorMsg.style.display = "none";
        errorMsg.textContent = "";
      
        if (entity.length > 15) {
            errorMsg.textContent = "Numele produsului nu poate avea mai mult de 15 caractere!";
            errorMsg.style.display = "block";
            return;
        }
        if (category.length > 15) {
            errorMsg.textContent = "Numele categoriei nu poate avea mai mult de 15 caractere!";
            errorMsg.style.display = "block";
            return;
        }
        if (imgInput.files.length > 3) {
            errorMsg.textContent = "Poti incarca maxim 3 poze!";
            errorMsg.style.display = "block";
            return;
        }
        const formData = new FormData();
        formData.append("entity", entity);
        formData.append("category", category);
        formData.append("rating", rating);
        formData.append("comment", comment);
        for (let i = 0; i < imgInput.files.length; i++) {
            formData.append("images", imgInput.files[i]);
        }
        fetch("/add-review", { method: "POST", body: formData })
            .then(res => res.text().then(msg => ({ ok: res.ok, msg })))
            .then(({ ok, msg }) => {
                if (!ok && (msg.includes("Exista deja") || msg.includes("Ai deja"))) {
                    errorMsg.textContent = msg;
                    errorMsg.style.display = "block";
                    return;
                }
                clearPopupForm("add-review-popup");
                hidePopup("add-review-popup");
                currentFilter = { mine: true };
                reviewsTitle.textContent = "Review-urile tale";
                loadReviews(currentFilter);
            })
            .catch(() => {
                errorMsg.textContent = "Eroare la adăugarea review-ului!";
                errorMsg.style.display = "block";
            });
    };
    document.getElementById("review-images").onchange = function () {
        document.getElementById("image-count").textContent =
            `Incărcat(e): ${this.files.length}/3`;
        if (this.files.length > 3) {
            alert("Poti incarca maxim 3 poze!");
            this.value = "";
            document.getElementById("image-count").textContent = "Poti incarca maxim 3 poze.";
        }
    };

    // ======================= Click pe review => popup detalii & comentarii ==================
    reviewsContainer.onclick = function (e) {
        let li = e.target.closest("li[data-review-id]");
        if (!li) return;
        let review = li.reviewData;
        showReviewPopup(review);
    };

    // ======================= Lightbox galerie imagini ==================
    document.body.addEventListener("click", function (e) {
        if (e.target.classList.contains("lightbox-bg")) hideLightbox();
        if (e.target.classList.contains("lightbox-arrow-left")) lightboxMove(-1);
        if (e.target.classList.contains("lightbox-arrow-right")) lightboxMove(1);
        if (e.target.classList.contains("lightbox-close")) hideLightbox();
    });
    document.body.addEventListener("keydown", function (e) {
        if (!document.getElementById("lightbox")?.classList.contains("open")) return;
        if (e.key === "ArrowLeft") lightboxMove(-1);
        if (e.key === "ArrowRight") lightboxMove(1);
        if (e.key === "Escape") hideLightbox();
    });

    // ======================= Logout si documentatie ==================
    document.getElementById("logout-btn").onclick = () => {
        fetch("/logout", { method: "POST" }).then(() => window.location.href = "/");
    };
    document.getElementById("see-doc-btn").onclick = () => {
        window.open("/pages/ScholarlyHTML_documentatie.html", "_blank");
    };

    // ======================= Editare profil (submit) ==================
    document.getElementById("edit-profile-form").onsubmit = function (e) {
        e.preventDefault();
        const errorMsg = document.getElementById("edit-profile-error-msg");
        if (errorMsg) errorMsg.style.display = "none";
        const formData = {
            username: document.getElementById("edit-username").value,
            email: document.getElementById("edit-email").value,
            password: document.getElementById("edit-password").value
        };
        fetch("/edit-profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData)
        })
            .then(res => res.text().then(msg => ({ ok: res.ok, status: res.status, msg })))
            .then(({ ok, status, msg }) => {
                if (!ok) {
                    if (errorMsg) {
                        errorMsg.textContent = msg;
                        errorMsg.style.display = "block";
                    } else {
                        alert(msg);
                    }
                    return;
                }
                hidePopup("edit-profile-popup");
                fetch("/get-user").then(r => r.json()).then(data => {
                    if (data.username) {
                        currentUser = data;
                        usernameSpan.textContent = data.username;
                    }
                });
            })
            .catch(() => {
                if (errorMsg) {
                    errorMsg.textContent = "Eroare la editarea profilului!";
                    errorMsg.style.display = "block";
                } else {
                    alert("Eroare la editarea profilului!");
                }
            });
    };

    // ======================= Incarcare review-uri + filtrare/sortare client ==================
    function loadReviews({ category = null, mine = false } = {}) {
        let url = "/get-reviews";
        if (category) url += "?category=" + encodeURIComponent(category);
        else if (mine) url += "?mine=1";
        fetch(url)
            .then(res => res.json())
            .then(reviews => {
                allReviews = reviews;
                renderFilteredAndSortedReviews();
            });
    }

    // ======================= Afisare review-uri filtrate/sortate pe client ==================
    function renderFilteredAndSortedReviews() {
        const reviewsContainer = document.getElementById("reviews-container");
        let reviews = allReviews.slice();
        if (currentSearchEntity) {
            reviews = reviews.filter(r =>
                (r.entity || "").toLowerCase().includes(currentSearchEntity)
            );
        }
        if (currentSort === "nota-desc") {
            reviews.sort((a, b) => parseFloat(b.avg_rating) - parseFloat(a.avg_rating));
        } else if (currentSort === "nota-asc") {
            reviews.sort((a, b) => parseFloat(a.avg_rating) - parseFloat(b.avg_rating));
        } else if (currentSort === "entity-asc") {
            reviews.sort((a, b) => (a.entity || "").localeCompare(b.entity || "", "ro"));
        } else if (currentSort === "entity-desc") {
            reviews.sort((a, b) => (b.entity || "").localeCompare(a.entity || "", "ro"));
        } else { // recent
            reviews.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }
        reviewsContainer.innerHTML = "";
        if (!reviews.length) {
            reviewsContainer.innerHTML = "<p>Nu exista review-uri.</p>";
            return;
        }
        for (let review of reviews) {
            const li = document.createElement("li");
            li.setAttribute("data-review-id", review.id);
            li.reviewData = review;
            li.innerHTML = `
                <div class="review-list-header">
                    <span class="review-list-category">${escapeHTML(review.category)}</span>
                    <span class="review-list-entity">${escapeHTML(review.entity)}</span>
                </div>
                <span class="review-list-user">de: ${escapeHTML(review.username)}</span>
                <div class="review-list-rating">${renderStars(review.avg_rating)} <span class="review-list-rating-val">${parseFloat(review.avg_rating).toFixed(2)}/5</span></div>
                <p class="review-list-comment">${escapeHTML(review.comment)}</p>
                <div class="review-images">
                ${(review.images && review.images.length) ? review.images.map((img, i) => `<img src="${img}" class="review-image" data-idx="${i}" data-imgs="${escapeHTML(JSON.stringify(review.images))}" alt="review-img">`).join("") : ""}
                </div>
            `;
            reviewsContainer.appendChild(li);
        }
    }

    // ======================= POPUP detaliu review (cu comentarii) ==================
    function showReviewPopup(review) {
        let commentSort = "desc";
        let ratingSort = null;
        let activeSort = "desc";
        let popupBody = document.getElementById("comment-popup-body");

        function renderComments() {
            let comments = review.comments.slice();
            if (ratingSort) {
                comments.sort((a, b) => {
                    let rA = a.rating == null ? -999 : Number(a.rating);
                    let rB = b.rating == null ? -999 : Number(b.rating);
                    return ratingSort === "asc" ? rA - rB : rB - rA;
                });
            } else {
                comments.sort((a, b) => commentSort === "asc" ?
                    new Date(a.created_at) - new Date(b.created_at) :
                    new Date(b.created_at) - new Date(a.created_at));
            }
            return comments.map((c, idx) => `
                <li class="comment-card">
                    <div class="comment-header wow-comment-header">
                        <span class="comment-by">Scris de: <span class="comment-username">${escapeHTML(c.username)}</span></span>
                        <span class="wow-comment-rating">
                            <span class="star-box star-box-small">${renderStars(c.rating)}</span>
                            <span class="comment-rating-badge">${c.rating ? `(${Number(c.rating).toFixed(1)}/5)` : "(fara nota)"}</span>
                        </span>
                        <span class="comment-date">${new Date(c.created_at).toLocaleString()}</span>
                    </div>
                    <div class="comment-body">${escapeHTML(c.comment)}</div>
                    <div class="comment-images">
                        ${(c.images && c.images.length) ? c.images.map((img, i) => `<img src="${img}" class="comment-image" data-idx="${i}" data-imgs="${escapeHTML(JSON.stringify(c.images))}" alt="comment-img">`).join("") : ""}
                    </div>
                </li>
            `).join("");
        }

        let nrReviewuri = (review.comments?.length || 0) + 1;
        let notaMedie = parseFloat(review.avg_rating).toFixed(2);
        let notaInitiala = review.rating ? Number(review.rating).toFixed(1) : "-";

        popupBody.innerHTML = `
            <div class="review-details-popup wow-review-details modern-review-popup">
                <div class="modern-review-header">
                  <div class="modern-review-icon">
                    <svg width="38" height="38" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="15" fill="#eaf4ff"/><path d="M10 14h12v8a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2v-8z" fill="#007bff"/><path d="M16 14a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" fill="#007bff"/></svg>
                  </div>
                  <div class="modern-review-title">
                   <div><b>Produs:</b> ${escapeHTML(review.entity)}</div>
                   <div><b>Categoria:</b> ${escapeHTML(review.category)}</div>
                  </div>
                </div>
                <div class="modern-review-meta">
                  <span class="modern-review-user"><b>${escapeHTML(review.username)}</b></span>
                  <span class="modern-review-date">${review.created_at ? new Date(review.created_at).toLocaleDateString() : ""}</span>
                </div>
                <div class="modern-review-rating-row">
                  <span class="modern-review-label">Nota medie:</span>
                  <span class="star-box star-box-main">${renderStars(review.avg_rating)}</span>
                  <span class="modern-review-main-val">${notaMedie}</span>
                  <span class="modern-review-count">(${nrReviewuri} review-uri)</span>
                  <span class="modern-review-label" style="margin-left:18px;">Nota inițială:</span>
                  <span class="star-box modern-initial-stars">${renderStars(review.rating)}</span>
                  <span class="modern-initial-val">${notaInitiala}/5</span>
                </div>
                <div class="modern-main-comment">
                  <div class="modern-comment-label">Comentariu:</div>
                  <p>${escapeHTML(review.comment)}</p>
                </div>
                <div class="review-images review-gallery modern-review-gallery">
                  ${(review.images && review.images.length) ? review.images.map((img, i) => `<img src="${img}" alt="review-img" class="review-image" data-idx="${i}" data-imgs="${escapeHTML(JSON.stringify(review.images))}">`).join("") : ""}
                </div>
            </div>
            <div class="comments-section">
                <div class="comments-header">
                    <h4 style="color:#007bff;font-size:1.25em;margin-bottom:0;margin-top:0;">Comentarii</h4>
                    <div class="comments-sort">
                        <span>Sortează:</span>
                        <button class="sort-btn ${activeSort === "desc" && !ratingSort ? "active" : ""}" data-sort="desc">Noi</button>
                        <button class="sort-btn ${activeSort === "asc" && !ratingSort ? "active" : ""}" data-sort="asc">Vechi</button>
                        <button class="sort-btn ${activeSort === "rating-desc" ? "active" : ""}" data-sort="rating-desc">Nota mare</button>
                        <button class="sort-btn ${activeSort === "rating-asc" ? "active" : ""}" data-sort="rating-asc">Nota mică</button>
                    </div>
                </div>
                <ul class="comments-list">
                    ${renderComments()}
                </ul>
            </div>
            <div style="text-align:center;margin:18px 0;">
                <button class="add-comment-btn" id="add-comment-btn-popup">Adaugă comentariu</button>
            </div>
        `;

        popupBody.querySelectorAll(".sort-btn").forEach(btn => {
            btn.onclick = function () {
                popupBody.querySelectorAll(".sort-btn").forEach(b => b.classList.remove("active"));
                this.classList.add("active");
                if (this.dataset.sort === "desc") { commentSort = "desc"; ratingSort = null; activeSort = "desc"; }
                else if (this.dataset.sort === "asc") { commentSort = "asc"; ratingSort = null; activeSort = "asc"; }
                else if (this.dataset.sort === "rating-desc") { ratingSort = "desc"; commentSort = null; activeSort = "rating-desc"; }
                else if (this.dataset.sort === "rating-asc") { ratingSort = "asc"; commentSort = null; activeSort = "rating-asc"; }
                popupBody.querySelector(".comments-list").innerHTML = renderComments();
                addCommentGalleryEvents();
            };
        });

        function addCommentGalleryEvents() {
            popupBody.querySelectorAll(".comment-image").forEach(img => {
                img.onclick = function (e) {
                    e.stopPropagation();
                    let imgs = [];
                    try { imgs = JSON.parse(this.getAttribute("data-imgs") || "[]"); } catch { }
                    let idx = parseInt(this.getAttribute("data-idx"));
                    openLightbox(imgs, idx);
                };
            });
        }
        addCommentGalleryEvents();

        popupBody.querySelectorAll(".review-image").forEach(img => {
            img.onclick = function (e) {
                e.stopPropagation();
                let imgs = [];
                try { imgs = JSON.parse(this.getAttribute("data-imgs") || "[]"); } catch { }
                let idx = parseInt(this.getAttribute("data-idx"));
                openLightbox(imgs, idx);
            };
        });

        popupBody.querySelector("#add-comment-btn-popup").onclick = () => {
            showPopup("add-comment-popup");
            document.getElementById("add-comment-form").review_id.value = review.id;
        };

        showPopup("comment-popup");
    }

    // ======================= Submit comentariu la review ==================
    document.getElementById("add-comment-form").onsubmit = function (e) {
        e.preventDefault();
        const formData = new FormData(this);
        const imgs = this.querySelector('[name="images"]');
        if (imgs.files.length > 3) {
            alert("Maxim 3 poze!");
            return;
        }
        fetch("/add-comment", { method: "POST", body: formData })
            .then(res => res.text())
            .then(msg => {
                hidePopup("add-comment-popup");
                hidePopup("comment-popup");
                loadReviews(currentFilter);
            })
            .catch(() => {/* alert("Eroare la adaugare comentariu!"); */ });
    };
    document.getElementById("add-comment-images").onchange = function () {
        document.getElementById("add-comment-image-count").textContent =
            `Incărcat(e): ${this.files.length}/3`;
        if (this.files.length > 3) {
            alert("Poti incarca maxim 3 poze!");
            this.value = "";
            document.getElementById("add-comment-image-count").textContent = "Poti incarca maxim 3 poze.";
        }
    };

    // ======================= Lightbox galerie imagini ==================
    function openLightbox(imgs, idx) {
        if (!imgs.length) return;
        lightboxImages = imgs;
        lightboxIndex = idx || 0;
        let lb = document.getElementById("lightbox");
        if (!lb) {
            lb = document.createElement("div");
            lb.id = "lightbox";
            document.body.appendChild(lb);
        }
        lb.innerHTML = `
            <div class="lightbox-bg"></div>
            <div class="lightbox-content">
                <img src="${lightboxImages[lightboxIndex]}" alt="poza-mare" class="lightbox-img">
                <button class="lightbox-arrow-left">&#8592;</button>
                <button class="lightbox-arrow-right">&#8594;</button>
                <button class="lightbox-close">&times;</button>
                <div class="lightbox-count">${lightboxIndex + 1} / ${lightboxImages.length}</div>
            </div>
        `;
        lb.classList.add("open");
        lb.style.display = "block";
    }
    function hideLightbox() {
        let lb = document.getElementById("lightbox");
        if (lb) {
            lb.classList.remove("open");
            lb.style.display = "none";
        }
    }
    function lightboxMove(dir) {
        lightboxIndex += dir;
        if (lightboxIndex < 0) lightboxIndex = lightboxImages.length - 1;
        if (lightboxIndex >= lightboxImages.length) lightboxIndex = 0;
        let lb = document.getElementById("lightbox");
        if (lb) {
            lb.querySelector(".lightbox-img").src = lightboxImages[lightboxIndex];
            lb.querySelector(".lightbox-count").textContent = (lightboxIndex + 1) + " / " + lightboxImages.length;
        }
    }
});