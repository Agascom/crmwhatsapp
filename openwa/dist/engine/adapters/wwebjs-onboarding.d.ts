export declare const ONBOARDING_DEFAULT_CONTINUE_LABEL = "Continue";
export declare function resolveOnboardingContinueLabels(): string[];
export declare function probeOnboardingModal(options?: {
    labels?: string[];
    headingOptionalFor?: string[];
}): {
    modalPresent: boolean;
    dismissed: boolean;
};
