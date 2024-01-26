const {
  MODE,
  VITE_SERVER_BASE_PATH,
  VITE_CLOUD_SPACE,
  VITE_FORMIO_BASE_URL,
  VITE_FORMIO_PROJECT_NAME,
} = import.meta.env;

if (!VITE_FORMIO_BASE_URL) {
  const message = `Required VITE_FORMIO_BASE_URL environment variable not found.`;
  throw new Error(message);
}

if (!VITE_FORMIO_PROJECT_NAME) {
  const message = `Required VITE_FORMIO_PROJECT_NAME environment variable not found.`;
  throw new Error(message);
}

// allows the app to be accessed from a sub directory of a server (e.g. /csb)
export const serverBasePath =
  MODE === "development" ? "" : VITE_SERVER_BASE_PATH || "";

export const serverUrl = window.location.origin + serverBasePath;

export const cloudSpace =
  MODE === "development" ? "dev" : VITE_CLOUD_SPACE || "";

export const formioBaseUrl = VITE_FORMIO_BASE_URL;

const formioProjectName = VITE_FORMIO_PROJECT_NAME;

export const formioProjectUrl = `${formioBaseUrl}/${formioProjectName}`;

export const messages = {
  genericError: "The application has encountered an unknown error.",
  authError: "Authentication error. Please log in again or contact support.",
  samlError: "Error logging in. Please try again or contact support.",
  bapSamFetchError: "Error loading SAM.gov data. Please contact support.",
  bapNoSamResults:
    "No SAM.gov records match your email. Only Government and Electronic Business SAM.gov Points of Contacts (and alternates) may edit and submit Clean School Bus Rebate Forms.",
  bapSamEntityNotActive:
    "Your SAM.gov account is currently not active. Activate your SAM.gov account to access this submission.",
  bapSamAtLeastOneEntityNotActive:
    "At least one of your SAM.gov accounts is currently not active. Any submissions associated with that SAM.gov account will be inaccessible until the account is re-activated.",
  formSubmissionError:
    "The requested submission does not exist, or you do not have access. Please contact support if you believe this is a mistake.",
  formSubmissionsError: "Error loading form submissions.",
  newApplication:
    "Please select the “New Application” button above to create your first rebate application.",
  helpdeskSubmissionSearchError:
    "Error loading form submission. Please confirm the form type and ID is correct and search again.",
  timeout:
    "For security reasons, you have been logged out due to 15 minutes of inactivity.",
  logout: "You have successfully logged out.",
  frfClosed: "The CSB Application form enrollment period is closed.",
  prfClosed: "The CSB Payment Request form enrollment period is closed.",
  crfClosed: "The CSB Close Out form enrollment period is closed.",
  prfWillBeDeleted:
    "A request to edit the Application form associated with this draft or submitted Payment Request form has been made, so this form has been set to read-only mode. Visit your dashboard to make edits to the associated Application form submission.",
};

/**
 * Formio status mapping for all form submissions (practically, just capitalizes
 * "draft" or "submitted", but follows same format as BAP status maps).
 */
export const formioStatusMap = new Map<string, string>()
  .set("draft", "Draft")
  .set("submitted", "Submitted");

/**
 * BAP internal to external status mapping for FRF submissions.
 */
export const bapFRFStatusMap = new Map<string, string>()
  .set("Needs Clarification", "Needs Clarification")
  .set("Withdrawn", "Withdrawn")
  .set("Coordinator Denied", "Not Selected")
  .set("Accepted", "Selected");

/**
 * BAP internal to external status mapping for PRF submissions.
 */
export const bapPRFStatusMap = new Map<string, string>()
  .set("Needs Clarification", "Needs Clarification")
  .set("Withdrawn", "Withdrawn")
  .set("Coordinator Denied", "Funding Not Approved")
  .set("Accepted", "Funding Approved");

/**
 * BAP internal to external status mapping for CRF submissions.
 */
export const bapCRFStatusMap = new Map<string, string>()
  .set("Needs Clarification", "Needs Clarification")
  .set("Reimbursement Needed", "Reimbursement Needed")
  .set("Branch Director Denied", "Close Out Not Approved")
  .set("Branch Director Approved", "Close Out Approved");
