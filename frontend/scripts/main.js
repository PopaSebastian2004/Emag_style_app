let currentFilter = {mine: true};
let reviewsTitle = null;
let allReviews = [];
let lightboxImages = [];
let lightboxIndex = 0;

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
    const logoutBtn = document.getElementById("logout-btn");
    reviewsTitle = document.getElementById("reviews-title");
    let currentUser = null;

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
        if (imgInput.files.length > 3) {
            alert("Poti incarca maxim 3 poze!");
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
        .then(res => res.text())
        .then(msg => {
            alert(msg);
            clearPopupForm("add-review-popup");
            hidePopup("add-review-popup");
            currentFilter = {mine: true};
            reviewsTitle.textContent = "Review-urile tale";
            loadReviews(currentFilter);
        }).catch(() => alert("Eroare la adaugare review!"));
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

    logoutBtn.onclick = () => {
        fetch("/logout", {method:"POST"}).then(() => window.location.href = "/");
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
                    <span class="review-popup-category">${escapeHTML(review.category).toUpperCase()}</span>
                    <span class="wow-label" style="margin-left:22px;">Produs:</span>
                    <span class="review-popup-entity">${escapeHTML(review.entity)}</span>
                </div>
                <div class="wow-rating-row">
                    <span class="wow-badge-label">Nota medie:</span>
                    <span class="star-box star-box-main">
                        <span style="margin-right:8px;">${renderStars(review.avg_rating)}</span>
                        <span class="wow-rating-main-val">${notaMedie}</span>
                        <span class="wow-review-count">(${nrReviewuri} de review-uri)</span>
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
            alert(msg);
            hidePopup("add-comment-popup");
            hidePopup("comment-popup");
            loadReviews(currentFilter);
        })
        .catch(() => alert("Eroare la adaugare comentariu!"));
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