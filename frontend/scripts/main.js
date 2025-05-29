let currentFilter = {mine: true};
let reviewsTitle = null;

function showPopup(id) {
    document.getElementById(id).style.display = "block";
}
function hidePopup(id) {
    document.getElementById(id).style.display = "none";
}
function clearPopupForm(id) {
    const form = document.querySelector(`#${id} form`);
    if (form) form.reset();
}

document.addEventListener("DOMContentLoaded", () => {
    const usernameSpan = document.getElementById("username");
    const reviewsContainer = document.getElementById("reviews-container");
    const logoutBtn = document.getElementById("logout-btn");
    reviewsTitle = document.getElementById("reviews-title");

    // --- POPUPS ---
    document.getElementById("filter-popup-btn").onclick = () => {
        if (currentFilter.category) {
            currentFilter = {mine: true};
            reviewsTitle.textContent = "Review-urile tale";
            loadReviews(currentFilter);
            hidePopup("filter-popup");
        } else {
            showPopup("filter-popup");
        }
    };
    document.getElementById("add-review-popup-btn").onclick = () => showPopup("add-review-popup");
    document.getElementById("close-filter-popup").onclick = () => hidePopup("filter-popup");
    document.getElementById("close-add-review-popup").onclick = () => hidePopup("add-review-popup");
    document.getElementById("close-comment-popup").onclick = () => hidePopup("comment-popup");

    // --- User info ---
    let currentUser = null;
    fetch("/get-user").then(r => r.json()).then(data => {
        if (data.username) {
            currentUser = data;
            usernameSpan.textContent = data.username;
            reviewsTitle.textContent = "Review-urile tale";
            currentFilter = {mine: true};
            loadReviews(currentFilter);
        } else {
            window.location.href = "/";
        }
    });

    // --- Review filtering popup ---
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

    // --- Add review popup form ---
    const reviewForm = document.getElementById("review-form");
    reviewForm.onsubmit = (e) => {
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
        fetch("/add-review", {
            method: "POST",
            body: formData
        })
        .then(res => res.text())
        .then(msg => {
            alert(msg);
            clearPopupForm("add-review-popup");
            hidePopup("add-review-popup");
            currentFilter = {mine: true};
            reviewsTitle.textContent = "Review-urile tale";
            loadReviews(currentFilter);
        })
        .catch(() => alert("Eroare la adaugare review!"));
    };

    // --- Image count for review ---
    document.getElementById("review-images").onchange = function() {
        document.getElementById("image-count").textContent =
            `Incărcat(e): ${this.files.length}/3`;
        if (this.files.length > 3) {
            alert("Poti incarca maxim 3 poze!");
            this.value = "";
            document.getElementById("image-count").textContent = "Poti incarca maxim 3 poze.";
        }
    };

    // --- Review click for details and comments ---
    reviewsContainer.onclick = function(e) {
        let li = e.target.closest("li[data-review-id]");
        if (!li) return;
        let review = li.reviewData;
        showReviewPopup(review);
    };

    function showReviewPopup(review) {
        const popupBody = document.getElementById("comment-popup-body");
        popupBody.innerHTML = `
            <h3>${review.entity} (${review.category})</h3>
            <p><b>Nota medie:</b> ${parseFloat(review.avg_rating).toFixed(2)}/5</p>
            <p>${review.comment}</p>
            <div class="review-images">
                ${(review.images && review.images.length) ? review.images.map(img => `<img src="${img}" alt="review-img" class="review-image">`).join("") : ""}
            </div>
            <h4>Comentarii:</h4>
            <ul class="comments-list">
                ${(review.comments || []).map(c => `
                    <li>
                        <b>${c.username}</b> (${c.rating ? c.rating+"/5" : "fara nota"}): ${c.comment}
                        <div class="comment-images">
                            ${(c.images && c.images.length) ? c.images.map(img => `<img src="${img}" class="comment-image">`).join("") : ""}
                        </div>
                    </li>
                `).join("")}
            </ul>
            <form id="comment-form" enctype="multipart/form-data">
                <textarea name="comment" placeholder="Adauga comentariu" required></textarea>
                <input type="number" name="rating" min="1" max="5" placeholder="Nota (opțional)">
                <input type="file" name="images" multiple accept="image/*" id="comment-images">
                <p id="comment-image-count">Poti incarca maxim 3 poze.</p>
                <input type="hidden" name="review_id" value="${review.id}">
                <button type="submit">Trimite comentariu</button>
            </form>
        `;
        // Image count for comment
        popupBody.querySelector("#comment-images").onchange = function() {
            popupBody.querySelector("#comment-image-count").textContent =
                `Incărcat(e): ${this.files.length}/3`;
            if (this.files.length > 3) {
                alert("Maxim 3 poze!");
                this.value = "";
                popupBody.querySelector("#comment-image-count").textContent = "Poti incarca maxim 3 poze.";
            }
        };
        // Comment form
        popupBody.querySelector("#comment-form").onsubmit = function(ev) {
            ev.preventDefault();
            const formData = new FormData(this);
            const imgs = this.querySelector('[name="images"]');
            if (imgs.files.length > 3) {
                alert("Maxim 3 poze!");
                return;
            }
            fetch("/add-comment", {
                method: "POST",
                body: formData
            })
            .then(res => res.text())
            .then(msg => {
                alert(msg);
                hidePopup("comment-popup");
                loadReviews(currentFilter);
            })
            .catch(() => alert("Eroare la adaugare comentariu!"));
        };
        showPopup("comment-popup");
    }

    // --- Logout ---
    logoutBtn.onclick = () => {
        fetch("/logout", {method:"POST"}).then(() => window.location.href = "/");
    };

    // --- Main: load reviews ---
    function loadReviews({category = null, mine = false} = {}) {
        let url = "/get-reviews";
        if (category) url += "?category=" + encodeURIComponent(category);
        else if (mine) url += "?mine=1";
        fetch(url)
            .then(res => res.json())
            .then(reviews => {
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
                        <b>${review.entity}</b> (${review.category})<br>
                        <span>Nota medie: ${parseFloat(review.avg_rating).toFixed(2)}/5</span>
                        <p>${review.comment}</p>
                        <em>De: ${review.username}</em>
                        <div class="review-images">
                        ${(review.images && review.images.length) ? review.images.map(img => `<img src="${img}" class="review-image">`).join("") : ""}
                        </div>
                    `;
                    reviewsContainer.appendChild(li);
                }
            });
    }
});