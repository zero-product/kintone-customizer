const fs    = require('fs')
const fsx   = require('fs-extra')
const path  = require('path')
const axios = require('axios')
const yargs = require('yargs/yargs');
const lodash = require('lodash')
const formdata = require('form-data');
const { exec } = require('child_process')
const { hideBin } = require('yargs/helpers');
const { build, context }  = require('esbuild');


const mkcert = require('mkcert');
const builder = require('../esbuild.config')

// コマンドライン引数を解析
const argv = yargs(hideBin(process.argv))
  .option('watch', {
    alias: 'w',
    describe: 'Devモード',
    type: 'boolean',
    demandOption: true,
    default: false
  })
  .option('deploy', {
    alias: 'd',
    describe: 'kintone環境へデプロイ',
    type: 'boolean',
    demandOption: true,
    default: false
  })
  .option('port', {
    alias: 'p',
    describe: 'Watcherモード ポート番号',
    type: 'number',
    demandOption: true,
    default: 3000
  })
  .option('env-file', {
    alias: 'e',
    describe: '.envファイルのパス',
    type: 'string',
    demandOption: true,
    default: '.env'
  })
  .option('dist-dir', {
    alias: 'f',
    describe: 'ビルドファイル格納ディレクトリ',
    type: 'string',
    demandOption: true,
    default: 'dist'
  })
  .help()
  .alias('help', 'h')
  .argv;

const outdir  = path.resolve(argv['dist-dir'])
const config  = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'config.json')))
const outfile = `${outdir}/${(config.filename || 'app') + (argv.watch ? '' : '.min')}.js`
const fileExists = (filePath = '') => fs.existsSync(path.resolve(process.cwd(), filePath))
const env = fileExists('.env') ? require('dotenv').config({path: path.resolve(argv['env-file'])}).parsed : {}

const client = axios.create({
  baseURL: config.base_url,
  headers: { 'X-Cybozu-Authorization': Buffer.from(`${config.auth.username}:${config.auth.password}`).toString('base64') }
})

const $builder = lodash.merge({
  entryPoints: [path.resolve('./src/app.js')],
  bundle: true,
  minify: !argv.watch,
  sourcemap: argv.watch,
  outfile,
  pure: ["console.log", "console.info"],
  define: {
    'process.env': JSON.stringify(env),
    'process.env.NODE_ENV': process.env.NODE_ENV || '"development"',
  },
}, builder)

run().then(async _ => {
  if (argv.watch) {
    // パッケージビルド
    const ctx = await context($builder)

    await createCertProcess()

    // watchモード準備
    await ctx.watch()
    console.log('watching...')

    // SSLでローカルサーバ起動
    await ctx.serve({
      port: argv.port,
      host: 'localhost',
      servedir: "/",
      keyfile: path.resolve('./cert/cert-key.pem'),
      certfile: path.resolve('./cert/cert.pem'),
    }).then(server => {
      // manifest.json でデプロイ
      console.log('🔄 Uploading...')
      deployer(argv.watch).then(_ => {
        console.log('✅ Uploaded!')
        console.log(`------------------------------------------------`)
        console.log(`Local  : https://localhost:${server.port}`)
        console.log(`kintone: ${config?.base_url}/k/${config?.app}/`)
        console.log(`------------------------------------------------`)
        openBrowser(`https://${server.host}:${server.port}`);
      })
    })
  } else {
    // パッケージビルド
    console.log('🔨 Building...')
    await build($builder).then(console.log('🏢 Builded!'))

    if (argv.deploy) {
      // manifest.json でデプロイ
      console.log('🔄 Uploading...')
      await deployer(argv.watch)

      console.log('✅ Uploaded!')
    }
  }
}).catch(e => {
  console.log('❌️ Error!')
  console.log(JSON.stringify(e, null, 2))
  process.exit(1)
})

function run() {
  return new Promise((resolve) => {
    if (fs.existsSync(outdir)) {
      fsx.remove(outdir)
      resolve(true)
    } else {
      resolve(false)
    }
  })
}


const deployer = (watch) => {
  return new Promise(async (resolve, reject) => {
    const distDir = argv['dist-dir']

    try {
      const fileList = await new Promise((resolve, reject) => {
        const waitId = setInterval(() => {
          fs.readdir(process.cwd()+'/dist', (err, files) => {
            if (err) reject(err)
            if (files?.length) {
              clearInterval(waitId)
              resolve(files.filter(v => v.endsWith('.css') || v.endsWith('.js')))
            }
          });
        }, 100)
      })

      if ( fileList.length ) {
        const files = await Promise.all(fileList.map(async fileName => await fileUpload(fileName)))

        const $manifest = files.reduce((prev, cur) => {
          const deviceTypes = ['desktop', 'mobile']
          const fileTypes = ['js', 'css']

          deviceTypes.forEach(dType => {
            if (!prev[dType]) prev[dType] = {}
            fileTypes.forEach(fType => {
              if (!prev[dType][fType]) prev[dType][fType] = []
            })
          })

          if (config.desktop !== false) {
            prev.desktop[cur.type].push(cur.data)
          }

          if (config.mobile !== false) {
            prev.mobile[cur.type].push(cur.data)
          }
          return prev
        }, {})

        try {
          console.log('⏫️ Deployment start');
          await client.put(`/k/v1/preview/app/customize.json`, {
            app: config.app,
            scope: config.scope,
            ...$manifest,
          }).then(async resp => {
            await client.post(`/k/v1/preview/app/deploy.json`, {
              apps: [{ app: config.app }]
            })
            return resp
          }).then(async _ => {
            while (true) {
              try {
                const { data: deploying } = await client.get(`/k/v1/preview/app/deploy.json`, {
                  params: { apps: {0: config.app } }
                });

                const [app] = deploying.apps
                console.log('🔁 Deploying...');

                if (app.status !== 'PROCESSING') {
                  switch(app.status) {
                    case 'SUCCESS': console.log('✅️ Deployment succeed!');    break;
                    case 'CANCEL' : console.log('🚫 Deployment cancelled!');  break;
                    case 'FAIL'   : console.log('❌ Deployment failed!');     break;
                  }
                  break; // ループを終了
                }
              } catch (error) {
                console.log('❌ Deployment failed!');
                console.error(error.response.status, error.response.data);
                break; // エラーが発生した場合、ループを終了
              }
              await new Promise(resolve => setTimeout(resolve, 2000));
            }

            resolve()
          })
        } catch(e) {
          console.log('❌ Deployment failed!', e.response.data);
          reject(e)
        }
      }
    } catch(e) {
      reject(e)
    }

    function fileUpload (fileName) {
      return new Promise((resolve, reject) => {
        const [ext] = fileName.split('.').reverse()
        if (watch) {
          resolve({
            type: ext,
            data: {
              type: 'URL',
              url: `https://localhost:3000/${distDir}/${fileName}`
            }
          })
        } else {
          const file = path.resolve(process.cwd(), `${distDir}/${fileName}`)
          const form = new formdata()
          form.append('file', fs.createReadStream(file));

          client.post('/k/v1/file.json', form).then(({data: file}) => {
            resolve({
              type: ext,
              data: { type: 'FILE', file }
            })
          }).catch(e => reject(e.response.data))
        }
      })
    }
  })
}


function openBrowser(url) {
  switch (process.platform) {
    case 'darwin':
      exec(`open ${url}`);
      break;
    case 'win32':
      exec(`start ${url}`);
      break;
    default:
      exec(`xdg-open ${url}`);
  }
}

function createCertProcess() {
  return new Promise(async (resolve, reject) => {
    if (!fs.existsSync('cert')) fs.mkdirSync('cert');

    const fileList = await new Promise((resolve, reject) => {
      fs.readdir(path.resolve(process.cwd(), 'cert'), (err, files) => {
        if (err) reject(err)
        resolve(files.length ? files.filter(v => v.endsWith('.pem')) : [])
      });
    })

    if (!fileList.length) {
      try {
        const ca = await mkcert.createCA({
          organization: 'kintone CA',
          countryCode: "JP",
          state: "Kochi",
          locality: "Kochi",
          validity: 365
        })

        const cert = await mkcert.createCert({
          ca: { key: ca.key, cert: ca.cert },
          domains: ['127.0.0.1', 'localhost'],
          validity: 365,
        })

        console.log(cert.key, cert.cert); // certificate info
        console.log(`${cert.cert}${ca.cert}`); // create full chain certificate by merging CA and domain certificates

        fs.writeFileSync(path.resolve(process.cwd(), 'cert/cert-key.pem'), ca.key);
        fs.writeFileSync(path.resolve(process.cwd(), 'cert/cert.pem'), ca.cert);
        console.log('🔑 Cert files created!')

        resolve(ca, cert)
      } catch(e) {
        console.error(e)
        reject(e)
      }
    } else {
      resolve()
    }
  })
}