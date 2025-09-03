document.addEventListener('DOMContentLoaded', async () => {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    const API_URL = `${protocol}//${hostname}:6969`;

    let user; // Declare globally so all listeners can access it

    const token = localStorage.getItem('access_token');
    if (!token) {
        window.location.href = '/login';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/me`, {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) throw new Error('Unauthorized');

        const data = await response.json();
        user = data.user; // Assign here

        document.getElementById('greeting').textContent = `Welcome, ${user.username}!`;
        document.getElementById('name-tag').textContent = `${user.username}`;

    } catch (err) {
        console.error(err);
        window.location.href = '/login';
        return; // stop execution if not authorized
    }

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('access_token');
        window.location.href = '/login';
    });

    // Delete Account
    document.getElementById('deleteAccountBtn').addEventListener('click', async () => {
        if (!token || !user?.id) {
            alert("User not logged in or missing ID.");
            return;
        }

        if (!confirm("Are you sure you want to delete your account? This cannot be undone.")) {
            return;
        }

        try {
            const response = await fetch(`${API_URL}/users/${user.id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                alert(`Failed to delete account: ${errorData.detail || response.statusText}`);
                return;
            }

            localStorage.removeItem('access_token');
            window.location.href = '/login';
        } catch (err) {
            console.error('Error deleting account:', err);
            alert("An error occurred while deleting your account.");
        }
    });

    // Menu dropdown logic
    const menuContainer = document.querySelector('.menu-container');
    const menuBtn = document.querySelector('.menu-btn');

    menuBtn.addEventListener('click', () => {
        menuContainer.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
        if (!menuContainer.contains(e.target) && !menuBtn.contains(e.target)) {
            menuContainer.classList.remove('active');
        }
    });
});
