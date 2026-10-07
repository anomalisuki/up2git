/**
 * GitHub API Wrapper Module
 * Handles Authentication, Repository Management, and Content Uploads via REST API.
 */

class GitHubAPI {
  constructor() {
    this.sessionKey = 'gh_pat_token';
    this.userDataKey = 'gh_user_data';
  }

  /**
   * Get stored token from sessionStorage
   */
  getToken() {
    return sessionStorage.getItem(this.sessionKey);
  }

  /**
   * Save token to sessionStorage
   */
  setToken(token) {
    sessionStorage.setItem(this.sessionKey, token.trim());
  }

  /**
   * Remove token and user data from sessionStorage
   */
  logout() {
    sessionStorage.removeItem(this.sessionKey);
    sessionStorage.removeItem(this.userDataKey);
  }

  /**
   * Get cached user profile data
   */
  getCachedUser() {
    const data = sessionStorage.getItem(this.userDataKey);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Helper to build request headers
   */
  _getHeaders(customToken = null) {
    const token = customToken || this.getToken();
    if (!token) throw new Error("GitHub Token tidak ditemukan. Silakan login kembali.");
    return {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json'
    };
  }

  /**
   * Validate token by fetching current authenticated user
   * GET https://api.github.com/user
   */
  async validateToken(token) {
    const response = await fetch('https://api.github.com/user', {
      method: 'GET',
      headers: this._getHeaders(token)
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Personal Access Token tidak valid atau kadaluwarsa.");
      }
      throw new Error(`Gagal memvalidasi token: ${response.statusText}`);
    }

    const userData = await response.json();
    this.setToken(token);
    sessionStorage.setItem(this.userDataKey, JSON.stringify(userData));
    return userData;
  }

  /**
   * Fetch user repositories (public & private if scope permits)
   * GET https://api.github.com/user/repos?per_page=100
   */
  async getRepositories() {
    const response = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
      method: 'GET',
      headers: this._getHeaders()
    });

    if (!response.ok) {
      throw new Error(`Gagal mengambil daftar repository: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Create a new GitHub repository
   * POST https://api.github.com/user/repos
   */
  async createRepository(name, description, isPrivate) {
    const response = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: this._getHeaders(),
      body: JSON.stringify({
        name: name.trim(),
        description: description.trim(),
        private: Boolean(isPrivate)
      })
    });

    const data = await response.json();
    if (!response.ok) {
      const errorMsg = data.message || response.statusText;
      throw new Error(`Gagal membuat repo: ${errorMsg}`);
    }

    return data;
  }

  /**
   * Delete an entire GitHub repository
   * DELETE https://api.github.com/repos/{owner}/{repo}
   */
  async deleteRepository(owner, repo) {
    const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, {
      method: 'DELETE',
      headers: this._getHeaders()
    });

    if (!response.ok) {
      let data = {};
      try { data = await response.json(); } catch (_) {}
      throw new Error(data.message || `Gagal menghapus repository: HTTP ${response.status}`);
    }

    return true;
  }

  /**
   * Get repository metadata
   */
  async getRepository(owner, repo) {
    const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, {
      method: 'GET',
      headers: this._getHeaders()
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || `Gagal mengambil repository: HTTP ${response.status}`);
    }
    return data;
  }

  /**
   * Reset repository contents while keeping the repository itself.
   * All tracked files are removed from the default branch in one commit.
   */
  async resetRepository(owner, repo) {
    const repository = await this.getRepository(owner, repo);
    const branch = repository.default_branch || 'main';

    const refResponse = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/ref/heads/${encodeURIComponent(branch)}`,
      { method: 'GET', headers: this._getHeaders() }
    );
    const refData = await refResponse.json();
    if (!refResponse.ok) {
      throw new Error(refData.message || `Gagal mengambil branch ${branch}: HTTP ${refResponse.status}`);
    }

    const commitResponse = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/commits/${refData.object.sha}`,
      { method: 'GET', headers: this._getHeaders() }
    );
    const commitData = await commitResponse.json();
    if (!commitResponse.ok) {
      throw new Error(commitData.message || `Gagal mengambil commit repository: HTTP ${commitResponse.status}`);
    }

    const treeResponse = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${commitData.tree.sha}?recursive=1`,
      { method: 'GET', headers: this._getHeaders() }
    );
    const treeData = await treeResponse.json();
    if (!treeResponse.ok) {
      throw new Error(treeData.message || `Gagal membaca isi repository: HTTP ${treeResponse.status}`);
    }

    if (treeData.truncated) {
      throw new Error('Repository terlalu besar untuk di-reset secara aman dalam satu operasi. Coba repository dengan isi lebih kecil.');
    }

    const entries = (treeData.tree || [])
      .filter(item => item.type === 'blob' || item.type === 'commit')
      .map(item => ({
        path: item.path,
        mode: item.mode,
        type: item.type,
        sha: null
      }));

    if (entries.length === 0) {
      return { branch, removed: 0, empty: true };
    }

    const newTreeResponse = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees`,
      {
        method: 'POST',
        headers: this._getHeaders(),
        body: JSON.stringify({
          base_tree: commitData.tree.sha,
          tree: entries
        })
      }
    );
    const newTreeData = await newTreeResponse.json();
    if (!newTreeResponse.ok) {
      throw new Error(newTreeData.message || `Gagal membuat tree kosong: HTTP ${newTreeResponse.status}`);
    }

    const newCommitResponse = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/commits`,
      {
        method: 'POST',
        headers: this._getHeaders(),
        body: JSON.stringify({
          message: 'Reset repository contents via up2git',
          tree: newTreeData.sha,
          parents: [refData.object.sha]
        })
      }
    );
    const newCommitData = await newCommitResponse.json();
    if (!newCommitResponse.ok) {
      throw new Error(newCommitData.message || `Gagal membuat commit reset: HTTP ${newCommitResponse.status}`);
    }

    const updateRefResponse = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/refs/heads/${encodeURIComponent(branch)}`,
      {
        method: 'PATCH',
        headers: this._getHeaders(),
        body: JSON.stringify({ sha: newCommitData.sha, force: false })
      }
    );
    const updateRefData = await updateRefResponse.json();
    if (!updateRefResponse.ok) {
      throw new Error(updateRefData.message || `Gagal memperbarui branch: HTTP ${updateRefResponse.status}`);
    }

    return { branch, removed: entries.length, empty: false };
  }

  /**
   * Check if a file already exists in repository to obtain its SHA
   * GET https://api.github.com/repos/{owner}/{repo}/contents/{path}
   */
  async getFileSha(owner, repo, path) {
    try {
      const encodedPath = path.split('/').map(encodeURIComponent).join('/');
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`, {
        method: 'GET',
        headers: this._getHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        return data.sha;
      }
      return null;
    } catch (err) {
      return null;
    }
  }

  /**
   * Upload or update a single file in GitHub repository
   * PUT https://api.github.com/repos/{owner}/{repo}/contents/{path}
   */
  async uploadFile(owner, repo, path, base64Content, commitMessage, existingSha = null) {
    const encodedPath = path.split('/').map(encodeURIComponent).join('/');
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`;

    const payload = {
      message: commitMessage || "Upload via up2git",
      content: base64Content
    };

    if (existingSha) {
      payload.sha = existingSha;
    }

    const response = await fetch(url, {
      method: 'PUT',
      headers: this._getHeaders(),
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || `HTTP ${response.status}`);
    }

    return data;
  }
}

window.githubAPI = new GitHubAPI();
