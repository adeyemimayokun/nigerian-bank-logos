export type LogoRequest = {
  institutionName: string;
  officialWebsite: string;
  email: string;
  category: string;
  notes: string;
  notificationConsent: boolean;
};

export type CompanyLogoSubmission = {
  companyName: string;
  officialWebsite: string;
  workEmail: string;
  category: string;
  submitterRole: string;
  logoFormat: string;
  logoAssetUrl: string;
  brandGuidelinesUrl: string;
  notes: string;
  rightsConfirmed: boolean;
};

const requestEndpoint = "https://github.com/adeyemimayokun/awalogo/issues/new";

export function buildLogoRequestUrl(request: LogoRequest): string {
  const title = `Logo request: ${request.institutionName.trim()}`;
  const body = [
    "## Institution",
    request.institutionName.trim(),
    "",
    "## Category",
    request.category,
    "",
    "## Official source URL",
    request.officialWebsite.trim() || "Not provided",
    "",
    "## Contact email",
    request.email.trim() || "Not provided",
    "",
    "## Notes",
    request.notes.trim() || "None",
    "",
    "## Notification consent",
    request.notificationConsent
      ? "- [x] Notify me through this GitHub issue when the logo is added."
      : "- [ ] No notification follow-up requested."
  ].join("\n");
  const url = new URL(requestEndpoint);
  url.searchParams.set("template", "logo-request.md");
  url.searchParams.set("labels", "logo-request");
  url.searchParams.set("title", title);
  url.searchParams.set("body", body);
  return url.href;
}

export function buildCompanyLogoSubmissionUrl(submission: CompanyLogoSubmission): string {
  const title = `Company logo submission: ${submission.companyName.trim()}`;
  const body = [
    "## Company",
    submission.companyName.trim(),
    "",
    "## Official website",
    submission.officialWebsite.trim(),
    "",
    "## Work email",
    submission.workEmail.trim(),
    "",
    "## Category",
    submission.category,
    "",
    "## Submitter role",
    submission.submitterRole.trim() || "Not provided",
    "",
    "## Logo format",
    submission.logoFormat,
    "",
    "## Official logo or brand-kit URL",
    submission.logoAssetUrl.trim() || "Logo file will be attached to this issue.",
    "",
    "## Brand guidelines URL",
    submission.brandGuidelinesUrl.trim() || "Not provided",
    "",
    "## Notes",
    submission.notes.trim() || "None",
    "",
    "## Company confirmation",
    submission.rightsConfirmed
      ? "- [x] I am authorized to submit this current company artwork for inclusion in the catalog."
      : "- [ ] Authorization has not been confirmed."
  ].join("\n");
  const url = new URL(requestEndpoint);
  url.searchParams.set("template", "company-logo-submission.md");
  url.searchParams.set("labels", "logo-request");
  url.searchParams.set("title", title);
  url.searchParams.set("body", body);
  return url.href;
}
