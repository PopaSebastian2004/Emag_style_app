// Helper: fetch current user and check admin
async function checkAdmin() {
    const res = await fetch('/get-user');
    if (!res.ok) { window.location.href = 'login.html'; return; }
    const user = await res.json();
    // Fetch user info with isAdmin
    const res2 = await fetch('/admin/users');
    if (!res2.ok) { window.location.href = 'main.html'; return; }
    const users = await res2.json();
    const me = users.find(u => u.id === user.id);
    if (!me || !me.isadmin) { window.location.href = 'main.html'; return; }
}

async function loadUsers() {
    const res = await fetch('/admin/users');
    const users = await res.json();
    const tbody = document.querySelector('#users-table tbody');
    tbody.innerHTML = '';
    users.forEach(u => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${u.id}</td><td>${u.username}</td><td>${u.email}</td><td>${u.isadmin ? 'Yes' : 'No'}</td><td><button data-id="${u.id}" class="delete-user">Delete</button></td>`;
        tbody.appendChild(tr);
    });
    document.querySelectorAll('.delete-user').forEach(btn => {
        btn.onclick = async () => {
            if (confirm('Delete this user?')) {
                const res = await fetch('/admin/users', {method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id:btn.dataset.id})});
                if (res.ok) loadUsers();
                else alert('Error deleting user');
            }
        };
    });
}

async function loadReviews() {
    const res = await fetch('/admin/reviews');
    const reviews = await res.json();
    const tbody = document.querySelector('#reviews-table tbody');
    tbody.innerHTML = '';
    reviews.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${r.id}</td><td>${r.user_id}</td><td>${r.entity}</td><td>${r.category}</td><td>${r.comment}</td><td>${r.rating}</td><td><button data-id="${r.id}" class="delete-review">Delete</button></td>`;
        tbody.appendChild(tr);
    });
    document.querySelectorAll('.delete-review').forEach(btn => {
        btn.onclick = async () => {
            if (confirm('Delete this review?')) {
                const res = await fetch('/admin/reviews', {method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id:btn.dataset.id})});
                if (res.ok) loadReviews();
                else alert('Error deleting review');
            }
        };
    });
}

async function loadBugs() {
    const res = await fetch('/admin/bug-reports');
    const bugs = await res.json();
    const tbody = document.querySelector('#bugs-table tbody');
    tbody.innerHTML = '';
    bugs.forEach(b => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${b.id}</td><td>${b.username||''}</td><td>${b.description}</td><td>${b.created_at}</td><td><button data-id="${b.id}" class="delete-bug">Delete</button></td>`;
        tbody.appendChild(tr);
    });
    document.querySelectorAll('.delete-bug').forEach(btn => {
        btn.onclick = async () => {
            if (confirm('Delete this bug report?')) {
                const res = await fetch('/admin/bug-reports', {method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id:btn.dataset.id})});
                if (res.ok) loadBugs();
                else alert('Error deleting bug report');
            }
        };
    });
}

window.onload = async () => {
    await checkAdmin();
    loadUsers();
    loadReviews();
    loadBugs();
}; 