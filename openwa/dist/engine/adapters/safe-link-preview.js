"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSafeLinkPreview = generateSafeLinkPreview;
const ssrf_guard_1 = require("../../common/security/ssrf-guard");
async function generateSafeLinkPreview(matchedText, opts = {}) {
    const timeoutMs = opts.timeoutMs ?? 3000;
    const maxBytes = opts.maxBytes ?? 512 * 1024;
    const url = normaliseUrl(matchedText);
    if (!url)
        return undefined;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await (0, ssrf_guard_1.withSafeFetch)(url, {
            signal: controller.signal,
            headers: { accept: 'text/html,application/xhtml+xml', 'user-agent': 'WhatsApp/2' },
        }, async (response) => {
            if (!response.ok)
                return undefined;
            const type = response.headers.get('content-type') ?? '';
            if (!type.includes('html') && !type.includes('xml'))
                return undefined;
            const html = await readCapped(response, maxBytes);
            const title = firstMatch(html, [
                /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i,
                /<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:title["']/i,
                /<title[^>]*>([^<]*)<\/title>/i,
            ]);
            const description = firstMatch(html, [
                /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i,
                /<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:description["']/i,
                /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
            ]);
            if (!title && !description)
                return undefined;
            return {
                'matched-text': matchedText,
                'canonical-url': url,
                title: title ? decodeEntities(title) : new URL(url).hostname,
                ...(description ? { description: decodeEntities(description) } : {}),
            };
        });
    }
    catch {
        return undefined;
    }
    finally {
        clearTimeout(timer);
    }
}
function normaliseUrl(matchedText) {
    const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(matchedText);
    if (hasScheme && !/^https?:\/\//i.test(matchedText))
        return undefined;
    try {
        const parsed = new URL(hasScheme ? matchedText : `https://${matchedText}`);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : undefined;
    }
    catch {
        return undefined;
    }
}
async function readCapped(response, maxBytes) {
    const reader = response.body?.getReader();
    if (!reader)
        return (await response.text()).slice(0, maxBytes);
    const decoder = new TextDecoder();
    let out = '';
    let read = 0;
    for (;;) {
        const chunk = await reader.read();
        if (chunk.done)
            break;
        const value = chunk.value;
        read += value.byteLength;
        out += decoder.decode(value, { stream: true });
        if (read >= maxBytes) {
            await reader.cancel();
            break;
        }
    }
    return out;
}
function firstMatch(html, patterns) {
    for (const pattern of patterns) {
        const value = pattern.exec(html)?.[1]?.trim();
        if (value)
            return value;
    }
    return undefined;
}
function decodeEntities(value) {
    return (value
        .replace(/&quot;/g, '"')
        .replace(/&#0?39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&'));
}
//# sourceMappingURL=safe-link-preview.js.map