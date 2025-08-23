// File validation utilities
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'image/webp'
] as const;

export const MAX_FILE_SIZE = 40 * 1024 * 1024; // 40MB

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
}

export const validateImageFile = (file: File): FileValidationResult => {
  // Check file type
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as any)) {
    return {
      isValid: false,
      error: 'Invalid file type. Please upload a JPEG, PNG, or WebP image.'
    };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      isValid: false,
      error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`
    };
  }

  return { isValid: true };
};

export const sanitizeFileName = (fileName: string): string => {
  // Remove special characters and replace with safe alternatives
  return fileName
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_{2,}/g, '_')
    .toLowerCase();
};

export const generateSecureFileName = (originalName: string, userId: string): string => {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const extension = originalName.split('.').pop()?.toLowerCase() || 'jpg';
  const baseName = originalName.split('.')[0];
  const sanitizedBaseName = sanitizeFileName(baseName);
  
  return `${userId}/${timestamp}_${sanitizedBaseName}_${randomSuffix}.${extension}`;
};