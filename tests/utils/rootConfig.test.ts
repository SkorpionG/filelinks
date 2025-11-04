import * as fs from 'fs';
import * as path from 'path';
import { addLinkFileToRootConfig, parseRootConfig } from '../../src/utils/rootConfig';
import { LinkFileReference } from '../../src/types';

describe('rootConfig', () => {
  let testDir: string;
  let testConfigPath: string;

  beforeEach(() => {
    testDir = path.join(__dirname, 'test-rootconfig-' + Date.now());
    fs.mkdirSync(testDir, { recursive: true });
    testConfigPath = path.join(testDir, 'filelinks.config.ts');
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('addLinkFileToRootConfig', () => {
    it('should add a new link to an empty config', () => {
      const configContent = `import { RootConfig } from './types';

const config: RootConfig = {
  linkFiles: [],
};

export default config;
`;
      fs.writeFileSync(testConfigPath, configContent, 'utf-8');

      const newLink: LinkFileReference = {
        id: 'test',
        name: 'Test Links',
        path: './test/filelinks.links.json',
      };

      const result = addLinkFileToRootConfig(testConfigPath, newLink);
      expect(result).toBe(true);

      const updatedContent = fs.readFileSync(testConfigPath, 'utf-8');
      expect(updatedContent).toContain("id: 'test'");
      expect(updatedContent).toContain("name: 'Test Links'");
      expect(updatedContent).toContain("path: './test/filelinks.links.json'");
    });

    it('should add a new link to a config with existing entries', () => {
      const configContent = `import { RootConfig } from './types';

const config: RootConfig = {
  linkFiles: [
    {
      id: 'root',
      name: 'Root Links',
      path: './filelinks.links.json',
    },
  ],
};

export default config;
`;
      fs.writeFileSync(testConfigPath, configContent, 'utf-8');

      const newLink: LinkFileReference = {
        id: 'src',
        name: 'Src Links',
        path: './src/filelinks.links.json',
      };

      const result = addLinkFileToRootConfig(testConfigPath, newLink);
      expect(result).toBe(true);

      const updatedContent = fs.readFileSync(testConfigPath, 'utf-8');
      expect(updatedContent).toContain("id: 'root'");
      expect(updatedContent).toContain("id: 'src'");

      // Verify structure is preserved
      const parsedConfig = parseRootConfig(testConfigPath);
      expect(parsedConfig.linkFiles).toHaveLength(2);
      expect(parsedConfig.linkFiles[0].id).toBe('root');
      expect(parsedConfig.linkFiles[1].id).toBe('src');
    });

    it('should handle comments in the config file', () => {
      const configContent = `import { RootConfig } from './types';

const config: RootConfig = {
  linkFiles: [
    {
      id: 'root',
      name: 'Root Links',
      path: './filelinks.links.json',
    },
    // Comment with braces { } should not break parsing
    /* Multi-line comment
     * with braces { }
     */
    {
      id: 'src',
      name: 'Src Links',
      path: './src/filelinks.links.json',
    },
  ],
};

export default config;
`;
      fs.writeFileSync(testConfigPath, configContent, 'utf-8');

      const newLink: LinkFileReference = {
        id: 'test',
        name: 'Test Links',
        path: './test/filelinks.links.json',
      };

      const result = addLinkFileToRootConfig(testConfigPath, newLink);
      expect(result).toBe(true);

      // Verify all three entries exist
      const parsedConfig = parseRootConfig(testConfigPath);
      expect(parsedConfig.linkFiles).toHaveLength(3);
      expect(parsedConfig.linkFiles[0].id).toBe('root');
      expect(parsedConfig.linkFiles[1].id).toBe('src');
      expect(parsedConfig.linkFiles[2].id).toBe('test');
    });

    it('should not add duplicate paths', () => {
      const configContent = `import { RootConfig } from './types';

const config: RootConfig = {
  linkFiles: [
    {
      id: 'root',
      name: 'Root Links',
      path: './filelinks.links.json',
    },
  ],
};

export default config;
`;
      fs.writeFileSync(testConfigPath, configContent, 'utf-8');

      const duplicateLink: LinkFileReference = {
        id: 'root2',
        name: 'Root Links Duplicate',
        path: './filelinks.links.json',
      };

      const result = addLinkFileToRootConfig(testConfigPath, duplicateLink);
      expect(result).toBe(false);

      const parsedConfig = parseRootConfig(testConfigPath);
      expect(parsedConfig.linkFiles).toHaveLength(1);
    });

    it('should handle ID conflicts by appending suffix', () => {
      const configContent = `import { RootConfig } from './types';

const config: RootConfig = {
  linkFiles: [
    {
      id: 'test',
      name: 'Test Links',
      path: './test/filelinks.links.json',
    },
  ],
};

export default config;
`;
      fs.writeFileSync(testConfigPath, configContent, 'utf-8');

      const conflictingLink: LinkFileReference = {
        id: 'test',
        name: 'Test Links 2',
        path: './test2/filelinks.links.json',
      };

      const result = addLinkFileToRootConfig(testConfigPath, conflictingLink);
      expect(result).toBe(true);

      const parsedConfig = parseRootConfig(testConfigPath);
      expect(parsedConfig.linkFiles).toHaveLength(2);
      expect(parsedConfig.linkFiles[0].id).toBe('test');
      expect(parsedConfig.linkFiles[1].id).toBe('test-2');
    });

    it('should preserve indentation from existing entries', () => {
      const configContent = `import { RootConfig } from './types';

const config: RootConfig = {
  linkFiles: [
    {
      id: 'root',
      name: 'Root Links',
      path: './filelinks.links.json',
    },
  ],
};

export default config;
`;
      fs.writeFileSync(testConfigPath, configContent, 'utf-8');

      const newLink: LinkFileReference = {
        id: 'test',
        name: 'Test Links',
        path: './test/filelinks.links.json',
      };

      addLinkFileToRootConfig(testConfigPath, newLink);

      const updatedContent = fs.readFileSync(testConfigPath, 'utf-8');

      // Check that the new entry has the same indentation as existing entries
      const lines = updatedContent.split('\n');
      const testEntryLine = lines.find((line) => line.includes("id: 'test'"));
      const rootEntryLine = lines.find((line) => line.includes("id: 'root'"));

      expect(testEntryLine).toBeDefined();
      expect(rootEntryLine).toBeDefined();

      // Extract indentation
      const testIndent = testEntryLine!.match(/^(\s*)/)?.[1];
      const rootIndent = rootEntryLine!.match(/^(\s*)/)?.[1];

      expect(testIndent).toBe(rootIndent);
    });

    it('should add entries with trailing commas', () => {
      const configContent = `import { RootConfig } from './types';

const config: RootConfig = {
  linkFiles: [
    {
      id: 'root',
      name: 'Root Links',
      path: './filelinks.links.json',
    },
  ],
};

export default config;
`;
      fs.writeFileSync(testConfigPath, configContent, 'utf-8');

      const newLink: LinkFileReference = {
        id: 'test',
        name: 'Test Links',
        path: './test/filelinks.links.json',
      };

      addLinkFileToRootConfig(testConfigPath, newLink);

      const updatedContent = fs.readFileSync(testConfigPath, 'utf-8');

      // Verify trailing comma is present
      expect(updatedContent).toMatch(/path: '\.\/test\/filelinks\.links\.json',\s*},/);
    });
  });

  describe('parseRootConfig', () => {
    it('should parse a simple config', () => {
      const configContent = `import { RootConfig } from './types';

const config: RootConfig = {
  linkFiles: [
    {
      id: 'root',
      name: 'Root Links',
      path: './filelinks.links.json',
    },
  ],
};

export default config;
`;
      fs.writeFileSync(testConfigPath, configContent, 'utf-8');

      const parsed = parseRootConfig(testConfigPath);
      expect(parsed.linkFiles).toHaveLength(1);
      expect(parsed.linkFiles[0]).toEqual({
        id: 'root',
        name: 'Root Links',
        path: './filelinks.links.json',
      });
    });

    it('should parse config with multiple entries', () => {
      const configContent = `import { RootConfig } from './types';

const config: RootConfig = {
  linkFiles: [
    {
      id: 'root',
      name: 'Root Links',
      path: './filelinks.links.json',
    },
    {
      id: 'src',
      name: 'Src Links',
      path: './src/filelinks.links.json',
    },
  ],
};

export default config;
`;
      fs.writeFileSync(testConfigPath, configContent, 'utf-8');

      const parsed = parseRootConfig(testConfigPath);
      expect(parsed.linkFiles).toHaveLength(2);
      expect(parsed.linkFiles[0].id).toBe('root');
      expect(parsed.linkFiles[1].id).toBe('src');
    });

    it('should parse config with comments', () => {
      const configContent = `import { RootConfig } from './types';

const config: RootConfig = {
  linkFiles: [
    // This is a comment
    {
      id: 'root',
      name: 'Root Links',
      path: './filelinks.links.json',
    },
    /* Multi-line
     * comment
     */
    {
      id: 'src',
      name: 'Src Links',
      path: './src/filelinks.links.json',
    },
  ],
};

export default config;
`;
      fs.writeFileSync(testConfigPath, configContent, 'utf-8');

      const parsed = parseRootConfig(testConfigPath);
      expect(parsed.linkFiles).toHaveLength(2);
    });

    it('should return empty array for empty linkFiles', () => {
      const configContent = `import { RootConfig } from './types';

const config: RootConfig = {
  linkFiles: [],
};

export default config;
`;
      fs.writeFileSync(testConfigPath, configContent, 'utf-8');

      const parsed = parseRootConfig(testConfigPath);
      expect(parsed.linkFiles).toHaveLength(0);
    });

    it('should handle partial objects', () => {
      const configContent = `import { RootConfig } from './types';

const config: RootConfig = {
  linkFiles: [
    {
      id: 'complete',
      name: 'Complete Entry',
      path: './filelinks.links.json',
    },
    {
      id: 'partial',
      // missing name and path
    },
  ],
};

export default config;
`;
      fs.writeFileSync(testConfigPath, configContent, 'utf-8');

      const parsed = parseRootConfig(testConfigPath);
      expect(parsed.linkFiles).toHaveLength(2);
      expect(parsed.linkFiles[0]).toEqual({
        id: 'complete',
        name: 'Complete Entry',
        path: './filelinks.links.json',
      });
      expect(parsed.linkFiles[1]).toEqual({
        id: 'partial',
      });
    });
  });
});
