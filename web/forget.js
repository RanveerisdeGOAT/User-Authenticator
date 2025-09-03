document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('forgetForm');
    const errorEl = document.getElementById('error');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const verificationInput = document.getElementById('verificationCode');
    const verificationWrapper = document.getElementById('verificationWrapper');
    const strengthBar = document.getElementById('password-strength-bar');
    const strengthText = document.getElementById('password-strength-text');
    const verifyBtn = document.getElementById('verify');
    const resetBtn = document.getElementById('reset-btn');

    const API_URL = `${window.location.protocol}//${window.location.hostname}:6969`;
    let captchaToken = ""; // Optional if you want reCAPTCHA

    // Password strength meter
    passwordInput.addEventListener('input', () => {
        const { score, message, color } = checkPasswordStrength(passwordInput.value);
        strengthBar.style.width = `${score}%`;
        strengthBar.style.background = color;
        strengthText.textContent = message;
    });

    // Send verification code
    verifyBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        errorEl.textContent = '';

        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();
        const confirmPassword = confirmPasswordInput.value.trim();

        if (!email) return errorEl.textContent = 'Email is required!';
        if (!password || !confirmPassword) return errorEl.textContent = 'Password fields are required!';
        if (password !== confirmPassword) return errorEl.textContent = 'Passwords do not match!';
        if (checkPasswordStrength(password).score < 100) return errorEl.textContent = 'Password not strong enough!';


        try {
            const res = await fetch(`${API_URL}/send_verification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Failed to send verification code');

            alert('Verification code sent! Check your email.');
            verificationWrapper.style.display = 'block';
            verifyBtn.style.display = 'none';
            resetBtn.style.display = 'inline-block';

        } catch (err) {
            errorEl.textContent = err.message;
        }
    });

    // Reset password
    resetBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        errorEl.textContent = '';

        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();
        const confirmPassword = confirmPasswordInput.value.trim();
        const code = verificationInput.value.trim();

        if (!password || !confirmPassword) return errorEl.textContent = 'Password fields are required!';
        if (password !== confirmPassword) return errorEl.textContent = 'Passwords do not match!';
        if (checkPasswordStrength(password).score < 100) return errorEl.textContent = 'Password not strong enough!';
        if (!code) return errorEl.textContent = 'Please enter the verification code!';

        try {
            const res = await fetch(`${API_URL}/reset_password`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, code })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Reset password failed');

            alert('Password reset successfully! Please login.');
            window.location.href = '/login';

        } catch (err) {
            errorEl.textContent = err.message;
        }
    });

    function checkPasswordStrength(password) {
        let score = 0;
        const tests = [/.{8,}/, /[A-Z]/, /[a-z]/, /[0-9]/, /[!@#$%^&*(),.?":{}|<>]/];
        tests.forEach(r => r.test(password) && (score += 20));

        let message = "Weak", color = "#ff4d4d";
        if (score > 80) { message = "Very Strong"; color = "#4dff4d"; }
        else if (score > 60) { message = "Strong"; color = "#ffff4d"; }
        else if (score > 40) { message = "Moderate"; color = "#ffa500"; }
        return { score, message, color };
    }
});
