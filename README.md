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

### 1. 設定ファイル(config.js)

`config.js`ファイルを作成し、以下のように記述してください。  
※ 以下をコピペする場合は、コメント(`#`以降の文字)をすべて削除してください。

```json
{
  "filename": "app",  # 出力するJS,CSSのファイル名
  "desktop": true,    # デスクトップ版対応
  "mobile": true,     # スマホ版対応
  "auth": {
    "base_url": "https://~.cybozu.com", # kintone環境URL(最後のスラッシュ`/`は不要)
    "username": "", # デプロイ権限のあるユーザーのユーザー名(例: Administrator)
    "password": ""  # デプロイ権限のあるユーザーのパスワード
  },
  "manifest": {
    "app": 165,     # 対象アプリID
    "scope": "ALL"  # 権限(ALL, ADMIN or NONE)
  }
}
```

### 2. SSL 証明書発行

開発モード実行用に自己証明書を発行

```bash
yarn cert
```

## コマンド一覧

|コマンド|概要|
|-|-|
|`yarn cert`|自己証明書発行(Chocoratey or Homebrewによるmkcertでの生成を推奨)|
|`yarn build`|`dist`ディレクトリにカスタマイズファイルを生成します。|
|`yarn dev`|ローカルサーバが立ち上がり、ソースコードを更新するとkintoneに反映されます。|
|`yarn deploy`|カスタマイズをビルドし、kintoneに"本番モード"でアップロードします。|

## Vue.js(Option)

1. Vue3, esbuild用Vue3ローダー インストール

    ```bash
    yarn add -D vue esbuild-plugin-vue3
    ```

2. esbuild (`./esbuild.config.js`) 設定変更

    ```javascript:./esbuild.config.js

    // ... 略 ...

    const { sassPlugin } = require('esbuild-sass-plugin');
    const esbuildEnv = require('esbuild-envfile-plugin');
    const vuePlugin = require("esbuild-plugin-vue3");   // ← 追加

    module.exports = {
      plugins: [
        esbuildEnv,
        sassPlugin(),
        vuePlugin(),  // ← 追加
      ],
    }
    ```

3. `./src`ディレクトリに`App.vue`を作成

    ```html:./src/App.vue
    <script setup>
    </script>

    <template>
      <div>Hello World!</div>
    </template>
    ```

4. `main.js`でVue3を読込み

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
