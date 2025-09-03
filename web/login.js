document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
    const errorEl = document.getElementById('error');

    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    const API_URL = `${protocol}//${hostname}:6969`;

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();

        try {
            const res = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.detail || 'Login failed');
            }

            const data = await res.json();
            localStorage.setItem('access_token', data.access_token);

            // Go to index (token check will redirect to home)
            window.location.href = '/';
        } catch (err) {
            errorEl.textContent = err.message;
        }
    });
});
