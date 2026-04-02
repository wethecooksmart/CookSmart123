// helper: normalize API response -> returns array and total count
async function fetchAndNormalize(url) {
  const res = await fetch(url, { cache: 'no-store' }); // avoid cached 304 while developing
  if (!res.ok && res.status !== 304) {
    // allow 304 to fall through (browser might return cached body), but handle common errors
    throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  }

  // Try parse JSON safely
  let data;
  try {
    data = await res.json();
  } catch (e) {
    // if empty/non-json body, return empty
    return { list: [], total: 0 };
  }

  // If the API returned a paged object { page, total, results }
  if (Array.isArray(data)) {
    return { list: data, total: data.length };
  }

  // Sometimes API returns { results: [...], total: N }
  if (data && data.results && Array.isArray(data.results)) {
    return { list: data.results, total: typeof data.total === 'number' ? data.total : data.results.length };
  }

  // If API returned a single object or other shape, attempt to handle common cases
  // e.g. { results: [], page: 1 } or { documents: [] }
  if (data && Array.isArray(data.documents)) {
    return { list: data.documents, total: typeof data.total === 'number' ? data.total : data.documents.length };
  }

  // fallback: not an array
  return { list: [], total: 0 };
}

// Example function that your UI calls when user adds ingredient or loads page
async function updateRecipesUI(searchQuery) {
  try {
    // choose endpoint: /api/search?ingredients=... or /api/recipes
    let url;
    if (searchQuery && searchQuery.trim().length > 0) {
      // encode ingredients csv if your UI uses a csv string like "rice,egg"
      url = `/api/search?ingredients=${encodeURIComponent(searchQuery)}&mode=and`;
    } else {
      url = '/api/recipes';
    }

    const { list, total } = await fetchAndNormalize(url);

    // update count label in UI (example: element with id="recipes-count")
    const countEl = document.querySelector('#recipes-count');
    if (countEl) {
      // prefer total (server-side count) if available, else use list.length
      countEl.textContent = `${total} recipes found`;
    }

    // render recipes into your DOM (replace container id/class as needed)
    const container = document.querySelector('#recipes-container');
    if (!container) return;

    container.innerHTML = ''; // clear

    if (list.length === 0) {
      container.innerHTML = `
        <div class="no-results">
          <p>No recipes found</p>
          <p>Try adding different ingredients!</p>
        </div>
      `;
      return;
    }

    // Example rendering: customize to your card markup
    const html = list.map(r => `
      <div class="recipe-card">
        <h3>${escapeHtml(r.name || 'Untitled')}</h3>
        <p>${(r.description || '').slice(0, 120)}</p>
        <p><strong>Ingredients:</strong> ${Array.isArray(r.ingredients) ? r.ingredients.join(', ') : ''}</p>
      </div>
    `).join('');
    container.innerHTML = html;

  } catch (err) {
    console.error('Error updating recipes UI:', err);
  }
}

// small helper to avoid XSS if you insert strings as HTML
function escapeHtml(str = '') {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// Example: wire this up to your input/button
document.querySelector('#ingredient-input')?.addEventListener('change', (e) => {
  const value = e.target.value.trim();
  // if your UI stores multiple ingredients in a tag list, pass CSV string "rice,egg"
  updateRecipesUI(value);
});

function toggleMenu() {
  const menu = document.getElementById('navbar-menu');
  const hamburger = document.getElementById('hamburger');
  if (!menu || !hamburger) return;
  menu.classList.toggle('open');
  hamburger.classList.toggle('open');
}

document.addEventListener('click', function (e) {
  const menu = document.getElementById('navbar-menu');
  const hamburger = document.getElementById('hamburger');
  if (!menu || !hamburger) return;
  if (!menu.contains(e.target) && !hamburger.contains(e.target)) {
    menu.classList.remove('open');
    hamburger.classList.remove('open');
  }
});

// On page load show all recipes and close mobile menu on nav clicks
document.addEventListener('DOMContentLoaded', () => {
  updateRecipesUI(''); // loads /api/recipes
  document.querySelectorAll('.navbar-menu a').forEach(link => {
    link.addEventListener('click', () => {
      const menu = document.getElementById('navbar-menu');
      const hamburger = document.getElementById('hamburger');
      if (menu && hamburger) {
        menu.classList.remove('open');
        hamburger.classList.remove('open');
      }
    });
  });
});
