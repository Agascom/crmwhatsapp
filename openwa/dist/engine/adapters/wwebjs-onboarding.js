"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ONBOARDING_DEFAULT_CONTINUE_LABEL = void 0;
exports.resolveOnboardingContinueLabels = resolveOnboardingContinueLabels;
exports.probeOnboardingModal = probeOnboardingModal;
exports.ONBOARDING_DEFAULT_CONTINUE_LABEL = 'Continue';
function resolveOnboardingContinueLabels() {
    const extra = (process.env.WWEBJS_ONBOARDING_CONTINUE_LABELS ?? '')
        .split(',')
        .map(label => label.trim())
        .filter(Boolean);
    return [exports.ONBOARDING_DEFAULT_CONTINUE_LABEL, ...extra];
}
function probeOnboardingModal(options) {
    const isVisible = (el) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && el.offsetParent !== null;
    };
    const labels = options?.labels?.length ? options.labels : ['Continue'];
    const headingOptional = new Set(options?.headingOptionalFor ?? []);
    const heading = /what[’']?s new/i;
    const candidates = Array.from(document.querySelectorAll('button, [role="button"]'))
        .map(el => ({ el, label: (el.textContent || '').trim() }))
        .filter(c => isVisible(c.el) && labels.includes(c.label));
    for (const { el, label } of candidates.reverse()) {
        if (headingOptional.has(label)) {
            el.click();
            return { modalPresent: true, dismissed: true };
        }
        let scope = el;
        for (let depth = 0; depth < 8 && scope; depth++, scope = scope.parentElement) {
            if (!heading.test(scope.textContent || ''))
                continue;
            el.click();
            return { modalPresent: true, dismissed: true };
        }
    }
    return { modalPresent: false, dismissed: false };
}
//# sourceMappingURL=wwebjs-onboarding.js.map