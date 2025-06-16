let currentFilter = {mine: true};
let reviewsTitle = null;
let allReviews = [];
let lightboxImages = [];
let lightboxIndex = 0;
let currentUser = null;

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
function escapeHTML(str) {
    return (str || '').replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
}
function renderStars(rating, max=5) {
    rating = parseFloat(rating) || 0;
    let out = '';
    for (let i = 1; i <= max; i++) {
        let fill = Math.min(1, Math.max(0, rating - i + 1));
        if (fill === 1) {
            out += '<span class="star full"></span>';
        } else if (fill === 0) {
            out += '<span class="star empty"></span>';
        } else {
            out += `<span class="star partial" style="--star-fill:${(fill*100).toFixed(0)}%"></span>`;
        }
    }
    return out;
}

document.addEventListener("DOMContentLoaded", () => {
    const usernameSpan = document.getElementById("username");
    const reviewsContainer = document.getElementById("reviews-container");
    reviewsTitle = document.getElementById("reviews-title");

    // ======================= NOU: EXPORT CSV ==================
    document.getElementById("export-csv-btn").onclick = function() {
        fetch("/get-reviews")
        .then(res => res.json())
        .then(data => {
            let csv = "Id,Entitate,Categorie,Nota,Comentariu,Autor\n";
            data.forEach(r => {
                csv += [r.id, r.entity, r.category, r.avg_rating, (r.comment||"").replace(/\n/g," "), r.username].map(x => `"${(x||"").toString().replace(/"/g,'""')}"`).join(",") + "\n";
            });
            const blob = new Blob([csv], {type: "text/csv"});
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "inventar_reviews.csv";
            a.click();
            URL.revokeObjectURL(url);
        });
    };
    // ======================= NOU: EXPORT PDF ==================
    document.getElementById("export-pdf-btn").onclick = function() {
        fetch("/get-reviews")
        .then(res => res.json())
        .then(data => {
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
                    doc.text(String(r.entity), 25, y, {maxWidth: 35});
                    doc.text(String(r.category), 65, y, {maxWidth: 35});
                    doc.text(String(Number(r.avg_rating).toFixed(2)), 105, y);
                    doc.text(String(r.username), 125, y, {maxWidth: 23});
                    doc.text(String(r.comment||"").substring(0,45), 150, y, {maxWidth: 55});
                    y += 7;
                }
                doc.save("inventar_reviews.pdf");
            }
        });
    };
    // ======================= NOU: POPUP STATISTICI ==============
    const statsBtn = document.getElementById("stats-btn");
    const statsContent = document.getElementById("stats-content");
    document.getElementById("close-stats-popup").onclick = () => hidePopup("stats-popup");
    statsBtn.onclick = function() {
        statsContent.innerHTML = "<p>Se încarcă statistici...</p>";
        showPopup("stats-popup");
        fetch("/get-reviews")
        .then(res=>res.json())
        .then(reviews => {
            if (!reviews.length) { statsContent.innerHTML = "<p>Nu există date.</p>"; return; }
            const byCat = {}, byUser = {}, ratingsCat = {};
            for (const r of reviews) {
                byCat[r.category] = (byCat[r.category]||0)+1;
                byUser[r.username] = (byUser[r.username]||0)+1;
                ratingsCat[r.category] = ratingsCat[r.category] || [];
                ratingsCat[r.category].push(Number(r.avg_rating));
            }
            let out = `<b>Total review-uri:</b> ${reviews.length}<br><br>`;
            out += `<b>Pe categorii:</b><ul>`;
            for (const k in byCat) out += `<li><b>${escapeHTML(k)}:</b> ${byCat[k]}</li>`;
            out += "</ul>";
            out += `<b>Medie notă pe categorie:</b><ul>`;
            for (const k in ratingsCat) {
                let medie = (ratingsCat[k].reduce((a,b)=>a+b,0)/ratingsCat[k].length).toFixed(2);
                out += `<li><b>${escapeHTML(k)}:</b> ${medie}</li>`;
            }
            out += "</ul>";
            out += `<b>Top utilizatori (nr. review-uri):</b><ul>`;
            let topUsers = Object.entries(byUser).sort((a,b)=>b[1]-a[1]).slice(0,5);
            for (const [u, n] of topUsers)
                out += `<li><b>${escapeHTML(u)}:</b> ${n}</li>`;
            out += "</ul>";
            statsContent.innerHTML = out;
        });
    };
    // ======================= NOU: POPUP CLASAMENT ==============
    const clasamentBtn = document.getElementById("clasament-btn");
    const clasamentContent = document.getElementById("clasament-content");
    document.getElementById("close-clasament-popup").onclick = () => hidePopup("clasament-popup");
   clasamentBtn.onclick = function() {
    clasamentContent.innerHTML = "<p>Se încarcă clasamentul...</p>";
    showPopup("clasament-popup");
    fetch("/get-reviews")
    .then(res=>res.json())
    .then(reviews => {
        if (!reviews.length) { clasamentContent.innerHTML = "<p>Nu există date.</p>"; return; }
        // Pereche unica: { [categorie|entity]: [toate notele] }
        const entities = {};
        for (const r of reviews) {
            const key = r.category + "|" + r.entity;
            if(!entities[key]) entities[key] = {notes: [], category: r.category, entity: r.entity};
            entities[key].notes.push(Number(r.rating));
            if(r.comments && r.comments.length) {
                for(const c of r.comments) {
                    if(c.rating) entities[key].notes.push(Number(c.rating));
                }
            }
        }
        let arr = [];
        for (const k in entities) {
            let allNotes = entities[k].notes.filter(x=>!isNaN(x));
            if (allNotes.length > 2) {
                let avg = allNotes.reduce((a,b)=>a+b,0)/allNotes.length;
                arr.push({entity:entities[k].entity, category:entities[k].category, avg: avg, count: allNotes.length});
            }
        }
        let top = arr.sort((a,b)=>b.avg-a.avg).slice(0,5);
        let flop = [...arr].sort((a,b)=>a.avg-b.avg).slice(0,5);
        let html = "<b>Top 5 cele mai bine cotate entități (min 3 review-uri):</b><ol>";
        for (const x of top) html += `<li><span class="clasament-cat">${escapeHTML(x.category)}</span> &mdash; <b>${escapeHTML(x.entity)}</b> (${x.count} review-uri) — <span style="color:#388e3c;">${x.avg.toFixed(2)}/5</span></li>`;
        html += "</ol>";
        html += "<b>Top 5 cele mai detestate entități (min 3 review-uri):</b><ol>";
        for (const x of flop) html += `<li><span class="clasament-cat">${escapeHTML(x.category)}</span> &mdash; <b>${escapeHTML(x.entity)}</b> (${x.count} review-uri) — <span style="color:#d32f2f;">${x.avg.toFixed(2)}/5</span></li>`;
        html += "</ol>";
        clasamentContent.innerHTML = html;
    });
};
    // ======================= NOU: RSS BUTTON ==================
    document.getElementById("rss-btn").onclick = function() {
        window.open("/clasament.rss", "_blank");
    };

    // ========== CODUL TĂU VECHE (restul funcțiilor, UI, reviews, comments etc.) ==========

    // Dropdown profile menu logic
    const profileBtn = document.getElementById("profile-dropdown-btn");
    const profileMenu = document.getElementById("profile-dropdown-menu");
    profileBtn.onclick = (e) => {
        e.stopPropagation();
        profileMenu.classList.toggle("open");
    };
    document.body.addEventListener("click", () => {
        profileMenu.classList.remove("open");
    });

    document.getElementById("edit-profile-btn").onclick = () => {
        if (currentUser) {
            document.getElementById("edit-username").value = currentUser.username;
            document.getElementById("edit-email").value = currentUser.email;
        }
        showPopup("edit-profile-popup");
    };

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
                btn.onclick = function() {
                    if (!confirm("Ești sigur că vrei să ștergi acest review?")) return;
                    fetch(`/delete-review?id=${btn.dataset.id}`, {method: "DELETE"})
                        .then(r => r.text())
                        .then(msg => {
                            // alert(msg); // Eliminat mesajul!
                            btn.closest("li").remove();
                            loadReviews(currentFilter);
                        });
                };
            });
            showPopup("my-reviews-popup");
        });
    };

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
                btn.onclick = function() {
                    if (!confirm("Ești sigur că vrei să ștergi acest comentariu?")) return;
                    fetch(`/delete-comment?id=${btn.dataset.id}`, {method: "DELETE"})
                        .then(r => r.text())
                        .then(msg => {
                            // alert(msg); // Eliminat mesajul!
                            btn.closest("li").remove();
                            loadReviews(currentFilter);
                        });
                };
            });
            showPopup("my-comments-popup");
        });
    };

    document.getElementById("close-edit-profile-popup").onclick = () => hidePopup("edit-profile-popup");
    document.getElementById("close-my-reviews-popup").onclick = () => hidePopup("my-reviews-popup");
    document.getElementById("close-my-comments-popup").onclick = () => hidePopup("my-comments-popup");

    document.getElementById("filter-popup-btn").onclick = () => {
        if (currentFilter.category) {
            currentFilter = {mine: true};
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

    fetch("/get-user").then(r => r.json()).then(data => {
        if (data.username) {
            currentUser = data;
            usernameSpan.textContent = data.username;
            reviewsTitle.textContent = "Review-urile tale";
            currentFilter = {mine: true};
            loadReviews(currentFilter);
        } else window.location.href = "/";
    });

    document.getElementById("filter-form").onsubmit = (e) => {
        e.preventDefault();
        const category = document.getElementById("filter-category").value.trim();
        if (!category) {
            reviewsTitle.textContent = "Review-urile tale";
            currentFilter = {mine: true};
            loadReviews(currentFilter);
        } else {
            reviewsTitle.textContent = `Review-uri pentru categoria "${category}"`;
            currentFilter = {category};
            loadReviews(currentFilter);
        }
        hidePopup("filter-popup");
    };

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
        currentFilter = {mine: true};
        reviewsTitle.textContent = "Review-urile tale";
        loadReviews(currentFilter);
    })
    .catch(() => {
        errorMsg.textContent = "Eroare la adăugarea review-ului!";
        errorMsg.style.display = "block";
    });
};
    document.getElementById("review-images").onchange = function() {
        document.getElementById("image-count").textContent =
            `Incărcat(e): ${this.files.length}/3`;
        if (this.files.length > 3) {
            alert("Poti incarca maxim 3 poze!");
            this.value = "";
            document.getElementById("image-count").textContent = "Poti incarca maxim 3 poze.";
        }
    };

    reviewsContainer.onclick = function(e) {
        let li = e.target.closest("li[data-review-id]");
        if (!li) return;
        let review = li.reviewData;
        showReviewPopup(review);
    };

    document.body.addEventListener("click", function(e) {
        if (e.target.classList.contains("lightbox-bg")) hideLightbox();
        if (e.target.classList.contains("lightbox-arrow-left")) lightboxMove(-1);
        if (e.target.classList.contains("lightbox-arrow-right")) lightboxMove(1);
        if (e.target.classList.contains("lightbox-close")) hideLightbox();
    });
    document.body.addEventListener("keydown", function(e) {
        if (!document.getElementById("lightbox")?.classList.contains("open")) return;
        if (e.key === "ArrowLeft") lightboxMove(-1);
        if (e.key === "ArrowRight") lightboxMove(1);
        if (e.key === "Escape") hideLightbox();
    });

    document.getElementById("logout-btn").onclick = () => {
        fetch("/logout", {method:"POST"}).then(() => window.location.href = "/");
    };

    document.getElementById("edit-profile-form").onsubmit = function(e) {
        e.preventDefault();
        const formData = {
            username: document.getElementById("edit-username").value,
            email: document.getElementById("edit-email").value,
            password: document.getElementById("edit-password").value
        };
        fetch("/edit-profile", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(formData)
        })
        .then(res => res.text())
        .then(msg => {
            // alert(msg); // Eliminat mesajul!
            hidePopup("edit-profile-popup");
            fetch("/get-user").then(r => r.json()).then(data => {
                if (data.username) {
                    currentUser = data;
                    usernameSpan.textContent = data.username;
                }
            });
        }).catch(() => {/* alert("Eroare la editarea profilului!"); */});
    };

    function loadReviews({category = null, mine = false} = {}) {
        let url = "/get-reviews";
        if (category) url += "?category=" + encodeURIComponent(category);
        else if (mine) url += "?mine=1";
        fetch(url)
            .then(res => res.json())
            .then(reviews => {
                allReviews = reviews;
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
                        ${(review.images && review.images.length) ? review.images.map((img,i) => `<img src="${img}" class="review-image" data-idx="${i}" data-imgs="${escapeHTML(JSON.stringify(review.images))}" alt="review-img">`).join("") : ""}
                        </div>
                    `;
                    reviewsContainer.appendChild(li);
                }
            });
    }

    function showReviewPopup(review) {
        let commentSort = "desc";
        let ratingSort = null;
        let activeSort = "desc";
        let popupBody = document.getElementById("comment-popup-body");

        function renderComments() {
            let comments = review.comments.slice();
            if (ratingSort) {
                comments.sort((a, b) => {
                    let rA = a.rating==null ? -999 : Number(a.rating);
                    let rB = b.rating==null ? -999 : Number(b.rating);
                    return ratingSort === "asc" ? rA - rB : rB - rA;
                });
            } else {
                comments.sort((a, b) => commentSort === "asc" ?
                    new Date(a.created_at)-new Date(b.created_at) :
                    new Date(b.created_at)-new Date(a.created_at));
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
            <div class="review-details-popup wow-review-details">
                <div class="wow-review-row">
                    <span class="wow-label">Categoria:</span>
                    <span class="review-popup-category">${escapeHTML(review.category)}</span>
                    <span class="wow-label" style="margin-left:22px;">Produs:</span>
                    <span class="review-popup-entity">${escapeHTML(review.entity)}</span>
                </div>
                <div class="wow-rating-row">
                    <span class="wow-badge-label">Nota medie:</span>
                    <span class="star-box star-box-main">
                        <span style="margin-right:8px;">${renderStars(review.avg_rating)}</span>
                        <span class="wow-rating-main-val">${notaMedie}</span>
                        <span class="wow-review-count">(${nrReviewuri} review-uri)</span>
                    </span>
                    <span class="wow-initial-label"><b>Nota inițială:</b></span>
                    <span class="star-box wow-initial-stars">${renderStars(review.rating)}</span>
                    <span class="wow-initial-val">${notaInitiala}/5</span>
                </div>
                <div class="review-main-comment">
                    <span class="review-author">Adăugat de: <b>${escapeHTML(review.username)}</b></span>
                    <div class="review-comment-label">Comentariu:</div>
                    <p>${escapeHTML(review.comment)}</p>
                </div>
                <div class="review-images review-gallery">
                    ${(review.images && review.images.length) ? review.images.map((img, i) => `<img src="${img}" alt="review-img" class="review-image" data-idx="${i}" data-imgs="${escapeHTML(JSON.stringify(review.images))}">`).join("") : ""}
                </div>
            </div>
            <div class="comments-section">
                <div class="comments-header">
                    <h4 style="color:#007bff;font-size:1.25em;margin-bottom:0;margin-top:0;">Comentarii</h4>
                    <div class="comments-sort">
                        <span>Sortează:</span>
                        <button class="sort-btn ${activeSort==="desc"&& !ratingSort ? "active" : ""}" data-sort="desc">Noi</button>
                        <button class="sort-btn ${activeSort==="asc"&& !ratingSort ? "active" : ""}" data-sort="asc">Vechi</button>
                        <button class="sort-btn ${activeSort==="rating-desc" ? "active" : ""}" data-sort="rating-desc">Nota mare</button>
                        <button class="sort-btn ${activeSort==="rating-asc" ? "active" : ""}" data-sort="rating-asc">Nota mică</button>
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
            btn.onclick = function() {
                popupBody.querySelectorAll(".sort-btn").forEach(b=>b.classList.remove("active"));
                this.classList.add("active");
                if (this.dataset.sort==="desc") { commentSort="desc"; ratingSort=null; activeSort="desc"; }
                else if (this.dataset.sort==="asc") { commentSort="asc"; ratingSort=null; activeSort="asc"; }
                else if (this.dataset.sort==="rating-desc") { ratingSort="desc"; commentSort=null; activeSort="rating-desc"; }
                else if (this.dataset.sort==="rating-asc") { ratingSort="asc"; commentSort=null; activeSort="rating-asc"; }
                popupBody.querySelector(".comments-list").innerHTML = renderComments();
                addCommentGalleryEvents();
            };
        });

        function addCommentGalleryEvents() {
            popupBody.querySelectorAll(".comment-image").forEach(img => {
                img.onclick = function(e) {
                    e.stopPropagation();
                    let imgs = [];
                    try { imgs = JSON.parse(this.getAttribute("data-imgs") || "[]"); } catch {}
                    let idx = parseInt(this.getAttribute("data-idx"));
                    openLightbox(imgs, idx);
                };
            });
        }
        addCommentGalleryEvents();

        popupBody.querySelectorAll(".review-image").forEach(img => {
            img.onclick = function(e) {
                e.stopPropagation();
                let imgs = [];
                try { imgs = JSON.parse(this.getAttribute("data-imgs") || "[]"); } catch {}
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

    document.getElementById("add-comment-form").onsubmit = function(e) {
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
            // alert(msg); // Eliminat mesajul!
            hidePopup("add-comment-popup");
            hidePopup("comment-popup");
            loadReviews(currentFilter);
        })
        .catch(() => {/* alert("Eroare la adaugare comentariu!"); */});
    };
    document.getElementById("add-comment-images").onchange = function() {
        document.getElementById("add-comment-image-count").textContent =
            `Incărcat(e): ${this.files.length}/3`;
        if (this.files.length > 3) {
            alert("Poti incarca maxim 3 poze!");
            this.value = "";
            document.getElementById("add-comment-image-count").textContent = "Poti incarca maxim 3 poze.";
        }
    };

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
                <div class="lightbox-count">${lightboxIndex+1} / ${lightboxImages.length}</div>
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
        if (lightboxIndex < 0) lightboxIndex = lightboxImages.length-1;
        if (lightboxIndex >= lightboxImages.length) lightboxIndex = 0;
        let lb = document.getElementById("lightbox");
        if (lb) {
            lb.querySelector(".lightbox-img").src = lightboxImages[lightboxIndex];
            lb.querySelector(".lightbox-count").textContent = (lightboxIndex+1) + " / " + lightboxImages.length;
        }
    }
});