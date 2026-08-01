const https = require('https');
const url = 'https://surname-accurately-york-comments.trycloudflare.com/api/instagram/webhook';
console.log('Testing tunnel:', url);
const req = https.get(url, { timeout: 10000 }, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Body:', data);
    console.log('TUNNEL IS ALIVE!');
  });
});
req.on('error', (err) => {
  console.log('ERROR:', err.message);
  console.log('TUNNEL IS DEAD!');
});
req.on('timeout', () => {
  console.log('TIMEOUT - TUNNEL IS DEAD!');
  req.destroy();
});
