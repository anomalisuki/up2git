/**
 * ZIP Handling Module using JSZip
 * Inspects, validates, automatically strips root wrapper folders, extracts, and converts ZIP file entries to Base64.
 */

class ZipHandler {
  constructor() {
    this.extractedFiles = [];
    this.rawFile = null;
  }

  /**
   * Validate if selected file is a valid ZIP file
   */
  validateZipFile(file) {
    if (!file) {
      throw new Error("Silakan pilih file terlebih dahulu.");
    }

    const validTypes = ['application/zip', 'application/x-zip-compressed', 'multipart/x-zip'];
    const isZipExt = file.name.toLowerCase().endsWith('.zip');

    if (!isZipExt && !validTypes.includes(file.type)) {
      throw new Error("Format file tidak valid. Harap pilih file berformat .zip");
    }

    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error("Ukuran file terlalu besar (Maksimal 50MB untuk pemrosesan lancar di HP).");
    }

    return true;
  }

  /**
   * Parse ZIP file and build a clean root-relative list of files
   */
  async parseZip(file) {
    this.validateZipFile(file);
    this.rawFile = file;
    this.extractedFiles = [];

    if (typeof JSZip === 'undefined') {
      throw new Error("Library JSZip gagal dimuat dari CDN. Periksa koneksi internet Anda.");
    }

    const zip = new JSZip();
    const contents = await zip.loadAsync(file);
    const entries = Object.keys(contents.files);
    
    // Filter valid paths first (skip macOS metadata)
    const validPaths = entries.filter(p => !p.startsWith('__MACOSX/') && !p.endsWith('.DS_Store'));
    const actualFiles = validPaths.filter(p => !contents.files[p].dir);

    // Detect single top-level wrapper root folder (e.g. "novion/" from novion.zip)
    let rootPrefix = '';
    if (actualFiles.length > 0) {
      const firstFile = actualFiles[0];
      const slashIdx = firstFile.indexOf('/');
      if (slashIdx !== -1) {
        const candidatePrefix = firstFile.substring(0, slashIdx + 1); // e.g. "novion/"
        // Check if EVERY actual file shares this exact prefix
        const allSharePrefix = actualFiles.every(p => p.startsWith(candidatePrefix));
        if (allSharePrefix) {
          rootPrefix = candidatePrefix;
        }
      }
    }

    for (const relativePath of entries) {
      const zipEntry = contents.files[relativePath];
      
      if (zipEntry.dir || relativePath.startsWith('__MACOSX/') || relativePath.endsWith('.DS_Store')) {
        continue;
      }

      // Automatically strip wrapper root folder prefix so files go directly to repo root
      let cleanPath = relativePath;
      if (rootPrefix && cleanPath.startsWith(rootPrefix)) {
        cleanPath = cleanPath.substring(rootPrefix.length);
      }

      // Skip if cleanPath became empty or directory
      if (!cleanPath || cleanPath.endsWith('/')) {
        continue;
      }

      const uncompressedSize = zipEntry._data ? (zipEntry._data.uncompressedSize || 0) : 0;

      this.extractedFiles.push({
        path: cleanPath, // Direct root path! e.g. "public/api/data.json"
        originalKey: relativePath,
        entry: zipEntry,
        size: uncompressedSize
      });
    }

    if (this.extractedFiles.length === 0) {
      throw new Error("File ZIP kosong atau hanya berisi folder kosong.");
    }

    return this.extractedFiles;
  }

  /**
   * Get Base64 string of a specific file entry
   */
  async getFileBase64(entry) {
    return await entry.async("base64");
  }

  /**
   * Format bytes to human readable string
   */
  formatBytes(bytes, decimals = 2) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  /**
   * Get total size of extracted files
   */
  getTotalSize() {
    return this.extractedFiles.reduce((acc, curr) => acc + curr.size, 0);
  }
}

window.zipHandler = new ZipHandler();
