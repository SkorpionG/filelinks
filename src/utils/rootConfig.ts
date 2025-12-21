import * as fs from 'fs';
import * as path from 'path';
import { LinkFileReference, PartialLinkFileReference, ParsedRootConfig } from '../types';
import { ROOT_CONFIG_FILE_NAME } from '../constants';

/**
 * Remove comments from TypeScript code
 *
 * This function removes single-line and multi-line comments from TypeScript code
 * to prevent them from interfering with parsing.
 *
 * @param content - The TypeScript code content
 * @returns The content with comments removed
 */
function removeComments(content: string): string {
  // Remove multi-line comments /* ... */
  let result = content.replace(/\/\*[\s\S]*?\*\//g, '');
  // Remove single-line comments //...
  result = result.replace(/\/\/.*$/gm, '');
  return result;
}

/**
 * Extract the linkFiles array content by finding matching brackets
 * This handles nested brackets correctly (e.g., paths like app/[id]/file.json)
 *
 * @param content - The TypeScript config file content
 * @returns The content between the linkFiles array brackets, or null if not found
 */
function extractLinkFilesContent(content: string): string | null {
  const startMatch = content.match(/linkFiles:\s*\[/);
  if (!startMatch) {
    return null;
  }

  const startIndex = (startMatch.index ?? 0) + startMatch[0].length;
  let depth = 1;
  let i = startIndex;

  // Find the matching closing bracket by tracking depth
  while (i < content.length && depth > 0) {
    const char = content[i];

    // Skip string literals to avoid counting brackets inside strings
    if (char === '"' || char === "'" || char === '`') {
      const quote = char;
      i++;
      while (i < content.length && content[i] !== quote) {
        if (content[i] === '\\') {
          i++; // Skip escaped character
        }
        i++;
      }
    } else if (char === '[') {
      depth++;
    } else if (char === ']') {
      depth--;
    }

    i++;
  }

  if (depth !== 0) {
    return null; // Unmatched brackets
  }

  return content.substring(startIndex, i - 1);
}

/**
 * Parse a TypeScript config file to extract the linkFiles array
 *
 * This function uses a simple regex-based approach to parse the TypeScript
 * configuration file without requiring full TypeScript compilation.
 *
 * @param configContent - The content of the TypeScript config file
 * @param allowPartial - If true, returns partial objects (may have missing fields)
 * @returns The parsed linkFiles array, or null if parsing fails
 */
function parseLinkFilesFromContent(
  configContent: string,
  allowPartial: boolean = false
): LinkFileReference[] | PartialLinkFileReference[] | null {
  try {
    // Extract the linkFiles array content (handles nested brackets)
    const linkFilesContent = extractLinkFilesContent(configContent);
    if (linkFilesContent === null) {
      return null;
    }

    // If it's empty, return empty array
    if (!linkFilesContent.trim()) {
      return [];
    }

    // Remove comments from the content before parsing
    const contentWithoutComments = removeComments(linkFilesContent);

    // Parse individual link file objects
    const linkFiles: (LinkFileReference | PartialLinkFileReference)[] = [];

    // Match object literals more carefully by looking for objects that have at least one property
    // This regex looks for opening brace, captures everything until closing brace,
    // but requires at least one key-value pair to be present
    const objectMatches = contentWithoutComments.matchAll(/\{([^}]*(?:id|name|path)[^}]*)\}/g);

    for (const match of objectMatches) {
      const objectContent = match[1];

      // Extract id, name, and path
      const idMatch = objectContent.match(/id:\s*['"]([^'"]*)['"]/);
      const nameMatch = objectContent.match(/name:\s*['"]([^'"]*)['"]/);
      const pathMatch = objectContent.match(/path:\s*['"]([^'"]*)['"]/);

      if (allowPartial) {
        // Include partial objects (for validation purposes)
        // Only include if at least one field was found
        if (idMatch || nameMatch || pathMatch) {
          const entry: PartialLinkFileReference = {};
          if (idMatch) entry.id = idMatch[1];
          if (nameMatch) entry.name = nameMatch[1];
          if (pathMatch) entry.path = pathMatch[1];
          linkFiles.push(entry);
        }
      } else {
        // Only include complete objects
        if (idMatch && nameMatch && pathMatch) {
          linkFiles.push({
            id: idMatch[1],
            name: nameMatch[1],
            path: pathMatch[1],
          });
        }
      }
    }

    return linkFiles;
  } catch {
    return null;
  }
}

/**
 * Parse root configuration from TypeScript file
 *
 * This function reads the filelinks.config.ts file and extracts the linkFiles array
 * by parsing it as text (since we can't import TS at runtime).
 *
 * Note: This function returns partial objects that may have missing fields.
 * Use with validation to ensure all required fields are present.
 *
 * @param configPath - Path to the root config file
 * @returns ParsedRootConfig object with potentially partial link file references
 */
export function parseRootConfig(configPath: string): ParsedRootConfig {
  const content = fs.readFileSync(configPath, 'utf-8');

  // Extract the linkFiles array content (handles nested brackets correctly)
  const linkFilesContent = extractLinkFilesContent(content);

  if (linkFilesContent === null) {
    throw new Error('Could not parse linkFiles from root config');
  }

  // Handle empty array
  if (!linkFilesContent.trim()) {
    return { linkFiles: [] };
  }

  // Remove comments from the content before parsing
  const contentWithoutComments = removeComments(linkFilesContent);

  // Parse each link file object (including incomplete/invalid ones)
  const linkFiles: PartialLinkFileReference[] = [];

  // Match object literals more carefully by looking for objects that have at least one property
  const objectMatches = contentWithoutComments.matchAll(/\{([^}]*(?:id|name|path)[^}]*)\}/g);

  for (const match of objectMatches) {
    const obj = match[1];

    const idMatch = obj.match(/id:\s*['"]([^'"]*)['"]/);
    const nameMatch = obj.match(/name:\s*['"]([^'"]*)['"]/);
    const pathMatch = obj.match(/path:\s*['"]([^'"]*)['"]/);

    // Only include if at least one field was found
    if (idMatch || nameMatch || pathMatch) {
      const entry: PartialLinkFileReference = {};
      if (idMatch) entry.id = idMatch[1];
      if (nameMatch) entry.name = nameMatch[1];
      if (pathMatch) entry.path = pathMatch[1];
      linkFiles.push(entry);
    }
  }

  return { linkFiles };
}

/**
 * Add a new link file reference to the root configuration
 *
 * This function reads the existing root config, adds a new link file reference,
 * and writes it back to disk. It preserves the existing formatting as much as
 * possible.
 *
 * @param rootConfigPath - Absolute path to the root config file
 * @param newLinkFile - The new link file reference to add
 * @returns true if successful, false if the link file already exists
 */
export function addLinkFileToRootConfig(
  rootConfigPath: string,
  newLinkFile: LinkFileReference
): boolean {
  if (!fs.existsSync(rootConfigPath)) {
    throw new Error(`Root config file not found: ${rootConfigPath}`);
  }

  // Read the existing config file
  const configContent = fs.readFileSync(rootConfigPath, 'utf-8');

  // Parse existing link files
  const existingLinkFiles = parseLinkFilesFromContent(configContent);
  if (existingLinkFiles === null) {
    throw new Error('Failed to parse existing root config file');
  }

  // Check if the link file already exists (by path)
  const normalizedNewPath = path.normalize(newLinkFile.path);
  const alreadyExists = existingLinkFiles.some(
    (lf) => lf.path && path.normalize(lf.path) === normalizedNewPath
  );

  if (alreadyExists) {
    return false;
  }

  // Check for ID conflicts
  const hasIdConflict = existingLinkFiles.some((lf) => lf.id && lf.id === newLinkFile.id);
  if (hasIdConflict) {
    // Generate a unique ID by appending a number
    let suffix = 2;
    let candidateId = `${newLinkFile.id}-${suffix}`;
    while (existingLinkFiles.some((lf) => lf.id && lf.id === candidateId)) {
      suffix++;
      candidateId = `${newLinkFile.id}-${suffix}`;
    }
    newLinkFile.id = candidateId;
  }

  // Find the linkFiles array and add the new entry
  const linkFilesRegex = /(linkFiles:\s*\[)([\s\S]*?)(\s*\])/;
  const match = configContent.match(linkFilesRegex);

  if (!match) {
    throw new Error('Could not find linkFiles array in root config');
  }

  const [, before, content, after] = match;

  // Determine the indentation from existing entries
  let indent = '    '; // default 4 spaces
  const firstEntryMatch = content.match(/^([ \t]*)\{/m);
  if (firstEntryMatch) {
    indent = firstEntryMatch[1];
  }

  // Build the new entry with proper formatting
  const lines = [
    `${indent}{`,
    `${indent}  id: '${newLinkFile.id}',`,
    `${indent}  name: '${newLinkFile.name}',`,
    `${indent}  path: '${newLinkFile.path}',`,
    `${indent}},`,
  ];
  const newEntry = lines.join('\n');

  // Insert the new entry
  let newContent: string;
  if (existingLinkFiles.length === 0) {
    // Empty array, replace comments with the new entry
    newContent = `${before}\n${newEntry}\n${after}`;
  } else {
    // Add to the end of the existing entries
    const trimmedContent = content.trimEnd();
    newContent = `${before}${trimmedContent}\n${newEntry}${after}`;
  }

  // Replace in the original content
  const updatedContent = configContent.replace(linkFilesRegex, newContent);

  // Write back to disk
  fs.writeFileSync(rootConfigPath, updatedContent, 'utf-8');

  return true;
}

/**
 * Find the root config file in the git repository root
 *
 * @param gitRoot - The git repository root directory
 * @returns The absolute path to the root config file, or null if not found
 */
export function findRootConfigFile(gitRoot: string): string | null {
  const configPath = path.join(gitRoot, ROOT_CONFIG_FILE_NAME);
  return fs.existsSync(configPath) ? configPath : null;
}

/**
 * Create a LinkFileReference from a file path
 *
 * Generates a meaningful ID and name based on the directory structure
 * (Same logic as in init.ts)
 *
 * @param linkFilePath - Absolute path to the link file
 * @param gitRoot - Git repository root directory
 * @returns LinkFileReference object
 */
export function createLinkFileReference(linkFilePath: string, gitRoot: string): LinkFileReference {
  const relativePath = path.relative(gitRoot, linkFilePath);
  const dirPath = path.dirname(relativePath);

  // Generate ID based on directory path
  let id: string;
  let name: string;

  if (dirPath === '.') {
    // Root level
    id = 'root';
    name = 'Root Links';
  } else {
    // Convert path to ID (e.g., "src/api" -> "src-api")
    id = dirPath.replace(/[/\\]/g, '-').replace(/\./g, '');
    // Convert to name (e.g., "src/api" -> "Src Api Links")
    const parts = dirPath.split(/[/\\]/);
    name = parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ') + ' Links';
  }

  // Ensure forward slashes in path
  const normalizedPath = './' + relativePath.split(path.sep).join('/');

  return {
    id,
    name,
    path: normalizedPath,
  };
}
