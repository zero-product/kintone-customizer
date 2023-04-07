# kintoneカスタマイズ

## 導入方法

```bash
# リポジトリをクローン
git clone https://github.com/zero-product/kintone-customizer.git

# プロジェクトディレクトリに移動
cd kintone-customizer

# モジュール、ライブラリ インストール
yarn install
```

### 1. 環境変数ファイル(.env)

`./env/.env.example`を同ディレクトリに`./env/.env`として複製。

```bash
APP_ID=           # 対象アプリID
APP_SCOPE=ALL     # ALL, ADMIN or NONE
OUT_FILENAME=app  # 出力するJS,CSSのファイル名
USE_DESKTOP=true  # デスクトップ版対応
USE_MOBILE=true   # スマホ版対応

KINTONE_BASE_URL=https://~.cybozu.com   # kintone環境URL(最後のスラッシュ`/`は不要)
KINTONE_USERNAME= # デプロイ権限のあるユーザーのユーザー名(例: Administrator)
KINTONE_PASSWORD= # デプロイ権限のあるユーザーのパスワード
```

### 2. SSL 証明書発行

開発モード実行用に自己証明書を発行

```bash
yarn cert
```

## コマンド一覧

|コマンド|概要|
|-|-|
|`yarn cert`|自己証明書発行|
|`yarn dev`|ローカルサーバが立ち上がり、ソースコードを更新するとkintoneに反映される。|
|`yarn deploy`|カスタマイズをkintoneに"本番モード"で反映します。|

## Vue.js(Option)

1. Vue3, esbuild用Vue3ローダー インストール

    ```bash
    yarn add -D vue esbuild-plugin-vue3
    ```

1. esbuild (`./scripts/esbuild.config.js`) 設定変更

    ```javascript:./scripts/esbuild.config.js

    // ... 略 ...

    const esbuildEnv  = require('esbuild-envfile-plugin')
    const vuePlugin = require("esbuild-plugin-vue3")    // ← 追加

    // ... 略 ...

    const builder = {
      // ... 略 ...
      plugins: [
        esbuildEnv,
        vuePlugin(),  // ← 追加
        sassPlugin(),
      ],
      // ... 略 ...
    }

    // ... 略 ...
    ```

1. `./src`ディレクトリに`App.vue`を作成

    ```html:./src/App.vue
    <script setup>
    </script>

    <template>
      <div>Hello World!</div>
    </template>
    ```

1. `main.js`でVue3を読込み

    ```javascript:./src/main.js

    import { createApp } from 'vue'
    import App from './App.vue'

    // ... 略 ...

    kintone.events.on('app.record.index.show', (event) => {
      console.log(event);

      /** **************************************************************
       * 例1) カスタマイズビュー
       *
       * kintoneのカスタマイズビューの`HTML`欄に
       * `<div id="app"></div>`
       * を登録してください。
       ************************************************************** */
      const app = createApp(App)
      app.mount('#app')

      /** **************************************************************
       * 例2) 一覧のメニューの右側の空白部分
       ************************************************************** */
      if (!document.getElementById('app')) {
        // ヘッダー要素取得
        const header = kintone.app.getHeaderMenuSpaceElement()

        // `div#app` 要素を作成
        const appEl = document.createElement('div')
        appEl.id = 'app'

        // ヘッダー要素に `div#app` 要素を追加
        header.appendChild(appEl)

        // Vue定義
        createApp(App).mount('#app')
      }
    });
    ```
