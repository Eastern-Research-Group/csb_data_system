const express = require("express");
// ---
const {
  axiosFormio,
  formUrl,
  submissionPeriodOpen,
  formioCSBMetadata,
} = require("../config/formio");
const {
  getBapDataFor2022PRF,
  getBapDataFor2023PRF,
  checkFormSubmissionPeriodAndBapStatus,
} = require("../utilities/bap");
const log = require("./logger");

/**
 * @param {Object} param
 * @param {'2022' | '2023'} param.rebateYear
 */
function getComboKeyFieldName({ rebateYear }) {
  return rebateYear === "2022"
    ? "bap_hidden_entity_combo_key"
    : rebateYear === "2023"
    ? "_bap_entity_combo_key"
    : "";
}

/**
 * @param {Object} param
 * @param {'2022' | '2023'} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function fetchDataForPRFSubmission({ rebateYear, req, res }) {
  /** @type {{
   *  email: string
   *  title: string
   *  name: string
   *  entity: import('./bap.js').BapSamEntity
   *  comboKey: ?string
   *  rebateId: ?string
   *  frfReviewItemId: ?string
   *  frfFormModified: ?string
   * }} */
  const {
    email,
    title,
    name,
    entity,
    comboKey,
    rebateId,
    frfReviewItemId,
    frfFormModified,
  } = req.body;

  const {
    UNIQUE_ENTITY_ID__c,
    ENTITY_EFT_INDICATOR__c,
    LEGAL_BUSINESS_NAME__c,
    PHYSICAL_ADDRESS_LINE_1__c,
    PHYSICAL_ADDRESS_LINE_2__c,
    PHYSICAL_ADDRESS_CITY__c,
    PHYSICAL_ADDRESS_PROVINCE_OR_STATE__c,
    PHYSICAL_ADDRESS_ZIPPOSTAL_CODE__c,
    ELEC_BUS_POC_EMAIL__c,
    ALT_ELEC_BUS_POC_EMAIL__c,
    GOVT_BUS_POC_EMAIL__c,
    ALT_GOVT_BUS_POC_EMAIL__c,
  } = entity;

  if (rebateYear === "2022") {
    return getBapDataFor2022PRF(req, frfReviewItemId)
      .then(({ frfRecordQuery, busRecordsQuery }) => {
        const {
          CSB_NCES_ID__c,
          Primary_Applicant__r,
          Alternate_Applicant__r,
          Applicant_Organization__r,
          CSB_School_District__r,
          Fleet_Name__c,
          School_District_Prioritized__c,
          Total_Rebate_Funds_Requested__c,
          Total_Infrastructure_Funds__c,
        } = frfRecordQuery[0];

        const busInfo = busRecordsQuery.map((record) => ({
          busNum: record.Rebate_Item_num__c,
          oldBusNcesDistrictId: CSB_NCES_ID__c,
          oldBusVin: record.CSB_VIN__c,
          oldBusModelYear: record.CSB_Model_Year__c,
          oldBusFuelType: record.CSB_Fuel_Type__c,
          newBusFuelType: record.CSB_Replacement_Fuel_Type__c,
          hidden_bap_max_rebate: record.CSB_Funds_Requested__c,
        }));

        /**
         * NOTE: `purchaseOrders` is initialized as an empty array to fix some
         * issue with the field being changed to an object when the form loads
         */
        return {
          data: {
            bap_hidden_entity_combo_key: comboKey,
            hidden_application_form_modified: frfFormModified,
            hidden_current_user_email: email,
            hidden_current_user_title: title,
            hidden_current_user_name: name,
            hidden_sam_uei: UNIQUE_ENTITY_ID__c,
            hidden_sam_efti: ENTITY_EFT_INDICATOR__c || "0000",
            hidden_sam_elec_bus_poc_email: ELEC_BUS_POC_EMAIL__c,
            hidden_sam_alt_elec_bus_poc_email: ALT_ELEC_BUS_POC_EMAIL__c,
            hidden_sam_govt_bus_poc_email: GOVT_BUS_POC_EMAIL__c,
            hidden_sam_alt_govt_bus_poc_email: ALT_GOVT_BUS_POC_EMAIL__c,
            hidden_bap_rebate_id: rebateId,
            hidden_bap_district_id: CSB_NCES_ID__c,
            hidden_bap_primary_name: Primary_Applicant__r?.Name,
            hidden_bap_primary_title: Primary_Applicant__r?.Title,
            hidden_bap_primary_phone_number: Primary_Applicant__r?.Phone,
            hidden_bap_primary_email: Primary_Applicant__r?.Email,
            hidden_bap_alternate_name: Alternate_Applicant__r?.Name || "",
            hidden_bap_alternate_title: Alternate_Applicant__r?.Title || "",
            hidden_bap_alternate_phone_number: Alternate_Applicant__r?.Phone || "", // prettier-ignore
            hidden_bap_alternate_email: Alternate_Applicant__r?.Email || "",
            hidden_bap_org_name: Applicant_Organization__r?.Name,
            hidden_bap_district_name: CSB_School_District__r?.Name,
            hidden_bap_fleet_name: Fleet_Name__c,
            hidden_bap_prioritized: School_District_Prioritized__c,
            hidden_bap_requested_funds: Total_Rebate_Funds_Requested__c,
            hidden_bap_infra_max_rebate: Total_Infrastructure_Funds__c,
            busInfo,
            purchaseOrders: [],
          },
          /** Add custom metadata to track formio submissions from wrapper. */
          metadata: { ...formioCSBMetadata },
          state: "draft",
        };
      })
      .catch((error) => {
        // NOTE: logged in bap verifyBapConnection
        const errorStatus = 500;
        const errorMessage = `Error getting data for a new 2022 Payment Request form submission from the BAP.`;
        return res.status(errorStatus).json({ message: errorMessage });
      });
  }

  if (rebateYear === "2023") {
    return getBapDataFor2023PRF(req, frfReviewItemId)
      .then(({ frfRecordQuery }) => {
        const {
          Primary_Applicant__r,
          Alternate_Applicant__r,
          CSB_School_District__r,
          School_District_Contact__r,
          CSB_NCES_ID__c,
          Prioritized_as_High_Need__c,
          Prioritized_as_Tribal__c,
          Prioritized_as_Rural__c,
        } = frfRecordQuery[0];

        return {
          data: {
            _bap_entity_combo_key: comboKey,
            _application_form_modified: frfFormModified,
            _user_email: email,
            _user_title: title,
            _user_name: name,
            _bap_applicant_email: email,
            _bap_applicant_title: title,
            _bap_applicant_name: name,
            _bap_applicant_efti: ENTITY_EFT_INDICATOR__c || "0000",
            _bap_applicant_uei: UNIQUE_ENTITY_ID__c,
            _bap_applicant_organization_name: LEGAL_BUSINESS_NAME__c, // TODO: confirm
            _bap_applicant_district_name: "", // TODO: get
            _bap_applicant_street_address_1: PHYSICAL_ADDRESS_LINE_1__c, // TODO: confirm
            _bap_applicant_street_address_2: PHYSICAL_ADDRESS_LINE_2__c, // TODO: confirm
            _bap_applicant_county: "", // TODO: get
            _bap_applicant_city: PHYSICAL_ADDRESS_CITY__c, // TODO: confirm
            _bap_applicant_state: PHYSICAL_ADDRESS_PROVINCE_OR_STATE__c, // TODO: confirm
            _bap_applicant_zip: PHYSICAL_ADDRESS_ZIPPOSTAL_CODE__c, // TODO: confirm
            _bap_elec_bus_poc_email: ELEC_BUS_POC_EMAIL__c,
            _bap_alt_elec_bus_poc_email: ALT_ELEC_BUS_POC_EMAIL__c,
            _bap_govt_bus_poc_email: GOVT_BUS_POC_EMAIL__c,
            _bap_alt_govt_bus_poc_email: ALT_GOVT_BUS_POC_EMAIL__c,
            _bap_primary_fname: Primary_Applicant__r?.FirstName,
            _bap_primary_lname: Primary_Applicant__r?.LastName,
            _bap_primary_title: Primary_Applicant__r?.Title,
            _bap_primary_email: Primary_Applicant__r?.Email,
            _bap_primary_phone_number: Primary_Applicant__r?.Phone,
            _bap_alternate_fname: Alternate_Applicant__r?.FirstName,
            _bap_alternate_lname: Alternate_Applicant__r?.LastName,
            _bap_alternate_title: Alternate_Applicant__r?.Title,
            _bap_alternate_email: Alternate_Applicant__r?.Email,
            _bap_alternate_phone_number: Alternate_Applicant__r?.Phone,
            _bap_district_ncesID: CSB_NCES_ID__c,
            _bap_district_name: CSB_School_District__r?.Name,
            _bap_district_address_1: CSB_School_District__r?.BillingStreet, // TODO: confirm
            _bap_district_address_2: "", // TODO: get
            _bap_district_city: CSB_School_District__r?.BillingCity, // TODO: confirm
            _bap_district_state: CSB_School_District__r?.BillingState, // TODO: confirm
            _bap_district_zip: CSB_School_District__r?.BillingPostalCode, // TODO: confirm
            _bap_district_priority: "", // TODO: get
            _bap_district_selfCertify: "", // TODO: get
            _bap_district_priorityReason: {
              highNeed: Prioritized_as_High_Need__c,
              tribal: Prioritized_as_Tribal__c,
              rural: Prioritized_as_Rural__c,
            },
            _bap_district_contactFName: School_District_Contact__r?.FirstName,
            _bap_district_contactLName: School_District_Contact__r?.LastName,
            _bap_district_contactTitle: School_District_Contact__r?.Title,
            _bap_district_contactEmail: School_District_Contact__r?.Email,
            _bap_district_contactPhone: School_District_Contact__r?.Phone,
          },
          /** Add custom metadata to track formio submissions from wrapper. */
          metadata: { ...formioCSBMetadata },
          state: "draft",
        };
      })
      .catch((error) => {
        // NOTE: logged in bap verifyBapConnection
        const errorStatus = 500;
        const errorMessage = `Error getting data for a new 2023 Payment Request form submission from the BAP.`;
        return res.status(errorStatus).json({ message: errorMessage });
      });
  }
}

/**
 * @param {Object} param
 * @param {'2022' | '2023'} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function uploadS3FileMetadata({ rebateYear, req, res }) {
  const { bapComboKeys, body } = req;
  const { mail } = req.user;
  const { formType, mongoId, comboKey } = req.params;

  const formioFormUrl = formUrl[rebateYear][formType];

  if (!formioFormUrl) {
    const errorStatus = 400;
    const errorMessage = `Formio form URL does not exist for ${rebateYear} ${formType.toUpperCase()}.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  checkFormSubmissionPeriodAndBapStatus({
    rebateYear,
    formType,
    mongoId,
    comboKey,
    req,
  })
    .then(() => {
      if (!bapComboKeys.includes(comboKey)) {
        const logMessage =
          `User with email '${mail}' attempted to upload a file ` +
          `without a matching BAP combo key.`;
        log({ level: "error", message: logMessage, req });

        const errorStatus = 401;
        const errorMessage = `Unauthorized.`;
        return res.status(errorStatus).json({ message: errorMessage });
      }

      axiosFormio(req)
        .post(`${formioFormUrl}/storage/s3`, body)
        .then((axiosRes) => axiosRes.data)
        .then((fileMetadata) => res.json(fileMetadata))
        .catch((error) => {
          // NOTE: logged in axiosFormio response interceptor
          const errorStatus = error.response?.status || 500;
          const errorMessage = `Error uploading file to S3.`;
          return res.status(errorStatus).json({ message: errorMessage });
        });
    })
    .catch((error) => {
      const formName =
        formType === "frf"
          ? "CSB Application"
          : formType === "prf"
          ? "CSB Payment Request"
          : formType === "cof"
          ? "CSB Close Out"
          : "CSB";

      const logMessage =
        `User with email '${mail}' attempted to upload a file when the ` +
        `${rebateYear} ${formName} form enrollment period was closed.`;
      log({ level: "error", message: logMessage, req });

      const errorStatus = 400;
      const errorMessage = `${rebateYear} ${formName} form enrollment period is closed.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
}

/**
 * @param {Object} param
 * @param {'2022' | '2023'} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function downloadS3FileMetadata({ rebateYear, req, res }) {
  const { bapComboKeys, query } = req;
  const { mail } = req.user;
  const { formType, comboKey } = req.params;

  const formioFormUrl = formUrl[rebateYear][formType];

  if (!formioFormUrl) {
    const errorStatus = 400;
    const errorMessage = `Formio form URL does not exist for ${rebateYear} ${formType.toUpperCase()}.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  if (!bapComboKeys.includes(comboKey)) {
    const logMessage =
      `User with email '${mail}' attempted to download a file ` +
      `without a matching BAP combo key.`;
    log({ level: "error", message: logMessage, req });

    const errorStatus = 401;
    const errorMessage = `Unauthorized.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  axiosFormio(req)
    .get(`${formioFormUrl}/storage/s3`, { params: query })
    .then((axiosRes) => axiosRes.data)
    .then((fileMetadata) => res.json(fileMetadata))
    .catch((error) => {
      // NOTE: logged in axiosFormio response interceptor
      const errorStatus = error.response?.status || 500;
      const errorMessage = `Error downloading file from S3.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
}

/**
 * @param {Object} param
 * @param {'2022' | '2023'} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function fetchFRFSubmissions({ rebateYear, req, res }) {
  const { bapComboKeys } = req;

  const comboKeyFieldName = getComboKeyFieldName({ rebateYear });
  const comboKeySearchParam = `&data.${comboKeyFieldName}=`;

  const formioFormUrl = formUrl[rebateYear].frf;

  if (!formioFormUrl) {
    const errorStatus = 400;
    const errorMessage = `Formio form URL does not exist for ${rebateYear} FRF.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  const submissionsUrl =
    `${formioFormUrl}/submission` +
    `?sort=-modified` +
    `&limit=1000000` +
    comboKeySearchParam +
    `${bapComboKeys.join(comboKeySearchParam)}`;

  axiosFormio(req)
    .get(submissionsUrl)
    .then((axiosRes) => axiosRes.data)
    .then((submissions) => res.json(submissions))
    .catch((error) => {
      // NOTE: error is logged in axiosFormio response interceptor
      const errorStatus = error.response?.status || 500;
      const errorMessage = `Error getting Formio ${rebateYear} Application form submissions.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
}

/**
 * @param {Object} param
 * @param {'2022' | '2023'} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function createFRFSubmission({ rebateYear, req, res }) {
  const { bapComboKeys, body } = req;
  const { mail } = req.user;

  const comboKeyFieldName = getComboKeyFieldName({ rebateYear });
  const comboKey = body.data?.[comboKeyFieldName];

  const formioFormUrl = formUrl[rebateYear].frf;

  if (!formioFormUrl) {
    const errorStatus = 400;
    const errorMessage = `Formio form URL does not exist for ${rebateYear} FRF.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  if (!submissionPeriodOpen[rebateYear].frf) {
    const errorStatus = 400;
    const errorMessage = `${rebateYear} CSB Application form enrollment period is closed.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  if (!bapComboKeys.includes(comboKey)) {
    const logMessage =
      `User with email '${mail}' attempted to post a new ${rebateYear} ` +
      `FRF submission without a matching BAP combo key.`;
    log({ level: "error", message: logMessage, req });

    const errorStatus = 401;
    const errorMessage = `Unauthorized.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  /** Add custom metadata to track formio submissions from wrapper. */
  body.metadata = { ...formioCSBMetadata };

  axiosFormio(req)
    .post(`${formioFormUrl}/submission`, body)
    .then((axiosRes) => axiosRes.data)
    .then((submission) => res.json(submission))
    .catch((error) => {
      // NOTE: error is logged in axiosFormio response interceptor
      const errorStatus = error.response?.status || 500;
      const errorMessage = `Error posting Formio ${rebateYear} Application form submission.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
}

/**
 * @param {Object} param
 * @param {'2022' | '2023'} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function fetchFRFSubmission({ rebateYear, req, res }) {
  const { bapComboKeys } = req;
  const { mail } = req.user;
  const { mongoId } = req.params;

  const comboKeyFieldName = getComboKeyFieldName({ rebateYear });

  const formioFormUrl = formUrl[rebateYear].frf;

  if (!formioFormUrl) {
    const errorStatus = 400;
    const errorMessage = `Formio form URL does not exist for ${rebateYear} FRF.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  Promise.all([
    axiosFormio(req).get(`${formioFormUrl}/submission/${mongoId}`),
    axiosFormio(req).get(formioFormUrl),
  ])
    .then((axiosResponses) => axiosResponses.map((axiosRes) => axiosRes.data))
    .then(([submission, schema]) => {
      const comboKey = submission.data?.[comboKeyFieldName];

      if (!bapComboKeys.includes(comboKey)) {
        const logMessage =
          `User with email '${mail}' attempted to access ${rebateYear} ` +
          `FRF submission '${mongoId}' that they do not have access to.`;
        log({ level: "warn", message: logMessage, req });

        return res.json({
          userAccess: false,
          formSchema: null,
          submission: null,
        });
      }

      return res.json({
        userAccess: true,
        formSchema: { url: formioFormUrl, json: schema },
        submission,
      });
    })
    .catch((error) => {
      // NOTE: error is logged in axiosFormio response interceptor
      const errorStatus = error.response?.status || 500;
      const errorMessage = `Error getting Formio ${rebateYear} Application form submission '${mongoId}'.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
}

/**
 * @param {Object} param
 * @param {'2022' | '2023'} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function updateFRFSubmission({ rebateYear, req, res }) {
  const { bapComboKeys } = req;
  const { mail } = req.user;
  const { mongoId } = req.params;
  const submission = req.body;

  const comboKeyFieldName = getComboKeyFieldName({ rebateYear });
  const comboKey = submission.data?.[comboKeyFieldName];

  const formioFormUrl = formUrl[rebateYear].frf;

  if (!formioFormUrl) {
    const errorStatus = 400;
    const errorMessage = `Formio form URL does not exist for ${rebateYear} FRF.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  checkFormSubmissionPeriodAndBapStatus({
    rebateYear,
    formType: "frf",
    mongoId,
    comboKey,
    req,
  })
    .then(() => {
      if (!bapComboKeys.includes(comboKey)) {
        const logMessage =
          `User with email '${mail}' attempted to update ${rebateYear} FRF ` +
          `submission '${mongoId}' without a matching BAP combo key.`;
        log({ level: "error", message: logMessage, req });

        const errorStatus = 401;
        const errorMessage = `Unauthorized.`;
        return res.status(errorStatus).json({ message: errorMessage });
      }

      /** Add custom metadata to track formio submissions from wrapper. */
      submission.metadata = {
        ...submission.metadata,
        ...formioCSBMetadata,
      };

      axiosFormio(req)
        .put(`${formioFormUrl}/submission/${mongoId}`, submission)
        .then((axiosRes) => axiosRes.data)
        .then((submission) => res.json(submission))
        .catch((error) => {
          // NOTE: error is logged in axiosFormio response interceptor
          const errorStatus = error.response?.status || 500;
          const errorMessage = `Error updating Formio ${rebateYear} Application form submission '${mongoId}'.`;
          return res.status(errorStatus).json({ message: errorMessage });
        });
    })
    .catch((error) => {
      const logMessage =
        `User with email '${mail}' attempted to update ${rebateYear} FRF ` +
        `submission '${mongoId}' when the CSB FRF enrollment period was closed.`;
      log({ level: "error", message: logMessage, req });

      const errorStatus = 400;
      const errorMessage = `${rebateYear} CSB Application form enrollment period is closed.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
}

/**
 * @param {Object} param
 * @param {'2022' | '2023'} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function fetchPRFSubmissions({ rebateYear, req, res }) {
  const { bapComboKeys } = req;

  const comboKeyFieldName = getComboKeyFieldName({ rebateYear });
  const comboKeySearchParam = `&data.${comboKeyFieldName}=`;

  const formioFormUrl = formUrl[rebateYear].prf;

  if (!formioFormUrl) {
    const errorStatus = 400;
    const errorMessage = `Formio form URL does not exist for ${rebateYear} PRF.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  const submissionsUrl =
    `${formioFormUrl}/submission` +
    `?sort=-modified` +
    `&limit=1000000` +
    comboKeySearchParam +
    `${bapComboKeys.join(comboKeySearchParam)}`;

  axiosFormio(req)
    .get(submissionsUrl)
    .then((axiosRes) => axiosRes.data)
    .then((submissions) => res.json(submissions))
    .catch((error) => {
      // NOTE: error is logged in axiosFormio response interceptor
      const errorStatus = error.response?.status || 500;
      const errorMessage = `Error getting Formio ${rebateYear} Payment Request form submissions.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
}

/**
 * @param {Object} param
 * @param {'2022' | '2023'} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function createPRFSubmission({ rebateYear, req, res }) {
  const { bapComboKeys, body } = req;
  const { mail } = req.user;
  const { comboKey } = body;

  const formioFormUrl = formUrl[rebateYear].prf;

  if (!formioFormUrl) {
    const errorStatus = 400;
    const errorMessage = `Formio form URL does not exist for ${rebateYear} PRF.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  if (!submissionPeriodOpen[rebateYear].prf) {
    const errorStatus = 400;
    const errorMessage = `${rebateYear} CSB Payment Request form enrollment period is closed.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  if (!bapComboKeys.includes(comboKey)) {
    const logMessage =
      `User with email '${mail}' attempted to post a new ${rebateYear} ` +
      `PRF submission without a matching BAP combo key.`;
    log({ level: "error", message: logMessage, req });

    const errorStatus = 401;
    const errorMessage = `Unauthorized.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  fetchDataForPRFSubmission({ rebateYear, req, res }).then((submission) => {
    axiosFormio(req)
      .post(`${formioFormUrl}/submission`, submission)
      .then((axiosRes) => axiosRes.data)
      .then((submission) => res.json(submission))
      .catch((error) => {
        // NOTE: error is logged in axiosFormio response interceptor
        const errorStatus = error.response?.status || 500;
        const errorMessage = `Error posting Formio ${rebateYear} Payment Request form submission.`;
        return res.status(errorStatus).json({ message: errorMessage });
      });
  });
}

module.exports = {
  uploadS3FileMetadata,
  downloadS3FileMetadata,
  //
  fetchFRFSubmissions,
  createFRFSubmission,
  fetchFRFSubmission,
  updateFRFSubmission,
  //
  fetchPRFSubmissions,
  createPRFSubmission,
};
