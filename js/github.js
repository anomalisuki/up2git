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

    if (!token) {
      throw new Error(
        "GitHub Token tidak ditemukan. Silakan login kembali."
      );
    }

    return {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json"
    };
  }

  /**
   * Validate token by fetching current authenticated user
   * GET https://api.github.com/user
   */
  async validateToken(token) {
    const response = await fetch("https://api.github.com/user", {
      method: "GET",
      headers: this._getHeaders(token)
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error(
          "Personal Access Token tidak valid atau kadaluwarsa."
        );
      }

      throw new Error(
        `Gagal memvalidasi token: ${response.statusText}`
      );
    }

    const userData = await response.json();

    this.setToken(token);

    sessionStorage.setItem(
      this.userDataKey,
      JSON.stringify(userData)
    );

    return userData;
  }

  /**
   * Fetch user repositories
   * GET https://api.github.com/user/repos?per_page=100
   */
  async getRepositories() {
    const response = await fetch(
      "https://api.github.com/user/repos?per_page=100&sort=updated",
      {
        method: "GET",
        headers: this._getHeaders()
      }
    );

    if (!response.ok) {
      throw new Error(
        `Gagal mengambil daftar repository: ${response.statusText}`
      );
    }

    return await response.json();
  }

  /**
   * Create a new GitHub repository
   * POST https://api.github.com/user/repos
   */
  async createRepository(name, description, isPrivate) {
    const response = await fetch(
      "https://api.github.com/user/repos",
      {
        method: "POST",
        headers: this._getHeaders(),
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          private: Boolean(isPrivate)
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      const errorMsg =
        data.message || response.statusText;

      throw new Error(
        `Gagal membuat repo: ${errorMsg}`
      );
    }

    return data;
  }

  /**
   * Delete an entire GitHub repository
   *
   * DELETE
   * https://api.github.com/repos/{owner}/{repo}
   */
  async deleteRepository(owner, repo) {
    const response = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      {
        method: "DELETE",
        headers: this._getHeaders()
      }
    );

    if (!response.ok) {
      let data = {};

      try {
        data = await response.json();
      } catch (_) {}

      throw new Error(
        data.message ||
        `Gagal menghapus repository: HTTP ${response.status}`
      );
    }

    return true;
  }

  /**
   * Get repository metadata
   *
   * GET
   * https://api.github.com/repos/{owner}/{repo}
   */
  async getRepository(owner, repo) {
    const response = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      {
        method: "GET",
        headers: this._getHeaders()
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message ||
        `Gagal mengambil repository: HTTP ${response.status}`
      );
    }

    return data;
  }

  /**
   * Reset repository contents.
   *
   * Repository tetap ada.
   * Semua file pada default branch dihapus satu per satu
   * menggunakan GitHub Contents API.
   */
  async resetRepository(owner, repo) {
    /*
     * 1. Ambil informasi repository
     */
    const repository = await this.getRepository(
      owner,
      repo
    );

    const branch =
      repository.default_branch || "main";

    /*
     * 2. Ambil seluruh Git tree secara recursive
     */
    const refResponse = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/ref/heads/${encodeURIComponent(branch)}`,
      {
        method: "GET",
        headers: this._getHeaders()
      }
    );

    const refData =
      await refResponse.json();

    if (!refResponse.ok) {
      throw new Error(
        refData.message ||
        `Gagal mengambil branch ${branch}: HTTP ${refResponse.status}`
      );
    }

    const currentCommitSha =
      refData.object.sha;

    /*
     * 3. Ambil commit
     */
    const commitResponse = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/commits/${currentCommitSha}`,
      {
        method: "GET",
        headers: this._getHeaders()
      }
    );

    const commitData =
      await commitResponse.json();

    if (!commitResponse.ok) {
      throw new Error(
        commitData.message ||
        `Gagal mengambil commit: HTTP ${commitResponse.status}`
      );
    }

    /*
     * 4. Ambil seluruh isi repository
     */
    const treeResponse = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${commitData.tree.sha}?recursive=1`,
      {
        method: "GET",
        headers: this._getHeaders()
      }
    );

    const treeData =
      await treeResponse.json();

    if (!treeResponse.ok) {
      throw new Error(
        treeData.message ||
        `Gagal membaca isi repository: HTTP ${treeResponse.status}`
      );
    }

    if (treeData.truncated) {
      throw new Error(
        "Repository terlalu besar untuk di-reset secara aman."
      );
    }

    /*
     * Ambil semua file.
     *
     * blob     = file biasa
     * commit   = submodule
     */
    const files =
      (treeData.tree || []).filter(
        item =>
          item.type === "blob" ||
          item.type === "commit"
      );

    /*
     * Repository sudah kosong
     */
    if (files.length === 0) {
      return {
        branch,
        removed: 0,
        empty: true
      };
    }

    /*
     * 5. Hapus file satu per satu
     *
     * Contents API:
     * DELETE /repos/{owner}/{repo}/contents/{path}
     */
    let removed = 0;

    /*
     * Sort berdasarkan path terdalam terlebih dahulu.
     *
     * Ini membantu jika repository memiliki struktur
     * directory/submodule tertentu.
     */
    files.sort((a, b) => {
      const depthA = a.path.split("/").length;
      const depthB = b.path.split("/").length;

      return depthB - depthA;
    });

    for (const file of files) {
      const encodedPath =
        file.path
          .split("/")
          .map(encodeURIComponent)
          .join("/");

      const deleteResponse = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}`,
        {
          method: "DELETE",

          headers: this._getHeaders(),

          body: JSON.stringify({
            message:
              `Reset repository: delete ${file.path}`,

            sha: file.sha,

            branch: branch
          })
        }
      );

      const deleteData =
        await deleteResponse.json();

      if (!deleteResponse.ok) {
        throw new Error(
          deleteData.message ||
          `Gagal menghapus ${file.path}: HTTP ${deleteResponse.status}`
        );
      }

      removed++;
    }

    /*
     * Semua file berhasil dihapus.
     */
    return {
      branch,
      removed,
      empty: false
    };
  }

  /**
   * Check if a file already exists
   * in repository to obtain its SHA
   *
   * GET
   * https://api.github.com/repos/{owner}/{repo}/contents/{path}
   */
  async getFileSha(owner, repo, path) {
    try {
      const encodedPath =
        path
          .split("/")
          .map(encodeURIComponent)
          .join("/");

      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`,
        {
          method: "GET",
          headers: this._getHeaders()
        }
      );

      if (response.ok) {
        const data =
          await response.json();

        return data.sha;
      }

      return null;
    } catch (err) {
      return null;
    }
  }

  /**
   * Upload or update a single file
   *
   * PUT
   * https://api.github.com/repos/{owner}/{repo}/contents/{path}
   */
  async uploadFile(
    owner,
    repo,
    path,
    base64Content,
    commitMessage,
    existingSha = null
  ) {
    const encodedPath =
      path
        .split("/")
        .map(encodeURIComponent)
        .join("/");

    const url =
      `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`;

    const payload = {
      message:
        commitMessage ||
        "Upload via up2git",

      content: base64Content
    };

    /*
     * Jika file sudah ada, sertakan SHA
     * agar GitHub melakukan update.
     */
    if (existingSha) {
      payload.sha = existingSha;
    }

    const response = await fetch(
      url,
      {
        method: "PUT",
        headers: this._getHeaders(),
        body: JSON.stringify(payload)
      }
    );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.message ||
        `HTTP ${response.status}`
      );
    }

    return data;
  }
}

/*
 * Global instance
 */
window.githubAPI = new GitHubAPI();
