describe('Routes', () => {
  // TODO Remove this when the app is more stable
  Cypress.on('uncaught:exception', (_err, _runnable) => {
    // returning false here prevents Cypress from
    // failing the test
    debugger;
    return false;
  });

  let formId = '';
  const loadingSpinnerText = 'Loading...';
  const loggedOutMessage = 'You have successfully logged out.';

  before(() => {
    cy.loginToCSB('csbtest');
    cy.findByText('Your Rebate Forms');

    // get a formId from an existing application by visiting the first submitted
    // application
    cy.findAllByText('submitted')
      .first()
      .parent()
      .within(($row) => {
        cy.wrap($row)
          .get('th,td')
          .then(($cols) => {
            cy.wrap($cols[0]).click();
          });
      });

    // verify the tab loaded
    cy.contains('1 of 6 Welcome');

    // extract the form id
    cy.get('body').then(($body) => {
      const elm = $body.find("h3:contains('Application ID:')")[0];
      formId = elm.innerText.replace('Application ID: ', '');
    });

    // sign out
    cy.findByText('Sign out').click();
  });

  it('Test a route that is not found', () => {
    cy.loginToCSB('csbtest');
    cy.findByText('Your Rebate Forms');

    cy.visit('/testing-not-found');

    cy.findByText('Your Rebate Forms');
  });

  it('Navigate directly to an existing application', () => {
    cy.loginToCSB('csbtest');
    cy.findByText('Your Rebate Forms');

    cy.visit(`/rebate/${formId}`);

    cy.findAllByText(loadingSpinnerText).should('be.visible');

    cy.findByText('View Your Submitted Rebate Application');
  });

  it('Navigate directly to an existing application without being logged in', () => {
    cy.loginToCSB('csbtest');
    cy.findByText('csb-test@erg.com');

    // Sign out
    cy.findByText('Sign out').click();
    cy.findByText(loggedOutMessage);

    // verify the appropriate error message is displayed
    cy.visit(`/rebate/${formId}`);
    cy.contains(
      'Click the Sign in button below to login to the Clean School Bus Rebate Dashboard using Login.gov.',
    );
  });

  it('Navigate directly to an existing application without appropriate access rights', () => {
    cy.loginToCSB('csbtest');
    cy.findByText('Your Rebate Forms');

    // simulate the rebate-form-submission where user does not have access
    const origin =
      location.hostname === 'localhost'
        ? `${location.protocol}//${location.hostname}:3001`
        : window.location.origin;
    cy.intercept(`${origin}/api/rebate-form-submission/${formId}`, {
      statusCode: 200,
      body: {
        formSchema: {
          json: {},
          url: '',
        },
        submissionData: {
          access: [],
        },
        userAccess: false,
      },
    }).as('rebate-form-submission');

    // verify the appropriate message is displayed
    cy.visit(`/rebate/${formId}`);
    cy.findByText(
      'The requested submission does not exist, or you do not have access. Please contact support if you believe this is a mistake.',
    );
  });

  it('Navigate directly to an existing application and simulate a service failure', () => {
    cy.loginToCSB('csbtest');
    cy.findByText('Your Rebate Forms');

    // simulate the rebate-form-submission service failing
    const origin =
      location.hostname === 'localhost'
        ? `${location.protocol}//${location.hostname}:3001`
        : window.location.origin;
    cy.intercept(`${origin}/api/rebate-form-submission/${formId}`, {
      statusCode: 500,
      body: {},
    }).as('rebate-form-submission');

    // verify the appropriate error message is displayed
    cy.visit(`/rebate/${formId}`);
    cy.findByText(
      'The requested submission does not exist, or you do not have access. Please contact support if you believe this is a mistake.',
    );
  });

  it('Navigate directly to the helpdesk', () => {
    cy.loginToCSB('csbtest8');
    cy.findByText('Your Rebate Forms');

    cy.visit('/helpdesk');

    cy.findAllByText(loadingSpinnerText).should('be.visible');

    cy.findByText('Change Rebate Form Submission State');
  });

  it('Navigate directly to the helpdesk without being logged in', () => {
    cy.loginToCSB('csbtest8');
    cy.findByText('csb-test8@erg.com');

    // Sign out
    cy.findByText('Sign out').click();
    cy.findByText(loggedOutMessage);

    // verify the appropriate error message is displayed
    cy.visit('/helpdesk');
    cy.contains(
      'Click the Sign in button below to login to the Clean School Bus Rebate Dashboard using Login.gov.',
    );
  });

  it('Navigate directly to the helpdesk without appropriate access rights', () => {
    cy.loginToCSB('csbtest');
    cy.findByText('Your Rebate Forms');

    // verify the helpdesk is not available
    cy.visit('/helpdesk');
    cy.findByText('Helpdesk').should('not.exist');
    cy.findByText('Change Rebate Form Submission State').should('not.exist');
  });

  it('Navigate directly to the helpdesk and simulate a service failure', () => {
    cy.loginToCSB('csbtest8');
    cy.findByText('csb-test8@erg.com');

    // simulate the helpdesk-access service failing
    const origin =
      location.hostname === 'localhost'
        ? `${location.protocol}//${location.hostname}:3001`
        : window.location.origin;
    cy.intercept(`${origin}/api/helpdesk-access`, {
      statusCode: 500,
      body: {},
    }).as('helpdesk-access');

    // verify the helpdesk is not available
    cy.visit('/helpdesk');
    cy.findByText('Helpdesk').should('not.exist');
    cy.findByText('Change Rebate Form Submission State').should('not.exist');
  });
});