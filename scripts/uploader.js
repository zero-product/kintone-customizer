const fs        = require('fs')
const path      = require('path')
const { exec }  = require('child_process')

const env   = require('dotenv').config({path: path.resolve(__dirname, '../env/.env')}).parsed
const args  = process.argv.slice(2)
const watch = args.includes('--watch') || args.includes('-W')

const deploy = () => {
  return new Promise(async (resolve, reject) => {
    const file = await outputManifest(env, watch)
    let command = `yarn kintone-customize-uploader ${file}`
    const options = [
      ['--base-url', env.KINTONE_BASE_URL],
      ['--username', env.KINTONE_USERNAME],
      ['--password', env.KINTONE_PASSWORD],
      ['--dest-dir', './dist']
    ]

    options.forEach(opt => command += ` ` + opt.join(' '))
    exec(command, { encoding: 'UTF-8' }, (err, stdout, stderr) => {
      if (err) {
        reject(stderr)
      } else {
        resolve(stdout)
      }
    })
  })
}

module.exports =  deploy


function outputManifest(env, watch) {
  return new Promise((resolve, reject) => {
    const fileExist = setInterval(() => {
      if (
        isExists('app.min.js') || isExists('app.min.css') ||
        isExists(`${env.OUT_FILENAME || 'app'}.min.js`) ||
        isExists(`${env.OUT_FILENAME || 'app'}.min.css`)
      ) {
        const json = {
          app: env.APP_ID,
          scope: env.APP_SCOPE,
        }
        if (env.USE_DESKTOP) {
          json.desktop = watch ? {
            js: isExists('app.min.js') ? [ `https://localhost:3000/dist/app.min.js` ] : [],
            css: isExists('app.min.css') ? [ `https://localhost:3000/dist/app.min.css` ] : [],
          } : {
            js: isExists(`${env.OUT_FILENAME || 'app'}.min.js`) ? [ `dist/${env.OUT_FILENAME || 'app'}.min.js` ] : [],
            css: isExists(`${env.OUT_FILENAME || 'app'}.min.css`) ? [ `dist/${env.OUT_FILENAME || 'app'}.min.css` ] : [],
          }
        }
        if (env.USE_MOBILE) {
          json.mobile = watch ? {
            js: isExists('app.min.js') ? [ `https://localhost:3000/dist/app.min.js` ] : [],
            css: isExists('app.min.css') ? [ `https://localhost:3000/dist/app.min.css` ] : [],
          } : {
            js: isExists(`${env.OUT_FILENAME || 'app'}.min.js`) ? [ `dist/${env.OUT_FILENAME || 'app'}.min.js` ] : [],
            css: isExists(`${env.OUT_FILENAME || 'app'}.min.css`) ? [ `dist/${env.OUT_FILENAME || 'app'}.min.css` ] : [],
          }
        }

        const manifest = './env/manifest.json'
        fs.writeFileSync(manifest, JSON.stringify(json, null, "\t"))
        resolve(manifest)

        clearInterval(fileExist)
      }
    }, 500)

  })
}


function isExists(fileName = '') {
  const filePath = path.resolve(__dirname, '../dist/'+fileName)
  return fs.existsSync(filePath)
}