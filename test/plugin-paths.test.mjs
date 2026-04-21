import path from 'node:path';
import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

test('plugin secrets import resolves to SillyTavern src when installed under plugins/xai-tts/server', () => {
    const pluginEntry = '/SillyTavern/plugins/xai-tts/server/index.mjs';
    const source = fs.readFileSync(new URL('../server/index.mjs', import.meta.url), 'utf8');
    const match = source.match(/import\s+\{\s*readSecret,\s*SECRET_KEYS\s*\}\s+from\s+'([^']+)'/);

    assert.ok(match, 'server plugin should import SillyTavern secrets helpers');

    const resolvedSecretsPath = path.normalize(path.resolve(path.dirname(pluginEntry), match[1]));

    assert.equal(
        resolvedSecretsPath,
        path.normalize('/SillyTavern/src/endpoints/secrets.js'),
    );
});
