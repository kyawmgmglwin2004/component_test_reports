import { Amplify } from 'aws-amplify';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: 'ap-northeast-1_RwazxjMLA',
      userPoolClientId: import.meta.env.VITE_COGNITO_APP_CLIENT_ID,
      loginWith: {
        oauth: {
          domain: import.meta.env.VITE_COGNITO_DOMAIN,
          scopes: import.meta.env.VITE_OAUTH_SCOPES.split(','),
          redirectSignIn: [import.meta.env.VITE_COGNITO_REDIRECT_SIGN_IN],
          redirectSignOut: [import.meta.env.VITE_COGNITO_REDIRECT_SIGN_OUT],
          responseType: 'code',
        },
      },
    },
  },
});
