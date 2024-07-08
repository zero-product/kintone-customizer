const fs = require("fs");
const { createCA, createCert } = require('mkcert');

// create a certificate authority
createCA({
  organization: 'kintone CA',
  countryCode: "JP",
  state: "Kochi",
  locality: "Kochi",
  validity: 365
}).then(ca => {
  // then create a tls certificate
  createCert({
    ca: { key: ca.key, cert: ca.cert },
    domains: ['127.0.0.1', 'localhost'],
    validity: 365,
  }).then(cert => {
    if (!fs.existsSync('cert')) fs.mkdirSync('cert');

    fs.writeFileSync('./cert/cert-key.pem', cert.key);
    fs.writeFileSync('./cert/cert.pem', cert.cert);
  }).catch(e => {
    console.error(e)
    process.exit(1)
  })
  // console.log(cert.key, cert.cert);
}).catch(e => {
  console.error(e)
  process.exit(1)
});