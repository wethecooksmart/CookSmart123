// profile-pages.js
// Shared utilities and rendering for saved recipes page
const API = '/api';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Track liked recipe ids for the logged-in user so buttons reflect state
let likedRecipeIds = new Set();

function normalizeId(val) {
  if (!val && val !== 0) return '';
  if (typeof val === 'string' || typeof val === 'number') return String(val);
  if (val._id) return String(val._id);
  if (val.id) return String(val.id);
  try { return String(val); } catch (e) { return ''; }
}

function isRecipeLikedByUser(recipe) {
  const rid = normalizeId(recipe._id || recipe.id || recipe);
  if (!rid) return false;
  if (likedRecipeIds.has(rid)) return true;
  for (const x of likedRecipeIds) {
    if (!x) continue;
    if (String(x) === rid) return true;
  }
  return false;
}

function renderRecipeCardHtml(r, index) {
  const imageFile = r.image || r.imageUrl;
  const imageUrl = imageFile ? (String(imageFile).startsWith('http') ? escapeHtml(imageFile) : `images/${escapeHtml(imageFile)}`) : null;
  const timeVal = (r.cookingTime != null ? r.cookingTime : r.time);
  const timeDisplay = (timeVal != null && timeVal !== "") ? timeVal : "N/A";
  const ingredientsText = Array.isArray(r.ingredients) ? r.ingredients.join(', ') : String(r.ingredients || '');
  const id = normalizeId(r._id || r.id || r);

  return `
    <div class="recipe-card" data-id="${escapeHtml(id)}">
      ${imageUrl ? `
        <img 
          src="${imageUrl}" 
          alt="${escapeHtml(r.name || r.title || 'Recipe image')}" 
          class="recipe-image"
          onerror="this.style.display='none';"
        />
      ` : ''}

      <h3>${escapeHtml(r.name || r.title || 'Untitled Recipe')}</h3>
      <p>${escapeHtml(r.description || '')}</p>
      <p><strong>Ingredients:</strong> ${escapeHtml(ingredientsText)}</p>
      <p><strong>Time:</strong> ${escapeHtml(timeDisplay)} min</p>
      <p><strong>Rating:</strong> ⭐ ${escapeHtml(r.rating != null ? r.rating : 'N/A')}</p>

      <!-- Recipe Options Section -->
      <div class="recipe-options">
        <button class="option-btn save-btn active" onclick="saveRecipeFromSaved('${escapeHtml(id)}', this)" title="Remove from Saved" aria-label="Saved recipe; hover to remove">
          <span class="option-icon">💾✓</span>
          <span class="option-text saved-text">Saved</span>
          <span class="option-text remove-text">Remove</span>
        </button>
        <button class="option-btn share-btn" onclick="shareRecipeFromSaved('${escapeHtml(id)}')" title="Share Recipe">
          <span class="option-icon">📤</span>
          <span class="option-text">Share</span>
        </button>
      </div>

      <button class="more-details-btn" onclick="openRecipeFromSaved('${escapeHtml(id)}')">More Details</button>
    </div>
  `;
}

// Open recipe from saved page (navigate to discover with anchor)
// open modal with recipe details (same as Discover)
async function openRecipeFromSaved(id) {
  try {
    const res = await fetch(`${API}/recipes/${id}`);
    if (!res.ok) throw new Error('Recipe not found');
    const recipe = await res.json();
    showRecipeModal(recipe);
  } catch (err) {
    console.error('Could not open recipe', err);
    // fallback to navigate to discover
    window.location.href = `/discover.html#recipe=${id}`;
  }
}

// Modal utilities
function ensureModalExists() {
  if (document.getElementById('recipeModal')) return;
  const overlay = document.createElement('div');
  overlay.id = 'recipeModal';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-content" onclick="event.stopPropagation()">
      <button class="modal-close" onclick="closeModal()">✕</button>
      <div id="modalRecipeContent"></div>
    </div>
  `;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.body.appendChild(overlay);
}

function showRecipeModal(recipe) {
  ensureModalExists();
  const overlay = document.getElementById('recipeModal');
  const content = document.getElementById('modalRecipeContent');
  if (!content) return;

  const imageFile = recipe.image || recipe.imageUrl;
  const imageUrl = imageFile ? (String(imageFile).startsWith('http') ? escapeHtml(imageFile) : `images/${escapeHtml(imageFile)}`) : null;
  const timeVal = (recipe.cookingTime != null ? recipe.cookingTime : recipe.time);
  const timeDisplay = (timeVal != null && timeVal !== "") ? timeVal : "N/A";

  let nutritionHtml = "";
  if (recipe.nutrition && typeof recipe.nutrition === "object") {
    const items = Object.entries(recipe.nutrition)
      .map(([key, value]) => `<li><strong>${escapeHtml(key)}:</strong> ${escapeHtml(String(value))}</li>`)
      .join('');
    if (items) {
      nutritionHtml = `
        <div class="modal-nutrition-dropdown">
          <button class="nutrition-dropdown-btn" onclick="toggleNutrition(event)">
            <span>Nutrition</span>
            <span class="arrow">▼</span>
          </button>
          <div class="modal-nutrition-content">
            <ul class="modal-nutrition-list">
              ${items}
            </ul>
          </div>
        </div>
      `;
    }
  }

  const ingredientsText = Array.isArray(recipe.ingredients) ? recipe.ingredients.join(', ') : String(recipe.ingredients || '');

  const modalHtml = `
    ${imageUrl ? `<img src="${imageUrl}" alt="${escapeHtml(recipe.name || recipe.title || 'Recipe image')}" class="modal-recipe-image" onerror="this.style.display='none'"/>` : ''}
    <h2 class="modal-recipe-title">${escapeHtml(recipe.name || recipe.title || 'Untitled Recipe')}</h2>
    <p class="modal-recipe-description">${escapeHtml(recipe.description || 'No description available.')}</p>
    <div class="modal-ingredients-section"><strong>Ingredients:</strong> <span>${escapeHtml(ingredientsText)}</span></div>
    <div class="modal-details-row">
      <div class="modal-detail-item"><strong>Servings</strong><span>${recipe.servings || 4}</span></div>
      <div class="modal-detail-item"><strong>Time</strong><span>${escapeHtml(timeDisplay)} min</span></div>
      <div class="modal-detail-item"><strong>Difficulty</strong><span>${escapeHtml(recipe.difficulty || 'Unknown')}</span></div>
      <div class="modal-detail-item"><strong>Rating</strong><span>⭐ ${escapeHtml(recipe.rating != null ? recipe.rating : 'N/A')}</span></div>
    </div>
    <div class="modal-youtube-actions">
      <a href="https://www.youtube.com/results?search_query=${encodeURIComponent((recipe.name || recipe.title || 'recipe') + ' recipe')}" 
         target="_blank" 
         rel="noopener noreferrer" 
         class="modal-youtube-link youtube">
        🎥 Watch Recipe on YouTube
      </a>

      <a href="https://www.google.com/search?q=${encodeURIComponent((recipe.name || recipe.title || 'recipe') + ' recipe')}" 
         target="_blank" 
         rel="noopener noreferrer" 
         class="modal-youtube-link google">
        🔍 Search on Google
      </a>
    </div>

    ${nutritionHtml}
  `;

  content.innerHTML = modalHtml;
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  const overlay = document.getElementById('recipeModal');
  if (overlay) overlay.classList.remove('active');
  document.body.style.overflow = 'auto';
}

// Toggle nutrition dropdown in modal
function toggleNutrition(event) {
  event.preventDefault();
  const btn = event.currentTarget;
  const content = btn.nextElementSibling;
  if (!btn || !content) return;
  btn.classList.toggle('active');
  content.classList.toggle('show');
}

// Toggle save from saved page: if unsaved, remove card from DOM
async function saveRecipeFromSaved(recipeId, btnEl) {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  if (!user || !user._id) { window.loginModal && window.loginModal.openModal(); return; }
  try {
    const res = await fetch(`/api/recipes/${recipeId}/save`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user._id })
    });
    if (!res.ok) throw new Error('Save failed');
    const data = await res.json();
    if (!data.saved) {
      // Removed from saved - remove card
      const card = document.querySelector(`.recipe-card[data-id="${recipeId}"]`);
      if (card && card.parentElement) card.parentElement.removeChild(card);
      const container = document.getElementById('savedRecipesContainer');
      if (container && container.children.length === 0) document.getElementById('savedEmpty').style.display = 'block';
      showMessage && showMessage('Removed from saved', 'info');
    } else {
      // still saved - give feedback
      showMessage && showMessage('Recipe saved', 'success');
    }
  } catch (err) {
    console.error('Save error', err);
    showMessage && showMessage('Could not update saved recipe', 'error');
  }
}

// Like functionality removed for saved page (kept on Discover)

// Share handler
function shareRecipeFromSaved(recipeId) {
  const url = `${window.location.origin}/discover.html#recipe=${recipeId}`;
  if (navigator.share) {
    navigator.share({ title: 'Recipe', url }).catch(() => {});
  } else {
    navigator.clipboard.writeText(url).then(() => showMessage && showMessage('Link copied to clipboard', 'success')).catch(()=>showMessage && showMessage('Could not copy link','error'));
  }
}

async function fetchSavedRecipes() {
  // Require server fetch for saved recipes (no localStorage fallback)
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const container = document.getElementById('savedRecipesContainer');
  const empty = document.getElementById('savedEmpty');

  if (!container) return;
  if (!user) {
    // Not logged in - should not reach here due to page redirect; show empty state.
    container.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  // Logged in: request user's saved recipes from server
  try {
    // Fetch saved recipes and liked ids in parallel so we can render like buttons correctly
    const [savedRes, likesRes] = await Promise.all([
      fetch(`${API}/users/${user._id}/saved`),
      fetch(`${API}/users/${user._id}/likes`).catch(() => ({ ok: false }))
    ]);

    if (!savedRes.ok) throw new Error('Failed to fetch saved recipes');
    const savedData = await savedRes.json();
    const list = Array.isArray(savedData.saved) ? savedData.saved : (Array.isArray(savedData) ? savedData : []);

    // populate liked ids if available
    likedRecipeIds = new Set();
    if (likesRes && likesRes.ok) {
      const likesData = await likesRes.json();
      if (Array.isArray(likesData.likedIds)) {
        likedRecipeIds = new Set(likesData.likedIds.map(String));
      } else if (Array.isArray(likesData.liked)) {
        likedRecipeIds = new Set(likesData.liked.map(r => normalizeId(r._id || r.id || r)));
      }
    }

    if (!list || list.length === 0) {
      container.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';
    container.innerHTML = list.map((r, i) => renderRecipeCardHtml(r, i)).join('');
  } catch (err) {
    console.error('Fetch saved error', err);
    // No local fallback: show empty state and prompt user to try again
    container.innerHTML = '';
    empty.style.display = 'block';
    console.warn('Saved recipes could not be loaded from server. Ensure you are logged in and the server is reachable.');
  }
}

// init
window.addEventListener('DOMContentLoaded', () => {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  if (!user || !user._id) {
    // not logged in - redirect to home (no login modal on this page)
    window.location.href = '/index.html';
    return;
  }
  fetchSavedRecipes();
});
