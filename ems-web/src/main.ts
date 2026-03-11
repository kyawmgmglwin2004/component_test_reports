import './amplify';
import 'aws-amplify/auth/enable-oauth-listener';

import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import { i18n } from './i18n';

import { Hub } from 'aws-amplify/utils';
import { getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';

import 'vuetify/styles';
import '@mdi/font/css/materialdesignicons.css';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import { aliases, mdi } from 'vuetify/iconsets/mdi';

Hub.listen('auth', async ({ payload }) => {
  switch (payload.event) {

   case 'signedIn': {
      try { await getCurrentUser(); } catch {}

      const key = (payload as { data?: unknown })?.data;
      const KEY = (typeof key === 'string' && key) ? key : 'oauth:returnTo';
      const returnTo = sessionStorage.getItem(KEY) || '/';
      sessionStorage.removeItem(KEY);

      try {
        const url = new URL(window.location.href);
        url.search = '';
        window.history.replaceState({}, '', url.toString());
      } catch {}

      router.replace(typeof returnTo === 'string' && returnTo.length > 0 ? returnTo : '/');
      break;
    }


    case 'signInWithRedirect_failure': {
      // failure path
      await router.isReady();
      try {
        const url = new URL(window.location.href);
        url.search = '';                         // scrub ?code&state
        window.history.replaceState({}, '', url.toString());
      } catch {}
      await router.replace('/auth/last-login-update-failed');
      break;

    }
  }
});


const vuetify = createVuetify({
  components,
  directives,
  icons: { defaultSet: 'mdi', aliases, sets: { mdi } },
});

(async () => {
  const qp = new URLSearchParams(window.location.search);
  if (qp.has('code') && qp.has('state')) {
    try {
      await fetchAuthSession();
    } catch {
    }
  }

  createApp(App).use(router).use(vuetify).use(i18n).mount('#app');
})();
