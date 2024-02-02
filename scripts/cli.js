const fs    = require('fs')
const fsx   = require('fs-extra')
const path  = require('path')
const yargs = require('yargs/yargs');
const { exec } = require('child_process')
const { hideBin } = require('yargs/helpers');
const { build, context }  = require('esbuild');


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

const config  = require('../config.json')
const builder = require('../esbuild.config')
const outdir  = path.resolve(argv['dist-dir'])
const outfile = `${outdir}/${(config.filename || 'app') + (argv.watch ? '' : '.min')}.js`
const fileExists = (filePath = '') => fs.existsSync(path.resolve(filePath))
const env = fileExists('.env') ? require('dotenv').config({path: path.resolve(argv['env-file'])}).parsed : {}

const _builder = {
  entryPoints: [path.resolve('./src/app.js')],
  bundle: true,
  minify: !argv.watch,
  sourcemap: argv.watch,
  outfile,
  define: {
    'process.env': JSON.stringify(env),
    'process.env.NODE_ENV': process.env.NODE_ENV || '"development"',
  },
  ...builder,
}

run().then(async _ => {
  if (argv.watch) {
    // パッケージビルド
    const ctx = await context(_builder)

    // watchモード準備
    await ctx.watch()
    console.log('watching...')

    // SSLでローカルサーバ起動
    await ctx.serve({
      port: argv.port,
      host: 'localhost',
      servedir: "../",
      keyfile: path.resolve('./cert/cert-key.pem'),
      certfile: path.resolve('./cert/cert.pem'),
    })

    // manifest.json でデプロイ
    console.log('🔄 Uploading...')
    await deployer(argv.watch)

    console.log('✅ Uploaded!')
    console.log(`------------------------------------------------`)
    console.log(`Local  : https://localhost:${argv.port}`)
    console.log(`kintone: ${config?.auth?.base_url}/k/${config?.manifest?.app}/`)
    console.log(`------------------------------------------------`)
    openBrowser(`https://localhost:${argv.port}`);

  } else {
    // パッケージビルド
    console.log('🔨 Building...')
    await build(_builder)

    if (argv.deploy) {
      // manifest.json でデプロイ
      console.log('🔄 Uploading...')
      await deployer(argv.watch)

      console.log('✅ Uploaded!')
    }
  }
}).catch(e => {
  console.log('🚫 Error!')
  console.log(JSON.stringify(e))
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
    const file = await outputManifest(watch, argv['dist-dir']).catch(reject)
    let command = `npx kintone-customize-uploader ${file}`
    const options = [
      ['--base-url', config?.auth?.base_url],
      ['--username', config?.auth?.username],
      ['--password', config?.auth?.password],
      ['--dest-dir', argv['dist-dir']],
    ]

    options.forEach(opt => command += ` ` + opt.join(' '))
    // console.log(command)
    exec(command, { encoding: 'UTF-8' }, (err, stdout, stderr) => {
      console.error(err)
      if (err) {
        reject(stderr)
      } else {
        resolve(stdout)
      }
    })
  })
}


/**
 * @param {Boolean} watch - Watchモード
 */
function outputManifest(watch, distDir = 'dist') {
  return new Promise((resolve, reject) => {
    try {
      const fileExist = setInterval(() => {
        if (
          fileExists(`${distDir}/${config.filename || 'app'}${watch ? '' : '.min'}.js`) ||
          fileExists(`${distDir}/${config.filename || 'app'}${watch ? '' : '.min'}.css`)
        ) {
          const manifest = config?.manifest || {}
          if (Boolean(config.desktop)) {
            manifest.desktop = watch ? {
              js: fileExists(`${distDir}/${config.filename || 'app'}.js`) ? [ `https://localhost:3000/dist/${config.filename || 'app'}.js` ] : [],
              css: fileExists(`${distDir}/${config.filename || 'app'}.css`) ? [ `https://localhost:3000/dist/${config.filename || 'app'}.css` ] : [],
            } : {
              js: fileExists(`${distDir}/${config.filename || 'app'}.min.js`) ? [ `${distDir}/${config.filename || 'app'}.min.js` ] : [],
              css: fileExists(`${distDir}/${config.filename || 'app'}.min.css`) ? [ `${distDir}/${config.filename || 'app'}.min.css` ] : [],
            }
          }
          if (Boolean(config.mobile)) {
            manifest.mobile = watch ? {
              js: fileExists(`${distDir}/${config.filename || 'app'}.js`) ? [ `https://localhost:3000/dist/${config.filename || 'app'}.js` ] : [],
              css: fileExists(`${distDir}/${config.filename || 'app'}.css`) ? [ `https://localhost:3000/dist/${config.filename || 'app'}.css` ] : [],
            } : {
              js: fileExists(`${distDir}/${config.filename || 'app'}.min.js`) ? [ `${distDir}/${config.filename || 'app'}.min.js` ] : [],
              css: fileExists(`${distDir}/${config.filename || 'app'}.min.css`) ? [ `${distDir}/${config.filename || 'app'}.min.css` ] : [],
            }
          }

          fs.writeFileSync(path.resolve('manifest.json'), JSON.stringify(manifest, null, "\t"))
          resolve('manifest.json')

          clearInterval(fileExist)
        }
      }, 500)
    } catch(e) {
      reject(e)
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
