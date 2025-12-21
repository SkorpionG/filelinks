import { validateLinksConfig } from '../src/utils/validation';
import { FileLinkConfigArray } from '../src/types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Glob Pattern Validation - Helpful Hints', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'filelinks-hints-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should show hint for single-star pattern that matches no files', async () => {
    // Create docs directory with files only in subdirectories
    const docsDir = path.join(tempDir, 'docs');
    const guidesDir = path.join(docsDir, 'guides');
    fs.mkdirSync(guidesDir, { recursive: true });
    fs.writeFileSync(path.join(guidesDir, 'setup.md'), 'content');

    const config: FileLinkConfigArray = [
      {
        watch: ['docs/*.md'],
        target: ['output.txt'],
      },
    ];

    const result = await validateLinksConfig(config, tempDir);

    // Should have a warning about watch pattern
    const watchWarning = result.warnings.find(
      (w) => w.message.includes('docs/*.md') && w.context?.includes('watch')
    );

    expect(watchWarning).toBeDefined();
    expect(watchWarning?.message).toContain('does not match any files');
    expect(watchWarning?.message).toContain('Hint: * matches only within a single directory');
    expect(watchWarning?.message).toContain('use ** instead');
  });

  it('should show hint for single-star target pattern that matches no files', async () => {
    // Create structure where target pattern doesn't match
    const srcDir = path.join(tempDir, 'src');
    const componentsDir = path.join(srcDir, 'components');
    fs.mkdirSync(componentsDir, { recursive: true });
    fs.writeFileSync(path.join(componentsDir, 'Button.tsx'), 'content');

    const config: FileLinkConfigArray = [
      {
        watch: ['src/index.ts'],
        target: ['src/*.tsx'], // Files are in src/components/, not src/
      },
    ];

    // Create the watch file to avoid unrelated warnings
    fs.writeFileSync(path.join(srcDir, 'index.ts'), 'content');

    const result = await validateLinksConfig(config, tempDir);

    // Should have a warning about target pattern
    const targetWarning = result.warnings.find(
      (w) => w.message.includes('src/*.tsx') && w.context?.includes('target')
    );

    expect(targetWarning).toBeDefined();
    expect(targetWarning?.message).toContain('does not match any files');
    expect(targetWarning?.message).toContain('Hint: * matches only within a single directory');
    expect(targetWarning?.message).toContain('use ** instead');
  });

  it('should NOT show hint for double-star pattern that matches no files', async () => {
    // Create empty docs directory
    const docsDir = path.join(tempDir, 'docs');
    fs.mkdirSync(docsDir, { recursive: true });

    const config: FileLinkConfigArray = [
      {
        watch: ['docs/**/*.md'], // Using ** already
        target: ['output.txt'],
      },
    ];

    const result = await validateLinksConfig(config, tempDir);

    // Should have a warning, but WITHOUT the hint
    const watchWarning = result.warnings.find(
      (w) => w.message.includes('docs/**/*.md') && w.context?.includes('watch')
    );

    expect(watchWarning).toBeDefined();
    expect(watchWarning?.message).toContain('does not match any files');
    expect(watchWarning?.message).not.toContain('Hint:');
  });

  it('should NOT show hint for question mark pattern', async () => {
    const config: FileLinkConfigArray = [
      {
        watch: ['file?.md'], // Using ? wildcard
        target: ['output.txt'],
      },
    ];

    const result = await validateLinksConfig(config, tempDir);

    const watchWarning = result.warnings.find(
      (w) => w.message.includes('file?.md') && w.context?.includes('watch')
    );

    expect(watchWarning).toBeDefined();
    expect(watchWarning?.message).toContain('does not match any files');
    expect(watchWarning?.message).not.toContain('Hint:');
  });

  it('should NOT show warning when files match the pattern', async () => {
    // Create docs directory with files directly in it
    const docsDir = path.join(tempDir, 'docs');
    fs.mkdirSync(docsDir, { recursive: true });
    fs.writeFileSync(path.join(docsDir, 'README.md'), 'content');
    fs.writeFileSync(path.join(docsDir, 'API.md'), 'content');

    const config: FileLinkConfigArray = [
      {
        watch: ['docs/*.md'], // Files exist directly in docs/
        target: ['output.txt'],
      },
    ];

    const result = await validateLinksConfig(config, tempDir);

    // Should NOT have a warning about watch pattern (files match!)
    const watchWarning = result.warnings.find(
      (w) => w.message.includes('docs/*.md') && w.context?.includes('watch')
    );

    expect(watchWarning).toBeUndefined();
  });
});
