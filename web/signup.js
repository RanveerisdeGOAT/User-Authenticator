document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('signupForm');
    const errorEl = document.getElementById('error');
    const usernameInput = document.getElementById('username');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const verificationInput = document.getElementById('verificationCode');
    const verificationWrapper = document.getElementById('verificationWrapper');
    const strengthBar = document.getElementById('password-strength-bar');
    const strengthText = document.getElementById('password-strength-text');
    const verifyBtn = document.getElementById('verify');
    const signupBtn = document.getElementById('signup-btn');

    const API_URL = `${window.location.protocol}//${window.location.hostname}:6969`;
    let captchaToken = "";

    // Invisible reCAPTCHA callback
    window.onCaptchaSuccess = (token) => {
        captchaToken = token;
        handleSignup();
    };

    // Password strength meter
    passwordInput.addEventListener('input', () => {
        const { score, message, color } = checkPasswordStrength(passwordInput.value, usernameInput.value);
        strengthBar.style.width = `${score}%`;
        strengthBar.style.background = color;
        strengthText.textContent = message;
    });

    // Debounce helper
    function debounce(fn, delay) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => fn(...args), delay);
        };
    }

    const checkUsernameAvailability = debounce(async () => {
        const username = usernameInput.value.trim();
        if (!username) {
            errorEl.textContent = '';
            return;
        }
        try {
            const res = await fetch(`${API_URL}/name_taken/${encodeURIComponent(username)}`);
            const data = await res.json();
            errorEl.textContent = data.taken ? 'Username taken' : '';
        } catch {
            errorEl.textContent = 'Error checking username';
        }
    }, 500);
    const checkEmailAvailability = debounce(async () => {
        const email = emailInput.value.trim();
        if (!email) {
            errorEl.textContent = '';
            return;
        }
        try {
            const res = await fetch(`${API_URL}/name_taken/${encodeURIComponent(email)}`);
            const data = await res.json();
            errorEl.textContent = data.taken ? 'Email already registered' : '';
        } catch {
            errorEl.textContent = 'Error checking email';
        }
    }, 500);
    emailInput.addEventListener('input', () => {
        checkEmailAvailability();
        checkUsernameAvailability();
    });
    usernameInput.addEventListener('input', () => {
        checkEmailAvailability();
        checkUsernameAvailability();
    });

    // 🔹 Separate button listeners
    verifyBtn.addEventListener('click', (event) => {
        event.preventDefault();
        errorEl.textContent = '';
        sendCode(); // Step 1: Send code
    });

    signupBtn.addEventListener('click', (event) => {
        event.preventDefault();
        errorEl.textContent = '';
        if (true) {
            console.warn('Bypassing reCAPTCHA in dev mode');
            captchaToken = 'dev-bypass';
            handleSignup();
        } else {
            grecaptcha.execute();
        }
        // Step 2: CAPTCHA then signup
    });

    // 🔹 Function to send verification code
    async function sendCode() {
        const email = emailInput.value.trim();
        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();
        const confirmPassword = confirmPasswordInput.value.trim();


        if (!username) return errorEl.textContent = 'Username is required!';
        if (!email) return errorEl.textContent = 'Email is required!';
        if (!password || !confirmPassword) return errorEl.textContent = 'Password fields are required!';
        if (password !== confirmPassword) return errorEl.textContent = 'Passwords do not match!';
        if (checkPasswordStrength(password, username).score < 100) return errorEl.textContent = 'Password not strong enough!';

        try {
            const res = await fetch(`${API_URL}/send_verification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Failed to send verification code');

            alert('Verification code sent! Check your email.');
            verificationWrapper.style.display = "block";
            verifyBtn.style.display = "none";      // Hide Send Code button
            signupBtn.style.display = "inline-block"; // Show Sign Up button

        } catch (err) {
            errorEl.textContent = err.message;
        }
    }

    // 🔹 Function to handle final signup
    async function handleSignup() {
        const username = usernameInput.value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();
        const code = verificationInput.value.trim();

        if (!code) return errorEl.textContent = 'Please enter the verification code!';

        try {
            const res = await fetch(`${API_URL}/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user: { username, password, email },
                    captcha: captchaToken,
                    code
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Signup failed');

            alert('Account created successfully! Please login.');
            window.location.href = '/login';

        } catch (err) {
            errorEl.textContent = err.message;
        }
    }

    function checkPasswordStrength(password, username) {
        let score = 0;
        console.log(username)
        const tests = [
            /.{8,}/,           // Minimum length 8
            /[A-Z]/,           // Uppercase letter
            /[a-z]/,           // Lowercase letter
            /[0-9]/,            // Digit
            /[!@#$%^&*(),.?":{}|<>]/ // Special character
        ];
        tests.forEach(r => r.test(password) && (score += 20));

        // 🔹 Check if password contains username (case-insensitive)
        if (username && password.toLowerCase().includes(username.toLowerCase())) {
            score = 20; // Fail the check completely
        }

        let message = "Weak", color = "#ff4d4d";
        if (score > 80) { message = "Very Strong"; color = "#4dff4d"; }
        else if (score > 60) { message = "Strong"; color = "#ffff4d"; }
        else if (score > 40) { message = "Moderate"; color = "#ffa500"; }

        // 🔹 Additional message if password contains username
        if (username && password.toLowerCase().includes(username.toLowerCase())) {
            message = "Weak; Cannot contain username";
        }

        return { score, message, color };
    }


});
