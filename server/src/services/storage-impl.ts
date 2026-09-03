import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import type { StorageService, StorageFile, UploadFile } from './storage.service';

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

/**
 * Local filesystem storage service.
 * Files are stored in the `uploads/` directory with unique keys.
 * For production, replace with S3/GCS/Azure Blob.
 */
export class LocalStorageService implements StorageService {
  private baseDir: string;

  constructor(baseDir: string = UPLOAD_DIR) {
    this.baseDir = baseDir;
  }

  private async ensureDir(dir: string): Promise<void> {
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  async upload(file: UploadFile, directory: string): Promise<StorageFile> {
    const dir = path.join(this.baseDir, directory);
    await this.ensureDir(dir);

    const ext = path.extname(file.originalname);
    const key = `${directory}/${crypto.randomUUID()}${ext}`;
    const filePath = path.join(this.baseDir, key);

    await fs.writeFile(filePath, file.buffer);

    return {
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      storageKey: key,
      url: `/uploads/${key}`,
    };
  }

  async getSignedUrl(key: string, _expiresIn?: number): Promise<string> {
    // For local storage, just return the relative URL
    // In production, generate a signed S3/GCS URL
    const filePath = path.join(this.baseDir, key);
    try {
      await fs.access(filePath);
      return `/uploads/${key}`;
    } catch {
      throw new Error('File not found');
    }
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(this.baseDir, key);
    try {
      await fs.unlink(filePath);
    } catch {
      // File may not exist; ignore
    }
  }
}

export const storageService = new LocalStorageService();