import { screenshot } from "./screenshots";

export const aiChatDocsJa = {
  aiChat: {
    title: "AI Chatを始める",
    lead: "AI Chatは、文書を読みながら同じワークスペースでCodexへ質問できるExperimental機能です",
    whatThisFeatureIs:
      "Svardは、ローカルにインストールされたCodexを最初の対応providerとして起動し、質問へのMarkdown回答やVisualizeによる対話的な表示をAI Chatに返します。AI Chatを開くだけでは会話を開始せず、最初の質問を送信した時に新しいchatを開始します。",
    whenToUse:
      "仕様や手順の意味を確認したい時、レビュー中の疑問を文書のそばで整理したい時、変更後に確認すべき点を洗い出したい時に使います。",
    workflow: [
      {
        title: "Codexを準備する",
        body: "PreferencesのAI ProvidersでCodexの検出状態、モデル、推論強度、応答スタイルを確認します。Claude Code CLIとGitHub Copilot CLIは現在未対応です。",
        screenshot: screenshot(
          "ai-chat-provider-settings.png",
          "AI ProvidersのCodex設定",
          "Codexの準備状態とAI Chatで使うモデル設定を確認する画面です。",
          "SvardのAI ProvidersでCodexの設定を確認している画面",
        ),
      },
      {
        title: "表示場所を選ぶ",
        body: "上部のAI ChatからRight side、Bottom、Separate windowを選びます。Diffを開いている場合はDiff Previewにも表示できます。",
      },
      {
        title: "質問を送る",
        body: "Autoは通常のMarkdown回答、Visualizeは対話的な表示が必要な質問に使います。質問を送るまではCodex sessionを作成しません。",
        screenshot: screenshot(
          "ai-chat-main.png",
          "文書とAI Chat",
          "公開用文書を読みながら右側のAI Chatへ質問し、回答を確認している状態です。",
          "Svardデスクトップアプリで文書と右側AI Chatを表示している画面",
        ),
      },
    ],
    limitations:
      "AI ChatはExperimentalです。最初の対応providerはCodexで、利用には対応するCodexのインストールと認証が必要です。AI Chatを使わない文書閲覧とローカル図表レンダリングは従来どおりローカルを主経路にします。",
    related: [
      "AI ChatのコンテキストとAgent Access",
      "AI Chatの会話と変更レビュー",
      "ローカルファーストの考え方",
    ],
  },
  aiChatContextAccess: {
    title: "AI ChatのコンテキストとAgent Access",
    lead: "質問へ必要な文書情報だけを追加し、Codexに許可する操作範囲をchatごとに選びます",
    whatThisFeatureIs:
      "現在の文書は送信時にワークスペース相対パスだけが渡されます。本文、選択範囲、画像、図表、Rendered Diffの現在の変更は、ユーザーが明示的に追加した場合だけturnのコンテキストになります。",
    whenToUse:
      "回答に特定の段落、図表、変更前後の内容が必要な時や、読み取りだけに限定するかファイル変更を許可するかを決めたい時に使います。",
    supportMatrix: {
      title: "Agent Access",
      lead: "権限とNetwork／Web Searchは、利用するproviderが対応する範囲で選択できます。",
      columns: ["設定", "許可する範囲", "主な用途"],
      rows: [
        [
          "Observe",
          "読み取り専用。Networkは無効です。",
          "文書の理解とレビュー",
        ],
        [
          "Agent",
          "明示ワークスペース内の変更。境界外は承認が必要です。",
          "確認しながら行う修正",
        ],
        [
          "Full Access",
          "chatごとの明示確認が必要な広い権限です。",
          "利用者が必要性を判断した操作",
        ],
      ],
      note: "NetworkとWeb Searchは権限とは別の設定です。未対応のprovider capabilityは表示しません。",
    },
    workflow: [
      {
        title: "必要なコンテキストを追加する",
        body: "選択範囲のAsk AI、Addメニュー、画像のpaste／drop、Rendered Diffの変更操作から追加します。追加内容は送信前に削除または元位置の確認ができます。",
        screenshot: screenshot(
          "ai-chat-context-access.png",
          "明示コンテキストとAgent Access",
          "選択範囲を追加したcomposerとObserveのAgent Access設定を同時に確認する状態です。",
          "Svard AI Chatで選択範囲とAgent Accessを確認している画面",
        ),
      },
      {
        title: "操作範囲を確認する",
        body: "送信前にObserve、Agent、Full Accessを選びます。Full Accessは保存済みの既定値に関係なく、新しいchatごとに確認します。",
        screenshot: screenshot(
          "ai-chat-display-review.png",
          "変更レビューと表示先",
          "Changed filesのレビュー導線とAI Chatの表示先を確認している状態です。",
          "Svard AI ChatでChanged filesと表示先を確認している画面",
        ),
      },
    ],
    limitations:
      "選択範囲、画像、変更内容はturnごとの明示コンテキストで、次の質問へ自動継承しません。絶対パス、provider内部ID、raw reasoningはUIや公開成果物へ表示しません。",
    related: [
      "AI Chatを始める",
      "AI Chatの会話と変更レビュー",
      "AI向けコピーと参照",
    ],
  },
  aiChatConversationReview: {
    title: "AI Chatの会話と変更レビュー",
    lead: "会話を保ったまま表示場所を変え、実行中の質問を調整し、Codexが変更した文書をレビューできます",
    whatThisFeatureIs:
      "AI ChatはRight side、Bottom、Diff Preview、Separate windowの間で同じ会話、draft、実行中turn、承認状態を維持します。Svardで作成したchatはRecent／Archivedから再開、rename、Archive、Restore、Deleteできます。",
    whenToUse:
      "長い回答を別ウィンドウで読みたい時、Diffと会話を同時に確認したい時、過去の質問へ戻りたい時、Codexが報告した変更をSource Controlで確認したい時に使います。",
    workflow: [
      {
        title: "会話を管理する",
        body: "New Chatで会話を分け、RecentとArchivedからSvardで作成したchatを再開します。rename、Archive／Restore、確認付きDeleteも同じ一覧で行います。",
        screenshot: screenshot(
          "ai-chat-session-history.png",
          "AI Chatの会話履歴",
          "RecentとArchivedの会話を確認し、過去のchatへ戻る入口を示します。",
          "Svard AI Chatで会話履歴を表示している画面",
        ),
      },
      {
        title: "実行中の質問を調整する",
        body: "実行中は次の入力をQueueへ1件保留できます。Steerは現在のturnへ追加指示を送り、Stop and Sendは現在の処理を止めて新しい入力を送ります。",
      },
      {
        title: "変更された文書を確認する",
        body: "回答のChanged filesからReview changesを選ぶと、AI Chatを閉じずに現在のSource Control > Changesを開きます。保存済みのraw diffではなく、現在の作業ツリーをレビューします。",
        screenshot: screenshot(
          "ai-chat-display-review.png",
          "表示場所と変更レビュー",
          "AI Chatの表示先メニューとChanged filesからレビューへ進む状態を示します。",
          "Svard AI Chatで表示場所と変更文書のレビュー操作を確認している画面",
        ),
      },
    ],
    limitations:
      "同じchatを複数ウィンドウから同時操作する機能ではありません。MainとSeparate windowの一方だけが操作主体になります。Review changesはstage、commit、discardを行いません。",
    related: [
      "AI Chatを始める",
      "AI ChatのコンテキストとAgent Access",
      "変更一覧",
    ],
  },
  copyReferencesForAi: {
    title: "AI向けコピーと参照",
    lead: "表示内容と参照元を分けてコピーし、AI Chatや外部のレビュー作業へ必要な情報だけを渡します",
    whatThisFeatureIs:
      "本文、ソース、画像、図表、Rendered Diffには、表示内容そのものをコピーする操作と、ワークスペース相対の参照情報を添える操作があります。用途に応じて本文、画像、参照だけを選べます。",
    whenToUse:
      "AI Chat以外のツールへ引用したい時、レビューコメントへ出典を添えたい時、図表や差分の位置を本文全文なしで伝えたい時に使います。",
    supportMatrix: {
      title: "代表的なコピー操作",
      columns: ["対象", "操作例", "出力"],
      rows: [
        ["本文／選択範囲", "Copy Text Reference", "表示テキストと文書内の参照"],
        [
          "ソース",
          "Copy Source / Copy Source Reference",
          "元の記法、または参照情報",
        ],
        [
          "画像／図表",
          "Copy Image / Copy Image with Reference",
          "表示画像、または参照付き画像",
        ],
        ["Rendered Diff", "Copy Diff Reference", "比較元を含む相対参照"],
      ],
      note: "表示される操作は対象と利用できる参照情報によって変わります。",
    },
    workflow: [
      {
        title: "本文またはソースを選ぶ",
        body: "表示済み文書の右クリックメニューから、内容だけをコピーするか、Source／Text Referenceを含めるかを選びます。",
        screenshot: screenshot(
          "copy-reference-actions.png",
          "本文とソースのコピー操作",
          "公開用文書の右クリックメニューで本文、ソース、参照のコピー操作を確認する状態です。",
          "Svardの文書上で本文とソースのコピー操作を表示している画面",
        ),
      },
      {
        title: "画像または図表をコピーする",
        body: "表示画像だけが必要ならCopy Image、出典も必要ならCopy Image with Referenceまたは図表のCopy Referenceを使います。",
        screenshot: screenshot(
          "copy-image-reference.png",
          "画像の参照付きコピー",
          "表示済み画像の右クリックメニューで画像と参照付き画像のコピーを選ぶ状態です。",
          "Svardで画像のコピーと参照付きコピー操作を表示している画面",
        ),
      },
    ],
    limitations:
      "参照はワークスペース内で解決できる範囲に限定します。公開Docsとスクリーンショットにはコピー結果、絶対パス、非公開本文、図表ソース、認証情報を含めません。",
    related: [
      "文書操作",
      "表のコピー操作",
      "AI ChatのコンテキストとAgent Access",
    ],
  },
};
