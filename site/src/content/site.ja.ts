import { screenshot } from './screenshots';
import { sitePath } from './paths';

const repositoryUrl = 'https://github.com/yyamamot/Svard';
const releasesUrl = 'https://github.com/yyamamot/Svard/releases';
const changelogUrl = 'https://github.com/yyamamot/Svard/blob/main/CHANGELOG.md';
const issuesUrl = 'https://github.com/yyamamot/Svard/issues';

export const site = {
  locale: 'ja',
  title: 'Svard',
  description: 'AsciiDoc / Markdown を読むためのデスクトップビューア。',
  nav: {
    top: 'トップ',
    features: '機能',
    download: 'ダウンロード',
    languageLabel: 'English',
    languageHref: sitePath('en/'),
  },
  footer: {
    summary: 'Svard はローカルの技術文書を読む、探す、比較するためのデスクトップビューアです。',
    links: [
      { label: 'GitHub', href: repositoryUrl },
      { label: 'Releases', href: releasesUrl },
      { label: 'Issues', href: issuesUrl },
    ],
  },
  top: {
    eyebrow: 'Local-first document viewer',
    heading: 'Svard',
    lead: 'AsciiDoc / Markdown を読むためのデスクトップビューア。',
    body: 'ローカルの技術文書を安全に開き、文書内検索、ワークスペース検索、プレビューベースの差分確認、図表レンダリングを読み手中心に扱います。',
    primaryLink: { label: 'ダウンロード', href: sitePath('ja/download/') },
    secondaryLink: { label: '機能', href: sitePath('ja/features/') },
    screenshot: {
      ...screenshot('hero-plantuml.png', 'PlantUML図表', '実際のスクリーンショットは未準備です。合成fixture文書または公開サンプル文書を使った画像だけをここに配置します。', 'SvardでPlantUMLのAliceからBobへのシーケンス図を開いている画面'),
    },
    screenshotGallery: [
      { ...screenshot('reader-main.png', 'メインウィンドウ', '文書を開いた状態のメインウィンドウを配置します。', 'SvardでProduct Guideを開いている画面') },
      { ...screenshot('search.png', '検索', '現在の文書検索またはワークスペース検索の状態を配置します。', 'Svardで文書内検索を使っている画面') },
      { ...screenshot('rendered-diff.png', 'プレビューベースの差分確認', 'プレビュー上で差分を確認している状態を配置します。', 'Svardでプレビュー上の差分を確認している画面') },
    ],
    highlights: [
      { title: 'AsciiDoc / Markdown を読む', body: '編集ツールではなく、技術文書を読むためのビューアとして設計します。' },
      { title: '検索を分けて扱う', body: '現在の文書とワークスペース全体の検索を分け、読む作業の流れを保ちます。' },
      { title: 'プレビューで差分を確認する', body: 'ソース行差分だけでなく、プレビュー上で表示結果の変化を確認します。' },
      { title: '図表はローカルを主経路にする', body: 'Mermaid / PlantUML / Graphviz はローカルレンダリングを標準の経路にします。' },
      { title: 'ブラウザー風に操作する', body: 'タブ、戻る/進む、ブックマーク、マウスジェスチャーなど、ブラウザーに近い操作で文書を行き来できます。' },
      { title: 'Gitの差分を確認する', body: 'Gitの変更や、GitHub / GitLab のマージ先との差分をレンダリング結果として確認します。' },
    ],
    privacy: {
      title: 'ローカルファーストの境界',
      body: 'Svard はローカルファイルを前提にしたビューアです。Kroki は未対応、完全互換、ユーザーが明示設定した場合のフォールバックとして扱い、暗黙の公開サービス依存にはしません。',
    },
    diff: {
      title: 'プレビューベースの差分確認',
      body: 'Git やファイル同士の比較は、行単位の差分だけではなく、プレビュー上で文書として読める変化を確認するワークスペースとして整理します。',
    },
    download: {
      title: 'ダウンロード',
      body: '対応状況、プラットフォーム別の注意、既知の制限をDownloadページに集約します。',
      status: '準備中',
    },
    faq: [
      { question: 'Svard は編集ツールですか？', answer: 'いいえ。Svard は閲覧、ナビゲーション、比較に集中したデスクトップビューアです。' },
      { question: '公開Krokiを標準で使いますか？', answer: 'いいえ。公開Krokiを暗黙の標準にはしません。フォールバックはユーザーが明示した場合に限定します。' },
      { question: 'Gitコマンドのインストールは必要ですか？', answer: 'いいえ。Git機能はSvardに統合されており、差分確認のために別途Gitコマンドをインストールする必要はありません。' },
    ],
  },
  features: {
    eyebrow: 'Features',
    heading: '読む、探す、比較するための機能。',
    lead: 'Svard はエディタやIDEではなく、ローカルの技術文書を読むためのデスクトップビューアです。',
    screenshot: {
      ...screenshot('reader-main.png', 'Reader画面', '機能ごとのスクリーンショットは、公開可能なサンプル文書で準備します。', 'Svardの文書閲覧画面'),
    },
    sections: [
      { title: 'AsciiDoc / Markdown の閲覧', body: 'AsciiDoc / Markdown の技術文書をビューアとして開き、読む作業を中心に扱います。ビューア都合でソースを書き換えません。', screenshot: screenshot('reader-main.png', '閲覧画面', '文書を開いて読んでいる状態のスクリーンショットを配置します。', 'Svardの閲覧画面') },
      { title: 'ファイルツリー', body: 'ローカルフォルダを開き、文書ツリーからAsciiDoc / Markdownを選んで読めます。Gitの変更状態も文書ツリー上で確認できます。', screenshot: screenshot('files.png', 'ファイルツリー画面', '文書ツリーとGitの変更状態を確認している状態を配置します。', 'Svardのファイルツリー画面') },
      { title: '現在の文書 / すべてのファイル検索', body: '現在の文書だけを検索する操作と、ワークスペース全体から探す操作を分けます。', screenshot: screenshot('search.png', '検索画面', '検索UIと検索結果のスクリーンショットを配置します。', 'Svardの検索画面') },
      { title: 'プレビューベースの差分確認', body: 'Gitの変更や、GitHub / GitLab のマージ先との差分を、プレビュー上の表示結果として確認します。', screenshot: screenshot('rendered-diff.png', '差分画面', 'プレビューベースの差分ビューを配置します。', 'Svardのプレビュー差分画面') },
      { title: '変更管理', body: 'Gitの変更、ブランチ差分、履歴を、文書レビューの入口として同じ画面内で扱います。', screenshot: screenshot('source-control.png', '変更管理画面', 'Git変更を変更管理画面で確認している状態を配置します。', 'Svardの変更管理画面') },
      { title: 'ローカル図表レンダリング', body: 'Mermaid / PlantUML / Graphviz はローカルレンダリングを主経路にします。', screenshot: screenshot('hero-plantuml.png', 'PlantUML図表', 'ローカルで図表を表示している状態を配置します。', 'SvardでPlantUML図表を表示している画面') },
      { title: '明示的なKrokiフォールバック', body: 'Kroki は未対応、完全互換、またはユーザーが明示設定した場合だけフォールバックとして扱います。', screenshot: screenshot('kroki-fallback.png', 'Kroki設定画面', '明示設定であることが分かる設定画面を配置します。', 'SvardのKrokiフォールバック設定画面') },
      { title: 'ブックマーク管理', body: 'よく開くフォルダや文書をブックマークし、読み返す入口として管理できます。', screenshot: screenshot('navigation.png', 'ブックマーク画面', 'ブックマークしたフォルダや文書を管理している状態を配置します。', 'Svardのブックマーク管理画面') },
      { title: 'プライバシー境界', body: '図表ソース、全文、プライベートパス、endpoint URLを不用意に外部サービスやログへ出さない境界を前提にします。', screenshot: screenshot('privacy-boundary.png', 'プライバシー設定画面', 'プライバシー境界を説明できる設定または状態表示を配置します。', 'Svardのプライバシー境界設定画面') },
    ],
  },
  download: {
    eyebrow: 'Download',
    heading: 'GitHub Releases からダウンロードできます。',
    lead: 'インストーラー、リリースノート、チェックサムは GitHub Releases を公式の入手元として確認してください。未署名ビルドを開く前に、プラットフォーム別の注意を確認してください。',
    status: { label: 'リリース状況', value: 'GitHub Releases で公開' },
    resources: {
      heading: '入手と確認',
      items: [
        {
          title: 'GitHub Releases',
          body: '最新版の macOS / Windows 向け配布物は、公式の GitHub Releases から入手します。',
          state: '公式',
          href: releasesUrl,
        },
        {
          title: 'Changelog',
          body: '更新前に、ユーザー向けの変更点とリリースノートを確認できます。',
          state: '公開中',
          href: changelogUrl,
        },
        {
          title: 'System requirements',
          body: 'サポート対象のOS、CPU、メモリ要件を公開前提の短い一覧で示します。',
          state: '推奨要件',
          details: [
            'macOS: Apple Silicon（M1以降）',
            'Windows: x86_64',
            'Memory: 4GB以上、快適利用は8GB以上推奨',
          ],
        },
        {
          title: 'Known limitations',
          body: '利用前に知るべき制限と、現時点で約束しない配布経路を明記します。',
          state: '準備中',
          details: [
            'Linuxは現状非サポート',
            'macOS / Windows は未署名ビルドとして配布予定',
            '自動更新は未対応',
            'WSL環境やWSL上のファイルを対象にした利用では、ファイル監視やI/Oの性能、Git参照の解決に問題が出る場合があります。',
          ],
        },
        {
          title: 'Repository / Issues',
          body: '公開リポジトリの確認や issue 報告は GitHub から行えます。',
          state: '公開中',
          href: issuesUrl,
        },
        {
          title: 'Security / signing',
          body: 'コード署名と配布経路が確定するまで、未署名ビルドとして扱う前提の注意を掲載します。',
          state: '準備中',
          details: [
            'macOS / Windows は未署名ビルドとして配布予定',
            '公式リリースから取得した配布物だけを許可対象にしてください',
          ],
        },
      ],
    },
    platformSupport: {
      heading: 'プラットフォーム対応',
      rows: [
        {
          platform: 'macOS',
          status: 'サポート対象',
          command: 'xattr -dr com.apple.quarantine /Applications/Svard.app',
          note: '公式リリースから取得したことを確認してから実行してください。Finderで右クリックして「開く」またはシステム設定から許可する方法も使えます。',
        },
        {
          platform: 'Windows',
          status: 'サポート対象',
          command: 'Unblock-File -Path .\\Svard.exe',
          note: 'PowerShellでダウンロードした実行ファイルに対して実行します。SmartScreenが表示された場合は「詳細情報」から実行できます。',
        },
        {
          platform: 'Linux',
          status: '非サポート',
          command: 'なし',
          note: '現状はLinux向け配布物、パッケージマネージャー、起動手順を提供しません。',
        },
      ],
    },
    notes: [
      'GitHub Releases を公式のダウンロード元として扱います。',
      'このページでは配布物への直接リンクを固定せず、Releases ページへの導線を正にします。',
      'App Store バッジやパッケージマネージャーのコマンドは、対応するまで掲載しません。',
      '自動更新の約束は、実装と配布経路が確定するまで掲載しません。',
      '確認コマンドは、公式リリースから取得した配布物に対してだけ実行してください。',
    ],
  },
};
