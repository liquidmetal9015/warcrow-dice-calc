/**
 * StorageService - Centralized localStorage operations
 * Provides type-safe storage and retrieval with error handling
 */
export class StorageService {
  /**
   * Save data to localStorage
   */
  save<T>(key: string, data: T): boolean {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error(`Failed to save to localStorage (key: ${key})`, e);
      return false;
    }
  }

  /**
   * Load data from localStorage
   */
  load<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (e) {
      console.error(`Failed to load from localStorage (key: ${key})`, e);
      return null;
    }
  }

  /**
   * Remove data from localStorage
   */
  remove(key: string): boolean {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.error(`Failed to remove from localStorage (key: ${key})`, e);
      return false;
    }
  }

  /**
   * Check if key exists
   */
  has(key: string): boolean {
    return localStorage.getItem(key) !== null;
  }

  /**
   * Clear all localStorage (use with caution)
   */
  clear(): boolean {
    try {
      localStorage.clear();
      return true;
    } catch (e) {
      console.error('Failed to clear localStorage', e);
      return false;
    }
  }
}

// Singleton instance for convenience
export const storageService = new StorageService();

