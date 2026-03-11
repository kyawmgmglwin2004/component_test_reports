<template>
      <NotFoundScreen />
    <v-container>
  <div v-if="topErrorList.length" class="mb-4">
  <v-alert
    v-for="(m, i) in topErrorList"
    :key="i"
    type="error"
    variant="tonal"
    density="compact"
    class="error-alert"
    @click="topErrorList = []"
  >
    {{ m }}
  </v-alert>
  </div> 
  <div>
    <h2 class="title text-h6  pt-1 text-truncate">{{facilityName}}{{ t('chart.history') }}</h2>

    <!-- 表示種別（粒度）のラジオ：時間帯別/日別/月別 -->
   <v-radio-group inline v-model="granularity" class="radio-group" hide-details @update:model-value="closeAllMenus">
  <p class="radio-title">{{ t('chart.displayType') }}</p>
  
  <div class="radio-wrapper" @click="granularity = 'time'">
    <v-radio value="time" density="compact">
      <template #label>
          <span style="margin-left: 1px;">{{ t('chart.byTime') }}</span>
      </template>
    </v-radio>
  </div>

  <div class="radio-wrapper" @click="granularity = 'day'">
    <v-radio value="day" density="compact">
      <template #label>
         <span style="margin-left: 1px;">{{ t('chart.byDay') }}</span>
      </template>
    </v-radio>
  </div>

  <div class="radio-wrapper" @click="granularity = 'month'">
    <v-radio value="month" density="compact">
      <template #label>
          <span style="margin-left: 1px;">{{ t('chart.byMonth') }}</span>
      </template>
    </v-radio>
  </div>
</v-radio-group>

    <!-- ===== 時間帯別（特定日付の 0-24 時） ===== -->
    <v-row align="center" class="search" v-if="granularity === 'time'">
      <v-col cols="6" md="3">
        <v-locale-provider>
          <div class="label">{{ t('chart.selDate') }}</div>
          <!-- 日付ピッカーのポップアップ -->
          <v-menu v-model="openTime" :persistent="false" :close-on-content-click="false" offset-y>
            <!-- テキストフィールドをアクティベータにする -->
            <template #activator="{ props }">
              <v-text-field
                v-bind="props"
                :model-value="display"                
                prepend-inner-icon="mdi mdi-calendar-month"
                readonly
                hide-details
                density="comfortable"
                style= "max-width: 240px;"
                class="date-field day-picker-style"
              />
            </template>

            <!-- カレンダーカード：ヘッダーと Vuetify の v-date-picker -->
            <v-card class="calendar-card">
              <div class="calendar-top-bar">
                <div class="left">
                  <v-icon size="25">mdi mdi-calendar-month</v-icon>
                  <span class="calender-title">{{ t('chart.selectedDate') }}</span>
                </div>
                <v-btn icon="mdi-close" variant="text" size="small" @click="openTime = false" />
              </div>
              
              <!-- v-date-picker は model-value に pendingDate（仮選択）を採用 -->
              <v-date-picker
                :model-value="pendingDate"
                @update:model-value="onPickPending"  
                :max="todayYMD"                      
                hide-title
                hide-weekdays
                class="brown-calendar"
                :year="displayedYear"               
                :month="displayedMonth"             
                @update:year="displayedYear = $event"
                @update:month="displayedMonth = $event"
              >
                <!-- ヘッダーをカスタム：左右の月移動ボタン -->
                <template #header>
                  <div class="month-bar">
                    <v-btn icon="mdi mdi-arrow-left-bold" variant="text" class="nav-btn-20" @click="incMonth(-1)" />
                    <div class="month-label">{{ headerLabel }}</div>
                    <v-btn icon="mdi mdi-arrow-right-bold" variant="text" class="nav-btn-20" @click="incMonth(1)" />
                  </div>
                </template>
                <!-- 既定のコントロールは非表示 -->
                <template #controls></template>
              </v-date-picker>

              <v-card-actions class="justify-center">
                <!-- pendingDate を適用してメニューを閉じる -->
                <v-btn class="ok-btn" @click="applyPending">{{ t('chart.ok') }}</v-btn>
              </v-card-actions>
            </v-card>
          </v-menu>
        </v-locale-provider>
      </v-col>

      <!-- 検索ボタン：日付が妥当な場合のみアクティブ -->
      <v-col cols="6" md="3" class="pt-10">
        <v-btn color="#843C0C" class="text-white" :disabled="!validHourRange" @click="searchHourRange">
          {{ t('chart.search') }}
        </v-btn>
      </v-col>
    </v-row>

    <!-- ===== 日別（月内の各日） ===== -->
    <v-row align="center" class="search" v-if="granularity === 'day'">
      <v-col cols="6" md="3">
        <v-locale-provider>
          <div class="label">{{ t('chart.selMonth') }}</div>

          <!-- 月ピッカーのポップアップ -->
          <v-menu v-model="openDay" :persistent="false" :close-on-content-click="false" offset-y>
            <template #activator="{ props }">
              <v-text-field
                v-bind="props"
                :model-value="displayMonth"         
                prepend-inner-icon="mdi mdi-calendar-month"
                readonly
                hide-details
                density="comfortable"
                style="max-width: 240px"
                class="month-field"
              />
            </template>

            <!-- カスタム月選択 UI：年切替 + 1〜12 のボタン -->
            <v-card class="calendar-card">
              <div class="calendar-top-bar">
                <div class="left">
                  <v-icon size="25">mdi mdi-calendar-month</v-icon>
                  <span class="calender-title">{{ t('chart.selectedMonth') }}</span>
                </div>
                <v-btn icon="mdi-close" variant="text" size="small" @click="openDay = false" />
              </div>

              <div class="month-bar">
                <!-- 年のデクリメント（下限は canDecYear で制御してもOK） -->
                <v-btn icon="mdi mdi-arrow-left-bold" variant="text" class="nav-btn-20" @click="decYear()" :disabled="!canDecYear" />
                <div class="month-label">{{ displayYear }}</div>
                <!-- 年のインクリメント：当年より先は不可 -->
                <v-btn icon="mdi mdi-arrow-right-bold" variant="text" class="nav-btn-20" @click="incYear()" :disabled="!canIncYear" />
              </div>

              <!-- 1..12 月のグリッド。無効/選択状態をスタイルで表示 -->
              <div class="mp-month-grid">
                <v-btn
                  v-for="m in 12"
                  :key="m"
                  class="mp-month"
                  :class="{ selected: isSelected(displayYear, m), disabled: isDisabled(displayYear, m) }"
                  :disabled="isDisabled(displayYear, m)"
                  @click="pickMonth(displayYear, m)"
                  :ripple="false"
                  :elevation="0"
                  variant="flat"
                >
                  {{ m }}{{ t('chart.month') }}
                </v-btn>
              </div>

              <v-card-actions class="justify-center pa-4">
                <!-- 選択がないときは OK 無効 -->
                <v-btn class="ok-btn" :disabled="!pending" @click="applyPendingMonth">{{ t('chart.ok') }}</v-btn>
              </v-card-actions>
            </v-card>
          </v-menu>
        </v-locale-provider>
      </v-col>

      <!-- 検索ボタン：月が妥当な場合のみアクティブ -->
      <v-col cols="6" md="3" class="pt-10">
        <v-btn color="#843C0C" class="text-white" :disabled="!validDayRange" @click="searchDayRange">
          {{ t('chart.search') }}
        </v-btn>
      </v-col>
    </v-row>

    <!-- ===== 月別（年内の開始〜終了月レンジ） ===== -->
    <v-row align="center" class="search" v-if="granularity === 'month'">
      <!-- 開始月のピッカー（年・月のセレクト） -->
      <v-col cols="4" md="4">
        <div class="label">{{ t('chart.startMonth') }}</div>
        <v-menu v-model="openStart" :persistent="false" :close-on-content-click="false" offset-y>
          <template #activator="{ props }">
            <div class="d-flex align-center gap-2">
              <v-text-field
                v-bind="props"
                :model-value="startYM"              
                prepend-inner-icon="mdi-calendar-month"
                readonly
                hide-details
                density="comfortable"
                class="start-date"
                style="max-width: 120px;"
              />
              <!-- 時刻セレクト（UIデザイン用）：現在は disabled 固定 -->
              <v-select class="start-time" v-model="fromTime" density="compact" hide-details style="max-width: 110px; height: 48px; font-size: 0.8rem;" disabled />
            </div>
          </template>

          <!-- 開始月ピッカー：年/月セレクト + ナビ -->
          <v-card class="picker-card">
            <div class="toolbar">
              <v-btn icon="mdi-chevron-left" variant="text" @click="decYear()" :disabled="!canDecYear" />
              <div class="selectors">
                <v-select :items="years" v-model="tempStartYear" density="compact" variant="outlined" hide-details class="year-select" 
                :item-title="item => String(item)"  
                :item-value="item => item"/>
                <span>{{ t('chart.year') }}</span>
                <v-select
                  :items="monthItemsStart"
                  v-model="tempStartMonth"
                  item-title="label"
                  item-value="value"
                  :item-props="(item) => ({ disabled: item.disabled })"
                  density="compact"
                  variant="outlined"
                  hide-details
                  class="month-select"
                />
              </div>
              <v-btn icon="mdi-chevron-right" variant="text" @click="incYear()" :disabled="!canIncYear" />
            </div>
            <v-card-actions class="justify-space-between px-4 pb-3">
              <!-- 「今日」ボタン：ここでは単に閉じる挙動。必要なら today にリセット -->
              <v-btn size="small" variant="tonal" @click="setTodayStart()">{{ t('chart.today') }}</v-btn>
              <div class="btns">
                <!-- apply('start') で妥当化 → 反映 -->
                <v-btn size="small" variant="tonal" @click="apply('start')">{{ t('chart.close') }}</v-btn>
              </div>
            </v-card-actions>
          </v-card>
        </v-menu>
      </v-col>

      <v-col cols="1" md="1" class="pt-10">
        <p align="center">~</p>
      </v-col>

      <!-- 終了月のピッカー（年・月のセレクト） -->
      <v-col cols="4" md="4">
        <div class="label">{{ t('chart.endMonth') }}</div>
        <v-menu v-model="openEnd" :persistent="false" :close-on-content-click="false" offset-y>
          <template #activator="{ props }">
            <div class="d-flex align-center gap-2">
              <v-text-field
                class="end-date"
                v-bind="props"
                :model-value="endYM"               
                prepend-inner-icon="mdi mdi-calendar-month"
                readonly
                hide-details
                density="comfortable"
                style="max-width: 120px;"
              />
              <!-- 時刻セレクト（UIデザイン用）：現在は disabled 固定 -->
              <v-select class="end-time" v-model="toTime" density="compact" hide-details style="max-width: 110px; height: 48px;" disabled />
            </div>
          </template>

          <!-- 終了月ピッカー：年/月セレクト + ナビ -->
          <v-card class="picker-card">
            <div class="toolbar">
              <v-btn icon="mdi-chevron-left" variant="text" @click="decEndYear()" :disabled="!canDecYear" />
              <div class="selectors">
                <v-select :items="years" v-model="tempEndYear" density="compact" variant="outlined" hide-details class="year-select" 
                :item-title="item => String(item)" 
                :item-value="item => item"/>
                <span>{{ t('chart.year') }}</span>
                <v-select
                  :items="monthItemsEnd"
                  v-model="tempEndMonth"
                  item-title="label"
                  item-value="value"
                  :item-props="(item) => ({ disabled: item.disabled })"
                  density="compact"
                  variant="outlined"
                  hide-details
                  class="month-select"
                />
              </div>
              <v-btn icon="mdi-chevron-right" variant="text" @click="incEndYear()" :disabled="!canIncYear" />
            </div>
            <v-card-actions class="justify-space-between px-4 pb-3">
              <v-btn size="small" variant="tonal" @click="setTodayStart()">{{ t('chart.today') }}</v-btn>
              <div class="btns">
                <!-- apply('end') で妥当化 → 反映 -->
                <v-btn size="small" variant="tonal" @click="apply('end')">{{ t('chart.close') }}</v-btn>
              </div>
            </v-card-actions>
          </v-card>
        </v-menu>
      </v-col>

      <!-- 検索ボタン：年をまたがず、範囲が妥当な場合のみアクティブ -->
      <v-col cols="3" md="3" class="pt-10">
        <v-btn color="#843C0C" class="text-white" :disabled="!validMonthRange" @click="searchMonthRange">
          {{ t('chart.search') }}
        </v-btn>
      </v-col>
    </v-row>

    <!-- ===== チャート（凡例と Y 目盛りを sticky、横スクロールは原則なし） ===== -->
    <div class="chart-card no-hscroll">
      <div class="chart-wrapper">
      <GlobalLoading :model-value="loading"/>
      <!-- カスタム凡例（series 名＋色） -->
      <div class="legend-float" v-if="customLegendItems.length">
        <div class="legend-card">
          <div v-for="item in customLegendItems" :key="item.name" class="legend-pill">
            <span class="swatch" :style="{ backgroundColor: item.color }"></span>
            <span class="legend-text" :style="{ color: item.color }">{{ item.name }}</span>
          </div>
        </div>
      </div>

      <div class="chart-body">
        <!-- 左側の固定 Y ガター：単位と目盛りラベルを自前描画 -->
        <div class="y-sticky" ref="yStickyEl">
          <div class="y-unit">{{ yLabelText }}</div>

          <!-- yTicks は useFacilityRegistration で内部 DOM から同期した結果 -->
          <div class="y-ticks" v-if="yTicks.length">
            <div
              v-for="(t, i) in yTicks"
              :key="`yt-${i}`"
              class="y-tick"
              :style="{ top: t.topPx + 'px' }"
            >
              {{ t.label }}
            </div>
          </div>
        </div>

        <!-- 右側：ApexCharts 埋め込み領域（横スクロールはモバイルのみ） -->
        <div class="chart-scroller">
          <div class="chart-canvas" ref="chartRoot">
            <!-- ApexCharts 本体。mounted/updated/animationEnd で y 軸同期 -->
            <!-- ※ vue3-apexcharts のコンポーネントをグローバル登録している想定 -->
            <apexchart
              ref="apexRef"
              type="bar"
              :options="localChartOptions"  
              :series="mainSeries"
              width="100%"
              height="100%"
              @mounted="syncYAxis"
              @updated="syncYAxis"
              @animationEnd="syncYAxis"
            />
          </div>
        </div>
      </div>

      <!-- 右下の X 軸ラベル（(時)/(日)/(月)） -->
      <div class="sticky-x-wrap">
        <div class="sticky-x-label">{{ xLabelText }}</div>
      </div>
      </div>
    </div>

    <!-- 別ページ遷移ボタン（現在値ダッシュボード） -->
    <div class="container">
      <v-btn class="button" :loading="loading" :disabled="loading || !isValidFacilityId" :color="isValidFacilityId ? '#C55A11' : 'grey'" @click="goToEamountCheck">{{ t('chart.goToDashboard') }}</v-btn>
    </div>
    </div>
  </v-container>
</template>

<script setup lang="ts">
/**
 * - apexchart: vue3-apexcharts のコンポーネント
 * - ルーターから facilityID を取得して、電力量履歴の取得・表示に用いる
 * - useFacilityRegistration: チャート描画や各ピッカー、検索アクションをまとめた composable
 */
import { computed, ref } from 'vue'
import apexchart from 'vue3-apexcharts'
import { useRouter, useRoute } from 'vue-router';
//  import パス：ファイル名（useElectricityCheckHistory）と実ファイル名を一致させてください
import { useFacilityHistory } from './ElectricityCheckHistory';
import GlobalLoading from '@/pages/Common/components/GlobalLoading.vue'
import { useI18n } from 'vue-i18n'
import NotFoundScreen from '@/pages/Common/components/NotFoundScreen.vue'

const { t } = useI18n()
const route = useRoute();
const router = useRouter();
const facilityID = String(route.params.facilityID ?? ''); 
const loading = ref(false);



// 「現在値確認」ページへ遷移
function goToEamountCheck() {
   loading.value = true;
  router.push(`/facilities/${encodeURIComponent(facilityID)}/energy/dashboard`);
}

// composable からテンプレートに必要な参照をまとめて取得
const reg = useFacilityHistory(facilityID);
const {
  // チャート + 軸
  facilityName,mainSeries, computedChartOptions,isValidFacilityId,
  customLegendItems, yLabelText, xLabelText,
  chartRoot, yStickyEl, yTicks, apexRef, syncYAxis,

  // 粒度（表示種別）
  granularity,topErrorList,

  // 時間ピッカー
  todayYMD, pendingDate, openTime,openDay, display,closeAllMenus,
  headerLabel, displayedYear, displayedMonth, incMonth, validHourRange, applyPending, onPickPending,

  // 日ピッカー
  displayYear,displayMonth, pending,
  isSelected, isDisabled, pickMonth, applyPendingMonth, validDayRange,

  // 月ピッカー
  fromTime, toTime, startYM, endYM, openStart, openEnd, years, canIncYear, canDecYear, incYear, decYear,incEndYear,decEndYear,setTodayStart,
  tempStartYear, tempStartMonth, tempEndYear, tempEndMonth, monthItemsStart, monthItemsEnd, validMonthRange, apply,

  // 検索アクション
   searchHourRange, searchDayRange, searchMonthRange,
} = reg;

const localChartOptions = computed(() => {
  const original = computedChartOptions.value;

  return {
    ...original, 
    
    tooltip: {
      enabled: true,
      theme: 'light', 
      
      style: {
        fontSize: '14px',          
        fontFamily: 'Arial, sans-serif',
        background: '#843C0C',     
        color: '#ffffff',
      },
      
    
      marker: {
        show: true,
        width: 8,   
        height: 8,
        offsetY: -2, 
        strokeColor: '#fff',
        strokeWidth: 1
      },
      y: {
        formatter: function (val: number) {
          return val + " kWh"; 
        }
      },
      x: {
        formatter: function (val: any) {
           return val; 
        }
      }
    }
  };
});
</script>

<style>

.text-truncate {
   max-width: 30vw;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.chart-wrapper {
  position: relative;   
  min-height: 300px;    
}
  .v-container {
    width: 95%;
    padding: 0;
    padding-bottom: 43px !important;
    margin-right: auto;
    margin-left: auto;
    overflow: hidden;
  }

  .error-alert {
    margin-top: 10px;
  }

.radio-group .v-selection-control {
  --v-selection-control-size: 18px !important;
}

.radio-group .v-radio {
  margin-right: 12px;
}
.radio-title{
  margin-top: 8px;
  font-size: 1rem !important;
}
.v-label{
  font-size: 0.85rem !important;
}
.radio-group .v-radio {
  margin-right: 12px;
  font-size: 0.75rem !important;
}
.radio-group .v-selection-control {
  border: 2px solid #b98560;
  padding: 2px 10px !important;
  border-radius: 8px;
  min-height: 32px !important;
  height: 32px !important;
  display: flex;
  align-items: center;
  width: 98px;
}
  .title, .radio-group, .search{
    color: #843C0C;
    font-weight: bold;
  }
.search{
  width: 84%;
}


  .label {
    color: #843C0C !important;
    font-weight: 700;
  }

  .container {
    display: flex;
    justify-content:flex-start;
    align-items: flex-start;
    padding-left: 60px;
    color: #843C0C;
  }

  .calender-title{
    font-size: 1.2rem;
    font-weight: bold;
  }

  .calendar-card {
    border: 2px solid #843C0C;
    border-radius: 8px;
    overflow: hidden;
  }
  .calendar-top-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 8px 1px 8px;
    color: #843C0C;
  }
  .calendar-top-bar .left {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .calendar-top-bar  {
    font-weight: 700;
  }

  .month-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 2px 26px;
    color: #843C0C;
    height: 30px;
  }
  .month-label {
    font-weight: bold;
    font-size: 1.2rem;
  }

  .ok-btn {
    background: #843C0C !important;
    color: #fff !important;
    border-radius: 18px;
    padding: 0 22px;
    text-transform: none;
  }

  .v-date-picker-month{
    height: 200px;
  }
.v-input--density-compact .v-field--variant-outlined, 
.v-input--density-compact .v-field--single-line,
 .v-input--density-compact .v-field--no-label {
    --v-field-padding-bottom: 0px;
}
  .brown-calendar .v-date-picker-month__day .v-btn,
  .brown-calendar .v-date-picker-month__day .v-btn::before,
  .brown-calendar .v-date-picker-month__day .v-btn::after {
    border-radius: 2px !important;
  }
  .brown-calendar .v-date-picker-month__day--selected .v-btn,
  .brown-calendar .v-date-picker-month__day--selected .v-btn::before,
  .brown-calendar .v-date-picker-month__day--selected .v-btn::after {
    border-radius: 2px !important;
    background-color: #843C0C;
  }
  
.brown-calendar .v-date-picker-month__day:nth-child(7n+1) .v-btn{
  color:red !important;
}

.brown-calendar .v-date-picker-month__day:nth-child(7n) .v-btn{
  color:blue !important;
}


.brown-calendar .v-date-picker-month__day--selected .v-btn{
  color:white !important;
}

  .nav-btn-20{
    height: 20px !important;
  }
  
  .brown-calendar .v-date-picker-month__day {
    padding: 2px !important;
    margin: 0 !important;
    min-width: 28px !important;
    width: 28px;
    height: 18px !important;
  }
  .brown-calendar .v-btn--density-default {
    --v-btn-height: 18px !important;
    font-size: 13px !important;
  }

.brown-calendar .v-date-picker-month {
  width: 330px;
  height: 150px;
}

.brown-calendar .v-date-picker-month__day {
  width: 32px;
  height: 32px;
}

  .v-sheet {
    background: rgb(var(--v-theme-surface));
    color: #843C0C;
  }

  .mp-month-grid {
    display:grid;
    grid-template-columns: repeat(6, 1fr);
    gap:2px;
    padding:3px 4px 0;
  }
  .mp-month {
    height: 48px;
    width: 45px;
    background-color: #ebdfd6;
    color: #843C0C;
  }
  .mp-month.selected {
    background: #843C0C;
    border-color: #843C0C;
    color: #fff;
  }
  .v-btn--size-default {
    --v-btn-size: 0.875rem;
    --v-btn-height: 36px;
    font-size: var(--v-btn-size);
    min-width: 0px;
    padding: 0 16px;
  }

  .picker-card {
    width: 330px;
    border: 1px solid #c8c8c8;
    border-radius: 6px;
    overflow: hidden;
  }
  .toolbar {
    display: grid;
    grid-template-columns: 30px 1fr 30px;
    align-items: center;
    gap: 8px;
    padding: 8px;
    background: linear-gradient(#e7e7e7, #d6d6d6);
    border-bottom: 1px solid #c8c8c8;
  }
  .selectors {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    justify-content: center;
  }
  .year-select, .month-select {
    background-color: #fff;
    width: 110px;
  }
  .month-select { width: 100px; }
  .btns {
    display: inline-flex;
    gap: 8px;
  }

  .day-picker-style {
    background-color: #e9d9cd;
  }
  
  @media (min-width: 700px) and (max-width: 900px) {
    .title, .radio-group{
      padding-bottom: 25px;
      padding-left: 6px;
      font-size: 1.8rem !important;
    }

    .search{
      padding-bottom: 40px;
      padding-left: 6px;

    }
    .chart-card.no-hscroll{
      height: 400px;
    }
    .legend-float{
      padding-bottom: 20px;
    }
    .chart-body{
      padding-top: 30px;
    }

}
  @media (max-width: 500px) {
    .title, .radio-group, .search,  .date-field, .month-field, .start-date{
      padding-left: 4px;
    }
    .text-truncate {
      max-width: 40vw;
    }

    .radio-group .v-radio{
      margin-right: 2px !important;
    }
    .title{
      padding-top: 5px;
    }
    .search { --fs-field: 12px; }
    .search .start-date .v-field__input,
    .search .end-date .v-field__input {
      padding-top: 1px;
      padding-bottom: 1px;
      padding-inline: 1px;
      font-size: var(--fs-field);
      line-height: 1.2;
    }
    .search .start-date .v-field__prepend-inner .v-icon,
    .search .end-date   .v-field__prepend-inner .v-icon {
      font-size: var(--icon-sm) !important;
      width: var(--icon-sm) !important;
      height: var(--icon-sm) !important;
    }
    .search .start-time,
    .search .end-time {
      height: auto !important;
      width: 7px;
    }
    .search .start-time .v-field__input,
    .search .end-time   .v-field__input {
      padding-top: 1px;
      padding-bottom: 1px;
      padding-inline: 1px;
    }
    .search .start-time .v-select__selection-text,
    .search .end-time   .v-select__selection-text {
      font-size: 2px;
    }
  }

  .chart-card.no-hscroll {
    position: relative;
    min-height: 280px;
  }

  .legend-float {
    top: 6px;
    z-index: 20;
    display: flex;
    justify-content:flex-end;
    padding: 0 8px;
  }
  .legend-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    font-size: 12px;
    user-select: none;
    pointer-events: none;
  }
  .legend-pill .swatch {
    width: 12px; height: 12px; border-radius: 3px; display: inline-block;
  }
  .legend-text { white-space: nowrap; font-size: 1rem;}

  .y-sticky {
    position:relative;
    left: 0;
    top: 0;
    align-self: stretch;
    z-index: 3;
    background: #fff;
    border-right: 1px solid #eef2fb;
  }
  .y-unit {
    font-size: 12px;
    color: #606a85;
    padding: 6px 8px 0 8px;
    line-height: 1.2;
    height: 24px;
    white-space: nowrap;
  }
  .y-tick {
    position: absolute;
    left: 6px; right: 6px;
    text-align: right;
    font-size: 12px;
    color: #2a324b;
  }
  .y-ticks {
    position: relative;
    left: 6px;
    right: 6px;
    padding-bottom: 60px;
    font-size: 12px;
    color: #2a324b;
    text-align: right;
    transform: translateY(-50%); 
  }

  .chart-body {
    display: grid;
    grid-template-columns: 64px 1fr;  
    gap: 0;
  }
  .chart-scroller{
    flex: 1 1 auto;
    overflow-x: hidden;  
    overflow-y: hidden;

  }
  .chart-canvas{
    width: 100%;
    min-height: 250px;
  }

  .sticky-x-wrap {
    position: absolute !important;
    right: 0px;
    bottom: 15px;
    z-index: 15;
    display: flex;
    justify-content: flex-end;
    pointer-events: none;
  }
  .sticky-x-label {
    font-size: 12px;
    color: #555;
  }

.radio-wrapper{
  cursor:pointer;
  padding:4px 10px;

}  
@media (max-width: 600px) {
  .radio-wrapper {
    padding: 4px 5px;
  }
}

@media (max-width: 380px) {
 .radio-wrapper {
    padding: 4px 5px;
  }

  .text-truncate {
      max-width: 50vw;
    }

  .radio-wrapper .v-label {
    font-size: 0.65rem !important; 
  }

  .radio-group .v-selection-control {
    --v-selection-control-size: 16px !important;
    min-height: 28px !important;
    height: 28px !important;
    width: 80px; 
    padding: 2px 6px !important;
  }
  .legend-text { white-space: nowrap; font-size: 0.7rem;} 

   .legend-float{
      margin-top: 20px;
    }

 .title {
  font-size: 0.9rem !important;
 }

 .radio-title{
  font-size: 0.9rem !important;
  margin-right: 5px;
}

 .label {
  font-size: 0.9rem;
  margin-bottom: 5px;
  }

}


  @media (max-width: 600px) {
    .sticky-x-wrap {
      position: absolute;
      right: 8px;
      z-index: 15;
      display: flex;
      justify-content: flex-end;
      pointer-events: none;
    }
    .chart-scroller {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }
    .chart-canvas {
      min-width: 980px;
      min-height: 300px;
    }


  }

</style>