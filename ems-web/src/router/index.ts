// src/router/index.ts
import { createRouter, createWebHistory } from 'vue-router';
import { fetchAuthSession } from 'aws-amplify/auth';
import type {
  NavigationGuardNext,
  RouteLocationNormalized,
  RouteLocationMatched,
} from 'vue-router';

const MainLayout = () => import('@/layouts/MainLayout.vue');
const PublicLayout = () => import('@/layouts/PublicLayout.vue');

const FacilityListPage = () => import('@/pages/FacilityList/FacilityListPage.vue');
const FacilityRegisterPage = () => import('@/pages/FacilityRegister/FacilityRegister.vue');
const FacilityEditPage = () => import('@/pages/FacilityEdit/FacilityEditPage.vue');
const PCSEditForm = () => import('@/pages/FacilityEdit/components/PCSEdit.vue');
const SolarPanelEditForm = () => import('@/pages/FacilityEdit/components/SolarpanelEditFrom.vue');
const BatteryEditForm = () => import('@/pages/FacilityEdit/components/BatteryEdit.vue');
const SmartMeterEditForm = () => import('@/pages/FacilityEdit/components/SmartMeterEdit.vue');

const EnergyHistoryPage = () => import('@/pages/ElectricityCheckHistory/ElectricityCheckHistory.vue');
const EnergyDashboardPage = () => import('@/pages/ElectricityAmountCheck/ElectricityAmountCheck.vue');

const CommonErrorScreen = () => import('@/pages/Common/components/CommonErrorScreen.vue');
const CommonErrorScreenVisual = () => import('@/pages/Common/components/CommonErrorScreenVisual.vue');
const LastLoginUpdateFailedPage = () => import('@/pages/Common/components/LastLoginUpdateFailedPage.vue');


const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/facilities/:facilityID/energy',
      component: PublicLayout,
      children: [{ path: '', name: 'energy-history', component: EnergyHistoryPage }],
    },
    {
      path: '/facilities/:facilityID/energy/dashboard',
      component: PublicLayout,
      children: [{ path: '', name: 'energy-dashboard', component: EnergyDashboardPage }],
    },

    {
      path: '/auth/last-login-update-failed',
      name: 'last-login-update-failed',
      component: LastLoginUpdateFailedPage,
      meta: { requiresAuth: false, public: true },
    },

    {
      path: '/login',
      name: 'login',
      component: { render: () => null },
      beforeEnter: async (to) => {
        const { signInWithRedirect } = await import('aws-amplify/auth');

        const requested = (to.query.returnTo as string) || '/';

        const KEY = 'oauth:returnTo';
        sessionStorage.setItem(KEY, requested);

        await signInWithRedirect({ customState: KEY });

        return false;
      },
      meta: { requiresAuth: false },
    },

    {
      path: '/',
      component: MainLayout,
      meta: { requiresAuth: true },
      children: [
        { path: '', name: 'home', component: FacilityListPage },
        { path: 'facilities/:facilityID', name: 'facility-edit', component: FacilityEditPage },
        { path: 'FacilityRegister', name: 'facility-register', component: FacilityRegisterPage },
        { path: 'BatteryEditForm', name: 'battery-edit', component: BatteryEditForm },
        { path: 'devices/:deviceNumber/pcs/:PCSNumber/init', name: 'pcs-init', component: PCSEditForm },
        { path: 'devices/:deviceNumber/pcs/:panelNumber/init', name: 'panel-init', component: SolarPanelEditForm },
        { path: 'smart-meter/:deviceNumber/init', name: 'smart-meter-init', component: SmartMeterEditForm },
      ],
    },

    {
      path: '/error',
      name: 'common-error',
      component: CommonErrorScreen,
      props: (route) => ({ returnTo: (route.query.returnTo as string) || '' }),
      meta: { requiresAuth: false },
    },
    {
      path: '/erroroccur',
      name: 'common-error-visual',
      component: CommonErrorScreenVisual,
      meta: { requiresAuth: false },
    },

    { path: '/:pathMatch(.*)*', redirect: '/erroroccur' },
  ],
});

function getRequiredRoleFromMatched(
  matched: readonly RouteLocationMatched[]
): string | undefined {
  for (let i = matched.length - 1; i >= 0; i--) {
    const role = matched[i]?.meta?.requiresRole;
    if (typeof role === 'string' && role.length > 0) return role;
  }
  return undefined;
}

function getUserRole(
  session: Awaited<ReturnType<typeof fetchAuthSession>> | null
): string | undefined {
  const payload = session?.tokens?.idToken?.payload as Record<string, unknown> | undefined;
  const value = payload?.['custom:role'];
  return typeof value === 'string' ? value : undefined;
}

router.beforeEach(
  async (to: RouteLocationNormalized, _from: RouteLocationNormalized, next: NavigationGuardNext) => {

  const hasCodeState = typeof to.query?.code === 'string' && typeof to.query?.state === 'string';
    // Only let Amplify finish if we're actually landing on the callback path
    if (hasCodeState && to.path === '/') {
      return next();
    }

    if (to.meta?.public === true) {
      return next();
    }


    const hasOAuthError =
      typeof to.query?.error === 'string' || typeof to.query?.error_description === 'string';
    if (hasOAuthError) {
      return next({ path: '/error', query: to.query as Record<string, string> });
    }

    const urlHasPostLogout =
      typeof to.query?.client_id === 'string' || typeof to.query?.logout_uri === 'string';
    if (urlHasPostLogout) {
      return next({ path: '/login' });
    }

    let session: Awaited<ReturnType<typeof fetchAuthSession>> | null = null;
    try {
      session = await fetchAuthSession();
    } catch {
      session = null;
    }
    const isLoggedIn = Boolean(session?.tokens?.idToken);

    const requiresAuth = to.matched.some((r) => r?.meta?.requiresAuth === true);
    if (requiresAuth && !isLoggedIn) {
      if (to.path !== '/login') {
        return next({ path: '/login', query: { returnTo: to.fullPath } });
      }
      return next(false);
    }

    const requiredRole = getRequiredRoleFromMatched(to.matched);
    if (requiredRole) {
      const userRole = getUserRole(session);
      if (userRole !== requiredRole) {
        console.warn(`User role ${userRole} does not match required role ${requiredRole}`);
        return next({ path: '/error', query: { returnTo: to.fullPath } });
      }
    }

    return next();
  }
);

export default router;
