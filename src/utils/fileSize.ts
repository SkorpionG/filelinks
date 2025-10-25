import * as fs from 'fs';

/**
 * File size utility functions
 */

/**
 * Get the size of a file in bytes
 *
 * @param filePath - Absolute path to the file
 * @returns File size in bytes, or 0 if file doesn't exist or is not accessible
 */
export function getFileSize(filePath: string): number {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch {
    return 0;
  }
}

/**
 * Format bytes into a human-readable string
 *
 * Converts bytes to appropriate unit (B, KB, MB, GB, TB) with up to 2 decimal places
 *
 * @param bytes - Number of bytes
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string (e.g., "1.5 KB", "3.14 MB")
 *
 * @example
 * formatFileSize(1024) // "1 KB"
 * formatFileSize(1536) // "1.5 KB"
 * formatFileSize(1048576) // "1 MB"
 * formatFileSize(5242880) // "5 MB"
 */
export function formatFileSize(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 B';
  if (bytes < 0) return '0 B';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  // Ensure we don't go beyond our sizes array
  const sizeIndex = Math.min(i, sizes.length - 1);

  const value = bytes / Math.pow(k, sizeIndex);

  // Format with decimals, but remove trailing zeros
  const formatted = value.toFixed(dm);
  const trimmed = formatted.replace(/\.?0+$/, '');

  return `${trimmed} ${sizes[sizeIndex]}`;
}

/**
 * Get formatted file size for display
 *
 * Combines getFileSize and formatFileSize for convenience
 *
 * @param filePath - Absolute path to the file
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted file size string
 *
 * @example
 * getFormattedFileSize('/path/to/file.txt') // "1.5 KB"
 */
export function getFormattedFileSize(filePath: string, decimals: number = 2): string {
  const bytes = getFileSize(filePath);
  return formatFileSize(bytes, decimals);
}
