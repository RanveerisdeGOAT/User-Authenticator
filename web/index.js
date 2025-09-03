document.addEventListener('DOMContentLoaded', async () => {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    const API_URL = `${protocol}//${hostname}:6969`;

    const token = localStorage.getItem('access_token');

    if (!token) {
        window.location.href = '/login';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/me`, {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) throw new Error('Invalid token');

        // Token is valid, go home
        window.location.href = '/home';
    } catch (err) {
        console.error(err);
        window.location.href = '/login';
    }
});
