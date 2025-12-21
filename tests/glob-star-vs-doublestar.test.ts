import { findFilesMatchingPattern } from '../src/utils/changes';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Glob Pattern: * vs ** behavior', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'filelinks-star-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('docs/*.md should match files ONLY in docs/ root, not subdirectories', async () => {
    // Create file structure:
    // docs/README.md          <- Should MATCH
    // docs/API.md             <- Should MATCH
    // docs/guides/setup.md    <- Should NOT match (in subdirectory)
    // docs/api/reference.md   <- Should NOT match (in subdirectory)

    const docsDir = path.join(tempDir, 'docs');
    const guidesDir = path.join(docsDir, 'guides');
    const apiDir = path.join(docsDir, 'api');

    fs.mkdirSync(guidesDir, { recursive: true });
    fs.mkdirSync(apiDir, { recursive: true });

    fs.writeFileSync(path.join(docsDir, 'README.md'), 'content');
    fs.writeFileSync(path.join(docsDir, 'API.md'), 'content');
    fs.writeFileSync(path.join(guidesDir, 'setup.md'), 'content');
    fs.writeFileSync(path.join(apiDir, 'reference.md'), 'content');

    const pattern = 'docs/*.md';
    console.log('\n=== Testing pattern:', pattern);
    console.log('File structure:');
    console.log('  docs/README.md');
    console.log('  docs/API.md');
    console.log('  docs/guides/setup.md');
    console.log('  docs/api/reference.md');

    const matches = await findFilesMatchingPattern(pattern, tempDir);
    console.log('\nMatches found:', matches);
    console.log('Match count:', matches.length);

    // Should only match files directly in docs/
    expect(matches.length).toBe(2);
    expect(matches).toContain('docs/README.md');
    expect(matches).toContain('docs/API.md');
    expect(matches).not.toContain('docs/guides/setup.md');
    expect(matches).not.toContain('docs/api/reference.md');
  });

  it('docs/**/*.md should match files in docs/ AND all subdirectories', async () => {
    // Same file structure as above
    const docsDir = path.join(tempDir, 'docs');
    const guidesDir = path.join(docsDir, 'guides');
    const apiDir = path.join(docsDir, 'api');

    fs.mkdirSync(guidesDir, { recursive: true });
    fs.mkdirSync(apiDir, { recursive: true });

    fs.writeFileSync(path.join(docsDir, 'README.md'), 'content');
    fs.writeFileSync(path.join(docsDir, 'API.md'), 'content');
    fs.writeFileSync(path.join(guidesDir, 'setup.md'), 'content');
    fs.writeFileSync(path.join(apiDir, 'reference.md'), 'content');

    const pattern = 'docs/**/*.md';
    console.log('\n=== Testing pattern:', pattern);
    console.log('File structure:');
    console.log('  docs/README.md');
    console.log('  docs/API.md');
    console.log('  docs/guides/setup.md');
    console.log('  docs/api/reference.md');

    const matches = await findFilesMatchingPattern(pattern, tempDir);
    console.log('\nMatches found:', matches);
    console.log('Match count:', matches.length);

    // Should match all .md files in docs/ and subdirectories
    expect(matches.length).toBe(4);
    expect(matches).toContain('docs/README.md');
    expect(matches).toContain('docs/API.md');
    expect(matches).toContain('docs/guides/setup.md');
    expect(matches).toContain('docs/api/reference.md');
  });

  it('SCENARIO: User has files only in subdirectories - docs/*.md will NOT match', async () => {
    // User might have this structure:
    // docs/guides/setup.md    <- NOT matched by docs/*.md
    // docs/api/reference.md   <- NOT matched by docs/*.md
    // (no files directly in docs/)

    const docsDir = path.join(tempDir, 'docs');
    const guidesDir = path.join(docsDir, 'guides');
    const apiDir = path.join(docsDir, 'api');

    fs.mkdirSync(guidesDir, { recursive: true });
    fs.mkdirSync(apiDir, { recursive: true });

    // Only create files in subdirectories
    fs.writeFileSync(path.join(guidesDir, 'setup.md'), 'content');
    fs.writeFileSync(path.join(apiDir, 'reference.md'), 'content');

    const pattern = 'docs/*.md';
    console.log('\n=== SCENARIO: Files only in subdirectories');
    console.log('Pattern:', pattern);
    console.log('File structure:');
    console.log('  docs/guides/setup.md');
    console.log('  docs/api/reference.md');
    console.log('  (no files directly in docs/)');

    const matches = await findFilesMatchingPattern(pattern, tempDir);
    console.log('\nMatches found:', matches);
    console.log('Match count:', matches.length);

    // Should match NOTHING because no files directly in docs/
    expect(matches.length).toBe(0);

    console.log('\n⚠️  This is EXPECTED behavior!');
    console.log('    docs/*.md only matches files directly in docs/, not in subdirectories');
    console.log('    To match files in subdirectories, use: docs/**/*.md');
  });
});
