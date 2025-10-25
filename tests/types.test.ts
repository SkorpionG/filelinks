import { FileLinkConfig, WatchType } from '../src/types';

describe('Types', () => {
  it('should accept valid FileLinkConfig', () => {
    const config: FileLinkConfig = {
      id: 'test-link',
      name: 'Test Link',
      watch: ['src/file.ts'],
      target: ['docs/README.md'],
      watchType: 'uncommitted',
    };

    expect(config).toBeDefined();
    expect(config.watch).toHaveLength(1);
    expect(config.target).toHaveLength(1);
  });

  it('should accept valid WatchType values', () => {
    const types: WatchType[] = ['uncommitted', 'unstaged', 'staged'];

    types.forEach((type) => {
      expect(['uncommitted', 'unstaged', 'staged']).toContain(type);
    });
  });
});
