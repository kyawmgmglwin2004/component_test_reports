import type { ApexOptions } from 'apexcharts';

export type Granularity = 'time' | 'day' | 'month';
export type YTick = { value: number; topPx: number; label: string };
export type ChartLikeOptions = ApexOptions;
import {
  ref, computed, watch, onMounted, onBeforeUnmount, nextTick
} from 'vue';
import { useGlobalLoading } from '@/pages/Common/composables/GlobalLoading'
import VueApexCharts from 'vue3-apexcharts';
import type ApexCharts from 'apexcharts';
import { apiGet } from '@/services/http'
import { applyErrorsToPage } from '../Common/error/errorResolver';
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n';
import { useNotFoundScreenProps } from '@/pages/Common/composables/NotFoundScreen'

type BackendSeriesByName = {
  key?: string | null;
  name?: string | null;
  data?: number[] | null;
  group?: string | null;
};
// チャートの各シリーズ（凡例名と数値配列）を表す型
export type SeriesItem = { name: string; data: number[] };

// 標準レスポンス封筒
type StandardResponse<T> = {
  code: string;            
  message: string;         // 人間向けメッセージ
  data: T;                 // 実データ
  request_id?: string;     // 任意
};


// チャート API のレスポンス型
export type ChartResponse = {

  categories: string[];
  series: SeriesItem[];
  units?: string;
  range?: { min?: number; max?: number };
  facilityName?: string;
};
const BASE_URL =import.meta.env.VITE_API_BASE_URL 

// 対象施設のチャート API エンドポイントを生成（施設IDをパスに含める）
const endpoint = (id: string) => `${BASE_URL}/facilities/${encodeURIComponent(id)}/energy`;


// 指定日（YYYY-MM-DD）での時間別データを取得
export async function fetchEnergyHourlyByDate(id: string, selDate: string) {
  const qs = new URLSearchParams({ flag: '0', selDate });
  const raw = await apiGet<StandardResponse<ChartResponse>>(`${endpoint(id)}?${qs.toString()}`);
    return raw.data;
}


// 指定月（YYYY-MM）での日別データを取得
export async function fetchEnergyDailyByMonth(id: string, selMonth: string) {
  const qs = new URLSearchParams({ flag: '1', selMonth });
  const raw = await apiGet<StandardResponse<ChartResponse>>(`${endpoint(id)}?${qs.toString()}`);
    return raw.data;
}


// 指定年・開始月～終了月の月別データを取得
export async function fetchEnergyMonthlyByRange(id: string, startMonth: string, endMonth: string) {
  const query =  new URLSearchParams({ flag: '2', startMonth, endMonth});
  const raw = await apiGet<StandardResponse<ChartResponse>>(`${endpoint(id)}?${query.toString()}`);
    return raw.data;
}

/**
 * 施設（facility）単位で電力（エネルギー）使用量を
 * 時間別/日別/月別の粒度で取得し、ApexCharts で描画するための Composition API。
 *
 * - granularity: 粒度（'time' | 'day' | 'month'）
 * - mainSeries: グラフの系列データ
 * - mainChartOptions: ApexCharts のオプション（x/y 軸、凡例、グリッド等）
 * - syncYAxis: Apex の内部 DOM を参照して、Y 目盛り位置とラベルの同期を行う
 * - 各粒度ごとに fetch API を呼び出し、カテゴリ・単位・系列を反映
 * - 日付・月のピッカー（バリデーションや境界制御）も同梱
 */
export function useFacilityHistory(facilityID: string) {
  const facilityName = ref<string>('');
  const facilityIdRegex = /^F[A-Z0-9]{5}$/;
  const { openWith } = useNotFoundScreenProps()
  
  const routeFacilityId = computed(() => String(route.params.facilityID ?? ''));
  const isValidFacilityId = computed(() => facilityIdRegex.test(routeFacilityId.value));
  
  // ---- コア状態 ----
  const granularity = ref<Granularity>('time');         
  const lastServerRange = ref<{ min?: number; max?: number } | null>(null); 
  const lastUnits = ref<string>('kWh');                  

  // 表示色（系列のデフォルトカラー）
  const defaultColors = ['#00B050', '#C55A11', '#0070C0'];
  const mainSeries = ref<SeriesItem[]>([]);   
  const topErrorList = ref<string[]>([])
  const serverErrors = ref<Record<string, string[]>>({})        
  const error = ref<string | null>(null) 
  const route = useRoute()
  const router = useRouter()
  const { t} = useI18n()

function labelFromSeries(s: BackendSeriesByName, idx: number): string {
  const base =
    (typeof s?.key === 'string' && s.key.trim()) ||
    (typeof s?.name === 'string' && s.name.trim()) || ''

  if (!base) {
    return `Series ${idx + 1}`
  }
  return t(`eamountcheckHistory.${base}`, {}, { default: base })
}

const mapByName = (series: BackendSeriesByName[] = []): SeriesItem[] =>
  series.map((s, i) => ({
    name: labelFromSeries(s, i),
    data: Array.isArray(s?.data) ? s.data : []
  }))
const nf3jp = new Intl.NumberFormat('ja-JP', {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});
  // ApexCharts の基本オプション
  const mainChartOptions = ref<ApexOptions>({
    chart: { type: 'bar', height: 270, toolbar: { show: false }, parentHeightOffset: 0 },
    plotOptions: { bar: { horizontal: false, columnWidth: '45%', borderRadius: 3, borderRadiusApplication: 'end' } },
    dataLabels: { enabled: false, formatter: (val: number) => nf3jp.format(val), },
    stroke: { show: true, width: 2, colors: ['transparent'] },
    tooltip: {
      x: { show: false },
      y: { formatter: (val: number) => `${nf3jp.format(val)} ${lastUnits.value}` }
    },
    colors: defaultColors,
    legend: { show: false },
    xaxis: {
      categories: [],
      labels: { rotate: 0, style: { fontSize: '12px' } },
      tickPlacement: 'between'
    },
    yaxis: {
      show: true,
      labels: { show: false,formatter: (val: number) => nf3jp.format(val), style: { fontSize: '12px' } }, 
      tickAmount: 5,
      forceNiceScale: false,
      decimalsInFloat: 0,
    },
    grid: {
      borderColor: '#cfdaf1',
      strokeDashArray: 0,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } },
      padding: { left: 12, right: 12, top: 0, bottom: 0}
    }
  });

  /** Apex の内部に依存せず、プロット領域を測るための DOM 参照 */
  const chartRoot = ref<HTMLElement | null>(null);   
  const yStickyEl = ref<HTMLElement | null>(null);   
  const yTicks = ref<YTick[]>([]);                 

  // <apexchart ref> への参照（updateOptions などを呼ぶため）
  const apexRef = ref<InstanceType<typeof VueApexCharts> | null>(null);

  // Y ラベルのフォーマット（日本語ロケール、整数）
  function formatY(v: number) {
    return new Intl.NumberFormat('ja-JP', { notation: 'standard', maximumFractionDigits: 0 }).format(v);
  }

  // ApexCharts ランタイムの実体（chart インスタンス）を取得
  function getApexRuntime(): ApexCharts | null {
    const comp = apexRef.value;
    if (!comp) return null;
    return (comp as unknown as { chart: ApexCharts }).chart ?? null;
  }

  /**
   * Apex の内部 DOM・内部状態から、Y 目盛りの値と表示位置（px）を算出して
   * yTicks に反映する。
   *
   * ポイント：
   * - Apex の内部 w.globals を防御的に参照
   * - グリッドの外枠線（上/下）と内部水平線の DOM から px 位置を取得
   * - 値の最大/最小と px の線形対応で各 tick の値を逆算
   *
   * 注：Apex の実装に依存するため、バージョン差異に注意。
   */
 function syncYAxis(): void {
    requestAnimationFrame(() => {
      const root = chartRoot.value;
      const gutter = yStickyEl.value;
      const apex = getApexRuntime();
      if (!root || !gutter || !apex) { yTicks.value = []; return; }

      const w = (apex as unknown as { w: { globals?: Record<string, unknown> } }).w;
      const g = (w?.globals ?? {}) as {
        yAxisScale?: unknown[];
        minY?: unknown;
        maxY?: unknown;
      };

      const raw = g.yAxisScale?.[0];
      const scale = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : undefined;

      const sMin = typeof scale?.min === 'number' ? (scale!.min as number) : undefined;
      const sMax = typeof scale?.max === 'number' ? (scale!.max as number) : undefined;

      const gMin = typeof g.minY === 'number' ? (g.minY as number) : undefined;
      const gMax = typeof g.maxY === 'number' ? (g.maxY as number) : undefined;

      const min = Number.isFinite(sMin) ? (sMin as number) : Number.isFinite(gMin) ? (gMin as number) : 0;
      const max = Number.isFinite(sMax) ? (sMax as number) : Number.isFinite(gMax) ? (gMax as number) : 1;

      if (!(max > min)) { yTicks.value = []; return; }

      const bordersGroup = root.querySelector('.apexcharts-grid-borders') as SVGGElement | null;
      if (!bordersGroup) { yTicks.value = []; return; }

      const borderLines = Array.from(bordersGroup.querySelectorAll<SVGLineElement>('line')).filter(line => {
        const cs = getComputedStyle(line);
        return !(cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0');
      });
      if (borderLines.length < 2) { yTicks.value = []; return; }

      const gutterRect = gutter.getBoundingClientRect();
      const borderTops = borderLines
        .map(el => el.getBoundingClientRect().top - gutterRect.top)
        .sort((a,b) => a - b);
      const topBorder = borderTops[0]!;
      const bottomBorder = borderTops[borderTops.length - 1]!;
      const spanPx = Math.max(1, bottomBorder - topBorder);
      const spanVal = max - min;

      const gridGroup = root.querySelector('.apexcharts-gridlines-horizontal') as SVGGElement | null;
      const interiorLines = gridGroup
        ? Array.from(gridGroup.querySelectorAll<SVGLineElement>('line'))
            .filter(line => {
              const cs = getComputedStyle(line);
              if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
              const cls = line.getAttribute('class') || '';
              return !/\bzero\b/i.test(cls); 
            })
            .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
        : [];

      const tickPositions: number[] = [
        topBorder,
        ...interiorLines.map(el => el.getBoundingClientRect().top - gutterRect.top),
        bottomBorder
      ];
      if (interiorLines.length === 0) {
        tickPositions.length = 0;
        tickPositions.push(topBorder, bottomBorder);
      }

      const ticks = tickPositions.map(topPx => {
        const ratioFromTop = (topPx - topBorder) / spanPx; 
        const value = max - ratioFromTop * spanVal;        
        return { value, topPx, label: formatY(value) };
      });

      ticks[0]!.value = max; ticks[0]!.label = formatY(max);
      ticks[ticks.length - 1]!.value = min; ticks[ticks.length - 1]!.label = formatY(min);

      yTicks.value = ticks;
    });
  }

  function onResize() { syncYAxis(); }
  onMounted(() => window.addEventListener('resize', onResize, { passive: true }));
  onBeforeUnmount(() => window.removeEventListener('resize', onResize));

 function withSafeAxisTitles(options: ApexOptions): ApexOptions {
    const safeX: ApexOptions['xaxis'] = { ...(options.xaxis), title: { text: '' } };
    const y = options.yaxis ?? {};
    const yArray = Array.isArray(y) ? y : [y];
    const safeYArray = yArray.map(yItem => ({ ...yItem, title: { text: '' } }));
    return { ...options, xaxis: safeX, yaxis: safeYArray.length === 1 ? safeYArray[0] : safeYArray, legend: { ...(options.legend), show: false } };
  }
  const computedChartOptions = computed<ApexOptions>(() => withSafeAxisTitles(mainChartOptions.value));

  // ラベル & 凡例（カスタム）
  const yLabelText = computed(() => `(${lastUnits.value})`); 
  const xLabelText = computed(() => (granularity.value === 'time' ? '(時)' : granularity.value === 'day' ? '(日)' : '(月)'));
  const customLegendItems = computed(() => {
    const cols = (mainChartOptions.value.colors as string[]) || defaultColors;
    return mainSeries.value.map((s, i) => ({ name: s.name, color: cols[i % cols.length] }));
  });

  // ====================== ピッカー（時間/日/月）とユーティリティ ======================

  // ---- 時間帯別（特定日付の 0-24 時） ----
  function formatDateLocalYMD(d: Date = new Date()): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${da}`;
  }
  const todayYMD = formatDateLocalYMD();
  const date = ref<string>(todayYMD);          
  const pendingDate = ref<string>(todayYMD);    
  const openTime = ref(false);                      
  const openDay = ref(false);     
  const displayed = ref(new Date());          
  const toSlash = (ymd: string) => (ymd ? (() => { const [y, m, d] = ymd.split('-'); return `${y}/${m}/${d}`; })() : '');
  const display = computed(() => toSlash(date.value));

  // 'YYYY-MM-DD' を Date にパース（厳密チェック）
  function parseYMD(ymd: string): Date | null {
    const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const [, yStr, moStr, dStr] = m as [string, string, string, string];
    const y = Number(yStr), mo = Number(moStr), d = Number(dStr);
    const dt = new Date(y, mo - 1, d);
    const isValid = !Number.isNaN(dt.getTime()) && dt.getFullYear() === y && dt.getMonth() + 1 === mo && dt.getDate() === d;
    return isValid ? dt : null;
  }

  // ピッカーのヘッダー "YYYY / MM"
  const headerLabel = computed(() => {
    const y = displayed.value.getFullYear();
    const m = String(displayed.value.getMonth() + 1).padStart(2, '0');
    return `${y} / ${m}`;
  });
  const displayedYear  = computed({
    get: () => displayed.value.getFullYear(),
    set: v  => displayed.value = new Date(v, displayedMonth.value, 1),
  });
  const displayedMonth = computed({
    get: () => displayed.value.getMonth(),
    set: v  => displayed.value = new Date(displayedYear.value, v, 1),
  });
  function incMonth(n: number) {
    const d = new Date(displayed.value);
    d.setMonth(d.getMonth() + n, 1);
    displayed.value = d;
  }
  // 今日より未来を選べないよう制約
  const validHourRange = computed<boolean>(() => !!date.value && date.value <= todayYMD);
  function applyPending() {
    if (pendingDate.value && pendingDate.value > todayYMD) pendingDate.value = todayYMD;
    date.value = pendingDate.value;
    openTime.value = false;
  }
  function onPickPending(val: string | Date) {
    pendingDate.value = val instanceof Date ? formatDateLocalYMD(val) : val;
  }
  
function setTodayStart() {
  const today = new Date();
  tempStartYear.value = today.getFullYear();
  tempStartMonth.value = today.getMonth() + 1;
  apply('start');
  openStart.value = false;
  openEnd.value = false;
}
  // ピッカーを開いた際、表示中の年月を選択済みに合わせる
  watch(openTime, v => {
    if (v) {
      const dt = parseYMD(date.value) ?? new Date();
      displayed.value = new Date(dt.getFullYear(), dt.getMonth(), 1);
    }
  });
  // 選択日付が変わったとき、ヘッダー年月も追従
  watch(date, v => {
    const dt = parseYMD(v);
    if (dt) displayed.value = new Date(dt.getFullYear(), dt.getMonth(), 1);
  });
  // 常に今日以前に矯正
  watch(date, (newVal) => {
    if (newVal && newVal > todayYMD) date.value = todayYMD;
  });
  function resetHourlyToToday() {
    date.value = todayYMD;
    pendingDate.value = todayYMD;
    const dt = parseYMD(todayYMD) ?? new Date();
    displayed.value = new Date(dt.getFullYear(), dt.getMonth(), 1);
  }

  // ---- 日別（特定の月） ----
  function formatMonthLocalYM(d = new Date()): string {
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }
  const todayYM = formatMonthLocalYM();
  const selDate = ref<string>(todayYM);  
  const today = new Date();
  const year = ref<number>(today.getFullYear());
  const toSlashYear = (ym: string) => (ym ? (() => { const [y, m] = ym.split('-'); return `${y}/${m}`; })() : '');
  const displayMonth = computed(() => toSlashYear(selDate.value));
  const pending = ref<Date | null>(null);          
  const todayStartOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  let minMonth: Date | null = null;              
  let maxMonth: Date | null = todayStartOfMonth; 
  function ymToDate(y:number, m1to12:number) { return new Date(y, m1to12 - 1, 1) }
  function isBeforeMin(y:number, m:number) {
    if (!minMonth) return false;
    const d = ymToDate(y, m), mn = new Date(minMonth.getFullYear(), minMonth.getMonth(), 1);
    return d < mn;
  }
  function isAfterMax(y:number, m:number) {
    if (!maxMonth) return false;
    const d = ymToDate(y, m), mx = new Date(maxMonth.getFullYear(), maxMonth.getMonth(), 1);
    return d > mx;
  }



 function __setMinMonthForTest(d: Date | null) { minMonth = d }

  function __setMaxMonthForTest(d: Date | null) { maxMonth = d }

 function __getMonthBoundsForTest() { return { minMonth, maxMonth } }

  function isDisabled(y:number, m:number) { return isBeforeMin(y, m) || isAfterMax(y, m) }
  function isSelected(y:number, m:number) {
    return !!pending.value && pending.value.getFullYear() === y && pending.value.getMonth() + 1 === m;
  }
  function pickMonth(y:number, m1to12:number) {
    if (isDisabled(y, m1to12)) return;
    pending.value = ymToDate(y, m1to12);
  }
  function applyPendingMonth() {
    if (!pending.value) return;
    const y = pending.value.getFullYear(), m = String(pending.value.getMonth() + 1).padStart(2, '0');
    selDate.value = `${y}-${m}`;
    openDay.value = false;
  }
  const validDayRange = computed<boolean>(() => !!selDate.value && selDate.value <= todayYM);
  watch(selDate, (newVal) => {
    if (newVal && newVal > todayYM) selDate.value = todayYM;
  });
  function resetDailyToToday() {
    selDate.value = todayYM;
    pending.value = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    year.value = new Date().getFullYear();
  }

  // ---- 月別（年内の開始/終了月レンジ） ----
  const fromTime = ref<string>('０時'); 
  const toTime = ref<string>('23時');
  // "YYYY/MM" を厳密にパース
  function parseYM(ym: string): { y: number; m: number } | null {
    const m = ym.match(/^(\d{4})\/(\d{2})$/);
    if (!m) return null;
    const y = Number(m[1]), mo = Number(m[2]);
    if (!Number.isInteger(y) || !Number.isInteger(mo) || mo < 1 || mo > 12) return null;
    return { y, m: mo };
  }
  const THIS_YEAR  = today.getFullYear();
  const THIS_MONTH = today.getMonth() + 1;
  const mm2 = (m: number) => String(m).padStart(2, '0');
  const toYM = (y: number, m: number) => `${y}/${mm2(m)}`;
  const startYM = ref<string>(toYM(THIS_YEAR, 1));          
  const endYM   = ref<string>(toYM(THIS_YEAR, THIS_MONTH));  
  const openStart = ref(false);
  const openEnd   = ref(false);
  const yearMin = 0; 
  const years   = computed(() => Array.from({ length: (THIS_YEAR - yearMin + 1) }, (_, i) => yearMin + i));
  const canIncYear = computed(() => tempStartYear.value < THIS_YEAR);
  const canDecYear = computed(() => tempStartYear.value > yearMin);
  function incYear() { if (canIncYear.value) tempStartYear.value++; }
  function decYear() { if (canDecYear.value) tempStartYear.value--; }

    function incEndYear() { if (canIncYear.value) tempEndYear.value++; }
  function decEndYear() { if (canDecYear.value) tempEndYear.value--; }

  // 開始/終了の一時変数（ピッカー操作用）
  const tempStartYear  = ref<number>(THIS_YEAR);
  const tempStartMonth = ref<number>(1);
  const tempEndYear  = ref<number>(THIS_YEAR);
  const tempEndMonth = ref<number>(THIS_MONTH);
  const displayYear = computed(() => tempStartYear.value)
  onMounted(() => {
  tempStartYear.value = THIS_YEAR;

  const y = THIS_YEAR;
  const m = THIS_MONTH;

  if (!isDisabled(y, m)) {
    pending.value = ymToDate(y, m);
  } else {
    for (let mm = m; mm >= 1; mm--) {
      if (!isDisabled(y, mm)) { pending.value = ymToDate(y, mm); break; }
    }
  }
});
const maxSelectableMonth = (year: number) => {
  const { THIS_YEAR, THIS_MONTH } = getTodayYM(); 
  return year === THIS_YEAR ? THIS_MONTH : 12;
};

const monthItemsStart = computed(() => {
  const maxM = maxSelectableMonth(tempStartYear.value);
  return Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    return {
      label: `${m}月`,
      value: m,
      disabled: m > maxM, 
    };
  });
});

const monthItemsEnd = computed(() => {
  const endYear    = tempEndYear.value;
  const startYear  = tempStartYear.value;
  const startMonth = tempStartMonth.value;

  const maxM      = maxSelectableMonth(endYear);
  const sameYear  = endYear === startYear;

  return Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const disableByFuture = m > maxM;
    const disableByStart  = sameYear && m < startMonth; 
    return {
      label: `${m}月`,
      value: m,
      disabled: disableByFuture || disableByStart,
    };
  });
});

  // 年をまたがない範囲 + 当年を超えない + start <= end の妥当性チェック
  const validMonthRange = computed(() => {
    const s = parseYM(startYM.value), e = parseYM(endYM.value);
    if (!s || !e) return false;
    if (s.y > THIS_YEAR || (s.y === THIS_YEAR && s.m > THIS_MONTH)) return false;
    if (e.y > THIS_YEAR || (e.y === THIS_YEAR && e.m > THIS_MONTH)) return false;
    if (s.y !== e.y) return false; 
    const sm = s.y * 100 + s.m, em = e.y * 100 + e.m;
    return sm <= em;
  });

  // 開始/終了ピッカーの「適用」
function getTodayYM() {
  const d = new Date()
  return { THIS_YEAR: d.getFullYear(), THIS_MONTH: d.getMonth() + 1 }
}

function apply(which: 'start' | 'end', getToday = getTodayYM) {
  if (which === 'start') {
    let y = tempStartYear.value
    let m = tempStartMonth.value

    const { THIS_YEAR, THIS_MONTH } = getToday()

    
    if (y > THIS_YEAR) {
      y = THIS_YEAR
      m = Math.min(m, THIS_MONTH)
    } else if (y === THIS_YEAR && m > THIS_MONTH) {
      m = THIS_MONTH
    }

    startYM.value = toYM(y, m)
    openStart.value = false

    const e = parseYM(endYM.value)
    if (!e || e.y !== y) {
      endYM.value = toYM(
        y,
        (y === THIS_YEAR ? Math.max(m, Math.min(THIS_MONTH, 12)) : 12)
      )
    } else {
      const sm = y * 100 + m, em = e.y * 100 + e.m
      if (sm > em) endYM.value = toYM(y, (y === THIS_YEAR ? m : 12))
    }
  } 
else {
    const ySel = tempEndYear.value;
    let mSel = tempEndMonth.value;

    const { THIS_YEAR, THIS_MONTH } = getToday();

    let effY: number;
    let effM: number;

    if (ySel > THIS_YEAR) {
      effY = THIS_YEAR;
      effM = THIS_MONTH;
      endYM.value = toYM(effY, effM);
    } else {
      if (ySel === THIS_YEAR && mSel > THIS_MONTH) mSel = THIS_MONTH;
      effY = ySel;
      effM = mSel;
      endYM.value = toYM(effY, effM);
    }
    openEnd.value = false;
    const s = parseYM(startYM.value);
    if (!s || s.y !== effY) {
      startYM.value = toYM(effY, 1);
    } else {
      const sm = s.y * 100 + s.m;
      const em = effY * 100 + effM;
      if (sm > em) startYM.value = toYM(effY, 1);
    }
  }
}


  // 開始ピッカーを開いたら、一時変数を現在値から初期化
  watch(openStart, (v) => {
    if (v) {
      const s = parseYM(startYM.value) ?? { y: THIS_YEAR, m: 1 };
      tempStartYear.value  = s.y;
      tempStartMonth.value = Math.min(s.m, (s.y === THIS_YEAR ? THIS_MONTH : 12));
    }
  });
  // 終了ピッカーを開いたら、一時変数を現在値から初期化
  watch(openEnd, (v) => {
    if (v) {
      const e = parseYM(endYM.value) ?? { y: THIS_YEAR, m: THIS_MONTH };
      tempEndYear.value  = e.y;
      tempEndMonth.value = Math.min(e.m, (e.y === THIS_YEAR ? THIS_MONTH : 12));
    }
  });
  // 月別の範囲をデフォルト（当年の 1 月〜当月）へリセット
  function resetMonthlyToDefault() {
    startYM.value = toYM(THIS_YEAR, 1);
    endYM.value   = toYM(THIS_YEAR, THIS_MONTH);
    tempStartYear.value  = THIS_YEAR;
    tempStartMonth.value = 1;
    tempEndYear.value    = THIS_YEAR;
    tempEndMonth.value   = THIS_MONTH;
  }
  type HttpErrorLike = { statusCode: number; message: string; data?: unknown; name?: string }
  function isHttpError(e: unknown): e is HttpErrorLike {
  if (typeof e !== 'object' || e === null) return false
  return 'statusCode' in e && typeof (e as { statusCode?: unknown }).statusCode === 'number'
}
  
  // データ取得関数（fetch + 反映）
type UnknownRecord = Record<string, unknown>;

const isRecord = (v: unknown): v is UnknownRecord =>
  !!v && typeof v === 'object';
 function extractBackendCode(raw: unknown): string | undefined {
  if (!isRecord(raw)) return undefined;

  const c = raw.code;
  if (typeof c === 'string' && c.trim() !== '') {
    return c.trim();
  }

  if (isRecord(raw.data) && typeof (raw.data).code === 'string') {
    return (raw.data).code.trim();
  }

  return undefined;
}
function getNiceMaxY(maxValue: number): number {
  if (!Number.isFinite(maxValue) || maxValue <= 0) return 1000;
  const magnitude =
    maxValue >= 1
      ? Math.floor(Math.log10(Math.floor(maxValue))) 
      : Math.floor(Math.log10(maxValue));          

  const scale = Math.pow(10, magnitude);
  const niceMax = Math.ceil(maxValue / scale) * scale;

  return niceMax > 0 ? niceMax : 1;
}
function normalizeYBounds(rawMin?: unknown, rawMax?: unknown) {
  const min0 = (typeof rawMin === 'number' && Number.isFinite(rawMin)) ? rawMin : 0;
  const max0 = (typeof rawMax === 'number' && Number.isFinite(rawMax)) ? rawMax : 0;

  let niceMax = getNiceMaxY(max0);      
  let niceMin = min0;

  if (!(niceMax > niceMin)) niceMin = 0;  
  if (!(niceMax > niceMin)) niceMax = getNiceMaxY(0); 

  return { min: niceMin, max: niceMax };
}
  // ---- 時間別：当日デフォルト ----
  const gl = useGlobalLoading()
  const loading = ref(false)

  // ---- 時間別：特定日検索 ----
  async function searchHourRange(): Promise<void> {
     loading.value=true
     gl.show()
  try {
    if (!facilityID) {
        router.push({ name: 'not-found', query: { returnTo: route.fullPath } });
        return; 
        }
    if (!validHourRange.value) return;
    const json = await fetchEnergyHourlyByDate(facilityID, date.value);
    
    facilityName.value   = json.facilityName ?? facilityName.value ?? '';
    lastUnits.value      = json.units || 'kWh';
   
    const { min: yMin, max: yMax } = normalizeYBounds(json.range?.min, json.range?.max);
    lastServerRange.value = { min: yMin, max: yMax };

    const categories = json.categories ?? [];

      mainChartOptions.value = withSafeAxisTitles({
        ...mainChartOptions.value,
        xaxis: { ...(mainChartOptions.value.xaxis), categories },
      });
      const series = mapByName(json.series);
      mainSeries.value = series;
      await apexRef.value?.updateSeries?.(series, true);

      await apexRef.value?.updateOptions?.({
        ...computedChartOptions.value,
        yaxis: {
          ...(computedChartOptions.value?.yaxis as ApexOptions['yaxis']),
          min: yMin,
          max: yMax,
          forceNiceScale: false,
          floating: false,
          labels: { show: false },
      }
      }, true, true);

      await nextTick();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => syncYAxis());
      });


  } catch(e: unknown)  {
    if (isHttpError(e)) {
    if (e.statusCode === 500) {
        router.push({ name: 'common-error-visual', query: { code:String(e.statusCode ?? 500) } });
        return;
      }

    if (e.statusCode === 404) {
        const errCode = extractBackendCode(e.data)
        openWith(404, { errorCode: errCode })
        mainSeries.value = []
        mainChartOptions.value = withSafeAxisTitles({
          ...mainChartOptions.value,
          xaxis: { ...(mainChartOptions.value.xaxis), categories: [] }
        })
      await apexRef.value?.updateOptions?.(computedChartOptions.value, true, true)
      requestAnimationFrame(() => syncYAxis())

        return
      }

        
    if (e.statusCode === 504) {
       openWith(504)
        return; 
    }
    const raw = e.data; 
    applyErrorsToPage(raw, { topList: topErrorList,
      fieldMap: serverErrors,
      reset: true,
    });
    const msg = (e.message).trim()
    const looksLikeNetwork = typeof e.statusCode !== 'number' || e.statusCode === 0 || e.statusCode === 503

    const isGenericBrowserMsg = /^failed to fetch$/i.test(msg) || /network\s*error/i.test(msg) || /load failed/i.test(msg)
    const hasNoPageErrors = topErrorList.value.length === 0 && Object.keys(serverErrors.value).length === 0
    if((looksLikeNetwork || isGenericBrowserMsg || msg.length === 0 || hasNoPageErrors)){
       const code = typeof e.statusCode === 'number' && e.statusCode > 0 ? e.statusCode : 503;
       openWith(code)  
    }
    applyErrorsToPage(raw, { topList: topErrorList,
      fieldMap: serverErrors,
      reset: true,
    });
  }
      error.value = ''
    mainSeries.value = [];
    mainChartOptions.value = withSafeAxisTitles({
      ...mainChartOptions.value,
      xaxis: { ...(mainChartOptions.value.xaxis), categories: [] }
    });
  }finally{
    loading.value=false
    gl.hide()
  }
  }
  // ---- 日別：特定の月検索 ----
  async function searchDayRange(): Promise<void> {
     loading.value=true
     gl.show()
  try {
    if (!facilityID) {
        router.push({ name: 'not-found', query: { returnTo: route.fullPath } });
        return; 
        }
    if (!validDayRange.value) return;
    const json = await fetchEnergyDailyByMonth(facilityID, selDate.value);

    facilityName.value   = json.facilityName ?? facilityName.value ?? '';
    lastUnits.value      = json.units || 'kWh';
    const { min: yMin, max: yMax } = normalizeYBounds(json.range?.min, json.range?.max);
    lastServerRange.value = { min: yMin, max: yMax };

    const categories = json.categories ?? [];

      mainChartOptions.value = withSafeAxisTitles({
        ...mainChartOptions.value,
        xaxis: { ...(mainChartOptions.value.xaxis), categories },
      });
      const series = mapByName(json.series);
      mainSeries.value = series;
      await apexRef.value?.updateSeries?.(series, true);

      await apexRef.value?.updateOptions?.({
        ...computedChartOptions.value,
        yaxis: {
          ...(computedChartOptions.value?.yaxis as ApexOptions['yaxis']),
          min: yMin,
          max: yMax,
          forceNiceScale: false,
          floating: false,
          labels: { show: false },
      }
      }, true, true);

      await nextTick();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => syncYAxis());
      });
  }catch(e: unknown)  {
    if (isHttpError(e)) {
    if (e.statusCode === 500) {
        router.push({ name: 'common-error-visual', query: { code:String(e.statusCode ?? 500) } });
        return;
      }

    if (e.statusCode === 404) {
        const errCode = extractBackendCode(e.data) 
        openWith(404, { errorCode: errCode })
        mainSeries.value = []
        mainChartOptions.value = withSafeAxisTitles({
          ...mainChartOptions.value,
          xaxis: { ...(mainChartOptions.value.xaxis), categories: [] }
        })
      await apexRef.value?.updateOptions?.(computedChartOptions.value, true, true)
      requestAnimationFrame(() => syncYAxis())
        return
      }

        
    if (e.statusCode === 504) {
       openWith(504)
       mainSeries.value = []
        mainChartOptions.value = withSafeAxisTitles({
          ...mainChartOptions.value,
          xaxis: { ...(mainChartOptions.value.xaxis), categories: [] }
        })
      await apexRef.value?.updateOptions?.(computedChartOptions.value, true, true)
      requestAnimationFrame(() => syncYAxis())
        return; 
    }
    const raw = e.data; 
    applyErrorsToPage(raw, { topList: topErrorList,
      fieldMap: serverErrors,
      reset: true,
    });
    const msg = (e.message).trim()
    const looksLikeNetwork = typeof e.statusCode !== 'number' || e.statusCode === 0 || e.statusCode === 503

    const isGenericBrowserMsg = /^failed to fetch$/i.test(msg) || /network\s*error/i.test(msg) || /load failed/i.test(msg)
    const hasNoPageErrors = topErrorList.value.length === 0 && Object.keys(serverErrors.value).length === 0
    if((looksLikeNetwork || isGenericBrowserMsg || msg.length === 0 || hasNoPageErrors)){
       const code = typeof e.statusCode === 'number' && e.statusCode > 0 ? e.statusCode : 503;
       openWith(code)  
    }
    applyErrorsToPage(raw, { topList: topErrorList,
      fieldMap: serverErrors,
      reset: true,
    });
  }
      error.value = ''
    mainSeries.value = [];
    mainChartOptions.value = withSafeAxisTitles({
      ...mainChartOptions.value,
      xaxis: { ...(mainChartOptions.value.xaxis), categories: [] }
    });
  }finally{
    loading.value=false
    gl.hide()
  }

  }
  // ---- 月別：同一年内の範囲検索 ----
  async function searchMonthRange(): Promise<void> {
     loading.value=true
     gl.show()
  try {
    if (!facilityID) {
        router.push({ name: 'not-found', query: { returnTo: route.fullPath } });
        return; 
        }
        if (!validMonthRange.value) return;
    const s = parseYM(startYM.value), e = parseYM(endYM.value);
    if (!s || !e) return;
    const json = await fetchEnergyMonthlyByRange(facilityID,
  `${s.y}-${String(s.m).padStart(2, '0')}`,
  `${e.y}-${String(e.m).padStart(2, '0')}`);

    facilityName.value   = json.facilityName ?? facilityName.value ?? '';
    lastUnits.value      = json.units || 'kWh';
    const { min: yMin, max: yMax } = normalizeYBounds(json.range?.min, json.range?.max);
    lastServerRange.value = { min: yMin, max: yMax };

    const categories = json.categories ?? [];
    const monthLabels = categories.map((c, i) => {
      let m: number | null = null;
      const mMatch = c.match(/^(\d{4})[-/](\d{1,2})/);
      if (mMatch && mMatch[2] !== undefined) {
        m = Math.max(1, Math.min(12, parseInt(mMatch[2], 10)));
      } else {
        const d = new Date(c);
        m = Number.isFinite(d.getTime()) ? d.getMonth() + 1 : null;
      }
      return String(m ?? ((i % 12) + 1)); 
    });
      mainChartOptions.value = withSafeAxisTitles({
        ...mainChartOptions.value,
        xaxis: { ...(mainChartOptions.value.xaxis), categories },
      });
      const series = mapByName(json.series);
      mainSeries.value = series;
      await apexRef.value?.updateSeries?.(series, true);

      await apexRef.value?.updateOptions?.({
        ...computedChartOptions.value,
        xaxis: { ...(mainChartOptions.value.xaxis ??  {}), categories: monthLabels },
        yaxis: {
          ...(computedChartOptions.value?.yaxis as ApexOptions['yaxis']),
          min: yMin,
          max: yMax,
          forceNiceScale: false,
          floating: false,
          labels: { show: false },
      }
      }, true, true);

      await nextTick();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => syncYAxis());
      });

  } catch(e: unknown)  {
        if (isHttpError(e)) {
    if (e.statusCode === 500) {
        router.push({ name: 'common-error-visual', query: { code:String(e.statusCode ?? 500) } });
        return;
      }

    if (e.statusCode === 404) {
        const errCode = extractBackendCode(e.data)
        openWith(404, { errorCode: errCode })
        mainSeries.value = []
        mainChartOptions.value = withSafeAxisTitles({
          ...mainChartOptions.value,
          xaxis: { ...(mainChartOptions.value.xaxis), categories: [] }
        })
      await apexRef.value?.updateOptions?.(computedChartOptions.value, true, true)
      requestAnimationFrame(() => syncYAxis())
        return
      }

        
    if (e.statusCode === 504) {
       openWith(504)
       mainSeries.value = []
        mainChartOptions.value = withSafeAxisTitles({
          ...mainChartOptions.value,
          xaxis: { ...(mainChartOptions.value.xaxis), categories: [] }
        })
      await apexRef.value?.updateOptions?.(computedChartOptions.value, true, true)
      requestAnimationFrame(() => syncYAxis())
        return; 
    }
    const raw = e.data; 
    applyErrorsToPage(raw, { topList: topErrorList,
      fieldMap: serverErrors,
      reset: true,
    });
    const msg = (e.message).trim()
    const looksLikeNetwork = typeof e.statusCode !== 'number' || e.statusCode === 0 || e.statusCode === 503

    const isGenericBrowserMsg = /^failed to fetch$/i.test(msg) || /network\s*error/i.test(msg) || /load failed/i.test(msg)
    const hasNoPageErrors = topErrorList.value.length === 0 && Object.keys(serverErrors.value).length === 0
    if((looksLikeNetwork || isGenericBrowserMsg || msg.length === 0 || hasNoPageErrors)){
       const code = typeof e.statusCode === 'number' && e.statusCode > 0 ? e.statusCode : 503;
       openWith(code)  
    }
    applyErrorsToPage(raw, { topList: topErrorList,
      fieldMap: serverErrors,
      reset: true,
    });
  }
      error.value = ''
    mainSeries.value = [];
    mainChartOptions.value = withSafeAxisTitles({
      ...mainChartOptions.value,
      xaxis: { ...(mainChartOptions.value.xaxis), categories: [] }
    });
  }
  finally{
    loading.value=false
    gl.hide()
  }
  }
function closeAllMenus() {
  openTime.value  = false
  openDay.value   = false
  openStart.value = false
  openEnd.value   = false
}

watch(
  granularity,
  async (g) => {
    closeAllMenus()
    if (g === 'time')       await searchHourRange();
    else if (g === 'day')   await searchDayRange();
    else if (g === 'month') await searchMonthRange();
  },
  { immediate: true }
);

  return {
    // チャート
    facilityName,mainSeries, mainChartOptions, computedChartOptions,
    customLegendItems, yLabelText, xLabelText,
    chartRoot, yStickyEl, yTicks, apexRef,
    granularity,lastServerRange,lastUnits,withSafeAxisTitles,

    topErrorList,

    // 時間ピッカー
    todayYMD, date, pendingDate, displayed, display,openTime,openDay,closeAllMenus,
    headerLabel, displayedYear, displayedMonth, incMonth, validHourRange, applyPending, onPickPending,getTodayYM,

    // 日ピッカー
    todayYM, selDate, year, displayMonth, pending,
    isSelected, isDisabled, pickMonth, applyPendingMonth, validDayRange,displayYear,

    // 月ピッカー
    fromTime, toTime, startYM, endYM, openStart, openEnd, years,setTodayStart,
    canIncYear, canDecYear, incYear, decYear,
    tempStartYear, tempStartMonth, tempEndYear, tempEndMonth,
    monthItemsStart, monthItemsEnd, parseYM, validMonthRange, apply,incEndYear,decEndYear,
    resetDailyToToday,
    resetMonthlyToDefault,


    // アクション
     searchHourRange, searchDayRange, searchMonthRange,
    syncYAxis,resetHourlyToToday,isBeforeMin,isAfterMax,__setMinMonthForTest,__setMaxMonthForTest,__getMonthBoundsForTest,isValidFacilityId,routeFacilityId
  };
}
