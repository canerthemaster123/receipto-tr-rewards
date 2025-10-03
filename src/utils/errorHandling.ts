// Centralized error handling utilities
import { toast } from "sonner";

export interface AppError {
  code: string;
  message: string;
  details?: unknown;
  userMessage?: string;
}

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NetworkError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Handle errors consistently across the app
 */
export function handleError(error: unknown, context?: string): AppError {
  console.error(`[${context || 'Error'}]:`, error);

  let appError: AppError;

  if (error instanceof ValidationError) {
    appError = {
      code: 'VALIDATION_ERROR',
      message: error.message,
      userMessage: error.field ? `${error.field}: ${error.message}` : error.message,
      details: error,
    };
  } else if (error instanceof NetworkError) {
    appError = {
      code: 'NETWORK_ERROR',
      message: error.message,
      userMessage: 'Bağlantı hatası. Lütfen internet bağlantınızı kontrol edin.',
      details: error,
    };
  } else if (error instanceof AuthError) {
    appError = {
      code: 'AUTH_ERROR',
      message: error.message,
      userMessage: 'Kimlik doğrulama hatası. Lütfen tekrar giriş yapın.',
      details: error,
    };
  } else if (error instanceof Error) {
    appError = {
      code: 'UNKNOWN_ERROR',
      message: error.message,
      userMessage: 'Bir hata oluştu. Lütfen tekrar deneyin.',
      details: error,
    };
  } else {
    appError = {
      code: 'UNKNOWN_ERROR',
      message: String(error),
      userMessage: 'Beklenmeyen bir hata oluştu.',
      details: error,
    };
  }

  return appError;
}

/**
 * Show user-friendly error toast
 */
export function showErrorToast(error: unknown, context?: string) {
  const appError = handleError(error, context);
  toast.error(appError.userMessage || appError.message);
}

/**
 * Retry async operations with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: unknown;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

/**
 * Safe async wrapper that catches errors
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  fallback: T,
  context?: string
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    handleError(error, context);
    return fallback;
  }
}
