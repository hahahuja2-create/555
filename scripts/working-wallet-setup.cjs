'use strict';

const path = require('node:path');
const { maskedBackupPassword } = require('../payments/private-terminal');
const { provisionWorkingWallet } = require('../payments/working-wallet');

async function main() {
  if (!process.stdin.isTTY || !process.stdout.isTTY || process.platform !== 'win32' || !process.env.LOCALAPPDATA) throw new Error('PRIVATE_WINDOWS_TERMINAL_REQUIRED');
  console.log('Creates a new independent TRON working wallet and a password-encrypted recovery file.');
  console.log('No funds will be transferred, no live settings will change, and no secret will be printed.');
  console.log('Choose a private backup password in the masked dialog. Never share it in chat.');
  const password = await maskedBackupPassword('new');
  const result = await provisionWorkingWallet({ directory: path.join(process.env.LOCALAPPDATA, 'Portgainy', 'working-wallet'), password });
  console.log('Working wallet address:', result.address);
  console.log('Password-encrypted recovery file:', result.backup);
  console.log('Copy the encrypted recovery file to separate safe storage; keep its password separately.');
  console.log('This wallet is not connected to production or enabled for automatic payments.');
}

main().catch(error => {
  const safe = ['PRIVATE_WINDOWS_TERMINAL_REQUIRED', 'WORKING_WALLET_ALREADY_EXISTS', 'WORKING_WALLET_PASSWORD_TOO_WEAK', 'WORKING_WALLET_RECOVERY_FAILED', 'BACKUP_PASSWORD_ENTRY_CANCELLED', 'BACKUP_PASSWORD_DIALOG_FAILED', 'BACKUP_PASSWORD_DIALOG_TIMED_OUT', 'BACKUP_PASSWORD_TOO_WEAK'];
  console.error('Working wallet was not activated:', safe.includes(error.message) ? error.message : 'Setup failed; preserve any encrypted files and check them before retrying.');
  process.exitCode = 1;
});
