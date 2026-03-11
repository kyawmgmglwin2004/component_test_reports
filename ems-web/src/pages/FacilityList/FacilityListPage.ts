
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useFacilityListSearch, type Facilitylist } from './composables/FacilityListSearch'
import { useFacilityListTable } from './composables/FacilityListTable'

export type FacilityListHeader = {
  title: string
  key: string
  sortable?: boolean
  align?: 'start' | 'center' | 'end'
  headerProps?: Record<string, unknown>
  secondLine?: string
}

export function useFacilityListPage() {
  const router = useRouter()
  const { t, locale } = useI18n()
  const searchState = useFacilityListSearch()
  const {
    CategoryItems,    
    StatusItems,     
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
  } = searchState

  const tableState = useFacilityListTable(searchState)
  const {
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
  } = tableState

  const headers = computed<FacilityListHeader[]>(() => [
    { title: t('facilityList.select'), key: 'data-table-select', sortable: false, align: 'center' },
    { title: t('facilityList.facilityType'), key: 'facilityType',  align: 'start', headerProps: { class: 'icons-' } },
    { title: t('facilityList.facilityID'), key: 'facilityID',  sortable: true, align: 'start' },
    { title: t('facilityList.facilityName'), key: 'facilityName',  sortable: true, align: 'start' },
    { title: t('facilityList.facilityAddress'),key: 'facilityAddress',  sortable: true, align: 'start' },
    { title: t('facilityList.deviceCount'), key: 'deviceCount',  sortable: true, align: 'start' },
    { title: t('facilityList.status'), key: 'facilityStatus',  sortable: true, align: 'start' },
    {
      title: t('facilityList.measuredTime'),
      key: 'measuredTime',
      sortable: true,
      secondLine: '(mm/dd hh:mm～hh:mm)',  
      align: 'center'
    },
    {
      title: t('facilityList.generatedEnergy'),
      key: 'generatedEnergy',
      sortable: true,
      secondLine: '(kWh)',               
      align: 'center'
    },
    {
      title: t('facilityList.soldEnergy'),
      key: 'soldEnergy',
      sortable: true,
      secondLine: '(kWh)',                
      align: 'center'
    },
    {
      title: t('facilityList.boughtEnergy'),
      key: 'boughtEnergy',
      sortable: true,
      secondLine: '(kWh)',              
      align: 'center'
    },
    { title: t('facilityList.editDelete'),  key: 'editdelete',   sortable: false, align: 'end' },
  ])

  const editform = ref('')

  function edit(item: Facilitylist) {
    editform.value = item.facilityID
    router.push({
      name: 'facility-edit',
      params: { facilityID: String(item.facilityID) }, 
    })
  }

  return {
    t,
    locale,
    CategoryItems,
    StatusItems,
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
    edit,
    headers,
  }
}
