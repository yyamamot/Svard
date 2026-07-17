import { screenshot } from "./screenshots";
import { sitePath } from "./paths";

const repositoryUrl = "https://github.com/yyamamot/Svard";
const releasesUrl = "https://github.com/yyamamot/Svard/releases";
const changelogUrl = "https://github.com/yyamamot/Svard/blob/main/CHANGELOG.md";
const issuesUrl = "https://github.com/yyamamot/Svard/issues";

export const site = {
  locale: "ja",
  title: "Svard",
  description: "AsciiDoc / Markdown を読むためのデスクトップビューア",
  nav: {
    top: "トップ",
    features: "機能",
    docs: "ドキュメント",
    download: "ダウンロード",
    languageLabel: "English",
    languageHref: sitePath("en/"),
  },
  footer: {
    summary:
      "Svard はローカルの技術文書を読む、探す、比較するためのデスクトップビューアです。",
    links: [
      { label: "GitHub", href: repositoryUrl },
      { label: "Releases", href: releasesUrl },
      { label: "Issues", href: issuesUrl },
    ],
  },
  top: {
    eyebrow: "Local-first document viewer",
    heading: "Svard",
    lead: "AsciiDoc / Markdown をレンダリングして差分比較できるデスクトップビューア",
    body: "ローカルの技術文書を安全に開き、Markdown / AsciiDoc を表示結果としてレンダリングしてから、文章、リスト、表、図表、ソース表示の変化を読み手中心に比較します。",
    primaryLink: { label: "ダウンロード", href: sitePath("ja/download/") },
    secondaryLink: { label: "機能", href: sitePath("ja/features/") },
    screenshot: {
      ...screenshot(
        "rendered-diff.png",
        "レンダリング差分比較",
        "Markdown / AsciiDoc を表示結果としてレンダリングし、読者に見える差分を左右で比較している画面です。",
        "Svardでレンダリング結果の差分を比較している画面",
      ),
    },
    screenshotGallery: [
      {
        ...screenshot(
          "reader-main.png",
          "メインウィンドウ",
          "ローカル文書を開き、ファイルツリーと本文プレビューを同時に表示している画面です。",
          "SvardでProduct Guideを開いている画面",
        ),
      },
      {
        ...screenshot(
          "search.png",
          "検索",
          "文書内検索で一致箇所と本文側のハイライトを確認している画面です。",
          "Svardで文書内検索を使っている画面",
        ),
      },
      {
        ...screenshot(
          "hero-plantuml.png",
          "PlantUML図表",
          "公開用サンプル文書で PlantUML 図表を本文プレビューに表示している画面です。",
          "SvardでPlantUMLのAliceからBobへのシーケンス図を開いている画面",
        ),
      },
    ],
    highlights: [
      {
        title: "AsciiDoc / Markdown を読む",
        body: "編集ツールではなく、技術文書を読むためのビューアとして設計します。",
      },
      {
        title: "検索を分けて扱う",
        body: "現在の文書とワークスペース全体の検索を分け、読む作業の流れを保ちます。",
      },
      {
        title: "レンダリングして差分を比較する",
        body: "ソース行差分だけでなく、文書として表示された結果の変化を比較します。",
      },
      {
        title: "図表はローカルを主経路にする",
        body: "Mermaid / PlantUML / Graphviz はローカルレンダリングを標準の経路にします。",
      },
      {
        title: "ブラウザー風に操作する",
        body: "タブ、戻る/進む、ブックマーク、マウスジェスチャーなど、ブラウザーに近い操作で文書を行き来できます。",
      },
      {
        title: "Gitの差分を確認する",
        body: "Gitの変更や、GitHub / GitLab のマージ先との差分を、読者に見えるレンダリング結果として確認します。",
      },
    ],
    privacy: {
      title: "ローカルファーストの境界",
      body: "Svard はローカルファイルを前提にしたビューアです。Kroki は未対応、完全互換、ユーザーが明示設定した場合のフォールバックとして扱い、暗黙の公開サービス依存にはしません。",
    },
    diff: {
      title: "レンダリング結果で差分を比較",
      body: "Git やファイル同士の比較は、行単位の差分だけではなく、Markdown / AsciiDoc をレンダリングした表示結果で確認します。文章、リスト、表、図表の変化を、読者に見える形で追えます。",
    },
    faq: [
      {
        question: "Svard は編集ツールですか？",
        answer:
          "いいえ。Svard は閲覧、ナビゲーション、比較に集中したデスクトップビューアです。",
      },
      {
        question: "公開Krokiを標準で使いますか？",
        answer:
          "いいえ。公開Krokiを暗黙の標準にはしません。フォールバックはユーザーが明示した場合に限定します。",
      },
      {
        question: "Gitコマンドのインストールは必要ですか？",
        answer:
          "いいえ。Git機能はSvardに統合されており、差分確認のために別途Gitコマンドをインストールする必要はありません。",
      },
    ],
  },
  features: {
    eyebrow: "Features",
    heading: "読む、探す、比較するための機能",
    lead: "Svard はエディタやIDEではなく、ローカルの技術文書を読むためのデスクトップビューアです",
    screenshot: {
      ...screenshot(
        "reader-main.png",
        "Reader画面",
        "公開用サンプル文書を開き、Svard の閲覧画面を表示しているスクリーンショットです。",
        "Svardの文書閲覧画面",
      ),
    },
    sections: [
      {
        title: "AsciiDoc / Markdown の閲覧",
        body: "AsciiDoc / Markdown の技術文書をビューアとして開き、読む作業を中心に扱います。ビューア都合でソースを書き換えません。",
        screenshot: screenshot(
          "reader-main.png",
          "閲覧画面",
          "ローカル文書を開き、本文プレビューを読んでいる状態を示します。",
          "Svardの閲覧画面",
        ),
      },
      {
        title: "ファイルツリー",
        body: "ローカルフォルダを開き、文書ツリーからAsciiDoc / Markdownを選んで読めます。Gitの変更状態も文書ツリー上で確認できます。",
        screenshot: screenshot(
          "files.png",
          "ファイルツリー画面",
          "ローカルフォルダ内の文書をファイルツリーから選ぶ状態を示します。",
          "Svardのファイルツリー画面",
        ),
      },
      {
        title: "現在の文書 / すべてのファイル検索",
        body: "現在の文書だけを検索する操作と、ワークスペース全体から探す操作を分けます。",
        screenshot: screenshot(
          "search.png",
          "検索画面",
          "検索パネルと本文側の一致箇所を同時に確認している状態を示します。",
          "Svardの検索画面",
        ),
      },
      {
        title: "プレビューベースの差分確認",
        body: "Gitの変更や、GitHub / GitLab のマージ先との差分を、プレビュー上の表示結果として確認します。",
        screenshot: screenshot(
          "rendered-diff.png",
          "差分画面",
          "文書として見える差分をプレビュー上で確認している状態を示します。",
          "Svardのプレビュー差分画面",
        ),
      },
      {
        title: "変更管理",
        body: "Gitの変更、ブランチ差分、履歴を、文書レビューの入口として同じ画面内で扱います。",
        screenshot: screenshot(
          "source-control.png",
          "変更管理画面",
          "Source Control から変更一覧を確認し、差分レビューへ進む入口を示します。",
          "Svardの変更管理画面",
        ),
      },
      {
        title: "ローカル図表レンダリング",
        body: "Mermaid / PlantUML / Graphviz はローカルレンダリングを主経路にします。",
        screenshot: screenshot(
          "hero-plantuml.png",
          "PlantUML図表",
          "ローカルでレンダリングした図表を本文プレビューに表示している状態を示します。",
          "SvardでPlantUML図表を表示している画面",
        ),
      },
      {
        title: "明示的なKrokiフォールバック",
        body: "Kroki は未対応、完全互換、またはユーザーが明示設定した場合だけフォールバックとして扱います。",
        screenshot: screenshot(
          "kroki-fallback.png",
          "Kroki設定画面",
          "外部フォールバックを明示的に選ぶ設定画面を示します。",
          "SvardのKrokiフォールバック設定画面",
        ),
      },
      {
        title: "ブックマーク管理",
        body: "よく開くフォルダや文書をブックマークし、読み返す入口として管理できます。",
        screenshot: screenshot(
          "navigation.png",
          "ブックマーク画面",
          "よく使うフォルダや文書をブックマークとして管理している状態を示します。",
          "Svardのブックマーク管理画面",
        ),
      },
      {
        title: "プライバシー境界",
        body: "図表ソース、全文、プライベートパス、サービスURLを不用意に外部サービスやログへ出さない境界を前提にします。",
        screenshot: screenshot(
          "privacy-boundary.png",
          "プライバシー設定画面",
          "公開成果物に出さない情報の境界を説明する設定画面を示します。",
          "Svardのプライバシー境界設定画面",
        ),
      },
    ],
  },
  docs: {
    eyebrow: "ドキュメント",
    lead: "Svard は、ローカルの技術文書を読む、探す、比較するためのデスクトップビューアです",
    plannedLabel: "Planned",
    overview: {
      title: "Svard とは",
      lead: "Svard は、ローカルの技術文書を読む、探す、比較するためのデスクトップビューアです",
      notice: {
        title: "リリース状況について",
        body: "この Docs には、次回リリース向けに準備中の機能や、現在の公開版にはまだ含まれていない機能が含まれる場合があります。実際に利用できる機能は、リリースノートと配布版の画面を確認してください。",
      },
      sections: [
        {
          title: "ローカル文書を読むための作業場",
          body: [
            "Svard は AsciiDoc / Markdown のソースを、閲覧の都合で書き換えずに表示します。フォルダを開き、複数の文書を移動しながら、図表や表を含む技術文書をそのまま読み進めるためのアプリです。",
          ],
        },
        {
          title: "文書として見える差分を確認する",
          body: [
            "ソース行だけでなく、プレビュー上で読み手に見える変化を確認できます。レビュー対象が表、リスト、図表を含む場合でも、文書としてどう変わったかを把握しやすくすることを重視しています。",
          ],
        },
        {
          title: "ローカルファーストの境界",
          body: [
            "文書、図表、比較結果はローカルで扱うことを基本にします。外部サービスを使う機能は明示設定を前提にし、スクリーンショットやログにもローカルの絶対パス、認証情報、接続先URL、文書本文を出さない方針です。",
          ],
        },
      ],
    },
    featureEyebrow: "機能ドキュメント",
    backLabel: "ドキュメントに戻る",
    articleLabels: {
      whatThisFeatureIs: "この機能について",
      whenToUse: "使う場面",
      whatItDoes: "できること",
      howItWorks: "操作の流れ",
      notesAndLimits: "注意点と制限",
      related: "関連機能",
    },
    groups: [
      {
        title: "はじめに",
        items: [
          {
            slug: "what-is-svard",
            title: "Svard とは",
            body: "Svard をローカルファーストな技術文書ビューアとして理解する入口です。",
            state: "公開中",
            href: sitePath("ja/docs/"),
          },
          {
            slug: "first-document",
            title: "最初の文書を読む",
            body: "フォルダを開き、最初の AsciiDoc / Markdown を読み始めます。",
            state: "公開中",
            href: sitePath("ja/docs/features/first-document/"),
          },
          {
            slug: "privacy-model",
            title: "ローカルファーストの考え方",
            body: "暗黙の公開サービス依存を避ける Svard の境界を確認します。",
            state: "公開中",
            href: sitePath("ja/docs/features/privacy-model/"),
          },
        ],
      },
      {
        title: "文書を読む",
        items: [
          {
            slug: "reading-markup",
            title: "AsciiDoc / Markdown の閲覧",
            body: "ビューア都合でソースを書き換えず、技術文書を読む機能です。",
            state: "公開中",
            href: sitePath("ja/docs/features/reading-markup/"),
          },
          {
            slug: "table-of-contents",
            title: "Contents サイドバー",
            body: "長い文書を右側の見出し一覧から移動します。",
            state: "公開中",
            href: sitePath("ja/docs/features/table-of-contents/"),
          },
          {
            slug: "includes-local-assets",
            title: "インクルードとローカル素材",
            body: "安全に扱えるインクルードとローカル素材を、閲覧の境界内で表示します。",
            state: "公開中",
            href: sitePath("ja/docs/features/includes-local-assets/"),
          },
          {
            slug: "themes-zoom",
            title: "テーマと拡大率",
            body: "編集ではなく読書のために表示を調整します。",
            state: "公開中",
            href: sitePath("ja/docs/features/themes-zoom/"),
          },
          {
            slug: "zen-mode",
            title: "Zen Mode",
            body: "文書に集中したい時に周辺 UI を減らします。",
            state: "公開中",
            href: sitePath("ja/docs/features/zen-mode/"),
          },
        ],
      },
      {
        title: "移動",
        items: [
          {
            slug: "tabs-open-files",
            title: "タブと開いているファイル",
            body: "閲覧中の文書を行き来します。",
            state: "公開中",
            href: sitePath("ja/docs/features/tabs-open-files/"),
          },
          {
            slug: "documents-order",
            title: "MkDocs / Antora の読書順",
            body: "プロジェクトのナビ順、または開いた文書だけの一時的な読書ツリーで読めます。",
            state: "公開中",
            href: sitePath("ja/docs/features/documents-order/"),
          },
          {
            slug: "history-recently-closed",
            title: "履歴と閉じたタブ",
            body: "読んでいた文書や閉じたタブに戻ります。",
            state: "公開中",
            href: sitePath("ja/docs/features/history-recently-closed/"),
          },
          {
            slug: "split-view",
            title: "分割表示",
            body: "2つの文書や表示を並べて読みます。",
            state: "公開中",
            href: sitePath("ja/docs/features/split-view/"),
          },
          {
            slug: "quick-open",
            title: "クイックオープン",
            body: "長いツリーをたどらずに文書へ移動します。",
            state: "公開中",
            href: sitePath("ja/docs/features/quick-open/"),
          },
          {
            slug: "bookmarks",
            title: "ブックマーク",
            body: "よく読むフォルダや文書を入口として残します。",
            state: "公開中",
            href: sitePath("ja/docs/features/bookmarks/"),
          },
        ],
      },
      {
        title: "検索",
        items: [
          {
            slug: "current-file-search",
            title: "文書内検索",
            body: "今読んでいる文書の中を検索します。",
            state: "公開中",
            href: sitePath("ja/docs/features/current-file-search/"),
          },
          {
            slug: "workspace-search",
            title: "ワークスペース検索",
            body: "対象文書が不明な時にフォルダ全体から探します。",
            state: "公開中",
            href: sitePath("ja/docs/features/workspace-search/"),
          },
          {
            slug: "search-result-navigation",
            title: "検索結果の移動",
            body: "読んでいる文脈を保ったまま検索結果を移動します。",
            state: "公開中",
            href: sitePath("ja/docs/features/search-result-navigation/"),
          },
        ],
      },
      {
        title: "図表",
        items: [
          {
            slug: "local-diagram-rendering",
            title: "ローカル図表レンダリング",
            body: "Mermaid / PlantUML / Graphviz をローカルレンダリング主経路で表示します。",
            state: "公開中",
            href: sitePath("ja/docs/features/local-diagram-rendering/"),
          },
          {
            slug: "diagram-inspector",
            title: "図表インスペクタ",
            body: "文書内の図表をサイドバーの一覧から確認します。",
            state: "公開中",
            href: sitePath("ja/docs/features/diagram-inspector/"),
          },
          {
            slug: "kroki-fallback",
            title: "明示的な Kroki フォールバック",
            body: "未対応、完全互換、ユーザー明示設定の場合だけ Kroki をフォールバックとして扱います。",
            state: "公開中",
            href: sitePath("ja/docs/features/kroki-fallback/"),
          },
          {
            slug: "external-plantuml-fallback",
            title: "外部 PlantUML フォールバック",
            body: "高度なケースでユーザー指定の PlantUML パスを使います。",
            state: "公開中",
            href: sitePath("ja/docs/features/external-plantuml-fallback/"),
          },
          {
            slug: "diagram-export-preview",
            title: "図表の書き出しとプレビュー",
            body: "図表をプレビューし、必要に応じてレンダリング済み SVG を保存します。",
            state: "公開中",
            href: sitePath("ja/docs/features/diagram-export-preview/"),
          },
          {
            slug: "diagram-loading-cache",
            title: "図表の高速読み込みとキャッシュ",
            body: "長い文書でも図表表示を読書の流れに合わせます。",
            state: "公開中",
            href: sitePath("ja/docs/features/diagram-loading-cache/"),
          },
        ],
      },
      {
        title: "プレビュー差分",
        items: [
          {
            slug: "preview-diff-review",
            title: "プレビューベースの差分確認",
            body: "ソースの行差分だけでなく、文書として見える変化を確認します。",
            state: "公開中",
            href: sitePath("ja/docs/features/preview-diff-review/"),
          },
          {
            slug: "file-compare",
            title: "ファイル同士の比較",
            body: "2つのマークアップファイルを同じプレビュー差分画面で比較します。",
            state: "公開中",
            href: sitePath("ja/docs/features/file-compare/"),
          },
          {
            slug: "cli-file-compare",
            title: "CLI からのファイル比較",
            body: "デスクトップアプリの起動経路から2ファイル比較を開きます。",
            state: "公開中",
            href: sitePath("ja/docs/features/cli-file-compare/"),
          },
          {
            slug: "table-list-diff-review",
            title: "表とリストの差分確認",
            body: "表示されたリストや表の構造化された変化を確認します。",
            state: "公開中",
            href: sitePath("ja/docs/features/table-list-diff-review/"),
          },
          {
            slug: "change-navigator",
            title: "変更ナビゲータ",
            body: "プレビュー上の変更間を移動します。",
            state: "公開中",
            href: sitePath("ja/docs/features/change-navigator/"),
          },
          {
            slug: "fallback-visibility",
            title: "フォールバック表示",
            body: "精密な差分表示が広いブロック表示に切り替わった状態を示します。",
            state: "公開中",
            href: sitePath("ja/docs/features/fallback-visibility/"),
          },
        ],
      },
      {
        title: "変更レビュー",
        items: [
          {
            slug: "change-review-mode",
            title: "Change Review Mode",
            body: "通常の閲覧画面で現在の変更箇所を確認します。",
            state: "公開中",
            href: sitePath("ja/docs/features/change-review-mode/"),
          },
          {
            slug: "list-item-markers",
            title: "リスト項目の変更表示",
            body: "読書中に変更されたリスト項目を把握します。",
            state: "公開中",
            href: sitePath("ja/docs/features/list-item-markers/"),
          },
          {
            slug: "table-cell-markers",
            title: "表の行・セル変更表示",
            body: "信頼できる表の行やセルの変更をマーカーで示します。",
            state: "公開中",
            href: sitePath("ja/docs/features/table-cell-markers/"),
          },
        ],
      },
      {
        title: "変更管理",
        items: [
          {
            slug: "source-control-changes",
            title: "変更一覧",
            body: "ローカルの変更を単体または一括の文書レビュー入口として扱います。",
            state: "公開中",
            href: sitePath("ja/docs/features/source-control-changes/"),
          },
          {
            slug: "branch-diff",
            title: "ブランチ差分",
            body: "閲覧の流れからブランチ差分を確認します。",
            state: "公開中",
            href: sitePath("ja/docs/features/branch-diff/"),
          },
          {
            slug: "repo-graph",
            title: "リポジトリグラフ",
            body: "リポジトリ履歴を読み取り専用のレビュー画面として確認します。",
            state: "公開中",
            href: sitePath("ja/docs/features/repo-graph/"),
          },
          {
            slug: "file-history",
            title: "ファイル履歴",
            body: "選択した文書の過去の変更へ移動します。",
            state: "公開中",
            href: sitePath("ja/docs/features/file-history/"),
          },
          {
            slug: "commit-details-ref-compare",
            title: "コミット詳細と参照比較",
            body: "コミットの文脈と参照比較を文書単位で確認します。",
            state: "公開中",
            href: sitePath("ja/docs/features/commit-details-ref-compare/"),
          },
        ],
      },
      {
        title: "コンテキスト操作",
        items: [
          {
            slug: "document-actions",
            title: "文書操作",
            body: "表示された文書本文から右クリック操作を使います。",
            state: "公開中",
            href: sitePath("ja/docs/features/document-actions/"),
          },
          {
            slug: "heading-toc-actions",
            title: "見出しと Contents の操作",
            body: "見出しや Contents からリンクコピーや移動を行います。",
            state: "公開中",
            href: sitePath("ja/docs/features/heading-toc-actions/"),
          },
          {
            slug: "table-copy-actions",
            title: "表のコピー操作",
            body: "表計算エディタではなく、表示された表のコピーを扱います。",
            state: "公開中",
            href: sitePath("ja/docs/features/table-copy-actions/"),
          },
          {
            slug: "link-document-actions",
            title: "リンク確認と文書操作",
            body: "リンク先を確認してから開く・コピーする操作を扱います。",
            state: "公開中",
            href: sitePath("ja/docs/features/link-document-actions/"),
          },
          {
            slug: "sidebar-tab-actions",
            title: "サイドバーとタブ操作",
            body: "開いているファイル、ブックマーク、タブ、サイドバー項目を操作します。",
            state: "公開中",
            href: sitePath("ja/docs/features/sidebar-tab-actions/"),
          },
        ],
      },
      {
        title: "設定",
        items: [
          {
            slug: "general-settings",
            title: "一般設定",
            body: "内部設定ではなく、読書のための設定として扱います。",
            state: "公開中",
            href: sitePath("ja/docs/features/general-settings/"),
          },
          {
            slug: "zen-mode",
            title: "Zen Mode",
            body: "読書に集中するための表示切り替えを扱います。",
            state: "公開中",
            href: sitePath("ja/docs/features/zen-mode/"),
          },
          {
            slug: "diagram-settings",
            title: "図表設定",
            body: "ローカルレンダリングを主経路にした図表設定を調整します。",
            state: "公開中",
            href: sitePath("ja/docs/features/diagram-settings/"),
          },
          {
            slug: "kroki-settings",
            title: "Kroki 設定",
            body: "Kroki 互換図表の明示的なフォールバックを設定します。",
            state: "公開中",
            href: sitePath("ja/docs/features/kroki-settings/"),
          },
          {
            slug: "network-provider-settings",
            title: "ネットワーク設定",
            body: "外部通信に使うネットワーク設定を確認します。",
            state: "公開中",
            href: sitePath("ja/docs/features/network-provider-settings/"),
          },
          {
            slug: "pr-mr-providers",
            title: "PR / MR Providers",
            body: "ブランチ差分で使う PR / MR 対象ブランチ検出を設定します。",
            state: "公開中",
            href: sitePath("ja/docs/features/pr-mr-providers/"),
          },
          {
            slug: "security-settings",
            title: "セキュリティ設定",
            body: "外部画像とローカルファイルの境界を設定します。",
            state: "公開中",
            href: sitePath("ja/docs/features/security-settings/"),
          },
          {
            slug: "mouse-gestures",
            title: "マウスジェスチャー",
            body: "右ボタンドラッグで実行する操作を確認・調整します。",
            state: "公開中",
            href: sitePath("ja/docs/features/mouse-gestures/"),
          },
          {
            slug: "keybindings",
            title: "ショートカット設定",
            body: "よく使う操作のキーボードショートカットを確認・調整します。",
            state: "公開中",
            href: sitePath("ja/docs/features/keybindings/"),
          },
        ],
      },
      {
        title: "リファレンス",
        items: [
          {
            slug: "supported-diagrams",
            title: "対応図表",
            body: "ローカル表示とフォールバックの対応範囲を一覧します。",
            state: "公開中",
            href: sitePath("ja/docs/features/supported-diagrams/"),
          },
          {
            slug: "command-palette",
            title: "コマンドパレット",
            body: "文書、見出し、コマンドへ素早く移動する入口を確認します。",
            state: "公開中",
            href: sitePath("ja/docs/features/command-palette/"),
          },
        ],
      },
    ],
    features: {
      firstDocument: {
        title: "最初の文書を読む",
        lead: "最初の文書を読むページでは、ローカルフォルダを開き、文書を選んでプレビューで読み始める流れを示します",
        whatThisFeatureIs:
          "Svard はローカルフォルダ内の AsciiDoc / Markdown を、編集対象ではなく読むための文書として開きます。フォルダを開く操作は、プロジェクトを作成する操作ではなく、手元の文書群を読むための入口です。",
        whenToUse:
          "Svard を初めて開いた後、どのフォルダを開き、どのように文書を選んで読み始めるかを確認したい時に使います。",
        workflow: [
          {
            title: "ローカルフォルダを開く",
            body: "File メニューの Open Folder...、または左サイドバー上部の開くボタンから、読む対象のローカルフォルダを選びます。",
            screenshot: screenshot(
              "first-document-open-folder.png",
              "フォルダを開く入口",
              "Open Folder... が見える状態を示します。",
              "Svard のフォルダを開くメニュー",
            ),
          },
          {
            title: "プレビューで読む",
            body: "AsciiDoc または Markdown の文書を選ぶと、ソースを書き換えずにプレビューとして表示されます。",
            screenshot: screenshot(
              "first-document-reader.png",
              "文書プレビュー",
              "Git の変更表示を含まない公開用の文書を閲覧画面で開いた状態を示します。",
              "Svard で最初の文書を開いた画面",
            ),
          },
        ],
        limitations:
          "このページは最初の読み始めに絞ります。Git の変更表示、編集、詳細な検索、差分確認、設定変更はそれぞれの機能ページで扱います。",
        related: [
          "AsciiDoc / Markdown の閲覧",
          "文書内検索",
          "ローカルファーストの考え方",
        ],
        screenshots: [
          screenshot(
            "first-document-open-folder.png",
            "フォルダを開く入口",
            "Open Folder... が見える状態を示します。",
            "Svard のフォルダを開くメニュー",
          ),
          screenshot(
            "first-document-reader.png",
            "文書プレビュー",
            "Git の変更表示を含まない公開用の文書を閲覧画面で開いた状態を示します。",
            "Svard で最初の文書を開いた画面",
          ),
        ],
      },
      privacyModel: {
        title: "ローカルファーストの考え方",
        lead: "Svard は、文書をローカルで扱うことを基本にし、外部サービス利用を暗黙の前提にしません",
        whatThisFeatureIs:
          "Svard はローカルの文書、図表、比較結果を手元で扱うことを基本にします。外部サービスを使う機能は、ユーザーが明示的に設定した場合だけ補助経路として扱います。",
        whenToUse:
          "社内文書、設計メモ、レビュー資料など、公開してはいけない情報を含む可能性がある文書を読む前に確認します。",
        workflow: [
          {
            title: "ローカル文書を開く",
            body: "Svard はローカルフォルダ内の文書を読み、公開サービスへの送信を既定の前提にしません。",
            screenshot: screenshot(
              "files.png",
              "ローカル文書の入口",
              "ローカル文書を選ぶためのファイルツリーを示します。",
              "Svard のファイルツリーとローカル文書",
            ),
          },
          {
            title: "公開成果物に出さない情報を意識する",
            body: "スクリーンショットやログでは、ローカルの絶対パス、認証情報、接続先URL、文書本文を出さない方針です。",
            screenshot: screenshot(
              "privacy-boundary.png",
              "プライバシー境界",
              "公開成果物に出さない情報の境界を説明する設定画面を示します。",
              "Svard のプライバシー境界を説明する画面",
            ),
          },
        ],
        limitations:
          "このページは Docs 公開時の考え方を説明するものです。完全なセキュリティ機能一覧、監査手順、組織ポリシーの代替ではありません。",
        related: [
          "Svard とは",
          "明示的な Kroki フォールバック",
          "セキュリティ設定",
        ],
        screenshots: [
          screenshot(
            "files.png",
            "ローカル文書の入口",
            "ローカル文書を選ぶためのファイルツリーを示します。",
            "Svard のファイルツリーとローカル文書",
          ),
          screenshot(
            "privacy-boundary.png",
            "プライバシー境界",
            "公開成果物に出さない情報の境界を説明する設定画面を示します。",
            "Svard のプライバシー境界を説明する画面",
          ),
        ],
      },
      documentsOrder: {
        title: "MkDocs / Antora の読書順",
        lead: "公開ドキュメントで読者がたどる順序、または自分で開いた文書だけの一時的な読書順で読めます",
        whatThisFeatureIs:
          "Svard は対応文書を、現在開いている文書ツリー、静的な MkDocs nav 順、Zensical nav 順、またはローカル Antora nav 順で表示できます。プロジェクト nav は公開サイトの読書順を使い、Docs: Loaded は必要な文書だけを開いて一時的な自分用アウトラインを作れます。",
        whenToUse:
          "Markdown / AsciiDoc ファイルが多く、公開ドキュメントの順序で読みたい場合や、レビュー対象だけを開いて小さな読書導線を作りたい場合に使います。",
        workflow: [
          {
            title: "読書ワークフローを選ぶ",
            body: "Files で Documents only に切り替え、Docs: Loaded で開いた文書だけの一時ツリーを使うか、利用可能な場合は Docs: MkDocs、Docs: Zensical、Docs: Antora でプロジェクト定義のナビ順を使います。",
            screenshot: screenshot(
              "documents-order.png",
              "MkDocs / Antora の読書順",
              "Files サイドバーで Documents only を静的サイトのナビゲーション順で表示している状態を示します。",
              "Svard の Documents only が MkDocs、Zensical、または Antora のナビゲーション順に並ぶ画面",
            ),
          },
          {
            title: "一時的な読書ツリーを作る",
            body: "必要な文書だけを開き、Docs: Loaded で workspace 相対の小さなツリーとして保持します。プロジェクト nav には無いレビュー導線を作るときに使えます。",
          },
          {
            title: "レビュー用フィルターは維持する",
            body: "All / Changed は同じ位置に残ります。行の順序を変えても、Git バッジや open 表示は引き続き使えます。",
          },
          {
            title: "ビルドせずに静的ナビゲーションを使う",
            body: "MkDocs は静的な mkdocs.yml の nav と docs_dir、Zensical は zensical.toml の project nav と docs_dir、Antora はローカルの antora.yml nav と標準 antora-playbook.yml の content root を使います。",
          },
        ],
        supportMatrix: {
          title: "対応するナビゲーション情報",
          lead: "Svard は静的なナビゲーション情報を再利用して、ローカル文書の読書順を作ります。静的サイトをビルドする機能ではありません。",
          columns: ["対象", "対応", "補足"],
          rows: [
            [
              "Loaded",
              "対応",
              "選択中フォルダ内で現在開いている対応文書を、一時的な読書ツリーとして表示します。",
            ],
            [
              "MkDocs の静的 nav",
              "対応",
              "ローカルの mkdocs.yml / mkdocs.yaml から docs_dir と nav を読みます。プラグインは実行しません。",
            ],
            [
              "Zensical の静的 nav",
              "対応",
              "ローカルの zensical.toml から project docs_dir と nav を読みます。Zensical は実行しません。",
            ],
            [
              "Antora の静的 nav",
              "対応",
              "ローカルの antora.yml nav と、標準 antora-playbook.yml のローカルコンテンツルートを読みます。",
            ],
            [
              "生成 nav / プラグイン nav",
              "非対応",
              "MkDocs プラグイン、Zensical extension、Antora extension、リモート取得、ビルド後に生成されるナビゲーションは実行しません。",
            ],
            [
              "nav とファイルツリーの差分",
              "部分対応",
              "読み込み範囲外の nav 文書は missing 行、nav に無い読み込み済みツリー文書は Not in nav グループとして扱います。",
            ],
          ],
          note: "どの対象でも、開いたローカル workspace の境界内だけを扱い、ソース本文、プライベートな絶対パス、リモートエンドポイント値は公開表示に出しません。",
        },
        limitations:
          "Svard は MkDocs プラグイン、Zensical ビルド、Zensical extension、Antora ビルド、Antora 拡張、リモートリポジトリ取得、生成 nav を実行しません。動的なナビゲーションは Docs: Loaded の一時ツリーに戻すか、安全に読めるローカルの静的な範囲だけを表示します。",
        related: ["タブと開いているファイル", "クイックオープン", "変更一覧"],
        screenshots: [
          screenshot(
            "documents-order.png",
            "MkDocs / Antora の読書順",
            "Files サイドバーで Documents only を静的サイトのナビゲーション順で表示している状態を示します。",
            "Svard の Documents only が MkDocs、Zensical、または Antora のナビゲーション順に並ぶ画面",
          ),
        ],
      },
      tabsOpenFiles: {
        title: "タブと開いているファイル",
        lead: "タブと開いているファイルは、複数の文書を読み比べながら行き来するための読書セッションです",
        whatThisFeatureIs:
          "Svard は開いた文書をタブとして保持し、サイドバーの開いているファイル一覧からも切り替えられます。ファイル管理ではなく、読む文書の文脈を保つための機能です。",
        whenToUse:
          "設計メモ、手順書、補足資料などを並行して読み、元の文書へすぐ戻りたい時に使います。",
        workflow: [
          {
            title: "複数の文書を開く",
            body: "ファイルツリーから文書を開くと、タブと開いているファイル一覧に読みかけの文書が残ります。",
            screenshot: screenshot(
              "tabs-open-files.png",
              "タブと開いているファイル",
              "ファイルツリーと開いているファイル一覧を同時に示します。",
              "Svard のファイルツリーと開いているファイル一覧",
            ),
          },
          {
            title: "読みたい文書へ戻る",
            body: "タブは上部で素早く切り替え、開いているファイル一覧は今の読書セッション全体を確認する入口として使います。",
            screenshot: screenshot(
              "tabs-open-files-tabs.png",
              "タブバーでの切り替え",
              "サイドバーを閉じた状態で、上部のタブバーから文書を確認できる画面を示します。",
              "Svard のタブバーで文書を開いている画面",
            ),
          },
        ],
        limitations:
          "このページではタブ、開いているファイル、ファイルツリーの役割に絞ります。履歴、閉じたタブの復元、分割表示、ブックマークは別の機能として扱います。",
        related: ["履歴と閉じたタブ", "分割表示", "クイックオープン"],
        screenshots: [
          screenshot(
            "tabs-open-files.png",
            "タブと開いているファイル",
            "ファイルツリーと開いているファイル一覧を同時に示します。",
            "Svard のファイルツリーと開いているファイル一覧",
          ),
          screenshot(
            "tabs-open-files-tabs.png",
            "タブバーでの切り替え",
            "サイドバーを閉じた状態で、上部のタブバーから文書を確認できる画面を示します。",
            "Svard のタブバーで文書を開いている画面",
          ),
        ],
      },
      historyRecentlyClosed: {
        title: "履歴と閉じたタブ",
        lead: "履歴と閉じたタブは、読んでいた文書へ戻り、読書の文脈を復元するための入口です",
        whatThisFeatureIs:
          "Svard は最近開いた文書、最近使ったフォルダ、閉じたタブを記録し、読みかけの文書へ戻りやすくします。最近開いた文書は開始画面または History メニューから開き、閉じたタブは History > Recently Closed、Restore Last Closed File、またはショートカットで復元できます。ファイルを探し直すための機能ではなく、読書の流れを戻すための機能です。",
        whenToUse:
          "別の文書を確認した後で元の文書へ戻る時や、閉じてしまったタブをもう一度開きたい時に使います。",
        supportMatrix: {
          title: "戻り方",
          lead: "戻りたい対象によって、使う入口が変わります。",
          columns: ["対象", "入口", "補足"],
          rows: [
            [
              "最近開いた文書",
              "開始画面、または History メニューの Recent Documents",
              "文書名から前回読んだ文書へ戻ります。",
            ],
            [
              "最近使ったフォルダ",
              "開始画面、または History メニューの Recent Folders",
              "フォルダ単位で読書作業を再開します。",
            ],
            [
              "閉じたタブ",
              "History > Recently Closed",
              "閉じた文書を一覧から選んで復元します。",
            ],
            [
              "最後に閉じたタブ",
              "Restore Last Closed File、または Cmd+Shift+T / Ctrl+Shift+T",
              "直前に閉じた文書をすぐ復元します。",
            ],
          ],
          note: "ショートカットはデフォルト設定です。実際の割り当てはアプリ内のショートカット表示に従います。",
        },
        workflow: [
          {
            title: "最近開いた文書から戻る",
            body: "開始画面や History メニューから、最近開いた文書やフォルダへ戻れます。閉じたタブは Recently Closed から選ぶか、Restore Last Closed File / Cmd+Shift+T / Ctrl+Shift+T で直前の文書を復元します。",
            screenshot: screenshot(
              "history-recently-closed.png",
              "最近開いた文書",
              "最近開いた文書とフォルダを開始画面に表示した状態を示します。",
              "Svard の開始画面で最近開いた文書を表示している画面",
            ),
          },
        ],
        limitations:
          "このページでは戻る入口だけを扱います。すべての履歴項目、カスタムショートカット、タブ復元の細かい条件は説明しません。",
        related: [
          "タブと開いているファイル",
          "クイックオープン",
          "ブックマーク",
        ],
        screenshots: [
          screenshot(
            "history-recently-closed.png",
            "最近開いた文書",
            "最近開いた文書とフォルダを開始画面に表示した状態を示します。",
            "Svard の開始画面で最近開いた文書を表示している画面",
          ),
        ],
      },
      splitView: {
        title: "分割表示",
        lead: "分割表示は、2つの文書や表示を横に並べて読み比べるための表示切り替えです",
        whatThisFeatureIs:
          "Split View では、閲覧画面を左右に分けて文書を確認できます。片方で本文を読み、もう片方で参照文書や関連箇所を見る時に使います。",
        whenToUse:
          "仕様と補足資料、変更前後の説明、長い文書内の離れた箇所を見比べたい時に使います。",
        workflow: [
          {
            title: "分割表示を開く",
            body: "閲覧画面の上部にある分割表示ボタンを押すと、現在の文書を左右に並べる表示へ切り替わります。View メニューの Layout から Split View を選ぶこともできます。",
            screenshot: screenshot(
              "split-view-entry.png",
              "分割表示ボタン",
              "閲覧画面上部の分割表示ボタンにフォーカスした状態を示します。",
              "Svard の閲覧画面で分割表示ボタンにフォーカスしている画面",
            ),
          },
          {
            title: "文書を左右に並べる",
            body: "分割表示に切り替えた後は、必要な文書をそれぞれのペインで開いて読み比べます。片方に主文書、もう片方に参照文書を置くと、行き来せずに確認できます。",
            screenshot: screenshot(
              "split-view.png",
              "分割表示",
              "閲覧画面を左右に分けて表示した状態を示します。",
              "Svard で分割表示を使って文書を並べている画面",
            ),
          },
        ],
        limitations:
          "分割表示は読み比べのための表示切り替えです。このページではペイン操作の全手順、差分比較、タブ管理の詳細は扱いません。",
        related: [
          "タブと開いているファイル",
          "ブランチ差分",
          "ファイル同士の比較",
        ],
        screenshots: [
          screenshot(
            "split-view-entry.png",
            "分割表示ボタン",
            "閲覧画面上部の分割表示ボタンにフォーカスした状態を示します。",
            "Svard の閲覧画面で分割表示ボタンにフォーカスしている画面",
          ),
          screenshot(
            "split-view.png",
            "分割表示",
            "閲覧画面を左右に分けて表示した状態を示します。",
            "Svard で分割表示を使って文書を並べている画面",
          ),
        ],
      },
      bookmarks: {
        title: "ブックマーク",
        lead: "ブックマークは、よく読むフォルダや文書をサイドバーに残すための入口です",
        whatThisFeatureIs:
          "Svard のブックマークには、フォルダや文書を登録できます。毎回ファイルツリーをたどらず、よく使う読書対象へ戻るための機能です。",
        whenToUse:
          "同じ設計資料、運用手順、レビュー対象フォルダを繰り返し読む場合に使います。",
        workflow: [
          {
            title: "よく読む場所を残す",
            body: "Bookmarks サイドバーにフォルダや文書を登録しておくと、次回以降の入口として使えます。",
            screenshot: screenshot(
              "bookmarks.png",
              "ブックマーク",
              "Bookmarks サイドバーにフォルダと文書が並ぶ状態を示します。",
              "Svard の Bookmarks サイドバー",
            ),
          },
        ],
        limitations:
          "ブックマークは読書対象への入口です。このページでは同期、共有、外部サービス連携、詳細な並べ替え操作は扱いません。",
        related: [
          "履歴と閉じたタブ",
          "タブと開いているファイル",
          "クイックオープン",
        ],
        screenshots: [
          screenshot(
            "bookmarks.png",
            "ブックマーク",
            "Bookmarks サイドバーにフォルダと文書が並ぶ状態を示します。",
            "Svard の Bookmarks サイドバー",
          ),
        ],
      },
      quickOpen: {
        title: "クイックオープン",
        lead: "クイックオープンは、長いファイルツリーをたどらずに文書、見出し、コマンドへ移動する入口です",
        whatThisFeatureIs:
          "Svard のクイックオープンは、読書中にキーボード中心で移動先を探すための重ね合わせ画面です。同じ入力欄から、文書を開く、コマンドを実行する、現在の文書の見出しへ移動する、ソース行に近い表示位置へ移動する、といった操作ができます。",
        whenToUse:
          "目的の文書名、見出し、コマンド名、ソース行番号の一部が分かっていて、サイドバーを何度も開閉せずに移動したい時に使います。",
        supportMatrix: {
          title: "入力モード",
          lead: "入力欄の先頭文字で、クイックオープンが探す対象が変わります。",
          columns: ["入力", "探す対象", "使う場面"],
          rows: [
            [
              "文字列",
              "文書",
              "開いている文書、最近使った文書、ブックマーク、表示済みのファイルツリー内の文書を開きます。",
            ],
            [
              ">",
              "コマンド",
              "Preferences を開く、Source Control を表示する、ファイル比較を開始するなどの操作を実行します。",
            ],
            ["@", "見出し", "現在の文書内の見出しへ移動します。"],
            [
              ":N",
              "ソース行",
              "見出し、ソースブロック、診断、図表位置など、対応する表示位置へ行番号から移動します。",
            ],
          ],
          note: "現時点のアプリでは # はクイックオープンのモード切り替えには使いません。ソース行への移動は : に行番号を続けて入力します。",
        },
        workflow: [
          {
            title: "メニューまたはショートカットで開く",
            body: "クイックオープンは File メニューの Quick Open... または割り当てられたショートカットから開きます。上部ツールバーには常設しません。",
          },
          {
            title: "候補を絞り込む",
            body: "文書を探す時はそのまま文字を入力し、コマンドは >、見出しは @、ソース行への移動は : と行番号を入力します。接頭辞を変えると、入力欄の右側に出るモード表示も変わります。",
            screenshot: screenshot(
              "quick-open.png",
              "クイックオープンの候補",
              "入力欄にフォーカスしたクイックオープンと候補一覧を示します。",
              "Svard のクイックオープン候補一覧",
            ),
          },
        ],
        limitations:
          "このページでは移動入口としての概要だけを扱います。すべてのコマンド一覧やシェル風の検索構文はここでは説明しません。実際のショートカット表示はアプリメニュー側に従います。",
        related: ["タブと開いているファイル", "文書内検索", "検索結果の移動"],
        screenshots: [
          screenshot(
            "quick-open.png",
            "クイックオープンの候補",
            "入力欄にフォーカスしたクイックオープンと候補一覧を示します。",
            "Svard のクイックオープン候補一覧",
          ),
        ],
      },
      readingMarkup: {
        title: "AsciiDoc / Markdown の閲覧",
        lead: "Svard はローカルの AsciiDoc / Markdown を、編集対象ではなく読む文書として開きます",
        whatThisFeatureIs:
          "Markdown と AsciiDoc を同じ閲覧画面で表示します。見出し、リスト、表などを文書として読み、閲覧のために元ファイルを書き換えることはありません。",
        whenToUse:
          "ローカルにあるガイド、設計メモ、運用手順、リポジトリ内ドキュメントを、形式ごとに別のアプリへ切り替えず確認したい時に使います。",
        workflow: [
          {
            title: "Markdown を文書として読む",
            body: "Markdown の見出し、リスト、表をプレビュー画面で読みます。編集画面ではなく、読みやすい文書表示を主役にします。",
            screenshot: screenshot(
              "reading-markup-markdown.png",
              "Markdown の閲覧",
              "Markdown 文書を閲覧画面で開いた状態を示します。",
              "Svard で Markdown 文書を表示している画面",
            ),
          },
          {
            title: "AsciiDoc を文書として読む",
            body: "AsciiDoc の見出しや表を同じ閲覧画面で読みます。Markdown と AsciiDoc を同じ reader contract で扱います。",
            screenshot: screenshot(
              "reading-markup-asciidoc.png",
              "AsciiDoc の閲覧",
              "AsciiDoc 文書を閲覧画面で開いた状態を示します。",
              "Svard で AsciiDoc 文書を表示している画面",
            ),
          },
        ],
        limitations:
          "Svard はエディタではありません。執筆機能、共同編集、すべての公開システムとの完全互換は約束しません。公開ページでは、表示結果が分かる短いサンプルだけを使います。",
        related: [
          "Contents サイドバー",
          "タブと開いているファイル",
          "文書内検索",
        ],
        screenshots: [
          screenshot(
            "reading-markup-markdown.png",
            "Markdown の閲覧",
            "Markdown 文書を閲覧画面で開いた状態を示します。",
            "Svard で Markdown 文書を表示している画面",
          ),
          screenshot(
            "reading-markup-asciidoc.png",
            "AsciiDoc の閲覧",
            "AsciiDoc 文書を閲覧画面で開いた状態を示します。",
            "Svard で AsciiDoc 文書を表示している画面",
          ),
        ],
      },
      tableOfContents: {
        title: "Contents サイドバー",
        lead: "Contents サイドバーは、長い文書の見出しを右側にまとめ、読みたい節へ移動するための入口です",
        whatThisFeatureIs:
          "Svard は文書内の見出しから見出し一覧を作り、右サイドバーの Contents に表示します。本文をスクロールし続けなくても、章や節の位置を見ながら読み進められます。",
        whenToUse:
          "設計書、運用手順、長いレビュー資料など、見出しを頼りに必要な説明へ移動したい時に使います。",
        workflow: [
          {
            title: "見出し一覧を確認する",
            body: "右サイドバーの Contents で、今開いている文書の見出し構造を確認します。",
            screenshot: screenshot(
              "table-of-contents.png",
              "Contents と本文",
              "右サイドバーの Contents と本文見出しを同時に示します。",
              "Svard の Contents サイドバーと本文を表示している画面",
            ),
          },
          {
            title: "読みたい節へ移動する",
            body: "Contents の項目を選ぶと、対応する見出しへ移動します。長い文書でも読んでいる位置を見失いにくくなります。",
            screenshot: screenshot(
              "table-of-contents-jump.png",
              "Contents から移動した状態",
              "Contents 項目から文書内の見出しへ移動した状態を示します。",
              "Svard の Contents サイドバーから文書内見出しへ移動した画面",
            ),
          },
        ],
        limitations:
          "Contents サイドバーは文書内の見出しから作られます。見出しのない文書や、対応していない書き方の見出しは一覧に出ない場合があります。見出しの設計方法や執筆ルールはこのページでは扱いません。",
        related: [
          "AsciiDoc / Markdown の閲覧",
          "文書内検索",
          "クイックオープン",
        ],
        screenshots: [
          screenshot(
            "table-of-contents.png",
            "Contents と本文",
            "右サイドバーの Contents と本文見出しを同時に示します。",
            "Svard の Contents サイドバーと本文を表示している画面",
          ),
          screenshot(
            "table-of-contents-jump.png",
            "Contents から移動した状態",
            "Contents 項目から文書内の見出しへ移動した状態を示します。",
            "Svard の Contents サイドバーから文書内見出しへ移動した画面",
          ),
        ],
      },
      includesLocalAssets: {
        title: "インクルードとローカル素材",
        lead: "Svard は AsciiDoc の取り込み結果やローカル画像を、公開サービスに頼らず文書の一部として表示します",
        whatThisFeatureIs:
          "AsciiDoc の取り込み済み本文やローカル画像を、閲覧画面の表示結果として確認できます。元ファイルを書き換えるのではなく、手元の文書を読むために解決した結果を表示します。",
        whenToUse:
          "複数ファイルに分かれた手順書や、同じフォルダ内の画像を含む文書を、完成した文書として確認したい時に使います。",
        workflow: [
          {
            title: "取り込み済み本文と画像を読む",
            body: "取り込まれた短い本文とローカル画像を、通常の閲覧画面の中で確認します。",
            screenshot: screenshot(
              "includes-local-assets.png",
              "取り込み済み本文とローカル画像",
              "取り込み済み本文とローカル画像を文書として表示した状態を示します。",
              "Svard で取り込み済み本文とローカル画像を表示している画面",
            ),
          },
          {
            title: "安全な参照範囲を確認する",
            body: "Contents では、文書に取り込まれたファイルを安全な範囲の情報として確認できます。公開用画像では絶対パスや本文全文を出しません。",
            screenshot: screenshot(
              "includes-local-assets-boundary.png",
              "取り込みの境界",
              "取り込み対象を右サイドバーで確認できる状態を示します。",
              "Svard の右サイドバーで取り込み対象を確認している画面",
            ),
          },
        ],
        limitations:
          "このページでは安全な公開サンプルだけを扱います。対応していない取り込み、ワークスペース外の参照、巨大な素材、外部画像の読み込み方針は、個別の制限や設定に従います。",
        related: [
          "AsciiDoc / Markdown の閲覧",
          "ローカルファーストの考え方",
          "セキュリティ設定",
        ],
        screenshots: [
          screenshot(
            "includes-local-assets.png",
            "取り込み済み本文とローカル画像",
            "取り込み済み本文とローカル画像を文書として表示した状態を示します。",
            "Svard で取り込み済み本文とローカル画像を表示している画面",
          ),
          screenshot(
            "includes-local-assets-boundary.png",
            "取り込みの境界",
            "取り込み対象を右サイドバーで確認できる状態を示します。",
            "Svard の右サイドバーで取り込み対象を確認している画面",
          ),
        ],
      },
      themesZoom: {
        title: "テーマと拡大率",
        lead: "テーマと拡大率は、編集設定ではなく、文書を読みやすくするための表示調整です",
        whatThisFeatureIs:
          "Svard は画面テーマ、AsciiDoc の表示テーマ、本文の拡大率を読書用の設定として扱います。文書の内容は変えず、読む環境に合わせて見え方を調整します。",
        whenToUse:
          "長時間読む時、暗い環境で読む時、本文が小さく感じる時、AsciiDoc の見え方を変えて確認したい時に使います。",
        workflow: [
          {
            title: "表示設定を選ぶ",
            body: "Preferences の General で、画面テーマ、AsciiDoc テーマ、拡大率を確認します。",
            screenshot: screenshot(
              "themes-zoom-preferences.png",
              "表示設定",
              "Preferences の General にあるテーマと拡大率の設定を示します。",
              "Svard の表示設定画面",
            ),
          },
          {
            title: "本文の見え方を確認する",
            body: "設定した見え方は閲覧画面に反映されます。文書本文を読みながら、自分に合う表示へ調整します。",
            screenshot: screenshot(
              "themes-zoom-reader.png",
              "表示設定後の閲覧画面",
              "テーマと拡大率が反映された閲覧画面を示します。",
              "Svard でテーマと拡大率を反映した閲覧画面",
            ),
          },
        ],
        limitations:
          "表示設定は文書の内容や元ファイルを変更しません。すべての公開サイトや執筆環境と同じ見た目を再現する機能ではありません。",
        related: ["AsciiDoc / Markdown の閲覧", "Zen Mode", "一般設定"],
        screenshots: [
          screenshot(
            "themes-zoom-preferences.png",
            "表示設定",
            "Preferences の General にあるテーマと拡大率の設定を示します。",
            "Svard の表示設定画面",
          ),
          screenshot(
            "themes-zoom-reader.png",
            "表示設定後の閲覧画面",
            "テーマと拡大率が反映された閲覧画面を示します。",
            "Svard でテーマと拡大率を反映した閲覧画面",
          ),
        ],
      },
      zenMode: {
        title: "Zen Mode",
        lead: "Zen Mode は、文書を読む時だけ周辺 UI を減らし、本文に視線を集める表示切替です",
        whatThisFeatureIs:
          "Svard の Zen Mode は、閲覧中の文書を中央に置き、設定に応じて上部バー、サイドバー、タブ、状態表示を隠します。文書そのものを変えず、読む時の画面密度を下げます。",
        whenToUse:
          "長い仕様書、レビュー資料、手順書を、検索やファイル操作から一度離れて読みたい時に使います。",
        workflow: [
          {
            title: "上部バーから切り替える",
            body: "上部バーの Zen Mode ボタンから切り替えます。ほかの入口もありますが、このページでは代表的な入口だけを示します。",
            screenshot: screenshot(
              "zen-mode-entry.png",
              "Zen Mode の入口",
              "上部バーの Zen Mode ボタンにフォーカスした状態を示します。",
              "Svard の上部バーにある Zen Mode ボタン",
            ),
          },
          {
            title: "本文に集中して読む",
            body: "Zen Mode 中は周辺 UI が減り、本文が中央寄せで表示されます。必要な時は右下のボタンから通常表示へ戻れます。",
            screenshot: screenshot(
              "zen-mode.png",
              "Zen Mode 中の閲覧画面",
              "周辺 UI を減らして文書本文を表示した状態を示します。",
              "Svard の Zen Mode 中の閲覧画面",
            ),
          },
        ],
        limitations:
          "Zen Mode は読書用の表示切替です。すべての操作を隠す保証や、プレゼンテーション表示の代替ではありません。詳細な設定項目は Preferences の Zen Mode に従います。",
        related: ["テーマと拡大率", "タブと開いているファイル", "一般設定"],
        screenshots: [
          screenshot(
            "zen-mode-entry.png",
            "Zen Mode の入口",
            "上部バーの Zen Mode ボタンにフォーカスした状態を示します。",
            "Svard の上部バーにある Zen Mode ボタン",
          ),
          screenshot(
            "zen-mode.png",
            "Zen Mode 中の閲覧画面",
            "周辺 UI を減らして文書本文を表示した状態を示します。",
            "Svard の Zen Mode 中の閲覧画面",
          ),
        ],
      },
      currentFileSearch: {
        title: "文書内検索",
        lead: "文書内検索は、今読んでいる文書の中だけを探すための検索です",
        whatThisFeatureIs:
          "検索対象を現在の文書に限定します。見出し、用語、繰り返し出てくる表現を探しながら、プレビューを読んでいる状態を保てます。",
        whenToUse:
          "対象の文書が分かっていて、その文書内をすばやく移動したい時に使います。",
        workflow: [
          {
            title: "現在の文書の中を検索する",
            body: "文書内検索を開き、公開用サンプルに含まれる短い語で検索します。一致一覧と本文側のハイライトを同時に見ながら、前後の文脈を確認できます。",
            screenshot: screenshot(
              "search.png",
              "文書内検索パネル",
              "現在の文書だけを対象にした検索画面と本文側の一致箇所を示します。",
              "Svard の文書内検索画面",
            ),
          },
        ],
        limitations:
          "検索例とスクリーンショットには、公開してよい語だけを使います。ローカル文書の検索一致テキストは、公開用サンプルとして準備した場合だけ公開成果物に出します。",
        related: [
          "ワークスペース検索",
          "検索結果の移動",
          "Contents サイドバー",
        ],
        screenshots: [
          screenshot(
            "search.png",
            "文書内検索パネル",
            "現在の文書だけを対象にした検索画面と本文側の一致箇所を示します。",
            "Svard の文書内検索画面",
          ),
        ],
      },
      workspaceSearch: {
        title: "ワークスペース検索",
        lead: "ワークスペース検索は、開いているフォルダ全体から文書を探すための検索です",
        whatThisFeatureIs:
          "現在の文書だけではなく、開いているフォルダ内の対応文書を横断して探します。結果にはファイル名、該当行、短い一致文脈が表示され、読みたい文書へ移動できます。",
        whenToUse:
          "どの文書に目的の説明があるか分からない時や、同じ語が複数の設計メモ、手順書、レビュー資料に出てくるか確認したい時に使います。",
        workflow: [
          {
            title: "フォルダ全体を検索する",
            body: "検索対象をすべてのファイルに切り替え、公開用サンプルに含まれる短い語で検索します。",
            screenshot: screenshot(
              "workspace-search.png",
              "ワークスペース検索の結果",
              "開いているフォルダ内の複数文書から見つかった検索結果を示します。",
              "Svard のワークスペース検索結果画面",
            ),
          },
          {
            title: "結果から文書へ移動する",
            body: "検索結果を選び、該当する文書を開いた状態で確認します。検索結果一覧は残るため、別の一致にも戻れます。",
            screenshot: screenshot(
              "workspace-search-result.png",
              "検索結果から開いた文書",
              "ワークスペース検索の結果から文書を開いた状態を示します。",
              "Svard のワークスペース検索結果から文書へ移動した画面",
            ),
          },
        ],
        limitations:
          "検索対象は開いているフォルダと対応文書に限定されます。公開スクリーンショットでは公開用サンプルの短い語だけを使い、ローカルの絶対パスや非公開文書の本文は含めません。",
        related: ["文書内検索", "検索結果の移動", "クイックオープン"],
        screenshots: [
          screenshot(
            "workspace-search.png",
            "ワークスペース検索の結果",
            "開いているフォルダ内の複数文書から見つかった検索結果を示します。",
            "Svard のワークスペース検索結果画面",
          ),
          screenshot(
            "workspace-search-result.png",
            "検索結果から開いた文書",
            "ワークスペース検索の結果から文書を開いた状態を示します。",
            "Svard のワークスペース検索結果から文書へ移動した画面",
          ),
        ],
      },
      searchResultNavigation: {
        title: "検索結果の移動",
        lead: "検索結果の移動は、一致した箇所を開いた後も検索文脈を保ったまま読み進めるための機能です",
        whatThisFeatureIs:
          "Svard の検索結果は、文書を開いて終わりではなく、結果一覧と本文の位置をつなげて扱います。現在の文書内検索でもワークスペース検索でも、結果を選ぶと該当箇所へ移動できます。",
        whenToUse:
          "同じ語が複数箇所に出てくる文書や、フォルダ全体の検索結果を順番に確認したい時に使います。",
        workflow: [
          {
            title: "検索結果から文書へ移動する",
            body: "結果を選ぶと、該当する文書と位置を開きます。検索一覧を残したまま、別の一致にも戻れます。",
            screenshot: screenshot(
              "workspace-search-result.png",
              "検索結果から開いた文書",
              "検索結果から文書を開き、検索一覧が残っている状態を示します。",
              "Svard の検索結果から文書へ移動した画面",
            ),
          },
          {
            title: "文書内の一致を確認する",
            body: "現在の文書内では、検索欄と一致位置を使って前後の文脈を確認します。",
            screenshot: screenshot(
              "search.png",
              "文書内検索",
              "現在の文書内検索で一致箇所を確認する状態を示します。",
              "Svard の文書内検索結果画面",
            ),
          },
        ],
        limitations:
          "検索結果の移動は読書中の移動補助です。検索インデックスの内部仕様、すべての検索演算子、置換機能は扱いません。公開画像では公開用サンプルの短い語だけを使います。",
        related: ["文書内検索", "ワークスペース検索", "クイックオープン"],
        screenshots: [
          screenshot(
            "workspace-search-result.png",
            "検索結果から開いた文書",
            "検索結果から文書を開き、検索一覧が残っている状態を示します。",
            "Svard の検索結果から文書へ移動した画面",
          ),
          screenshot(
            "search.png",
            "文書内検索",
            "現在の文書内検索で一致箇所を確認する状態を示します。",
            "Svard の文書内検索結果画面",
          ),
        ],
      },
      localDiagramRendering: {
        title: "ローカル図表レンダリング",
        lead: "Svard は Mermaid / PlantUML / Graphviz を、技術文書内の図表としてローカルレンダリングすることを主経路にします",
        whatThisFeatureIs:
          "図表を文書プレビューの中に表示します。周辺の本文と合わせて読み、差分確認でも表示結果の変化を確認できます。",
        whenToUse:
          "アーキテクチャメモ、シーケンス図、依存関係図など、図表を本文と一緒に読みたい文書で使います。",
        workflow: [
          {
            title: "図表を文書の一部として読む",
            body: "レンダリング済みの図表は、周辺の技術文書と同じプレビュー画面に表示されます。本文内の図表をダブルクリックするか、右クリックメニューからプレビューを開けます。",
            screenshot: screenshot(
              "diagram-inline-preview-entry.png",
              "本文内の図表",
              "文書本文に表示された図表にフォーカスした状態を示します。",
              "Svard の文書本文でローカルレンダリングされた図表にフォーカスしている画面",
            ),
          },
          {
            title: "大きく表示して確認する",
            body: "本文内で小さく見える図表は、プレビューで大きく開いて確認できます。文書を読みながら、必要な図表だけを拡大して確認する流れです。",
            screenshot: screenshot(
              "diagram-preview.png",
              "図表プレビュー",
              "本文内の図表を大きなプレビューで確認している状態を示します。",
              "Svard でローカルレンダリングされた図表をプレビュー表示している画面",
            ),
          },
        ],
        limitations:
          "Kroki は未対応、完全互換、またはユーザーが明示設定した場合のフォールバックとして扱います。すべてのリモートレンダラーとの完全互換は約束しません。公開成果物には機密情報を含めない方針です。",
        related: [
          "明示的な Kroki フォールバック",
          "図表インスペクタ",
          "図表の書き出しとプレビュー",
          "プレビューベースの差分確認",
        ],
        screenshots: [
          screenshot(
            "diagram-inline-preview-entry.png",
            "本文内の図表",
            "文書本文に表示された図表にフォーカスした状態を示します。",
            "Svard の文書本文でローカルレンダリングされた図表にフォーカスしている画面",
          ),
          screenshot(
            "diagram-preview.png",
            "図表プレビュー",
            "本文内の図表を大きなプレビューで確認している状態を示します。",
            "Svard でローカルレンダリングされた図表をプレビュー表示している画面",
          ),
        ],
      },
      krokiFallback: {
        title: "明示的な Kroki フォールバック",
        lead: "Kroki フォールバックは、ローカル表示で扱えない図表をユーザーの明示設定で補うための選択肢です",
        whatThisFeatureIs:
          "Svard はローカルレンダリングを主経路にします。Kroki は、未対応の図表、完全互換が必要な図表、またはユーザーが明示的に設定した場合だけ使う補助経路です。",
        whenToUse:
          "ローカル表示だけでは図表を確認できない時や、既存の文書公開環境と同じ表示結果を確認したい時に使います。",
        workflow: [
          {
            title: "設定で明示的に選ぶ",
            body: "Kroki を使う場合は、設定画面で利用方針を明示的に選びます。公開サイトでは接続先の値は見せません。",
            screenshot: screenshot(
              "kroki-fallback.png",
              "Kroki フォールバック設定",
              "外部フォールバックを明示的に設定する画面を示します。",
              "Svard の Kroki フォールバック設定画面",
            ),
          },
          {
            title: "フォールバック順序を理解する",
            body: "通常は Mermaid、PlantUML、Graphviz をローカルで表示します。ローカル表示で足りない場合だけ、ユーザーが明示した図表に対して Kroki フォールバックを試します。PlantUML では、外部 PlantUML フォールバックを明示設定している場合、それを先に試してから Kroki を使うか判断します。",
          },
        ],
        limitations:
          "Kroki は既定の公開サービス依存ではありません。公開成果物には機密情報を含めない方針です。詳しい境界はローカルファーストの考え方で扱います。",
        related: [
          "ローカル図表レンダリング",
          "図表インスペクタ",
          "ローカルファーストの考え方",
        ],
        screenshots: [
          screenshot(
            "kroki-fallback.png",
            "Kroki フォールバック設定",
            "外部フォールバックを明示的に設定する画面を示します。",
            "Svard の Kroki フォールバック設定画面",
          ),
        ],
      },
      externalPlantumlFallback: {
        title: "外部 PlantUML フォールバック",
        lead: "外部 PlantUML フォールバックは、ユーザーが明示した高度なケースだけで使う補助経路です",
        whatThisFeatureIs:
          "Svard は PlantUML もローカル表示を主経路にします。外部 PlantUML フォールバックは、ローカル表示で対応できない図表を扱うために、ユーザーが Native PlantUML の実行ファイルを用意し、明示設定した場合だけ使う高度な経路です。",
        whenToUse:
          "手元の図表がローカル表示では足りず、Native PlantUML をダウンロードしてローカルの実行ファイルとして管理できる場合に確認します。",
        workflow: [
          {
            title: "まずローカル表示を確認する",
            body: "通常はローカル表示を基準にし、図表一覧でレンダラーと状態を確認します。",
            screenshot: screenshot(
              "diagram-inspector.png",
              "図表の状態",
              "図表一覧で複数図表の状態を確認する画面を示します。",
              "Svard の Diagrams タブ",
            ),
          },
          {
            title: "Native PlantUML を設定する",
            body: "外部 PlantUML フォールバックを使うには、ユーザーが PlantUML のリリースから native-plantuml を別途ダウンロードし、その実行ファイルの場所を設定します。native-plantuml は PlantUML を Native Image として配布する実行ファイルです。通常版の配布情報やライセンスは PlantUML 公式ダウンロードページでも確認できます。Svard は同梱や自動取得を前提にせず、設定されたローカル実行ファイルだけを使います。",
            links: [
              {
                label: "PlantUML GitHub Releases",
                href: "https://github.com/plantuml/plantuml/releases",
              },
              {
                label: "PlantUML 公式ダウンロード",
                href: "https://plantuml.com/download",
              },
            ],
            screenshot: screenshot(
              "external-plantuml-fallback.png",
              "外部 PlantUML フォールバック設定",
              "外部 PlantUML フォールバックの明示設定を確認する状態を示します。",
              "Svard の外部 PlantUML フォールバック設定画面",
            ),
          },
          {
            title: "PlantUML の順序を確認する",
            body: "PlantUML はまずローカル表示を試します。ローカル表示が失敗し、Native PlantUML の実行ファイルが設定されている場合だけ外部補助を使います。Kroki フォールバックは別の明示的な補助経路であり、暗黙に公開サービスへ送る順序にはしません。",
          },
        ],
        limitations:
          "この機能は高度な opt-in 経路です。Native PlantUML の入手、配置、実行権限、必要に応じた Graphviz dot の設定はユーザーが管理します。入手した実行ファイルのライセンスと対象 OS は、配布元のリリース情報で確認してください。すべての PlantUML 図表の完全互換は約束しません。公開Docsでは図表ソース本文、ローカルの絶対パス、認証情報を表示しません。",
        related: [
          "ローカル図表レンダリング",
          "Kroki 設定",
          "ネットワークとプロバイダ設定",
        ],
        screenshots: [
          screenshot(
            "diagram-inspector.png",
            "図表の状態",
            "図表一覧で複数図表の状態を確認する画面を示します。",
            "Svard の Diagrams タブ",
          ),
          screenshot(
            "external-plantuml-fallback.png",
            "外部 PlantUML フォールバック設定",
            "外部 PlantUML フォールバックの明示設定を確認する状態を示します。",
            "Svard の外部 PlantUML フォールバック設定画面",
          ),
        ],
      },
      diagramInspector: {
        title: "図表インスペクタ",
        lead: "図表インスペクタは、文書内の図表を右サイドバーの一覧から確認するための機能です",
        whatThisFeatureIs:
          "文書に含まれる図表を一覧し、種類、表示状態、レンダラー、参照位置を確認できます。図表の編集画面ではなく、表示結果と状態を読むための補助パネルです。",
        whenToUse:
          "長い文書に複数の図表がある時や、図表がローカル表示されたのか、補助経路が必要なのかを確認したい時に使います。",
        workflow: [
          {
            title: "図表一覧を確認する",
            body: "右サイドバーの Diagrams タブで、文書内の図表と選択中の図表の状態を確認します。",
            screenshot: screenshot(
              "diagram-inspector.png",
              "図表インスペクタ",
              "図表一覧と選択中の図表詳細を示します。",
              "Svard の図表インスペクタで図表一覧を確認している画面",
            ),
          },
          {
            title: "必要な操作だけを選ぶ",
            body: "表示結果を確認した後、拡大表示や参照コピーなどの代表操作へ進めます。公開ページでは図表本文を表示しません。",
            screenshot: screenshot(
              "diagram-save-action.png",
              "図表操作",
              "図表インスペクタ上の代表操作を示します。",
              "Svard の図表インスペクタで保存操作にフォーカスしている画面",
            ),
          },
        ],
        limitations:
          "図表インスペクタは図表の確認用です。図表本文の編集、全操作の説明、外部 PlantUML フォールバックの詳細設定はこのページでは扱いません。公開成果物には機密情報を含めない方針です。",
        related: [
          "ローカル図表レンダリング",
          "図表の書き出しとプレビュー",
          "明示的な Kroki フォールバック",
        ],
        screenshots: [
          screenshot(
            "diagram-inspector.png",
            "図表インスペクタ",
            "図表一覧と選択中の図表詳細を示します。",
            "Svard の図表インスペクタで図表一覧を確認している画面",
          ),
          screenshot(
            "diagram-save-action.png",
            "図表操作",
            "図表インスペクタ上の代表操作を示します。",
            "Svard の図表インスペクタで保存操作にフォーカスしている画面",
          ),
        ],
      },
      diagramExportPreview: {
        title: "図表のプレビューと保存",
        lead: "図表のプレビューと保存は、文書中の図表を拡大して確認し、必要な時だけレンダリング済み SVG を保存するための機能です",
        whatThisFeatureIs:
          "文書中の図表を別パネルで拡大表示できます。細かい図表を読みやすく確認し、必要な場合は表示済みの SVG として保存できます。",
        whenToUse:
          "本文内では図表が小さく見える時や、レビュー用にレンダリング済みの図表だけを確認したい時に使います。",
        workflow: [
          {
            title: "図表を拡大表示する",
            body: "図表インスペクタまたは図表上の操作からプレビューを開き、拡大率を変えながら確認します。",
            screenshot: screenshot(
              "diagram-preview.png",
              "図表プレビュー",
              "図表を拡大表示している状態を示します。",
              "Svard の図表プレビュー画面",
            ),
          },
          {
            title: "必要な時だけ保存する",
            body: "保存は代表操作のひとつです。すべての図表操作を常時表示せず、必要な時に選びます。",
            screenshot: screenshot(
              "diagram-save-action.png",
              "SVG 保存操作",
              "レンダリング済み SVG を保存する代表操作を示します。",
              "Svard の図表保存操作にフォーカスしている画面",
            ),
          },
        ],
        limitations:
          "このページは拡大表示と SVG 保存に絞ります。図表本文のコピー、全メニュー項目、画像形式の変換、文書全体の書き出しは扱いません。公開成果物には機密情報を含めない方針です。",
        related: [
          "図表インスペクタ",
          "ローカル図表レンダリング",
          "ローカルファーストの考え方",
        ],
        screenshots: [
          screenshot(
            "diagram-preview.png",
            "図表プレビュー",
            "図表を拡大表示している状態を示します。",
            "Svard の図表プレビュー画面",
          ),
          screenshot(
            "diagram-save-action.png",
            "SVG 保存操作",
            "レンダリング済み SVG を保存する代表操作を示します。",
            "Svard の図表保存操作にフォーカスしている画面",
          ),
        ],
      },
      diagramLoadingCache: {
        title: "図表の高速読み込みとキャッシュ",
        lead: "図表の高速読み込みとキャッシュは、図表を含む長い文書でも読み始めを妨げにくくするための機能です",
        whatThisFeatureIs:
          "図表の表示枠を先に用意し、本文を読める状態にしてから図表を差し替えます。ローカル図表の結果は再表示を速くする補助としてキャッシュできます。",
        whenToUse:
          "図表が多い文書や、PlantUML など初回表示に時間がかかる図表を含む文書を読む時に役立ちます。",
        workflow: [
          {
            title: "読み込み方を確認する",
            body: "設定画面では、図表の表示枠を先に出す高速読み込みを確認できます。",
            screenshot: screenshot(
              "diagram-loading-cache.png",
              "図表読み込み設定",
              "図表の高速読み込み設定を示します。",
              "Svard の図表読み込み設定画面",
            ),
          },
          {
            title: "再表示を速くする",
            body: "キャッシュは再表示を速くする補助です。内部の保存場所やキーは公開ページでは扱いません。",
          },
        ],
        limitations:
          "このページは体験としての読み込み挙動に絞ります。内部のキャッシュキー、保存場所、レンダリング処理の詳細、性能計測値は扱いません。キャッシュは再表示を速くする補助であり、すべての図表表示を即時にする保証ではありません。",
        related: [
          "ローカル図表レンダリング",
          "図表インスペクタ",
          "明示的な Kroki フォールバック",
        ],
        screenshots: [
          screenshot(
            "diagram-loading-cache.png",
            "図表読み込み設定",
            "図表の高速読み込み設定を示します。",
            "Svard の図表読み込み設定画面",
          ),
        ],
      },
      previewDiffReview: {
        title: "プレビューベースの差分確認",
        lead: "プレビューベースの差分確認は、ソースの行差分だけではなく文書としての変化を確認する機能です",
        whatThisFeatureIs:
          "差分確認画面は文書プレビューを中心に構成されます。Svard が識別できる範囲で、表示テキスト、リスト、表、構造化されたブロックの変化を文脈内で示します。",
        whenToUse:
          "マークアップソースの行差分だけでは読みにくい変更を、人が読む文書として確認したい時に使います。",
        workflow: [
          {
            title: "変更または比較操作から始める",
            body: "変更管理の一覧から開くか、2つのマークアップファイルを比較する入口を使います。",
            screenshot: screenshot(
              "source-control.png",
              "変更管理からの入口",
              "プレビューベースの確認の入口になるローカル変更を示します。",
              "Svard の文書レビュー向け変更管理画面",
            ),
          },
          {
            title: "プレビュー上で変化を確認する",
            body: "ソース行の変更だけでなく、文書として見える変化をプレビュー上で確認します。",
            screenshot: screenshot(
              "rendered-diff.png",
              "プレビュー差分",
              "差分確認画面上の文書変化を示します。",
              "Svard のプレビュー差分確認画面",
            ),
          },
        ],
        limitations:
          "差分確認は読み取り専用です。マージエディタ、パッチ編集画面、変更管理コマンドの実行画面ではありません。複雑な構造では、より広いブロック単位の表示に切り替わる場合があります。切り替え理由は分類として説明し、ローカルのソース本文は公開成果物に出しません。",
        related: [
          "ファイル同士の比較",
          "表とリストの差分確認",
          "変更ナビゲータ",
        ],
        screenshots: [
          screenshot(
            "source-control.png",
            "変更管理からの入口",
            "プレビューベースの確認の入口になるローカル変更を示します。",
            "Svard の文書レビュー向け変更管理画面",
          ),
          screenshot(
            "rendered-diff.png",
            "プレビュー差分",
            "差分確認画面上の文書変化を示します。",
            "Svard のプレビュー差分確認画面",
          ),
        ],
      },
      fileCompare: {
        title: "ファイル同士の比較",
        lead: "ファイル同士の比較は、2つのマークアップファイルを同じプレビュー差分画面で確認する機能です",
        whatThisFeatureIs:
          "Git 管理下の変更に限らず、選択した AsciiDoc または Markdown ファイルを比較できます。結果は、文書として見える変化を確認するプレビュー差分画面に表示されます。",
        whenToUse:
          "ローカルにある下書き、リリースノート、生成結果、文書の別版を、読み手に見える形で比較したい時に使います。",
        workflow: [
          {
            title: "比較するファイルを選ぶ",
            body: "2つのマークアップファイルを含むフォルダを開きます。ファイルツリーから、比較対象になる公開用サンプルを確認できます。",
            screenshot: screenshot(
              "file-compare-files.png",
              "比較対象のファイル",
              "比較対象になる2つのローカル文書を示します。",
              "Svard のファイルツリーに表示されたファイル比較用の文書",
            ),
          },
          {
            title: "比較操作を開く",
            body: "ファイルツリーで比較相手のファイルを右クリックし、開いている文書との比較を開始します。入口だけを示し、操作説明を増やしすぎない構成にします。",
            screenshot: screenshot(
              "file-compare-context-menu.png",
              "ファイル比較の右クリックメニュー",
              "ファイル比較を開始する右クリックメニュー項目を示します。",
              "Svard のファイルツリーでファイル比較メニューを開いている画面",
            ),
          },
          {
            title: "プレビュー差分を確認する",
            body: "比較を開き、ソース行の違いだけでなく、文書として見える変化をプレビュー上で確認します。",
            screenshot: screenshot(
              "file-compare-preview.png",
              "ファイル比較のプレビュー差分",
              "2つのローカル文書から作成したプレビュー差分を示します。",
              "Svard で2つのマークアップファイルを比較している画面",
            ),
          },
        ],
        limitations:
          "ファイル同士の比較は読み取り専用で、対応しているマークアップ文書に限定されます。公開スクリーンショットには公開用サンプルだけを使い、ローカルの絶対パス、ソース差分の本文、サービス URL、非公開文書の本文は含めません。",
        related: [
          "プレビューベースの差分確認",
          "CLI からのファイル比較",
          "表とリストの差分確認",
        ],
        screenshots: [
          screenshot(
            "file-compare-files.png",
            "比較対象のファイル",
            "比較対象になる2つのローカル文書を示します。",
            "Svard のファイルツリーに表示されたファイル比較用の文書",
          ),
          screenshot(
            "file-compare-context-menu.png",
            "ファイル比較の右クリックメニュー",
            "ファイル比較を開始する右クリックメニュー項目を示します。",
            "Svard のファイルツリーでファイル比較メニューを開いている画面",
          ),
          screenshot(
            "file-compare-preview.png",
            "ファイル比較のプレビュー差分",
            "2つのローカル文書から作成したプレビュー差分を示します。",
            "Svard で2つのマークアップファイルを比較している画面",
          ),
        ],
      },
      cliFileCompare: {
        title: "CLI からのファイル比較",
        lead: "CLI からのファイル比較は、外部の起動経路から2つの文書を同じプレビュー差分で開くための入口です",
        whatThisFeatureIs:
          "Svard のファイル比較は、ファイルツリーの操作だけでなく、デスクトップアプリの起動経路からも同じ比較画面へ進めます。結果は通常のファイル同士の比較と同じく、文書として見える変化を確認するプレビュー差分です。",
        whenToUse:
          "別のツール、スクリプト、シェル操作から比較したい2つの文書が決まっていて、Svard 側では比較結果だけを確認したい時に使います。",
        workflow: [
          {
            title: "2つの文書を引数として渡す",
            body: "ターミナルやスクリプトから、比較したい2つの AsciiDoc / Markdown ファイルを Svard に渡します。公開例ではローカルの絶対パスではなく、相対パスで示します。デスクトップアプリとしての起動例では Svard の先頭を大文字にします。",
            code: [
              "macOS:",
              "open -a Svard --args docs/product-guide-a.md docs/product-guide-b.md",
              "",
              "Windows:",
              ".\\Svard.exe docs\\product-guide-a.md docs\\product-guide-b.md",
            ].join("\n"),
            screenshot: screenshot(
              "file-compare-files.png",
              "比較対象のファイル",
              "比較対象になる2つのローカル文書を示します。",
              "Svard のファイルツリーに表示されたファイル比較用の文書",
            ),
          },
          {
            title: "2件だけが比較として扱われる",
            body: "対応している文書ファイルがちょうど2件渡された場合だけ、Svard は通常のタブ表示ではなくファイル同士の比較を開きます。1件なら文書を開き、3件以上やファイルとフォルダの混在は順番に開く動きになります。",
          },
          {
            title: "プレビュー差分で確認する",
            body: "比較結果は、ソース行ではなく文書として見える変化を読むためのプレビュー差分で確認します。",
            screenshot: screenshot(
              "file-compare-preview.png",
              "CLI から開いた比較結果",
              "2つのローカル文書から作成したプレビュー差分を示します。",
              "Svard で2つのマークアップファイルを比較している画面",
            ),
          },
        ],
        limitations:
          "このページは2ファイル比較の起動手順に絞ります。CLI の全オプション、インストール場所ごとの実行ファイルパス、シェルごとの引用符の書き方、自動化手順は扱いません。公開画像やコマンド例にはローカルの絶対パスやソース差分の本文を含めません。",
        related: [
          "ファイル同士の比較",
          "プレビューベースの差分確認",
          "AsciiDoc / Markdown の閲覧",
        ],
        screenshots: [
          screenshot(
            "file-compare-files.png",
            "比較対象のファイル",
            "比較対象になる2つのローカル文書を示します。",
            "Svard のファイルツリーに表示されたファイル比較用の文書",
          ),
          screenshot(
            "file-compare-preview.png",
            "CLI から開いた比較結果",
            "2つのローカル文書から作成したプレビュー差分を示します。",
            "Svard で2つのマークアップファイルを比較している画面",
          ),
        ],
      },
      tableListDiffReview: {
        title: "表とリストの差分確認",
        lead: "表とリストの差分確認は、ソース行ではなく文書として見える構造の変化を読むための機能です",
        whatThisFeatureIs:
          "プレビュー差分では、変更されたリスト項目や表の変化を表示済み文書の中で確認できます。表の差分は、信頼できる単純な表ではセル単位の確認に切り替えられます。",
        whenToUse:
          "仕様表、比較表、箇条書きの変更を、読み手に見える形で確認したい時に使います。",
        workflow: [
          {
            title: "プレビュー上で構造の変化を見る",
            body: "リストや表の変化を、前後の本文と同じ画面で確認します。ソース差分だけでは見落としやすい読者向けの変化を把握できます。",
            screenshot: screenshot(
              "table-list-diff-review.png",
              "表とリストを含むプレビュー差分",
              "リストと表の変化を含むプレビュー差分を示します。",
              "Svard のプレビュー差分で表とリストの変化を表示している画面",
            ),
          },
          {
            title: "表の変化をセル単位で確認する",
            body: "単純な表では、表ビューで変更セルや追加セルを確認できます。複雑な表は無理にセル単位へ分解せず、広い単位の表示に戻します。",
            screenshot: screenshot(
              "table-list-diff-table.png",
              "表ビューのセル差分",
              "表ビューで変更セルと追加セルを確認する画面を示します。",
              "Svard の表ビューでセル単位の差分を確認している画面",
            ),
          },
        ],
        limitations:
          "表ビューは高信頼な単純表を対象にします。結合セル、入れ子の表、大きく構造が変わった表では、セル単位ではなく広いブロック単位の確認に切り替わる場合があります。公開画像には公開用サンプルの短いセル文言だけを使います。",
        related: [
          "プレビューベースの差分確認",
          "ファイル同士の比較",
          "変更ナビゲータ",
        ],
        screenshots: [
          screenshot(
            "table-list-diff-review.png",
            "表とリストを含むプレビュー差分",
            "リストと表の変化を含むプレビュー差分を示します。",
            "Svard のプレビュー差分で表とリストの変化を表示している画面",
          ),
          screenshot(
            "table-list-diff-table.png",
            "表ビューのセル差分",
            "表ビューで変更セルと追加セルを確認する画面を示します。",
            "Svard の表ビューでセル単位の差分を確認している画面",
          ),
        ],
      },
      changeNavigator: {
        title: "変更ナビゲータ",
        lead: "変更ナビゲータは、プレビュー差分の中で次の変更・前の変更へ移動するための補助です",
        whatThisFeatureIs:
          "プレビュー差分では、文書として見える変更を順番に確認できます。変更ナビゲータは、長い文書の中で差分箇所を探し続けなくても、上部の Previous / Next ボタンやショートカットで前後の変更へ移動するための入口です。",
        whenToUse:
          "レビュー対象の文書が長い時や、複数の変更を順番に確認したい時に使います。",
        supportMatrix: {
          title: "移動方法",
          lead: "プレビュー差分を開いた後、ボタンまたはキーボードで変更箇所を移動できます。",
          columns: ["操作", "移動先", "使う場面"],
          rows: [
            ["Next", "次の変更", "上から順に差分を確認したい時に使います。"],
            [
              "Previous",
              "前の変更",
              "直前に確認した変更へ戻りたい時に使います。",
            ],
            [
              "Alt+↓",
              "次の変更",
              "キーボード中心でレビューを進めたい時に使います。",
            ],
            [
              "Alt+↑",
              "前の変更",
              "キーボード中心で前の変更へ戻りたい時に使います。",
            ],
          ],
          note: "ショートカットはデフォルト設定です。実際の割り当てはアプリ内のショートカット表示に従います。",
        },
        workflow: [
          {
            title: "差分画面を開く",
            body: "変更一覧、ブランチ差分、ファイル同士の比較などからプレビュー差分を開きます。",
            screenshot: screenshot(
              "source-control-open-diff.png",
              "プレビュー差分の入口",
              "変更一覧からプレビュー差分を開いた状態を示します。",
              "Svard の変更一覧からプレビュー差分を開いている画面",
            ),
          },
          {
            title: "変更間を移動する",
            body: "プレビュー差分の上部にある Previous / Next ボタン、または Alt+↑ / Alt+↓ で前後の変更へ移動します。読んでいる文脈を保ったまま確認できます。",
            screenshot: screenshot(
              "rendered-diff.png",
              "変更ナビゲータ",
              "プレビュー差分上で変更間を移動する画面を示します。",
              "Svard のプレビュー差分で変更ナビゲータを表示している画面",
            ),
          },
        ],
        limitations:
          "変更ナビゲータは読み取り専用の移動補助です。変更の採用、破棄、マージは扱いません。差分が広いブロック単位に切り替わる場合、移動対象もその表示単位に従います。ショートカットの割り当てが変更されている環境では、アプリ内の表示を優先してください。",
        related: [
          "プレビューベースの差分確認",
          "フォールバック表示",
          "表とリストの差分確認",
        ],
        screenshots: [
          screenshot(
            "source-control-open-diff.png",
            "プレビュー差分の入口",
            "変更一覧からプレビュー差分を開いた状態を示します。",
            "Svard の変更一覧からプレビュー差分を開いている画面",
          ),
          screenshot(
            "rendered-diff.png",
            "変更ナビゲータ",
            "プレビュー差分上で変更間を移動する画面を示します。",
            "Svard のプレビュー差分で変更ナビゲータを表示している画面",
          ),
        ],
      },
      fallbackVisibility: {
        title: "フォールバック表示",
        lead: "フォールバック表示は、精密な差分表示が難しい時に広い単位で変化を見せるための表示です",
        whatThisFeatureIs:
          "Svard は可能な場合にリスト項目や表セルなどを細かく表示します。ただし構造が大きく変わった場合や信頼できる対応付けが難しい場合は、無理に細かく見せず、広いブロック単位の表示に戻します。",
        whenToUse:
          "差分表示が想定より広い範囲になっている理由を理解したい時や、表やリストの複雑な変更を確認する時に使います。",
        workflow: [
          {
            title: "構造化された差分を見る",
            body: "単純なリストや表では、表示済み文書の構造に沿って変化を確認できます。",
            screenshot: screenshot(
              "table-list-diff-review.png",
              "構造化された差分",
              "リストと表の変化を含むプレビュー差分を示します。",
              "Svard のプレビュー差分で表とリストの変化を表示している画面",
            ),
          },
          {
            title: "広い単位への切り替えを理解する",
            body: "信頼できる細分化ができない場合は、誤解を避けるために広いブロック単位で変化を示します。",
            screenshot: screenshot(
              "rendered-diff.png",
              "広い単位の差分表示",
              "プレビュー差分で文書変化を広い単位で確認する状態を示します。",
              "Svard のプレビュー差分画面",
            ),
          },
        ],
        limitations:
          "フォールバック表示は精度を過剰に見せないための表示です。すべての複雑な表、リスト、図表を細かい単位へ分解する保証はありません。公開Docsではソース本文や差分ハンク全文を見せません。",
        related: [
          "表とリストの差分確認",
          "変更ナビゲータ",
          "プレビューベースの差分確認",
        ],
        screenshots: [
          screenshot(
            "table-list-diff-review.png",
            "構造化された差分",
            "リストと表の変化を含むプレビュー差分を示します。",
            "Svard のプレビュー差分で表とリストの変化を表示している画面",
          ),
          screenshot(
            "rendered-diff.png",
            "広い単位の差分表示",
            "プレビュー差分で文書変化を広い単位で確認する状態を示します。",
            "Svard のプレビュー差分画面",
          ),
        ],
      },
      changeReviewMode: {
        title: "Change Review Mode",
        lead: "Change Review Mode は、設定で有効化した時に、通常の閲覧画面で現在の変更に気づくための機能です",
        whatThisFeatureIs:
          "閲覧中の文書に作業中の変更がある場合、本文、リスト、表の近くに変更マーカーを表示します。この表示は既定では無効です。使う場合は設定画面で Change Review Mode を有効にします。",
        whenToUse:
          "文書を読み直している途中で、現在の変更箇所を文脈の中で確認したい時に使います。",
        workflow: [
          {
            title: "設定で有効化する",
            body: "Change Review Mode は既定では無効です。通常の閲覧画面に変更マーカーを出したい場合は、設定画面で有効にします。",
            screenshot: screenshot(
              "change-review-settings.png",
              "Change Review Mode の設定",
              "設定画面で Change Review Mode を確認する状態を示します。",
              "Svard の設定画面で Change Review Mode を表示している画面",
            ),
          },
          {
            title: "通常の閲覧画面で変更を見る",
            body: "有効化すると、差分専用画面を開かず、文書プレビュー内で作業中の変更箇所を確認できます。",
            screenshot: screenshot(
              "change-review-mode-markers.png",
              "通常閲覧画面の変更マーカー",
              "通常の閲覧画面に現在の変更マーカーを表示した状態を示します。",
              "Svard の閲覧画面で現在の変更マーカーを表示している画面",
            ),
          },
        ],
        limitations:
          "この機能は既定では無効です。作業中の変更を読むための補助であり、ステージング、コミット、マージなどの操作は扱いません。複雑な構造では、精密なセルや項目単位ではなく広い範囲の表示になる場合があります。",
        related: [
          "表とリストの差分確認",
          "変更一覧",
          "プレビューベースの差分確認",
        ],
        screenshots: [
          screenshot(
            "change-review-settings.png",
            "Change Review Mode の設定",
            "設定画面で Change Review Mode を確認する状態を示します。",
            "Svard の設定画面で Change Review Mode を表示している画面",
          ),
          screenshot(
            "change-review-mode-markers.png",
            "通常閲覧画面の変更マーカー",
            "通常の閲覧画面に現在の変更マーカーを表示した状態を示します。",
            "Svard の閲覧画面で現在の変更マーカーを表示している画面",
          ),
        ],
      },
      listItemMarkers: {
        title: "リスト項目の変更表示",
        lead: "リスト項目の変更表示は、通常の閲覧画面で箇条書きの変更に気づくための表示です",
        whatThisFeatureIs:
          "Change Review Mode を有効にすると、変更されたリスト項目の近くにマーカーが表示されます。差分専用画面を開く前に、読書中の文脈で変更箇所を見つけるための補助です。",
        whenToUse:
          "手順書や仕様メモの箇条書きを読み直しながら、どの項目が変わったかを確認したい時に使います。",
        workflow: [
          {
            title: "設定で Change Review Mode を有効にする",
            body: "リスト項目の変更表示は既定では無効です。通常の閲覧画面にマーカーを出す場合は、設定画面で有効にします。",
            screenshot: screenshot(
              "change-review-settings.png",
              "Change Review Mode の設定",
              "設定画面で Change Review Mode を確認する状態を示します。",
              "Svard の設定画面で Change Review Mode を表示している画面",
            ),
          },
          {
            title: "リストの変更に気づく",
            body: "有効化すると、閲覧中の文書で変更された項目の近くにマーカーが表示されます。",
            screenshot: screenshot(
              "change-review-mode-markers.png",
              "リスト項目の変更マーカー",
              "通常の閲覧画面で変更マーカーを表示した状態を示します。",
              "Svard の閲覧画面で変更マーカーを表示している画面",
            ),
          },
        ],
        limitations:
          "リスト項目の変更表示は読み取り補助です。ステージング、コミット、マージ操作は扱いません。複雑な構造では項目単位ではなく広い範囲の表示になる場合があります。",
        related: [
          "Change Review Mode",
          "表の行・セル変更表示",
          "表とリストの差分確認",
        ],
        screenshots: [
          screenshot(
            "change-review-settings.png",
            "Change Review Mode の設定",
            "設定画面で Change Review Mode を確認する状態を示します。",
            "Svard の設定画面で Change Review Mode を表示している画面",
          ),
          screenshot(
            "change-review-mode-markers.png",
            "リスト項目の変更マーカー",
            "通常の閲覧画面で変更マーカーを表示した状態を示します。",
            "Svard の閲覧画面で変更マーカーを表示している画面",
          ),
        ],
      },
      tableCellMarkers: {
        title: "表の行・セル変更表示",
        lead: "表の行・セル変更表示は、信頼できる単純な表で変更箇所を細かく確認するための表示です",
        whatThisFeatureIs:
          "Svard は表の変更を、可能な場合は行やセルの単位で確認できるようにします。通常の閲覧画面では変更に気づくためのマーカーを表示し、プレビュー差分では表ビューで細かい確認に進めます。",
        whenToUse:
          "仕様表、比較表、設定表などで、どのセルや行が変わったかを文書として確認したい時に使います。",
        workflow: [
          {
            title: "通常の閲覧画面で変更に気づく",
            body: "Change Review Mode を有効にしている場合、表の近くでも変更マーカーを確認できます。",
            screenshot: screenshot(
              "change-review-mode-markers.png",
              "表の変更マーカー",
              "通常の閲覧画面で変更マーカーを表示した状態を示します。",
              "Svard の閲覧画面で表周辺の変更マーカーを表示している画面",
            ),
          },
          {
            title: "表ビューでセル単位の変化を見る",
            body: "単純で対応できる表では、表ビューで変更セルや追加セルを確認できます。",
            screenshot: screenshot(
              "table-list-diff-table.png",
              "表ビューのセル差分",
              "表ビューで変更セルと追加セルを確認する画面を示します。",
              "Svard の表ビューでセル単位の差分を確認している画面",
            ),
          },
        ],
        limitations:
          "セル単位の表示は高信頼な単純表に限定します。結合セル、入れ子の表、大きな構造変更では、広いブロック単位の表示に戻る場合があります。",
        related: [
          "Change Review Mode",
          "リスト項目の変更表示",
          "表とリストの差分確認",
        ],
        screenshots: [
          screenshot(
            "change-review-mode-markers.png",
            "表の変更マーカー",
            "通常の閲覧画面で変更マーカーを表示した状態を示します。",
            "Svard の閲覧画面で表周辺の変更マーカーを表示している画面",
          ),
          screenshot(
            "table-list-diff-table.png",
            "表ビューのセル差分",
            "表ビューで変更セルと追加セルを確認する画面を示します。",
            "Svard の表ビューでセル単位の差分を確認している画面",
          ),
        ],
      },
      sourceControlChanges: {
        title: "変更一覧",
        lead: "変更一覧は、ローカルで変更された文書を確認し、プレビュー差分へ移動するための入口です",
        whatThisFeatureIs:
          "Source Control の Changes list には、現在のフォルダで変更された文書が並びます。対応している文書は、一覧からプレビュー差分を開いて内容を確認できます。All diffs では、Markdown / AsciiDoc の変更文書を1つの連続した読み取り専用 stream としてまとめて確認できます。",
        whenToUse:
          "どの文書が変更されているかを見てから、1件ずつ、または一括で読み取り専用の差分確認へ進みたい時に使います。",
        workflow: [
          {
            title: "変更された文書を一覧する",
            body: "変更一覧で、レビュー対象になる文書を確認します。ここでは変更管理全体ではなく、文書レビューの入口として扱います。",
            screenshot: screenshot(
              "source-control-changes.png",
              "変更一覧",
              "変更された文書を一覧する画面を示します。",
              "Svard の Source Control で変更一覧を表示している画面",
            ),
          },
          {
            title: "一覧から差分確認へ進む",
            body: "対応している文書を選び、プレビュー差分で文書として見える変化を確認します。",
            screenshot: screenshot(
              "source-control-open-diff.png",
              "変更一覧から開いた差分",
              "変更一覧からプレビュー差分を開いた状態を示します。",
              "Svard の変更一覧からプレビュー差分を開いている画面",
            ),
          },
          {
            title: "一括差分を確認する",
            body: "All diffs を開くと、対応している Markdown / AsciiDoc の変更文書をファイル単位の stream として確認できます。Previous / Next、変更ルーラー、ショートカットは stream 全体の変更間移動に使えます。",
            screenshot: screenshot(
              "source-control-open-diff.png",
              "All diffs の入口",
              "変更一覧から一括差分確認へ進む入口を示します。",
              "Svard の Source Control で All diffs へ進む入口を表示している画面",
            ),
          },
        ],
        limitations:
          "変更一覧と All diffs は読み取りと差分確認への入口です。このページでは stage、commit、branch 操作、履歴分析、リポジトリグラフの詳細は扱いません。All diffs は Markdown / AsciiDoc の文書差分を対象にし、非対応ファイルは本文を表示しません。公開画像には実リポジトリ名やローカルの絶対パスを含めません。",
        related: [
          "Change Review Mode",
          "プレビューベースの差分確認",
          "変更ナビゲータ",
          "ブランチ差分",
          "リポジトリグラフ",
          "ファイル履歴",
        ],
        screenshots: [
          screenshot(
            "source-control-changes.png",
            "変更一覧",
            "変更された文書を一覧する画面を示します。",
            "Svard の Source Control で変更一覧を表示している画面",
          ),
          screenshot(
            "source-control-open-diff.png",
            "変更一覧から開いた差分",
            "変更一覧からプレビュー差分を開いた状態を示します。",
            "Svard の変更一覧からプレビュー差分を開いている画面",
          ),
        ],
      },
      branchDiff: {
        title: "ブランチ差分",
        lead: "Branch Diff は、選択した基準ブランチとの差分を文書レビューの入口として扱う画面です",
        whatThisFeatureIs:
          "Source Control の Branch Diff では、基準ブランチと現在の作業ブランチの間で変わった文書を一覧できます。対応している文書は、一覧からプレビュー差分へ進めます。",
        whenToUse:
          "レビュー対象のブランチで、どの文書が変わったかを確認してから、読み取り専用の差分確認へ進みたい時に使います。",
        workflow: [
          {
            title: "基準ブランチとの差分を確認する",
            body: "Branch Diff で基準ブランチを選び、レビュー対象の文書を一覧します。ここでは Git 操作ではなく、差分確認の入口として扱います。",
            screenshot: screenshot(
              "source-control-branch-diff.png",
              "ブランチ差分",
              "基準ブランチと現在のブランチで変わった文書を一覧する状態を示します。",
              "Svard の Source Control で Branch Diff を表示している画面",
            ),
          },
          {
            title: "文書として見える差分を開く",
            body: "対応している文書を選ぶと、プレビュー差分で読者に見える変化を確認できます。",
            screenshot: screenshot(
              "source-control-branch-diff-preview.png",
              "ブランチ差分から開いたプレビュー差分",
              "Branch Diff からプレビュー差分を開いた状態を示します。",
              "Svard の Branch Diff からプレビュー差分を開いている画面",
            ),
          },
        ],
        limitations:
          "Branch Diff は読み取り専用のレビュー入口です。このページでは stage、commit、checkout、fetch、merge は扱いません。リモート側の対象ブランチ検出は、設定がある場合の補助として扱います。",
        related: ["変更一覧", "リポジトリグラフ", "ファイル履歴"],
        screenshots: [
          screenshot(
            "source-control-branch-diff.png",
            "ブランチ差分",
            "基準ブランチと現在のブランチで変わった文書を一覧する状態を示します。",
            "Svard の Source Control で Branch Diff を表示している画面",
          ),
          screenshot(
            "source-control-branch-diff-preview.png",
            "ブランチ差分から開いたプレビュー差分",
            "Branch Diff からプレビュー差分を開いた状態を示します。",
            "Svard の Branch Diff からプレビュー差分を開いている画面",
          ),
        ],
      },
      repoGraph: {
        title: "リポジトリグラフ",
        lead: "Repo Graph は、リポジトリ全体の変更の流れを読み、必要な差分確認へ進むための一覧です",
        whatThisFeatureIs:
          "Source Control の Repo Graph では、コミットの流れを読み取り専用で確認できます。文書レビューの前に、変更がどの順序で入ったかを把握するための画面です。",
        whenToUse:
          "複数の変更が続いている時に、どの変更から確認するかを決めたい場合に使います。",
        workflow: [
          {
            title: "変更の流れを読む",
            body: "Repo Graph でコミットの並びを確認し、レビューしたい変更の文脈をつかみます。ここでは履歴を読むことに絞ります。",
            screenshot: screenshot(
              "source-control-repo-graph.png",
              "リポジトリグラフ",
              "複数のコミットが並ぶ Repo Graph を示します。",
              "Svard の Source Control で Repo Graph を表示している画面",
            ),
          },
        ],
        limitations:
          "Repo Graph は読み取り専用の履歴確認画面です。このページではコミット詳細、参照比較、checkout、merge などの Git 操作は扱いません。",
        related: ["変更一覧", "ブランチ差分", "ファイル履歴"],
        screenshots: [
          screenshot(
            "source-control-repo-graph.png",
            "リポジトリグラフ",
            "複数のコミットが並ぶ Repo Graph を示します。",
            "Svard の Source Control で Repo Graph を表示している画面",
          ),
        ],
      },
      fileHistory: {
        title: "ファイル履歴",
        lead: "File History は、現在読んでいる文書に絞って過去の変更を確認する入口です",
        whatThisFeatureIs:
          "Source Control の File History では、開いている文書に関係する履歴だけを確認できます。リポジトリ全体ではなく、今読んでいる文書の変化を追うための画面です。",
        whenToUse:
          "文書の現在の内容だけでなく、過去にどのような変更が入ったかを文書単位で確認したい時に使います。",
        workflow: [
          {
            title: "現在の文書の履歴を見る",
            body: "File History で、開いている文書に関係する変更だけを一覧します。必要に応じて、履歴から差分確認へ進めます。",
            screenshot: screenshot(
              "source-control-file-history.png",
              "ファイル履歴",
              "現在の文書に絞った File History を示します。",
              "Svard の Source Control で File History を表示している画面",
            ),
          },
        ],
        limitations:
          "File History は読み取り専用の履歴確認です。このページではファイルの復元、過去版の編集、checkout は扱いません。",
        related: ["変更一覧", "ブランチ差分", "リポジトリグラフ"],
        screenshots: [
          screenshot(
            "source-control-file-history.png",
            "ファイル履歴",
            "現在の文書に絞った File History を示します。",
            "Svard の Source Control で File History を表示している画面",
          ),
        ],
      },
      commitDetailsRefCompare: {
        title: "コミット詳細と参照比較",
        lead: "コミット詳細と参照比較は、変更の文脈を読み取り専用で確認するための Source Control 機能です",
        whatThisFeatureIs:
          "Svard の Source Control は Git 操作を実行する場所ではなく、文書レビューへ入る読み取り専用の入口です。変更一覧の文書を右クリックすると、ブランチ、タグ、コミットとの比較へ進めます。コミット詳細と参照比較では、変更の流れや比較対象を把握してから文書差分へ進みます。",
        whenToUse:
          "レビュー対象の変更がどの履歴や参照に属しているかを確認し、必要な文書差分だけを開きたい時に使います。",
        workflow: [
          {
            title: "変更一覧から比較操作を開く",
            body: "Source Control の Changes list で文書を右クリックし、Compare with Branch、Compare with Tag、Compare with Commit から比較対象の種類を選びます。",
            screenshot: screenshot(
              "source-control-ref-context-menu.png",
              "参照比較の右クリックメニュー",
              "変更一覧の右クリックメニューで参照比較操作を選ぶ入口を示します。",
              "Svard の Source Control で参照比較の右クリックメニューを表示している画面",
            ),
          },
          {
            title: "比較結果を文書として確認する",
            body: "比較対象を選んだ後は、読み取り専用のプレビュー差分で文書として見える変化を確認します。",
            screenshot: screenshot(
              "source-control-branch-diff-preview.png",
              "参照比較のプレビュー差分",
              "ブランチ差分からプレビュー差分へ移動した状態を示します。",
              "Svard の Branch Diff から開いたプレビュー差分",
            ),
          },
        ],
        limitations:
          "このページでは checkout、merge、fetch、push、commit 作成は扱いません。provider URL、認証情報、実リポジトリ名、差分ハンク全文は公開Docsに含めません。",
        related: ["ブランチ差分", "リポジトリグラフ", "ファイル履歴"],
        screenshots: [
          screenshot(
            "source-control-ref-context-menu.png",
            "参照比較の右クリックメニュー",
            "変更一覧の右クリックメニューで参照比較操作を選ぶ入口を示します。",
            "Svard の Source Control で参照比較の右クリックメニューを表示している画面",
          ),
          screenshot(
            "source-control-branch-diff-preview.png",
            "参照比較のプレビュー差分",
            "ブランチ差分からプレビュー差分へ移動した状態を示します。",
            "Svard の Branch Diff から開いたプレビュー差分",
          ),
        ],
      },
      documentActions: {
        title: "文書操作",
        lead: "文書操作は、表示された本文から必要な操作へ進むための右クリック入口です",
        whatThisFeatureIs:
          "Svard は文書を読む画面を中心に、本文上の対象に応じた操作を出します。公開Docsでは、すべての項目を覚えるためではなく、表示済み文書から操作を始められることを説明します。",
        whenToUse:
          "本文を読んでいる途中で、関連する比較、図表、リンク、コピーなどの操作へ進みたい時に使います。",
        workflow: [
          {
            title: "表示済み文書を起点にする",
            body: "操作はソースではなく、読んでいる文書の表示結果を起点にします。",
            screenshot: screenshot(
              "reader-main.png",
              "表示済み文書",
              "文書本文を読んでいる通常の閲覧画面を示します。",
              "Svard で文書本文を表示している画面",
            ),
          },
          {
            title: "代表操作を開く",
            body: "右クリックなどの文脈操作は、必要な場面でだけ使います。全メニュー項目の一覧ではなく、入口があることを理解するための機能です。",
            screenshot: screenshot(
              "file-compare-context-menu.png",
              "右クリック操作の入口",
              "ファイルツリー上で代表的な右クリック操作を開いた状態を示します。",
              "Svard で右クリック操作の入口を表示している画面",
            ),
          },
        ],
        limitations:
          "文書操作は読み取りと確認を補助する入口です。編集、貼り付け、ローカルパスのコピー結果、非公開の値を公開Docsで扱いません。操作の全一覧は Manual / Guide の別フェーズに残します。",
        related: [
          "リンク確認と文書操作",
          "表のコピー操作",
          "サイドバーとタブ操作",
        ],
        screenshots: [
          screenshot(
            "reader-main.png",
            "表示済み文書",
            "文書本文を読んでいる通常の閲覧画面を示します。",
            "Svard で文書本文を表示している画面",
          ),
          screenshot(
            "file-compare-context-menu.png",
            "右クリック操作の入口",
            "ファイルツリー上で代表的な右クリック操作を開いた状態を示します。",
            "Svard で右クリック操作の入口を表示している画面",
          ),
        ],
      },
      headingTocActions: {
        title: "見出しと Contents の操作",
        lead: "見出しと Contents の操作は、長い文書の中で現在位置を確認し、必要な見出しへ移動するための機能です",
        whatThisFeatureIs:
          "右サイドバーの Contents は、文書内の見出しを読みやすい単位で並べます。見出しや Contents を起点に、移動や参照のための操作へ進めます。",
        whenToUse:
          "長い仕様書やガイドを読んでいて、今いる章を確認したい時や、別の章へ素早く移動したい時に使います。",
        workflow: [
          {
            title: "Contents と本文を並べて見る",
            body: "Contents と本文見出しを同時に見ることで、文書全体の中の現在位置が分かります。",
            screenshot: screenshot(
              "table-of-contents.png",
              "Contents と本文",
              "Contents サイドバーと本文見出しが同時に見える状態を示します。",
              "Svard の Contents サイドバーと本文見出し",
            ),
          },
          {
            title: "見出しへ移動する",
            body: "Contents から別の見出しへ移動すると、長い文書でも読みたい場所へ戻りやすくなります。",
            screenshot: screenshot(
              "table-of-contents-jump.png",
              "見出しへの移動",
              "Contents 項目から本文見出しへ移動した状態を示します。",
              "Svard の Contents で見出しへ移動している画面",
            ),
          },
        ],
        limitations:
          "このページは閲覧中の移動と参照に絞ります。見出し設計、執筆ルール、全操作メニュー、コピーした値の内容は扱いません。",
        related: ["Contents サイドバー", "クイックオープン", "検索結果の移動"],
        screenshots: [
          screenshot(
            "table-of-contents.png",
            "Contents と本文",
            "Contents サイドバーと本文見出しが同時に見える状態を示します。",
            "Svard の Contents サイドバーと本文見出し",
          ),
          screenshot(
            "table-of-contents-jump.png",
            "見出しへの移動",
            "Contents 項目から本文見出しへ移動した状態を示します。",
            "Svard の Contents で見出しへ移動している画面",
          ),
        ],
      },
      tableCopyActions: {
        title: "表のコピー操作",
        lead: "表のコピー操作は、表示された表を右クリックして、用途に合う形式でコピーするための補助です",
        whatThisFeatureIs:
          "Svard は表計算エディタではありませんが、表示された表の上で右クリックすると、表全体を TSV、CSV、Markdown table としてコピーできます。参照元が分かる表では、Table Reference もコピーできます。",
        whenToUse:
          "仕様表や比較表を読みながら、表示結果を確認した上で、表計算ソフト、レビューコメント、Markdown メモへ表を持ち出したい時に使います。",
        supportMatrix: {
          title: "コピーできる形式",
          lead: "右クリックメニューには、表示済みの表を別の作業へ渡すための形式が並びます。",
          columns: ["メニュー項目", "用途", "出力の考え方"],
          rows: [
            [
              "Copy as TSV",
              "表計算ソフトへ貼り付ける時に使います。",
              "タブ区切りの表としてコピーします。",
            ],
            [
              "Copy as CSV",
              "CSV を受け取るツールやメモへ渡す時に使います。",
              "カンマ区切りの表としてコピーします。",
            ],
            [
              "Copy as Markdown Table",
              "Markdown のレビューコメントやメモへ貼る時に使います。",
              "Markdown table としてコピーします。",
            ],
            [
              "Copy Table Reference",
              "表の参照位置だけを伝えたい時に使います。",
              "参照情報がある表だけに表示されます。",
            ],
          ],
          note: "コピー対象は表示済みの表です。ソース本文全文やローカルの絶対パスを公開Docsの本文・画像には出しません。",
        },
        workflow: [
          {
            title: "表を表示結果として読む",
            body: "表はソースの記法ではなく、読み手に見える表として確認します。",
            screenshot: screenshot(
              "reading-markup-asciidoc.png",
              "表示された表",
              "AsciiDoc 文書内の表示済み表を含む閲覧画面を示します。",
              "Svard で表を含む文書を表示している画面",
            ),
          },
          {
            title: "表の上で右クリックする",
            body: "表示された表のセル上で右クリックし、Copy as TSV、Copy as CSV、Copy as Markdown Table から目的に合う形式を選びます。",
            screenshot: screenshot(
              "table-copy-context-menu.png",
              "表の右クリックメニュー",
              "表の上で右クリックし、コピー形式を選ぶメニューを示します。",
              "Svard の表示済み表でコピー用の右クリックメニューを開いている画面",
            ),
          },
        ],
        limitations:
          "表のコピー操作は表示済みの内容を扱う補助です。表編集、計算、複雑な表構造の完全な再現は約束しません。選択範囲の有無や表の構造によって、コピー結果は表示内容に合わせて変わります。",
        related: [
          "表とリストの差分確認",
          "AsciiDoc / Markdown の閲覧",
          "対応図表",
        ],
      },
      linkDocumentActions: {
        title: "リンク確認と文書操作",
        lead: "リンク確認と文書操作は、参照先を確認してから開くための読書補助です",
        whatThisFeatureIs:
          "Svard は文書内リンクにマウスを重ねた時、リンク先やローカル文書のプレビューを確認できるようにします。右クリックメニューからは、リンクを開く、別ウィンドウで開く、エディタで開く、リンク先をコピーする操作に進めます。",
        whenToUse:
          "仕様書内のリンクをすぐ開く前に、参照先が同じ文書内の見出しなのか、別のローカル文書なのか、外部リンクなのかを確認したい時に使います。",
        supportMatrix: {
          title: "確認できること",
          lead: "リンク操作は、クリック前に参照先を理解するための補助です。",
          columns: ["操作", "分かること", "補足"],
          rows: [
            [
              "リンクにマウスを重ねる",
              "リンク先の文字列を確認します。",
              "同一文書内リンク、ローカル文書リンク、外部リンクを区別しやすくします。",
            ],
            [
              "ローカル文書リンクにマウスを重ねる",
              "リンク先文書や見出しのプレビューを確認します。",
              "プレビューできない時は利用できない理由を表示します。",
            ],
            [
              "リンクを右クリックする",
              "リンク用の操作メニューを開きます。",
              "Open Document、Open Link in New Window、Open in Editor、Copy Path などを選べます。",
            ],
            [
              "外部リンクを右クリックする",
              "外部リンクを開く、またはリンク文字列をコピーします。",
              "外部リンクは安全確認の対象になります。",
            ],
          ],
          note: "公開Docsでは、ローカルの絶対パス、非公開のリンク値、コピーした値そのものは表示しません。",
        },
        workflow: [
          {
            title: "リンクにマウスを重ねる",
            body: "文書内リンクにマウスを重ね、開く前にリンク先とプレビューを確認します。",
            screenshot: screenshot(
              "link-hover-preview.png",
              "リンク先の確認",
              "文書内リンクにマウスを重ね、リンク先とプレビューを確認する状態を示します。",
              "Svard で文書内リンクにマウスを重ねてリンク先を確認している画面",
            ),
          },
          {
            title: "必要な操作を右クリックから選ぶ",
            body: "リンクを右クリックし、開く、別ウィンドウで開く、エディタで開く、リンク先をコピーする操作を選びます。",
            screenshot: screenshot(
              "link-context-menu.png",
              "リンクの右クリックメニュー",
              "文書内リンクの右クリックメニューを示します。",
              "Svard で文書内リンクの右クリックメニューを開いている画面",
            ),
          },
        ],
        limitations:
          "リンク操作は読書中の確認と移動の補助です。リンク先文書の編集、外部サービス連携、非公開パスの公開、コピーしたリンク値の公開は扱いません。外部リンクはローカル文書とは別の安全確認を前提にします。",
        related: [
          "include とローカル画像",
          "ローカルファーストの考え方",
          "文書操作",
        ],
      },
      sidebarTabActions: {
        title: "サイドバーとタブ操作",
        lead: "サイドバーとタブ操作は、複数の文書を開いた読書セッションを整理するための機能です",
        whatThisFeatureIs:
          "Svard では、ファイルツリー、開いているファイル、ブックマーク、タブを使って、複数文書を行き来できます。文書管理ツールではなく、読むための作業空間を整える機能です。",
        whenToUse:
          "複数の仕様書や関連ファイルを読み比べる時、よく使う場所を残したい時、開いた文書を整理したい時に使います。",
        workflow: [
          {
            title: "開いている文書を確認する",
            body: "Open Files とタブを使って、現在の読書セッション内の文書を切り替えます。",
            screenshot: screenshot(
              "tabs-open-files.png",
              "開いているファイル",
              "ファイルツリーと Open Files が同時に見える状態を示します。",
              "Svard のファイルツリーと Open Files",
            ),
          },
          {
            title: "よく使う場所を残す",
            body: "Bookmarks にフォルダや文書を残すと、繰り返し読む場所へ戻りやすくなります。",
            screenshot: screenshot(
              "bookmarks.png",
              "ブックマーク",
              "Bookmarks sidebar にフォルダと文書が並ぶ状態を示します。",
              "Svard の Bookmarks sidebar",
            ),
          },
        ],
        limitations:
          "サイドバーとタブ操作は読書セッションの整理に絞ります。同期、共有、プロジェクト管理、閉じたタブの全履歴、すべての右クリック操作はこのページでは扱いません。",
        related: ["タブと開いているファイル", "ブックマーク", "分割表示"],
        screenshots: [
          screenshot(
            "tabs-open-files.png",
            "開いているファイル",
            "ファイルツリーと Open Files が同時に見える状態を示します。",
            "Svard のファイルツリーと Open Files",
          ),
          screenshot(
            "bookmarks.png",
            "ブックマーク",
            "Bookmarks sidebar にフォルダと文書が並ぶ状態を示します。",
            "Svard の Bookmarks sidebar",
          ),
        ],
      },
      generalSettings: {
        title: "一般設定",
        lead: "一般設定は、文書の見え方、拡大率、差分表示の補助を調整する場所です",
        whatThisFeatureIs:
          "一般設定では、画面の明るさ、AsciiDoc の表示テーマ、拡大率、マウス操作による拡大、Change Review Mode をまとめて調整できます。文書ファイル自体を書き換える設定ではなく、Svard 上で読む時の表示と補助機能を変える設定です。",
        whenToUse:
          "文字が小さい、画面を暗くしたい、AsciiDoc の見た目を変えたい、または閲覧中に変更マーカーを出したい時に確認します。",
        supportMatrix: {
          title: "設定できる項目",
          lead: "General では、読書中の見え方と補助表示に関係する項目を扱います。",
          columns: ["項目", "できること", "初期値"],
          rows: [
            [
              "Theme",
              "アプリ全体の表示を Light / Dark から選びます。",
              "Light",
            ],
            [
              "AsciiDoc theme",
              "AsciiDoc 文書の本文スタイルを Antora / Asciidoctor から選びます。",
              "Antora",
            ],
            [
              "Zoom",
              "閲覧画面の拡大率を 80% から 140% の範囲で調整します。",
              "100%",
            ],
            [
              "Zoom with mouse wheel",
              "Command + スクロール、または Ctrl + スクロールで拡大率を変えられるようにします。",
              "Off",
            ],
            [
              "Change Review Mode",
              "作業中の変更を通常の閲覧画面にマーカーとして表示します。",
              "Off",
            ],
          ],
          note: "Zen Mode の細かい表示切り替え、図表、Kroki、セキュリティ、キーバインドは別の設定 section で扱います。",
        },
        workflow: [
          {
            title: "General を開いて調整する",
            body: "Preferences の General で、画面テーマ、AsciiDoc テーマ、拡大率、マウスホイール拡大、Change Review Mode を確認します。",
            screenshot: screenshot(
              "themes-zoom-preferences.png",
              "一般設定",
              "Preferences General で表示と補助機能の設定を確認する状態を示します。",
              "Svard の Preferences General",
            ),
          },
        ],
        limitations:
          "一般設定は読書中の表示と補助表示に絞ります。設定ファイルの保存形式、内部キー、実験的な項目、外部サービス設定はこのページでは扱いません。実際の表示名はアプリ画面を正とします。",
        related: ["テーマと拡大率", "Change Review Mode", "キーバインド"],
      },
      diagramSettings: {
        title: "図表設定",
        lead: "図表設定は、ローカル表示を主経路にした図表の読み込みと確認を調整する設定です",
        whatThisFeatureIs:
          "Svard は Mermaid、PlantUML、Graphviz をローカル表示することを基本にします。図表設定では、重い文書でも本文を読み進めやすくする読み込み挙動や、図表状態の確認につながる項目を扱います。",
        whenToUse:
          "図表を含む長い文書を読む時や、図表の読み込み状態を確認したい時に使います。",
        workflow: [
          {
            title: "図表の読み込み設定を見る",
            body: "Preferences の Diagrams で、図表の高速読み込みに関係する設定を確認します。",
            screenshot: screenshot(
              "diagram-loading-cache.png",
              "図表設定",
              "図表の高速読み込み設定を示します。",
              "Svard の図表設定画面",
            ),
          },
          {
            title: "図表の状態を確認する",
            body: "表示された図表は Diagrams タブで状態を確認できます。設定ページでは内部処理ではなく、読書体験に見える範囲を説明します。",
            screenshot: screenshot(
              "diagram-inspector.png",
              "図表の状態",
              "図表一覧で複数図表の状態を確認する画面を示します。",
              "Svard の Diagrams タブ",
            ),
          },
        ],
        limitations:
          "図表設定は内部キャッシュ実装や保存場所を説明するページではありません。公開成果物には機密情報を含めない方針です。",
        related: [
          "ローカル図表レンダリング",
          "Diagram Inspector",
          "図表の高速読み込みとキャッシュ",
        ],
        screenshots: [
          screenshot(
            "diagram-loading-cache.png",
            "図表設定",
            "図表の高速読み込み設定を示します。",
            "Svard の図表設定画面",
          ),
          screenshot(
            "diagram-inspector.png",
            "図表の状態",
            "図表一覧で複数図表の状態を確認する画面を示します。",
            "Svard の Diagrams タブ",
          ),
        ],
      },
      krokiSettings: {
        title: "Kroki 設定",
        lead: "Kroki 設定は、明示的に有効化した場合だけ外部フォールバックを使うための設定です",
        whatThisFeatureIs:
          "Svard はローカル表示を主経路にし、Kroki は未対応、完全互換、ユーザーが明示した場合の補助経路として扱います。このページでは、既定で外部サービスへ送る設計ではないことを説明します。",
        whenToUse:
          "ローカル表示だけでは足りない図表を扱う前に、外部フォールバックの境界を理解したい時に確認します。",
        workflow: [
          {
            title: "明示設定の位置づけを確認する",
            body: "Kroki は自動既定ではなく、ユーザーが明示した場合の補助経路です。",
            screenshot: screenshot(
              "kroki-fallback.png",
              "Kroki フォールバック",
              "Kroki fallback の明示設定を確認する状態を示します。",
              "Svard の Kroki fallback 設定画面",
            ),
          },
          {
            title: "ローカルファーストの境界を保つ",
            body: "公開Docsでは接続先の具体値や認証情報を見せず、外部利用が明示設定であることだけを示します。",
            screenshot: screenshot(
              "privacy-boundary.png",
              "ローカルファーストの境界",
              "公開成果物に出さない情報の境界を説明する画面を示します。",
              "Svard のプライバシー境界を説明する画面",
            ),
          },
        ],
        limitations:
          "Kroki 設定は高度な補助経路です。すべての図表の完全互換、外部サービスの可用性、接続先の具体設定値は公開Docsで約束しません。",
        related: [
          "明示的な Kroki フォールバック",
          "ローカル図表レンダリング",
          "セキュリティ設定",
        ],
        screenshots: [
          screenshot(
            "kroki-fallback.png",
            "Kroki フォールバック",
            "Kroki fallback の明示設定を確認する状態を示します。",
            "Svard の Kroki fallback 設定画面",
          ),
          screenshot(
            "privacy-boundary.png",
            "ローカルファーストの境界",
            "公開成果物に出さない情報の境界を説明する画面を示します。",
            "Svard のプライバシー境界を説明する画面",
          ),
        ],
      },
      securitySettings: {
        title: "セキュリティ設定",
        lead: "セキュリティ設定は、ローカル文書を読む時に外部参照や公開成果物の境界を確認するための設定です",
        whatThisFeatureIs:
          "Svard はローカル文書を安全に読むことを基本にします。セキュリティ設定では、外部画像、ローカルファイル、公開成果物に出さない情報の境界を確認します。",
        whenToUse:
          "外部参照を含む文書を読む前や、スクリーンショットやログに出してよい情報の境界を確認したい時に使います。",
        workflow: [
          {
            title: "境界を確認する",
            body: "公開成果物に出さない情報を、設定と方針の両方で確認します。",
            screenshot: screenshot(
              "privacy-boundary.png",
              "安全境界",
              "公開成果物に出さない情報の境界を説明する画面を示します。",
              "Svard の安全境界を説明する画面",
            ),
          },
          {
            title: "ローカル文書として開く",
            body: "Svard の主経路は、開いたフォルダ内の文書をローカルで読むことです。",
            screenshot: screenshot(
              "files.png",
              "ローカル文書",
              "ファイルツリーでローカル文書が見える状態を示します。",
              "Svard のファイルツリーでローカル文書を表示している画面",
            ),
          },
        ],
        limitations:
          "このページは公開Docs向けの概要です。内部サンドボックス仕様、脅威モデル全文、監査ログ仕様、具体的な秘密値は扱いません。",
        related: [
          "ローカルファーストの考え方",
          "Kroki 設定",
          "ネットワークとプロバイダ設定",
        ],
        screenshots: [
          screenshot(
            "privacy-boundary.png",
            "安全境界",
            "公開成果物に出さない情報の境界を説明する画面を示します。",
            "Svard の安全境界を説明する画面",
          ),
          screenshot(
            "files.png",
            "ローカル文書",
            "ファイルツリーでローカル文書が見える状態を示します。",
            "Svard のファイルツリーでローカル文書を表示している画面",
          ),
        ],
      },
      keybindings: {
        title: "ショートカット設定",
        lead: "ショートカット設定は、よく使う操作に割り当てるキーボード操作を確認・調整する場所です",
        whatThisFeatureIs:
          "Svard では、検索、移動、表示切り替え、設定表示などの操作にキーボードショートカットを割り当てられます。現在の Preset は Native OS のみで、macOS では Cmd、Windows / Linux では Ctrl を基準にした既定ショートカットを使います。",
        whenToUse:
          "クイックオープン、検索、タブ切り替えなどを繰り返し使うようになり、既定ショートカットの確認や個別の割り当て変更をしたい時に確認します。",
        supportMatrix: {
          title: "設定できること",
          lead: "Keybindings section はキーボードショートカットだけを扱います。マウスジェスチャーは別の設定です。",
          columns: ["項目", "できること", "現状"],
          rows: [
            ["Preset", "ショートカット体系を選びます。", "Native OS のみ"],
            [
              "Shortcut assignments",
              "各 action のショートカットを検索し、Record / Clear で割り当てを調整します。",
              "変更可能",
            ],
            [
              "Reset to defaults",
              "変更した割り当てを既定値に戻します。",
              "Native OS 既定値へ戻す",
            ],
            [
              "Search",
              "action 名、command ID、現在のショートカットで一覧を絞り込みます。",
              "利用可能",
            ],
          ],
          note: "Mouse Gestures は Keybindings には含めません。右クリックドラッグなどの操作は Mouse Gestures section で扱います。",
        },
        workflow: [
          {
            title: "Keybindings を開く",
            body: "Preferences の Keybindings で、現在の Preset とショートカット割り当て一覧を確認します。",
            screenshot: screenshot(
              "keybindings.png",
              "ショートカット設定",
              "Preferences の Keybindings でショートカット割り当てを確認する状態を示します。",
              "Svard の Keybindings 設定画面",
            ),
          },
        ],
        limitations:
          "現在の Preset は Native OS のみです。Vim / Emacs などの別体系は公開Docs上の利用可能機能として扱いません。ショートカット表示はOS、キーボード、設定で変わる場合があります。",
        related: ["クイックオープン", "コマンドパレット", "マウスジェスチャー"],
      },
      mouseGestures: {
        title: "マウスジェスチャー",
        lead: "マウスジェスチャーは、右ボタンドラッグで戻る、進む、タブ移動などを実行する補助操作です",
        whatThisFeatureIs:
          "Svard では、閲覧画面上で右ボタンを押したままドラッグする方向に、ナビゲーションやタブ操作を割り当てられます。初期状態では無効で、Preferences の Mouse Gestures から明示的に有効化します。",
        whenToUse:
          "戻る、進む、文書先頭・末尾への移動、タブ切り替えなどをマウス中心で繰り返したい時に使います。",
        supportMatrix: {
          title: "設定できること",
          lead: "Mouse Gestures はキーボードショートカットとは別の入力設定です。",
          columns: ["項目", "できること", "初期値"],
          rows: [
            [
              "Enable right-button drag gestures",
              "右ボタンドラッグのジェスチャーを有効化します。",
              "Off",
            ],
            ["Show gesture trail", "ドラッグ中の軌跡を表示します。", "On"],
            [
              "Minimum distance",
              "ジェスチャーとして認識する最小移動距離を調整します。",
              "32px",
            ],
            [
              "Gesture assignments",
              "方向パターンを action に割り当て、Record / Clear で調整します。",
              "既定割り当てあり",
            ],
          ],
          note: "ジェスチャーは viewer 上でのみ動作し、Preferences や Quick Open を開いている時は実行されません。",
        },
        workflow: [
          {
            title: "Mouse Gestures を有効化する",
            body: "Preferences の Mouse Gestures で右ボタンドラッグを有効化し、軌跡表示や最小距離を確認します。",
            screenshot: screenshot(
              "mouse-gestures.png",
              "マウスジェスチャー設定",
              "Preferences の Mouse Gestures で右ボタンドラッグ設定を確認する状態を示します。",
              "Svard の Mouse Gestures 設定画面",
            ),
          },
          {
            title: "割り当てを調整する",
            body: "Gesture assignments で、戻る、進む、タブ移動、クイックオープンなどの action に方向パターンを割り当てます。",
            screenshot: screenshot(
              "mouse-gestures-record.png",
              "ジェスチャー割り当て",
              "Record / Clear でジェスチャー割り当てを調整する状態を示します。",
              "Svard の Mouse Gestures 割り当て設定画面",
            ),
          },
        ],
        limitations:
          "マウスジェスチャーは初期状態では無効です。右クリックメニューやブラウザー/OS の操作と競合する場合があるため、必要なユーザーだけが明示的に有効化する設定として扱います。",
        related: [
          "ショートカット設定",
          "タブと開いているファイル",
          "クイックオープン",
        ],
      },
      networkProviderSettings: {
        title: "ネットワーク設定",
        lead: "ネットワーク設定は、明示的な外部アクセスで使う HTTP proxy を設定する場所です",
        whatThisFeatureIs:
          "Svard の通常利用はローカル文書の閲覧です。Network では、外部フォールバックやプロバイダ接続を明示的に使う場合に必要な HTTP proxy を設定します。PR / MR Providers は別の設定タブで扱います。",
        whenToUse:
          "社内 proxy などを経由しないと外部サービスへ接続できない環境で、Kroki や PR / MR Provider などの明示的な外部連携を使う前に確認します。",
        supportMatrix: {
          title: "設定できること",
          lead: "Network は外部通信そのものの有効化ではなく、通信経路の補助設定です。",
          columns: ["項目", "できること", "初期値"],
          rows: [
            ["HTTP proxy", "proxy を使うかどうかを選びます。", "Disabled"],
            [
              "Proxy URL",
              "Custom を選んだ場合に proxy の接続先を指定します。",
              "未設定",
            ],
          ],
          note: "プロバイダの Host URL、認証情報、PR / MR target 検出は PR / MR Providers で扱います。",
        },
        workflow: [
          {
            title: "Network を開く",
            body: "Preferences の Network で HTTP proxy の利用有無と接続先を確認します。",
            screenshot: screenshot(
              "network-settings.png",
              "ネットワーク設定",
              "Preferences の Network で HTTP proxy 設定を確認する状態を示します。",
              "Svard の Network 設定画面",
            ),
          },
        ],
        limitations:
          "Network は通信経路の設定です。外部フォールバックやプロバイダ連携を自動で有効化する設定ではありません。接続先の具体値や認証情報は公開Docsに含めません。",
        related: [
          "PR / MR Providers",
          "Kroki 設定",
          "明示的な Kroki フォールバック",
        ],
        screenshots: [
          screenshot(
            "network-settings.png",
            "ネットワーク設定",
            "Preferences の Network で HTTP proxy 設定を確認する状態を示します。",
            "Svard の Network 設定画面",
          ),
        ],
      },
      prMrProviders: {
        title: "PR / MR Providers",
        lead: "PR / MR Providers は、Branch Diff で比較対象ブランチを見つけるための設定です",
        whatThisFeatureIs:
          "PR / MR Providers では、GitHub と GitLab の接続設定を管理します。Source Control の Branch Diff で PR target または MR target を候補として出すための補助であり、通常の文書閲覧やローカル差分確認には不要です。",
        whenToUse:
          "Pull Request や Merge Request の比較対象ブランチを、手動で選ぶ代わりにプロバイダ情報から検出したい時に使います。",
        supportMatrix: {
          title: "設定できること",
          lead: "GitHub と GitLab は同じ構成で設定します。",
          columns: ["項目", "できること", "扱い"],
          rows: [
            [
              "接続先",
              "接続するプロバイダの host を指定します。",
              "公開Docsでは値を見せません",
            ],
            [
              "認証情報",
              "非公開リポジトリや API 接続に必要な認証情報を登録します。",
              "OS の資格情報ストアに保存",
            ],
            [
              "有効化",
              "Branch Diff で PR target / MR target 検出に使うかを選びます。",
              "明示的に有効化",
            ],
            [
              "接続確認",
              "保存済みの認証情報で接続確認を行います。",
              "保存後に実行可能",
            ],
          ],
          note: "認証情報は app config には保存しません。公開Docsやスクリーンショットには実際の値を表示しません。",
        },
        workflow: [
          {
            title: "PR / MR Providers を開く",
            body: "Preferences の PR / MR Providers で GitHub または GitLab の設定を確認します。",
            screenshot: screenshot(
              "pr-mr-providers.png",
              "PR / MR Providers",
              "Preferences の PR / MR Providers で provider 設定を確認する状態を示します。",
              "Svard の PR / MR Providers 設定画面",
            ),
          },
        ],
        limitations:
          "PR / MR Providers は Branch Diff の比較対象検出を補助する設定です。stage、commit、merge、provider 上のレビュー操作は扱いません。認証情報や接続先の実値は公開Docsに含めません。",
        related: ["ブランチ差分", "ネットワーク設定", "変更一覧"],
        screenshots: [
          screenshot(
            "pr-mr-providers.png",
            "PR / MR Providers",
            "Preferences の PR / MR Providers で provider 設定を確認する状態を示します。",
            "Svard の PR / MR Providers 設定画面",
          ),
        ],
      },
      supportedDiagrams: {
        title: "対応図表",
        lead: "対応図表では、現状の図表サポートとフォールバック経路を一覧できます",
        whatThisFeatureIs:
          "Svard は文書内の図表をローカル表示することを基本にします。対応状況は図表の種類ごとに異なり、必要な場合だけ明示設定された補助経路を使います。",
        whenToUse:
          "文書内の図表がどの経路で表示されるか、外部フォールバックがどこまで補助するかを先に確認したい時に使います。",
        supportMatrix: {
          title: "現状のサポートマトリクス",
          lead: "公開 Docs で約束する範囲を、主経路と補助経路に分けて整理しています。",
          columns: ["図表", "入力", "主経路", "補助経路", "注意点"],
          rows: [
            [
              "Mermaid",
              "Markdown のコードブロック、AsciiDoc の図表ブロック",
              "ローカル表示",
              "明示的な Kroki フォールバック",
              "複雑な図表では表示差が出る場合があります",
            ],
            [
              "PlantUML",
              "Markdown の plantuml / puml ブロック、AsciiDoc の PlantUML ブロック",
              "ローカル表示",
              "Native PlantUML 実行ファイルを設定した外部 PlantUML フォールバック、または明示的な Kroki フォールバック",
              "外部 PlantUML はユーザーが実行ファイルを用意し、設定した場合だけ使います",
            ],
            [
              "Graphviz / DOT",
              "Markdown の graphviz / dot ブロック、AsciiDoc の Graphviz ブロック",
              "ローカル表示",
              "明示的な Kroki フォールバック",
              "DOT はフォールバック時に Graphviz として扱います",
            ],
            [
              "Kroki 対応図表",
              "blockdiag、seqdiag、actdiag、nwdiag、packetdiag、rackdiag、C4-PlantUML",
              "ローカル主経路ではありません",
              "ユーザー設定後の Kroki",
              "公開サービスへの暗黙送信はしません",
            ],
          ],
          note: "公開成果物には機密情報を含めない方針です。詳細はローカルファーストの考え方とセキュリティ設定で扱います。",
        },
        workflow: [
          {
            title: "図表の状態を一覧する",
            body: "Diagrams タブで、文書内の図表、レンダラー、表示状態を確認します。",
            screenshot: screenshot(
              "diagram-inspector.png",
              "図表一覧",
              "Diagrams タブで複数の図表と状態を表示した状態を示します。",
              "Svard の Diagrams タブで図表一覧を表示している画面",
            ),
          },
          {
            title: "図表を大きく確認する",
            body: "本文内で小さく見える図表は、プレビューで拡大して確認できます。",
            screenshot: screenshot(
              "diagram-preview.png",
              "図表の拡大表示",
              "図表をプレビューで拡大表示した状態を示します。",
              "Svard で図表を拡大表示している画面",
            ),
          },
        ],
        limitations:
          "外部フォールバックは明示設定時だけの補助経路です。完全互換やすべての複雑図表の表示を約束するものではありません。",
        related: [
          "ローカル図表表示",
          "Diagram Inspector",
          "明示的な Kroki フォールバック",
          "外部 PlantUML フォールバック",
        ],
        screenshots: [
          screenshot(
            "diagram-inspector.png",
            "図表一覧",
            "Diagrams タブで複数の図表と状態を表示した状態を示します。",
            "Svard の Diagrams タブで図表一覧を表示している画面",
          ),
          screenshot(
            "diagram-preview.png",
            "図表の拡大表示",
            "図表をプレビューで拡大表示した状態を示します。",
            "Svard で図表を拡大表示している画面",
          ),
        ],
      },
      commandPalette: {
        title: "コマンドパレット",
        lead: "コマンドパレットは、クイックオープンからコマンド候補だけを絞り込んで実行するモードです",
        whatThisFeatureIs:
          "Svard では、クイックオープンの入力欄で > を使うと、文書や見出しではなくコマンド候補を表示できます。表示切り替え、設定表示、検索、差分確認などの操作を、メニュー階層をたどらず名前で探して実行するための入口です。",
        whenToUse:
          "実行したい操作名の一部は分かっているが、どのメニューにあるか探したくない時に使います。文書や見出しへ移動したい場合は、クイックオープンの通常モードや @ モードを使います。",
        workflow: [
          {
            title: "クイックオープンを開く",
            body: "File メニューの Quick Open... または割り当てられたショートカットで入力欄を開きます。",
          },
          {
            title: "> でコマンド候補に切り替える",
            body: "先頭に > を入力すると、候補一覧がコマンドに切り替わります。続けて操作名の一部を入力し、目的のコマンドを選びます。",
            screenshot: screenshot(
              "command-palette.png",
              "コマンド候補",
              "クイックオープンでコマンド候補に切り替えた状態を示します。",
              "Svard のコマンド候補一覧",
            ),
          },
        ],
        limitations:
          "コマンドパレットはクイックオープンのコマンド実行モードです。このページではコマンド候補の呼び出し方だけを扱い、文書移動、見出し移動、ソース行への移動はクイックオープンのページに分けています。利用できるコマンドや表示名は、OS や設定により変わる場合があります。",
        related: [
          "クイックオープン",
          "タブと開いているファイル",
          "キーバインド",
        ],
        screenshots: [
          screenshot(
            "command-palette.png",
            "コマンド候補",
            "クイックオープンでコマンド候補に切り替えた状態を示します。",
            "Svard のコマンド候補一覧",
          ),
        ],
      },
    },
  },
  download: {
    eyebrow: "Download",
    heading: "GitHub Releases からダウンロードできます",
    lead: "インストーラー、リリースノート、チェックサムは GitHub Releases を公式の入手元として確認してください。未署名ビルドを開く前に、プラットフォーム別の注意を確認してください",
    resources: {
      heading: "入手と確認",
      items: [
        {
          title: "GitHub Releases",
          body: "最新版の macOS / Windows 向け配布物は、公式の GitHub Releases から入手します。",
          state: "公式",
          href: releasesUrl,
        },
        {
          title: "Changelog",
          body: "更新前に、ユーザー向けの変更点とリリースノートを確認できます。",
          state: "公開中",
          href: changelogUrl,
        },
        {
          title: "System requirements",
          body: "サポート対象のOS、CPU、メモリ要件を公開前提の短い一覧で示します。",
          state: "推奨要件",
          details: [
            "macOS: Apple Silicon（M1以降）",
            "Windows: x86_64",
            "Memory: 4GB以上、快適利用は8GB以上推奨",
          ],
        },
        {
          title: "配布上の注意",
          body: "利用前に確認したい対応OSと配布状態を明記します。",
          state: "準備中",
          details: [
            "Linuxは現状非サポート",
            "macOS / Windows は未署名ビルドとして配布予定",
            "WSL環境やWSL上のファイルを対象にした利用では、ファイル監視やI/Oの性能、Git参照の解決に問題が出る場合があります。",
          ],
        },
        {
          title: "Repository / Issues",
          body: "公開リポジトリの確認や issue 報告は GitHub から行えます。",
          state: "公開中",
          href: issuesUrl,
        },
        {
          title: "Security / signing",
          body: "コード署名と配布経路が確定するまで、未署名ビルドとして扱う前提の注意を掲載します。",
          state: "準備中",
          details: [
            "macOS / Windows は未署名ビルドとして配布予定",
            "公式リリースから取得した配布物だけを許可対象にしてください",
          ],
        },
      ],
    },
    platformSupport: {
      heading: "プラットフォーム対応",
      rows: [
        {
          platform: "macOS",
          status: "サポート対象",
          command: "xattr -dr com.apple.quarantine /Applications/Svard.app",
          note: "公式リリースから取得したことを確認してから実行してください。Finderで右クリックして「開く」またはシステム設定から許可する方法も使えます。",
        },
        {
          platform: "Windows",
          status: "サポート対象",
          command: "Unblock-File -Path .\\Svard.exe",
          note: "PowerShellでダウンロードした実行ファイルに対して実行します。SmartScreenが表示された場合は「詳細情報」から実行できます。",
        },
        {
          platform: "Linux",
          status: "非サポート",
          command: "なし",
          note: "現状はLinux向け配布物と起動手順を提供しません。",
        },
      ],
    },
  },
};
