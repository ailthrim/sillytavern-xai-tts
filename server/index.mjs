import { readSecret, SECRET_KEYS } from '../../../src/endpoints/secrets.js';

const XAI_BASE_URL = 'https://api.x.ai';
const DEFAULT_VOICES = [
    { name: 'Eve', voice_id: 'eve', lang: '' },
    { name: 'Ara', voice_id: 'ara', lang: '' },
    { name: 'Rex', voice_id: 'rex', lang: '' },
    { name: 'Sal', voice_id: 'sal', lang: '' },
    { name: 'Leo', voice_id: 'leo', lang: '' },
    { name: 'Una', voice_id: 'una', lang: '' },
];
const MAX_TEXT_LENGTH = 15000;
const SUPPORTED_CODECS = new Set(['mp3', 'wav']);
const SUPPORTED_SAMPLE_RATES = new Set([8000, 16000, 22050, 24000, 44100, 48000]);
const SUPPORTED_BIT_RATES = new Set([32000, 64000, 96000, 128000, 192000]);
const CONTENT_TYPES = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
};

export const info = {
    id: 'xai-tts',
    name: 'xAI TTS Bridge',
    description: 'Server-side bridge for SillyTavern xAI Text to Speech.',
};

/**
 * @param {import('express').Router} router
 */
export async function init(router) {
    router.get('/health', (_request, response) => {
        response.json({ ok: true });
    });

    router.post('/voices', async (request, response) => {
        const key = getXaiKey(request);
        if (!key) {
            return response.json(DEFAULT_VOICES);
        }

        try {
            const result = await fetch(`${XAI_BASE_URL}/v1/tts/voices`, {
                method: 'GET',
                headers: getXaiHeaders(key),
            });

            if (!result.ok) {
                const text = await result.text();
                console.warn('xAI TTS voices request failed', result.status, text);
                return response.json(DEFAULT_VOICES);
            }

            const data = await result.json();
            const voices = Array.isArray(data?.voices) ? data.voices.map(toVoiceObject).filter(Boolean) : [];
            return response.json(voices.length > 0 ? voices : DEFAULT_VOICES);
        } catch (error) {
            console.error('xAI TTS voices request failed', error);
            return response.json(DEFAULT_VOICES);
        }
    });

    router.post('/generate-voice', async (request, response) => {
        const key = getXaiKey(request);
        if (!key) {
            console.warn('No xAI key found for TTS.');
            return response.status(400).send('No xAI API key found. Save an xAI (Grok) API key first.');
        }

        const text = String(request.body?.text ?? '').trim();
        if (!text) {
            return response.status(400).send('Text is required.');
        }
        if (text.length > MAX_TEXT_LENGTH) {
            return response.status(400).send(`Text exceeds xAI TTS limit of ${MAX_TEXT_LENGTH} characters.`);
        }

        const codec = normalizeCodec(request.body?.codec);
        const requestBody = {
            text,
            language: String(request.body?.language || 'auto'),
            voice_id: String(request.body?.voice_id || 'eve'),
            output_format: {
                codec,
            },
        };

        const sampleRate = normalizeNumber(request.body?.sample_rate);
        if (sampleRate && SUPPORTED_SAMPLE_RATES.has(sampleRate)) {
            requestBody.output_format.sample_rate = sampleRate;
        }

        const bitRate = normalizeNumber(request.body?.bit_rate);
        if (codec === 'mp3' && bitRate && SUPPORTED_BIT_RATES.has(bitRate)) {
            requestBody.output_format.bit_rate = bitRate;
        }

        try {
            const result = await fetch(`${XAI_BASE_URL}/v1/tts`, {
                method: 'POST',
                headers: getXaiHeaders(key),
                body: JSON.stringify(requestBody),
            });

            if (!result.ok) {
                const text = await result.text();
                console.warn('xAI TTS request failed', result.status, text);
                return response.status(result.status).send(text);
            }

            const contentType = result.headers.get('content-type') || CONTENT_TYPES[codec] || 'application/octet-stream';
            const buffer = Buffer.from(await result.arrayBuffer());
            response.setHeader('Content-Type', contentType);
            return response.send(buffer);
        } catch (error) {
            console.error('xAI TTS generation failed', error);
            return response.status(500).send('Internal server error');
        }
    });
}

function getXaiKey(request) {
    return readSecret(request.user.directories, SECRET_KEYS.XAI);
}

function getXaiHeaders(key) {
    return {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
    };
}

function toVoiceObject(voice) {
    const voiceId = voice?.voice_id || voice?.id || voice?.voice || voice?.name;
    if (!voiceId) {
        return null;
    }

    return {
        name: voice?.name || String(voiceId),
        voice_id: String(voiceId).toLowerCase(),
        lang: '',
    };
}

function normalizeCodec(value) {
    const codec = String(value || 'mp3').toLowerCase();
    return SUPPORTED_CODECS.has(codec) ? codec : 'mp3';
}

function normalizeNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}
