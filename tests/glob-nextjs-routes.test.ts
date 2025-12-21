import { findFilesMatchingPattern } from '../src/utils/changes';
import { validateLinksConfig } from '../src/utils/validation';
import { FileLinkConfigArray } from '../src/types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Glob Pattern with Square Brackets (Next.js Dynamic Routes)', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'filelinks-brackets-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('BUG REPRODUCTION: should match files in [account] directory with *.tsx pattern', async () => {
    // Create Next.js structure with dynamic route
    const appDir = path.join(tempDir, 'apps', 'web', 'app', 'home', '[account]', '_components');
    fs.mkdirSync(appDir, { recursive: true });
    fs.writeFileSync(path.join(appDir, 'Button.tsx'), 'content');
    fs.writeFileSync(path.join(appDir, 'Header.tsx'), 'content');

    const pattern = 'apps/web/app/home/[account]/_components/*.tsx';
    console.log('\n=== BUG REPRODUCTION ===');
    console.log('Pattern:', pattern);
    console.log('Expected: Should find Button.tsx and Header.tsx');

    const matches = await findFilesMatchingPattern(pattern, tempDir);
    console.log('Actual matches found:', matches);
    console.log('Match count:', matches.length);

    // This test will FAIL with the current code because glob treats [account] as a character class
    expect(matches.length).toBeGreaterThan(0);
    expect(matches).toContain('apps/web/app/home/[account]/_components/Button.tsx');
    expect(matches).toContain('apps/web/app/home/[account]/_components/Header.tsx');
  });

  it('BUG REPRODUCTION: should match files in [id] directory', async () => {
    const postsDir = path.join(tempDir, 'app', 'posts', '[id]');
    fs.mkdirSync(postsDir, { recursive: true });
    fs.writeFileSync(path.join(postsDir, 'page.tsx'), 'content');

    const pattern = 'app/posts/[id]/*.tsx';
    const matches = await findFilesMatchingPattern(pattern, tempDir);

    console.log('\nPattern:', pattern);
    console.log('Matches:', matches);

    expect(matches.length).toBe(1);
    expect(matches).toContain('app/posts/[id]/page.tsx');
  });

  it('BUG REPRODUCTION: should match files in [...slug] directory (catch-all routes)', async () => {
    const docsDir = path.join(tempDir, 'app', 'docs', '[...slug]');
    fs.mkdirSync(docsDir, { recursive: true });
    fs.writeFileSync(path.join(docsDir, 'page.tsx'), 'content');

    const pattern = 'app/docs/[...slug]/*.tsx';
    const matches = await findFilesMatchingPattern(pattern, tempDir);

    console.log('\nPattern:', pattern);
    console.log('Matches:', matches);

    expect(matches.length).toBe(1);
    expect(matches).toContain('app/docs/[...slug]/page.tsx');
  });

  it('BUG REPRODUCTION: validation should NOT warn for valid Next.js route patterns', async () => {
    // Create Next.js structure
    const appDir = path.join(tempDir, 'apps', 'web', 'app', 'home', '[account]', '_components');
    fs.mkdirSync(appDir, { recursive: true });
    fs.writeFileSync(path.join(appDir, 'Button.tsx'), 'content');
    fs.writeFileSync(path.join(appDir, 'Header.tsx'), 'content');

    // Create target
    const targetDir = path.join(tempDir, 'apps', 'web', 'components', 'dashboard', 'workspace');
    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(path.join(targetDir, 'Layout.tsx'), 'content');

    const config: FileLinkConfigArray = [
      {
        watch: ['apps/web/app/home/[account]/_components/*.tsx'],
        target: ['apps/web/components/dashboard/workspace/*.tsx'],
      },
    ];

    console.log('\n=== VALIDATION TEST ===');
    const result = await validateLinksConfig(config, tempDir);

    console.log('Validation errors:', result.errors);
    console.log('Validation warnings:', result.warnings);

    // Should NOT have warnings about "does not match any files"
    const hasWatchWarning = result.warnings.some(
      (w) =>
        w.message.includes('apps/web/app/home/[account]/_components/*.tsx') &&
        w.message.includes('does not match any files')
    );

    const hasTargetWarning = result.warnings.some(
      (w) =>
        w.message.includes('apps/web/components/dashboard/workspace/*.tsx') &&
        w.message.includes('does not match any files')
    );

    // These should be false (no warnings) but currently they're true (BUG)
    expect(hasWatchWarning).toBe(false);
    expect(hasTargetWarning).toBe(false);
  });

  it('should also handle (parentheses) for Next.js route groups', async () => {
    const authDir = path.join(tempDir, 'app', '(auth)', 'login');
    fs.mkdirSync(authDir, { recursive: true });
    fs.writeFileSync(path.join(authDir, 'page.tsx'), 'content');

    const pattern = 'app/(auth)/login/*.tsx';
    const matches = await findFilesMatchingPattern(pattern, tempDir);

    console.log('\nPattern:', pattern);
    console.log('Matches:', matches);

    expect(matches.length).toBe(1);
    expect(matches).toContain('app/(auth)/login/page.tsx');
  });
});
