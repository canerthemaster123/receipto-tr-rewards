import { useState, useCallback } from 'react';
import { handleError, showErrorToast } from '@/utils/errorHandling';
import { measureAsync } from '@/utils/performance';

interface UseAsyncOperationOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: unknown) => void;
  showToast?: boolean;
  measurePerformance?: boolean;
}

export function useAsyncOperation<T = any>(
  operationName: string,
  options: UseAsyncOperationOptions = {}
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const execute = useCallback(
    async (operation: () => Promise<T>): Promise<T | null> => {
      try {
        setLoading(true);
        setError(null);

        const result = options.measurePerformance
          ? await measureAsync(operation, operationName)
          : await operation();

        options.onSuccess?.(result);
        return result;
      } catch (err) {
        setError(err);
        handleError(err, operationName);
        
        if (options.showToast !== false) {
          showErrorToast(err, operationName);
        }
        
        options.onError?.(err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [operationName, options]
  );

  return {
    execute,
    loading,
    error,
    reset: () => {
      setError(null);
      setLoading(false);
    },
  };
}
