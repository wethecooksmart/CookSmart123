// login-modal.js
class LoginModal {
  constructor() {
    this.isLoggedIn = this.checkLoginStatus();
    this.currentMode = 'login'; // 'login' or 'signup'
    this.redirectUrl = null; // Store redirect URL after login
  // signup verification state
  this.signupOtpVerified = false;
  this.signupPendingEmail = null;

  this.init();
  // start session monitor to auto-logout on expiry
  this.startSessionMonitor();
  }

  init() {
    this.createModalHTML();
    this.attachEventListeners();
    this.setupProtectedPages();
  }

  checkLoginStatus() {
    const user = localStorage.getItem('user');
    if (!user) return false;
    // check session expiry if set
    const expiry = localStorage.getItem('sessionExpiry');
    if (expiry) {
      const ts = Number(expiry) || 0;
      if (Date.now() > ts) {
        // session expired, clear stored user
        localStorage.removeItem('user');
        localStorage.removeItem('sessionExpiry');
        return false;
      }
    }
    return true;
  }

  getCurrentUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }

  createModalHTML() {
    if (document.getElementById('login-modal-overlay')) {
      return; // Already created
    }

    const modalHTML = `
      <div id="login-modal-overlay" class="login-modal-overlay">
        <div class="login-modal">
          <button class="login-modal-close">&times;</button>
          <div class="login-modal-left"></div>
          <div class="login-modal-right">
            <!-- Login Form -->
            <div class="login-form">
              <h2>Login Now</h2>
              <p class="login-modal-subtitle">Hi, Welcome Back 👋</p>
              
              <button class="login-google-btn">
                <svg class="google-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Login With Google
              </button>
              
              <div class="login-divider"><span>or Login With Email</span></div>
              
              <div class="login-error-message" id="login-error"></div>
              <div class="login-success-message" id="login-success"></div>
              
              <form id="login-form-element">
                <div class="login-form-group">
                  <label for="login-email">Email</label>
                  <input type="email" id="login-email" placeholder="Enter your email" required>
                </div>
                
                <div class="login-form-group login-password-group">
                  <label for="login-password">Password</label>
                  <div class="password-input-wrapper">
                    <input type="password" id="login-password" placeholder="Enter your password" required>
                    <button type="button" class="toggle-password-visibility" tabindex="-1" aria-label="Show password">
                      <svg class="eye-icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    </button>
                  </div>
                </div>
                
                <div class="login-forgot-password">
                  <a href="#forgot-password">Forget Password?</a>
                </div>
                
                <button type="submit" class="login-btn">Login</button>
              </form>
              
              <div class="login-signup-section">
                <p>Create New Account <a id="toggle-signup">Sign Up</a></p>
              </div>
            </div>

            <!-- Sign Up Form -->
            <div class="login-signup-form">
              <h2>Sign Up</h2>
              <p class="login-modal-subtitle">Join Us Today 👋</p>
              
              <div class="login-error-message" id="signup-error"></div>
              <div class="login-success-message" id="signup-success"></div>
              
              <form id="signup-form-element">
                <div class="login-form-row">
                  <div class="login-form-group">
                    <label for="signup-firstname">First Name</label>
                    <input type="text" id="signup-firstname" placeholder="First name">
                  </div>
                  <div class="login-form-group">
                    <label for="signup-lastname">Last Name</label>
                    <input type="text" id="signup-lastname" placeholder="Last name">
                  </div>
                </div>
                
                <div class="login-form-group signup-verify-group" style="position:relative;">
                  <label for="signup-email">Email</label>
                  <div class="signup-verify-container" style="position:relative;">
                    <input type="email" id="signup-email" placeholder="Enter your email" required>
                    <button type="button" id="signup-verify-btn" class="signup-verify-btn verify-text pending" aria-label="Verify email">Verify</button>
                  </div>
                  <div id="signup-verify-status" class="login-small-text" style="margin-top:6px;color:#333;"></div>
                </div>

                <!-- Signup OTP inline section (hidden until Verify pressed) placed directly under email -->
                <div id="signup-otp-section" class="login-form-group form-group" style="display:none;margin-top:8px;position:relative;">
                  <label for="signup-otp-input">Enter OTP</label>
                  <div class="signup-otp-container" style="position:relative;">
                    <input type="text" id="signup-otp-input" placeholder="6-digit code" style="width:100%;padding-right:120px;box-sizing:border-box;border-radius:0;">
                    <button type="button" id="signup-otp-verify-btn" class="signup-verify-btn otp-verify-btn" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);height:36px;padding:6px 10px;border-radius:4px;">Verify OTP</button>
                  </div>
                  <div id="signup-otp-message" class="login-small-text" style="margin-top:6px;color:#333;"></div>
                </div>
                
                <div class="login-form-group login-password-group">
                  <label for="signup-password">Password</label>
                  <div class="password-input-wrapper">
                    <input type="password" id="signup-password" placeholder="Create a password" required>
                    <button type="button" class="toggle-password-visibility" tabindex="-1" aria-label="Show password">
                      <svg class="eye-icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    </button>
                  </div>
                </div>
                <div class="login-form-group login-password-group">
                  <label for="signup-confirm-password">Confirm Password</label>
                  <div class="password-input-wrapper">
                    <input type="password" id="signup-confirm-password" placeholder="Confirm your password" required>
                    <button type="button" class="toggle-password-visibility" tabindex="-1" aria-label="Show password">
                      <svg class="eye-icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    </button>
                  </div>
                </div>
                <!-- duplicate OTP section removed -->
                
                <button type="submit" class="login-btn">Sign Up</button>
              </form>
              
              <div class="login-signup-section">
                <p>Already have an account? <a id="toggle-login">Login</a></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  attachEventListeners() {
    // Password show/hide toggle for all password fields
    document.querySelectorAll('.toggle-password-visibility').forEach(btn => {
      btn.addEventListener('click', function(e) {
        const input = this.parentElement.querySelector('input[type="password"], input[type="text"]');
        if (input) {
          if (input.type === 'password') {
            input.type = 'text';
            this.setAttribute('aria-label', 'Hide password');
            this.querySelector('.eye-icon').innerHTML = '<path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a21.81 21.81 0 0 1 5.06-6.88M1 1l22 22" stroke="currentColor" stroke-width="2" fill="none"/>';
          } else {
            input.type = 'password';
            this.setAttribute('aria-label', 'Show password');
            this.querySelector('.eye-icon').innerHTML = '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>';
          }
        }
      });
    });
  
    
    
    // Toggle between login and signup
    
    document.getElementById('toggle-signup').addEventListener('click', (e) => {
      e.preventDefault();
      this.switchMode('signup');
    });

    document.getElementById('toggle-login').addEventListener('click', (e) => {
      e.preventDefault();
      this.switchMode('login');
    });

    // Close modal
    document.querySelector('.login-modal-close').addEventListener('click', () => {
      this.closeModal();
    });

    // Close on overlay click
    document.getElementById('login-modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'login-modal-overlay') {
        this.closeModal();
      }
    });

    // Form submissions
    document.getElementById('login-form-element').addEventListener('submit', (e) => {
      this.handleLogin(e);
    });

    document.getElementById('signup-form-element').addEventListener('submit', (e) => {
      this.handleSignup(e);
    });

    // Google login button (placeholder)
    document.querySelector('.login-google-btn').addEventListener('click', () => {
      this.handleGoogleLogin();
    });

    // Clear errors when user starts typing in inputs
    document.getElementById('login-email').addEventListener('focus', () => {
      this.clearErrors();
    });

    document.getElementById('login-password').addEventListener('focus', () => {
      this.clearErrors();
    });

    document.getElementById('signup-email').addEventListener('focus', () => {
      this.clearErrors();
    });

    // reset verification if user edits the email after verifying
    document.getElementById('signup-email').addEventListener('input', (e) => {
      // if already verified, do not allow editing/clearing
      if (this.signupOtpVerified) return;
      const val = e.target.value.trim();
      // if email changed away from the pending verified one or removed, clear verification
      if (!val || val !== this.signupPendingEmail) {
        this.clearSignupVerification();
      }
    });

    document.getElementById('signup-password').addEventListener('focus', () => {
      this.clearErrors();
    });

    // Signup verify button and OTP verify inside modal
    const signupVerifyBtn = document.getElementById('signup-verify-btn');
    if (signupVerifyBtn) {
      signupVerifyBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await this.handleSignupSendOtp();
      });
    }

    const signupOtpVerifyBtn = document.getElementById('signup-otp-verify-btn');
    if (signupOtpVerifyBtn) {
      signupOtpVerifyBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await this.handleSignupVerifyOtp();
      });
    }
  }
isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  switchMode(mode) {
    this.currentMode = mode;
    
    if (mode === 'signup') {
      // Show signup form, hide login form
      document.querySelector('.login-form').classList.add('active');
      document.querySelector('.login-signup-form').classList.add('active');
    } else {
      // Show login form, hide signup form
      document.querySelector('.login-form').classList.remove('active');
      document.querySelector('.login-signup-form').classList.remove('active');
    }

    // Clear errors
    this.clearErrors();
  }

  async handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
      this.showError('login-error', 'Please fill all fields');
      return;
    }
if (!this.isValidEmail(email)) {
  this.showError('login-error', 'Please enter a valid email address (e.g. user@example.com)');
  return;
}
    const btn = e.target.querySelector('.login-btn');
    btn.classList.add('loading');
    btn.textContent = 'Logging in...';

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Login error response:', data);
        this.showError('login-error', data.error || 'Login failed');
        return;
      }

      // Store user in localStorage
      localStorage.setItem('user', JSON.stringify(data.user));
      this.isLoggedIn = true;

  // set session expiry (default 30 minutes)
  try { this.setSessionExpiry(Number(window.SESSION_TIMEOUT_MINUTES) || 30); } catch(e) {}

      this.showSuccess('login-success', 'Login successful!');

      // Close modal and redirect
      setTimeout(() => {
        this.closeModal();
        // Redirect to the page user wanted to access
        const redirectTo = this.redirectUrl || '/discover.html';
        this.redirectUrl = null; // Reset redirect URL
        window.location.href = redirectTo;
      }, 1500);

    } catch (err) {
      console.error('Login error:', err);
      this.showError('login-error', 'Network error. Please check your connection.');
    } finally {
      btn.classList.remove('loading');
      btn.textContent = 'Login';
    }
  }

  async handleSignup(e) {
    e.preventDefault();

    const firstName = document.getElementById('signup-firstname').value.trim();
    const lastName = document.getElementById('signup-lastname').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm-password').value;

    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      this.showError('signup-error', 'Please fill all fields');
      return;
    }
    

    if (password !== confirmPassword) {
      this.showError('signup-error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      this.showError('signup-error', 'Password must be at least 6 characters');
      return;
    }

    // require email verification before allowing signup
    if (!this.signupOtpVerified) {
      this.showError('signup-error', 'Please verify your email before signing up. Click Verify next to the email field.');
      return;
    }

    const btn = e.target.querySelector('.login-btn');
    btn.classList.add('loading');
    btn.textContent = 'Creating account...';

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        this.showError('signup-error', data.error || 'Signup failed');
        return;
      }

      // Store user in localStorage
      localStorage.setItem('user', JSON.stringify(data.user));
      this.isLoggedIn = true;

  // set session expiry (default 30 minutes)
  try { this.setSessionExpiry(Number(window.SESSION_TIMEOUT_MINUTES) || 30); } catch(e) {}

      this.showSuccess('signup-success', 'Signup successful! Welcome aboard 🎉');

      // Reset form
      document.getElementById('signup-form-element').reset();

      // Close modal and redirect
      setTimeout(() => {
        this.closeModal();
        // Redirect to discover page or redirect URL
        const redirectTo = this.redirectUrl || '/discover.html';
        this.redirectUrl = null; // Reset redirect URL
        window.location.href = redirectTo;
      }, 1500);

    } catch (err) {
      console.error('Signup error:', err);
      this.showError('signup-error', 'An error occurred. Please try again.');
    } finally {
      btn.classList.remove('loading');
      btn.textContent = 'Sign Up';
    }
  }

  // Send OTP for signup email
  async handleSignupSendOtp() {
    const email = document.getElementById('signup-email').value.trim();
    const statusEl = document.getElementById('signup-verify-status');
    if (!email) {
      this.showError('signup-error', 'Please enter your email first');
      return;
    }
    if (!this.isValidEmail(email)) {
      this.showError('signup-error', 'Please enter a valid email address');
      return;
    }

    // if already verified, don't resend OTP
    if (this.signupOtpVerified) {
      // keep UI as verified and do not send another OTP
      const verifyBtn = document.getElementById('signup-verify-btn');
      if (verifyBtn) {
        verifyBtn.classList.add('verified');
        verifyBtn.disabled = true;
        verifyBtn.style.pointerEvents = 'none';
      }
      statusEl.textContent = '';
      return;
    }

    statusEl.textContent = 'Sending OTP...';
    try {
      const res = await fetch('/api/otp/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) {
        console.error('Send signup OTP failed:', data);
        this.showError('signup-error', data.error || 'Failed to send OTP');
        statusEl.textContent = '';
        return;
      }

  // show OTP input
  document.getElementById('signup-otp-section').style.display = 'block';
      this.signupPendingEmail = email;
      this.signupOtpVerified = false;
      // update verify button appearance
      const verifyBtn = document.getElementById('signup-verify-btn');
      if (verifyBtn) {
  verifyBtn.classList.remove('verified');
  verifyBtn.classList.remove('resend');
  // after sending OTP, show 'Resend' in black
  verifyBtn.classList.add('resend');
  verifyBtn.textContent = 'Resend';
      }
  // do not show "OTP sent" message per UX request
  statusEl.textContent = '';
    } catch (err) {
      console.error('Error sending signup OTP', err);
      this.showError('signup-error', 'Network error while sending OTP');
      statusEl.textContent = '';
    }
  }

  // Verify signup OTP
  async handleSignupVerifyOtp() {
    const code = document.getElementById('signup-otp-input').value.trim();
    const msgEl = document.getElementById('signup-otp-message');
    if (!code) {
      this.showError('signup-error', 'Please enter the OTP');
      return;
    }
    if (!this.signupPendingEmail) {
      this.showError('signup-error', 'No pending email to verify. Please click Verify first.');
      return;
    }

  msgEl.textContent = 'Verifying...';
    try {
      const res = await fetch('/api/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: this.signupPendingEmail, code })
      });
      const data = await res.json();
      if (!res.ok) {
        console.error('Signup OTP verify failed:', data);
        this.showError('signup-error', data.error || 'OTP verification failed');
        msgEl.textContent = '';
        return;
      }

      this.signupOtpVerified = true;
  this.signupOtpVerified = true;
  msgEl.textContent = 'Email verified ✅';
      // update verify button style and text
      const verifyBtn = document.getElementById('signup-verify-btn');
      if (verifyBtn) {
        verifyBtn.classList.remove('pending');
        verifyBtn.classList.remove('resend');
        verifyBtn.classList.add('verified');
        verifyBtn.textContent = 'Verified';
        verifyBtn.disabled = true;
        verifyBtn.style.pointerEvents = 'none';
      }
      // hide OTP input after short delay so user sees success
      setTimeout(() => {
        const otpSection = document.getElementById('signup-otp-section');
        if (otpSection) otpSection.style.display = 'none';
        // clear OTP input
        const otpInput = document.getElementById('signup-otp-input');
        if (otpInput) otpInput.value = '';
        // make the email input readonly once verified
        const emailInput = document.getElementById('signup-email');
        if (emailInput) {
          emailInput.setAttribute('readonly', 'true');
        }
      }, 700);
    } catch (err) {
      console.error('Error verifying signup OTP', err);
      this.showError('signup-error', 'Network error while verifying OTP');
      msgEl.textContent = '';
    }
  }

  handleGoogleLogin() {
    // Placeholder for Google OAuth
    this.showError('login-error', 'Google login coming soon!');
  }

  showError(elementId, message) {
    const errorEl = document.getElementById(elementId);
    errorEl.textContent = message;
    errorEl.classList.add('show');
  }

  showSuccess(elementId, message) {
    const successEl = document.getElementById(elementId);
    successEl.textContent = message;
    successEl.classList.add('show');
  }

  clearErrors() {
    document.querySelectorAll('.login-error-message, .login-success-message').forEach(el => {
      el.classList.remove('show');
      el.textContent = '';
    });
  }

  openModal() {
    document.getElementById('login-modal-overlay').classList.add('active');
    this.clearErrors();
    this.switchMode('login');
  }

  closeModal() {
    document.getElementById('login-modal-overlay').classList.remove('active');
  // reset ephemeral signup verification state when modal closes
  try { this.clearSignupVerification(); } catch(e) {}
  }

  // Clear signup verification UI/state
  clearSignupVerification() {
    this.signupOtpVerified = false;
    this.signupPendingEmail = null;
    // reset verify button
    const verifyBtn = document.getElementById('signup-verify-btn');
    if (verifyBtn) {
      verifyBtn.classList.remove('verified');
      verifyBtn.classList.remove('pending');
      verifyBtn.textContent = 'Verify';
      verifyBtn.disabled = false;
      verifyBtn.style.pointerEvents = '';
    }
    // hide OTP section
    const otpSection = document.getElementById('signup-otp-section');
    if (otpSection) otpSection.style.display = 'none';
    // clear any status text
    const statusEl = document.getElementById('signup-verify-status');
    if (statusEl) statusEl.textContent = '';
    const msgEl = document.getElementById('signup-otp-message');
    if (msgEl) msgEl.textContent = '';
    // make sure email input is editable again
    const emailInput = document.getElementById('signup-email');
    if (emailInput) {
      emailInput.removeAttribute('readonly');
    }
  }

  logout() {
    localStorage.removeItem('user');
    this.isLoggedIn = false;
    this.clearSessionExpiry();
    window.location.href = '/index.html';
  }

  // Set session expiry minutes from now (stores timestamp in ms)
  setSessionExpiry(minutes) {
    const ms = Math.max(1, Number(minutes)) * 60 * 1000;
    const expiryTs = Date.now() + ms;
    localStorage.setItem('sessionExpiry', String(expiryTs));
  }

  clearSessionExpiry() {
    localStorage.removeItem('sessionExpiry');
  }

  // Periodically check session expiry every 15s
  startSessionMonitor() {
    if (this._sessionMonitorInterval) return;
    this._sessionMonitorInterval = setInterval(() => {
      const expiry = localStorage.getItem('sessionExpiry');
      if (!expiry) return;
      const ts = Number(expiry) || 0;
      if (Date.now() > ts) {
        // session expired
        clearInterval(this._sessionMonitorInterval);
        this._sessionMonitorInterval = null;
        // notify and logout
        alert('Your session has expired. Please login again.');
        this.logout();
      }
    }, 15000);
  }

  setupProtectedPages() {
    // List of pages that require login (except home page)
    const protectedPages = ['discover.html', 'trending.html', 'about.html', 'share.html'];
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    // Check if current page requires login
    if (protectedPages.includes(currentPage) && !this.isLoggedIn) {
      sessionStorage.setItem('redirectTo', window.location.href);
      this.openModal();
    }

    // Update navbar logout if user is logged in
    this.updateNavbar();
  }

  updateNavbar() {
    const navbar = document.querySelector('.navbar-menu');
    if (!navbar) return;

    // Remove existing profile menu if any
    const existingProfile = navbar.querySelector('.profile-menu-item');
    if (existingProfile) {
      existingProfile.remove();
    }

    if (this.isLoggedIn) {
      const user = this.getCurrentUser();
      const profileItem = document.createElement('li');
      profileItem.classList.add('profile-menu-item');
      
      // Use a profile icon (SVG) instead of name
      // Determine avatar source (user-provided or static fallback)
      const avatarSrc = (user && user.avatar) ? user.avatar : '/images/image-avtar.jpg';
      profileItem.innerHTML = `
        <a href="#" class="profile-link" title="${user.email}">
          <img src="${avatarSrc}" alt="avatar" style="width:32px;height:32px;border-radius:50%;object-fit:cover;vertical-align:middle;border:1px solid rgba(0,0,0,0.06);" onerror="this.onerror=null;this.src='/images/image-avtar.jpg'" />
          <svg class="profile-dropdown-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M7 10l5 5 5-5z" fill="currentColor"/>
          </svg>
        </a>

  <!-- removed side-list: using a nested submenu on the Profile row instead -->

        <div class="profile-dropdown">
          <div class="profile-item-with-sub">
            <a href="#" class="profile-menu-link profile-link-item">Profile</a>
          </div>
          <!-- submenu placed left of the main dropdown -->
          <div class="profile-submenu-left" aria-hidden="true">
            <a href="/personal.html" class="profile-menu-link personal-link">Personal details</a>
            <a href="/saved.html" class="profile-menu-link saved-link">Saved recipes</a>
          </div>
          <a href="#" class="profile-menu-link settings-link">Settings</a>
          <a href="#" class="profile-menu-link logout-link">Logout</a>
        </div>
      `;
      navbar.appendChild(profileItem);

      // Toggle dropdown on click
      const profileLink = profileItem.querySelector('.profile-link');
      profileLink.addEventListener('click', (e) => {
        e.preventDefault();
        const dropdown = profileItem.querySelector('.profile-dropdown');
        const profileRow = profileItem.querySelector('.profile-item-with-sub .profile-link-item');
        const isShown = dropdown.classList.toggle('show');
        // update aria-expanded for accessibility
        if (profileRow && profileRow.setAttribute) {
          profileRow.setAttribute('aria-expanded', isShown ? 'true' : 'false');
        }
      });

      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!profileItem.contains(e.target)) {
          profileItem.querySelector('.profile-dropdown').classList.remove('show');
        }
      });

      // Profile link click handler
      const profileLinkItem = profileItem.querySelector('.profile-link-item');
      profileLinkItem.addEventListener('click', (e) => {
        e.preventDefault();
        // Navigate to profile page (you can create this page later)
        console.log('Profile clicked for:', user.email);
        // window.location.href = '/profile.html';
      });

  // accessibility: toggle aria-expanded on hover/focus for nested submenu
  const profileItemWithSub = profileItem.querySelector('.profile-item-with-sub');
  const submenu = profileItem.querySelector('.profile-submenu-left');
      if (profileItemWithSub && submenu) {
        profileLinkItem.setAttribute('aria-haspopup', 'true');
        profileLinkItem.setAttribute('aria-expanded', 'false');

        // update aria on mouse enter/leave
        profileItemWithSub.addEventListener('mouseenter', () => {
          profileLinkItem.setAttribute('aria-expanded', 'true');
        });
        profileItemWithSub.addEventListener('mouseleave', () => {
          profileLinkItem.setAttribute('aria-expanded', 'false');
        });

        // keyboard focus support: show aria-expanded when focusing the profile link
        profileLinkItem.addEventListener('focus', () => profileLinkItem.setAttribute('aria-expanded', 'true'));
        profileLinkItem.addEventListener('blur', () => profileLinkItem.setAttribute('aria-expanded', 'false'));
      }

      // Personal details click handler: navigate directly (page enforces login)
      const personalLink = profileItem.querySelector('.personal-link');
      if (personalLink) {
        personalLink.addEventListener('click', (e) => {
          e.preventDefault();
          window.location.href = '/personal.html';
        });
      }

      // Saved recipes click handler: navigate directly (page enforces login)
      const savedLink = profileItem.querySelector('.saved-link');
      if (savedLink) {
        savedLink.addEventListener('click', (e) => {
          e.preventDefault();
          window.location.href = '/saved.html';
        });
      }

      // Settings link click handler
      profileItem.querySelector('.settings-link').addEventListener('click', (e) => {
        e.preventDefault();
        // Navigate to settings page (you can create this page later)
        console.log('Settings clicked for:', user.email);
        // window.location.href = '/settings.html';
      });

      // Logout link click handler
      profileItem.querySelector('.logout-link').addEventListener('click', (e) => {
        e.preventDefault();
        if (confirm('Are you sure you want to logout?')) {
          this.logout();
        }
      });
    }
  }

  // Public method to check login before navigation
  static requireLogin(event, redirectUrl) {
    // Ensure the modal instance exists
    let modal = window.loginModal;
    if (!modal) {
      try {
        modal = new LoginModal();
        window.loginModal = modal;
      } catch (e) {
        // If creating modal fails for any reason, allow navigation to proceed
        console.warn('Could not initialize login modal:', e);
        return true;
      }
    }

    // Try to infer the target href if redirectUrl not explicitly provided
    if (!redirectUrl && event && event.currentTarget) {
      try {
        const anchor = event.currentTarget.closest ? event.currentTarget.closest('a') : event.currentTarget;
        if (anchor && anchor.getAttribute) redirectUrl = anchor.getAttribute('href');
      } catch (e) {
        // ignore
      }
    }

    if (!modal.isLoggedIn) {
      // prevent default navigation and open login modal; after login the modal will redirect
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      modal.redirectUrl = redirectUrl || null; // store the desired URL
      modal.openModal();
      return false;
    }

    // If already logged in and a redirect URL is provided, navigate to it
    if (redirectUrl) {
      window.location.href = redirectUrl;
      return false;
    }

    return true;
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  window.loginModal = new LoginModal();
});
