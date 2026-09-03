export interface StorageFile {
  originalName: string;
  mimeType: string;
  size: number;
  storageKey: string;
  url: string;
}

/**
 * Input type for file uploads. Express.Multer.File will be used
 * in the actual implementation; this keeps the interface decoupled
 * from Multer until the upload feature is implemented.
 */
export interface UploadFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

export interface StorageService {
  upload(file: UploadFile, directory: string): Promise<StorageFile>;
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;
  delete(key: string): Promise<void>;
}
