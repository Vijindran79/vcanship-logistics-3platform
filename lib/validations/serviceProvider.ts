// ⚠️  READ-ONLY — DO NOT EDIT — SERVICE LOCKED ⚠️
import { z } from "zod";

const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2 MB
const ACCEPTED_LOGO_TYPES = ["image/jpeg", "image/png"];
const MAX_DOC_SIZE = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_DOC_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
];

export const serviceProviderSchema = z.object({
  company_name: z.string().min(2, {
    message: "Company name must be at least 2 characters.",
  }),
  website: z.string().url({ message: "Please enter a valid URL." }),
  logo: z
    .instanceof(FileList)
    .optional()
    .refine(
      (files) => !files || files.length === 0 || files[0].size <= MAX_LOGO_SIZE,
      `Max file size is 2MB.`
    )
    .refine(
      (files) => !files || files.length === 0 || ACCEPTED_LOGO_TYPES.includes(files[0].type),
      "Only .jpg and .png formats are supported."
    ),
  business_document: z
    .instanceof(FileList)
    .optional()
    .refine(
      (files) => !files || files.length === 0 || files[0].size <= MAX_DOC_SIZE,
      `Max document size is 5MB.`
    )
    .refine(
      (files) => !files || files.length === 0 || ACCEPTED_DOC_TYPES.includes(files[0].type),
      "Only .pdf and .docx formats are supported."
    ),
  email: z.string().email({ message: "Please enter a valid email address." }),
  phone: z.string().min(10, {
    message: "Phone number must be at least 10 characters.",
  }),
  address_street: z.string().min(5, {
    message: "Street address must be at least 5 characters.",
  }),
  address_city: z.string().min(2, {
    message: "City must be at least 2 characters.",
  }),
  address_country: z.string().min(2, {
    message: "Country must be at least 2 characters.",
  }),
  services: z.array(z.string()).nonempty({
    message: "You must select at least one service.",
  }),
  coverage_regions: z.array(z.string()).nonempty({
    message: "You must select at least one coverage region.",
  }),
});