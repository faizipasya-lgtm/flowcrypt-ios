import { join } from 'path';
import { config } from './wdio.shared.conf';

// POC config v2: UDID eksplisit via POC_DEVICE_UDID (hindari parsing platformVersion),
// spec dari folder poc, app path dari env APP_PATH.
config.suites = {
  poc: ['./tests/specs/mock/poc/*.spec.ts'],
};

config.capabilities = [
  {
    platformName: 'iOS',
    maxInstances: 1,
    hostname: '127.0.0.1',
    'appium:automationName': 'XCUITest',
    'appium:processArguments': {
      args: ['--mock-fes-api', '--mock-attester-api', '--mock-gmail-api'],
    },
    'appium:locale': 'en_US',
    'appium:deviceName': process.env.POC_DEVICE_NAME || 'iPhone 16',
    ...(process.env.POC_DEVICE_UDID ? { 'appium:udid': process.env.POC_DEVICE_UDID } : {}),
    'appium:orientation': 'PORTRAIT',
    'appium:app': process.env.APP_PATH || join(process.cwd(), './FlowCrypt.app'),
    'appium:simulatorStartupTimeout': 600000,
    // WDA di-compile Appium saat session pertama (5-10 mnt di CI) - client jangan abort duluan
    connectionRetryTimeout: 1200000,
    connectionRetryCount: 2,
    waitforTimeout: 30000,
    'appium:wdaLaunchTimeout': 600000,
    'appium:wdaConnectionTimeout': 600000,
    'appium:wdaStartupRetryInterval': 120000,
    // WDA prebuilt (signing dimatikan di workflow) -> hindari xcodebuild exit 65
    ...(process.env.WDA_PREBUILT_ROOT
      ? {
          'appium:usePrebuiltWDA': true,
          'appium:derivedDataPath': process.env.WDA_PREBUILT_ROOT,
          'appium:showXcodeLog': true,
        }
      : {}),
    // app (splash + animasi) tidak pernah "idle" dalam 10s default -> jangan tunggu idle
    'appium:waitForIdleTimeout': 0,
    'appium:launchTimeout': 600000,
    'appium:forceAppLaunch': true,
    'appium:reduceMotion': true,
  } as any,
];

exports.config = config;
