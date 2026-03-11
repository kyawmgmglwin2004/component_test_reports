// src/mocks/handlers.ts
// import { http, HttpResponse } from 'msw'
//import { authHandlers } from './handlers/auth.handlers'
import { usersHandlers } from './handlers/users.handlers'
import { updatesHandlers } from './handlers/updates.handlers'
import { registerHandlers } from './handlers/register.handlers'
import { chartHandlers } from './handlers/chart.handlers'
import { facilityListHandlers } from './handlers/facilitylist.handlers'
import { facilityRegisterHandlers } from './handlers/facilityregister.handlers'
import { eamountcheckHandler } from './handlers/eamountCheck.handlers'
import { ChartHandlers } from './handlers/detailchart.handler'
import { facilityEditHandlers } from './handlers/facilityedit.handlers'
import { solarPanelEditHandlers } from './handlers/solarpanelEdit.handlers'
import { pcsEditHandlers } from './handlers/pcsedit.handlers'
import { batteryEditHandlers } from './handlers/batteryEdit.handlers'
import { smartmeterEditHandlers } from './handlers/smartmeteredit.handlers'


export const handlers = [
  // --- ADD THIS HANDLER FOR AMPLIFY REFRESH ---
  // http.post('http://localhost:5173/dev-cognito/oauth2/token', async ({ request }) => {
  //   const body = await request.formData();
  //   console.log('MSW: Intercepted Cognito Token Request', body.get('grant_type'));

  //   // Return mock tokens that Amplify expects to receive
  //   return HttpResponse.json({
  //     access_token: `mock-access-token-refreshed-${Date.now()}`,
  //     id_token: `mock-id-token-refreshed-${Date.now()}`,
  //     refresh_token: body.get('refresh_token') || 'mock-refresh-token',
  //     expires_in: 3600,
  //     token_type: 'Bearer'
  //   });
  // }),

  // --- EXISTING HANDLERS ---
  //...authHandlers,
  ...usersHandlers,
  ...updatesHandlers,
  ...registerHandlers,
  ...chartHandlers,
  ...facilityListHandlers,
  ...facilityRegisterHandlers,
  ...eamountcheckHandler,
  ...ChartHandlers,
  ...facilityEditHandlers,
  ...solarPanelEditHandlers,
  ...pcsEditHandlers,
  ...batteryEditHandlers,
  ...smartmeterEditHandlers,
]
