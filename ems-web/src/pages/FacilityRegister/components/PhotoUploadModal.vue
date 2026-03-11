
<template>
 
  <v-dialog v-model="model" max-width="720">
  
    <v-card class="photo-dialog-card">
      <v-card-title>
        {{ title }}
      </v-card-title>

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

     
      <div v-if="getPhotoErrorList?.length" class="photo-errors">
        <v-icon size="60" color="grey">mdi-image</v-icon>

        
        <div class="photo-error-texts" @click="clearPhotoErrors">
          <div
            v-for="(m, i) in getPhotoErrorList"
            :key="i"
            class="photo-error-line"
          >
            {{ m }}
          </div>
        </div>
      </div>

      
      <v-card-text class="photo-dialog-scroll">
      
        <div v-if="loading" class="pa-4">
          <v-row dense>
            <v-col v-for="n in 6" :key="n" cols="4">
              <v-skeleton-loader type="image" />
            </v-col>
          </v-row>
        </div>
    
        <div v-else-if="error" class="pa-4">
          <v-alert type="error" variant="tonal">{{ error }}</v-alert>
        </div>
        <div v-else>
          <v-row dense>
           
            <v-col v-for="img in images" :key="img.presignedUrl" cols="4">
            
              <v-hover v-slot="{ isHovering, props: hoverProps }">
              
                <div v-bind="hoverProps" class="image-container">
                
                  <v-img
                    :src="img.presignedUrl"
                    max-height="120"
                    cover
                    class="rounded selectable cursor-pointer"
                    @click="emitSelect(img)"
                  >
                 
                    <template #placeholder>
                      <div class="d-flex align-center justify-center" style="height: 120px;">
                        <v-progress-circular indeterminate color="primary" />
                      </div>
                    </template>

                 
                    <template #error>
                      <div class="pa-4 text-center">Cannot load image.</div>
                    </template>

              
                    <div v-if="stripQuery(selectedSrc) === stripQuery(img.presignedUrl)" class="selected-overlay">
                      <v-icon color="white">mdi-check-circle</v-icon>
                    </div>
                 
                    <div v-else-if="isHovering" class="hover-overlay" />
                  </v-img>
                  <div class="text-caption mt-1 text-truncate" :title="img.displayName">
                    {{ img.displayName }}
                  </div>
                </div>
              </v-hover>
            </v-col>
          </v-row>
        </div>
      </v-card-text>

   
      <v-card-actions class="photo-dialog-actions">
        <v-spacer />
       
        <v-btn variant="text" @click="model = false">{{ closeText }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">

import type { FacilityImage } from '@/pages/FacilityRegister/FacilityRegister.ts'

import { getPhotoErrorList,topErrorList } from '../composables/usePhotoUpload.ts'

const model = defineModel<boolean>({ default: false })

defineProps<{
  title: string
  closeText: string
  loading: boolean
  error: string | null
  images: FacilityImage[]
  selectedSrc: string
  logoSrc?: string
}>()

function stripQuery(u: string): string {
  try {
    const url = new URL(u, window.location.origin)
    return decodeURIComponent(url.origin + url.pathname)
  } catch {
    return decodeURIComponent(u.split('?')[0] || u)
  }
}

const emit = defineEmits<{
  (e: 'select', img: FacilityImage): void
}>()

function emitSelect(img: FacilityImage) {
  emit('select', img)
}


function clearPhotoErrors() {
  getPhotoErrorList.value = []
}
</script>

<style scoped>
.cursor-pointer { cursor: pointer; }
.rounded { border-radius: 8px; }

.photo-dialog-card {
  display: flex;
  flex-direction: column;
  max-height: 80vh;
}


.photo-dialog-scroll {
  overflow-y: auto;
}

.photo-dialog-actions {
  border-top: 1px solid rgba(0,0,0,0.06);
  background: #fff;
}

.selectable {
  position: relative;
  border: 1px solid rgba(0,0,0,0.12);
}


.selected-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, .35);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
}


.hover-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, .15);
  border-radius: 8px;
}


.text-truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}


.photo-errors {
  display: flex;
  flex-direction: column;  
  justify-content: center;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}


.photo-error-texts {
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: center;
  cursor: pointer;         
}


.photo-error-line {
  font-size: 15px;
  color: #6e6e6e;          
  line-height: 1.4;
  font-weight: 500;
}

@media (max-width: 599px) {
  .photo-dialog-card { max-height: 85vh; }
}
</style>