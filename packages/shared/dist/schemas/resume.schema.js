"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResumeConfidenceSchema = exports.ResumeSchema = exports.ResumeEducationSchema = exports.ResumeExperienceSchema = void 0;
const zod_1 = require("zod");
exports.ResumeExperienceSchema = zod_1.z.object({
    company: zod_1.z.string().describe('Employer/company name'),
    title: zod_1.z.string().describe('Job title'),
    startDate: zod_1.z.string().nullable().describe('Start date, or null if not found'),
    endDate: zod_1.z.string().nullable().describe('End date, or null if still current/not found'),
    description: zod_1.z.string().nullable().describe('Role description or key responsibilities, or null if not found'),
});
exports.ResumeEducationSchema = zod_1.z.object({
    institution: zod_1.z.string().describe('School/university name'),
    degree: zod_1.z.string().nullable().describe('Degree or qualification, or null if not found'),
    startDate: zod_1.z.string().nullable().describe('Start date, or null if not found'),
    endDate: zod_1.z.string().nullable().describe('End date, or null if not found'),
});
/**
 * Nullable resume/CV schema — every scalar field is optional/nullable because
 * the model may not find a value for every field in every document. Same
 * convention as InvoiceSchema.
 */
exports.ResumeSchema = zod_1.z.object({
    fullName: zod_1.z.string().nullable().describe('Candidate full name, or null if not found'),
    email: zod_1.z.string().nullable().describe('Candidate email address, or null if not found'),
    phone: zod_1.z.string().nullable().describe('Candidate phone number, or null if not found'),
    summary: zod_1.z.string().nullable().describe('Professional summary/objective, or null if not found'),
    skills: zod_1.z.array(zod_1.z.string()).describe('List of skills — empty array if none found'),
    experience: zod_1.z.array(exports.ResumeExperienceSchema).describe('Work experience entries — empty array if none found'),
    education: zod_1.z.array(exports.ResumeEducationSchema).describe('Education entries — empty array if none found'),
});
/**
 * Confidence score for each extracted resume field.
 * Uses the same six-anchor scale as InvoiceConfidenceSchema: 0.0, 0.2, 0.4, 0.6, 0.8, 1.0.
 */
exports.ResumeConfidenceSchema = zod_1.z.object({
    fullName: zod_1.z.number().describe('Confidence score 0.0-1.0 for fullName'),
    email: zod_1.z.number().describe('Confidence score 0.0-1.0 for email'),
    phone: zod_1.z.number().describe('Confidence score 0.0-1.0 for phone'),
    summary: zod_1.z.number().describe('Confidence score 0.0-1.0 for summary'),
    skills: zod_1.z.number().describe('Confidence score 0.0-1.0 for the skills array as a whole'),
    experience: zod_1.z.number().describe('Confidence score 0.0-1.0 for the experience array as a whole'),
    education: zod_1.z.number().describe('Confidence score 0.0-1.0 for the education array as a whole'),
});
