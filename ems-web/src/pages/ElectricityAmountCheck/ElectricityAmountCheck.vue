
<template>
    <GlobalLoading/>
    <NotFoundScreen />
  <div class="bg" :style="bgStyle(echeck?.facilityImage)" >
  <div v-if="topErrorList.length" class="mb-4">
  <v-alert
    v-for="(m, i) in topErrorList"
    :key="i"
    type="error"
    variant="tonal"
    density="compact"
    class="mb-2"
    @click="topErrorList = []"
  >
    {{ m }}
  </v-alert>
  </div> 

    <!-- ======= 施設名・計測日時のトップバー ======= -->
    <v-row mb-4 mb-lg-16 class="topbar d-flex justify-space-between">
      <!-- 施設名 -->
      <v-col cols="12" sm="6" lg="4" >
        <v-row dense class="align-center">
          <div class="echeck-label me-2">{{ t('facility.facilityName') }} :</div>
         <p class="textcol">
            {{ (echeck?.facilityName ?? '').trim() || t('eamountcheck.noData') }}
        </p>
        </v-row>
      </v-col>

      <!-- 計測時間 -->
      <v-col cols="12" sm="6" lg="4">
        <v-row dense class="align-center">
          <div class="echeck-label me-2">{{ t('eamountcheck.measuredTime') }} :</div>
          <p class="textcol">
            {{ (echeck?.measuredTime ?? '').trim() || t('eamountcheck.noData') }}
          </p>
        </v-row>
      </v-col>
    </v-row>

    <!-- ======= 市区町村 / 住所 ======= -->
    <v-row class="midbar">
      <v-col cols="12" sm="6">
        <v-row dense class="align-center">
          <div class="echeck-label mw-2">{{ t('eamountcheck.cityInfo') }} :</div>
          <p class="textcol">
            {{ (echeck?.cityInfo ?? '').trim() || t('eamountcheck.noData') }}
          </p>
        </v-row>
      </v-col>
    </v-row>

    <!-- ======= タイル群 ======= -->
    <section class="section">
      <v-row class="my-3" align="center">
      </v-row>
      <v-row class="total-gen g-0 align-stretch box ">
      <v-col cols="6" sm="5" class="pa-0">
        <div class="left-box">
          <strong>{{ t('eamountcheck.totalGeneration') }}</strong>
        </div>
      </v-col>
      <v-col cols="6" sm="7" class="pa-0">
        <div class="right-box">  
          <span class="right-input">
            {{ echeck?.totalGeneration ? `${echeck.totalGeneration} kWh` : t('eamountcheck.noData') }}
          </span>
        </div>
      </v-col>
    </v-row>
      <v-row class="my-5" align="center">
      </v-row>

      <div class="con">
        <v-row>
          <!-- 1行目 -->
          <v-col cols="6" sm="12" class="">
            <v-row class="firstrow">
              <v-col cols="12" sm="4" class="pa-1">
                <div class="theader">{{ t('eamountcheck.currentGeneration') }}</div>
                <div class="title-value">
                  <p class="center-input">
                    {{ fmt3(echeck?.currentGeneration ?? null) }}
                  </p>
                </div>
              </v-col>

              <v-col cols="12" sm="4" class="pa-1">
                <div class="theader">{{ t('eamountcheck.currentSelfUsage') }}</div>
                <div class="title-value">
                  <p class="center-input">
                    {{ fmt3(echeck?.currentSelfUsage ?? null) }}
                  </p>
                </div>
              </v-col>

              <v-col cols="12" sm="4" class="pa-1">
                <div class="theader">{{ t('eamountcheck.currentUsage') }}</div>
                <div class="title-value">
                  <p class="center-input">
                    {{ fmt3(echeck?.currentUsage ?? null) }}
                  </p>
                </div>
              </v-col>
            </v-row>
          </v-col>

          <!-- 2行目 -->
          <v-col cols="6" sm="12" class="">
            <v-row class="secrow">
              <v-col cols="12" sm="4" class="pa-1">
                <div class="theader">{{ t('eamountcheck.todayTotalGeneration') }}</div>
                <div class="title-value">
                  <p class="center-input">
                    {{ fmt3(echeck?.todayTotalGeneration ?? null) }}
                  </p>
                </div>
              </v-col>

              <v-col cols="12" sm="4" class="pa-1">
                <div class="theader">{{ t('eamountcheck.todayTotalSelfUsage') }}</div>
                <div class="title-value">
                <p class="center-input">
                  {{ fmt3(echeck?.todayTotalSelfUsage ?? null) }}
                </p>
                </div>
              </v-col>

              <v-col cols="12" sm="4" class="pa-1">
                <div class="theader">{{ t('eamountcheck.todayTotalUsage') }}</div>
                <div class="title-value">
                  <p class="center-input">
                  {{ fmt3(echeck?.todayTotalUsage ?? null) }}
                  </p>
                </div>
              </v-col>
            </v-row>
          </v-col>
        </v-row>
      </div>


    </section>
          <!-- 詳細チャートへ遷移ボタン -->
      <div class="btn-container pt-4 px-3">
        <v-btn class="button" :loading="clickLoading" :disabled="clickLoading || !isValidFacilityId" :color="isValidFacilityId ? '#C55A11' : 'grey'" @click="goToDetailChart">
          {{ t('common.goToDetailChart') }}
        </v-btn>
      </div>

  </div>
</template>


<script setup lang="ts">
import GlobalLoading from '../Common/components/GlobalLoading.vue';
import { useEcheckDashboard } from './ElectricityAmountCheck'
import NotFoundScreen from '@/pages/Common/components/NotFoundScreen.vue'

const { t, echeck,clickLoading, bgStyle, goToDetailChart,topErrorList,isValidFacilityId, fmt3 } = useEcheckDashboard()

defineExpose({ goToDetailChart })
</script>



<style>
*{
  font-family: "Noto Sans JP", sans-serif;
}



.bg {
  width: 100%;
  background-size: cover;
  background-position: top center;
  overflow-y: hidden;
  padding-bottom: 30px;
}


 .topbar{
  border-bottom: 2px solid #3b82f6;
  padding-top: 0;
  padding-left: 20px;
  background-color: white;
  opacity: 0.9;
  margin-top: 0px !important;
}


.midbar{
  padding-left: 20px;
  background-color: white;
  opacity: 0.9;
}
.textcol  {
  font-size: 1.1rem;
  color: #1976d2;
  font-weight: bold;
  padding-top: 0 !important;
}

 .right-input {
  text-align: right !important;
  font-weight: bold;
  color: aqua;
}

.section{
  width: 75%;
  margin: 0 auto
}
 .con{
  margin-top: 20px;
  padding-left: 0px;

}

.box{
  width: 64%;
  margin-left: 0px;  
  margin-right: 0;

}

 .btn-container {
  display: flex;
  justify-content:flex-end; 
  align-items: flex-end; 
}
 .button {
  font-size: 1rem;
  position: relative; 
}
 .echeck-label {
   white-space: nowrap;
  color: #1976d2;
  font-weight: bold;
  font-size: 1.12rem;
  margin-right: 12px;
  line-height: 38px;

}

.left-box,
.right-box {
  font-size: 1rem;
  height: 55px;          
  display: flex;
  justify-content: flex-end;
  align-items: center;         
  padding: 12px 16px;          
  border: 1px solid #2f3f50; 
  
}
.v-input--density-compact {
  --v-input-padding-top: 0px; 
}
 .left-box  { background-color: #a9a9a9; color: #fff; white-space: nowrap;text-align: center;}
 .right-box { background-color: #333;    color: #fff; text-align: center; }


.left-box .v-field {
  text-align: center !important;
}
 
 .center-input {
  text-align: center !important;
  color: #D82830;
  font-weight: bold;
}


 .theader{
  background: rgba(128, 134, 137, 1);
  border: 1px solid rgba(90, 100, 110, 0.35);
  color: white;
  padding: 10px;
  text-align: center;
  font-weight: bolder;
  font-size: 1rem;
}
.title-value{
  background-color: rgba(255, 255, 255, 1);
  font-size: 1rem;
  color: orangered;
  border: 1px solid rgba(90, 100, 110, 0.35);
  padding: 12px 16px;          
  height: 55px;
  display: flex;
  justify-content: center;
  align-items: center;    
}

.title-value .v-field {
  --v-input-control-height: 50px;
}
@media (min-width: 1280px){
  .firstrow{ margin-bottom: 0px; margin-top: 0px;}
  .btn-container { margin-top: 0px;}

}
@media (min-width: 700px) and (max-width: 900px) {
  .section { height: 100%; margin-top: 60px }
  .box     { height: 100%; }
  .topbar, .midbar { padding-left: 12px; }
  .con { margin-top: 60px; }
  .firstrow{ margin-bottom: 40px;}
  .btn-container { margin-top: 70px;}
  .theader{ height: 10cqw; padding: 10px; display: flex;justify-content: center;  align-items: center;
}
  .title-value{ height: 120px;}
  .left-box, .right-box{height: 100px;}

}

@media (max-width: 600px) {
  .btn-container {
    justify-content: center;  
    align-items: flex-end;    
    padding: 16px;            
    margin: auto;
  }
  .box{
  width: 100%;
  margin-left: 0px;  
  margin-right: 0;

}
}
@media (min-width: 1900px) {
  .echeck-label, .textcol{
    font-size: 1.3rem;
   
  }
  
 
  .left-box,
  .theader,
  .right-input,
  .center-input {
    font-size: 1rem;
  }


  .total-gen{
    margin-bottom: 64px;
  }

  .midbar{
    margin-bottom: 64px;
  }
  .firstrow{
    margin-bottom: 64px;
  }
  .secrow{
    margin-bottom: 64px;
  }
}
</style>