FciityListTable.vue<template>
  <div class="table-aera">
  <v-dialog
  v-model="confirmDialog"
  max-width="360"
  scrim="rgba(0,0,0,.40)"   
  location="center"
  origin="center"  
  persistent                            
>
  <v-card class="pop_pup" elevation="8" rounded="xl" >
    <v-card-text class="pop_pup__text">
      <div>{{ t('message.facilityDeleteConfirm1') }}</div>
      <div>{{ t('message.facilityDeleteConfirm2') }}</div>
    </v-card-text>
    <v-card-actions class="pop_pup__actions d-flex justify-center">

      <v-btn
        class="btn-cancel"
        @click="handleCancel"
        :loading="isBusy"
        :disabled="isBusy"
        variant="flat"
      >
        {{ t('common.cancel') }}
      </v-btn>
      <v-btn
        class="btn-ok"
        @click="handleOk"
        :loading="isBusy"
        :disabled="isBusy"
        variant="flat"
      >
         {{ t('common.OK') }}
      </v-btn>
    </v-card-actions>
  </v-card>
</v-dialog>
  <v-data-table
    :headers="headers"
    :items="FacilityList"
    :items-per-page="limit"
    disable-sort
    :loading="loading || isBusy"
    v-model="selected"
    class="no-wrap-table pretty-table keep-left-border sticky-select-table"
    hide-default-footer
    :return-object="true"
    density="comfortable"
    hover
    fixed-header
  >
    <template #top>
      <v-progress-linear
        v-if="isBusy"
        indeterminate
        color="primary"
        height="3"
        class="mb-1"
      />
    </template>
    <template
      v-for="h in headers"
      :key="h.key"
      v-slot:[`header.${h.key}`]="{ column }"
    >
      <div
        class="hdr-2row-grid"
        :class="{ 'hdr-2row-grid--one-line': !getSecondLine(column as { secondLine?: string | number | null }) }"
      >
        
        <div class="hdr-text line1">
          <span class="hdr-title">{{ column.title }}</span>
        </div>
    
        <div class="hdr-icon line1">
          <v-icon
            v-if="column.sortable"
            icon="mdi-menu-up"
            size="29"
            class="sort-icon"
            role="button"
            tabindex="0"
            :aria-label="`${column.title} を昇順で並べ替え`"
            title="昇順で並べ替え"
            :class="{
              'sort-icon--active': activeSortKey === h.key && activeSortOrder === 'asc',
              'sort-icon--inactive': !(activeSortKey === h.key && activeSortOrder === 'asc'),
              'is-busy': isBusy,
               'is-disabled': !hasData
            }"
            :aria-pressed="activeSortKey === h.key && activeSortOrder === 'asc' ? 'true' : 'false'"
            @click.stop="() => { if (!isBusy && hasData) handleAsc(h.key) }"
            @keydown.enter.stop="() => { if (!isBusy && hasData) handleAsc(h.key) }"
            @keydown.space.prevent.stop="() => { if (!isBusy && hasData) handleAsc(h.key) }"
          />
        </div>
        <div class="hdr-text line2">
          <span
            class="hdr-unit"
            :class="{ 'hdr-unit--empty': !getSecondLine(column as { secondLine?: string | number | null }) }"
          >
            {{ getSecondLine(column as { secondLine?: string | number | null }) }}
          </span>
        </div>

        <div class="hdr-icon line2">
          <v-icon
            v-if="column.sortable"
            icon="mdi-menu-down"
            size="29"
            class="sort-icon"
            role="button"
            tabindex="0"
            :aria-label="`${column.title} を降順で並べ替え`"
            title="降順で並べ替え"
            :class="{
              'sort-icon--active': activeSortKey === h.key && activeSortOrder === 'desc',
              'sort-icon--inactive': !(activeSortKey === h.key && activeSortOrder === 'desc'),
              'is-busy': isBusy,
               'is-disabled': !hasData
            }"
            :aria-pressed="activeSortKey === h.key && activeSortOrder === 'desc' ? 'true' : 'false'"
            @click.stop="() => { if (!isBusy && hasData) handleDesc(h.key) }"
            @keydown.enter.stop="() => { if (!isBusy && hasData) handleDesc(h.key) }"
            @keydown.space.prevent.stop="() => { if (!isBusy && hasData) handleDesc(h.key) }"
          />
        </div>
      </div>
    </template>
      <template v-slot:[`header.data-table-select`]>
      選択
    </template>
    <template v-slot:[editDeleteSlot]="{ item }">
      <div class="d-flex ga-2 justify-left">
        <v-icon
          color="medium-emphasis"
          icon="mdi-square-edit-outline"
          size="small"
          class="cursor-pointer"
          :class="{ 'is-busy': isBusy }"
          @click="() => { if (!isBusy) handleEdit(item) }"
        />
        <p>・</p>
        <v-icon
          color="medium-emphasis"
          icon="mdi-trash-can-outline"
          size="small"
          class="cursor-pointer"
          :class="{ 'is-busy': isBusy }"
          @click="() => { if (!isBusy) handleDelete(item) }"
        />
      </div>
    </template>
    <template v-slot:[`item.facilityAddress`]="{ item }">
  <v-tooltip
    :text="item.facilityAddress"
      :disabled="!isOver(item.facilityAddress, 12)"
    location="bottom"
     open-delay="120"
          close-delay="80"
          max-width="420"
          content-class="addressBox"
  >
    <template #activator="{ props }">
      <div class="addr-1line" v-bind="props">
        {{ clampTo12(item.facilityAddress) }}
      </div>
    </template>
  </v-tooltip>
</template>

      <template v-slot:[`item.facilityName`]="{ item }">
  <v-tooltip
    :text="item.facilityName"
     :disabled="!isOver(item.facilityName, 12)"
    location="bottom"
     open-delay="120"
          close-delay="80"
          max-width="420"
          content-class="addressBox"
  >
    <template #activator="{ props }">
      <div class="addr-1line" v-bind="props">
        {{ clampTo12(item.facilityName) }}
      </div>
    </template>
  </v-tooltip>
</template>
    <template #no-data>
    </template>
  </v-data-table>
  </div>
</template>

<script setup lang="ts">
import { ref,computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Facilitylist } from '../composables/FacilityListSearch'
import { useGlobalLoading, type GlobalLoadingService } from '@/pages/Common/composables/GlobalLoading'
const { t } = useI18n()
const gl: GlobalLoadingService = useGlobalLoading()
const hasData = computed(() => Array.isArray(FacilityList) && FacilityList.length > 0)
type Align = 'start' | 'center' | 'end'
export interface HeaderItem {
  title: string
  key: string           
  sortable?: boolean
  align?: Align
  secondLine?: string | number | null
  headerProps?: Record<string, unknown>
}

const editDeleteSlot = 'item.editdelete' as const

const confirmDialog = defineModel<boolean>('confirmDialog', { required: true })
const selected = defineModel<Facilitylist[]>('selected', { required: true })

const {
  headers,
  FacilityList,
  limit,
  loading,              
  cancel,
  ok,
  edit,
  openConfirm,
  ascHandleClick,
  descHandleClick,
  getSecondLine
} = defineProps<{
  headers: ReadonlyArray<HeaderItem>
  FacilityList: Facilitylist[]
  limit: number
  loading: boolean
  cancel: () => void
  ok: () => Promise<unknown> | unknown
  edit: (item: Facilitylist) => void
  openConfirm: (item: Facilitylist) => Promise<unknown> | unknown
  ascHandleClick: (sortItemName: string) => Promise<unknown> | unknown
  descHandleClick: (sortItemName: string) => Promise<unknown> | unknown
  getSecondLine: (column: { secondLine?: string | number | null }) => string
}>()

const isBusy = ref(false)
const activeSortKey = ref<string | null>(null)
const activeSortOrder = ref<'asc' | 'desc' | null>(null)

function resetSort(){
  activeSortKey.value=null
  activeSortOrder.value=null
}

async function runWithGlobalLoading<T>(fn: () => Promise<T> | T, message = t('common.loading')): Promise<T | void> {
  if (isBusy.value) return
  isBusy.value = true
  gl.show(message ?? undefined)
  try {
    return await Promise.resolve(fn())
  } finally {
    gl.hide()
    isBusy.value = false
  }
}
function clampTo12(text?: string | null): string {
  if (!text) return '-'

  if ('Segmenter' in Intl) {
    const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    const chars = Array.from(seg.segment(text), s => s.segment)

    return chars.length > 12
      ? chars.slice(0, 12).join('') + '…'
      : text
  }

  const chars = [...text]
  return chars.length > 12
    ? chars.slice(0, 12).join('') + '…'
    : text
}

function isOver(text?: string | null, limit = 12): boolean {
  if (!text) return false
  if ('Segmenter' in Intl) {
    const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    return Array.from(seg.segment(text)).length > limit
  }
  return [...text].length > limit
}

async function handleAsc(key: string) {
  await runWithGlobalLoading(async () => {
    await ascHandleClick(key)
    activeSortKey.value = key
    activeSortOrder.value = 'asc'
  }, t('common.loading'))
}

async function handleDesc(key: string) {
  await runWithGlobalLoading(async () => {
    await descHandleClick(key)
    activeSortKey.value = key
    activeSortOrder.value = 'desc'
  }, t('common.loading'))
}
async function handleEdit(item: Facilitylist) {
  await runWithGlobalLoading(() => edit(item), t('common.loading'))
}

async function handleDelete(item: Facilitylist) {
  await runWithGlobalLoading(() => openConfirm(item), t('common.loading'))
}
async function handleOk() {
  await runWithGlobalLoading(() => ok(), t(''))
}
async function handleCancel() {
  await runWithGlobalLoading(() => cancel(), t('common.loading'))
}
defineExpose({ resetSort })
</script>
<style scoped>
:deep(.v-table__wrapper thead th) {
  background: #afd7b0 !important;
}
:deep(.pretty-table tbody td) { text-align: left !important; }
:deep(.pretty-table tbody tr) {
  font-family: 'Noto Sans JP';
  line-height: 20px;
}


:deep(.v-table__wrapper) {
  overflow-x: auto;
  border-color: #7f8883;
  border-collapse: collapse;
  border: 1px solid #e0e0e0;
  box-shadow:
    inset 0 0 0 2px #ffffff;
}
:deep(.v-table__wrapper table) {
  border: none;
  border-collapse: separate;
  border-spacing: 0;
  min-width: max-content;
  white-space: nowrap; 
}

:deep(.v-table__wrapper thead th:last-child),
:deep(.v-table__wrapper tbody td:last-child) { border-right: none; }

.hdr-2row-grid {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 32px;
  grid-template-rows: auto auto;
  align-items: center;
  column-gap: 0;
  row-gap: 0;
}
.hdr-text { justify-self: center; text-align: center; white-space: nowrap; }
.hdr-title { display: inline-block; font-weight: 600; line-height: 18px; }
.hdr-unit { display: inline-block; font-size: 14px; font-weight: 500; line-height: 16px; }
.hdr-unit--empty { visibility: hidden; }
.hdr-icon {
  justify-self: end;
  display: inline-flex;
  width: 32px;
  height: 20px;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.hdr-2row-grid--one-line .hdr-title { transform: translateY(10px); }
.hdr-2row-grid:not(.hdr-2row-grid--one-line) .hdr-title { transform: none; }

:deep(.v-data-table tbody tr.v-data-table__selected),
:deep(.v-data-table tbody tr[aria-selected='true']) { background-color: #d9e8ff !important; }

.table-area {
  position: relative;
}
.pop_pup {
  border-radius: 16px;
  min-width: 360px;
  top: 70%;
  left: 50%;
   transform: translate(-30%, -0%);
 
}

.pop_pup__text {
  color: #2b2b2b;
  font-size: 16px;
  line-height: 1.6;
  letter-spacing: .2px;
  padding: 20px 24px 8px;
  margin: 0 auto;
}

.pop_pup__actions {
  gap: 12px;
  padding: 12px 20px 20px;
}

.btn-cancel {
  --btn-bg: #9e9e9e;       
  --btn-bg-disabled: #bdbdbd;
  --btn-text: #ffffff;

  background-color: var(--btn-bg) !important;
  color: var(--btn-text) !important;
  font-weight: 500;
  border-radius: 4px;
  padding: 5px 9px;
  text-transform: none;     
  letter-spacing: .4px;
}


.btn-ok {
  font-weight: 500;
  border-radius: 4px;
  padding: 5px 5px;
  min-width: 70px;
  text-transform: none;
  letter-spacing: .4px;
  background-color: rgb(218,227,243);
}

.btn-cancel.v-btn--disabled {
  background-color: var(--btn-bg-disabled) !important;
}

.btn-cancel .v-btn__content,
.btn-ok .v-btn__content {
  min-width: 60px;
}

:deep(.v-overlay__content) {
  border-radius: 16px;
}


.sort-icon--active {
  color: #1976d2;
  opacity: 1;
  cursor: pointer;
  transition: color .15s ease, opacity .15s ease, transform .12s ease;
}
.sort-icon--inactive {
  color: var(--v-theme-on-surface);
  opacity: 0.35;
  cursor: pointer;
  pointer-events: auto;
  transition: color .15s ease, opacity .15s ease, transform .12s ease;
}
.hdr-icon .sort-icon--active:hover,
.hdr-icon .sort-icon--inactive:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}


.is-busy { pointer-events: none; opacity: .5; }

:deep(span.hdr-title) { padding-top: 5px; }
.hdr-2row-grid {
  row-gap: 0px;
  grid-template-columns: 1fr 30px;
}
.hdr-icon {
  width: 30px;
  height: 16px;
  align-items: center;
  justify-content: center;
}

.hdr-icon.line1 .sort-icon {
  margin-top: -px !important;
}

.hdr-icon.line2 .sort-icon {
  margin-top: -15px !important;
}

.hdr-2row-grid {
  row-gap: 0 !important;
}

.addr-1line {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

}

.is-disabled {
  pointer-events: none;
  opacity: .35;
  filter: grayscale(35%);
}

:deep(.addressBox) {
  background: #fff !important;
  color: #222;
  border: 1px solid #e5e7eb;
  box-shadow: 0 6px 24px rgba(0,0,0,.12);
  padding: 10px 12px;
  border-radius: 10px;
}


</style>