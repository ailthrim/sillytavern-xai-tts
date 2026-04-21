import { getRequestHeaders } from '/script.js';
import { extension_settings } from '/scripts/extensions.js';
import { getPreviewString, registerTtsProvider, saveTtsProviderSettings } from '/scripts/extensions/tts/index.js';

const PROVIDER_NAME = 'xAI';
const PLUGIN_BASE = '/api/plugins/xai-tts';
const FALLBACK_VOICES = [
    { name: 'Eve', voice_id: 'eve', lang: '' },
    { name: 'Ara', voice_id: 'ara', lang: '' },
    { name: 'Rex', voice_id: 'rex', lang: '' },
    { name: 'Sal', voice_id: 'sal', lang: '' },
    { name: 'Leo', voice_id: 'leo', lang: '' },
    { name: 'Una', voice_id: 'una', lang: '' },
];
const XAI_TEXT_LIMIT = 15000;
const SAFE_TEXT_LIMIT = 14000;
const DEFAULT_CHUNK_SIZE = 1600;
const MIN_CHUNK_SIZE = 200;
const XAI_WRAPPING_TAGS = new Set([
    'soft',
    'whisper',
    'loud',
    'build-intensity',
    'decrease-intensity',
    'higher-pitch',
    'lower-pitch',
    'slow',
    'fast',
    'sing-song',
    'singing',
    'laugh-speak',
    'emphasis',
]);

class XaiTtsProvider {
    settings;
    voices = [];
    separator = ' . ';
    audioElement = document.createElement('audio');
    previewUrl = null;

    defaultSettings = {
        voiceMap: {},
        language: 'auto',
        codec: 'mp3',
        sample_rate: 24000,
        bit_rate: 128000,
        strip_emoji: true,
        smart_chunking: true,
        chunk_size: DEFAULT_CHUNK_SIZE,
    };

    get settingsHtml() {
        return `
        <div class="marginBot5">Use xAI's native Text to Speech API.</div>
        <small class="displayBlock marginBot5">Uses the existing xAI (Grok) API key from API Connections.</small>
        <label class="displayBlock" for="xai_tts_language">Language:</label>
        <select id="xai_tts_language">
            <option value="auto">auto</option>
            <option value="en">en</option>
            <option value="ar-EG">ar-EG</option>
            <option value="ar-SA">ar-SA</option>
            <option value="ar-AE">ar-AE</option>
            <option value="bn">bn</option>
            <option value="zh">zh</option>
            <option value="fr">fr</option>
            <option value="de">de</option>
            <option value="hi">hi</option>
            <option value="id">id</option>
            <option value="it">it</option>
            <option value="ja">ja</option>
            <option value="ko">ko</option>
            <option value="pt-BR">pt-BR</option>
            <option value="pt-PT">pt-PT</option>
            <option value="ru">ru</option>
            <option value="es-MX">es-MX</option>
            <option value="es-ES">es-ES</option>
            <option value="tr">tr</option>
            <option value="vi">vi</option>
        </select>
        <label class="displayBlock" for="xai_tts_codec">Codec:</label>
        <select id="xai_tts_codec">
            <option value="mp3">mp3</option>
            <option value="wav">wav</option>
        </select>
        <label class="displayBlock" for="xai_tts_sample_rate">Sample rate:</label>
        <select id="xai_tts_sample_rate">
            <option value="8000">8000</option>
            <option value="16000">16000</option>
            <option value="22050">22050</option>
            <option value="24000">24000</option>
            <option value="44100">44100</option>
            <option value="48000">48000</option>
        </select>
        <label class="displayBlock" for="xai_tts_bit_rate">MP3 bit rate:</label>
        <select id="xai_tts_bit_rate">
            <option value="32000">32000</option>
            <option value="64000">64000</option>
            <option value="96000">96000</option>
            <option value="128000">128000</option>
            <option value="192000">192000</option>
        </select>
        <label class="checkbox_label marginTop10" for="xai_tts_strip_emoji">
            <input type="checkbox" id="xai_tts_strip_emoji">
            <small>Strip emoji before sending to xAI</small>
        </label>
        <label class="checkbox_label" for="xai_tts_smart_chunking">
            <input type="checkbox" id="xai_tts_smart_chunking">
            <small>Smart chunk long messages</small>
        </label>
        <label class="displayBlock" for="xai_tts_chunk_size">Preferred chunk size, in characters:</label>
        <input id="xai_tts_chunk_size" class="text_pole" type="number" min="${MIN_CHUNK_SIZE}" max="${SAFE_TEXT_LIMIT}" step="100">
        <small class="displayBlock marginBot5">Smaller chunks start sooner; larger chunks give xAI more emotional and pacing context. Requests are kept below ${XAI_TEXT_LIMIT.toLocaleString()} characters.</small>`;
    }

    async loadSettings(settings) {
        this.settings = structuredClone(this.defaultSettings);

        for (const key in settings) {
            if (key in this.settings) {
                this.settings[key] = settings[key];
            } else {
                throw new Error(`Invalid setting passed to ${PROVIDER_NAME} TTS provider: ${key}`);
            }
        }

        $('#xai_tts_language').val(this.settings.language).on('change', () => this.onSettingsChange());
        $('#xai_tts_codec').val(this.settings.codec).on('change', () => this.onSettingsChange());
        $('#xai_tts_sample_rate').val(String(this.settings.sample_rate)).on('change', () => this.onSettingsChange());
        $('#xai_tts_bit_rate').val(String(this.settings.bit_rate)).on('change', () => this.onSettingsChange());
        $('#xai_tts_strip_emoji').prop('checked', !!this.settings.strip_emoji).on('change', () => this.onSettingsChange());
        $('#xai_tts_smart_chunking').prop('checked', !!this.settings.smart_chunking).on('change', () => this.onSettingsChange());
        $('#xai_tts_chunk_size').val(String(this.settings.chunk_size)).on('input', () => this.onSettingsChange());

        await this.checkReady();
        console.debug('xAI TTS: Settings loaded');
    }

    onSettingsChange() {
        this.settings.language = String($('#xai_tts_language').val());
        this.settings.codec = normalizeCodecSetting($('#xai_tts_codec').val());
        this.settings.sample_rate = Number($('#xai_tts_sample_rate').val());
        this.settings.bit_rate = Number($('#xai_tts_bit_rate').val());
        this.settings.strip_emoji = !!$('#xai_tts_strip_emoji').prop('checked');
        this.settings.smart_chunking = !!$('#xai_tts_smart_chunking').prop('checked');
        this.settings.chunk_size = clampChunkSize($('#xai_tts_chunk_size').val());
        saveTtsProviderSettings();
    }

    async checkReady() {
        this.voices = await this.fetchTtsVoiceObjects();
    }

    async onRefreshClick() {
        this.voices = await this.fetchTtsVoiceObjects(true);
    }

    async getVoice(voiceName) {
        if (this.voices.length === 0) {
            this.voices = await this.fetchTtsVoiceObjects();
        }

        const match = this.voices.find(voice => voice.voice_id === voiceName || voice.name === voiceName);
        if (!match) {
            throw new Error(`TTS voice not found: ${voiceName}`);
        }

        return match;
    }

    async generateTts(text, voiceId) {
        const chunks = this.settings.smart_chunking ? splitTextIntoChunks(text, this.settings.chunk_size) : splitTextIntoChunks(text, SAFE_TEXT_LIMIT);
        if (chunks.length <= 1) {
            return this.fetchTtsGeneration(chunks[0] ?? text, voiceId);
        }

        console.info(`xAI TTS: Split request into ${chunks.length} chunks.`);
        return this.generateChunkedTts(chunks, voiceId);
    }

    async *generateChunkedTts(chunks, voiceId) {
        for (const chunk of chunks) {
            yield await this.fetchTtsGeneration(chunk, voiceId);
        }
    }

    async fetchTtsVoiceObjects(showErrors = false) {
        try {
            const response = await fetch(`${PLUGIN_BASE}/voices`, {
                method: 'POST',
                headers: getRequestHeaders(),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${await response.text()}`);
            }

            const voices = await response.json();
            return Array.isArray(voices) && voices.length > 0 ? voices : FALLBACK_VOICES;
        } catch (error) {
            console.warn('xAI TTS: Falling back to built-in voice list', error);
            if (showErrors) {
                toastr.warning(String(error), 'Could not refresh xAI voices');
            }
            return FALLBACK_VOICES;
        }
    }

    async previewTtsVoice(voiceId) {
        this.revokePreviewUrl();
        this.audioElement.pause();
        this.audioElement.currentTime = 0;

        const response = await this.fetchTtsGeneration(getPreviewString('en-US'), voiceId);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const audio = await response.blob();
        const url = URL.createObjectURL(audio);
        this.previewUrl = url;
        this.audioElement.src = url;
        this.audioElement.onended = () => this.revokePreviewUrl();
        this.audioElement.onerror = () => this.revokePreviewUrl();
        await this.audioElement.play();
    }

    revokePreviewUrl() {
        if (!this.previewUrl) {
            return;
        }

        URL.revokeObjectURL(this.previewUrl);
        this.previewUrl = null;
        this.audioElement.removeAttribute('src');
        this.audioElement.load();
    }

    async fetchTtsGeneration(inputText, voiceId) {
        const text = this.settings.strip_emoji ? stripEmoji(inputText) : inputText;
        if (!text) {
            throw new Error('Nothing to narrate after removing emoji.');
        }

        console.info(`Generating xAI TTS for voice_id ${voiceId}`);
        const response = await fetch(`${PLUGIN_BASE}/generate-voice`, {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                text,
                voice_id: voiceId,
                language: this.settings.language,
                codec: this.settings.codec,
                sample_rate: this.settings.sample_rate,
                bit_rate: this.settings.bit_rate,
            }),
        });

        if (!response.ok) {
            toastr.error(response.statusText, 'xAI TTS Generation Failed');
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }

        return response;
    }
}

function stripEmoji(text) {
    return String(text ?? '')
        .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Regional_Indicator}\uFE0F\u200D]+/gu, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

function clampChunkSize(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
        return DEFAULT_CHUNK_SIZE;
    }

    return Math.min(Math.max(Math.round(number), MIN_CHUNK_SIZE), SAFE_TEXT_LIMIT);
}

function normalizeCodecSetting(value) {
    const codec = String(value || 'mp3').toLowerCase();
    return codec === 'wav' ? 'wav' : 'mp3';
}

function splitTextIntoChunks(text, preferredSize = DEFAULT_CHUNK_SIZE) {
    const cleanText = String(text ?? '').trim();
    if (!cleanText) {
        return [];
    }

    const maxSize = Math.min(clampChunkSize(preferredSize), SAFE_TEXT_LIMIT);
    const units = splitIntoSentenceLikeUnits(cleanText);
    const chunks = [];
    let current = '';

    for (const unit of units) {
        if (unit.length > SAFE_TEXT_LIMIT) {
            if (current) {
                chunks.push(current);
                current = '';
            }
            chunks.push(...splitOversizedUnit(unit, SAFE_TEXT_LIMIT));
            continue;
        }

        const next = current ? `${current} ${unit}` : unit;
        if (next.length > maxSize && current) {
            chunks.push(current);
            current = unit;
        } else {
            current = next;
        }
    }

    if (current) {
        chunks.push(current);
    }

    return chunks.flatMap(chunk => chunk.length > SAFE_TEXT_LIMIT ? splitOversizedUnit(chunk, SAFE_TEXT_LIMIT) : chunk);
}

function splitIntoSentenceLikeUnits(text) {
    const units = [];
    let start = 0;
    let angleDepth = 0;
    let squareDepth = 0;
    let tagStart = -1;
    const wrappingTags = [];

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '<') {
            angleDepth++;
            tagStart = i;
        } else if (char === '>' && angleDepth > 0) {
            updateWrappingTagStack(text.slice(tagStart + 1, i), wrappingTags);
            angleDepth--;
            if (angleDepth === 0) {
                tagStart = -1;
            }
        } else if (char === '[') {
            squareDepth++;
        } else if (char === ']' && squareDepth > 0) {
            squareDepth--;
        }

        if (angleDepth > 0 || squareDepth > 0 || wrappingTags.length > 0 || !isSentenceBoundary(text, i)) {
            continue;
        }

        const end = consumeClosingPunctuation(text, i + 1);
        const unit = text.slice(start, end).trim();
        if (unit) {
            units.push(unit);
        }
        start = consumeWhitespace(text, end);
        i = start - 1;
    }

    const tail = text.slice(start).trim();
    if (tail) {
        units.push(tail);
    }

    return units.length > 0 ? units : [text];
}

function updateWrappingTagStack(rawTag, wrappingTags) {
    const normalizedTag = String(rawTag || '').trim().toLowerCase();
    const isClosingTag = normalizedTag.startsWith('/');
    const tagName = normalizedTag.replace(/^\/+/, '').split(/\s+/)[0];
    if (!XAI_WRAPPING_TAGS.has(tagName)) {
        return;
    }

    if (isClosingTag) {
        const lastIndex = wrappingTags.lastIndexOf(tagName);
        if (lastIndex !== -1) {
            wrappingTags.splice(lastIndex, 1);
        }
        return;
    }

    wrappingTags.push(tagName);
}

function isSentenceBoundary(text, index) {
    const char = text[index];
    if (!'.!?…。？！'.includes(char)) {
        return false;
    }

    if (char === '.' && text[index - 1] === '.' && text[index - 2] === '.') {
        return true;
    }

    const next = text[index + 1] || '';
    return !next || /\s|["')\]}]/.test(next);
}

function consumeClosingPunctuation(text, index) {
    let end = index;
    while (end < text.length && /["')\]}]/.test(text[end])) {
        end++;
    }
    return end;
}

function consumeWhitespace(text, index) {
    let end = index;
    while (end < text.length && /\s/.test(text[end])) {
        end++;
    }
    return end;
}

function splitOversizedUnit(text, maxSize) {
    const chunks = [];
    let remaining = text.trim();

    while (remaining.length > maxSize) {
        const boundary = findFallbackBoundary(remaining, maxSize);
        chunks.push(remaining.slice(0, boundary).trim());
        remaining = remaining.slice(boundary).trim();
    }

    if (remaining) {
        chunks.push(remaining);
    }

    return chunks;
}

function findFallbackBoundary(text, maxSize) {
    const slice = text.slice(0, maxSize);
    const punctuation = Math.max(slice.lastIndexOf(';'), slice.lastIndexOf(','), slice.lastIndexOf(':'));
    if (punctuation > Math.floor(maxSize * 0.5)) {
        return punctuation + 1;
    }

    const whitespace = slice.lastIndexOf(' ');
    return whitespace > Math.floor(maxSize * 0.5) ? whitespace : maxSize;
}

registerTtsProvider(PROVIDER_NAME, XaiTtsProvider);

if (extension_settings.tts?.currentProvider === PROVIDER_NAME) {
    $('#tts_provider').val(PROVIDER_NAME);
}
