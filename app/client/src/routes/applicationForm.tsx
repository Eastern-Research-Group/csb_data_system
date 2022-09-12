import {
  Dispatch,
  ReactNode,
  createContext,
  useContext,
  useReducer,
  useEffect,
  useState,
  useRef,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Formio, Form } from "@formio/react";
import { cloneDeep, isEqual } from "lodash";
import icons from "uswds/img/sprite.svg";
// ---
import { serverUrl, getData, postData } from "../config";
import { getUserInfo } from "../utilities";
import { Loading } from "components/loading";
import { Message } from "components/message";
import { MarkdownContent } from "components/markdownContent";
import { useContentState } from "contexts/content";
import { useUserState } from "contexts/user";
import { useBapState } from "contexts/bap";

// -----------------------------------------------------------------------------

type Props = {
  children: ReactNode;
};

type State = {
  displayed: boolean;
  type: "info" | "success" | "warning" | "error";
  text: string;
};

type Action =
  | {
      type: "DISPLAY_INFO_MESSAGE";
      payload: { text: string };
    }
  | {
      type: "DISPLAY_SUCCESS_MESSAGE";
      payload: { text: string };
    }
  | {
      type: "DISPLAY_WARNING_MESSAGE";
      payload: { text: string };
    }
  | {
      type: "DISPLAY_ERROR_MESSAGE";
      payload: { text: string };
    }
  | { type: "RESET_MESSAGE" };

const StateContext = createContext<State | undefined>(undefined);
const DispatchContext = createContext<Dispatch<Action> | undefined>(undefined);

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "DISPLAY_INFO_MESSAGE": {
      const { text } = action.payload;
      return {
        ...state,
        displayed: true,
        type: "info",
        text,
      };
    }

    case "DISPLAY_SUCCESS_MESSAGE": {
      const { text } = action.payload;
      return {
        ...state,
        displayed: true,
        type: "success",
        text,
      };
    }

    case "DISPLAY_WARNING_MESSAGE": {
      const { text } = action.payload;
      return {
        ...state,
        displayed: true,
        type: "warning",
        text,
      };
    }

    case "DISPLAY_ERROR_MESSAGE": {
      const { text } = action.payload;
      return {
        ...state,
        displayed: true,
        type: "error",
        text,
      };
    }

    case "RESET_MESSAGE": {
      return {
        ...state,
        displayed: false,
        type: "info",
        text: "",
      };
    }

    default: {
      const message = `Unhandled action type: ${action}`;
      throw new Error(message);
    }
  }
}

function ApplicationFormProvider({ children }: Props) {
  const initialState: State = {
    displayed: false,
    type: "info",
    text: "",
  };

  const [state, dispatch] = useReducer(reducer, initialState);

  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>
        {children}
      </DispatchContext.Provider>
    </StateContext.Provider>
  );
}

/**
 * Returns state stored in `ApplicationFormProvider` context component.
 */
function useApplicationFormState() {
  const context = useContext(StateContext);
  if (context === undefined) {
    const message = `useApplicationFormState must be called within a ApplicationFormProvider`;
    throw new Error(message);
  }
  return context;
}

/**
 * Returns `dispatch` method for dispatching actions to update state stored in
 * `ApplicationFormProvider` context component.
 */
function useApplicationFormDispatch() {
  const context = useContext(DispatchContext);
  if (context === undefined) {
    const message = `useApplicationFormDispatch must be used within a ApplicationFormProvider`;
    throw new Error(message);
  }
  return context;
}

// -----------------------------------------------------------------------------

export function ApplicationForm() {
  return (
    <ApplicationFormProvider>
      <ApplicationFormContent />
    </ApplicationFormProvider>
  );
}

// -----------------------------------------------------------------------------

type FormioSubmissionData = {
  [field: string]: unknown;
  hidden_current_user_email?: string;
  hidden_current_user_title?: string;
  hidden_current_user_name?: string;
  bap_hidden_entity_combo_key?: string;
  ncesDataSource?: string;
  ncesDataLookup?: string[];
};

type SubmissionState =
  | {
      status: "idle";
      data: {
        userAccess: false;
        formSchema: null;
        submissionData: null;
      };
    }
  | {
      status: "pending";
      data: {
        userAccess: false;
        formSchema: null;
        submissionData: null;
      };
    }
  | {
      status: "success";
      data:
        | {
            userAccess: true;
            formSchema: { url: string; json: object };
            submissionData: {
              [field: string]: unknown;
              _id: string; // MongoDB ObjectId string
              data: object;
              state: "submitted" | "draft";
            };
          }
        | {
            userAccess: false;
            formSchema: null;
            submissionData: null;
          };
    }
  | {
      status: "failure";
      data: {
        userAccess: false;
        formSchema: null;
        submissionData: null;
      };
    };

function FormMessage() {
  const { displayed, type, text } = useApplicationFormState();
  if (!displayed) return null;
  return <Message type={type} text={text} />;
}

function ApplicationFormContent() {
  const navigate = useNavigate();
  const { id } = useParams<"id">();
  const { content } = useContentState();
  const { csbData, epaUserData } = useUserState();
  const { samEntities, applicationSubmissions: bapApplicationSubmissions } =
    useBapState();
  const dispatch = useApplicationFormDispatch();

  const [formioApplicationSubmission, setFormioApplicationSubmission] =
    useState<SubmissionState>({
      status: "idle",
      data: {
        userAccess: false,
        formSchema: null,
        submissionData: null,
      },
    });

  // set when application form submission data is initially fetched, and then
  // re-set each time a successful update of the submission data is posted to
  // forms.gov
  const [storedSubmissionData, setStoredSubmissionData] =
    useState<FormioSubmissionData>({});

  // create ref to storedSubmissionData, so the latest value can be referenced
  // in the Form component's `onNextPage` event prop
  const storedSubmissionDataRef = useRef(storedSubmissionData);

  // initially empty, but will be set once the user attemts to submit the form
  // (both successfully and unsuccessfully). passed to the to the <Form />
  // component's submission prop, so the fields the user filled out will not be
  // lost if a submission update fails, so the user can attempt submitting again
  const [pendingSubmissionData, setPendingSubmissionData] =
    useState<FormioSubmissionData>({});

  useEffect(() => {
    setFormioApplicationSubmission({
      status: "pending",
      data: {
        userAccess: false,
        formSchema: null,
        submissionData: null,
      },
    });

    getData(`${serverUrl}/api/formio-application-submission/${id}`)
      .then((res) => {
        // set up s3 re-route to wrapper app
        const s3Provider = Formio.Providers.providers.storage.s3;
        Formio.Providers.providers.storage.s3 = function (formio: any) {
          const s3Formio = cloneDeep(formio);
          const comboKey = res.submissionData.data.bap_hidden_entity_combo_key;
          s3Formio.formUrl = `${serverUrl}/api/${id}/${comboKey}`;
          return s3Provider(s3Formio);
        };

        // remove `ncesDataSource` and `ncesDataLookup` fields
        const data = { ...res.submissionData.data };
        if (data.hasOwnProperty("ncesDataSource")) {
          delete data.ncesDataSource;
        }
        if (data.hasOwnProperty("ncesDataLookup")) {
          delete data.ncesDataLookup;
        }

        setStoredSubmissionData((prevData) => {
          storedSubmissionDataRef.current = data;
          return data;
        });

        setFormioApplicationSubmission({
          status: "success",
          data: res,
        });
      })
      .catch((err) => {
        setFormioApplicationSubmission({
          status: "failure",
          data: {
            userAccess: false,
            formSchema: null,
            submissionData: null,
          },
        });
      });
  }, [id]);

  if (formioApplicationSubmission.status === "idle") {
    return null;
  }

  if (formioApplicationSubmission.status === "pending") {
    return <Loading />;
  }

  const { userAccess, formSchema, submissionData } =
    formioApplicationSubmission.data;

  if (
    formioApplicationSubmission.status === "failure" ||
    !userAccess ||
    !formSchema ||
    !submissionData
  ) {
    return (
      <Message
        type="error"
        text="The requested submission does not exist, or you do not have access. Please contact support if you believe this is a mistake."
      />
    );
  }

  if (
    csbData.status !== "success" ||
    epaUserData.status !== "success" ||
    samEntities.status !== "success" ||
    bapApplicationSubmissions.status !== "success"
  ) {
    return <Loading />;
  }

  const { enrollmentClosed } = csbData.data;

  const match = bapApplicationSubmissions.data.find((bapSubmission) => {
    return bapSubmission.CSB_Form_ID__c === id;
  });

  const bap = {
    lastModified: match?.CSB_Modified_Full_String__c || null,
    rebateId: match?.Parent_Rebate_ID__c || null,
    rebateStatus: match?.Parent_CSB_Rebate__r?.CSB_Rebate_Status__c || null,
  };

  const submissionNeedsEdits = bap.rebateStatus === "Edits Requested";

  const entityComboKey = storedSubmissionData.bap_hidden_entity_combo_key;
  const entity = samEntities.data.entities.find((entity) => {
    return (
      entity.ENTITY_STATUS__c === "Active" &&
      entity.ENTITY_COMBO_KEY__c === entityComboKey
    );
  });

  if (!entity) return null;

  const email = epaUserData.data.mail;
  const { title, name } = getUserInfo(email, entity);

  return (
    <div className="margin-top-2">
      {content.status === "success" && (
        <MarkdownContent
          className="margin-top-4"
          children={
            submissionData.state === "draft"
              ? content.data?.draftApplicationIntro || ""
              : submissionData.state === "submitted"
              ? content.data?.submittedApplicationIntro || ""
              : ""
          }
        />
      )}

      <FormMessage />

      <ul className="usa-icon-list">
        <li className="usa-icon-list__item">
          <div className="usa-icon-list__icon text-primary">
            <svg className="usa-icon" aria-hidden="true" role="img">
              <use href={`${icons}#local_offer`} />
            </svg>
          </div>
          <div className="usa-icon-list__content">
            <strong>Application ID:</strong> {submissionData._id}
          </div>
        </li>

        {bap.rebateId && (
          <li className="usa-icon-list__item">
            <div className="usa-icon-list__icon text-primary">
              <svg className="usa-icon" aria-hidden="true" role="img">
                <use href={`${icons}#local_offer`} />
              </svg>
            </div>
            <div className="usa-icon-list__content">
              <strong>Rebate ID:</strong> {bap.rebateId}
            </div>
          </li>
        )}
      </ul>

      <div className="csb-form">
        <Form
          form={formSchema.json}
          url={formSchema.url} // NOTE: used for file uploads
          submission={{
            data: {
              ...storedSubmissionData,
              last_updated_by: email,
              hidden_current_user_email: email,
              hidden_current_user_title: title,
              hidden_current_user_name: name,
              ...pendingSubmissionData,
            },
          }}
          options={{
            readOnly:
              (enrollmentClosed && !submissionNeedsEdits) ||
              submissionData.state === "submitted"
                ? true
                : false,
            noAlerts: true,
          }}
          onChange={(submission: {
            changed: {
              component: {
                [field: string]: unknown;
                key: string;
              };
              flags: unknown;
              instance: unknown;
              value: unknown;
            };
            data: FormioSubmissionData;
            isValid: boolean;
            metadata: unknown;
          }) => {
            // NOTE: For some unknown reason, whenever the bus info's "Save"
            // button (the component w/ the key "busInformation") is clicked
            // the `storedSubmissionDataRef` value is mutated, which invalidates
            // the isEqual() early return "dirty check" used in the onNextPage
            // event callback below (as the two object being compared are now
            // equal). That means if the user changed any of the bus info fields
            // (which are displayed via a Formio "Edit Grid" component, which
            // includes its own "Save" button that must be clicked) and clicked
            // the form's "Next" button without making any other form field
            // changes, the "dirty check" incorrectly fails, and the updated
            // form data was not posted. The fix below should resolve that issue
            // as now we're intentionally mutating the `storedSubmissionDataRef`
            // to an empty object whenever the Edit Grid's "Save" button is
            // clicked (which must be clicked to close the bus info fields) to
            // guarantee the "dirty check" succeeds the next time the form's
            // "Next" button is clicked.
            if (submission?.changed?.component?.key === "busInformation") {
              storedSubmissionDataRef.current = {};
            }
          }}
          onSubmit={(submission: {
            state: "submitted" | "draft";
            data: FormioSubmissionData;
            metadata: unknown;
          }) => {
            // remove `ncesDataSource` and `ncesDataLookup` fields
            const data = { ...submission.data };
            if (data.hasOwnProperty("ncesDataSource")) {
              delete data.ncesDataSource;
            }
            if (data.hasOwnProperty("ncesDataLookup")) {
              delete data.ncesDataLookup;
            }

            if (submission.state === "submitted") {
              dispatch({
                type: "DISPLAY_INFO_MESSAGE",
                payload: { text: "Submitting form..." },
              });
            }

            if (submission.state === "draft") {
              dispatch({
                type: "DISPLAY_INFO_MESSAGE",
                payload: { text: "Saving form..." },
              });
            }

            setPendingSubmissionData(data);

            postData(
              `${serverUrl}/api/formio-application-submission/${submissionData._id}`,
              { ...submission, data }
            )
              .then((res) => {
                setStoredSubmissionData((prevData) => {
                  storedSubmissionDataRef.current = res.data;
                  return res.data;
                });

                setPendingSubmissionData({});

                if (submission.state === "submitted") {
                  dispatch({
                    type: "DISPLAY_SUCCESS_MESSAGE",
                    payload: { text: "Form successfully submitted." },
                  });

                  setTimeout(() => {
                    dispatch({ type: "RESET_MESSAGE" });
                    navigate("/");
                  }, 5000);
                  return;
                }

                if (submission.state === "draft") {
                  dispatch({
                    type: "DISPLAY_SUCCESS_MESSAGE",
                    payload: { text: "Draft successfully saved." },
                  });

                  setTimeout(() => {
                    dispatch({ type: "RESET_MESSAGE" });
                  }, 5000);
                }
              })
              .catch((err) => {
                dispatch({
                  type: "DISPLAY_ERROR_MESSAGE",
                  payload: { text: "Error submitting application form." },
                });
              });
          }}
          onNextPage={({
            page,
            submission,
          }: {
            page: number;
            submission: {
              data: FormioSubmissionData;
              metadata: unknown;
            };
          }) => {
            // remove `ncesDataSource` and `ncesDataLookup` fields
            const data = { ...submission.data };
            if (data.hasOwnProperty("ncesDataSource")) {
              delete data.ncesDataSource;
            }
            if (data.hasOwnProperty("ncesDataLookup")) {
              delete data.ncesDataLookup;
            }

            // don't post an update if form is not in draft state
            // (form has been already submitted, and fields are read-only)
            if (submissionData.state !== "draft") return;

            // don't post an update if no changes have been made to the form
            // (ignoring current user fields)
            const dataToCheck = { ...data };
            delete dataToCheck.hidden_current_user_email;
            delete dataToCheck.hidden_current_user_title;
            delete dataToCheck.hidden_current_user_name;
            const storedDataToCheck = { ...storedSubmissionDataRef.current };
            delete storedDataToCheck.hidden_current_user_email;
            delete storedDataToCheck.hidden_current_user_title;
            delete storedDataToCheck.hidden_current_user_name;
            if (isEqual(dataToCheck, storedDataToCheck)) return;

            dispatch({
              type: "DISPLAY_INFO_MESSAGE",
              payload: { text: "Saving form..." },
            });

            setPendingSubmissionData(data);

            postData(
              `${serverUrl}/api/formio-application-submission/${submissionData._id}`,
              { ...submission, data, state: "draft" }
            )
              .then((res) => {
                setStoredSubmissionData((prevData) => {
                  storedSubmissionDataRef.current = res.data;
                  return res.data;
                });

                setPendingSubmissionData({});

                dispatch({
                  type: "DISPLAY_SUCCESS_MESSAGE",
                  payload: { text: "Draft successfully saved." },
                });

                setTimeout(() => {
                  dispatch({ type: "RESET_MESSAGE" });
                }, 5000);
              })
              .catch((err) => {
                dispatch({
                  type: "DISPLAY_ERROR_MESSAGE",
                  payload: { text: "Error saving draft application form." },
                });
              });
          }}
        />
      </div>

      <FormMessage />
    </div>
  );
}