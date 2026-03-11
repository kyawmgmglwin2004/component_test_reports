<template>

<v-col cols="12" md="12" sm="12" class="mb-2"
       v-if="topErrorList && topErrorList.length">
  <v-alert
    v-for="(m, i) in topErrorList"
    :key="`top-${i}`"
    type="error"
    variant="tonal"
    density="compact"
    class="mb-2"
    @click="topErrorList = []"
  >
    {{ m }}  
  </v-alert>
</v-col>
  <div class="d-flex align-center mb-3">
    <v-row>
      <v-col cols="12" sm="10" md="6" lg="4">
        <label class="label">{{ t('title.searchkeyword') }}</label>
        <v-text-field
          v-model="keyword"
          density="compact"        
          variant="outlined"
          flat
          hide-details="auto" 
          single-line
          class="inputField w-100"
        />
      </v-col>
    </v-row>
  </div>
  <div>
    <v-row class="align-end">

      <v-col cols="12" sm="10" md="3" lg="2">
        <label class="label mb-2">{{ t('title.facilityType') }}</label>
        <v-select
          v-model="facilityType"
          :items="categoryItemsWithSelect"
          item-title="title"
          item-value="value"
          density="compact"
          placeholder="選択してください"
          variant="outlined"
          class="cap-right inputField w-100"
          data-test="category-fetch"
        />
      </v-col>

      <v-col cols="12" sm="10" md="3" lg="2">
        <label class="label mb-2">{{ t('title.facilityStatus') }}</label>
        <v-select
          v-model="facilityStatus"
          placeholder="選択してください。"
          :items="statusItemsWithSelect"
          item-title="title"
          item-value="value"
          density="compact"
          :clearable="false"
          variant="outlined"
          class="cap-right inputField w-100"
          data-test="status-fetch"
        />
      </v-col>
      <v-col cols="12" md="4" lg="5" class="mt-4 mt-md-0">
        <div class="d-flex  justify-start" style="gap: 22px;">
           
          <v-btn
            @click="handleSearch"
            class="searchbtn"
          >
            {{ t('common.search') }}
          </v-btn>
            
          <v-btn
            @click="handleCsvDownload"
            class="csvbtn"
            data-test="csv-download" 
          >
            {{ t('common.csvdownload') }}
          </v-btn>
        </div>
      </v-col>
    </v-row>
    <v-row justify="end">
      <div>
       
        <v-col cols="auto" class="label" style="margin-left: 25px;">
          {{ t('title.filterLength') }}: {{ filterlength }} 件
        </v-col>

        <v-pagination
          v-model="pageNumber"
          :length="totalPages"
          :show-first-last-page="false"
          class="only-prev-next short-pagination"
          :disabled="gl.open.value"
          @update:modelValue="handlePageChange"
        >
        
          <template #prev="{ onClick, disabled }">
            
            <v-btn
              variant="text"
              icon="mdi-chevron-double-left"
              :disabled="disabled || gl.open.value || pageNumber === 1"
              @click="goFirst"
              aria-label="First"
              style="width: 4px;"
            />
            <v-btn
              variant="text"
              icon="mdi-chevron-left"
              :disabled="disabled || gl.open.value"
              @click="onClick"
              aria-label="Previous"
              style="width: 2px;"
            />
            <p class="page-center">{{ pageNumber }} / {{ totalPages }}</p>
          </template>

        
          <template #next="{ onClick, disabled }">
          
            <v-btn
              variant="text"
              icon="mdi-chevron-right"
              :disabled="disabled || gl.open.value"
              @click="onClick"
              aria-label="Next"
              style="width: 4px;"
            />
           
            <v-btn
              variant="text"
              icon="mdi-chevron-double-right"
              :disabled="disabled || gl.open.value || pageNumber === totalPages"
              @click="goLast"
              aria-label="Last"
              style="margin-left: 2px; width: 2px;"
            />
          </template>
         
          <template #item />
        </v-pagination>
      </div>
    </v-row>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed ,watch} from 'vue'
import  {type facilityCategory, type fcilityStatus, topErrorList} from '../composables/FacilityListSearch'
import { useGlobalLoading, type GlobalLoadingService } from '@/pages/Common/composables/GlobalLoading'
const { t } = useI18n()
const keyword = defineModel<string>('keyword', { required: true })
const facilityType = defineModel<string | null>('facilityType', { required: true })
const facilityStatus = defineModel<string | null>('facilityStatus', { required: true })
const pageNumber = defineModel<number>('pageNumber', { required: true })
const selected = defineModel<(string | number)[]>()

const props = defineProps<{
  CategoryItems: facilityCategory[]
  StatusItems: fcilityStatus[]
  errorMessage: string
  filterlength: number
  totalPages: number
  search: () => Promise<unknown> | unknown
  csvdownload: () => Promise<unknown> | unknown
  clearError: () => void
  keyclearError: () => void
  onPageChange: (p: number) => Promise<unknown> | unknown
  isLoading?: boolean
}>()

const gl: GlobalLoadingService = useGlobalLoading() 
const categoryItemsWithSelect = computed(() => [
  { title: '選択してください', value: null },
  ...(props.CategoryItems ?? []),
])

const statusItemsWithSelect = computed(() => [
  { title: '選択してください', value: null },
  ...(props.StatusItems ?? []),
])

const handleSearch = async () => {
  if (gl.open.value) return 
  gl.show( undefined)
  try {
    await props.search()
  } finally {
    gl.hide()
    selected.value = []   
  }
}


const handleCsvDownload = async () => {
  if (gl.open.value) return 
  gl.show( undefined)
  try {
    await props.csvdownload()
  } finally {
    gl.hide()
  }
}


function goFirst() {
  if (gl.open.value) return
  if (pageNumber.value !== 1) {
    pageNumber.value = 1
    handlePageChange(1)
  }
}


function goLast() {
  if (gl.open.value) return
  const last = Math.max(1, Number(props.totalPages) || 1)
  if (pageNumber.value !== last) {
    pageNumber.value = last
    handlePageChange(last)
  }
}


const handlePageChange = async (p: number) => {
  gl.show(t('') ?? undefined)
  try {
    await props.onPageChange(p)
  } finally {
    gl.hide()
  }
}

watch(keyword, (v) => {
  const len = (v ?? '').length
  if (len > 40) {
    const msg = t('error.E0002', ['キーワード検索項目', 40, '文字'])
    if (!topErrorList.value.includes(msg)) {
      topErrorList.value = [msg]
    }
  } else {
    topErrorList.value = []
  }
}, { immediate: true })

</script>

<style scoped>

.error-box{
  background-color: #FFF1F0;
  color:#D82830;
  max-height: 40px;
  margin-top: 10px;
  border-radius: 4px;
}


.errorMessage{
  font-size: 14px;
  font-weight: 300;
  padding-bottom: 8px;
  padding-top: 8px;
  line-height: 1.425;
}


.clearbtn{
  font-size: 1rem;
  width: 1.75rem;
  height: 1.75rem;
}
.label{
  font-size: 0.875rem;
  font-weight: 400;
  font-family: 'Noto Sans JP';
  
}
.length{
   font-size: 0.875rem;
  font-weight: 400;
  font-family: 'Noto Sans JP';
 
}

.searchbtn{
  font-size: 16px;
  font-family: 'Noto Sans JP';
  max-width: 110px;
  max-height: 46px;
  background-color: #16a34a;
  color: white;
}

.csvbtn{
  font-size: 16px;
  font-family: 'Noto Sans JP';
  max-width: 150px;
  max-height: 46px;
  background-color: #16a34a;
  color: white;
}
.inputField{
  font-size: 16px;
  font-weight: 300;
  font-family: 'Noto Sans JP';
  height: 40px;
}

.pager-row {
  align-items: center;
  position: relative;
  display: flex;
  justify-content: flex-end;
  gap: 2px;
  white-space: nowrap;
}

.only-prev-next :deep(.v-pagination__list) { justify-content:flex-end; }
.only-prev-next :deep(.v-pagination__prev),
.only-prev-next :deep(.v-pagination__next) { display: inline-flex; }

:deep(.short-pagination  .v-btn) {
  min-width: 28px !important;
  height: 28px !important;
  padding: 0 !important;
  font-size: 12px !important;
  background-color: white !important;
}
:deep(.short-pagination .v-btn__content) { padding: 0 !important; }
:deep(.short-pagination .v-pagination__prev),
:deep(.short-pagination .v-pagination__next) { margin: 0 !important; }

:deep(.cap-right .v-field__append-inner) {
  margin-right: -12px;
  padding-right: 0 !important;
  padding-left: 0 !important;
  background-color:rgb(217,217,217);
  display: inline-flex;
  align-items: stretch;
  height: 40px;
}
:deep(.cap-right .v-field__append-inner .v-icon) {
  padding: 12px 10px;
  color: #333;
  margin-top: 8px;
  font-size: 30px !important;
}
:deep(.cap-right .v-field) { border-radius: 1px; }

:deep(.page-center) {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  font-weight: 400;
  font-family: 'Noto Sans JP';
}

:deep(.v-col.v-col-auto.label) { padding: 0 !important; }
</style>