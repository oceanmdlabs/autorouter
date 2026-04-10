# Deployment

Current deployment is:

- Cloud Run
- Firebase as reverse proxy
- Cloud SQL for database

### Big Gotcha

- Firebase strips session cookies unless they are called `__session`

```
        // https://firebase.google.com/docs/hosting/manage-cache#using_cookies
        // https://nuxt.com/modules/auth-utils#configuration
session: {
    name: '__session',
        password: process.env.NUXT_SESSION_PASSWORD || '',
        cookie: {
        sameSite: 'lax'
    }
},
```