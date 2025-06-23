// Verifica daca utilizatorul este autentificat si are drepturi de admin
async function checkAdmin() {
    const res = await fetch('/get-user');
    if (!res.ok) { 
        window.location.href = 'login.html'; // Daca nu e logat, redirect la login
        return; 
    }
    const user = await res.json();
    // Verifica daca userul figureaza in lista de admini
    const res2 = await fetch('/admin/users');
    if (!res2.ok) { 
        window.location.href = 'main.html'; // Daca nu e admin, redirect la main
        return; 
    }
    const users = await res2.json();
    const me = users.find(u => u.id === user.id);
    if (!me || !me.isadmin) { 
        window.location.href = 'main.html'; // Daca nu e admin, redirect la main
        return; 
    }
}

// Seteaza atributele "data-label" pentru fiecare celula (col) dintr-un tabel, util pentru responsive design
function setDataLabels(tableId, headers) {
    const rows = document.querySelectorAll(`#${tableId} tbody tr`);
    rows.forEach(row => {
        row.querySelectorAll('td').forEach((td, i) => {
            td.setAttribute('data-label', headers[i]);
        });
    });
}

// Incarca si afiseaza toti userii in tabelul admin, plus buton de stergere pentru fiecare
async function loadUsers() {
    const res = await fetch('/admin/users');
    const users = await res.json();
    const tbody = document.querySelector('#users-table tbody');
    tbody.innerHTML = '';
    users.forEach(u => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${u.id}</td>
            <td>${u.username}</td>
            <td>${u.email}</td>
            <td>${u.isadmin ? 'Yes' : 'No'}</td>
            <td><button data-id="${u.id}" class="delete-user">Delete</button></td>
        `;
        tbody.appendChild(tr);
    });
    setDataLabels("users-table", ["ID", "Username", "Email", "Admin", "Delete"]);
    // Adauga event listener pentru butoanele de stergere user
    document.querySelectorAll('.delete-user').forEach(btn => {
        btn.onclick = async () => {
            if (confirm('Delete this user?')) {
                const res = await fetch('/admin/users', {
                    method:'DELETE', 
                    headers:{'Content-Type':'application/json'}, 
                    body:JSON.stringify({id:btn.dataset.id})
                });
                if (res.ok) loadUsers();
                else alert('Error deleting user');
            }
        };
    });
}

// Incarca si afiseaza toate review-urile in tabelul admin, plus buton de stergere pentru fiecare
async function loadReviews() {
    const res = await fetch('/admin/reviews');
    const reviews = await res.json();
    const tbody = document.querySelector('#reviews-table tbody');
    tbody.innerHTML = '';
    reviews.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${r.id}</td>
            <td>${r.user_id}</td>
            <td>${r.entity}</td>
            <td>${r.category}</td>
            <td>${r.comment}</td>
            <td>${r.rating}</td>
            <td><button data-id="${r.id}" class="delete-review">Delete</button></td>
        `;
        tbody.appendChild(tr);
    });
    setDataLabels("reviews-table", ["ID", "User ID", "Entity", "Category", "Comment", "Rating", "Delete"]);
    // Adauga event listener pentru butoanele de stergere review
    document.querySelectorAll('.delete-review').forEach(btn => {
        btn.onclick = async () => {
            if (confirm('Delete this review?')) {
                const res = await fetch('/admin/reviews', {
                    method:'DELETE', 
                    headers:{'Content-Type':'application/json'}, 
                    body:JSON.stringify({id:btn.dataset.id})
                });
                if (res.ok) loadReviews();
                else alert('Error deleting review');
            }
        };
    });
}

// Incarca si afiseaza toate bug report-urile in tabelul admin, plus buton de stergere pentru fiecare
async function loadBugs() {
    const res = await fetch('/admin/bug-reports');
    const bugs = await res.json();
    const tbody = document.querySelector('#bugs-table tbody');
    tbody.innerHTML = '';
    bugs.forEach(b => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${b.id}</td>
            <td>${b.username||''}</td>
            <td>${b.description}</td>
            <td>${b.created_at}</td>
            <td><button data-id="${b.id}" class="delete-bug">Delete</button></td>
        `;
        tbody.appendChild(tr);
    });
    setDataLabels("bugs-table", ["ID", "User", "Description", "Created At", "Delete"]);
    // Adauga event listener pentru butoanele de stergere bug report
    document.querySelectorAll('.delete-bug').forEach(btn => {
        btn.onclick = async () => {
            if (confirm('Delete this bug report?')) {
                const res = await fetch('/admin/bug-reports', {
                    method:'DELETE', 
                    headers:{'Content-Type':'application/json'}, 
                    body:JSON.stringify({id:btn.dataset.id})
                });
                if (res.ok) loadBugs();
                else alert('Error deleting bug report');
            }
        };
    });
}

// La incarcarea paginii, verifica daca userul e admin si incarca datele de administrare
window.onload = async () => {
    await checkAdmin();
    loadUsers();
    loadReviews();
    loadBugs();
};