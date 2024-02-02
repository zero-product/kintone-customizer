const { sassPlugin } = require('esbuild-sass-plugin');
const esbuildEnv = require('esbuild-envfile-plugin');

module.exports = {
  plugins: [
    sassPlugin(),
    esbuildEnv
  ],
}