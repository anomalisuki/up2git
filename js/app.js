/**
 * Main Application Controller
 * Coordinates events between Auth, Repositories, ZIP Extraction, UI rendering, Theme Switcher, and Upload History.
 */

document.addEventListener('DOMContentLoaded', () => {
  const gh = window.githubAPI;
  const zip = window.zipHandler;
  const ui = window.uiManager;

  let cachedRepos = [];
  let currentZipFile = null;

  /* ==========================================================================
     Theme Switcher (Light / Dark Mode)
     ========================================================================== */
  function initTheme() {
    const savedTheme = localStorage.getItem('up2git_theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme || (systemDark ? 'dark' : 'light');
    
    applyTheme(initialTheme);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('up2git_theme', theme);

    const sunIcon = document.getElementById('theme-icon-sun');
    const moonIcon = document.getElementById('theme-icon-moon');

    if (theme === 'dark') {
      sunIcon?.classList.add('hidden');
      moonIcon?.classList.remove('hidden');
    } else {
      sunIcon?.classList.remove('hidden');
      moonIcon?.classList.add('hidden');
    }
  }

  document.getElementById('btn-theme-toggle')?.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    ui.showToast(`Mode UI beralih ke ${next.toUpperCase()}`, 'info');
  });

  /* ==========================================================================
     Initialization & Auth State Check
     ========================================================================== */
  async function initApp() {
    initTheme();

    const token = gh.getToken();
    const cachedUser = gh.getCachedUser();

    if (token && cachedUser) {
      ui.renderUserProfile(cachedUser);
      loadUserRepositories();
    } else if (token) {
      try {
        ui.showLoading(true, "Memvalidasi sesi...");
        const user = await gh.validateToken(token);
        ui.renderUserProfile(user);
        loadUserRepositories();
      } catch (err) {
        gh.logout();
        ui.renderUserProfile(null);
      } finally {
        ui.showLoading(false);
      }
    } else {
      ui.renderUserProfile(null);
    }
  }

  /* ==========================================================================
     Navigation Listeners
     ========================================================================== */
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const target = e.currentTarget.dataset.target;
      
      if (['repos', 'upload', 'new-repo'].includes(target) && !gh.getToken()) {
        ui.showToast("Silakan Connect ke GitHub terlebih dahulu.", 'error');
        ui.switchView('home');
        return;
      }

      ui.switchView(target);

      if (target === 'repos' && cachedRepos.length === 0) {
        loadUserRepositories();
      }
    });
  });

  document.getElementById('btn-go-upload')?.addEventListener('click', () => {
    ui.switchView('upload');
  });

  document.getElementById('btn-go-new-repo')?.addEventListener('click', () => {
    ui.switchView('new-repo');
  });

  /* ==========================================================================
     Authentication Events
     ========================================================================== */
  const formLogin = document.getElementById('form-login');
  formLogin?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const tokenInput = document.getElementById('input-pat-token');
    const token = tokenInput?.value.trim();

    if (!token) {
      ui.showToast("Harap masukkan GitHub Personal Access Token.", 'error');
      return;
    }

    try {
      ui.showLoading(true, "Menghubungkan ke GitHub...");
      const user = await gh.validateToken(token);
      ui.renderUserProfile(user);
      tokenInput.value = '';
      ui.showToast(`Berhasil terhubung sebagai @${user.login}!`, 'success');
      loadUserRepositories();
    } catch (err) {
      ui.showToast(err.message || "Gagal menghubungkan ke GitHub.", 'error');
    } finally {
      ui.showLoading(false);
    }
  });

  const btnLogout = document.getElementById('btn-logout');
  btnLogout?.addEventListener('click', () => {
    ui.showConfirmModal(
      "Putuskan Koneksi?",
      "<p>Personal Access Token Anda akan dihapus dari memori browser.</p>",
      () => {
        gh.logout();
        cachedRepos = [];
        ui.renderUserProfile(null);
        ui.resetUploadUI();
        ui.switchView('home');
        ui.showToast("Berhasil logout dari akun GitHub.", 'info');
      }
    );
  });

  /* ==========================================================================
     Repository Management Events
     ========================================================================== */
  async function loadUserRepositories() {
    if (!gh.getToken()) return;

    try {
      ui.showLoading(true, "Mengambil daftar repository...");
      const repos = await gh.getRepositories();
      cachedRepos = repos;
      
      ui.renderRepositories(repos);
      ui.populateUploadReposDropdown(repos);
      
      const statEl = document.getElementById('stat-repos-count');
      if (statEl) statEl.textContent = repos.length;
    } catch (err) {
      ui.showToast(err.message, 'error');
    } finally {
      ui.showLoading(false);
    }
  }

  document.getElementById('btn-refresh-repos')?.addEventListener('click', () => {
    loadUserRepositories();
    ui.showToast("Memperbarui daftar repository...", 'info');
  });

  document.getElementById('input-search-repos')?.addEventListener('input', (e) => {
    const query = e.target.value;
    ui.renderRepositories(cachedRepos, query);
  });

  ui.onResetRepository = (repoName) => {
    const owner = gh.getCachedUser()?.login;
    if (!owner) {
      ui.showToast("Data akun GitHub tidak ditemukan. Silakan login kembali.", 'error');
      return;
    }

    ui.showConfirmModal(
      `Reset Repository "${repoName}"?`,
      `<p>Semua <strong>file</strong> di repository ini akan dihapus dari branch default, tetapi repository-nya tetap ada.</p>
       <p style="color: var(--accent-red); font-weight: 700; margin-top: 10px;">Tindakan ini tidak dapat dibatalkan.</p>`,
      async () => {
        try {
          ui.showLoading(true, `Mereset "${repoName}"...`);
          const result = await gh.resetRepository(owner, repoName);
          ui.showToast(
            result.removed
              ? `Repository "${repoName}" berhasil dikosongkan (${result.removed} item dihapus).`
              : `Repository "${repoName}" sudah kosong.`,
            'success'
          );
          await loadUserRepositories();
        } catch (err) {
          ui.showToast(err.message, 'error');
        } finally {
          ui.showLoading(false);
        }
      }
    );
  };

  ui.onDeleteRepository = (repoName) => {
    const owner = gh.getCachedUser()?.login;
    if (!owner) {
      ui.showToast("Data akun GitHub tidak ditemukan. Silakan login kembali.", 'error');
      return;
    }

    ui.showConfirmModal(
      `Hapus Repository "${repoName}"?`,
      `<p>Repository beserta seluruh isinya akan <strong>dihapus permanen dari GitHub</strong>.</p>
       <p style="color: var(--accent-red); font-weight: 700; margin-top: 10px;">Tindakan ini tidak dapat dibatalkan.</p>`,
      async () => {
        try {
          ui.showLoading(true, `Menghapus "${repoName}"...`);
          await gh.deleteRepository(owner, repoName);
          ui.showToast(`Repository "${repoName}" berhasil dihapus.`, 'success');
          await loadUserRepositories();
        } catch (err) {
          ui.showToast(err.message, 'error');
        } finally {
          ui.showLoading(false);
        }
      }
    );
  };

  const formNewRepo = document.getElementById('form-new-repo');
  formNewRepo?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('new-repo-name')?.value.trim();
    const desc = document.getElementById('new-repo-desc')?.value.trim() || '';
    const isPrivate = document.querySelector('input[name="repo-visibility"]:checked')?.value === 'private';

    if (!name) {
      ui.showToast("Nama repository wajib diisi.", 'error');
      return;
    }

    try {
      ui.showLoading(true, `Membuat repository "${name}"...`);
      const newRepo = await gh.createRepository(name, desc, isPrivate);
      
      ui.showToast(`Repository "${newRepo.name}" berhasil dibuat!`, 'success');
      document.getElementById('new-repo-name').value = '';
      document.getElementById('new-repo-desc').value = '';

      await loadUserRepositories();
      ui.selectRepoForUpload(newRepo.name);
    } catch (err) {
      ui.showToast(err.message, 'error');
    } finally {
      ui.showLoading(false);
    }
  });

  /* ==========================================================================
     ZIP Drag & Drop / File Selection Events
     ========================================================================== */
  const dropzone = document.getElementById('zip-dropzone');
  const fileInput = document.getElementById('zip-file-input');

  dropzone?.addEventListener('click', () => fileInput?.click());

  dropzone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone?.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone?.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleZipFileSelected(e.dataTransfer.files[0]);
    }
  });

  fileInput?.addEventListener('change', async (e) => {
    if (e.target.files && e.target.files.length > 0) {
      await handleZipFileSelected(e.target.files[0]);
    }
  });

  async function handleZipFileSelected(file) {
    try {
      ui.showLoading(true, "Mengekstrak file ZIP...");
      currentZipFile = file;
      document.getElementById('dropzone-file-name').textContent = file.name;

      const extracted = await zip.parseZip(file);
      const totalSizeStr = zip.formatBytes(zip.getTotalSize());

      ui.renderZipPreview(extracted, totalSizeStr);
      ui.showToast(`Berhasil mengekstrak ${extracted.length} file dari ZIP.`, 'success');
    } catch (err) {
      currentZipFile = null;
      document.getElementById('dropzone-file-name').textContent = 'Pilih File ZIP atau Drag & Drop ke sini';
      ui.showToast(err.message, 'error');
    } finally {
      ui.showLoading(false);
    }
  }

  /* ==========================================================================
     Start Upload Event & Batch Logic (Synchronized timestamps & Root path upload)
     ========================================================================== */
  document.getElementById('btn-start-upload')?.addEventListener('click', () => {
    const targetRepo = document.getElementById('upload-target-repo')?.value;
    const commitMsg = document.getElementById('upload-commit-msg')?.value.trim() || "Upload via up2git";

    if (!targetRepo) {
      ui.showToast("Silakan pilih repository tujuan terlebih dahulu.", 'error');
      return;
    }

    if (zip.extractedFiles.length === 0) {
      ui.showToast("Silakan pilih dan ekstrak file ZIP terlebih dahulu.", 'error');
      return;
    }

    const user = gh.getCachedUser();
    if (!user) {
      ui.showToast("Sesi pengguna tidak valid. Silakan login kembali.", 'error');
      return;
    }

    const totalFiles = zip.extractedFiles.length;
    const totalSizeStr = zip.formatBytes(zip.getTotalSize());

    const summaryHtml = `
      <div style="background: rgba(0,0,0,0.06); padding: 16px; border-radius: 12px; margin-top: 8px;">
        <p><strong>Repository:</strong> ${targetRepo}</p>
        <p><strong>Total File:</strong> ${totalFiles} file (${totalSizeStr})</p>
        <p><strong>Pesan Commit:</strong> "${commitMsg}"</p>
        <p style="margin-top: 10px; font-size: 0.82rem; color: var(--accent-orange); font-weight: 600;">Root pembungkus ZIP otomatis dilepas (langsung ke root repo).</p>
      </div>
    `;

    ui.showConfirmModal(
      "Mulai Upload ke GitHub?",
      summaryHtml,
      async () => {
        await processBatchUpload(user.login, targetRepo, commitMsg);
      }
    );
  });

  async function processBatchUpload(owner, repo, commitMessage) {
    const files = zip.extractedFiles;
    const total = files.length;
    let successCount = 0;
    let failCount = 0;

    // Synchronized batch timestamp
    const batchTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    document.getElementById('upload-log').innerHTML = '';
    ui.updateProgress(0, "Mulai mengupload...");
    ui.addUploadLog(`Memulai upload ${total} file ke ${owner}/${repo}...`, 'info', batchTime);

    const btnUpload = document.getElementById('btn-start-upload');
    if (btnUpload) btnUpload.disabled = true;

    for (let i = 0; i < total; i++) {
      const item = files[i];
      const percent = ((i + 1) / total) * 100;
      
      ui.updateProgress(percent, `Mengupload (${i + 1}/${total}): ${item.path}`);

      try {
        const base64Content = await zip.getFileBase64(item.entry);
        const existingSha = await gh.getFileSha(owner, repo, item.path);

        await gh.uploadFile(owner, repo, item.path, base64Content, commitMessage, existingSha);

        successCount++;
        ui.addUploadLog(`SUKSES: ${item.path}`, 'success', batchTime);
      } catch (err) {
        failCount++;
        ui.addUploadLog(`GAGAL: ${item.path} - ${err.message}`, 'error', batchTime);
      }
    }

    if (btnUpload) btnUpload.disabled = false;

    ui.updateProgress(100, `Selesai! (${successCount} sukses, ${failCount} gagal)`);
    
    if (successCount > 0) {
      const history = JSON.parse(localStorage.getItem('up2git_upload_history') || '[]');
      const nowStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
      history.push({
        date: nowStr,
        repo: repo,
        count: successCount
      });
      localStorage.setItem('up2git_upload_history', JSON.stringify(history));
      ui.renderHistoryChart();
    }

    if (failCount === 0) {
      ui.showToast(`Luar biasa! Seluruh ${successCount} file berhasil diupload ke GitHub.`, 'success');
      ui.addUploadLog("SELURUH PROSES UPLOAD BERHASIL SEMPURNA!", 'success', batchTime);
    } else {
      ui.showToast(`Proses selesai dengan ${failCount} kegagalan. Periksa log upload.`, 'error');
      ui.addUploadLog(`PROSES SELESAI: ${successCount} berhasil, ${failCount} gagal.`, 'error', batchTime);
    }
  }

  // Initialize app on load
  initApp();
});
