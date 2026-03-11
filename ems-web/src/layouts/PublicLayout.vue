<template> 
  <v-app>   
<v-app-bar
  color="primary"
  dark
  flat
  :height="smAndDown ? 100 : 64"
  :extension-height="smAndDown ? 70 : 0"
>
      <v-row align="center" no-gutters>
        <v-col :cols= "smAndDown ? 2 : 1">  
          <div class="logo-img">
            <v-img
            :src="iconImage"
            alt="Company Logo"
            />
          </div>
        </v-col>
        <v-col cols="10">

        </v-col>
        </v-row>
</v-app-bar>


    <v-main>
      <router-view />
    </v-main>
        <v-footer app :inset="false" elevation="6" class="footer-over-drawer" color="primary">
      <span class="mx-auto">© 2026 NTT EAST, Inc.</span>
    </v-footer>
</v-app>
    

  
</template>
<script setup lang="ts">
import iconImage from '../assets/images/ems-logo.png'
import { useDisplay } from 'vuetify'
const { smAndDown } = useDisplay()

</script>
<style scoped>
.v-app, .v-app *{
  font-size: 1rem;
  font-family: "Noto Sans JP", sans-serif !important;
}
.v-app-bar,
.v-app-bar * {
  padding: 0 1px;
  font-size: 1rem;
  text-align: center;
  font-family: "Noto Sans JP", sans-serif;
}
.text-white { color: #1522d8 !important; }
.v-main{
  padding-bottom: 0;
}

:deep(.footer-over-drawer){
  z-index: 1200 !important;
  left:0 !important;
  right:0 !important;
  width:auto !important;
}

.no-bg-hover, .no-bg-hover .v-btn__content {
  opacity: 1 !important;
}

.nav-hover .v-list-item:hover {
  background-color: #b3eaf9; 
  color: #1522d8; 
}

.nav-hover .v-list-item:hover .v-list-item-title {
  color: #1522d8;
}

 .logo-img{
  aspect-ratio : 1 / 1;
 }
 .logo-img .v-img {
  width: 100%;
  height: 100%;
}
.text-caption{
  background-color: #d1f0bb;
}

 @media (max-width: 700px){
  .text-caption .v-btn__content{
    font-size: 0.7rem;
    
  }
 }
@media (min-width: 1900px) {
.v-navigation-drawer .v-list-item-title{
  font-size:medium;
}
.logo-img{
  width: 80%;
}


}
</style>
