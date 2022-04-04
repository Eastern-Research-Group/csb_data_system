import { useEffect } from "react";
import { Link } from "react-router-dom";
import icons from "uswds/img/sprite.svg";
// ---
import { serverUrl, fetchData } from "../config";
import Loading from "components/loading";
import Message from "components/message";
import MarkdownContent from "components/markdownContent";
import { TextWithTooltip } from "components/infoTooltip";
import { useContentState } from "contexts/content";
import { useFormsState, useFormsDispatch } from "contexts/forms";

export default function AllRebateForms() {
  const { content } = useContentState();
  const { rebateFormSubmissions } = useFormsState();
  const dispatch = useFormsDispatch();

  useEffect(() => {
    dispatch({ type: "FETCH_REBATE_FORM_SUBMISSIONS_REQUEST" });

    fetchData(`${serverUrl}/api/v1/rebate-form-submissions`)
      .then((res) => {
        dispatch({
          type: "FETCH_REBATE_FORM_SUBMISSIONS_SUCCESS",
          payload: { rebateFormSubmissions: res },
        });
      })
      .catch((err) => {
        dispatch({ type: "FETCH_REBATE_FORM_SUBMISSIONS_FAILURE" });
      });
  }, [dispatch]);

  if (rebateFormSubmissions.status === "idle") {
    return null;
  }

  if (rebateFormSubmissions.status === "pending") {
    return <Loading />;
  }

  if (rebateFormSubmissions.status === "failure") {
    return (
      <Message type="error" text="Error loading rebate form submissions." />
    );
  }

  return (
    <>
      {rebateFormSubmissions.data.length === 0 ? (
        <div className="margin-top-4">
          <Message
            type="info"
            text="Please select the “New Rebate” button above to create your first rebate application."
          />
        </div>
      ) : (
        <>
          {content.status === "success" && (
            <MarkdownContent
              className="margin-top-4"
              children={content.data.allRebateFormsIntro}
            />
          )}

          <table className="usa-table usa-table--borderless usa-table--striped width-full">
            <thead>
              <tr className="font-sans-2xs text-no-wrap">
                <th scope="col">&nbsp;</th>
                <th scope="col">
                  <TextWithTooltip
                    text="Form Type"
                    tooltip="Rebate Application, Payment Request, or Close-Out form"
                  />
                </th>
                <th scope="col">
                  <TextWithTooltip
                    text="UEI"
                    tooltip="Unique Entity ID from SAM.gov"
                  />
                </th>
                <th scope="col">
                  <TextWithTooltip
                    text="EFT"
                    tooltip="Electronic Funds Transfer indicator from SAM.gov"
                  />
                </th>
                <th scope="col">
                  <TextWithTooltip
                    text="UEI Entity Name"
                    tooltip="Entity Name from SAM.gov"
                  />
                </th>
                <th scope="col">School District Name</th>
                <th scope="col">Updated By</th>
                <th scope="col" className="text-right">
                  Updated Date
                </th>
                <th scope="col">
                  <TextWithTooltip text="Status" tooltip="submitted or draft" />
                </th>
              </tr>
            </thead>
            <tbody>
              {rebateFormSubmissions.data.map((submission) => {
                const {
                  _id,
                  formType,
                  uei,
                  eft,
                  ueiEntityName,
                  schoolDistrictName,
                  lastUpdatedBy,
                  lastUpdatedDate,
                  status,
                } = submission;

                return (
                  <tr
                    key={_id}
                    className={
                      status === "submitted" ? "text-italic text-base-dark" : ""
                    }
                  >
                    <th scope="row">
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
                        </span>
                      </Link>
                    </th>
                    <th>{formType}</th>
                    <th>{uei}</th>
                    <td>{eft}</td>
                    <td>{ueiEntityName}</td>
                    <td>{schoolDistrictName}</td>
                    <td>{lastUpdatedBy}</td>
                    <td className="text-right">
                      {new Date(lastUpdatedDate).toLocaleDateString()}
                    </td>
                    <td>{status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}

      {content.status === "success" && (
        <div className="margin-top-4 padding-2 border-1px border-base-lighter bg-base-lightest">
          <MarkdownContent children={content.data.allRebateFormsOutro} />
        </div>
      )}
    </>
  );
}
