document.addEventListener('DOMContentLoaded', async () => {
    const errorEl = document.getElementById('error');
    const API_URL = `${window.location.protocol}//${window.location.hostname}:6969`;

    try {
        const res = await fetch(`${API_URL}/profile`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('access_token')}` // Adjust if needed
            }
        });

        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.detail || 'Failed to load profile');
        }

        const user = await res.json();

        // Map fields to the DOM
        document.getElementById('user_id').textContent = user.user_id || 'N/A';
        document.getElementById('username').textContent = user.username || 'N/A';
        document.getElementById('email').textContent = user.email || 'N/A';
        document.getElementById('role').textContent = user.role || 'user';
        document.getElementById('is_active').textContent = user.is_active ? 'Yes' : 'No';
        document.getElementById('created_at').textContent = user.created_at
            ? new Date(user.created_at).toLocaleString()
            : 'N/A';
        document.getElementById('updated_at').textContent = user.updated_at
            ? new Date(user.updated_at).toLocaleString()
            : 'N/A';

    } catch (err) {
        errorEl.textContent = err.message;
    }
});
