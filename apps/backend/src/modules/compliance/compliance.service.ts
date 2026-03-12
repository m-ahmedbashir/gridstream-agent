import { Injectable } from '@nestjs/common';

/**
 * ComplianceService
 *
 * Responsible for PII (Personally Identifiable Information) masking before
 * any data is sent to external AI services. All sensitive tokens are replaced
 * with typed [REDACTED:<type>] placeholders so downstream services can still
 * understand the structural intent of the text.
 */
@Injectable()
export class ComplianceService {
    // ── PII Patterns ──────────────────────────────────────────────────────────

    /** E-mail addresses: local@domain.tld */
    private static readonly EMAIL_PATTERN =
        /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

    /** Phone numbers: international / local variants, e.g. +1-800-555-0199, (555) 123-4567 */
    private static readonly PHONE_PATTERN =
        /(?:(?:\+?1\s*(?:[.-]\s*)?)?(?:\(\s*([2-9]1[02-9]|[2-9][02-8]1|[2-9][02-8][02-9])\s*\)|([2-9]1[02-9]|[2-9][02-8]1|[2-9][02-8][02-9]))\s*(?:[.-]\s*)?)?([2-9]1[02-9]|[2-9][02-9]1|[2-9][02-9]{2})\s*(?:[.-]\s*)?([0-9]{4})(?:\s*(?:#|x\.?|ext\.?|extension)\s*(\d+))?/g;

    /** Credit / debit card numbers: 13–19 digit sequences (optionally space/dash-separated) */
    private static readonly CREDIT_CARD_PATTERN =
        /\b(?:\d[ \-]?){13,19}\b/g;

    /** VAT / tax identification numbers: e.g. GB123456789, DE123456789 */
    private static readonly VAT_PATTERN =
        /\b[A-Z]{2}[0-9A-Z]{8,12}\b/g;

    /** IBAN: e.g. GB29 NWBK 6016 1331 9268 19 */
    private static readonly IBAN_PATTERN =
        /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}(?:[A-Z0-9]?){0,16}\b/g;

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Masks all detected PII in the provided text.
     *
     * @param text - Raw text extracted from an invoice or document.
     * @returns A version of the text where PII is replaced with typed [REDACTED] tokens.
     *
     * @example
     * complianceService.mask('Send invoice to alice@example.com, card: 4111 1111 1111 1111');
     * // → 'Send invoice to [REDACTED:EMAIL], card: [REDACTED:CARD]'
     */
    mask(text: string): string {
        const pipeline: Array<[RegExp, string]> = [
            [ComplianceService.IBAN_PATTERN, '[REDACTED:IBAN]'],
            [ComplianceService.CREDIT_CARD_PATTERN, '[REDACTED:CARD]'],
            [ComplianceService.EMAIL_PATTERN, '[REDACTED:EMAIL]'],
            [ComplianceService.VAT_PATTERN, '[REDACTED:VAT]'],
            [ComplianceService.PHONE_PATTERN, '[REDACTED:PHONE]'],
        ];

        // Apply each replacement in order; reset lastIndex between passes
        return pipeline.reduce(
            (sanitised, [pattern, token]) =>
                sanitised.replace(pattern, token),
            text,
        );
    }

    /**
     * Returns true if the provided text contains any detectable PII.
     * Useful for audit logging without exposing the actual values.
     */
    containsPii(text: string): boolean {
        return this.mask(text) !== text;
    }
}
