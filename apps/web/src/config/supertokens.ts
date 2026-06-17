import Passwordless from "supertokens-auth-react/recipe/passwordless";
import Session from "supertokens-auth-react/recipe/session";

export const superTokensConfig = {
  appInfo: {
    appName: "Narval",
    apiDomain: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
    websiteDomain: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
    apiBasePath: "/api/proxy/auth",
    websiteBasePath: "/auth",
  },
  recipeList: [
    Passwordless.init({
      contactMethod: "EMAIL",
      
      // Override default UI to match our custom flow
      override: {
        functions: (originalImplementation) => {
          return {
            ...originalImplementation,
          };
        },
      },
    }),
    Session.init({
      tokenTransferMethod: "cookie",
    }),
  ],
};
