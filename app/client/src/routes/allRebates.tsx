import { Fragment, useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import icons from "uswds/img/sprite.svg";
// ---
import { serverUrl, messages, getData, postData } from "../config";
import { getUserInfo } from "../utilities";
import { Loading } from "components/loading";
import { Message } from "components/message";
import { MarkdownContent } from "components/markdownContent";
import { TextWithTooltip } from "components/infoTooltip";
import { useContentState } from "contexts/content";
import { useUserState } from "contexts/user";
import { useCsbState } from "contexts/csb";
import { useBapState, useBapDispatch } from "contexts/bap";
import { useFormioState, useFormioDispatch } from "contexts/formio";

/** Custom hook to fetch Application form submissions from Forms.gov */
function useFetchedFormioApplicationSubmissions() {
  const { samEntities } = useBapState();
  const dispatch = useFormioDispatch();

  useEffect(() => {
    if (samEntities.status !== "success" || !samEntities.data.results) {
      return;
    }

    dispatch({ type: "FETCH_FORMIO_APPLICATION_SUBMISSIONS_REQUEST" });

    getData(`${serverUrl}/api/formio-application-submissions`)
      .then((res) => {
        dispatch({
          type: "FETCH_FORMIO_APPLICATION_SUBMISSIONS_SUCCESS",
          payload: { applicationSubmissions: res },
        });
      })
      .catch((err) => {
        dispatch({ type: "FETCH_FORMIO_APPLICATION_SUBMISSIONS_FAILURE" });
      });
  }, [samEntities, dispatch]);
}

/** Custom hook to fetch Application form submissions from the BAP */
function useFetchedBapApplicationSubmissions() {
  const { samEntities } = useBapState();
  const dispatch = useBapDispatch();

  useEffect(() => {
    if (samEntities.status !== "success" || !samEntities.data.results) {
      return;
    }

    dispatch({ type: "FETCH_BAP_APPLICATION_SUBMISSIONS_REQUEST" });

    getData(`${serverUrl}/api/bap-application-submissions`)
      .then((res) => {
        dispatch({
          type: "FETCH_BAP_APPLICATION_SUBMISSIONS_SUCCESS",
          payload: { applicationSubmissions: res },
        });
      })
      .catch((err) => {
        dispatch({ type: "FETCH_BAP_APPLICATION_SUBMISSIONS_FAILURE" });
      });
  }, [samEntities, dispatch]);
}

/** Custom hook to fetch Payment Request form submissions from Forms.gov */
function useFetchedFormioPaymentRequestSubmissions() {
  const { samEntities } = useBapState();
  const dispatch = useFormioDispatch();

  useEffect(() => {
    if (samEntities.status !== "success" || !samEntities.data.results) {
      return;
    }

    dispatch({ type: "FETCH_FORMIO_PAYMENT_REQUEST_SUBMISSIONS_REQUEST" });

    getData(`${serverUrl}/api/formio-payment-request-submissions`)
      .then((res) => {
        dispatch({
          type: "FETCH_FORMIO_PAYMENT_REQUEST_SUBMISSIONS_SUCCESS",
          payload: { paymentRequestSubmissions: res },
        });
      })
      .catch((err) => {
        dispatch({ type: "FETCH_FORMIO_PAYMENT_REQUEST_SUBMISSIONS_FAILURE" });
      });
  }, [samEntities, dispatch]);
}

/** Custom hook to fetch Payment Request form submissions from the BAP */
function useFetchedBapPaymentRequestSubmissions() {
  // TODO
}

export function AllRebates() {
  const navigate = useNavigate();
  const { content } = useContentState();
  const { epaUserData } = useUserState();
  const { csbData } = useCsbState();
  const {
    samEntities,
    applicationSubmissions: bapApplicationSubmissions,
    paymentRequestSubmissions: bapPaymentRequestSubmissions,
  } = useBapState();
  const {
    applicationSubmissions: formioApplicationSubmissions,
    paymentRequestSubmissions: formioPaymentRequestSubmissions,
  } = useFormioState();

  const [message, setMessage] = useState<{
    displayed: boolean;
    type: "info" | "success" | "warning" | "error";
    text: string;
  }>({
    displayed: false,
    type: "info",
    text: "",
  });

  useFetchedFormioApplicationSubmissions();
  useFetchedBapApplicationSubmissions();

  useFetchedFormioPaymentRequestSubmissions();
  useFetchedBapPaymentRequestSubmissions();

  if (
    csbData.status !== "success" ||
    epaUserData.status !== "success" ||
    samEntities.status === "idle" ||
    samEntities.status === "pending" ||
    bapApplicationSubmissions.status === "idle" ||
    bapApplicationSubmissions.status === "pending" ||
    formioApplicationSubmissions.status === "idle" ||
    formioApplicationSubmissions.status === "pending" ||
    formioPaymentRequestSubmissions.status === "idle" ||
    formioPaymentRequestSubmissions.status === "pending"
  ) {
    return <Loading />;
  }

  if (samEntities.status === "failure") {
    return <Message type="error" text={messages.bapSamFetchError} />;
  }

  if (
    bapApplicationSubmissions.status === "failure" ||
    formioApplicationSubmissions.status === "failure"
  ) {
    return <Message type="error" text={messages.applicationSubmissionsError} />;
  }

  if (formioPaymentRequestSubmissions.status === "failure") {
    return (
      <Message type="error" text={messages.paymentRequestSubmissionsError} />
    );
  }

  const { enrollmentClosed } = csbData.data;
  const email = epaUserData.data.mail;

  /**
   * Formio Application submissions, merged with submissions returned from the
   * BAP, so we can include CSB rebate status, CSB review item ID, and last
   * updated datetime.
   */
  const applicationSubmissions = formioApplicationSubmissions.data.map(
    (formioSubmission) => {
      const match = bapApplicationSubmissions.data.find((bapSubmission) => {
        return bapSubmission.CSB_Form_ID__c === formioSubmission._id;
      });

      return {
        type: "Application",
        formio: {
          ...formioSubmission,
        },
        bap: {
          comboKey: match?.UEI_EFTI_Combo_Key__c || null,
          rebateId: match?.Parent_Rebate_ID__c || null,
          reviewItemId: match?.CSB_Review_Item_ID__c || null,
          rebateStatus:
            match?.Parent_CSB_Rebate__r?.CSB_Rebate_Status__c || null,
          lastModified: match?.CSB_Modified_Full_String__c || null,
        },
      };
    }
  );

  /**
   * Formio Payment Request submissions, merged with submissions returned from
   * the BAP, so we can include...(TODO)
   */
  const paymentRequestSubmissions = formioPaymentRequestSubmissions.data.map(
    (formioSubmission) => {
      const match = bapPaymentRequestSubmissions.data.find((bapSubmission) => {
        return bapSubmission;
      });

      return {
        type: "Payment Request",
        formio: {
          ...formioSubmission,
        },
        bap: {
          comboKey: match ? null : null,
          rebateId: match ? null : null,
          reviewItemId: match ? null : null,
          rebateStatus: match ? null : null,
          lastModified: match ? null : null,
        },
      };
    }
  );

  const submissions = [...applicationSubmissions, ...paymentRequestSubmissions];

  return (
    <>
      {submissions.length === 0 ? (
        <div className="margin-top-4">
          <Message type="info" text={messages.newApplication} />
        </div>
      ) : (
        <>
          {content.status === "success" && (
            <MarkdownContent
              className="margin-top-4"
              children={content.data?.allRebatesIntro || ""}
            />
          )}

          {message.displayed && (
            <Message type={message.type} text={message.text} />
          )}

          <div className="usa-table-container--scrollable" tabIndex={0}>
            <table
              aria-label="Your Rebate Forms"
              className="usa-table usa-table--stacked usa-table--borderless width-full"
            >
              <thead>
                <tr className="font-sans-2xs text-no-wrap text-bottom">
                  <th scope="col">
                    <span className="usa-sr-only">Open</span>
                  </th>

                  <th scope="col">
                    <TextWithTooltip
                      text="Rebate ID"
                      tooltip="Unique Clean School Bus Rebate ID"
                    />
                  </th>

                  <th scope="col">
                    <TextWithTooltip
                      text="Form Type"
                      tooltip="Application, Payment Request, or Close-Out form"
                    />
                    <br />
                    <TextWithTooltip
                      text="Form Status"
                      tooltip="Draft, Edits Requested, Submitted, Withdrawn, Selected, or Not Selected"
                    />
                  </th>

                  <th scope="col">
                    <TextWithTooltip
                      text="UEI"
                      tooltip="Unique Entity ID from SAM.gov"
                    />
                    <br />
                    <TextWithTooltip
                      text="EFT Indicator"
                      tooltip="Electronic Funds Transfer Indicator listing the associated bank account from SAM.gov"
                    />
                  </th>

                  <th scope="col">
                    <TextWithTooltip
                      text="Applicant"
                      tooltip="Legal Business Name from SAM.gov for this UEI"
                    />
                    <br />
                    <TextWithTooltip
                      text="School District"
                      tooltip="School district represented by applicant"
                    />
                  </th>

                  <th scope="col">
                    <TextWithTooltip
                      text="Updated By"
                      tooltip="Last person that updated this form"
                    />
                    <br />
                    <TextWithTooltip
                      text="Date Updated"
                      tooltip="Last date this form was updated"
                    />
                  </th>
                </tr>
              </thead>

              <tbody>
                {submissions.map(({ type, formio, bap }, index) => {
                  const { _id, state, modified, data } = formio;
                  const {
                    bap_hidden_entity_combo_key,
                    applicantUEI,
                    applicantEfti,
                    applicantEfti_display,
                    applicantOrganizationName,
                    schoolDistrictName,
                    last_updated_by,
                  } = data;

                  const date = new Date(modified).toLocaleDateString();
                  const time = new Date(modified).toLocaleTimeString();

                  /**
                   * The submission has been updated since the last time the
                   * BAP's submissions ETL process has last succesfully run.
                   */
                  const submissionHasBeenUpdated = bap.lastModified
                    ? new Date(modified) > new Date(bap.lastModified)
                    : false;

                  const submissionNeedsEdits =
                    bap.rebateStatus === "Edits Requested" &&
                    (state === "draft" ||
                      (state === "submitted" && !submissionHasBeenUpdated));

                  const submissionHasBeenWithdrawn =
                    bap.rebateStatus === "Withdrawn";

                  const submissionHasBeenSelected = false;
                  // const submissionHasBeenSelected =
                  //   bap.rebateStatus === "Selected";

                  const statusStyles = submissionNeedsEdits
                    ? "csb-needs-edits"
                    : enrollmentClosed || state === "submitted"
                    ? "text-italic"
                    : "";

                  /**
                   * matched SAM.gov entity for each submission (used to set the
                   * user's name and title in a new payment request form)
                   */
                  const entity = samEntities.data.entities.find((entity) => {
                    return (
                      entity.ENTITY_STATUS__c === "Active" &&
                      entity.ENTITY_COMBO_KEY__c === bap_hidden_entity_combo_key
                    );
                  });

                  /* NOTE: when a form is first initially created, and the user
has not yet clicked the "Next" or "Save" buttons, any fields that the Formio
form definition sets automatically (based on hidden fields we inject on form
creation) will not yet be part of the form submission data. As soon as the user
clicks the "Next" or "Save" buttons the first time, those fields will be set and
stored in the submission. Since we display some of those fields in the table
below, we need to check if their values exist, and if they don't (for cases
where the user has not yet advanced past the first screen of the form...which we
believe is a bit of an edge case, as most users will likely do that after
starting a new application), indicate to the user they need to first save the
form for the fields to be displayed. */
                  return (
                    <Fragment key={_id}>
                      <tr className="bg-gray-5">
                        <th scope="row" className={statusStyles}>
                          {submissionNeedsEdits ? (
                            <button
                              className="usa-button font-sans-2xs margin-right-0 padding-x-105 padding-y-1"
                              onClick={(ev) => {
                                // clear out existing message
                                setMessage({
                                  displayed: false,
                                  type: "info",
                                  text: "",
                                });

                                // change the submission's state to draft, then
                                // redirect to the form to allow user to edit
                                postData(
                                  `${serverUrl}/api/formio-application-submission/${_id}`,
                                  { data, state: "draft" }
                                )
                                  .then((res) => {
                                    navigate(`/rebate/${res._id}`);
                                  })
                                  .catch((err) => {
                                    setMessage({
                                      displayed: true,
                                      type: "error",
                                      text: `Error updating Rebate ${bap.rebateId}. Please try again.`,
                                    });
                                  });
                              }}
                            >
                              <span className="display-flex flex-align-center">
                                <svg
                                  className="usa-icon"
                                  aria-hidden="true"
                                  focusable="false"
                                  role="img"
                                >
                                  <use href={`${icons}#edit`} />
                                </svg>
                                <span className="margin-left-1">Edit</span>
                              </span>
                            </button>
                          ) : enrollmentClosed || state === "submitted" ? (
                            <Link
                              to={`/rebate/${_id}`}
                              className="usa-button usa-button--base font-sans-2xs margin-right-0 padding-x-105 padding-y-1"
                            >
                              <span className="display-flex flex-align-center">
                                <svg
                                  className="usa-icon"
                                  aria-hidden="true"
                                  focusable="false"
                                  role="img"
                                >
                                  <use href={`${icons}#visibility`} />
                                </svg>
                                <span className="margin-left-1">View</span>
                              </span>
                            </Link>
                          ) : state === "draft" ? (
                            <Link
                              to={`/rebate/${_id}`}
                              className="usa-button font-sans-2xs margin-right-0 padding-x-105 padding-y-1"
                            >
                              <span className="display-flex flex-align-center">
                                <svg
                                  className="usa-icon"
                                  aria-hidden="true"
                                  focusable="false"
                                  role="img"
                                >
                                  <use href={`${icons}#edit`} />
                                </svg>
                                <span className="margin-left-1">Edit</span>
                              </span>
                            </Link>
                          ) : null}
                        </th>

                        <td className={statusStyles}>
                          {bap.rebateId ? (
                            <span title={`Application ID: ${_id}`}>
                              {bap.rebateId}
                            </span>
                          ) : (
                            <TextWithTooltip
                              text=" "
                              tooltip="Rebate ID should be displayed within 24hrs. after starting a new rebate form application"
                            />
                          )}
                        </td>

                        <td className={statusStyles}>
                          <span>Application</span>
                          <br />
                          <span className="display-flex flex-align-center font-sans-2xs">
                            <svg
                              className="usa-icon"
                              aria-hidden="true"
                              focusable="false"
                              role="img"
                            >
                              <use
                                href={
                                  submissionNeedsEdits
                                    ? `${icons}#priority_high`
                                    : submissionHasBeenWithdrawn
                                    ? `${icons}#close`
                                    : state === "submitted"
                                    ? `${icons}#check`
                                    : state === "draft"
                                    ? `${icons}#more_horiz`
                                    : `${icons}#remove` // fallback, not used
                                }
                              />
                            </svg>
                            <span className="margin-left-05">
                              {
                                submissionNeedsEdits ||
                                submissionHasBeenWithdrawn
                                  ? bap.rebateStatus
                                  : state === "draft"
                                  ? "Draft"
                                  : state === "submitted"
                                  ? "Submitted"
                                  : state // fallback, not used
                              }
                            </span>
                          </span>
                        </td>

                        <td className={statusStyles}>
                          <>
                            {Boolean(applicantUEI) ? (
                              applicantUEI
                            ) : (
                              <TextWithTooltip
                                text=" "
                                tooltip="Please edit and save the form and the UEI will be displayed"
                              />
                            )}
                            <br />
                            {
                              /* NOTE:
Initial version of the application form definition included the `applicantEfti`
field, which is configured via the form definition (in Formio/Forms.gov) to set
its value based on the value of the `sam_hidden_applicant_efti` field, which we
inject on initial form submission. That value comes from the BAP (SAM.gov data),
which could be an empty string.

To handle the potentially empty string, the Formio form definition was updated
to include a new `applicantEfti_display` field that's configured in the form
definition to set it's value to the string '0000' if the `applicantEfti` field's
value is an empty string. This logic (again, built into the form definition)
works great for new form submissions that have taken place after the form
definition has been updated to include this `applicantEfti_display` field... */
                              Boolean(applicantEfti_display) ? (
                                applicantEfti_display
                              ) : /* NOTE:
...but we need to handle old/existing submissions that were submitted before the
form definition was updated to include the new `applicantEfti_display` field,
and where the user has already advanced past the first screen (e.g. they've hit
the "Next" or "Save" buttons at least once).

At this point the form definition logic has already kicked in that sets the
`applicaitonEfti` field, but it's value _could_ be an empty string (it won't
necessairly be, but it could be). Since the `applicantEfti` field's value could
be an empty string (which is falsy in JavaScript), we need to check another
field's value that will also set at this point, and whose value will always be
truthy. We'll check the `applicantUEI` field's value, as it's value will always
be set for users that have advanced past the first screen (we could have just as
easily used another field, like the `applicantOrganizationName` field for the
same result). */
                              Boolean(applicantUEI) ? (
                                /* NOTE:
If the `applicantUEI` field's value is truthy, we know the user has advanced
past the first screen, so we'll render the value of the `applicantEfti` field,
and fall back to "0000", which will be used in cases where the `applicantEfti`
field's value is an empty string. */
                                applicantEfti || "0000"
                              ) : (
                                /* NOTE:
At this point in the conditional logic, we know the user has not advanced past
the first screen, so we'll render the tooltip, indicating the user must edit and
save the form for the EFT indicator to be displayed. */
                                <TextWithTooltip
                                  text=" "
                                  tooltip="Please edit and save the form and the EFT Indicator will be displayed"
                                />
                              )
                            }
                          </>
                        </td>

                        <td className={statusStyles}>
                          <>
                            {Boolean(applicantOrganizationName) ? (
                              applicantOrganizationName
                            ) : (
                              <TextWithTooltip
                                text=" "
                                tooltip="Please edit and save the form and the Applicant will be displayed"
                              />
                            )}
                            <br />
                            {Boolean(schoolDistrictName) ? (
                              schoolDistrictName
                            ) : (
                              <TextWithTooltip
                                text=" "
                                tooltip="School District will be displayed after that field has been entered in the form"
                              />
                            )}
                          </>
                        </td>

                        <td className={statusStyles}>
                          {last_updated_by}
                          <br />
                          <span title={`${date} ${time}`}>{date}</span>
                        </td>
                      </tr>

                      {submissionHasBeenSelected && (
                        <tr className="bg-gray-5">
                          <th scope="row" colSpan={6}>
                            <button
                              className="usa-button font-sans-2xs margin-right-0 padding-x-105 padding-y-1"
                              onClick={(ev) => {
                                if (!bap.rebateId || !entity) return;

                                const userInfo = getUserInfo(email, entity);

                                // clear out existing message
                                setMessage({
                                  displayed: false,
                                  type: "info",
                                  text: "",
                                });

                                postData(
                                  `${serverUrl}/api/formio-payment-request-submission/`,
                                  {
                                    email,
                                    title: userInfo.title,
                                    name: userInfo.name,
                                    comboKey: bap.comboKey,
                                    rebateId: bap.rebateId, // CSB Rebate ID (6 digits)
                                    reviewItemId: bap.reviewItemId, // CSB Rebate ID w/ form/version ID (9 digits)
                                  }
                                )
                                  .then((res) => {
                                    navigate(
                                      `/payment-request/${bap.rebateId}`
                                    );
                                  })
                                  .catch((err) => {
                                    setMessage({
                                      displayed: true,
                                      type: "error",
                                      text: `Error updating Rebate ${bap.rebateId}. Please try again.`,
                                    });
                                  });
                              }}
                            >
                              <span className="display-flex flex-align-center">
                                <svg
                                  className="usa-icon"
                                  aria-hidden="true"
                                  focusable="false"
                                  role="img"
                                >
                                  <use href={`${icons}#add_circle`} />
                                </svg>
                                <span className="margin-left-1">
                                  New Payment Request
                                </span>
                              </span>
                            </button>
                          </th>
                        </tr>
                      )}

                      {
                        /* empty row after each submission but the last one */
                        index !== submissions.length - 1 && (
                          <tr className="bg-white">
                            <th className="p-0" colSpan={6}>
                              &nbsp;
                            </th>
                          </tr>
                        )
                      }
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {message.displayed && (
            <Message type={message.type} text={message.text} />
          )}
        </>
      )}

      {content.status === "success" && (
        <div className="margin-top-4 padding-2 padding-bottom-0 border-1px border-base-lighter bg-base-lightest">
          <MarkdownContent children={content.data?.allRebatesOutro || ""} />
        </div>
      )}
    </>
  );
}
