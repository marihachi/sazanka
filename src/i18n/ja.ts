// 日本語の文言の表。ほかの言語の表も、これと同じ形 (messages.ts の Messages) にする。
// 部品の種類ごとの文言は、種類のフォルダの view.ts に言語ごとに書く
import type { PortProblem } from '../circuit/module';
import type { ProjectError } from '../circuit/project';
import type { ShareError } from '../file/share';
import type { StoredError } from '../file/storage';
import type { ErrorTexts } from './messages';

export const ja = {
  common: {
    ok: 'OK',
    cancel: 'キャンセル',
    close: '閉じる',
    /** 「入力 1」「出力 2」のような、入力か出力か (kind が input か) とポート番号 */
    portName: (kind: string, portNumber: number | string) =>
      `${kind === 'input' ? '入力' : '出力'} ${portNumber}`,
    integerRange: (min: number, max: number) => `${min}〜${max} の整数で入力してください`,
  },
  header: {
    toolbar: 'プロジェクトの操作',
    newProject: '新規作成',
    newProjectTitle: '空のプロジェクトを新しく作る',
    importProject: '読み込み',
    importProjectTitle: '共有された JSON からプロジェクトを読み込む',
    exportProject: '書き出し',
    exportProjectTitle: 'プロジェクト全体を JSON にして共有する',
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
    addModule: 'モジュールを追加',
    moduleTabTooltip: 'ダブルクリックで名前を変更、ドラッグで並べ替えできます。',
  },
  toolbar: {
    select: '選択',
    selectTitle: '選択モード (V): 部品や配線を選んで動かす',
    wire: '配線',
    wireTitle: '配線モード (W): クリックした点から点へ配線を引く',
    pause: '一時停止',
    pauseTitle: 'シミュレーションを一時停止',
    resume: '再開',
    resumeTitle: 'シミュレーションを再開',
    stepBack: '1 tick 戻す',
    stepBackTitle: '1 tick だけ時間を戻す',
    stepForward: '1 tick 進める',
    stepForwardTitle: '1 tick だけ時間を進める',
    moduleSettings: 'モジュール設定',
    moduleSettingsTitle:
      'モジュール設定: パッケージ (形とピン数)、ポートの名前、ピンの割り当てを変える',
    deleteModule: 'モジュールを削除',
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
    selfModule: 'モジュールの中に自分自身は置けません',
    containsThis: (name: string) => `「${name}」はこの回路を含んでいるため置けません`,
  },
  sheet: {
    unknownModule: '(不明)',
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
    label: 'ラベル',
    noPortLabel: '名前未設定',
    noLabel: 'ラベルなし',
    duplicateLabel: 'ほかのポートと同じ名前は付けられません',
    labelHelp: 'モジュールの中では、ピンの名前になります',
    noItems: 'この部品に設定できる項目はありません',
    selectOne: '部品を1つ選ぶと、その部品の項目を編集できます',
    clockPeriod: '周期 (tick)',
    clockPeriodHelp: (tickMs: number, seconds: number) =>
      `ON と OFF を一往復する tick 数。今の間隔 (${tickMs} ms) では ${seconds} 秒`,
  },
  status: {
    unexposedPorts: 'ピンに出ていない INPUT / OUTPUT があります',
    conflict: '出力がぶつかっています',
    unstable: '発振しています',
  },
  preferences: {
    title: '環境設定',
    tickMs: 'シミュレーションで 1 tick を進める間隔 (ms)',
    tickMsHelp: (defaultMs: number) =>
      `大きくするとゆっくり進み、信号が 1 tick ずつ伝わる様子を目で追えます。既定は ${defaultMs} ms。CLOCK の周期 (秒) は、CLOCK ごとの tick 数 × この間隔です。`,
    showGrid: 'シートに方眼を表示する',
    roundWires: '配線の角を丸める',
    accent: 'アクセントカラー',
    otherColor: 'ほかの色を選ぶ',
  },
  moduleSettings: {
    title: (name: string) => `モジュール設定: ${name}`,
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
      '入力は左、出力は右に、中の位置の順 (上から、同じ高さなら左から) に並びます。ピン番号は使いません。',
    ports: 'ポート',
    duplicateLabel: 'ほかのポートと同じ名前は付けられません',
    assignment: 'ピンの割り当て',
    assignInOrder: '上から順に割り当て直す',
    unassigned: '割り当てのないポート (外側のピンに出ない):',
    listSeparator: '、',
    wiringWarning:
      'パッケージやピンの割り当てを変更すると、このモジュールの配置先で、配線の接続先が変わったり配線が切断されたりすることがあります。必ず状況を確認するようにしてください。',
    preview: 'プレビュー',
    previewLabel: 'モジュールのプレビュー',
    apply: '適用',
    pinLabel: (n: number) => `${n} 番のピン`,
    portLabelOf: (heading: string) => `${heading} の名前`,
    noName: '名前未設定',
    /** 一覧に出すポートの名前。名前がなければ「(名前未設定)」 */
    portOption: (port: string, name: string) => `${port} ${name || '(名前未設定)'}`,
  },
  modules: {
    defaultName: (n: number) => `モジュール${n}`,
    addTitle: 'モジュールを追加',
    name: '名前',
    add: '追加',
    nameRequired: '名前を入力してください',
    nameTaken: '同じ名前の回路がすでにあります',
    inUse: (name: string, users: string[]) =>
      `「${name}」は次の回路で使われているため削除できません: ${users.join(', ')}`,
    confirmDelete: (name: string) => `モジュール「${name}」を削除しますか？`,
    delete: '削除',
    cannotPaste: (name: string) =>
      `「${name}」はこの回路を含んでいるため、ここには貼り付けられません`,
  },
  file: {
    confirmNew:
      '新しいプロジェクトを作成しますか？今のプロジェクト (メイン回路とすべてのモジュール) は消えます (元に戻すで戻せます)。',
    newProject: '新規作成',
    exportTitle: '書き出し',
    exportMessage:
      'プロジェクト全体の書き出しができます。書き出したデータは「読み込み」画面に貼り付けてください。',
    author: '作者名 (省略可)',
    copy: 'コピー',
    copied: 'コピーしました',
    copyFailed: 'コピーできませんでした。上の文字列を選択して、手動でコピーしてください',
    importTitle: '読み込み',
    importMessage:
      '書き出したデータを貼り付けてください。今のプロジェクトは置き換わりますが、元に戻すこともできます。',
    importConfirm: '読み込む',
    importedFrom: (author: string) => `「${author}」さんの回路を読み込みました。`,
    /** 保存データを読み込めなかったときのお知らせ。reason は errors.stored の文 */
    openedEmpty: (reason: string) => `${reason}空のプロジェクトで開きます。`,
  },
  /** 計算の側が返すエラーの、種類ごとの文。文にするのは messages.ts の describe* */
  errors: {
    /** 検証で見つかった、プロジェクトの形の問題 */
    project: {
      NO_CIRCUITS: '回路の一覧がありません',
      AUTHOR_NOT_STRING: '作者名が文字列ではありません',
      NO_MAIN: 'メイン回路がありません',
      NO_CIRCUIT_ID_OR_NAME: '回路の ID か名前がありません',
      NO_PACKAGE: (e) => `「${e.circuit}」にパッケージがありません`,
      BAD_PACKAGE: (e) => `「${e.circuit}」に不正なパッケージがあります`,
      NO_PARTS_OR_WIRES: (e) => `「${e.circuit}」の部品か配線がありません`,
      BAD_PART: (e) => `「${e.circuit}」に不正な部品があります`,
      DUPLICATE_PART_ID: (e) => `「${e.circuit}」で部品の ID が重複しています: ${e.id}`,
      BAD_WIRE: (e) => `「${e.circuit}」に不正な配線があります`,
      DUPLICATE_CIRCUIT_ID: (e) => `回路の ID が重複しています: ${e.id}`,
      MISSING_MODULE: (e) => `「${e.circuit}」が存在しないモジュールを参照しています`,
    } satisfies ErrorTexts<ProjectError>,
    /** 共有用 JSON を読み込めなかった理由。BROKEN の detail は、project の文にしたもの */
    share: {
      NOT_JSON: 'JSON として読み取れません',
      NOT_SAZANKA: 'sazanka の回路データではありません',
      NEWER_VERSION: '新しい版の sazanka で作られたデータのため読み込めません',
      BROKEN: (detail: string) => `回路データが壊れています (${detail})`,
    } satisfies ErrorTexts<Exclude<ShareError, { code: 'BROKEN' }>> & {
      BROKEN: (detail: string) => string;
    },
    /** 保存データを読み込めなかった理由。このあとに file.openedEmpty で「空のプロジェクトで開きます。」を続ける */
    stored: {
      BROKEN: '保存データが壊れていたため読み込めませんでした。',
      NEWER_VERSION: '新しい版の sazanka で保存されたデータのため読み込めませんでした。',
    } satisfies ErrorTexts<StoredError>,
  },
  hints: {
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
      'タブの「+」でモジュールを追加すると、回路を部品としてまとめられる',
      '「書き出し」でプロジェクト全体を JSON にしてコピーし、「読み込み」に貼り付けると同じ回路を開ける',
      'モジュールの中の INPUT / OUTPUT に名前を付けると、ピンの名前になる',
    ],
    /** モジュールのタブを開いているときに追加で表示するヒント */
    module: [
      'タブをダブルクリックすると、モジュールの名前を変更できる',
      'モジュールのタブはドラッグで並べ替えられる (メインは先頭に固定)',
      'INPUT / OUTPUT を置くと、モジュールのピンが増える',
      'モジュールのタブを開いている間は、メイン回路のシミュレーションは止まる',
      'ツールバーの「モジュール設定」で、パッケージ (形とピン数)、ポートの名前、ピンの割り当てを変えられる',
    ],
    /** パッケージが split のモジュール (ピンの順が中の位置で決まる) で、module に足すヒント */
    splitModule: [
      'INPUT / OUTPUT の上下の並びを変えるとピンの順番も変わり、外側の配線が別のピンにつながるので注意',
    ],
    /** パッケージが dip / qfp のモジュール (ピン番号で外側のピンを決める) で、module に足すヒント */
    numberedModule: ['INPUT / OUTPUT を置くと、空いているピンに自動で割り当てられる'],
    /** 外側のピンに出せないポートの理由ごとの説明 */
    portProblems: {
      unassigned: 'この INPUT / OUTPUT はピン番号がないため、外側のピンに出ていない',
      outOfRange:
        'この INPUT / OUTPUT はピン番号がピン数の範囲の外にあるため、外側のピンに出ていない',
      duplicate: 'この INPUT / OUTPUT はほかと同じピン番号のため、外側のピンに出ていない',
    } satisfies Record<PortProblem, string>,
    overTrash: '離すと削除します',
    dragging: '右下の削除エリアで離すと削除します',
    placing: 'クリックした位置に貼り付け ・ Esc で取り消し',
    wiring:
      'クリックで折れる点を追加 ・ ピンか配線の上でつないで終了 ・ 最後の点をもう一度クリックで終了 ・ Esc で取り消し',
    wireTool:
      '配線モード: 何もないところ・ピン・配線の上をクリックして配線を開始 ・ V か Esc で選択モードに戻る',
    editing: 'Enter で確定 ・ Esc で取り消し',
    wireSelected: 'Delete で配線を削除 ・ ドラッグで移動',
    multipleSelected: [
      'ドラッグでまとめて移動',
      'Delete か、右下の削除エリアへドラッグでまとめて削除',
      'Shift+クリックで選択に追加・解除',
      'Ctrl+C でコピー、Ctrl+X で切り取り',
    ],
    partSelected: ['ドラッグで移動', 'Delete か、右下の削除エリアへドラッグで削除'],
    unstable: '発振中: 出力が自分の入力に戻るループで、値が決まらない状態になっている',
    conflict:
      '赤い配線に出力ピンが2つ以上つながっていて、値が決まらない。つながる入力ピンは OFF になる',
    unexposedPorts:
      '赤い INPUT / OUTPUT はピンに割り当てられていない。「モジュール設定」で割り当てられる',
  },
};
