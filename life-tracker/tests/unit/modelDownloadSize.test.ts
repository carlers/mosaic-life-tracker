import {describe,expect,it} from 'vitest';
import {formatModelBytes,modelDownloadNotice} from '../../src/lib/modelDownloadSize';
describe('honest model download byte totals',()=>{
  it('prints reported file or aggregate bytes without inventing a model total',()=>{
    expect(formatModelBytes(570_000_000)).toBe('570.0 MB');
    expect(modelDownloadNotice('AI model total',285_000_000,570_000_000))
      .toBe('AI model total: 285.0 MB / 570.0 MB');
    expect(modelDownloadNotice('Speech file',10_000_000,30_000_000))
      .toContain('10.0 MB / 30.0 MB');
    expect(modelDownloadNotice('Downloading')).toBe('Downloading');
    expect(modelDownloadNotice('Downloading',-1,100,40)).toBe('Downloading (40%)');
  });
});
