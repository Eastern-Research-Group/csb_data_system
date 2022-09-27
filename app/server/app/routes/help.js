const express = require("express");
// ---
const {
  axiosFormio,
  formioProjectUrl,
  formioApplicationFormPath,
  formioCsbMetadata,
} = require("../config/formio");
const {
  ensureAuthenticated,
  ensureHelpdesk,
  verifyMongoObjectId,
} = require("../middleware");
const log = require("../utilities/logger");

const enrollmentClosed = process.env.CSB_ENROLLMENT_PERIOD !== "open";

const router = express.Router();

// confirm user is both authenticated and authorized with valid helpdesk roles
router.use(ensureAuthenticated);
router.use(ensureHelpdesk);

const applicationFormApiPath = `${formioProjectUrl}/${formioApplicationFormPath}`;

// --- get an existing Application form's submission data from Forms.gov
router.get(
  "/formio-application-submission/:mongoId",
  verifyMongoObjectId,
  (req, res) => {
    const { mongoId } = req.params;

    axiosFormio(req)
      .get(`${applicationFormApiPath}/submission/${mongoId}`)
      .then((axiosRes) => axiosRes.data)
      .then((submission) => {
        axiosFormio(req)
          .get(`${formioProjectUrl}/form/${submission.form}`)
          .then((axiosRes) => axiosRes.data)
          .then((schema) => {
            return res.json({
              formSchema: {
                url: `${formioProjectUrl}/form/${submission.form}`,
                json: schema,
              },
              submission,
            });
          });
      })
      .catch((error) => {
        const message = `Error getting Forms.gov Application form submission ${mongoId}`;
        return res.status(error?.response?.status || 500).json({ message });
      });
  }
);

// --- change a submitted Forms.gov Application form's submission state back to draft
router.post(
  "/formio-application-submission/:mongoId",
  verifyMongoObjectId,
  (req, res) => {
    const { mongoId } = req.params;
    const { mail } = req.user;

    if (enrollmentClosed) {
      const message = `CSB enrollment period is closed`;
      return res.status(400).json({ message });
    }

    axiosFormio(req)
      .get(`${applicationFormApiPath}/submission/${mongoId}`)
      .then((axiosRes) => axiosRes.data)
      .then((existingSubmission) => {
        axiosFormio(req)
          .put(`${applicationFormApiPath}/submission/${mongoId}`, {
            state: "draft",
            data: { ...existingSubmission.data, last_updated_by: mail },
            metadata: { ...existingSubmission.metadata, ...formioCsbMetadata },
          })
          .then((axiosRes) => axiosRes.data)
          .then((updatedSubmission) => {
            const message = `User with email ${mail} updated Application form submission ${mongoId} from submitted to draft.`;
            log({ level: "info", message, req });

            axiosFormio(req)
              .get(`${formioProjectUrl}/form/${updatedSubmission.form}`)
              .then((axiosRes) => axiosRes.data)
              .then((schema) => {
                return res.json({
                  formSchema: {
                    url: `${formioProjectUrl}/form/${updatedSubmission.form}`,
                    json: schema,
                  },
                  submission: updatedSubmission,
                });
              });
          });
      })
      .catch((error) => {
        const message = `Error updating Forms.gov Application form submission ${mongoId}`;
        return res.status(error?.response?.status || 500).json({ message });
      });
  }
);

module.exports = router;
