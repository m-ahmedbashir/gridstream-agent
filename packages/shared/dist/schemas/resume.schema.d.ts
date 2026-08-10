import { z } from 'zod';
export declare const ResumeExperienceSchema: z.ZodObject<{
    company: z.ZodString;
    title: z.ZodString;
    startDate: z.ZodNullable<z.ZodString>;
    endDate: z.ZodNullable<z.ZodString>;
    description: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export declare const ResumeEducationSchema: z.ZodObject<{
    institution: z.ZodString;
    degree: z.ZodNullable<z.ZodString>;
    startDate: z.ZodNullable<z.ZodString>;
    endDate: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
/**
 * Nullable resume/CV schema — every scalar field is optional/nullable because
 * the model may not find a value for every field in every document. Same
 * convention as InvoiceSchema.
 */
export declare const ResumeSchema: z.ZodObject<{
    fullName: z.ZodNullable<z.ZodString>;
    email: z.ZodNullable<z.ZodString>;
    phone: z.ZodNullable<z.ZodString>;
    summary: z.ZodNullable<z.ZodString>;
    skills: z.ZodArray<z.ZodString>;
    experience: z.ZodArray<z.ZodObject<{
        company: z.ZodString;
        title: z.ZodString;
        startDate: z.ZodNullable<z.ZodString>;
        endDate: z.ZodNullable<z.ZodString>;
        description: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>;
    education: z.ZodArray<z.ZodObject<{
        institution: z.ZodString;
        degree: z.ZodNullable<z.ZodString>;
        startDate: z.ZodNullable<z.ZodString>;
        endDate: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type Resume = z.infer<typeof ResumeSchema>;
export type ResumeExperience = z.infer<typeof ResumeExperienceSchema>;
export type ResumeEducation = z.infer<typeof ResumeEducationSchema>;
/**
 * Confidence score for each extracted resume field.
 * Uses the same six-anchor scale as InvoiceConfidenceSchema: 0.0, 0.2, 0.4, 0.6, 0.8, 1.0.
 */
export declare const ResumeConfidenceSchema: z.ZodObject<{
    fullName: z.ZodNumber;
    email: z.ZodNumber;
    phone: z.ZodNumber;
    summary: z.ZodNumber;
    skills: z.ZodNumber;
    experience: z.ZodNumber;
    education: z.ZodNumber;
}, z.core.$strip>;
export type ResumeConfidence = z.infer<typeof ResumeConfidenceSchema>;
