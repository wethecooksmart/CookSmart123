class FeedbackModal {
  constructor() {
    this.selectedRating = 0;
    this.currentRecipeId = null;
    this.sessionId = this.getSessionId();
    this.attachEventListeners();
  }

  getSessionId() {
    let id = localStorage.getItem('sessionId');
    if (!id) {
      id = 'sess_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('sessionId', id);
    }
    return id;
  }

  attachEventListeners() {
    const stars = document.querySelectorAll('.star');
    const labels = ['Terrible 😞', 'Bad 😕', 'Okay 😐', 'Good 😊', 'Excellent! 🤩'];

    stars.forEach(star => {
      star.addEventListener('mouseover', () => {
        const val = parseInt(star.dataset.value);
        stars.forEach(s => s.classList.toggle('hovered', parseInt(s.dataset.value) <= val));
        document.getElementById('star-label').textContent = labels[val - 1];
      });

      star.addEventListener('mouseout', () => {
        stars.forEach(s => s.classList.remove('hovered'));
        document.getElementById('star-label').textContent =
          this.selectedRating ? labels[this.selectedRating - 1] : 'Click a star to rate';
      });

      star.addEventListener('click', () => {
        this.selectedRating = parseInt(star.dataset.value);
        stars.forEach(s => s.classList.toggle('selected', parseInt(s.dataset.value) <= this.selectedRating));
        document.getElementById('star-label').textContent = labels[this.selectedRating - 1];
        document.getElementById('feedback-submit').disabled = false;
      });
    });

    document.getElementById('feedback-submit').addEventListener('click', () => this.submitRating());
    document.querySelector('.feedback-close').addEventListener('click', () => this.closeModal());
    document.getElementById('feedback-modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'feedback-modal-overlay') this.closeModal();
    });
  }

  async openModal(recipeId, recipeName, recipeImage) {
    this.currentRecipeId = recipeId;
    this.selectedRating = 0;

    // Check if user is logged in
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    this.identifier = user ? user._id : this.getSessionId();
    this.userName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : 'Anonymous';
    this.isLoggedIn = !!user;

    // Reset UI
    document.querySelectorAll('.star').forEach(s => s.classList.remove('selected', 'hovered'));
    document.getElementById('star-label').textContent = 'Click a star to rate';
    document.getElementById('feedback-submit').disabled = true;
    document.getElementById('feedback-success').classList.remove('show');
    document.getElementById('feedback-submit').style.display = 'block';

    // Show/hide review section based on login
    document.getElementById('review-section').style.display = this.isLoggedIn ? 'block' : 'none';
    document.getElementById('login-required-msg').style.display = this.isLoggedIn ? 'none' : 'block';

    // Reset review textarea
    const textarea = document.getElementById('review-textarea');
    if (textarea) {
      textarea.value = '';
      document.getElementById('char-count').textContent = '0';
    }

    // Set recipe info
    document.getElementById('feedback-recipe-name').textContent = recipeName;
    document.getElementById('feedback-recipe-img').src = recipeImage;
    document.getElementById('feedback-modal-overlay').classList.add('active');

    // Load existing reviews
    await this.loadReviews(recipeId);
  }

  async loadReviews(recipeId) {
    try {
      const res = await fetch(`/api/recipes/${recipeId}/reviews`);
      const data = await res.json();

      const container = document.getElementById('reviews-content');

      if (!data.reviews || data.reviews.length === 0) {
        container.innerHTML = '<p class="no-reviews">No reviews yet. Be the first!</p>';
        return;
      }

      container.innerHTML = data.reviews.map(r => `
        <div class="review-item">
          <div class="review-item-header">
            <span class="review-item-name">👤 ${this.escapeHtml(r.userName || 'Anonymous')}</span>
            <span class="review-item-rating">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
          </div>
          <div class="review-item-text">${this.escapeHtml(r.review)}</div>
          <div class="review-item-date">${new Date(r.createdAt).toLocaleDateString()}</div>
        </div>
      `).join('');

    } catch (err) {
      console.error('Error loading reviews:', err);
    }
  }

  async submitRating() {
    try {
      if (!this.currentRecipeId) {
        alert('Recipe ID is missing!');
        return;
      }

      const review = this.isLoggedIn 
        ? (document.getElementById('review-textarea')?.value?.trim() || '') 
        : '';

      const response = await fetch(`/api/recipes/${this.currentRecipeId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: this.selectedRating,
          sessionId: this.identifier,
          review,
          userName: this.userName
        })
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.message || 'Could not submit rating');
        return;
      }

      document.getElementById('feedback-success').classList.add('show');
      document.getElementById('feedback-submit').style.display = 'none';

      // Reload reviews to show new one
      await this.loadReviews(this.currentRecipeId);

      setTimeout(() => this.closeModal(), 3000);

    } catch (err) {
      console.error('Submit error:', err);
      alert('Network error. Please try again.');
    }
  }

  escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  closeModal() {
    document.getElementById('feedback-modal-overlay').classList.remove('active');
  }
}

// Character count for textarea
function updateCharCount(textarea) {
  document.getElementById('char-count').textContent = textarea.value.length;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  window.feedbackModal = new FeedbackModal();
});