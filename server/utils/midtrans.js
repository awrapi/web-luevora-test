import midtransClient from 'midtrans-client';
import 'dotenv/config';

// Initialize CoreApi and Snap
export const snap = new midtransClient.Snap({
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
  serverKey: process.env.MIDTRANS_SERVER_KEY || 'sandbox_server_key',
  clientKey: process.env.MIDTRANS_CLIENT_KEY || 'sandbox_client_key'
});
