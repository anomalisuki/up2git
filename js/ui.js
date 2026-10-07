/**
 * UI Manager Module
 * Handles DOM manipulation, view transitions, notifications, dialogs, dynamic rendering, and Upload History Chart.
 */

class UIManager {
  constructor() {
    this.activeView = 'home';
  }

  /**
   * Switch between app views smoothly
   */
  switchView(viewId) {
    const views = document.querySelectorAll('.view');
    const navItems = document.querySelectorAll('.nav-item');

    views.forEach(v => {
      v.classList.remove('active');
      if (v.id === `view-${viewId}`) {
        v.classList.add('active');
      }
    });

    navItems.forEach(item => {
      item.classList.remove('active');
      if (item.dataset.target === viewId) {
        item.classList.add('active');
      }
    });

    this.activeView = viewId;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /**
   * Show Toast Notification
   */
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = `<svg class="toast-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
    } else if (type === 'error') {
      iconSvg = `<svg class="toast-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
    } else {
      iconSvg = `<svg class="toast-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }

    toast.innerHTML = `
      ${iconSvg}
      <div class="toast-text">${message}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translate3d(0, -12px, 0) scale(0.96)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3800);
  }

  /**
   * Toggle Global Loading Overlay
   */
  showLoading(show, text = 'Memproses...') {
    const overlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');
    if (!overlay) return;

    if (show) {
      if (loadingText) loadingText.textContent = text;
      overlay.classList.add('active');
    } else {
      overlay.classList.remove('active');
    }
  }

  /**
   * Show iOS Style Confirmation Modal
   */
  showConfirmModal(title, bodyHtml, onConfirm) {
    const overlay = document.getElementById('modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const btnConfirm = document.getElementById('modal-btn-confirm');
    const btnCancel = document.getElementById('modal-btn-cancel');

    if (!overlay) return;

    modalTitle.textContent = title;
    modalBody.innerHTML = bodyHtml;

    const cleanup = () => {
      overlay.classList.remove('active');
      btnConfirm.replaceWith(btnConfirm.cloneNode(true));
      btnCancel.replaceWith(btnCancel.cloneNode(true));
    };

    const newConfirm = document.getElementById('modal-btn-confirm');
    const newCancel = document.getElementById('modal-btn-cancel');

    newConfirm.addEventListener('click', () => {
      cleanup();
      if (onConfirm) onConfirm();
    });

    newCancel.addEventListener('click', cleanup);

    overlay.classList.add('active');
  }

  /**
   * Render Home View authenticated profile state & Chart
   */
  renderUserProfile(user) {
    const authSection = document.getElementById('auth-section');
    const profileSection = document.getElementById('profile-section');

    if (!user) {
      authSection.classList.remove('hidden');
      profileSection.classList.add('hidden');
      return;
    }

    authSection.classList.add('hidden');
    profileSection.classList.remove('hidden');

    document.getElementById('profile-avatar').src = user.avatar_url;
    document.getElementById('profile-name').textContent = user.name || user.login;
    document.getElementById('profile-username').textContent = `@${user.login}`;
    document.getElementById('profile-username').href = user.html_url;
    document.getElementById('profile-bio').textContent = user.bio || "Tidak ada biografi GitHub.";
    document.getElementById('stat-repos-count').textContent = user.public_repos !== undefined ? user.public_repos : '-';

    this.renderHistoryChart();
  }

  /**
   * Render Upload History Bar Chart
   */
  renderHistoryChart() {
    const container = document.getElementById('history-chart-container');
    const badgeEl = document.getElementById('total-uploaded-badge');
    if (!container || !badgeEl) return;

    let history = JSON.parse(localStorage.getItem('up2git_upload_history') || '[]');

    if (history.length === 0) {
      history = [
        { date: '26 Jun', repo: 'starter-kit', count: 5 },
        { date: '27 Jun', repo: 'web-config', count: 8 },
        { date: '28 Jun', repo: 'mobile-ui', count: 14 },
        { date: '29 Jun', repo: 'up2git', count: 11 }
      ];
      localStorage.setItem('up2git_upload_history', JSON.stringify(history));
    }

    const latest = history.slice(-6);
    const totalCount = history.reduce((acc, curr) => acc + (curr.count || 0), 0);
    badgeEl.textContent = `${totalCount} File Total`;

    const maxVal = Math.max(...latest.map(h => h.count || 0), 10);

    container.innerHTML = '';

    latest.forEach(item => {
      const heightPercent = Math.max(Math.round(((item.count || 0) / maxVal) * 100), 10);

      const col = document.createElement('div');
      col.className = 'chart-bar-col';
      col.innerHTML = `
        <span class="chart-val">${item.count}</span>
        <div class="chart-bar-wrap">
          <div class="chart-bar" style="height: ${heightPercent}%;" title="${item.repo}: ${item.count} file (${item.date})"></div>
        </div>
        <span class="chart-label">${item.date}</span>
      `;
      container.appendChild(col);
    });
  }

  /**
   * Render Repositories Grid
   */
  renderRepositories(repos, searchQuery = '') {
    const grid = document.getElementById('repos-grid');
    if (!grid) return;

    grid.innerHTML = '';

    const filtered = repos.filter(r => {
      const q = searchQuery.toLowerCase().trim();
      return r.name.toLowerCase().includes(q) || (r.description && r.description.toLowerCase().includes(q));
    });

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="glass-card text-center" style="grid-column: 1/-1; padding: 40px;">
          <p style="color: var(--text-muted);">Repository tidak ditemukan.</p>
        </div>
      `;
      return;
    }

    filtered.forEach(repo => {
      const card = document.createElement('div');
      card.className = 'repo-card';

      const badgeClass = repo.private ? 'badge-private' : 'badge-public';
      const badgeText = repo.private ? 'Private' : 'Public';
      const desc = repo.description || "Tidak ada deskripsi repository.";

      card.innerHTML = `
        <div style="min-width: 0;">
          <div class="repo-top">
            <h3 class="repo-name">${repo.name}</h3>
            <span class="badge ${badgeClass}">${badgeText}</span>
          </div>
          <p class="repo-desc">${desc}</p>
        </div>
        <div class="repo-actions">
          <button class="btn btn-glass btn-sm btn-select-upload" data-repo="${repo.name}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
            Upload ke sini
          </button>
          <a href="${repo.html_url}" target="_blank" class="btn btn-glass btn-sm" style="width: auto;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
          </a>
          <button class="btn btn-danger-glass btn-sm btn-reset-repo" data-repo="${repo.name}" title="Reset semua file">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15.54-6.36L21 8"></path><path d="M21 3v5h-5"></path><path d="M21 12a9 9 0 0 1-15.54 6.36L3 16"></path><path d="M3 21v-5h5"></path></svg>
            Reset
          </button>
          <button class="btn btn-danger-solid btn-sm btn-delete-repo" data-repo="${repo.name}" title="Hapus repository">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14H6L5 6"></path><path d="M10 11v5M14 11v5"></path><path d="M9 6V4h6v2"></path></svg>
            Hapus
          </button>
        </div>
      `;

      grid.appendChild(card);
    });

    document.querySelectorAll('.btn-select-upload').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const repoName = e.currentTarget.dataset.repo;
        this.selectRepoForUpload(repoName);
      });
    });

    document.querySelectorAll('.btn-reset-repo').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const repoName = e.currentTarget.dataset.repo;
        if (typeof this.onResetRepository === 'function') this.onResetRepository(repoName);
      });
    });

    document.querySelectorAll('.btn-delete-repo').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const repoName = e.currentTarget.dataset.repo;
        if (typeof this.onDeleteRepository === 'function') this.onDeleteRepository(repoName);
      });
    });
  }

  /**
   * Populate Upload View Repositories Select Dropdown
   */
  populateUploadReposDropdown(repos, selectedRepo = null) {
    const select = document.getElementById('upload-target-repo');
    if (!select) return;

    select.innerHTML = '<option value="" disabled selected>-- Pilih Repository Tujuan --</option>';

    repos.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.name;
      opt.textContent = `${r.name} (${r.private ? 'Private' : 'Public'})`;
      if (selectedRepo && r.name === selectedRepo) {
        opt.selected = true;
      }
      select.appendChild(opt);
    });
  }

  /**
   * Select a repo and switch to upload view
   */
  selectRepoForUpload(repoName) {
    const select = document.getElementById('upload-target-repo');
    if (select) {
      select.value = repoName;
    }
    this.switchView('upload');
    this.showToast(`Repository "${repoName}" dipilih untuk upload.`, 'info');
  }

  /**
   * Render Extracted ZIP Files List Preview
   */
  renderZipPreview(extractedFiles, totalSizeStr) {
    const previewCard = document.getElementById('file-preview-card');
    const fileListEl = document.getElementById('file-list');
    const countEl = document.getElementById('preview-file-count');
    const sizeEl = document.getElementById('preview-total-size');

    if (!previewCard || !fileListEl) return;

    fileListEl.innerHTML = '';
    countEl.textContent = `${extractedFiles.length} File`;
    sizeEl.textContent = totalSizeStr;

    extractedFiles.forEach(f => {
      const item = document.createElement('div');
      item.className = 'file-item';

      let icon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>`;

      item.innerHTML = `
        <div class="file-item-left">
          ${icon}
          <span class="file-path" title="${f.path}">${f.path}</span>
        </div>
        <span class="file-size">${window.zipHandler.formatBytes(f.size)}</span>
      `;

      fileListEl.appendChild(item);
    });

    previewCard.style.display = 'block';
  }

  /**
   * Reset Upload UI State
   */
  resetUploadUI() {
    const previewCard = document.getElementById('file-preview-card');
    const progressEl = document.getElementById('progress-container');
    const logEl = document.getElementById('upload-log');
    const fileInput = document.getElementById('zip-file-input');
    const dropText = document.getElementById('dropzone-file-name');

    if (previewCard) previewCard.style.display = 'none';
    if (progressEl) progressEl.style.display = 'none';
    if (logEl) logEl.innerHTML = '';
    if (fileInput) fileInput.value = '';
    if (dropText) dropText.textContent = 'Pilih File ZIP atau Drag & Drop ke sini';
  }

  /**
   * Update Progress Bar during upload
   */
  updateProgress(percentage, statusText) {
    const progressEl = document.getElementById('progress-container');
    const fillEl = document.getElementById('progress-bar-fill');
    const percentTxt = document.getElementById('progress-percent');
    const statusTxt = document.getElementById('progress-status-text');

    if (!progressEl) return;

    progressEl.style.display = 'block';
    fillEl.style.width = `${percentage}%`;
    percentTxt.textContent = `${Math.round(percentage)}%`;
    statusTxt.textContent = statusText;
  }

  /**
   * Add log entry to upload console with synchronized session timestamp
   */
  addUploadLog(text, type = 'info', syncTime = null) {
    const logEl = document.getElementById('upload-log');
    if (!logEl) return;

    const div = document.createElement('div');
    div.className = `log-item log-${type}`;

    const timeStamp = syncTime || new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    let icon = '';
    if (type === 'success') {
      icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else if (type === 'error') {
      icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
    } else {
      icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }

    div.innerHTML = `${icon}<span style="min-width: 0; flex: 1;">[${timeStamp}] ${text}</span>`;

    logEl.appendChild(div);
    logEl.scrollTop = logEl.scrollHeight;
  }
}

window.uiManager = new UIManager();
