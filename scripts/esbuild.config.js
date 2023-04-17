const fs    = require('fs')
const fsx   = require('fs-extra')
const path  = require('path')
const { build, context }  = require('esbuild')
const { sassPlugin }    = require('esbuild-sass-plugin');
const esbuildEnv  = require('esbuild-envfile-plugin');
const dotenv      = require('dotenv').config({path: path.resolve(__dirname, '../env/.env')})
const deployer    = require('./uploader')

const args    = process.argv.slice(2)
const watch   = args.includes('--watch') || args.includes('-W')
const deploy  = args.includes('--deploy') || args.includes('-D')
const env     = dotenv.parsed;
const outdir  = path.resolve(__dirname, '../dist')
const outFile = `${outdir}/${watch ? 'app' : env.OUT_FILENAME || 'app'}.min.js`

const builder = {
  entryPoints: [path.resolve('./src/app.js')],
  bundle    : true,
  minify    : !watch,
  sourcemap : watch,
  outfile   : outFile,

  plugins   : [sassPlugin(), esbuildEnv],
  define: {
    'process.env': JSON.stringify(env),
    'process.env.NODE_ENV': process.env.NODE_ENV || 'development',
  },
}


removeDist().then(async _ => {
  if (watch) {
    // パッケージビルド
    const ctx = await context(builder)

    // watchモード準備
    await ctx.watch()
    console.log('watching...')

    const port = 3000
    const host = 'localhost'

    // SSLでローカルサーバ起動
    await ctx.serve({
      port, host,
      servedir: "./",
      keyfile: path.resolve(__dirname, '../env/cert-key.pem'),
      certfile: path.resolve(__dirname, '../env/cert.pem'),
    })

    // manifest.json でデプロイ
    console.log('🔄 Uploading...')
    await deployer()

    console.log('✅ Uploaded!')
    console.log(`------------------------------------------------`)
    console.log(`Local  : https://${host}:${port}/dist/`)
    console.log(`kintone: ${env.KINTONE_BASE_URL}/k/${env.APP_ID}/`)
    console.log(`------------------------------------------------`)
  } else {
    // パッケージビルド
    console.log('🔨 Building...')
    await build(builder)

    if (deploy) {
      // manifest.json でデプロイ
      console.log('🔄 Uploading...')
      await deployer()

      console.log('✅ Uploaded!')
    }
  }
}).catch(e => {
  console.log('🚫 Error!')
  console.log(e)
})

function removeDist() {
  return new Promise((resolve) => {
    if (fs.existsSync(outdir)) {
      fsx.remove(outdir)
      resolve(true)
    } else {
      resolve(false)
    }
  })
}