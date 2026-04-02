// personal.js
// Handles Personal Details page: full name, email, contact number, edit mode, OTP verification for email/phone changes.

const API = '/api';

// Default avatar SVG (neutral human silhouette) as data URL
const DEFAULT_AVATAR_SVG = `
<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240' viewBox='0 0 240 240'>
  <rect width='100%' height='100%' fill='%23f3f4f6' />
  <g fill='%23cbd5e1'>
    <circle cx='120' cy='76' r='48' />
    <path d='M36 200c0-44 42-80 84-80s84 36 84 80H36z' />
  </g>
</svg>`;
const DEFAULT_AVATAR = 'data:image/svg+xml;utf8,' + encodeURIComponent(DEFAULT_AVATAR_SVG);

function showMessage(msg, type = 'info'){
  const el = document.getElementById('personalMessage');
  el.style.display = 'block';
  el.textContent = msg;
  el.style.background = type === 'success' ? '#e6ffed' : (type === 'error' ? '#ffecec' : '#f3f4f6');
  el.style.color = type === 'success' ? '#0f5132' : (type === 'error' ? '#9b2c2c' : '#374151');
}

function hideMessage(){
  const el = document.getElementById('personalMessage');
  el.style.display = 'none';
  el.textContent = '';
}

async function saveToServer(userId, payload){
  try{
  console.log('Saving to server for user', userId, 'payload preview:', Object.keys(payload));
  // avoid logging large avatar data
  const preview = Object.assign({}, payload);
  if (preview.avatar) preview.avatar = `<data-url ${Math.ceil((preview.avatar.length - preview.avatar.indexOf(',') - 1) * 3 / 4)} bytes>`;
  console.log('Save payload preview details:', preview);
    const res = await fetch(`${API}/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const data = await res.json().catch(()=>({}));
      throw new Error(data.message || 'Server error');
    }
    return await res.json();
  }catch(err){
    console.warn('Server save failed', err);
    throw err;
  }
}

function populateForm(user){
  // name field removed; set profile title from email or fallback
  // document.getElementById('name').value = user.name || '';
  document.getElementById('email').value = user.email || '';
  document.getElementById('contactNumber').value = user.contactNumber || '';
  const genderEl = document.getElementById('gender');
  if (genderEl) genderEl.value = user.gender || '';
  const dobEl = document.getElementById('dob');
  if (dobEl) dobEl.value = user.dob ? new Date(user.dob).toISOString().slice(0,10) : '';
  // show member since Month Year
  const memberSinceEl = document.getElementById('memberSince');
  if (memberSinceEl) {
    if (user.createdAt) {
      const d = new Date(user.createdAt);
      const month = d.toLocaleString(undefined, { month: 'long' });
      const year = d.getFullYear();
      memberSinceEl.textContent = `Member since ${month} ${year}`;
    } else {
      memberSinceEl.textContent = '';
    }
  }
  // update left profile card
  const pname = document.getElementById('profileName');
  if (pname) pname.textContent = user.name || 'Your name';
  const avatar = document.getElementById('profileAvatar');
  if (avatar) {
    // prefer a bundled static image if available, otherwise fallback to inline SVG
    const staticFallback = '/images/image-avtar.jpg';
    avatar.src = (user && user.avatar) ? user.avatar : staticFallback;
    // if static image fails to load, fallback to DEFAULT_AVATAR
    avatar.onerror = function() { this.onerror = null; this.src = DEFAULT_AVATAR; };
  }
  // show inline verify text and mark Verified when present
  const verifyEmailBtn = document.getElementById('verifyEmailBtn');
  const verifyContactBtn = document.getElementById('verifyContactBtn');
  // initialize verify text state
  if (verifyEmailBtn) {
    verifyEmailBtn.style.display = 'inline-block';
    if (user.email) {
      verifyEmailBtn.textContent = 'Verified';
      verifyEmailBtn.classList.remove('clickable');
      verifyEmailBtn.classList.remove('pending');
      verifyEmailBtn.classList.add('verified');
    } else {
      verifyEmailBtn.textContent = 'Verify';
      verifyEmailBtn.classList.add('clickable');
      verifyEmailBtn.classList.remove('verified');
      verifyEmailBtn.classList.remove('pending');
    }
  }
  if (verifyContactBtn) {
    verifyContactBtn.style.display = 'inline-block';
    if (user.contactNumber) {
      verifyContactBtn.textContent = 'Verified';
      verifyContactBtn.classList.remove('clickable');
      verifyContactBtn.classList.remove('pending');
      verifyContactBtn.classList.add('verified');
    } else {
      verifyContactBtn.textContent = 'Verify';
      verifyContactBtn.classList.add('clickable');
      verifyContactBtn.classList.remove('verified');
      verifyContactBtn.classList.remove('pending');
    }
  }
}

// Avatar file handling: preview and store base64 in sessionStorage pending changes
// Resize image file to a target max dimension and byte size using canvas.
async function resizeImageFile(file, { maxDim = 512, targetBytes = 200 * 1024 } = {}) {
  if (!file) return null;
  // Load file into Image
  const dataUrl = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });

  // compute target dimensions maintaining aspect ratio
  let { width, height } = img;
  const ratio = width / height;
  if (width > height) {
    if (width > maxDim) { width = maxDim; height = Math.round(maxDim / ratio); }
  } else {
    if (height > maxDim) { height = maxDim; width = Math.round(maxDim * ratio); }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);

  // Try decreasing quality until under targetBytes or min quality reached
  let quality = 0.92;
  let blobUrl = canvas.toDataURL('image/jpeg', quality);
  const approxBytes = (s) => Math.ceil((s.length - s.indexOf(',') - 1) * 3 / 4);
  let bytes = approxBytes(blobUrl);

  while (bytes > targetBytes && quality > 0.45) {
    quality -= 0.08;
    blobUrl = canvas.toDataURL('image/jpeg', quality);
    bytes = approxBytes(blobUrl);
  }

  // If still too big, scale down dimensions progressively
  while (bytes > targetBytes && (width > 100 && height > 100)) {
    width = Math.round(width * 0.85);
    height = Math.round(height * 0.85);
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(img, 0, 0, width, height);
    quality = Math.max(0.4, quality - 0.05);
    blobUrl = canvas.toDataURL('image/jpeg', quality);
    bytes = approxBytes(blobUrl);
  }

  // Final check: if still too large, return the latest blobUrl (server will reject if over limit)
  return blobUrl;
}

// Compress an existing data URL (image) by drawing it to canvas and exporting JPEG
async function compressDataUrl(dataUrl, { maxDim = 512, targetBytes = 200 * 1024 } = {}) {
  if (!dataUrl) return null;
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });

  let { width, height } = img;
  const ratio = width / height;
  if (width > height) {
    if (width > maxDim) { width = maxDim; height = Math.round(maxDim / ratio); }
  } else {
    if (height > maxDim) { height = maxDim; width = Math.round(maxDim * ratio); }
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  let quality = 0.9;
  let blobUrl;
  let bytes;

  while (true) {
    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0,0,canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, width, height);
    blobUrl = canvas.toDataURL('image/jpeg', quality);
    const approxBytes = (s) => Math.ceil((s.length - s.indexOf(',') - 1) * 3 / 4);
    bytes = approxBytes(blobUrl);
    if (bytes <= targetBytes || (quality <= 0.35 && (width <= 120 || height <= 120))) break;
    // lower quality first, then dimensions
    if (quality > 0.4) {
      quality = Math.max(0.35, quality - 0.12);
    } else {
      width = Math.round(width * 0.8);
      height = Math.round(height * 0.8);
    }
  }

  return blobUrl;
}

async function handleAvatarFile(file) {
  if (!file) return;
  try {
    console.log('Preparing avatar image...');
    const resizedDataUrl = await resizeImageFile(file, { maxDim: 512, targetBytes: 200 * 1024 });
    if (!resizedDataUrl) {
      showMessage('Could not process image', 'error');
      return;
    }
    // preview
    const avatarEl = document.getElementById('profileAvatar');
    if (avatarEl) avatarEl.src = resizedDataUrl;
    // store pending avatar change until user saves/verifies
    sessionStorage.setItem('pendingAvatar', resizedDataUrl);
    // mark save state and attempt auto-save
    updateSaveEnabled();
    hideMessage();
  } catch (err) {
    console.error('Error processing avatar file', err);
  showMessage('Failed to process image', 'error');
  }
}

// Auto-save avatar immediately after previewing
async function autoSaveAvatarIfLoggedIn() {
  const pendingAvatar = sessionStorage.getItem('pendingAvatar');
  const user = JSON.parse(localStorage.getItem('user') || 'null') || {};
  if (!pendingAvatar || !user._id) return;

  const btn = document.getElementById('editAvatarBtn');
  if (btn) btn.disabled = true;
  try {
  // compute approximate payload size for diagnostics (logged, not shown to user)
  const approxBytesPending = Math.ceil((pendingAvatar.length - pendingAvatar.indexOf(',') - 1) * 3 / 4);
  console.log('Uploading avatar, approx bytes:', approxBytesPending);
    // use fetch directly so we can read status and error body for better diagnostics
    const resp = await fetch(`${API}/users/${user._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatar: pendingAvatar })
    });

    let body;
    const ct = resp.headers.get('content-type') || '';
    try {
      if (ct.includes('application/json')) body = await resp.json();
      else body = await resp.text();
    } catch (e) { body = await resp.text().catch(()=>null); }

    if (!resp.ok) {
      console.error('Avatar upload failed', resp.status, body);
      const serverMessage = (body && (body.message || body.error)) ? (body.message || body.error) : (typeof body === 'string' ? body : `Status ${resp.status}`);
      // If server rejected due to size (413), attempt to compress the pending avatar and retry once (silent to user)
      if (resp.status === 413) {
        console.log('Avatar too large on server, attempting a compressed retry (silent)...');
        const compressed = await compressDataUrl(pendingAvatar, { maxDim: 480, targetBytes: 180 * 1024 });
        if (compressed && compressed !== pendingAvatar) {
          console.log('Retrying avatar upload with compressed data (approx bytes):', Math.ceil((compressed.length - compressed.indexOf(',') - 1) * 3 / 4));
          const r2 = await fetch(`${API}/users/${user._id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ avatar: compressed }) });
          let b2; const ct2 = r2.headers.get('content-type') || '';
          try { b2 = ct2.includes('application/json') ? await r2.json() : await r2.text(); } catch(e){ b2 = await r2.text().catch(()=>null); }
          if (r2.ok && b2 && b2.user) {
            localStorage.setItem('user', JSON.stringify(b2.user));
            populateForm(b2.user);
            sessionStorage.removeItem('pendingAvatar');
            try { if (window.loginModal && typeof window.loginModal.updateNavbar === 'function') window.loginModal.updateNavbar(); } catch(e) {}
            // success: do not show success message per request
            return;
          }
          console.error('Compressed retry failed', r2.status, b2);
        }
      }
      // Show only failure to the user
      showMessage(`Avatar upload failed: ${serverMessage}`, 'error');
      return;
    }

    // success
    const res = body || {};
    if (res && res.user) {
      localStorage.setItem('user', JSON.stringify(res.user));
      populateForm(res.user);
      sessionStorage.removeItem('pendingAvatar');
      try { if (window.loginModal && typeof window.loginModal.updateNavbar === 'function') window.loginModal.updateNavbar(); } catch(e) {}
      // success: silent (no success UI message)
    } else {
      // unexpected shape: keep silent on success; only log
      console.warn('Avatar save returned unexpected body', res);
      sessionStorage.removeItem('pendingAvatar');
    }
  } catch (err) {
    console.error('Avatar upload failed', err);
    showMessage('Avatar upload failed: network error', 'error');
  } finally {
    if (btn) btn.disabled = false;
    updateSaveEnabled();
  }
}

function setVerifyStateForField(field, state) {
  // field: 'email' or 'contactNumber'
  const el = field === 'email' ? document.getElementById('verifyEmailBtn') : document.getElementById('verifyContactBtn');
  if (!el) return;
  el.classList.remove('pending', 'verified', 'clickable');
  if (state === 'pending') {
    el.textContent = 'Verify now';
    el.classList.add('pending', 'clickable');
  } else if (state === 'verified') {
    el.textContent = 'Verified';
    el.classList.add('verified');
  } else if (state === 'ready') {
    el.textContent = 'Verify';
    el.classList.add('clickable');
  }
}

function validateContactNumber(value) {
  if (!value) return { ok: false, message: 'Enter a contact number.' };
  // allow digits, remove non-digit chars for validation
  const digits = (value.match(/\d/g) || []).join('');
  if (digits.length !== 10) return { ok: false, message: 'Contact number must be exactly 10 digits.' };
  return { ok: true };
}

function showContactError(msg) {
  const el = document.getElementById('contactError');
  if (!el) return;
  if (!msg) { el.style.display = 'none'; el.textContent = ''; }
  else { el.style.display = 'block'; el.textContent = msg; }
}

function setReadonly(readonly) {
  ['email','contactNumber','dob'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.readOnly = !!readonly;
  });
  // selects use disabled instead of readOnly
  const genderSel = document.getElementById('gender');
  if (genderSel) genderSel.disabled = !!readonly;
  document.getElementById('editPersonal').style.display = readonly ? 'inline-block' : 'none';
  document.getElementById('cancelPersonal').style.display = readonly ? 'none' : 'inline-block';
  document.getElementById('savePersonal').style.display = readonly ? 'none' : 'inline-block';
  // Keep verify text visible; its content/class is managed by populateForm
  const verifyEmailBtn = document.getElementById('verifyEmailBtn');
  const verifyContactBtn = document.getElementById('verifyContactBtn');
  if (verifyEmailBtn) verifyEmailBtn.style.display = 'inline-block';
  if (verifyContactBtn) verifyContactBtn.style.display = 'inline-block';
}

function updateSaveEnabled() {
  // Disable Save if there are pendingChanges OR if email/contact fields are changed but not verified
  const pending = sessionStorage.getItem('pendingChanges');
  if (pending) {
    document.getElementById('savePersonal').disabled = true;
    return;
  }
  // If editable, enable save; otherwise, keep disabled
  const editable = document.getElementById('savePersonal').style.display !== 'none';
  document.getElementById('savePersonal').disabled = !editable ? true : false;
}

async function simulateSendOtp(target, pendingChanges) {
  // Call server to send OTP (server will use configured CookSmart email if available)
  try {
    const resp = await fetch(`${API}/otp/send-email`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: target }) });
    const data = await resp.json().catch(()=>({}));
    if (!resp.ok) {
      console.warn('send-email failed', data);
      showMessage('Failed to send OTP', 'error');
      return;
    }
    // store pending changes and target for verify step
    sessionStorage.setItem('pendingTarget', target);
    sessionStorage.setItem('pendingChanges', JSON.stringify(pendingChanges || {}));
    if (data.code) sessionStorage.setItem('pendingOtp', String(data.code)); // dev convenience only
    const otpSection = document.getElementById('otpSection');
    document.getElementById('otpMessage').textContent = `An OTP has been sent to ${target}.`;
    // Insert OTP UI inline if possible (same logic as before)
    otpSection.style.zIndex = 10002;
    const anchorId = sessionStorage.getItem('pendingAnchorId');
    if (anchorId) {
      const anchor = document.getElementById(anchorId);
      if (anchor) {
        const container = anchor.closest('.form-group') || anchor.parentElement;
        try {
          otpSection.style.display = 'none';
          container.insertAdjacentElement('afterend', otpSection);
          otpSection.style.position = 'relative';
          otpSection.style.left = '';
          otpSection.style.top = '';
          otpSection.style.transform = '';
          const rect = anchor.getBoundingClientRect();
          const desiredWidth = Math.min(720, Math.max(260, rect.width));
          otpSection.style.minWidth = `${Math.round(desiredWidth)}px`;
          otpSection.style.display = 'block';
          try { anchor.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
          const otpInput = document.getElementById('otpInput'); if (otpInput) otpInput.focus();
          return;
        } catch (e) {
          console.warn('inline OTP insertion failed, falling back to centered overlay', e);
        }
      }
      otpSection.style.position = 'fixed';
      otpSection.style.left = '50%';
      otpSection.style.top = '50%';
      otpSection.style.transform = 'translate(-50%, -50%)';
      otpSection.style.minWidth = '320px';
      otpSection.style.display = 'block';
      const otpInput = document.getElementById('otpInput'); if (otpInput) otpInput.focus();
      return;
    }
    otpSection.style.position = 'fixed';
    otpSection.style.left = '50%';
    otpSection.style.top = '50%';
    otpSection.style.transform = 'translate(-50%, -50%)';
    otpSection.style.minWidth = '320px';
    otpSection.style.display = 'block';
    const otpInput = document.getElementById('otpInput'); if (otpInput) otpInput.focus();
  } catch (err) {
    console.error('send OTP error', err);
    showMessage('Failed to send OTP: network error', 'error');
  }
}

function clearOtp() {
  sessionStorage.removeItem('pendingOtp');
  sessionStorage.removeItem('pendingTarget');
  sessionStorage.removeItem('pendingChanges');
  sessionStorage.removeItem('pendingAnchorId');
  document.getElementById('otpInput').value = '';
  const otpSection = document.getElementById('otpSection');
  // move the OTP section back below the form to keep DOM predictable
  const form = document.getElementById('personalForm');
  if (form && otpSection) {
    form.insertAdjacentElement('afterend', otpSection);
    otpSection.style.position = '';
    otpSection.style.left = '';
    otpSection.style.top = '';
    otpSection.style.transform = '';
    otpSection.style.minWidth = '';
  }
  if (otpSection) otpSection.style.display = 'none';
}

window.addEventListener('DOMContentLoaded', () => {
  const stored = JSON.parse(localStorage.getItem('user') || 'null');
  if (!stored || !stored._id) {
    // not logged in - redirect to home (no login modal on this page)
    window.location.href = '/index.html';
    return;
  }
  // Fetch the freshest user from server to ensure avatar and fields are up-to-date
  (async function refreshUser(){
    try {
      const res = await fetch(`${API}/users/${stored._id}`);
      if (res.ok) {
        const d = await res.json();
        if (d && d.user) {
          localStorage.setItem('user', JSON.stringify(d.user));
          populateForm(d.user);
        } else {
          populateForm(stored);
        }
      } else {
        populateForm(stored);
      }
    } catch (e) {
      console.warn('Could not refresh user from server', e);
      populateForm(stored);
    }
  })();
  setReadonly(true);

  // live change detection: mark field pending when user edits email/contact
  document.getElementById('email').addEventListener('input', (e) => {
    const storedUser = JSON.parse(localStorage.getItem('user') || 'null') || {};
    const current = e.target.value.trim();
    if (current && current !== (storedUser.email || '')) {
      setVerifyStateForField('email', 'pending');
    } else {
      setVerifyStateForField('email', storedUser.email ? 'verified' : 'ready');
    }
    updateSaveEnabled();
  });

  document.getElementById('contactNumber').addEventListener('input', (e) => {
    const storedUser = JSON.parse(localStorage.getItem('user') || 'null') || {};
    const current = e.target.value.trim();
    // Validate contact number length (10 digits) before allowing verify
    const v = validateContactNumber(current);
    if (!v.ok) {
      showContactError(v.message);
      // mark verify as non-clickable
      setVerifyStateForField('contactNumber', 'ready');
      document.getElementById('verifyContactBtn').classList.remove('clickable');
    } else {
      showContactError('');
      if (current && current !== (storedUser.contactNumber || '')) {
        setVerifyStateForField('contactNumber', 'pending');
      } else {
        setVerifyStateForField('contactNumber', storedUser.contactNumber ? 'verified' : 'ready');
      }
    }
    updateSaveEnabled();
  });

  // Edit button toggles editable state
  document.getElementById('editPersonal').addEventListener('click', (e) => {
    e.preventDefault();
    setReadonly(false);
    hideMessage();
  updateSaveEnabled();
  });

  // Avatar edit button -> trigger file input
  const editAvatarBtn = document.getElementById('editAvatarBtn');
  const avatarInput = document.getElementById('avatarInput');
  if (editAvatarBtn && avatarInput) {
    editAvatarBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      avatarInput.click();
    });

    avatarInput.addEventListener('change', async (ev) => {
      const f = ev.target.files && ev.target.files[0];
      if (f) {
        await handleAvatarFile(f);
        // attempt immediate save for logged-in users
        await autoSaveAvatarIfLoggedIn();
      }
    });
  }

  // Cancel resets form to stored values
  document.getElementById('cancelPersonal').addEventListener('click', (e) => {
    e.preventDefault();
    populateForm(JSON.parse(localStorage.getItem('user') || 'null'));
    setReadonly(true);
    clearOtp();
    hideMessage();
  });

  // Save button: handle possible email/contact change -> OTP flow
  document.getElementById('savePersonal').addEventListener('click', async (e) => {
    e.preventDefault();
    hideMessage();

  const email = document.getElementById('email').value.trim();
    const contact = document.getElementById('contactNumber').value.trim();

    const user = JSON.parse(localStorage.getItem('user') || 'null') || {};

    // Detect sensitive changes that require OTP: email or contactNumber changed
    const emailChanged = email && email !== user.email;
    const contactChanged = contact && contact !== (user.contactNumber || '');

    if (emailChanged || contactChanged) {
    // Build the pendingChanges object including modified fields
    const pendingChanges = {};
  if (emailChanged) pendingChanges.email = email;
  const g = document.getElementById('gender').value;
  if (g !== (user.gender || '')) pendingChanges.gender = g;
  const d = document.getElementById('dob').value;
  if (d && d !== (user.dob ? new Date(user.dob).toISOString().slice(0,10) : '')) pendingChanges.dob = d;
      if (contactChanged) pendingChanges.contactNumber = contact;

      // Choose a target to send OTP to (prefer email if changed, otherwise contact)
      const target = pendingChanges.email ? pendingChanges.email : pendingChanges.contactNumber;
      simulateSendOtp(target, pendingChanges);
      showMessage('OTP sent. Please enter the OTP to verify changes before saving.', 'info');
      // mark save disabled until verification
      updateSaveEnabled();
      return;
    }

  // No OTP-required changes: persist immediately
  const updates = {};
  // include avatar if user selected one
  const pendingAvatar = sessionStorage.getItem('pendingAvatar');
  if (pendingAvatar) updates.avatar = pendingAvatar;
  if (contact) updates.contactNumber = contact;
  const g2 = document.getElementById('gender').value;
  if (typeof g2 !== 'undefined') updates.gender = g2;
  const d2 = document.getElementById('dob').value;
  if (d2) updates.dob = d2;

    try {
      if (user._id) {
  console.log('Attempting to save updates:', updates);
  const res = await saveToServer(user._id, updates);
        // res.user is the updated user
        localStorage.setItem('user', JSON.stringify(res.user));
        populateForm(res.user);
        setReadonly(true);
  // clear pending avatar stored in sessionStorage after successful save
  sessionStorage.removeItem('pendingAvatar');
        showMessage('Saved to your account', 'success');
      } else {
  // Require login to persist to database
  showMessage('You must be logged in to save changes to your account. Please login.', 'error');
  return;
      }
    } catch (err) {
      showMessage('Save failed. Please try again.', 'error');
    }
  });

  // Verify OTP
  document.getElementById('verifyOtp').addEventListener('click', async (e) => {
    e.preventDefault();
    const entered = document.getElementById('otpInput').value.trim();
    const target = sessionStorage.getItem('pendingTarget');
    if (!entered || !target) { showMessage('Please enter the OTP.', 'error'); return; }
    try {
      const resp = await fetch(`${API}/otp/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: target, code: entered }) });
      const data = await resp.json().catch(()=>({}));
      if (!resp.ok) { showMessage(data.error || 'OTP verification failed', 'error'); return; }
      // apply pending changes
      const pendingChanges = JSON.parse(sessionStorage.getItem('pendingChanges') || '{}');
      const user = JSON.parse(localStorage.getItem('user') || 'null') || {};
      const updates = Object.assign({}, pendingChanges || {});
      const pendingAvatar = sessionStorage.getItem('pendingAvatar'); if (pendingAvatar) updates.avatar = pendingAvatar;
      if (!user._id) { showMessage('You must be logged in to save changes. Please login.', 'error'); return; }
      const res = await saveToServer(user._id, updates);
      if (res && res.user) {
        localStorage.setItem('user', JSON.stringify(res.user));
        populateForm(res.user);
        setReadonly(true);
        sessionStorage.removeItem('pendingAvatar');
        showMessage('Verified and saved to your account', 'success');
      }
    } catch (err) {
      console.error('OTP verify/save error', err);
      showMessage('Verification failed: network error', 'error');
    } finally {
      clearOtp();
      updateSaveEnabled();
    }
  });

  document.getElementById('resendOtp').addEventListener('click', (e) => {
    e.preventDefault();
    const target = sessionStorage.getItem('pendingTarget');
    if (target) {
      const pendingChanges = JSON.parse(sessionStorage.getItem('pendingChanges') || '{}');
      simulateSendOtp(target, pendingChanges);
      showMessage('OTP resent (simulated).', 'info');
    } else {
      showMessage('No pending verification to resend.', 'error');
    }
  });

  // Wire up verify field buttons which trigger OTP for that specific field
  document.getElementById('verifyEmailBtn').addEventListener('click', (e) => {
    e.preventDefault();
    const btn = e.currentTarget || document.getElementById('verifyEmailBtn');
    // only trigger OTP flow when the element is explicitly clickable
    if (!btn.classList.contains('clickable')) return;
    const email = document.getElementById('email').value.trim();
    if (!email) { showMessage('Enter an email to verify.', 'error'); return; }
  const pendingChanges = { email };
  // store anchor id so the OTP popup can be positioned under the email input element
  sessionStorage.setItem('pendingAnchorId', 'email');
  simulateSendOtp(email, pendingChanges);
    updateSaveEnabled();
  });

  document.getElementById('verifyContactBtn').addEventListener('click', (e) => {
    e.preventDefault();
    const btn = e.currentTarget || document.getElementById('verifyContactBtn');
    // only trigger OTP flow when the element is explicitly clickable
    if (!btn.classList.contains('clickable')) return;
    const contact = document.getElementById('contactNumber').value.trim();
    if (!contact) { showMessage('Enter a contact number to verify.', 'error'); return; }
  const pendingChanges = { contactNumber: contact };
  // For development: send the OTP to the user's email instead of SMS
  const user = JSON.parse(localStorage.getItem('user') || 'null') || {};
  const emailTarget = user.email || document.getElementById('email').value.trim();
  if (!emailTarget) { showMessage('No email available to send verification. Please set an email first.', 'error'); return; }
  // position the OTP UI under the contact input for UX, but send OTP to email
  sessionStorage.setItem('pendingAnchorId', 'contactNumber');
  simulateSendOtp(emailTarget, pendingChanges);
    updateSaveEnabled();
  });

  // initial save state
  updateSaveEnabled();
});
