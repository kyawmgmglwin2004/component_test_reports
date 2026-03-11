<template>
  <!-- 背景レイヤー -->
  <div class="page-bg" :style="pageBgStyle"></div>

  <!-- 前面コンテンツ -->
  <div class="page-content">
    <v-card-title class="text-h6">{{ t('title.facilityEdit') }}</v-card-title>
    <v-container class="py-8">
      <v-card elevation="2">
        <v-card-text>
          <v-alert v-if="msg" type="success" class="mb-4" density="compact" variant="tonal">
            {{ msg }}
          </v-alert>

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

          <!-- 送信フォーム -->
          <v-form ref="formRef"  autocomplete="off" @submit.prevent="() => onSubmit(() => formRef?.validate?.())"
            @reset.prevent="onCancel">

            <!-- カテゴリ -->
            <v-row class="select-box">
              <v-col cols="12" md="5" class="d-flex align-center">
                <span class="mr-1">{{ t('facility.facilityType') }}</span>
              </v-col>
              <v-col cols="12" md="7">
                <v-select
                  v-model="formData.facilityTypeSelected"
                  :items="CategoryItems"
                  item-title="title"
                  item-value="value"
                  variant="outlined"
                  density="comfortable"
                  hide-details="auto"
                  data-test="facilityTypeSelected"
                  @update:modelValue="(v) => { formData.facilityTypeSelected = String(v); clearServerError('facilityTypeSelected');clearFacilityImage(); }"
                />
              </v-col>
            </v-row>

            <!-- 設備ID -->
            <v-row>
              <v-col cols="12" md="5" class="d-flex align-center">
                <span class="mr-1">{{ t('facility.facilityID') }}</span>
              </v-col>
              <v-col cols="12" md="7">
                <v-text-field
                  v-model="formData.facilityID"
                  :maxlength="6"
                  variant="outlined"
                  prepend-inner-icon="mdi-account"
                  disabled
                  data-test="facilityID"
                />
              </v-col>
            </v-row>

            <!-- ecoめがね会社ID -->
            <v-row>
              <v-col cols="12" md="5" class="d-flex align-center">
                <span class="mr-1">{{ t('facility.ecoCompanyID') }}</span>
                <span class="text-red">*</span>
              </v-col>
              <v-col cols="12" md="7">
                <v-text-field
                  v-model="formData.ecoCompanyID"
                  :maxlength="8"
                  :rules="rules.ecoCompanyID"
                  variant="outlined"
                  prepend-inner-icon="mdi-account"
                  data-test="ecoCompanyID"
                  autocomplete="section-edit eco-company-id"
                  @update:modelValue="(v: string) => { pending.ecoCompanyID = v }"
                />
              </v-col>
            </v-row>

            <!-- ecoめがね会社パスワード -->
            <v-row>
              <v-col cols="12" md="5" class="d-flex align-center">
                <span class="mr-1">{{ t('facility.ecoCompanyPassword') }}</span>
                <span class="text-red">*</span>
              </v-col>
              <v-col cols="12" md="7">
                <v-text-field
                  v-model="formData.ecoCompanyPassword"
                  :rules="rules.ecoCompanyPassword"
                  :maxlength="16"
                  variant="outlined"
                  prepend-inner-icon="mdi-account"
                  :type="showEcoPwd ? 'text' : 'password'"
                  data-test="ecoCompanyPassword"
                  autocapitalize="off"
                  autocorrect="off"
                  autocomplete="section-edit new-password"
                  spellcheck="false"
                  @update:modelValue="() => clearServerError('ecoCompanyPassword')"
                >
                  <template #append-inner>
                    <v-btn
                      :icon="showEcoPwd ? 'mdi-eye-off' : 'mdi-eye'"
                      variant="text"
                      density="compact"
                      @click="showEcoPwd = !showEcoPwd"
                    />
                  </template>
                </v-text-field>
              </v-col>
            </v-row>
            <!-- 設備名 -->
            <v-row>
              <v-col cols="12" md="5" class="d-flex align-center">
                <span class="mr-1">{{ t('facility.facilityName') }}</span>
                <span class="text-red">*</span>
              </v-col>
              <v-col cols="12" md="7">
                <v-text-field
                  v-model="formData.facilityName"
                  :maxlength="30"
                  :rules="rules.facilityName"
                  variant="outlined"
                  prepend-inner-icon="mdi-account"
                  data-test="facilityName"
                  @update:modelValue="() => clearServerError('facilityName')"
                />
              </v-col>
            </v-row>

            <!-- 所在地 -->
            <v-row>
              <v-col cols="12" md="5" class="d-flex align-center">
                <span class="mr-1">{{ t('facility.facilityAddress') }}</span>
                <span class="text-red">*</span>
              </v-col>
              <v-col cols="12" md="7">
                <v-text-field
                  v-model="formData.facilityAddress"
                  :rules="rules.facilityAddress"
                  :maxlength="40"
                  variant="outlined"
                  prepend-inner-icon="mdi-account"
                  data-test="facilityAddress"
                  @update:modelValue="() => clearServerError('facilityAddress')"
                />
              </v-col>
            </v-row>

            <!-- 市区町村情報 -->
            <v-row>
              <v-col cols="12" md="5" class="d-flex align-center">
                <span class="mr-1">{{ t('facility.cityInformation') }}</span>
                <span class="text-red">*</span>
              </v-col>
              <v-col cols="12" md="7">
                <v-text-field
                  v-model="formData.cityInformation"
                  :maxlength="50"
                  :rules="rules.cityInformation"
                  variant="outlined"
                  prepend-inner-icon="mdi-account"
                  data-test="cityInformation"
                  @update:modelValue="() => clearServerError('cityInformation')"
                />
              </v-col>
            </v-row>

            <!-- 設備画像 -->
            <v-row class="select-image">
              <v-col cols="12" md="5" class="d-flex align-center">
                <span class="mr-1">{{ t('facility.imageFilename') }}</span>
                <span class="text-red">*</span>
              </v-col>

              <v-col cols="12" md="7">
                <!-- displayName を表示し、relativePath をバリデーション対象とする -->
                <v-text-field
                  :key="imageFieldKey"
                  v-model="formData.facilityImage.displayName"
                  :rules="rules.imageFilename"
                  variant="outlined"
                  prepend-inner-icon="mdi-image"
                  hide-details="auto"
                  density="comfortable"
                  readonly
                  data-test="imageFilename"
                >
                  <template #append-inner>
                    <v-btn
                      icon
                      variant="text"
                      size="small"
                      aria-label="画像選択"
                      class="cursor-pointer"
                      @click="onOpenImage"
                    >
                      <v-icon size="28" color="#4CAF50">mdi-image</v-icon>
                    </v-btn>
                  </template>
                </v-text-field>
              </v-col>
            </v-row>

            <!-- 共有モーダル（フォトアップロード） -->
            <PhotoUploadModal
              v-model="photoDialog"
              :title="`${t('facility.selectImage')}`"
              :closeText="t('common.close')"
              :loading="photoLoading"
              :error="photoError"
              :images="photoImages"
              :selectedSrc="selectedSrcForModal"
              @select="onSelectFromModal"
            />

            <!-- 設備ステータス -->
            <v-row class="select-box">
              <v-col cols="12" md="5" class="d-flex align-center">
                <span class="mr-1">{{ t('facility.facilityStatus') }}</span>
              </v-col>
              <v-col cols="12" md="7">
                <v-select
                  v-model="formData.facilityStatusSelected"
                  :items="StatusItems"
                  prepend-inner-icon="mdi-format-list-bulleted"
                  variant="outlined"
                  density="comfortable"
                  hide-details="auto"
                  data-test="facilityStatusSelected"
                  @update:modelValue="(v) => { formData.facilityStatusSelected = String(v); clearServerError('facilityStatusSelected') }"
                />
              </v-col>
            </v-row>

            <!-- 管理者名 -->
            <v-row>
              <v-col cols="12" md="5" class="d-flex align-center">
                <span class="mr-1">{{ t('facility.facilityManagerName') }}</span>
              </v-col>
              <v-col cols="12" md="7">
                <v-text-field
                  v-model="formData.facilityManagerName"
                  :maxlength="20"
                  :rules="rules.managerName"
                  variant="outlined"
                  prepend-inner-icon="mdi-account"
                  data-test="facilityManagerName"
                  @update:modelValue="() => clearServerError('facilityManagerName')"
                />
              </v-col>
            </v-row>

            <!-- 管理者連絡先 -->
            <v-row>
              <v-col cols="12" md="5" class="d-flex align-center">
                <span class="mr-1">{{ t('facility.facilityManagerContact') }}</span>
              </v-col>
              <v-col cols="12" md="7">
                <v-text-field
                  v-model="formData.facilityManagerContact"
                  :maxlength="254"
                  :rules="rules.managerContact"
                  variant="outlined"
                  prepend-inner-icon="mdi-account"
                  data-test="facilityManagerContact"
                  @update:modelValue="() => clearServerError('facilityManagerContact')"
                />
              </v-col>
            </v-row>

            <input type="hidden" v-model="formData.updatedAt" name="updatedAt" />

            <!-- ボタン -->
            <div class="d-flex gap-2 mt-4 btn-position">
              <v-btn type="reset" variant="tonal" :disabled="pageLoading" width="110" data-test="cancelButton">
                {{ t('common.editCancel') }}
              </v-btn>
              <v-btn
                type="submit"
                class="btn-action"
                width="110"
                :loading="pageLoading"
                :disabled="pageLoading"
                data-test="editButton"
              >
                {{ t('common.update') }}
              </v-btn>
            </div>

            <!-- 確認ダイアログ（設備ID + 商品ID 未入力） -->
            <v-dialog v-model="confirmOpen" max-width="360" persistent>
              <v-card class="confirm-card">
                <v-card-text class="text-body-2">
                  <div>{{ t('popUp.setDeviceID') }}</div>
                  <div>{{ t('popUp.setProductID') }}</div>
                </v-card-text>
                <v-card-actions class="justify-center">
                  <v-btn
                    variant="flat"
                    color="grey"
                    class="mr-2"
                    @click="confirmOpen = false"
                  >
                    {{ t('common.cancel') }}
                  </v-btn>

                  <v-btn
                    variant="flat"
                    :style="{ backgroundColor: 'rgb(218,227,243)', color: '#000' }"
                    @click="onConfirm"
                  >
                    {{ t('common.OK') }}
                  </v-btn>
                </v-card-actions>
              </v-card>
            </v-dialog>                  
          </v-form>
        </v-card-text>

        <!-- デバイステーブル -->
        <div class="table-wrap">
          <div class="tableWrapper d-flex justify-space-between align-center mb-4">
            <div class="detailDeviceInfo">
              <span class="mr-1">{{ t('common.detailDeviceInfo') }}</span>
            </div>
            <div class="d-flex gap-2 mt-4 btn-position addOrDeleteDevice">
              <button
                type="button"
                class="btn btn-action addDevice"
                :loading="pageLoading"
                :disabled="pageLoading"
                data-test="addDeviceButton"
                @click.prevent="openConfirm"
              >
                {{ t('common.addDevice') }}
              </button>
              <button
                type="button"
                class="btn btn-action deleteDevice"
                variant="tonal"
                @click="openBulkDeleteConfirm"
                :disabled="pageLoading || !canDeleteSelectedDevices"
                data-test="deleteDeviceButton"
              >
                {{ t('common.deleteDevice') }}
            </button>
            </div>
          </div>

          <!-- 一括削除確認ダイアログ -->
          <v-dialog v-model="bulkDeleteConfirmOpen" max-width="360" persistent>
            <v-card class="confirm-card">
              <v-card-text class="text-body-2 text-center">
                {{ t('popUp.deleteConfirm1') }}<br>
                {{ t('popUp.deleteConfirm2') }}
              </v-card-text>

              <v-card-actions class="justify-center">
                <v-btn
                  variant="flat"
                  color="grey"
                  class="mr-2"
                  @click="bulkDeleteConfirmOpen = false"
                >
                  {{ t('common.cancel') }}
                </v-btn>

                <v-btn
                  variant="flat"
                  :style="{ backgroundColor: 'rgb(218,227,243)', color: '#000' }"
                  :disabled="!canDeleteSelectedDevices || deletingNow"
                  :loading="deletingNow"
                  @click="onConfirmBulkDelete"
                >
                  {{ t('common.OK') }}
                </v-btn>
              </v-card-actions>
            </v-card>
          </v-dialog>

          <!-- エラーアラート群（各種操作用） -->
          <v-alert
            v-for="(m, i) in equipmentCreateErrorList"
            :key="i"
            type="error"
            variant="tonal"
            density="compact"
            class="mb-2"
            @click="equipmentCreateErrorList = []"
          >
            {{ m }}
          </v-alert>
          <v-alert
            v-for="(m, i) in deviceIDErrorList"
            :key="i"
            type="error"
            variant="tonal"
            density="compact"
            class="mb-2"
            @click="deviceIDErrorList = []"
          >
            {{ m }}
          </v-alert>
          <v-alert
            v-for="(m, i) in productIDErrorList"
            :key="i"
            type="error"
            variant="tonal"
            density="compact"
            class="mb-2"
            @click="productIDErrorList = []"
          >
            {{ m }}
          </v-alert>
          <v-alert
            v-for="(m, i) in deviceDeleteErrorList"
            :key="i"
            type="error"
            variant="tonal"
            density="compact"
            class="mb-2"
            @click="deviceDeleteErrorList = []"
          >
            {{ m }}
          </v-alert>
          <!-- <v-alert
            v-for="(m, i) in addPanelErrorList"
            :key="i"
            type="error"
            variant="tonal"
            density="compact"
            class="mb-2"
            @click="addPanelErrorList = []"
          >
            {{ m }}
          </v-alert>
          <v-alert
            v-for="(m, i) in addPcsErrorList"
            :key="i"
            type="error"
            variant="tonal"
            density="compact"
            class="mb-2"
            @click="addPcsErrorList = []"
          >
            {{ m }}
          </v-alert>
          <v-alert
            v-for="(m, i) in panelsBulkDeleteErrorList"
            :key="i"
            type="error"
            variant="tonal"
            density="compact"
            class="mb-2"
            @click="panelsBulkDeleteErrorList = []"
          >
            {{ m }}
          </v-alert>
          <v-alert
            v-for="(m, i) in pcsBulkDeleteErrorList"
            :key="i"
            type="error"
            variant="tonal"
            density="compact"
            class="mb-2"
            @click="pcsBulkDeleteErrorList = []"
          >
            {{ m }}
          </v-alert> -->
          <v-alert
            v-for="(m, i) in tableSuccessList"
            :key="'succ-' + i"
            type="success"
            variant="tonal"
            density="compact"
            class="mb-2"
            @click="tableSuccessList = []"
          >
            {{ m }}
          </v-alert>
          <v-alert
            v-for="(m, i) in inlineRowErrorList"
            :key="'rowerr-' + i"
            type="error"
            variant="tonal"
            density="compact"
            class="mb-2"
            @click="clearRowErrors()"
          >
            {{ m }}
          </v-alert>
          <!-- テーブル本体 -->
          <table class="seven-col-table">
            <thead>
              <tr>
                <th v-for="(col, idx) in columns" :key="idx">{{ col.label }}</th>
              </tr>
            </thead>

            <tbody>
              <tr v-if="tableLoadingLocal">
                <td :colspan="columns.length" class="text-center text-medium-emphasis">{{ t('common.loading') }}</td>
              </tr>

              <tr v-else-if="!deviceRows || deviceRows.length === 0">
                <td :colspan="columns.length" class="text-center text-medium-emphasis">{{ t('message.noDevice') }}</td>
              </tr>

              <!-- 行描画 -->
              <tr v-else v-for="r in deviceRows" :key="r.deviceNumber">

                <!-- 行選択（チェックボックス） -->
                <td class="col-select">
                  <label class="checkbox-line">
                    <input
                      type="checkbox"
                      :disabled="disableRowCheckbox(r.deviceNumber)"
                      :value="r.deviceNumber"
                      :checked="selectedDeviceNumbers.has(r.deviceNumber)"
                      @change="(e:any) => onToggleRow(r.deviceNumber, e.target.checked)"
                    />
                  </label>
                </td>

                <!-- DeviceID 入力 -->
                <td class="col-id">
                  <div class="id-box compact">
                    <div class="prefix">{{ deviceIdPrefixGlobal() }}</div>
                    <input
                      class="suffix-input"
                      :value="splitOnDashKeepDashOrDefault(r.deviceID, formData.facilityID ? `${formData.facilityID}-` : '').suffix"
                      :maxlength="11"
                      :rules="rules.deviceID"
                      @input="(e) => { 
                        const v = (e.target as HTMLInputElement).value;
                        const bad = findDangerousToken(v);
                        if (bad) {
                          setRowFieldError(r.deviceNumber,'deviceID', dangerMessage('device.deviceID'));
                        } else {
                          setRowFieldError(r.deviceNumber,'deviceID', null);
                        }
                        onDeviceIdSuffixInput(r.deviceNumber, e);}"
                      />
                    <button type="button" class="btn btn-action" :disabled="isUpdating(r.deviceNumber)" @click="onClickUpdateDeviceId(r)" style="margin-top: 6px;">
                      {{ t('common.update') }}
                    </button>
                  </div>
                </td>

                <!-- ProductID 入力 -->
                <td class="col-id">
                  <div class="id-box compact">
                    <div class="prefix">{{ productIdPrefixGlobal() }}</div>
                    <input
                      class="suffix-input"
                      :value="splitProductIdSuffixWithFrozenPrefix(r.productID)"
                      :maxlength="11"
                      :rules="rules.productID"
                      @input="(e) => { 
                        const v = (e.target as HTMLInputElement).value;
                        const bad = findDangerousToken(v);
                        if (bad) {
                          setRowFieldError(r.deviceNumber,'productID', dangerMessage('device.productID'));
                        } else {
                          setRowFieldError(r.deviceNumber,'productID', null);
                        }
                        onProductIdSuffixInput(r.deviceNumber, e);}"
                      />
                    <button type="button" class="btn btn-action" style="margin-top: 6px;" @click="onClickUpdateProductExtras(r, gl)" 
                    :disabled="isUpdating(r.deviceNumber)">
                      {{ t('common.update') }}
                    </button>
                  </div>
                </td>

                <!-- 太陽光パネル -->
                <td class="col-panels">
                  <template v-if="gateCols4to7(r.deviceNumber)">
                    <ul class="list-vert">
                      <li
                        v-for="(p, pIdx) in r.solarPanels"
                        :key="`p-${r.deviceNumber}-${p.panelNumber}`"
                        :class="{ 'is-disabled': r.solarPanels.length === 1 }"
                      >
                        <label class="check-label">
                          <input
                            type="checkbox"
                            :value="p.panelNumber"
                            :checked="!!selectedPanels[r.deviceNumber]?.has(p.panelNumber)"
                            :disabled="shouldDisablePanelCheckboxForRow(
                              pIdx,
                              r.solarPanels.length,
                              r.deviceNumber,
                              p.panelNumber,
                            )"
                            @change="(e: Event) =>
                              onTogglePanel(
                                r.deviceNumber,
                                p.panelNumber,
                                (e.target as HTMLInputElement).checked,
                              )"
                          />
                        </label>
                        <!-- <a href="#" class="panel-link" @click.prevent="openSolarPanel(p.panelNumber,r.deviceNumber)"> -->
                        <a href="#" class="panel-link">
                            {{ t('device.solarPanel') }}{{ pIdx + 1 }}
                        </a>
                      </li>
                    </ul>

                    <div class="row-actions">
                      <!-- <button type="button" class="btn btn-action" @click="onAddPanel(r.deviceNumber)">{{ t('common.additionButton') }}</button> -->
                      <button type="button" class="btn btn-action">{{ t('common.additionButton') }}</button>
                      <!-- <button
                        type="button"
                        class="btn btn-action"
                        :disabled="!canDeleteSelectedPanelsForRow(r.deviceNumber) || isUpdating(r.deviceNumber)"
                        @click="onClickPanelsBulkDelete(r.deviceNumber)"
                      > -->
                      <button type="button" class="btn btn-action">
                        {{ t('common.deletionButton') }}
                      </button>
                    </div>
                  </template>
                </td>

                <!-- PCS -->
                <td class="col-pcs">
                  <template v-if="gateCols4to7(r.deviceNumber)">
                    <ul class="list-vert">
                      <li
                        v-for="(u, pcsIdx) in r.pcs"
                        :key="`pcs-${r.deviceNumber}-${u.pcsNumber}`"
                        :class="{ 'is-disabled': r.pcs.length === 1 }"
                      >
                        <label class="check-label">
                          <input
                            type="checkbox"
                            :value="u.pcsNumber"
                            :checked="!!selectedPcs[r.deviceNumber]?.has(u.pcsNumber)"
                            :disabled="shouldDisablePcsCheckboxForRow(
                              pcsIdx,
                              r.pcs.length,
                              r.deviceNumber,
                              u.pcsNumber
                            )"
                            @change="(e: Event) =>
                              onTogglePcs(
                                r.deviceNumber,
                                u.pcsNumber,
                                (e.target as HTMLInputElement).checked,
                              )"
                          />
                        </label>
                        <!-- <a href="#" class="pcs-link" @click.prevent="openPcs(u.pcsNumber,r.deviceNumber)"> -->
                        <a href="#" class="pcs-link">
                            {{ t('device.pcs') }}{{ pcsIdx + 1 }}
                        </a>
                      </li>
                    </ul>

                    <div class="row-actions">
                      <!-- <button type="button" class="btn btn-action" @click="onAddPcs(r.deviceNumber)">{{ t('common.additionButton') }}</button> -->
                      <button type="button" class="btn btn-action">{{ t('common.additionButton') }}</button>
                      <!-- <button
                        type="button"
                        class="btn btn-action"
                        :disabled="!canDeleteSelectedPcsForRow(r.deviceNumber) || isUpdating(r.deviceNumber)"
                        @click="onClickPcsBulkDelete(r.deviceNumber, gl)"
                      > -->
                      <button type="button" class="btn btn-action">
                        {{ t('common.deletionButton') }}
                      </button>
                    </div>
                  </template>
                </td>

                <!-- 蓄電池 -->
                <td class="col-battery">
                  <template v-if="gateCols4to7(r.deviceNumber)">
                      <!-- <a href="#" class="resource-title link" @click.prevent="openBattery(r.deviceNumber)"> -->
                      <a href="#" class="resource-title link">    
                        {{ t('device.battery') }}
                      </a>
                    <input type="hidden" :value="r.deviceNumber" />
                  </template>
                </td>

                <!-- スマートメータ -->
                <td class="col-smart">
                  <template v-if="gateCols4to7(r.deviceNumber)">
                    <!-- <a href="#" class="resource-title link" @click.prevent="openSmartMeter(r.deviceNumber)"> -->
                    <a href="#" class="resource-title link">  
                      {{ t('device.smartMeter') }}
                    </a>
                    <input type="hidden" :value="r.deviceNumber" />
                  </template>
                </td>

              </tr>
            </tbody>
          </table>
          <!-- <BatteryEdit v-if="batterydialogOpen" v-model:open="batterydialogOpen" :device-number="selectedDevice" /> -->
          <!-- スマートメータ編集 -->
          <!-- <SmartMeterEditForm  v-if="dialogOpen" v-model:open="dialogOpen" :device-number="selectedDevice" /> -->

          <!-- PCS 編集 -->
          <!-- <PcsEditModal
            v-if="pcsDialogOpen"
            v-model:open="pcsDialogOpen"
            :device-number="selectedDevice"
            :pcs-number="selectPcs"
          />
          <SolarPanelEdit
            v-if="panelDialogOpen"
            v-model:open="panelDialogOpen"
            :device-number="selectedDevice"
            :pcs-number="selectPanel"
          /> -->
        </div>
      </v-card>
    </v-container>
  </div>
</template>

<script setup lang="ts">
// Vue 関連
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFacilityEdit } from './FacilityEdit'   // Composable の読み込み
import { useGlobalLoading, type GlobalLoadingService } from "../Common/composables/GlobalLoading"

import PhotoUploadModal from '@/pages/FacilityRegister/components/PhotoUploadModal.vue'
import { usePhotoUpload } from '@/pages/FacilityRegister/composables/usePhotoUpload'

// レジスタ用モーダル／Composable で利用する FacilityImage 型
import type { FacilityImage as RegImage, facilityType } from '@/pages/FacilityRegister/FacilityRegister'

const { t } = useI18n()
// import SmartMeterEditForm from './components/SmartMeterEdit.vue'
// import PcsEditModal from './components/PCSEdit.vue'
// import BatteryEdit from './components/BatteryEdit.vue'
// import SolarPanelEdit from './components/SolarpanelEditFrom.vue'


const showEcoPwd = ref(false)
// const dialogOpen = ref(false)
// const batterydialogOpen = ref(false)
// const selectedDevice = ref<string | null>(null)
const imageDisplayName = computed(() => formData.value.facilityImage?.displayName ?? '')
const imageFieldKey = computed(() => `${formData.value.facilityID}::${imageDisplayName.value}`)
/** スマートメータ編集モーダルを開く */
// function openSmartMeter(deviceNumber: string) {
//   selectedDevice.value = deviceNumber
//   dialogOpen.value = true
// }
// function openBattery(deviceNumber: string) {
//   selectedDevice.value = deviceNumber
//   batterydialogOpen.value = true
// }
// const pcsDialogOpen = ref(false)
// const panelDialogOpen = ref(false)
// const selectPcs = ref<string | null>(null)
// const selectPanel = ref<string | null>(null)

/** PCS 編集モーダルを開く */
// function openPcs(pcsNumber: string, deviceNumber: string) {
//   selectedDevice.value = deviceNumber
//   selectPcs.value = pcsNumber
//   pcsDialogOpen.value = true
// }
// function openSolarPanel(panelNumber: string, deviceNumber: string) {
//   selectedDevice.value = deviceNumber
//   selectPanel.value = panelNumber
//   panelDialogOpen.value = true
// }
// FacilityEdit Composable から必要な状態・関数を取得
const {
  formData, msg, error, loading: pageLoading, statusCode,
  CategoryItems, StatusItems,
  pageBgStyle, pageBgUrl, selectedImageUrl,
  topErrorList,equipmentCreateErrorList,deviceIDErrorList,productIDErrorList,deviceDeleteErrorList,
  // addPanelErrorList,addPcsErrorList,
  // panelsBulkDeleteErrorList,pcsBulkDeleteErrorList,
  columns, deviceRows, selectedDeviceNumbers,
  selectedPanels, selectedPcs,
  canDeleteSelectedDevices, disableRowCheckbox, onToggleRow,
  confirmOpen, openConfirm, onConfirm,
  bulkDeleteConfirmOpen, openBulkDeleteConfirm, onConfirmBulkDelete,
  deletingNow, tableLoadingLocal,
  shouldDisablePanelCheckboxForRow, shouldDisablePcsCheckboxForRow,
  // canDeleteSelectedPanelsForRow, onClickPanelsBulkDelete,
  // canDeleteSelectedPcsForRow, onClickPcsBulkDelete,
  resolveUrl, 
  rules, clearServerError,
  onSubmit, onCancel,
  deviceIdPrefixGlobal, productIdPrefixGlobal,
  splitOnDashKeepDashOrDefault, onDeviceIdSuffixInput, onProductIdSuffixInput,setRowFieldError,inlineRowErrorList,clearRowErrors,
  /*addPanel, addPcs,*/ removeDevice,
  onClickUpdateDeviceId, onClickUpdateProductExtras,
  gateCols4to7, isUpdating, onTogglePanel, onTogglePcs,
  pending,splitProductIdSuffixWithFrozenPrefix,
  resetForm,clearFacilityImage,tableSuccessList,
  suppressCategoryWatch,findDangerousToken,dangerMessage,
} = useFacilityEdit()

// 画像選択モーダルの状態（施設登録側の Composable から流用）
const {
  dialog: photoDialog,
  loading: photoLoading,
  dialogError: photoError,
  images: photoImages,
  open: photoOpen,
  close: photoClose,
} = usePhotoUpload()

// 補助（カテゴリ → facilityType '0'|'1' へ正規化）
function normalizeCategoryToFacilityType(v: unknown): facilityType | undefined {
  const s = String(v ?? '').trim()
  if (s === '0' || s === '1') return s
  return undefined
}

// モーダル内で現在選択中の画像をハイライト
const selectedSrcForModal = computed(() => {
  const img = formData.value.facilityImage
  return img?.presignedUrl || resolveUrl(img?.relativePath || '') || ''
})

// フォトモーダルを開く（カテゴリ別）
async function onOpenImage(): Promise<void> {
  const cat = normalizeCategoryToFacilityType(formData.value.facilityTypeSelected)
  if (!cat) return
  await photoOpen(cat)
}

// レジスタ側の FacilityImage → 編集フォーム用の画像型へ変換
function mapRegImageToEditImage(img: RegImage) {
  const relativePath = (img.relativePath || '').trim()
  const displayName  = (img.displayName || '').trim()
  const presignedUrl = (img.presignedUrl || '').trim()
  return { relativePath, displayName, presignedUrl }
}

// モーダルで選択 → 編集フォームへ反映してクローズ
function onSelectFromModal(img: RegImage): void {
  const mapped = mapRegImageToEditImage(img)
  formData.value.facilityImage = mapped
  clearServerError('imageFilename')
  photoClose()
}

// Vuetify のフォーム参照
const formRef = ref()

// GL（グローバルローディング）
const gl: GlobalLoadingService = useGlobalLoading()

// ラッパー関数（GL を伴う追加操作）
// function onAddPanel(deviceNumber: string) {
//   return addPanel(deviceNumber, gl)
// }
// function onAddPcs(deviceNumber: string) {
//   return addPcs(deviceNumber, gl)
// }

// 親へ公開（必要メソッドのみ）
defineExpose({
  resetForm,
  onCancel,
  suppressCategoryWatch,
  msg, loading: pageLoading, error, formRef, statusCode,
  formData, resolveUrl, selectedImageUrl, pageBgUrl, rules,
  onSubmit: () => onSubmit(() => formRef.value?.validate?.()), onClickUpdateProductExtras,
  /*addPanel, addPcs,*/ removeDevice,
  selectedPanels, selectedPcs, onTogglePanel, onTogglePcs,
})
</script>

<style scoped>
.gap-2 {
  gap: 8px;
}

:deep(.v-field__prepend-inner) {
  display: none !important;
}

:deep(.v-field__field) {
  padding-inline-start: 0 !important;
  padding-inline-end: 0 !important;
}

.cursor-pointer {
  cursor: pointer;
}

.rounded {
  border-radius: 8px;
}

.selectable {
  border: 1px solid rgba(0, 0, 0, 0.12);
  position: relative;
}

.image-container {
  position: relative;
}

.selected-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.35);
  border-radius: 8px;
}

.hover-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.15);
  border-radius: 8px;
}

.text-truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.d-flex.gap-2.mt-4.btn-position {
    justify-content: end;
}

.okBtn{
  position: relative;
  margin: 0 auto;
}

v-container{
  width: 80%;
}

.page-bg {
  position: fixed;
  inset: 0;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  z-index: 0;
  width: 100%;
  height: 100%;
}

.page-content {
  position: relative;
  z-index: 1;
}

.v-card.v-theme--light.v-card--density-default.elevation-2.v-card--variant-elevated {
    opacity: .9;
    box-shadow: 0px 4px 50px 20px rgba(0, 0, 0, 0.1) !important;
    border-radius: 2%;
}

.v-card-text {
    padding: 2rem !important;
}

.v-col,
[class^="v-col-"],
[class*=" v-col-"] {
  padding: 0 !important;
}

.v-row{
  margin: 0 !important;
}

.v-input--density-default {
    --v-input-control-height: 40px;
    --v-input-padding-top: 4px;
}

:deep(.v-input--density-default .v-field--variant-outlined, .v-input--density-default .v-field--single-line, .v-input--density-default .v-field--no-label) {
    --v-field-padding-bottom: 4px !important;
}

.select-box ,.select-image {
    margin-bottom: 24px !important;
}

.v-container{
  max-width: unset !important;
  width: 90% !important;
}


.table-wrap { overflow-x: auto; }
.seven-col-table {
  width: 94%;
  border-collapse: collapse;
  font-size: 14px;
  margin: 0 auto !important;
}
.seven-col-table th, .seven-col-table td {
  border: 1px solid #e0e0e0;
  padding: 8px 10px;
  text-align: center;
  white-space: nowrap;
}
.seven-col-table thead th {
  background: #f8f9fa;
  font-weight: 600;
}
.state { padding: 12px; color: #616161; }
.state.empty { border: 1px dashed #ddd; border-radius: 6px; }

.table-wrap{
    margin-bottom: 2rem !important;
}

@media (max-width: 1270px) {
  .table-wrap{
    margin: 1rem 1rem 2rem 1rem !important;
}
}

form.v-form {
    width: 60%;
    margin: 0 auto !important;
}

.addOrDeleteDevice {
    margin-bottom: 1rem !important;
}

.col-id {
  vertical-align: top;
  padding: 12px;
}

.id-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.prefix {
  font-weight: bold;
  font-size: 14px;
  margin-bottom: 2px;
}

.suffix-input {
  width: 110px;
  height: 28px;
  border: 1px solid #333;
  padding: 3px 5px;
  text-align: center;
  border-radius: 3px;
  background-color: white;
}

.update-btn {
  background: #16a34a;
  color: white;
  border: none;
  padding: 4px 12px;
  margin-top: 4px;
  cursor: pointer;
  border-radius: 3px;
  font-size: 13px;
}

.update-btn:hover {
  background: #128a3c;
}

.list-vert {
  list-style: none;
  padding-left: 0;
  margin: 0 0 8px 0;
}
.list-vert > li {
  margin: 4px 0;
  display: flex;
  align-items: center;
  gap: 6px;
}
.list-vert > li::marker { content: none; }

.ellipsis {
  color: #6b7280;
  margin-left: 22px;
}

.check-label { display: inline-flex; align-items: center; }

.panel-link, .pcs-link {
  color: #2563eb;
  text-decoration: underline;
  cursor: pointer;
  font-weight: 600;
}
.panel-link:hover, .pcs-link:hover { color: #1e40af; }

.is-disabled input[type="checkbox"] { opacity: 0.7; }

.row-actions {
  margin-top: 8px;
  display: flex;
  gap: 8px;
}

.btn {
  border: none;
  padding: 6px 12px;
  border-radius: 3px;
  font-size: 13px;
  line-height: 1.2;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 700;
}

.btn-action {
  background-color: #16a34a;
  color: #fff;
  box-shadow: 0 0 0 1px rgba(0,0,0,0.05) inset;
}
.btn-action:hover { background-color: #128a3c; }


.btn-action:disabled {
  background-color: #d1d5db;
  color: #6b7280;
  cursor: not-allowed;
}

.is-disabled input[type="checkbox"] { opacity: 0.7; }

.v-text-field .v-input__details {
    padding-inline: unset !important;
}

@media (max-width: 1272px) {
  form.v-form {
      width: 85%;
      margin: 0 auto !important;
  }
}

.v-card-text {
  padding-top: 18px;
  padding-bottom: 6px;
}

.v-card-actions {
  padding: 12px 16px 16px 16px;
}

.v-btn[color="grey"] {
  background-color: #e6e6e6;
  color: #4a4a4a;
}

.v-btn[color="primary"] {
  background-color: #dfe8f6;
  color: #2a4a8a;
}
.v-dialog > .v-overlay__content > .v-card, .v-dialog > .v-overlay__content > form > .v-card {
    border-radius: 20px;
}

:deep(.table-wrap thead th) {
  background-color: #afd7b0!important;
  font-family: 'Noto Sans JP';
}
 
.detailDeviceInfo {
    font-weight: bold;
}

.tableWrapper.d-flex.justify-space-between.align-center.mb-4 {
    width: 94%;
    margin: 0 auto !important;
}

.hp-input {
  position: absolute;
  left: -9999px;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.addDevice,.deleteDevice{
  width: 110px;
  height: 36px;
  grid-area: content;
  justify-content: center;
}

.table-wrap > .v-alert.v-theme--light.text-error {
  width: 94%;
  margin: 0 auto;
}

.table-wrap > .v-alert.v-theme--light.text-success {
    width: 94%;
    margin: 0 auto;
}

.v-card-text.text-body-2 {
    text-align: center;
}

span.mr-1 {
    margin-top: -15px;
}
span.text-red {
    margin-top: -15px;
}
</style>