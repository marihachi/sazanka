// 日本語の文言の表。ほかの言語の表も、これと同じ形 (messages.ts の Messages) にする。
// 部品の種類ごとの文言は、種類のフォルダの view.ts に言語ごとに書く
import type { PortProblem } from '../circuit/module';
import type { ProjectError } from '../circuit/project';
import type { ProjectFileError } from '../file/projectFile';
import type { StoredError } from '../file/storage';
import type { ProblemCode } from '../problems/problems';
import type { LanguageSetting } from './language';
import type { ErrorTexts } from './messages';

export const ja = {
  common: {
    ok: 'OK',
    cancel: 'キャンセル',
    close: '閉じる',
    /** メイン回路の名前。メイン回路は名前を持たないので、これを出す (messages.ts の getCircuitName) */
    mainCircuit: 'メイン',
    /** 「入力 1」「出力 2」のような、入力か出力か (kind が input か) とポート番号 */
    portName: (kind: string, portNumber: number | string) =>
      `${kind === 'input' ? '入力' : '出力'} ${portNumber}`,
    integerRange: (min: number, max: number) => `${min}〜${max} の整数で入力してください`,
  },
  header: {
    toolbar: 'プロジェクトの操作',
    undo: '元に戻す',
    undoTitle: '元に戻す (Ctrl+Z)',
    redo: 'やり直し',
    redoTitle: 'やり直し (Ctrl+Shift+Z / Ctrl+Y)',
    preferences: '環境設定',
    about: 'このアプリについて',
  },
  about: {
    title: 'sazanka について',
    summary: 'ブラウザで動く論理回路シミュレータです。',
    repository: 'GitHub リポジトリ',
    licenses: '使用しているライブラリのライセンス',
    license:
      'MIT ライセンスで利用できます。ロゴには Inter SemiBold (SIL OFL) というフォントを使っています。',
  },
  tabs: {
    circuitTabTooltip: 'ドラッグで並べ替えできます。',
    close: (name: string) => `${name} を閉じる`,
  },
  toolbar: {
    select: '選択',
    selectTitle: '選択モード (V): 部品や配線を選んで動かす',
    wire: '配線',
    wireTitle: '配線モード (W): クリックした点から点へ配線を引く',
    split: '分割',
    splitTitle: '分割モード (S): 配線をクリックした点で 2 本に分ける',
    rotate: '回転',
    rotateTitle: '回転 (R)',
    pause: '一時停止',
    pauseTitle: 'シミュレーションを一時停止',
    resume: '再開',
    resumeTitle: 'シミュレーションを再開',
    stepBack: '1 tick 戻す',
    stepBackTitle: '1 tick だけ時間を戻す',
    stepForward: '1 tick 進める',
    stepForwardTitle: '1 tick だけ時間を進める',
    circuitSettings: '回路設定',
    circuitSettingsTitle:
      '回路設定: シートの大きさ、パッケージ、ポートの名前、ピンの割り当てを変える',
  },
  sidePanel: {
    project: 'プロジェクト',
    parts: '部品',
  },
  project: {
    title: 'プロジェクト',
    /** パネルの上の「⋯」 */
    menu: 'プロジェクトの操作',
    newCircuit: '新しい回路…',
    newProject: '新規作成…',
    openProject: '開く…',
    saveProjectAs: '名前を付けて保存…',
    /** 行の「⋯」。name は行の名前 */
    rowMenu: (name: string) => `${name} の操作`,
    open: '開く',
    rename: '名前を変える',
    remove: 'プロジェクトから削除…',
    newFolder: '新しいフォルダ…',
    moveToFolder: 'フォルダを変える…',
    removeFolder: 'フォルダを削除',
    /** メイン回路の印 (★) の読み上げ用 */
    main: 'メイン回路',
    usedIn: '使われている所',
    notUsed: 'どこにも置かれていません',
    /** 使われている所の 1 つ。name は回路の名前、count は置いている数 */
    usage: (name: string, count: number) => `${name} (${count})`,
    usageSeparator: '、',
    expand: (name: string) => `${name} を開く`,
    collapse: (name: string) => `${name} を閉じる`,
  },
  folders: {
    /** フォルダに入れない (いちばん上) */
    none: '(フォルダなし)',
    folder: 'フォルダ',
    create: 'フォルダを作る',
    newTitle: '新しいフォルダ',
    name: 'フォルダの名前',
    add: '作成',
    nameRequired: '名前を入力してください',
    nameBad: '「/」を含む名前と、「.」「..」は使えません',
    nameTaken: '同じ名前のフォルダがすでにあります',
    moveTitle: (name: string) => `「${name}」のフォルダを変える`,
    move: '移す',
    notEmpty: (name: string) =>
      `「${name}」の中に回路かフォルダがあるため、削除できません。先に中のものを動かすか、削除してください。`,
  },
  palette: {
    groups: {
      io: '入出力',
      source: '信号源',
      gate: '論理ゲート',
      latch: 'ラッチ',
      flipflop: 'フリップフロップ',
      device: 'デバイス',
      module: 'モジュール',
    },
    expandAll: 'すべて展開',
    collapseAll: 'すべて折りたたむ',
    noModules: 'モジュールはまだありません',
    selfModule: '回路の中に自分自身は置けません',
    containsThis: (name: string) => `「${name}」はこの回路を含んでいるため置けません`,
  },
  sheet: {
    unknownModule: '(不明)',
    /** 見つからないモジュールの本体に書く */
    missing: '見つからない',
    /** タブがないときに、シートの所に出す */
    noCircuit: '開いている回路はありません',
    /** 見つからないモジュールを選んだときに、プロパティ欄に出す名前 */
    missingName: (name: string) => `${name || '(不明)'} (見つからない)`,
    zoomOut: '縮小',
    zoomReset: '等倍に戻す',
    zoomIn: '拡大',
    fit: '回路全体を表示',
    trash: 'ここへドラッグで削除',
    trashLabel: '削除',
  },
  property: {
    panel: '部品のプロパティ',
    heading: 'プロパティ',
    portNumber: 'ポート番号',
    portLabel: 'ポート名',
    noPortLabel: '名前未設定',
    duplicatePortName: 'ほかのポートと同じ名前は付けられません',
    portNameHelp: 'モジュールとして置くと、ピンの名前になります',
    noItems: 'この部品に設定できる項目はありません',
    selectOne: '部品を1つ選ぶと、その部品の項目を編集できます',
    clockPeriod: '周期 (tick)',
    clockPeriodHelp: (ticksPerSecond: number, seconds: number) =>
      `ON と OFF を一往復する tick 数。今の速さ (${ticksPerSecond} tick/秒) では ${seconds} 秒`,
  },
  status: {
    cannotRotate: 'はみ出すため回転できません',
  },
  problems: {
    title: '問題',
    /** 数の読み上げ用 */
    countLabel: (errors: number, warnings: number) => `エラー ${errors} 件、警告 ${warnings} 件`,
    empty: '問題はありません',
    error: 'エラー',
    warning: '警告',
    /** 起きているか所の数 */
    count: (n: number) => `${n} か所`,
    resize: '問題パネルの高さを変える',
    close: '問題パネルを閉じる',
    messages: {
      UNSTABLE: '発振しています',
      CONFLICT: '出力がぶつかっています',
      UNEXPOSED_PORTS: 'ピンに出ていない INPUT / OUTPUT があります',
      OUTSIDE_SHEET: 'シートの外に部品か配線があります',
      MISSING_CIRCUIT: (name: string) => `見つからない回路: ${name || '(不明)'}`,
    } satisfies Record<ProblemCode, string | ((name: string) => string)>,
  },
  preferences: {
    title: '環境設定',
    ticksPerSecond: 'シミュレーションの速さ (tick/秒)',
    ticksPerSecondHelp: (defaultValue: number) =>
      `1 秒に進める tick 数。小さくするとゆっくり進み、信号が 1 tick ずつ伝わる様子を目で追えます。既定は ${defaultValue}。CLOCK の周期 (秒) は、CLOCK ごとの tick 数 ÷ この値です。回路が大きいと、この速さより遅く進むことがあります。`,
    showGrid: 'シートに方眼を表示する',
    roundWires: '配線の角を丸める',
    accent: 'アクセントカラー',
    otherColor: 'ほかの色を選ぶ',
    /** 言語の欄の名前。今の言語が読めない人にも見つけられるよう、英語も添える */
    language: '言語 / Language',
    languages: {
      auto: '自動 (ブラウザの言語)',
      ja: '日本語',
      en: 'English',
    } satisfies Record<LanguageSetting, string>,
  },
  circuitSettings: {
    title: (name: string) => `回路設定: ${name}`,
    author: '作者名 (省略可)',
    tabs: {
      general: '全般',
      module: 'モジュール',
      /** 使えない値があるタブの印 (読み上げ用) */
      invalid: '使えない値があります',
    },
    apply: '適用',
    packages: {
      dip: 'DIP (左右の 2 辺にピン)',
      qfp: 'QFP (4 辺にピン)',
      split: 'ロジック (入力は左、出力は右)',
    },
    package: 'パッケージ',
    pins: 'ピン数',
    dipPinsError: 'DIP のピン数は、4〜256 の偶数で入力してください',
    qfpPinsError: 'QFP のピン数は、8〜256 の 4 の倍数で入力してください',
    splitHelp:
      '入力は左、出力は右に、ポート番号の順 (入力 1、出力 1 がいちばん上) に並びます。ピン番号は使いません。',
    ports: 'ポート',
    duplicatePortName: 'ほかのポートと同じ名前は付けられません',
    assignment: 'ピンの割り当て',
    assignInOrder: '上から順に割り当て直す',
    renumberPorts: '上から順に番号を振り直す',
    unassigned: '割り当てのないポート (外側のピンに出ない):',
    listSeparator: '、',
    wiringWarning:
      'パッケージやピンの割り当てを変更すると、この回路をモジュールとして置いた先で、配線の接続先が変わったり配線が切断されたりすることがあります。必ず状況を確認するようにしてください。',
    preview: 'プレビュー',
    previewLabel: 'モジュールのプレビュー',
    pinLabel: (n: number) => `${n} 番のピン`,
    portLabelOf: (heading: string) => `${heading} の名前`,
    noName: '名前未設定',
    /** 一覧に出すポートの名前。名前がなければ「(名前未設定)」 */
    portOption: (port: string, name: string) => `${port} ${name || '(名前未設定)'}`,
  },
  sheetSettings: {
    width: '幅 (マス)',
    height: '高さ (マス)',
    /** 部品と配線が収まらない大きさのとき。width × height が収まるいちばん小さい大きさ */
    tooSmall: (width: number, height: number) =>
      `部品と配線が収まるのは ${width} × ${height} マス以上です`,
  },
  circuits: {
    defaultName: (n: number) => `回路${n}`,
    addTitle: '回路を追加',
    name: '名前',
    add: '追加',
    nameRequired: '名前を入力してください',
    nameTaken: '同じ名前の回路がすでにあります',
    confirmRemove: (name: string) => `「${name}」をプロジェクトから削除しますか？`,
    /**
     * ほかの回路に置かれている回路を削除するときの確認。first は置いている最初の回路、
     * circuits は置いている回路の数、count は置いている部品の数
     */
    confirmRemoveUsed: (name: string, first: string, circuits: number, count: number) =>
      `「${name}」をプロジェクトから削除します。中身はプロジェクトからなくなり、置いている部品（${first}${circuits === 1 ? 'の' : 'など'} ${count} か所）は見つからないモジュールとして残ります。`,
    remove: '削除',
    cannotPaste: (name: string) =>
      `「${name}」はこの回路を含んでいるため、ここには貼り付けられません`,
  },
  file: {
    confirmNew:
      '新しいプロジェクトを作成しますか？今のプロジェクト (すべての回路) は消えます。元に戻せません。',
    newProject: '新規作成',
    saveFailed: 'ファイルに保存できませんでした',
    readFailed: 'ファイルを読み取れませんでした',
    /** プロジェクトファイルを読み込めなかったときのお知らせ。reason は errors.projectFile の文 */
    importFailed: (reason: string) => `読み込めませんでした。${reason}`,
    /** 保存データを読み込めなかったときのお知らせ。reason は errors.stored の文 */
    openedEmpty: (reason: string) => `${reason}空のプロジェクトで開きます。`,
  },
  /** 計算の側が返すエラーの、種類ごとの文。文にするのは messages.ts の describe* */
  errors: {
    /** 検証で見つかった、プロジェクトの形の問題 */
    project: {
      NOT_PROJECT: 'プロジェクトのデータの形式ではありません',
      NO_FOLDERS: 'フォルダの一覧がありません',
      BAD_FOLDER: (e) => `フォルダ「${e.folder}」が不正です`,
      NO_CIRCUITS: '回路の一覧がありません',
      BAD_ENTRY: '回路の一覧に不正な項目があります',
      MISSING_FOLDER: (e) => `フォルダ「${e.folder}」がフォルダの一覧にありません`,
      NO_CIRCUIT_ID_OR_NAME: '回路の ID か名前がありません',
      NOT_CIRCUIT: (e) => `「${e.circuit}」が回路のデータの形式ではありません`,
      EMPTY_NAME: '名前のない回路があります',
      AUTHOR_NOT_STRING: (e) => `「${e.circuit}」の作者名が文字列ではありません`,
      NO_PACKAGE: (e) => `「${e.circuit}」にパッケージがありません`,
      BAD_PACKAGE: (e) => `「${e.circuit}」に不正なパッケージがあります`,
      BAD_SHEET: (e) => `「${e.circuit}」のシートの大きさが不正です`,
      NO_ELEMENTS: (e) => `「${e.circuit}」に要素の一覧がありません`,
      BAD_ELEMENT: (e) => `「${e.circuit}」に不正な要素があります`,
      DUPLICATE_PORT_NUMBER: (e) => `「${e.circuit}」にポート番号が重複したポートがあります`,
      NO_MAIN: 'メイン回路がありません',
      DUPLICATE_ID: (e) => `ID が重複しています: ${e.id}`,
      DUPLICATE_NAME: (e) =>
        e.folder === ''
          ? `同じ名前の回路があります: ${e.name}`
          : `フォルダ「${e.folder}」に同じ名前の回路があります: ${e.name}`,
    } satisfies ErrorTexts<ProjectError>,
    /** プロジェクトファイルを読み込めなかった理由。BROKEN の detail は、project の文にしたもの */
    projectFile: {
      NOT_JSON: 'JSON として読み取れません',
      NOT_SAZANKA: 'sazanka のプロジェクトファイルではありません',
      NEWER_VERSION: '新しい版の sazanka で作られたデータです',
      CIRCUIT_FILE: 'これは回路ファイルです。プロジェクトファイルを選んでください',
      BROKEN: (detail: string) => `プロジェクトファイルが壊れています (${detail})`,
    } satisfies ErrorTexts<Exclude<ProjectFileError, { code: 'BROKEN' }>> & {
      BROKEN: (detail: string) => string;
    },
    /** 保存データを読み込めなかった理由。このあとに file.openedEmpty で「空のプロジェクトで開きます。」を続ける */
    stored: {
      BROKEN: '保存データが壊れていたため読み込めませんでした。',
      NEWER_VERSION: '新しい版の sazanka で保存されたデータのため読み込めませんでした。',
    } satisfies ErrorTexts<StoredError>,
  },
  hints: {
    /** ヒントの 1 文字を読む時間 (ms)。ヒントを出し続ける時間に使う (StatusBar.tsx) */
    msPerChar: 250,
    /** 何も操作していないときに順に表示するヒント */
    idle: [
      '左のパネルからクリックかドラッグで部品を追加',
      'W (上の「配線」) で配線モード、V (上の「選択」) で選択モード。配線モードでは、クリックした点から点へ縦か横に配線を引ける',
      '配線の端をピンの先か、ほかの配線の上に置くとつながる。配線の途中どうしが交わるだけではつながらない',
      'INPUT はクリックで ON/OFF を切り替え',
      '1つのつながりに出力ピンを2つ以上つなぐと、値が決まらないエラーになる (赤い線)',
      '部品を動かしても配線はついてこない。つなぎ直すときは配線も動かす',
      '部品を右下の削除エリアへドラッグすると削除',
      '何もないところからドラッグすると範囲選択。選んだ部品と配線はまとめて動かしたり削除したりできる',
      'Shift+クリックで部品や配線を選択に追加・解除、Ctrl+A ですべて選択',
      'Ctrl+C でコピー、Ctrl+X で切り取り。Ctrl+V の後、クリックした位置に貼り付け',
      'ホイール (トラックパッドではピンチ) で拡大縮小。中ボタンか Space を押しながらドラッグすると表示を移動',
      'スマホでは2本指で表示を移動・拡大縮小',
      '右下のボタンで拡大縮小。□ のボタンで回路全体を表示、倍率を押すと等倍に戻る',
      'Ctrl+Z で元に戻す、Ctrl+Shift+Z (Ctrl+Y) でやり直し。INPUT の ON/OFF は元に戻す対象外',
      'フリップフロップ (D / T / JK) は、CLK (>) が OFF から ON になった瞬間だけ動く',
      'RS Latch はクロックがなく、S / R が変わるとすぐに Q が変わる',
      '部品には遅延がある。信号は 1 tick ずつ、時間をかけて伝わる',
      '「一時停止」してから「1 tick 進める」「1 tick 戻す」で、信号が伝わる様子を 1 tick ずつ行き来できる',
      'プロジェクトパネルの「⋯」の「新しい回路」で回路を追加すると、モジュールとしてほかの回路に置ける',
      'プロジェクトパネルの「⋯」の「名前を付けて保存」でプロジェクトをファイルに保存し、「開く」で開ける',
      'INPUT / OUTPUT に名前を付けると、モジュールとして置いたときのピンの名前になる',
    ],
    /** モジュールのタブ (メイン回路でない回路) を開いているときに追加で表示するヒント */
    nonMain: [
      '回路の名前は、プロジェクトパネルの行の「⋯」か F2 で変えられる',
      'タブはドラッグで並べ替えられ、「×」で閉じられる',
      'INPUT / OUTPUT を置くと、モジュールのピンが増える',
      'ほかの回路のタブを開いている間は、メイン回路のシミュレーションは止まる',
    ],
    /** どの回路のタブでも、nonMain のあと (メイン回路では先頭) に出すヒント */
    circuitSettings:
      'ツールバーの「回路設定」で、パッケージ (形とピン数)、ポートの名前、ピンの割り当てを変えられる',
    /** パッケージが split のモジュール (ピンの順が中の位置で決まる) で足すヒント。メイン回路では出さない (外側の配線がないため) */
    splitPackage: [
      'ピンは INPUT / OUTPUT のポート番号の順に並ぶ。INPUT / OUTPUT を動かしても、ピンの順は変わらない',
      '「回路設定」の「上から順に番号を振り直す」でポート番号を変えるとピンの順も変わり、外側の配線が別のピンにつながるので注意',
    ],
    /** パッケージが dip / qfp の回路 (ピン番号で外側のピンを決める) で足すヒント。メイン回路でも出す */
    numberedPackage: ['INPUT / OUTPUT を置くと、空いているピンに自動で割り当てられる'],
    /** 外側のピンに出せないポートの理由ごとの説明 */
    /** 見つからないモジュール (指す回路がプロジェクトにない) を選んだとき */
    /** タブがないとき */
    noCircuit: '左のプロジェクトパネルで、回路をダブルクリックすると開く',
    unresolvedModule:
      'この回路はプロジェクトにない。ピンはなく、シミュレーションでは何も出力しない',
    portProblems: {
      unassigned: 'この INPUT / OUTPUT はピン番号がないため、外側のピンに出ていない',
      outOfRange:
        'この INPUT / OUTPUT はピン番号がピン数の範囲の外にあるため、外側のピンに出ていない',
      duplicate: 'この INPUT / OUTPUT はほかと同じピン番号のため、外側のピンに出ていない',
    } satisfies Record<PortProblem, string>,
    overTrash: '離すと削除します',
    dragging: '右下の削除エリアで離すと削除します',
    placing: 'クリックした位置に貼り付け ・ R で回転 ・ Esc で取り消し',
    wiring:
      'クリックで折れる点を追加 ・ ピンか配線の上でつないで終了 ・ 最後の点をもう一度クリックで終了 ・ Esc で取り消し',
    wireTool:
      '配線モード: 何もないところ・ピン・配線の上をクリックして配線を開始 ・ V か Esc で選択モードに戻る',
    editing: 'Enter で確定 ・ Esc で取り消し',
    wireSelected:
      'Delete で配線を削除 ・ ドラッグで移動 ・ 配線の端をドラッグで長さを変更 ・ R で回転',
    splitTool: '配線をクリックで 2 本に分割 ・ Esc で選択モードに戻る',
    wireEndDragging: '配線の端をドラッグして長さを変更 ・ 離すと確定',
    multipleSelected: [
      'ドラッグでまとめて移動',
      'Delete か、右下の削除エリアへドラッグでまとめて削除',
      'Shift+クリックで選択に追加・解除',
      'Ctrl+C でコピー、Ctrl+X で切り取り',
      'R で回転',
    ],
    partSelected: ['ドラッグで移動', 'Delete か、右下の削除エリアへドラッグで削除', 'R で回転'],
    unstable: '発振中: 出力が自分の入力に戻るループで、値が決まらない状態になっている',
    conflict:
      '赤い配線に出力ピンが2つ以上つながっていて、値が決まらない。つながる入力ピンは OFF になる',
    unexposedPorts:
      '赤い INPUT / OUTPUT はピンに割り当てられていない。「回路設定」で割り当てられる',
  },
};
