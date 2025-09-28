import { describe, it, expect} from 'vitest';
import { getSettings, updateSettings } from '../modules/settings.js';

describe('settings.js', () => {
    //read the current runtime settings
    it('getSettings returns defaults', () => {
        const s = getSettings();
        expect(s).toHaveProperty('instanceUrl');
        expect(s).toHaveProperty('display.transitionMs');
        expect(s).toHaveProperty('source.type');
    });
    //shallow-merge new values into settings and return the updated object
    it('updateSettings shallow merges', () => {
        const next = updateSettings({ display: { showCaptions: false }, sync: { fetchLimit: 5 } });
        expect(next.display.showCaptions).toBe(false);
        expect(next.sync.fetchLimit).toBe(5);
    });
});