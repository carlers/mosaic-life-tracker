import { buildProfileShareData, shareProfile } from '../../src/lib/profileShare';

describe('profile sharing', () => {
  it('builds a public invitation without private profile fields', () => {
    expect(buildProfileShareData('https://mosaic.example/profile', 'alex', 'Alex')).toEqual({
      title: 'Mosaic',
      text: 'Connect with @alex on Mosaic.',
      url: 'https://mosaic.example/',
    });
    expect(buildProfileShareData('https://mosaic.example', undefined, '  Alex  ').text)
      .toBe('Connect with Alex on Mosaic.');
  });

  it('uses native sharing when available', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const result = await shareProfile(
      { title: 'Mosaic', text: 'Connect', url: 'https://mosaic.example/' },
      { share } as unknown as Navigator
    );

    expect(result).toBe('shared');
    expect(share).toHaveBeenCalledOnce();
  });

  it('treats native cancellation as cancellation instead of copying', async () => {
    const writeText = vi.fn();
    const share = vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError'));
    const result = await shareProfile(
      { text: 'Connect', url: 'https://mosaic.example/' },
      { share, clipboard: { writeText } } as unknown as Navigator
    );

    expect(result).toBe('cancelled');
    expect(writeText).not.toHaveBeenCalled();
  });

  it('falls back to the clipboard after unsupported or failed native sharing', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const result = await shareProfile(
      { text: 'Connect', url: 'https://mosaic.example/' },
      { clipboard: { writeText } } as unknown as Navigator
    );

    expect(result).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('Connect\nhttps://mosaic.example/');
  });

  it('reports unavailable when neither sharing transport exists', async () => {
    await expect(shareProfile({ text: 'Connect' }, {} as Navigator)).resolves.toBe('unavailable');
  });

  it('reports unavailable when clipboard permission is denied', async () => {
    const writeText = vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
    await expect(shareProfile(
      { text: 'Connect' },
      { clipboard: { writeText } } as unknown as Navigator
    )).resolves.toBe('unavailable');
  });
});
