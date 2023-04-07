const fs = require("fs");
const mkcert = require('mkcert');

// create a certificate authority
mkcert.createCA({
  organization: 'Hello CA',
  countryCode: 'JP',
  state: 'Kochi',
  locality: 'Kochi',
  validityDays: 365
}).then(async ca => {
  // then create a tls certificate
  const cert = await mkcert.createCert({
    domains: ['127.0.0.1', 'localhost'],
    validityDays: 365,
    caKey: ca.key,
    caCert: ca.cert
  });
  console.log(cert.key, cert.cert);

  fs.writeFileSync('./env/cert-key.pem', ca.key);
  fs.writeFileSync('./env/cert.pem', ca.cert);
}).catch(console.error);
