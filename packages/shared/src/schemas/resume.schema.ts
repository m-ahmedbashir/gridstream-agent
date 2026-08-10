import { z } from 'zod';

export const ResumeExperienceSchema = z.object({
    company: z.string().describe('Employer/company name'),
    title: z.string().describe('Job title'),
    startDate: z.string().nullable().describe('Start date, or null if not found'),
    endDate: z.string().nullable().describe('End date, or null if still current/not found'),
    description: z.string().nullable().describe('Role description or key responsibilities, or null if not found'),
});

export const ResumeEducationSchema = z.object({
    institution: z.string().describe('School/university name'),
    degree: z.string().nullable().describe('Degree or qualification, or null if not found'),
    startDate: z.string().nullable().describe('Start date, or null if not found'),
    endDate: z.string().nullable().describe('End date, or null if not found'),
});

/**
 * Nullable resume/CV schema — every scalar field is optional/nullable because
 * the model may not find a value for every field in every document. Same
 * convention as InvoiceSchema.
 */
export const ResumeSchema = z.object({
    fullName: z.string().nullable().describe('Candidate full name, or null if not found'),
    email: z.string().nullable().describe('Candidate email address, or null if not found'),
    phone: z.string().nullable().describe('Candidate phone number, or null if not found'),
    summary: z.string().nullable().describe('Professional summary/objective, or null if not found'),
    skills: z.array(z.string()).describe('List of skills — empty array if none found'),
    experience: z.array(ResumeExperienceSchema).describe('Work experience entries — empty array if none found'),
    education: z.array(ResumeEducationSchema).describe('Education entries — empty array if none found'),
});

export type Resume = z.infer<typeof ResumeSchema>;
export type ResumeExperience = z.infer<typeof ResumeExperienceSchema>;
export type ResumeEducation = z.infer<typeof ResumeEducationSchema>;

/**
 * Confidence score for each extracted resume field.
 * Uses the same six-anchor scale as InvoiceConfidenceSchema: 0.0, 0.2, 0.4, 0.6, 0.8, 1.0.
 */
export const ResumeConfidenceSchema = z.object({
    fullName: z.number().describe('Confidence score 0.0-1.0 for fullName'),
    email: z.number().describe('Confidence score 0.0-1.0 for email'),
    phone: z.number().describe('Confidence score 0.0-1.0 for phone'),
    summary: z.number().describe('Confidence score 0.0-1.0 for summary'),
    skills: z.number().describe('Confidence score 0.0-1.0 for the skills array as a whole'),
    experience: z.number().describe('Confidence score 0.0-1.0 for the experience array as a whole'),
    education: z.number().describe('Confidence score 0.0-1.0 for the education array as a whole'),
});

export type ResumeConfidence = z.infer<typeof ResumeConfidenceSchema>;
