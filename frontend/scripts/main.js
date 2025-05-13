document.addEventListener("DOMContentLoaded", () => {
    const usernameSpan = document.getElementById("username");
    const reviewForm = document.getElementById("review-form");
    const filterForm = document.getElementById("filter-form");
    const reviewsContainer = document.getElementById("reviews-container");
    const logoutBtn = document.getElementById("logout-btn");

    // Fetch logged-in user's info
    fetch("/get-user")
        .then((res) => res.json())
        .then((data) => {
            if (data.username) {
                usernameSpan.textContent = data.username;
            }
        });

    // Handle review submission
    reviewForm.addEventListener("submit", (e) => {
        e.preventDefault();

        const reviewData = {
            entity: document.getElementById("entity").value,
            category: document.getElementById("category").value,
            rating: document.getElementById("rating").value,
            comment: document.getElementById("comment").value,
        };

        fetch("/add-review", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(reviewData),
        })
            .then((res) => res.text())
            .then((message) => {
                alert(message); // Afișează mesajul de confirmare
                reviewForm.reset(); // Resetează formularul
                loadReviews(); // Încarcă recenziile după submit
            })
            .catch((err) => {
                console.error("Error submitting review:", err);
                alert("Failed to submit review.");
            });
    });

    // Handle category filter submission
    filterForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const category = document.getElementById("filter-category").value;

        fetch(`/get-reviews?category=${encodeURIComponent(category)}`)
            .then((res) => res.json())
            .then((filteredReviews) => {
                reviewsContainer.innerHTML = ""; // Clear the current list
                if (filteredReviews.length === 0) {
                    reviewsContainer.innerHTML = "<p>No reviews found for this category.</p>";
                } else {
                    filteredReviews.forEach((review) => {
                        const li = document.createElement("li");
                        li.innerHTML = `
                            <strong>${review.entity} (${review.category})</strong>
                            <p>Rating: ${review.rating}/5</p>
                            <p>${review.comment}</p>
                            <em>By: ${review.username}</em>
                        `;
                        reviewsContainer.appendChild(li);
                    });
                }
            })
            .catch((err) => {
                console.error("Error filtering reviews:", err);
                alert("Failed to filter reviews.");
            });
    });

    // Load all reviews
    function loadReviews() {
        fetch("/get-reviews")
            .then((res) => res.json())
            .then((reviews) => {
                reviewsContainer.innerHTML = ""; // Golește lista pentru a evita duplicarea
                reviews.forEach((review) => {
                    const li = document.createElement("li");
                    li.innerHTML = `
                        <strong>${review.entity} (${review.category})</strong>
                        <p>Rating: ${review.rating}/5</p>
                        <p>${review.comment}</p>
                        <em>By: ${review.username}</em>
                    `;
                    reviewsContainer.appendChild(li);
                });
            })
            .catch((err) => {
                console.error("Error loading reviews:", err);
                alert("Failed to load reviews.");
            });
    }

    // Logout functionality
    logoutBtn.addEventListener("click", () => {
        fetch("/logout", { method: "POST" }) // Trimite o cerere POST pentru logout
            .then(() => {
                window.location.href = "/"; // Redirecționează la pagina de login
            })
            .catch((err) => {
                console.error("Error logging out:", err);
                alert("Failed to logout.");
            });
    });

    // Load reviews on page load
    loadReviews();
});