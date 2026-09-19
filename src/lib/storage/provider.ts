export interface UploadParams {
  buffer: Buffer;
  key: string;
  contentType: string;
}

export interface UploadResult {
  key: string;
  url: string;
}

export interface StorageProvider {
  upload(params: UploadParams): Promise<UploadResult>;
  getSignedUrl(key: string): Promise<string>;
  delete(key: string): Promise<void>;
}
