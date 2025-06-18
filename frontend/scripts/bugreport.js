document.addEventListener('DOMContentLoaded', () => {
    const fab = document.getElementById('report-bug-fab');
    const popup = document.getElementById('bug-report-popup');
    const closeBtn = document.getElementById('close-bug-report-popup');
    const form = document.getElementById('bug-report-form');
    const desc = document.getElementById('bug-description');
    const msg = document.getElementById('bug-report-msg');

    // Hide initial bug popup
    if (popup) popup.style.display = 'none';

    // Open popup on FAB click
    if (fab) {
        fab.onclick = (e) => {
            e.preventDefault();
            popup.style.display = 'block';
            desc.value = '';
            msg.textContent = '';
        };
    }

    // Close popup
    if (closeBtn) {
        closeBtn.onclick = () => {
            popup.style.display = 'none';
            msg.textContent = '';
        };
    }

    // Submit bug report
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            msg.textContent = '';
            const description = desc.value.trim();
            if (!description) {
                msg.textContent = 'Completează descrierea!';
                msg.style.color = '#d32f2f';
                return;
            }
            try {
                const res = await fetch('/report-bug', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ description })
                });
                if (res.ok) {
                    msg.textContent = 'Trimis cu succes!';
                    msg.style.color = '#388e3c';
                    desc.value = '';
                    setTimeout(() => { popup.style.display = 'none'; }, 1500);
                } else {
                    const data = await res.json();
                    msg.textContent = (data && data.error) ? data.error : 'Eroare la trimitere!';
                    msg.style.color = '#d32f2f';
                }
            } catch {
                msg.textContent = 'Eroare rețea!';
                msg.style.color = '#d32f2f';
            }
        };
    }
    // Hide popup on click outside
    window.addEventListener('click', (event) => {
        if (popup && event.target === popup) {
            popup.style.display = 'none';
            msg.textContent = '';
        }
    });
});