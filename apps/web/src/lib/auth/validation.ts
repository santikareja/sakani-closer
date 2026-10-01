import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

const emailSchema = z.string().trim().toLowerCase().email().max(320);
const passwordSchema = z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH);

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const registrationSchema = loginSchema.extend({
  displayName: z.string().trim().min(2).max(120),
  workspaceName: z.string().trim().min(2).max(120),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegistrationInput = z.infer<typeof registrationSchema>;
