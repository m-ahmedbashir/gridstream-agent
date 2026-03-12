import { ComplianceService } from './compliance.service';

describe('ComplianceService', () => {
    let service: ComplianceService;

    beforeEach(() => {
        service = new ComplianceService();
    });

    // ── mask() ────────────────────────────────────────────────────────────────

    describe('mask()', () => {
        it('should return the original text unchanged when no PII is present', () => {
            const text = 'Invoice total is 1500.00 EUR for services rendered.';
            expect(service.mask(text)).toBe(text);
        });

        it('should redact a plain email address', () => {
            const result = service.mask('Contact billing@example.com for queries.');
            expect(result).not.toContain('billing@example.com');
            expect(result).toContain('[REDACTED:EMAIL]');
        });

        it('should redact multiple email addresses in the same string', () => {
            const result = service.mask('From: a@x.com, To: b@y.co.uk');
            expect(result).not.toContain('a@x.com');
            expect(result).not.toContain('b@y.co.uk');
            expect(result.match(/\[REDACTED:EMAIL\]/g)?.length).toBe(2);
        });

        it('should redact a credit card number with spaces', () => {
            const result = service.mask('Card: 4111 1111 1111 1111');
            expect(result).not.toContain('4111');
            expect(result).toContain('[REDACTED:CARD]');
        });

        it('should redact a credit card number without separators', () => {
            const result = service.mask('Card: 4111111111111111');
            expect(result).not.toContain('4111111111111111');
            expect(result).toContain('[REDACTED:CARD]');
        });

        it('should redact an IBAN', () => {
            const result = service.mask('Bank: GB29NWBK60161331926819');
            expect(result).not.toContain('GB29');
            expect(result).toContain('[REDACTED:IBAN]');
        });

        it('should handle an empty string without throwing', () => {
            expect(service.mask('')).toBe('');
        });

        it('should handle text with only PII', () => {
            const result = service.mask('user@domain.com');
            expect(result).toBe('[REDACTED:EMAIL]');
        });
    });

    // ── containsPii() ─────────────────────────────────────────────────────────

    describe('containsPii()', () => {
        it('should return false when no PII is present', () => {
            expect(service.containsPii('Total: 500 EUR')).toBe(false);
        });

        it('should return true when an email is present', () => {
            expect(service.containsPii('Send to test@example.com')).toBe(true);
        });

        it('should return true when a credit card number is present', () => {
            expect(service.containsPii('Card 4111111111111111')).toBe(true);
        });
    });
});
