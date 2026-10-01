/**
 * FlowCrypt iOS PoC - parameterized driver untuk Finding 1 & Finding 2.
 * Dipanggil wdio dengan env: CRAFTED_SUBJECT, RUNID, MODE (f1|f2)
 * Pesan exported JSON harus sudah di-drop ke exported-messages oleh workflow.
 */

import { SplashScreen, SetupKeyScreen, MailFolderScreen } from '../../../screenobjects/all-screens';

import { MockApi } from 'api-mocks/mock';
import { MockApiConfig } from 'api-mocks/mock-config';
import { MockUserList } from 'api-mocks/mock-data';

const SUBJECT = process.env.CRAFTED_SUBJECT as string;
const MODE = (process.env.POC_MODE || 'f1') as 'f1' | 'f2';

describe('POC: ', () => {
  it(`auto fetch on render (${SUBJECT})`, async () => {
    const mockApi = new MockApi();
    mockApi.fesConfig = MockApiConfig.defaultEnterpriseFesConfiguration;
    mockApi.ekmConfig = MockApiConfig.defaultEnterpriseEkmConfiguration;
    mockApi.addGoogleAccount('e2e.enterprise.test@flowcrypt.com', {
      messages: [SUBJECT],
    });
    mockApi.attesterConfig = {
      servedPubkeys: {
        [MockUserList.e2e.email]: MockUserList.e2e.pub!,
      },
    };

    await mockApi.withMockedApis(async () => {
      await SplashScreen.mockLogin();
      await SetupKeyScreen.setPassPhrase();
      await MailFolderScreen.checkInboxScreen();

      // --- buka thread crafted. Dari sini TANPA tap tambahan apa pun. ---
      await MailFolderScreen.clickOnEmailBySubject(SUBJECT);

      if (MODE === 'f1') {
        // fetch berlangsung saat decrypt/render; tunggu sampai selesai
        await browser.pause(10000);
      } else {
        // f2: server menahan koneksi (dos-hang); Data(contentsOf:) tanpa timeout
        // tidak akan balik. Rekam UI hang ~25 detik lalu hentikan video.
        await browser.pause(25000);
      }
      console.log(`[POC] ${MODE}: selesai menunggu. Cek attacker log utk HIT.`);
    });
  });
});
