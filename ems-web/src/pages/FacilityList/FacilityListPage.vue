FacilityListPage.vue
<template>
   <p class="title mb-6" style="margin-left: 15px; margin-top: 10px;">{{ t('title.facilityList') }}</p>
  <v-container  class="list-page">
    <div class="page-wrap">
      <v-card class="main-card" elevation="2">
        <v-card-text class="pa-6">
          <facilitysearchbar
            v-model:keyword="keyword"
            v-model:facilityType="facilityType"
            v-model:facilityStatus="facilityStatus"
            v-model:pageNumber="pageNumber"
            :CategoryItems="CategoryItems"
            :StatusItems="StatusItems"
            :errorMessage="errorMessage"
            :is-loading="isloading"
            :filterlength="filterlength"
            :totalPages="totalPages"
            :search="onSearch"
            :csvdownload="csvDownload"
            :clearError="clearError"
            :keyclearError="keyclearError"
            :onPageChange="onPageChange"
          />
          <div class="mt-8">
            <facilityListtable
              ref="tblRef"
              v-model:selected="selected"
              v-model:confirmDialog="confirmDialog"
              :headers="headers"
              :FacilityList="FacilityList"
              :limit="limit"
              :loading="loading"
              :cancel="cancel"
              :ok="ok"
              :edit="edit"
              :openConfirm="openConfirm"
              :ascHandleClick="ascHandleClick"
              :descHandleClick="descHandleClick"
              :getSecondLine="getSecondLine"
            />
          </div>
        </v-card-text>
      </v-card>
    </div>
  </v-container>
</template>

<script setup lang="ts">
import facilitysearchbar from './components/FacilitySearchbar.vue'
import facilityListtable from './components/FacilityListTable.vue'
import { useFacilityListSearch } from './composables/FacilityListSearch'
import { useFacilityListPage } from './FacilityListPage'
import { onMounted ,ref} from 'vue'
const page = useFacilityListPage()
const fetch = useFacilityListSearch()

const tblRef = ref<InstanceType<typeof facilityListtable> | null>(null)

const {
  fetchInitial,
  
  CategoryItems,
  StatusItems,

}=fetch
const {
  t,
  FacilityList,
  pageNumber,
  limit,
  totalPages,
  loading,
  filterlength,
  facilityType,
  facilityStatus,
  keyword,
  search,
  keyclearError,
  getSecondLine,
  errorMessage,
  isloading,
  confirmDialog,
  selected,
  clearError,
  csvDownload,
  onPageChange,
  descHandleClick,
  ascHandleClick,
  openConfirm,
  cancel,
  ok,
  headers,
  edit,
} = page

async function onSearch(){
  await search()
  tblRef.value?.resetSort()
}
onMounted(fetchInitial)

</script>

<style scoped>

.v-container{
    max-width: unset !important;
}
@media (min-width: 1600px){
.list-page {
  padding-left: 10px;
}
}

.list-page {
  padding-left: 0 !important;
  padding-right: 0 !important;
  
}


.main-card {
  width: 79%;  
  border-radius: 17px;            
  padding-left: 10px;
  padding-right: 10px;
  backdrop-filter: blur(4px);
  opacity: .9;
  box-shadow: 0px 4px 50px 20px rgba(0, 0, 0, 0.1) !important;
}
  .main-card {
    width: 88%;
  margin: 0 auto !important;
  }


.title {
   font-size: 1.25rem !important;
    font-weight: 500;
    line-height: 1.6;
    letter-spacing: 0.0125em !important;
    font-family: "Roboto", sans-serif;
}
</style>